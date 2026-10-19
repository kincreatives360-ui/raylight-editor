// src/storage/projectIO.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveProjectToBrowser,
  loadProjectFromBrowser,
  importProjectFromFile,
  exportProjectToFile,
} from './projectIO';
import { DEFAULT_PROJECT, createDefaultShot } from '../model/defaults';
import type { Project } from '../model/types';

describe('Project IO Storage & File Operations', () => {
  const AUTO_SAVE_KEY = 'raylight_studio_project_v1';
  let storageMap: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: vi.fn((key: string) => storageMap[key] || null),
    setItem: vi.fn((key: string, val: string) => {
      storageMap[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
      delete storageMap[key];
    }),
    clear: vi.fn(() => {
      storageMap = {};
    }),
  };

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    storageMap = {};
    vi.clearAllMocks();
    (globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      indexedDB: null, // Test localStorage fallback
    };
  });

  afterEach(() => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = originalLocalStorage;
    (globalThis as unknown as { window: unknown }).window = originalWindow;
  });

  it('1. saveProjectToBrowser writes JSON payload to localStorage', () => {
    const project: Project = {
      ...DEFAULT_PROJECT,
      name: 'Test Project Alpha',
    };

    saveProjectToBrowser(project);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      AUTO_SAVE_KEY,
      expect.stringContaining('Test Project Alpha')
    );
    expect(storageMap[AUTO_SAVE_KEY]).toBeDefined();
  });

  it('2. loadProjectFromBrowser validates and deserializes stored project', () => {
    const project: Project = {
      ...DEFAULT_PROJECT,
      name: 'Saved Project Beta',
    };

    storageMap[AUTO_SAVE_KEY] = JSON.stringify(project);

    const loaded = loadProjectFromBrowser();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Saved Project Beta');
  });

  it('3. loadProjectFromBrowser migrates legacy blank project with legacy #111114 canvas background', () => {
    const legacyBlank = {
      ...DEFAULT_PROJECT,
      name: 'Untitled project',
      aspectRatio: '16:9',
      fps: 60,
      assets: {},
      audio: { clips: [], muted: false, masterVolume: 1 },
      shots: [
        {
          ...createDefaultShot(),
          layers: [],
          cameraBlocks: [],
          lightBlocks: [],
          effectBlocks: [],
        },
      ],
      background: {
        kind: 'solid',
        color: '#111114',
      },
    };

    storageMap[AUTO_SAVE_KEY] = JSON.stringify(legacyBlank);

    const loaded = loadProjectFromBrowser();
    expect(loaded).toEqual(DEFAULT_PROJECT);
  });

  it('4. loadProjectFromBrowser returns null on corrupted JSON or schema invalidation', () => {
    // Malformed JSON
    storageMap[AUTO_SAVE_KEY] = '{ corrupted json string...';
    expect(loadProjectFromBrowser()).toBeNull();

    // Invalid schema (missing required fields)
    storageMap[AUTO_SAVE_KEY] = JSON.stringify({ notAProject: true });
    expect(loadProjectFromBrowser()).toBeNull();
  });

  it('5. importProjectFromFile validates uploaded valid .raylight.json file', async () => {
    const project: Project = {
      ...DEFAULT_PROJECT,
      name: 'Imported Showcase',
    };

    const file = new File([JSON.stringify(project)], 'project.raylight.json', {
      type: 'application/json',
    });

    const result = await importProjectFromFile(file);
    expect(result.success).toBe(true);
    if (!result.success || !('data' in result)) {
      throw new Error('Expected import to succeed');
    }
    expect(result.data.name).toBe('Imported Showcase');
  });

  it('6. importProjectFromFile returns errors on malformed JSON or schema violations', async () => {
    // Malformed JSON
    const malformedFile = new File(['invalid json text'], 'bad.json', {
      type: 'application/json',
    });
    const malformedResult = await importProjectFromFile(malformedFile);
    expect(malformedResult.success).toBe(false);
    if ('errors' in malformedResult) {
      expect(malformedResult.errors[0]).toContain('Failed to parse JSON file');
    } else {
      expect.fail('Expected malformed JSON import to fail with errors');
    }

    // Schema violation: invalid fps (e.g. 120 is not 24|30|60)
    const invalidSchemaProject = {
      ...DEFAULT_PROJECT,
      fps: 120,
    };
    const invalidFile = new File(
      [JSON.stringify(invalidSchemaProject)],
      'invalid_fps.json',
      { type: 'application/json' }
    );
    const invalidResult = await importProjectFromFile(invalidFile);
    expect(invalidResult.success).toBe(false);
    if ('errors' in invalidResult) {
      expect(invalidResult.errors.some((err: string) => err.includes('fps'))).toBe(true);
    } else {
      expect.fail('Expected invalid schema import to fail with errors');
    }
  });

  it('7. exportProjectToFile safely triggers download without error in DOM and non-DOM environments', () => {
    const originalDoc = globalThis.document;
    const originalURL = globalThis.URL;

    try {
      // Non-DOM environment: explicitly set document to undefined to exercise guard
      delete (globalThis as unknown as { document?: unknown }).document;
      expect(() => exportProjectToFile(DEFAULT_PROJECT)).not.toThrow();

      // DOM environment mock
      const clickMock = vi.fn();
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();

      const mockAnchor = {
        href: '',
        download: '',
        click: clickMock,
      };

      (globalThis as unknown as { document: unknown }).document = {
        createElement: vi.fn(() => mockAnchor),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
      };

      (globalThis as unknown as { URL: unknown }).URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      };

      exportProjectToFile({ ...DEFAULT_PROJECT, name: 'My Great Video' });
      expect(mockAnchor.download).toBe('my-great-video.raylight.json');
      expect(clickMock).toHaveBeenCalled();
      expect(appendChildMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as { document: unknown }).document = originalDoc;
      (globalThis as unknown as { URL: unknown }).URL = originalURL;
    }
  });

  it('8. saveProjectToBrowser falls back to lightweight assets when QuotaExceededError occurs, and loads cleanly', () => {
    let callCount = 0;
    mockLocalStorage.setItem.mockImplementation((key: string, val: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('QuotaExceededError');
      }
      storageMap[key] = val;
    });

    const project: Project = {
      ...DEFAULT_PROJECT,
      name: 'Heavy Asset Project',
      assets: {
        'asset-1': {
          id: 'asset-1',
          name: 'large_texture.png',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,large...',
          width: 100,
          height: 100,
        },
      },
    };

    saveProjectToBrowser(project);
    expect(callCount).toBe(2);
    expect(storageMap[AUTO_SAVE_KEY]).toBeDefined();

    const loaded = loadProjectFromBrowser();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Heavy Asset Project');
    expect(loaded?.assets['asset-1']).toBeDefined();
    expect(loaded?.assets['asset-1'].dataUrl).toBe('');
  });

  it('9. loadProjectFromBrowser successfully migrates legacy projects where asset records omit dataUrl', () => {
    const legacyProject = {
      ...DEFAULT_PROJECT,
      name: 'Legacy Project Missing dataUrl',
      assets: {
        'legacy-asset': {
          id: 'legacy-asset',
          name: 'old_asset.png',
          mimeType: 'image/png',
          width: 50,
          height: 50,
        },
      },
    };

    storageMap[AUTO_SAVE_KEY] = JSON.stringify(legacyProject);
    const loaded = loadProjectFromBrowser();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Legacy Project Missing dataUrl');
    expect(loaded?.assets['legacy-asset'].dataUrl).toBe('');
  });
});


// src/storage/projectIO.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveProjectToBrowser,
  loadProjectFromBrowser,
  importProjectFromFile,
  exportProjectToFile,
  saveProjectToIndexedDB,
  loadProjectFromIndexedDB,
  getStorageStatus,
  subscribeStorageStatus,
} from './projectIO';
import { validateProject } from '../model/schema';
import { DEFAULT_PROJECT, createDefaultShot, createDefaultImageLayer, createDefaultTextLayer } from '../model/defaults';
import type { Project } from '../model/types';
import * as opfsStorage from './opfsStorage';

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

  it('round-trips the Sun target added to the lighting rig schema', () => {
    const project: Project = {
      ...DEFAULT_PROJECT,
      shots: DEFAULT_PROJECT.shots.map((shot, index) => index === 0
        ? { ...shot, light: { ...shot.light, target: { x: 1, y: -0.5, z: 0.25 } } }
        : shot),
    };
    saveProjectToBrowser(project);
    expect(loadProjectFromBrowser()?.shots[0]?.light.target).toEqual({ x: 1, y: -0.5, z: 0.25 });
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

  it('10. metadata-only saves preserve previously persisted media', async () => {
    const projectStoreMap: Record<string, unknown> = {};
    const assetStoreMap: Record<string, unknown> = {
      'asset-stale': {
        id: 'asset-stale',
        name: 'stale.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,staleData',
        width: 100,
        height: 100,
      },
    };

    const mockProjectStore = {
      put: vi.fn((rec: { id: string; project: unknown }) => {
        projectStoreMap[rec.id] = rec;
      }),
      get: vi.fn((id: string) => ({
        result: projectStoreMap[id],
        set onsuccess(cb: () => void) {
          cb();
        },
      })),
    };

    const mockAssetStore = {
      put: vi.fn((asset: { id: string }) => {
        assetStoreMap[asset.id] = asset;
      }),
      delete: vi.fn((id: string) => {
        delete assetStoreMap[id];
      }),
      getAllKeys: vi.fn(() => ({
        result: Object.keys(assetStoreMap),
        set onsuccess(cb: () => void) {
          cb();
        },
      })),
      get: vi.fn((id: string) => ({
        result: assetStoreMap[id],
        set onsuccess(cb: () => void) {
          cb();
        },
      })),
    };

    const mockTx = {
      objectStore: vi.fn((name: string) =>
        name === 'projects' ? mockProjectStore : mockAssetStore
      ),
      set oncomplete(cb: () => void) {
        cb();
      },
      onerror: null,
    };

    const mockDb = {
      transaction: vi.fn(() => mockTx),
      objectStoreNames: {
        contains: () => true,
      },
      close: vi.fn(),
    };

    const mockIdb = {
      open: vi.fn(() => ({
        result: mockDb,
        set onsuccess(cb: () => void) {
          cb();
        },
      })),
    };

    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      indexedDB: mockIdb,
    };

    // Save project with asset whose dataUrl is empty
    const project: Project = {
      ...DEFAULT_PROJECT,
      id: 'proj-1',
      assets: {
        'asset-stale': {
          id: 'asset-stale',
          name: 'stale.png',
          mimeType: 'image/png',
          dataUrl: '',
          width: 100,
          height: 100,
        },
      },
    };

    const saved = await saveProjectToIndexedDB(project);
    expect(saved).toBe(true);
    // A metadata-only save must never erase a media blob which was already persisted.
    expect(mockAssetStore.delete).not.toHaveBeenCalledWith('asset-stale');
    expect(assetStoreMap['asset-stale']).toBeDefined();

    // Verify the loader can still restore that previously persisted media
    const loaded = await loadProjectFromIndexedDB();
    expect(loaded).not.toBeNull();
    expect(loaded?.assets['asset-stale']).toBeDefined();
    expect(loaded?.assets['asset-stale'].dataUrl).toBe('data:image/png;base64,staleData');
  });

  it('11. saveProjectToIndexedDB waits for OPFS operations to settle even if one rejects', async () => {
    const saveOpfsSpy = vi.spyOn(opfsStorage, 'saveMediaToOPFS').mockRejectedValue(new Error('Disk full'));

    const projectStoreMap: Record<string, unknown> = {};
    const assetStoreMap: Record<string, unknown> = {};

    const mockProjectStore = {
      put: vi.fn((rec: { id: string; project: unknown }) => {
        projectStoreMap[rec.id] = rec;
      }),
    };

    const mockAssetStore = {
      put: vi.fn((asset: { id: string }) => {
        assetStoreMap[asset.id] = asset;
      }),
      delete: vi.fn(),
      getAllKeys: vi.fn(() => ({
        result: [],
        set onsuccess(cb: () => void) {
          cb();
        },
      })),
    };

    const mockTx = {
      objectStore: vi.fn((name: string) =>
        name === 'projects' ? mockProjectStore : mockAssetStore
      ),
      set oncomplete(cb: () => void) {
        cb();
      },
      onerror: null,
    };

    const mockDb = {
      transaction: vi.fn(() => mockTx),
      objectStoreNames: {
        contains: () => true,
      },
      close: vi.fn(),
    };

    const mockIdb = {
      open: vi.fn(() => ({
        result: mockDb,
        set onsuccess(cb: () => void) {
          cb();
        },
      })),
    };

    (globalThis as unknown as { window: unknown }).window = {
      localStorage: mockLocalStorage,
      indexedDB: mockIdb,
    };

    const project: Project = {
      ...DEFAULT_PROJECT,
      id: 'proj-error-test',
      assets: {
        'asset-fail': {
          id: 'asset-fail',
          name: 'fail.png',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,failData',
          width: 100,
          height: 100,
        },
      },
    };

    const saved = await saveProjectToIndexedDB(project);
    expect(saved).toBe(true);
    expect(saveOpfsSpy).toHaveBeenCalledWith('asset-fail', 'data:image/png;base64,failData');
    expect(mockAssetStore.put).toHaveBeenCalledWith(project.assets['asset-fail']);

    await saveProjectToIndexedDB(project);
    expect(mockAssetStore.put).toHaveBeenCalledTimes(1);

    saveOpfsSpy.mockRestore();
  });

  it('13. getStorageStatus & subscribeStorageStatus track save state transitions', async () => {
    const statuses: string[] = [];
    const unsubscribe = subscribeStorageStatus((state) => {
      statuses.push(state.status);
    });

    const project: Project = {
      ...DEFAULT_PROJECT,
      name: 'Status Tracking Project',
    };

    saveProjectToBrowser(project);
    await new Promise((resolve) => setTimeout(resolve, 50));
    unsubscribe();

    expect(statuses).toContain('saving');
    expect(statuses).toContain('saved');
    expect(getStorageStatus().status).toBe('saved');
  });

  it('14. validateProject repairs referential integrity and duplicate IDs', () => {
    const corruptProject: Project = {
      ...DEFAULT_PROJECT,
      id: 'proj-corrupt',
      assets: {}, // Empty assets
      shots: [
        {
          ...createDefaultShot(),
          id: 'shot-1',
          groups: [
            { id: 'group-1', name: 'Group 1', parentGroupId: 'group-2', collapsed: false, hidden: false, locked: false },
            { id: 'group-2', name: 'Group 2', parentGroupId: 'group-1', collapsed: false, hidden: false, locked: false }, // Circular reference!
          ],
          layers: [
            createDefaultImageLayer({
              id: 'layer-duplicate',
              name: 'Hero Image',
              assetId: 'missing-asset-id', // Dangling asset reference
              maskLayerId: 'non-existent-mask', // Dangling mask
              groupId: 'non-existent-group', // Dangling group
            }),
          ],
        },
        {
          ...createDefaultShot(),
          id: 'shot-2',
          layers: [
            createDefaultTextLayer({
              id: 'layer-duplicate', // Duplicate ID across shots!
              name: 'Duplicate Text Layer',
              content: 'Hello',
            }),
          ],
        },
      ],
    };

    const result = validateProject(corruptProject);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected validation success');
    expect(result.project).toBeDefined();

    const repaired = result.project;
    // 1. Duplicate layer ID was repaired
    const shot1LayerId = repaired.shots[0].layers[0].id;
    const shot2LayerId = repaired.shots[1].layers[0].id;
    expect(shot1LayerId).not.toBe(shot2LayerId);

    // 2. Dangling asset was stubbed
    expect(repaired.assets['missing-asset-id']).toBeDefined();
    expect(repaired.assets['missing-asset-id'].name).toBe('Hero Image');

    // 3. Dangling maskLayerId was cleared
    expect(repaired.shots[0].layers[0].maskLayerId).toBeUndefined();

    // 4. Dangling groupId was cleared
    expect(repaired.shots[0].layers[0].groupId).toBeUndefined();

    // 5. Circular parentGroupId in group-2 was severed
    const g2 = repaired.shots[0].groups?.find((g: { id: string; parentGroupId?: string }) => g.id === 'group-2');
    expect(g2?.parentGroupId).toBeUndefined();
  });
});



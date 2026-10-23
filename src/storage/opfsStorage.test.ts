// src/storage/opfsStorage.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isOpfsSupported,
  getOpfsMediaDirectory,
  saveMediaToOPFS,
  loadMediaBlobFromOPFS,
  loadMediaDataUrlFromOPFS,
  deleteMediaFromOPFS,
  pruneOPFSAssets,
} from './opfsStorage';

describe('Origin Private File System (OPFS) Media Engine', () => {
  let storageFiles: Record<string, Uint8Array | string | Blob> = {};

  const mockWritableStream = {
    write: vi.fn(async (_chunk: unknown) => {
      // simulate stream write
      return Promise.resolve();
    }),
    close: vi.fn(async () => Promise.resolve()),
    abort: vi.fn(async () => Promise.resolve()),
  };

  const mockFileHandle = (name: string) => ({
    createWritable: vi.fn(async () => mockWritableStream),
    getFile: vi.fn(async () => {
      const data = storageFiles[name];
      if (data === undefined) throw new Error('File not found');
      return new File([data as BlobPart], name);
    }),
  });

  const mockMediaDir = {
    getFileHandle: vi.fn(async (name: string, options?: { create?: boolean }) => {
      if (!storageFiles[name] && !options?.create) {
        throw new Error('File not found');
      }
      if (options?.create && !storageFiles[name]) {
        storageFiles[name] = new Uint8Array();
      }
      return mockFileHandle(name);
    }),
    removeEntry: vi.fn(async (name: string) => {
      delete storageFiles[name];
    }),
    keys: async function* () {
      for (const key of Object.keys(storageFiles)) {
        yield key;
      }
    },
  };

  const mockRootDir = {
    getDirectoryHandle: vi.fn(async (dirName: string) => {
      if (dirName === 'raylight_media') return mockMediaDir;
      throw new Error('Not found');
    }),
  };

  const originalStorage = globalThis.navigator?.storage;

  beforeEach(() => {
    storageFiles = {};
    vi.clearAllMocks();

    Object.defineProperty(globalThis.navigator, 'storage', {
      value: {
        getDirectory: vi.fn(async () => mockRootDir),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalStorage !== undefined) {
      Object.defineProperty(globalThis.navigator, 'storage', {
        value: originalStorage,
        configurable: true,
        writable: true,
      });
    } else {
      delete (globalThis.navigator as unknown as { storage?: unknown }).storage;
    }
  });

  it('1. isOpfsSupported() accurately identifies OPFS browser availability', () => {
    expect(isOpfsSupported()).toBe(true);

    // When getDirectory is missing
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: {},
      configurable: true,
      writable: true,
    });
    expect(isOpfsSupported()).toBe(false);
  });

  it('2. getOpfsMediaDirectory() retrieves the raylight_media directory handle', async () => {
    const dir = await getOpfsMediaDirectory();
    expect(dir).not.toBeNull();
    expect(mockRootDir.getDirectoryHandle).toHaveBeenCalledWith('raylight_media', { create: true });
  });

  it('3. saveMediaToOPFS() writes data via FileSystemWritableFileStream and closes stream', async () => {
    const assetId = 'video-large-4k-001';
    const blob = new Blob(['sample-video-binary-data'], { type: 'video/mp4' });

    const success = await saveMediaToOPFS(assetId, blob);
    expect(success).toBe(true);
    expect(mockMediaDir.getFileHandle).toHaveBeenCalledWith(assetId, { create: true });
    expect(mockWritableStream.write).toHaveBeenCalledWith(blob);
    expect(mockWritableStream.close).toHaveBeenCalled();
  });

  it('4. loadMediaBlobFromOPFS() retrieves the stored file from disk', async () => {
    const assetId = 'audio-track-001';
    storageFiles[assetId] = 'audio-bytes';

    const blob = await loadMediaBlobFromOPFS(assetId);
    expect(blob).not.toBeNull();
    expect(blob?.size).toBeGreaterThan(0);
  });

  it('5. deleteMediaFromOPFS() removes the asset from the directory', async () => {
    const assetId = 'clip-to-delete';
    storageFiles[assetId] = 'temporary-bytes';

    const deleted = await deleteMediaFromOPFS(assetId);
    expect(deleted).toBe(true);
    expect(mockMediaDir.removeEntry).toHaveBeenCalledWith(assetId);
    expect(storageFiles[assetId]).toBeUndefined();
  });

  it('6. pruneOPFSAssets() cleans up entries not present in the active project', async () => {
    storageFiles['active-1'] = 'data';
    storageFiles['stale-2'] = 'data';
    storageFiles['stale-3'] = 'data';

    const activeSet = new Set(['active-1']);
    await pruneOPFSAssets(activeSet);

    expect(mockMediaDir.removeEntry).toHaveBeenCalledWith('stale-2');
    expect(mockMediaDir.removeEntry).toHaveBeenCalledWith('stale-3');
    expect(mockMediaDir.removeEntry).not.toHaveBeenCalledWith('active-1');
  });

  it('7. saveMediaToOPFS() aborts the writable stream if writing fails', async () => {
    mockWritableStream.write.mockRejectedValueOnce(new Error('Disk full error'));

    const success = await saveMediaToOPFS('failing-asset', 'binary-data');
    expect(success).toBe(false);
    expect(mockWritableStream.abort).toHaveBeenCalled();
  });

  it('8. loadMediaDataUrlFromOPFS() restores specified mimeType on recovered data URL', async () => {
    storageFiles['video-restore-mime'] = new Uint8Array([1, 2, 3]);

    const dataUrl = await loadMediaDataUrlFromOPFS('video-restore-mime', 'video/mp4');
    expect(dataUrl).not.toBeNull();
    expect(dataUrl).toContain('data:video/mp4;base64,');
  });
});

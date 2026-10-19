// src/storage/opfsStorage.ts
/**
 * Origin Private File System (OPFS) Storage Engine
 *
 * Provides high-performance, quota-resilient disk streaming for large video,
 * audio, and heavy media assets via FileSystemWritableFileStream.
 * Private to origin with direct-to-disk persistence, bypassing IndexedDB size constraints.
 */

const OPFS_DIR = 'raylight_media';

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  );
}

export async function getOpfsMediaDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsSupported()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(OPFS_DIR, { create: true });
  } catch (err) {
    console.warn('[Raylight OPFS] Failed to access OPFS media directory:', err);
    return null;
  }
}

/**
 * Streams media bytes directly to disk in OPFS using FileSystemWritableFileStream.
 */
export async function saveMediaToOPFS(
  assetId: string,
  data: Blob | ArrayBuffer | string
): Promise<boolean> {
  const dir = await getOpfsMediaDirectory();
  if (!dir) return false;

  try {
    const fileHandle = await dir.getFileHandle(assetId, { create: true });
    const writable = await fileHandle.createWritable();

    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        const response = await fetch(data);
        const blob = await response.blob();
        await writable.write(blob);
      } else {
        await writable.write(data);
      }
    } else {
      await writable.write(data);
    }

    await writable.close();
    return true;
  } catch (err) {
    console.warn(`[Raylight OPFS] Error streaming media asset ${assetId} to disk:`, err);
    return false;
  }
}

/**
 * Loads a media asset file from OPFS as a Blob.
 */
export async function loadMediaBlobFromOPFS(assetId: string): Promise<Blob | null> {
  const dir = await getOpfsMediaDirectory();
  if (!dir) return null;

  try {
    const fileHandle = await dir.getFileHandle(assetId);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Loads a media asset file from OPFS converted to a dataUrl string for immediate playback.
 */
export async function loadMediaDataUrlFromOPFS(assetId: string): Promise<string | null> {
  const blob = await loadMediaBlobFromOPFS(assetId);
  if (!blob) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Deletes a media asset file from OPFS disk.
 */
export async function deleteMediaFromOPFS(assetId: string): Promise<boolean> {
  const dir = await getOpfsMediaDirectory();
  if (!dir) return false;

  try {
    await dir.removeEntry(assetId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prunes OPFS files that are no longer referenced in the current asset ID set.
 */
export async function pruneOPFSAssets(activeAssetIds: Set<string>): Promise<void> {
  const dir = await getOpfsMediaDirectory();
  if (!dir) return;

  try {
    // Iterate over all directory entries and remove unreferenced assets
    // Using values() or entries() if supported
    const dirAny = dir as unknown as {
      values?: () => AsyncIterable<FileSystemHandle>;
      keys?: () => AsyncIterable<string>;
    };

    if (typeof dirAny.keys === 'function') {
      for await (const name of dirAny.keys()) {
        if (!activeAssetIds.has(name)) {
          try {
            await dir.removeEntry(name);
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Raylight OPFS] Error pruning unreferenced OPFS assets:', err);
  }
}

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

  let writable: FileSystemWritableFileStream | null = null;
  try {
    let payload: Blob | ArrayBuffer | string;
    if (typeof data === 'string' && data.startsWith('data:')) {
      const response = await fetch(data);
      if (!response.ok) {
        throw new Error(`Failed to read data URL (${response.status} ${response.statusText})`);
      }
      payload = await response.blob();
    } else {
      payload = data;
    }

    const fileHandle = await dir.getFileHandle(assetId, { create: true });
    writable = await fileHandle.createWritable();
    await writable.write(payload);
    await writable.close();
    writable = null;
    return true;
  } catch (err) {
    if (writable) {
      try {
        await (writable as FileSystemWritableFileStream).abort();
      } catch {
        // ignore abort error
      }
    }
    console.warn(`[Raylight OPFS] Error streaming media asset ${assetId} to disk:`, err);
    return false;
  }
}

/**
 * Loads a media asset file from OPFS as a Blob, restoring the saved mimeType if specified.
 */
export async function loadMediaBlobFromOPFS(
  assetId: string,
  mimeType?: string
): Promise<Blob | null> {
  const dir = await getOpfsMediaDirectory();
  if (!dir) return null;

  try {
    const fileHandle = await dir.getFileHandle(assetId);
    const file = await fileHandle.getFile();
    if (mimeType && file.type !== mimeType) {
      return file.slice(0, file.size, mimeType);
    }
    return file;
  } catch {
    return null;
  }
}

/**
 * Loads a media asset file from OPFS converted to a dataUrl string for immediate playback,
 * restoring the saved AssetRecord.mimeType before encoding as a data URL.
 */
export async function loadMediaDataUrlFromOPFS(
  assetId: string,
  mimeType?: string
): Promise<string | null> {
  const blob = await loadMediaBlobFromOPFS(assetId, mimeType);
  if (!blob) return null;

  try {
    const effectiveMime = mimeType || blob.type || 'application/octet-stream';
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as unknown as { Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } } })
          .Buffer?.from(bytes).toString('base64') || '';
    return `data:${effectiveMime};base64,${base64}`;
  } catch {
    return null;
  }
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

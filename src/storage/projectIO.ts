// src/storage/projectIO.ts
import { useState, useEffect } from 'react';
import type { Project, AssetRecord } from '../model/types';
import { validateProject, type ValidationResult } from '../model/schema';
import { DEFAULT_PROJECT, createDefaultShot, CURRENT_SCHEMA_VERSION } from '../model/defaults';
import { generateId } from '../model/id';
import {
    saveMediaToOPFS,
    loadMediaBlobFromOPFS,
    loadMediaDataUrlFromOPFS,
    deleteMediaFromOPFS,
    pruneOPFSAssets,
    isOpfsSupported,
} from './opfsStorage';

const AUTO_SAVE_KEY = 'raylight_studio_project_v1';
const LEGACY_DEFAULT_CANVAS_BACKGROUND = '#111114';

const DB_NAME = 'raylight_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_ASSETS = 'assets';

function openIndexedDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        try {
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                    db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_ASSETS)) {
                    db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                console.warn('[Raylight Storage] IndexedDB open error, falling back to localStorage');
                resolve(null);
            };
        } catch (e) {
            console.warn('[Raylight Storage] IndexedDB exception:', e);
            resolve(null);
        }
    });
}

/**
 * Saves project to IndexedDB asynchronously with full asset blobs,
 * serializing saves to prevent overlapping writes/pruning races.
 */
let saveQueue: Promise<boolean> = Promise.resolve(true);
const opfsSavedDataUrls = new WeakMap<AssetRecord, string>();
const indexedDbSavedDataUrls = new WeakMap<AssetRecord, string>();

export function stripAssetDataUrls(assets: Record<string, AssetRecord> = {}): Record<string, AssetRecord> {
  const lightweight: Record<string, AssetRecord> = {};
  for (const [id, asset] of Object.entries(assets)) {
    if (!asset) continue;
    const { dataUrl: _drop, ...meta } = asset;
    lightweight[id] = { ...meta, dataUrl: '' } as AssetRecord;
  }
  return lightweight;
}

export function saveProjectToIndexedDB(project: Project): Promise<boolean> {
    const execute = async (): Promise<boolean> => {
        const db = await openIndexedDb();
        if (!db) return false;

        const lightweightAssets = stripAssetDataUrls(project.assets);
        const currentAssetIds = new Set(Object.keys(project.assets || {}));

        // Media absent from the in-memory document is NOT evidence of deletion.
        // Never delete a blob simply because a metadata-only asset has an empty dataUrl.
        await Promise.allSettled(
            Object.entries(project.assets || {}).map(async ([id, asset]) => {
                if (!asset) return;
                if (asset.dataUrl && opfsSavedDataUrls.get(asset) !== asset.dataUrl) {
                    try {
                        // OPFS is a supplementary copy; IDB stores the full asset in the
                        // same transaction as the project metadata below.
                        const written = await saveMediaToOPFS(id, asset.dataUrl);
                        if (written) opfsSavedDataUrls.set(asset, asset.dataUrl);
                        if (!written && isOpfsSupported()) {
                            console.warn(`[Raylight Storage] OPFS backup failed for ${id}; IndexedDB remains authoritative`);
                        }
                    } catch (err) {
                        console.warn(`[Raylight Storage] OPFS backup failed for ${id}; IndexedDB remains authoritative:`, err);
                    }
                }
            })
        );

        // 3. Persist to IndexedDB
        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readwrite');
                const projectStore = tx.objectStore(STORE_PROJECTS);
                const assetStore = tx.objectStore(STORE_ASSETS);

                // Prune assets from assetStore that are no longer part of this project
                const getAllKeysReq = assetStore.getAllKeys();
                getAllKeysReq.onsuccess = () => {
                    const keys = (getAllKeysReq.result as string[]) || [];
                    for (const key of keys) {
                        if (!currentAssetIds.has(key)) {
                            assetStore.delete(key);
                        }
                    }
                };

                const assetsWritten: AssetRecord[] = [];
                for (const asset of Object.values(project.assets || {})) {
                    if (asset) {
                        if (asset.dataUrl && indexedDbSavedDataUrls.get(asset) !== asset.dataUrl) {
                            assetStore.put(asset);
                            assetsWritten.push(asset);
                        }
                    }
                }

                const record = {
                    id: 'current_project',
                    project: {
                        ...project,
                        assets: lightweightAssets,
                        updatedAt: new Date().toISOString(),
                    },
                };

                projectStore.put(record);

                tx.oncomplete = () => {
                    for (const asset of assetsWritten) {
                        indexedDbSavedDataUrls.set(asset, asset.dataUrl);
                    }
                    db.close();
                    resolve(true);
                };
                tx.onabort = () => { db.close(); resolve(false); };
                tx.onerror = () => {
                    console.warn('[Raylight Storage] IndexedDB transaction failed');
                    db.close();
                    resolve(false);
                };
            } catch (err) {
                console.warn('[Raylight Storage] executeSaveProject error:', err);
                resolve(false);
            }
        });
    };

    const next = saveQueue.then(execute, execute).catch((error: unknown) => {
        console.error('[Raylight Storage] Project save failed:', error);
        return false;
    });
    saveQueue = next;
    return next;
}

/**
 * Loads project and reconstitutes assets from IndexedDB (with OPFS fallback)
 */
export async function loadProjectFromIndexedDB(): Promise<Project | null> {
    const db = await openIndexedDb();
    if (!db) return null;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readonly');
            const projectStore = tx.objectStore(STORE_PROJECTS);
            const assetStore = tx.objectStore(STORE_ASSETS);

            const getReq = projectStore.get('current_project');
            getReq.onsuccess = () => {
                const result = getReq.result;
                if (!result || !result.project) {
                    resolve(null);
                    return;
                }

                const baseProject = result.project as Project;
                const neededIds = Object.keys(baseProject.assets || {});
                if (neededIds.length === 0) {
                    const validated = validateProject(baseProject);
                    resolve(validated.success ? validated.data : null);
                    return;
                }

                // Fetch only the assets that belong to this project
                const assetMap: Record<string, AssetRecord> = {};
                let pending = neededIds.length;
                let settled = false;

                const finish = () => {
                    if (settled) return;
                    settled = true;
                    const validated = validateProject({
                        ...baseProject,
                        assets: {
                            ...baseProject.assets,
                            ...assetMap,
                        },
                    });
                    resolve(validated.success ? validated.data : null);
                };

                for (const id of neededIds) {
                    const req = assetStore.get(id);
                    req.onsuccess = async () => {
                        try {
                            if (req.result) {
                                assetMap[id] = req.result as AssetRecord;
                            } else {
                                const diskDataUrl = await loadMediaDataUrlFromOPFS(
                                    id,
                                    baseProject.assets[id]?.mimeType
                                );
                                if (diskDataUrl) {
                                    assetMap[id] = {
                                        ...baseProject.assets[id],
                                        dataUrl: diskDataUrl,
                                    };
                                }
                            }
                        } finally {
                            pending--;
                            if (pending === 0) finish();
                        }
                    };
                    req.onerror = async () => {
                        try {
                            const diskDataUrl = await loadMediaDataUrlFromOPFS(
                                id,
                                baseProject.assets[id]?.mimeType
                            );
                            if (diskDataUrl) {
                                assetMap[id] = {
                                    ...baseProject.assets[id],
                                    dataUrl: diskDataUrl,
                                };
                            }
                        } finally {
                            pending--;
                            if (pending === 0) finish();
                        }
                    };
                }
            };
            getReq.onerror = () => resolve(null);
        } catch (err) {
            console.warn('[Raylight Storage] loadProjectFromIndexedDB error:', err);
            resolve(null);
        }
    });
}

export type StoragePersistenceStatus = 'saved' | 'saving' | 'warning' | 'error';

export interface StorageStatusState {
    status: StoragePersistenceStatus;
    message: string;
    lastSavedAt?: Date;
}

type StatusListener = (state: StorageStatusState) => void;
const statusListeners = new Set<StatusListener>();
let currentStorageState: StorageStatusState = {
    status: 'saved',
    message: 'All changes saved locally',
    lastSavedAt: new Date(),
};

export function getStorageStatus(): StorageStatusState {
    return currentStorageState;
}

export function subscribeStorageStatus(listener: StatusListener): () => void {
    statusListeners.add(listener);
    listener(currentStorageState);
    return () => statusListeners.delete(listener);
}

function updateStorageStatus(status: StoragePersistenceStatus, message: string) {
    currentStorageState = {
        status,
        message,
        lastSavedAt: status === 'saved' || status === 'warning' ? new Date() : currentStorageState.lastSavedAt,
    };
    statusListeners.forEach((fn) => fn(currentStorageState));
}

export function useStorageStatus(): StorageStatusState {
    const [state, setState] = useState<StorageStatusState>(getStorageStatus);
    useEffect(() => subscribeStorageStatus(setState), []);
    return state;
}

// Save project recipe to browser storage (LocalStorage + IndexedDB dual write)
export function saveProjectToBrowser(project: Project): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    updateStorageStatus('saving', 'Saving changes...');

    let localStorageFailed = false;
    // 1. Synchronous LocalStorage save with payload truncation guard
    try {
        const payload = JSON.stringify({
            ...project,
            updatedAt: new Date().toISOString(),
        });
        localStorage.setItem(AUTO_SAVE_KEY, payload);
    } catch {
        localStorageFailed = true;
        // If localStorage throws QuotaExceededError, fallback to saving without heavy asset base64s
        try {
            const fallbackPayload = JSON.stringify({
                ...project,
                assets: stripAssetDataUrls(project.assets),
                updatedAt: new Date().toISOString(),
            });
            localStorage.setItem(AUTO_SAVE_KEY, fallbackPayload);
        } catch (fallbackErr) {
            console.warn('[Raylight Storage] LocalStorage fallback also exceeded quota, relying on IndexedDB:', fallbackErr);
        }
    }

    // 2. Dual-write to IndexedDB for unlimited asset quota (asynchronous)
    void saveProjectToIndexedDB(project).then((saved) => {
        if (saved) {
            if (localStorageFailed) {
                updateStorageStatus('warning', 'Media saved to IndexedDB (localStorage quota exceeded)');
            } else {
                updateStorageStatus('saved', 'All changes saved locally');
            }
        } else {
            if (window.indexedDB) {
                console.error('[Raylight Storage] IndexedDB project save failed. Local backup may not contain media.');
                updateStorageStatus('error', 'IndexedDB save failed; media may not persist');
            } else if (!localStorageFailed) {
                updateStorageStatus('saved', 'Saved to localStorage');
            } else {
                updateStorageStatus('error', 'Storage quota exceeded');
            }
        }
    }).catch((err) => {
        updateStorageStatus('error', `Save error: ${err instanceof Error ? err.message : 'Unknown'}`);
    });
}

// Load auto-saved project from browser local storage (synchronous initial load)
export function loadProjectFromBrowser(): Project | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(AUTO_SAVE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const result = validateProject(parsed);
        if (result.success) {
            const project = result.data;

            // Normalize project structure before migration checks to ensure
            // required arrays exist and have safe defaults
            const normalizedProject = normalizeProjectStructure(project);

            // Migrate older blank projects that still contain the previous default
            // background. Do not overwrite the background of projects with layers.
            const isUntouchedBlankProject =
                normalizedProject.name === 'Untitled project' &&
                normalizedProject.aspectRatio === '16:9' &&
                normalizedProject.fps === 60 &&
                Object.keys(normalizedProject.assets ?? {}).length === 0 &&
                (normalizedProject.audio?.clips?.length ?? 0) === 0 &&
                normalizedProject.shots.length === 1 &&
                normalizedProject.shots[0].layers.length === 0 &&
                (normalizedProject.shots[0].cameraBlocks?.length ?? 0) === 0 &&
                (normalizedProject.shots[0].lightBlocks?.length ?? 0) === 0 &&
                (normalizedProject.shots[0].effectBlocks?.length ?? 0) === 0 &&
                normalizedProject.background.kind === 'solid' &&
                normalizedProject.background.color.toUpperCase() ===
                LEGACY_DEFAULT_CANVAS_BACKGROUND;

            if (isUntouchedBlankProject) {
                return DEFAULT_PROJECT;
            }

            // Ensure the project has all required structural properties
            // that the app's components assume exist
            return ensureProjectStructure(normalizedProject);
        }
    } catch (err) {
        console.error('Failed to load project from browser storage:', err);
    }
    return null;
}

/**
 * Lightweight structure normalization to ensure required arrays exist
 * before migration checks. Does not fill in full defaults - that's done
 * by ensureProjectStructure after migration checks.
 */
function normalizeProjectStructure(project: Project): Project {
    try {
        const shots = Array.isArray(project.shots) && project.shots.length > 0
            ? project.shots
            : [createDefaultShot({ id: 'shot-1', name: 'Shot 1', isPlaceholder: true, startMs: 0, durationMs: 4000, lane: 0, layers: [] })];

        return {
            ...project,
            shots,
            assets: project.assets && typeof project.assets === 'object' ? project.assets : {},
            audio: project.audio || { clips: [], muted: false, masterVolume: 1.0 },
            background: project.background || { kind: 'solid', color: '#0c0e17' },
        };
    } catch {
        return DEFAULT_PROJECT;
    }
}

/**
 * Ensures a validated project has all structural properties that the app assumes exist.
 * This is a safety net for projects that pass Zod validation but are missing
 * nested properties that components directly access.
 */
function ensureProjectStructure(project: Project): Project {
    try {
        // Ensure shots array exists and has at least one shot
        const shots = Array.isArray(project.shots) && project.shots.length > 0
            ? project.shots
            : [createDefaultShot({ id: 'shot-1', name: 'Shot 1', isPlaceholder: true, startMs: 0, durationMs: 4000, lane: 0, layers: [] })];

        // Ensure each shot has all required properties
        const safeShots = shots.map((shot) => {
            // Only default isPlaceholder to true for the fallback shot (no layers, no blocks)
            // If shot has user content (layers, cameraBlocks, etc.), don't force isPlaceholder=true
            const hasUserContent =
                (shot.layers?.length ?? 0) > 0 ||
                (shot.cameraBlocks?.length ?? 0) > 0 ||
                (shot.lightBlocks?.length ?? 0) > 0 ||
                (shot.effectBlocks?.length ?? 0) > 0;
            const defaultIsPlaceholder = hasUserContent ? false : true;

            return {
                ...shot,
                id: shot.id || generateId('shot'),
                name: shot.name || 'Shot',
                isPlaceholder: shot.isPlaceholder ?? defaultIsPlaceholder,
                startMs: typeof shot.startMs === 'number' ? shot.startMs : 0,
                durationMs: typeof shot.durationMs === 'number' && shot.durationMs > 0 ? shot.durationMs : 4000,
                lane: typeof shot.lane === 'number' ? shot.lane : 0,
                layers: Array.isArray(shot.layers) ? shot.layers : [],
                cameraBlocks: Array.isArray(shot.cameraBlocks) ? shot.cameraBlocks : [],
                lightBlocks: Array.isArray(shot.lightBlocks) ? shot.lightBlocks : [],
                effectBlocks: Array.isArray(shot.effectBlocks) ? shot.effectBlocks : [],
                groups: Array.isArray(shot.groups) ? shot.groups : [],
                useProjectBackground: shot.useProjectBackground ?? true,
                background: shot.background || { kind: 'solid', color: '#0c0e17' },
                transition: shot.transition || { type: 'cut', durationMs: 0, easing: { kind: 'preset', name: 'ease-out-expo' } },
            };
        });

        // Ensure assets object exists
        const assets = project.assets && typeof project.assets === 'object' ? project.assets : {};

        // Ensure audio object exists with all required fields
        const audio = project.audio
            ? {
                clips: Array.isArray(project.audio.clips) ? project.audio.clips : [],
                muted: typeof project.audio.muted === 'boolean' ? project.audio.muted : false,
                masterVolume: typeof project.audio.masterVolume === 'number' ? project.audio.masterVolume : 1.0,
            }
            : { clips: [], muted: false, masterVolume: 1.0 };

        // Ensure project background exists
        const background = project.background || { kind: 'solid', color: '#0c0e17' };

        return {
            ...project,
            id: project.id || generateId('project'),
            name: project.name || 'Untitled project',
            version: project.version || CURRENT_SCHEMA_VERSION,
            schemaVersion: project.schemaVersion || CURRENT_SCHEMA_VERSION,
            updatedAt: project.updatedAt || new Date().toISOString(),
            createdAt: project.createdAt || new Date().toISOString(),
            aspectRatio: project.aspectRatio || '16:9',
            fps: typeof project.fps === 'number' && project.fps > 0 ? project.fps : 60,
            background,
            assets: project.assets && typeof project.assets === 'object' ? project.assets : {},
            audio,
            shots: safeShots,
        };
    } catch {
        // If anything goes wrong, return a fresh default project
        return DEFAULT_PROJECT;
    }
}

// Trigger browser download of .raylight.json project recipe file
export function exportProjectToFile(project: Project): void {
    if (typeof document === 'undefined') return;
    const cleanName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${cleanName || 'raylight-project'}.raylight.json`;
    const jsonString = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

// Read and validate an uploaded .raylight.json project file
export async function importProjectFromFile(
    file: File
): Promise<ValidationResult> {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        return validateProject(parsed);
    } catch (err) {
        return {
            success: false,
            errors: [
                `Failed to parse JSON file: ${err instanceof Error ? err.message : 'Unknown error'
                }`,
            ],
        };
    }
}

export {
    isOpfsSupported,
    saveMediaToOPFS,
    loadMediaBlobFromOPFS,
    loadMediaDataUrlFromOPFS,
    deleteMediaFromOPFS,
    pruneOPFSAssets,
};

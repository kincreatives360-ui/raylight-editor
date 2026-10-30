// src/storage/projectIO.ts
import { useState, useEffect } from 'react';
import type { Project, AssetRecord } from '../model/types';
import { validateProject, type ValidationResult } from '../model/schema';
import { DEFAULT_PROJECT } from '../model/defaults';
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

export function saveProjectToIndexedDB(project: Project): Promise<boolean> {
    const execute = async (): Promise<boolean> => {
        const db = await openIndexedDb();
        if (!db) return false;

        const lightweightAssets: Record<string, AssetRecord> = {};
        const currentAssetIds = new Set(Object.keys(project.assets || {}));

        // Media absent from the in-memory document is NOT evidence of deletion.
        // Never delete a blob simply because a metadata-only asset has an empty dataUrl.
        await Promise.allSettled(
            Object.entries(project.assets || {}).map(async ([id, asset]) => {
                if (!asset) return;
                const { dataUrl: _drop, ...meta } = asset;
                lightweightAssets[id] = { ...meta, dataUrl: '' } as AssetRecord;
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
            const lightweightAssets: Record<string, AssetRecord> = {};
            for (const [id, a] of Object.entries(project.assets || {})) {
                if (a) {
                    lightweightAssets[id] = {
                        id: a.id,
                        name: a.name,
                        mimeType: a.mimeType,
                        dataUrl: '',
                        thumbUrl: a.thumbUrl,
                        width: a.width,
                        height: a.height,
                    };
                }
            }
            const fallbackPayload = JSON.stringify({
                ...project,
                assets: lightweightAssets,
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

            // Migrate older blank projects that still contain the previous default
            // background. Do not overwrite the background of projects with layers.
            const isUntouchedBlankProject =
                project.name === 'Untitled project' &&
                project.aspectRatio === '16:9' &&
                project.fps === 60 &&
                Object.keys(project.assets ?? {}).length === 0 &&
                (project.audio?.clips?.length ?? 0) === 0 &&
                project.shots.length === 1 &&
                project.shots[0].layers.length === 0 &&
                (project.shots[0].cameraBlocks?.length ?? 0) === 0 &&
                (project.shots[0].lightBlocks?.length ?? 0) === 0 &&
                (project.shots[0].effectBlocks?.length ?? 0) === 0 &&
                project.background.kind === 'solid' &&
                project.background.color.toUpperCase() ===
                LEGACY_DEFAULT_CANVAS_BACKGROUND;

            if (isUntouchedBlankProject) {
                return DEFAULT_PROJECT;
            }

            return project;
        }
    } catch (err) {
        console.error('Failed to load project from browser storage:', err);
    }
    return null;
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

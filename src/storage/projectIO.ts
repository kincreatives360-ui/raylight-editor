// src/storage/projectIO.ts
import type { Project, AssetRecord } from '../model/types';
import { validateProject, type ValidationResult } from '../model/schema';
import { DEFAULT_PROJECT } from '../model/defaults';

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
 * preventing localStorage quota exhaustion.
 */
export async function saveProjectToIndexedDB(project: Project): Promise<boolean> {
    const db = await openIndexedDb();
    if (!db) return false;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readwrite');
            const projectStore = tx.objectStore(STORE_PROJECTS);
            const assetStore = tx.objectStore(STORE_ASSETS);

            // Separate large assets to prevent massive single-record serialization
            const lightweightAssets: Record<string, AssetRecord> = {};
            for (const [id, asset] of Object.entries(project.assets || {})) {
                if (asset) {
                    assetStore.put(asset);
                    lightweightAssets[id] = {
                        ...asset,
                        // Retain lightweight metadata; assetStore holds the full payload
                    };
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

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => {
                console.warn('[Raylight Storage] IndexedDB transaction failed');
                resolve(false);
            };
        } catch (err) {
            console.warn('[Raylight Storage] saveProjectToIndexedDB error:', err);
            resolve(false);
        }
    });
}

/**
 * Loads project and reconstitutes assets from IndexedDB
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
                // Fetch all assets from asset store to reconstitute full dataUrls
                const allAssetsReq = assetStore.getAll();
                allAssetsReq.onsuccess = () => {
                    const assetsArray = (allAssetsReq.result as AssetRecord[]) || [];
                    const assetMap: Record<string, AssetRecord> = {};
                    for (const a of assetsArray) {
                        if (a && a.id) {
                            assetMap[a.id] = a;
                        }
                    }

                    const validated = validateProject({
                        ...baseProject,
                        assets: {
                            ...baseProject.assets,
                            ...assetMap,
                        },
                    });

                    if (validated.success) {
                        resolve(validated.data);
                    } else {
                        resolve(null);
                    }
                };
                allAssetsReq.onerror = () => {
                    const validated = validateProject(baseProject);
                    resolve(validated.success ? validated.data : null);
                };
            };
            getReq.onerror = () => resolve(null);
        } catch (err) {
            console.warn('[Raylight Storage] loadProjectFromIndexedDB error:', err);
            resolve(null);
        }
    });
}

// Save project recipe to browser storage (LocalStorage + IndexedDB dual write)
export function saveProjectToBrowser(project: Project): void {
    // 1. Dual-write to IndexedDB for unlimited asset quota
    void saveProjectToIndexedDB(project);

    // 2. Synchronous LocalStorage save with payload truncation guard
    try {
        const payload = JSON.stringify({
            ...project,
            updatedAt: new Date().toISOString(),
        });
        localStorage.setItem(AUTO_SAVE_KEY, payload);
    } catch {
        // If localStorage throws QuotaExceededError, try saving without heavy asset base64s
        try {
            const lightweightAssets: Record<string, Partial<AssetRecord>> = {};
            for (const [id, a] of Object.entries(project.assets || {})) {
                if (a) {
                    lightweightAssets[id] = {
                        id: a.id,
                        name: a.name,
                        mimeType: a.mimeType,
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
}

// Load auto-saved project from browser local storage (synchronous initial load)
export function loadProjectFromBrowser(): Project | null {
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
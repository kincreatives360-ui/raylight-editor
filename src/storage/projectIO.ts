// src/storage/projectIO.ts
import type { Project } from '../model/types';
import { validateProject, type ValidationResult } from '../model/schema';

const AUTO_SAVE_KEY = 'raylight_studio_project_v1';
const DEFAULT_CANVAS_BACKGROUND = '#0A0A0C';
const LEGACY_DEFAULT_CANVAS_BACKGROUND = '#111114';

// Save project recipe to browser local storage
export function saveProjectToBrowser(project: Project): void {
    try {
        const payload = JSON.stringify({
            ...project,
            updatedAt: new Date().toISOString(),
        });
        localStorage.setItem(AUTO_SAVE_KEY, payload);
    } catch (err) {
        console.error('Failed to auto-save project to browser storage:', err);
    }
}

// Load auto-saved project from browser local storage
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
                return {
                    ...project,
                    background: {
                        kind: 'solid',
                        color: DEFAULT_CANVAS_BACKGROUND,
                    },
                };
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
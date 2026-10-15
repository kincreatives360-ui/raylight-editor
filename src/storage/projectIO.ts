// src/storage/projectIO.ts
import type { Project } from '../model/types';
import { validateProject, type ValidationResult } from '../model/schema';

const AUTO_SAVE_KEY = 'raylight_studio_project_v1';

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
            return result.data;
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
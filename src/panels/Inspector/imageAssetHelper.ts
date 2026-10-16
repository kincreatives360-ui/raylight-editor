// src/panels/Inspector/imageAssetHelper.ts
import type { Project } from '../../model/types';

export interface SaveImageAssetOptions {
    file: File;
    updateProject: (updater: (project: Project) => Project) => void;
    onSave?: (assetId: string) => void;
    assetId?: string;
}

/**
 * Reads an image file as a data URL, measures naturalWidth and naturalHeight,
 * saves the asset into the project assets record, and triggers an onSave callback.
 */
export function saveImageAsset({
    file,
    updateProject,
    onSave,
    assetId = `bg-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
}: SaveImageAssetOptions): void {
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        const image = new Image();
        const save = (width: number, height: number) => {
            updateProject((p) => ({
                ...p,
                assets: {
                    ...p.assets,
                    [assetId]: {
                        id: assetId,
                        name: file.name,
                        mimeType: file.type || 'image/png',
                        dataUrl,
                        width,
                        height,
                    },
                },
            }));
            onSave?.(assetId);
        };
        image.onload = () => save(image.naturalWidth, image.naturalHeight);
        image.onerror = () => {
            // Decoding failed: skip saving and avoid invoking onSave
        };
        image.src = dataUrl;
    };
    reader.readAsDataURL(file);
}

// src/utils/editorClipboard.ts
import type { LayerEffect } from '../model/types';

let copiedLayerEffects: LayerEffect[] | null = null;
let copiedTimelineBlock: any | null = null;

export function copyLayerEffects(effects: LayerEffect[] | undefined) {
    if (!effects || effects.length === 0) {
        copiedLayerEffects = [];
    } else {
        copiedLayerEffects = JSON.parse(JSON.stringify(effects));
    }
}

export function getCopiedLayerEffects(): LayerEffect[] | null {
    return copiedLayerEffects ? JSON.parse(JSON.stringify(copiedLayerEffects)) : null;
}

export function hasCopiedLayerEffects(): boolean {
    return copiedLayerEffects !== null;
}

export function copyTimelineBlock(block: any) {
    copiedTimelineBlock = block ? JSON.parse(JSON.stringify(block)) : null;
}

export function getCopiedTimelineBlock(): any | null {
    return copiedTimelineBlock ? JSON.parse(JSON.stringify(copiedTimelineBlock)) : null;
}


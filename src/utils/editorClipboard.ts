// src/utils/editorClipboard.ts
import type { LayerEffects, CameraBlock, LightAnimationBlock, AnimationBlock, SceneEffectAnimationBlock } from '../model/types';

export type CopiedTimelineBlock =
  | { type: 'camera'; block: CameraBlock }
  | { type: 'light'; block: LightAnimationBlock }
  | { type: 'animation'; block: AnimationBlock; layerId?: string }
  | { type: 'effect'; block: SceneEffectAnimationBlock };

let copiedLayerEffects: LayerEffects | null = null;
let copiedTimelineBlock: CopiedTimelineBlock | null = null;

export function copyLayerEffects(effects: LayerEffects | undefined) {
    copiedLayerEffects = effects ? structuredClone(effects) : null;
}

export function getCopiedLayerEffects(): LayerEffects | null {
    return copiedLayerEffects ? JSON.parse(JSON.stringify(copiedLayerEffects)) : null;
}

export function hasCopiedLayerEffects(): boolean {
    return copiedLayerEffects !== null;
}

export function copyTimelineBlock(block: CopiedTimelineBlock | null) {
    copiedTimelineBlock = block ? JSON.parse(JSON.stringify(block)) : null;
}

export function getCopiedTimelineBlock(): CopiedTimelineBlock | null {
    return copiedTimelineBlock ? JSON.parse(JSON.stringify(copiedTimelineBlock)) : null;
}

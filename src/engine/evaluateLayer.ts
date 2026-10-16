// src/engine/evaluateLayer.ts
import type { Layer, Vec3, Size2D } from '../model/types';
import { evaluateEasing } from './easing';

export interface EvaluatedLayer {
    id: string;
    name: string;
    kind: Layer['kind'];
    order: number;
    visible: boolean;
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    size: Size2D;
    opacity: number;
    cornerRadius: number;
    extraLayerBlur: number;
    maskSweepProgress: number;
    shimmerProgress: number;
    layer: Layer;
}

export function evaluateLayerAtTime(
    layer: Layer,
    shotLocalTimeMs: number
): EvaluatedLayer {
    const withinWindow =
        !layer.hidden &&
        shotLocalTimeMs >= layer.inMs &&
        shotLocalTimeMs <= layer.outMs;

    const position: Vec3 = { ...layer.position };
    const rotation: Vec3 = { ...layer.rotation };
    const scale: Vec3 = { ...layer.scale };
    const size: Size2D =
        layer.kind === 'text'
            ? { width: layer.maxWidth, height: layer.font.size * 2.5 }
            : { ...layer.size };

    let opacity = layer.opacity;
    let cornerRadius = layer.kind !== 'text' ? layer.cornerRadius : 0;
    let extraLayerBlur = 0;
    let maskSweepProgress = 1;
    let shimmerProgress = 0;

    // 1. Evaluate Entrance Transition (In)
    const ent = layer.entrance;
    if (ent.type !== 'none' && ent.durationMs > 0) {
        const entStart = layer.inMs + (ent.delayMs || 0);
        const rawP = (shotLocalTimeMs - entStart) / ent.durationMs;
        if (rawP < 1) {
            const p = evaluateEasing(Math.max(0, Math.min(1, rawP)), ent.easing);
            const inv = 1 - p;
            const dist = ent.distance ?? 0.18;

            if (ent.type === 'fade') opacity *= p;
            else if (ent.type === 'slide-up') {
                opacity *= p;
                position.y += dist * inv;
            } else if (ent.type === 'slide-down') {
                opacity *= p;
                position.y -= dist * inv;
            } else if (ent.type === 'slide-left') {
                opacity *= p;
                position.x += dist * inv;
            } else if (ent.type === 'slide-right') {
                opacity *= p;
                position.x -= dist * inv;
            } else if (ent.type === 'float-out') {
                opacity *= p;
                position.z -= dist * inv;
            } else if (ent.type === 'scale-out') {
                opacity *= p;
                scale.x *= 0.7 + 0.3 * p;
                scale.y *= 0.7 + 0.3 * p;
            } else if (ent.type === 'mask-sweep') {
                maskSweepProgress = Math.min(maskSweepProgress, p);
            }
        }
    }

    // 2. Evaluate Exit Transition (Out)
    const ext = layer.exit;
    if (ext.type !== 'none' && ext.durationMs > 0) {
        const extEnd = layer.outMs - (ext.delayMs || 0);
        const extStart = extEnd - ext.durationMs;
        if (shotLocalTimeMs > extStart) {
            const rawP = (shotLocalTimeMs - extStart) / ext.durationMs;
            const p = evaluateEasing(Math.max(0, Math.min(1, rawP)), ext.easing);
            const dist = ext.distance ?? 0.16;

            if (ext.type === 'fade') opacity *= 1 - p;
            else if (ext.type === 'slide-up') {
                opacity *= 1 - p;
                position.y -= dist * p;
            } else if (ext.type === 'slide-down') {
                opacity *= 1 - p;
                position.y += dist * p;
            } else if (ext.type === 'slide-left') {
                opacity *= 1 - p;
                position.x -= dist * p;
            } else if (ext.type === 'slide-right') {
                opacity *= 1 - p;
                position.x += dist * p;
            } else if (ext.type === 'float-out') {
                opacity *= 1 - p;
                position.z += dist * p;
            } else if (ext.type === 'scale-out') {
                opacity *= 1 - p;
                scale.x *= 1 - 0.3 * p;
                scale.y *= 1 - 0.3 * p;
            } else if (ext.type === 'mask-sweep') {
                maskSweepProgress = Math.min(maskSweepProgress, 1 - p);
            }
        }
    }

    // 3. Evaluate Relative Animation Blocks (During)
    for (const blk of layer.blocks) {
        if (shotLocalTimeMs < blk.startMs) continue;
        const rawP =
            blk.durationMs > 0
                ? Math.max(0, Math.min(1, (shotLocalTimeMs - blk.startMs) / blk.durationMs))
                : 1;
        const eased = evaluateEasing(rawP, blk.easing);

        if (
            (blk.property === 'position' || blk.property === 'followPath') &&
            typeof blk.amount === 'object'
        ) {
            position.x += blk.amount.x * eased;
            position.y += blk.amount.y * eased;
            position.z += blk.amount.z * eased;
        } else if (
            (blk.property === 'rotation' || blk.property === 'tilt') &&
            typeof blk.amount === 'object'
        ) {
            rotation.x += blk.amount.x * eased;
            rotation.y += blk.amount.y * eased;
            rotation.z += blk.amount.z * eased;
        } else if (blk.property === 'scale') {
            if (typeof blk.amount === 'number') {
                scale.x += blk.amount * eased;
                scale.y += blk.amount * eased;
            } else {
                scale.x += blk.amount.x * eased;
                scale.y += blk.amount.y * eased;
            }
        } else if (blk.property === 'size' && typeof blk.amount === 'object') {
            size.width = Math.max(0.02, size.width + blk.amount.x * eased);
            size.height = Math.max(0.02, size.height + blk.amount.y * eased);
        } else if (blk.property === 'opacity' && typeof blk.amount === 'number') {
            opacity = Math.max(0, Math.min(1, opacity + blk.amount * eased));
        } else if (
            blk.property === 'cornerRadius' &&
            typeof blk.amount === 'number'
        ) {
            cornerRadius = Math.max(0, Math.min(0.5, cornerRadius + blk.amount * eased));
        } else if (blk.property === 'layerBlur' && typeof blk.amount === 'number') {
            extraLayerBlur = Math.max(0, extraLayerBlur + blk.amount * eased);
        } else if (blk.property === 'maskSweep' && typeof blk.amount === 'number') {
            maskSweepProgress = Math.max(0, Math.min(1, eased * blk.amount));
        } else if (blk.property === 'shimmer') {
            shimmerProgress = rawP < 1 ? eased : 0;
        }
    }

    return {
        id: layer.id,
        name: layer.name,
        kind: layer.kind,
        order: layer.order,
        visible: withinWindow && opacity > 0.001,
        position,
        rotation,
        scale,
        size,
        opacity: Math.max(0, Math.min(1, opacity)),
        cornerRadius,
        extraLayerBlur,
        maskSweepProgress,
        shimmerProgress,
        layer,
    };
}
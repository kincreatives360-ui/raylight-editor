// src/engine/evaluateLayer.ts
import type { Layer, Vec3, Transitionish } from '../model/types';
import { evaluateEasing } from './easing';

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export interface EvaluatedLayer {
    id: string;
    name: string;
    kind: Layer['kind'];
    layer: Layer;
    visible: boolean;
    position: Vec3;
    rotation: Vec3; // In radians
    scale: Vec3;
    size: { width: number; height: number };
    opacity: number;
    maskSweepProgress: number; // 0 to 1 (1 = fully revealed)
    shimmerProgress: number;   // 0 to 1 (light sweep across surface)
    pathRevealProgress: number; // 0 to 1 (1 = fully revealed)
    counterValue?: number;     // evaluated counter number
    glowBoost: number;         // extra glow added by animation blocks
    activeBlockIds: string[];
    phase: 'before-in' | 'entering' | 'steady' | 'exiting' | 'after-out';
}

// Helper to apply an Entrance or Exit transition offset
function applyTransitionOffset(
    transition: Transitionish,
    progress: number, // 0 = completely hidden/off-place, 1 = resting at base state
    pos: Vec3,
    scale: Vec3,
    opacity: number,
    maskSweep: number
): { opacity: number; maskSweep: number } {
    const inv = 1 - progress; // How far away from resting state (1 at start of entrance, 0 at end)
    let nextOpacity = opacity;
    let nextMask = maskSweep;

    switch (transition.type) {
        case 'none':
            break;
        case 'fade':
            nextOpacity *= progress;
            break;
        case 'slide':
        case 'slide-up':
            pos.y += transition.distance * inv;
            nextOpacity *= progress;
            break;
        case 'slide-down':
            pos.y -= transition.distance * inv;
            nextOpacity *= progress;
            break;
        case 'slide-left':
            pos.x += transition.distance * inv;
            nextOpacity *= progress;
            break;
        case 'slide-right':
            pos.x -= transition.distance * inv;
            nextOpacity *= progress;
            break;
        case 'float-out':
            pos.z -= transition.distance * 2 * inv;
            pos.y += transition.distance * 0.5 * inv;
            nextOpacity *= progress;
            break;
        case 'scale-out':
            scale.x *= 0.65 + 0.35 * progress;
            scale.y *= 0.65 + 0.35 * progress;
            nextOpacity *= progress;
            break;
        case 'mask-sweep':
            nextMask = Math.min(nextMask, progress);
            break;
    }

    return { opacity: nextOpacity, maskSweep: nextMask };
}

// Pure Function: Layer + shotTimeMs -> Exact EvaluatedLayer State
export function evaluateLayerAtTime(
    layer: Layer,
    shotTimeMs: number
): EvaluatedLayer {
    const baseSize =
        layer.kind === 'text'
            ? { width: layer.maxWidth, height: layer.font.size * 2 }
            : { ...layer.size };

    // Check if shotTimeMs is outside the layer's [inMs, outMs] timeline bar
    if (layer.hidden || shotTimeMs < layer.inMs || shotTimeMs > layer.outMs) {
        return {
            id: layer.id,
            name: layer.name,
            kind: layer.kind,
            layer,
            visible: false,
            position: { ...layer.position },
            rotation: { ...layer.rotation },
            scale: { ...layer.scale },
            size: baseSize,
            opacity: 0,
            maskSweepProgress: 1,
            shimmerProgress: 0,
            pathRevealProgress: 1,
            counterValue: undefined,
            glowBoost: 0,
            activeBlockIds: [],
            phase: shotTimeMs < layer.inMs ? 'before-in' : 'after-out',
        };
    }

    // Start from the layer's Base Recipe numbers
    const position: Vec3 = { ...layer.position };
    const rotation: Vec3 = { ...layer.rotation };
    const scale: Vec3 = { ...layer.scale };
    const size = { ...baseSize };
    let opacity = layer.opacity;
    let maskSweepProgress = 1;
    let shimmerProgress = 0;
    let pathRevealProgress = 1;
    let counterValue: number | undefined = undefined;
    let glowBoost = 0;
    let phase: EvaluatedLayer['phase'] = 'steady';

    // 1. Evaluate Entrance Transition(s) - stackable
    const allEntrances =
        layer.entrances && layer.entrances.length > 0
            ? layer.entrances
            : layer.entrance && layer.entrance.type !== 'none'
                ? [layer.entrance]
                : [];

    for (const ent of allEntrances) {
        if (ent.type === 'none' || ent.durationMs <= 0) continue;
        const entStart = layer.inMs + (ent.delayMs || 0);
        const entEnd = entStart + ent.durationMs;

        if (shotTimeMs < entStart) {
            phase = 'entering';
            const res = applyTransitionOffset(
                ent,
                0,
                position,
                scale,
                opacity,
                maskSweepProgress
            );
            opacity = res.opacity;
            maskSweepProgress = res.maskSweep;
        } else if (shotTimeMs <= entEnd) {
            phase = 'entering';
            const raw = (shotTimeMs - entStart) / ent.durationMs;
            const eased = evaluateEasing(raw, ent.easing);
            const res = applyTransitionOffset(
                ent,
                eased,
                position,
                scale,
                opacity,
                maskSweepProgress
            );
            opacity = res.opacity;
            maskSweepProgress = res.maskSweep;
        }
    }

    // 2. Evaluate Stacked Relative ("Amount") Animation Blocks
    const activeBlockIds: string[] = [];
    const sortedBlocks = [...layer.blocks].sort((a, b) => a.startMs - b.startMs);

    for (const block of sortedBlocks) {
        if (shotTimeMs < block.startMs) continue;

        const blockEnd = block.startMs + block.durationMs;
        const isCurrentlyInside =
            shotTimeMs >= block.startMs && shotTimeMs <= blockEnd;
        if (isCurrentlyInside) {
            activeBlockIds.push(block.id);
        }

        const rawProgress =
            block.durationMs > 0
                ? clamp((shotTimeMs - block.startMs) / block.durationMs, 0, 1)
                : 1;
        const eased = evaluateEasing(rawProgress, block.easing);

        switch (block.property) {
            case 'position': {
                if (typeof block.amount === 'object') {
                    position.x += block.amount.x * eased;
                    position.y += block.amount.y * eased;
                    position.z += block.amount.z * eased;
                }
                break;
            }
            case 'followPath': {
                // Curved trajectory rather than plain linear addition
                if (typeof block.amount === 'object') {
                    const dx = block.amount.x;
                    const dy = block.amount.y;
                    const dz = block.amount.z;

                    // Base travel
                    const baseX = dx * eased;
                    const baseY = dy * eased;
                    const baseZ = dz * eased;

                    // Curvature: smooth arc offset perpendicular to direction
                    const arc = Math.sin(Math.PI * eased);
                    const perpX = -dy * 0.45 * arc;
                    const perpY = dx * 0.45 * arc;
                    const perpZ = Math.sin(Math.PI * 2 * eased) * 0.1 * arc;

                    position.x += baseX + perpX;
                    position.y += baseY + perpY;
                    position.z += baseZ + perpZ;
                } else if (typeof block.amount === 'number') {
                    const arc = Math.sin(Math.PI * eased);
                    position.x += block.amount * eased;
                    position.y += block.amount * 0.35 * arc;
                }
                break;
            }
            case 'rotation':
            case 'tilt': {
                if (typeof block.amount === 'object') {
                    rotation.x += block.amount.x * eased;
                    rotation.y += block.amount.y * eased;
                    rotation.z += block.amount.z * eased;
                }
                break;
            }
            case 'scale': {
                if (typeof block.amount === 'number') {
                    scale.x += block.amount * eased;
                    scale.y += block.amount * eased;
                } else {
                    scale.x += block.amount.x * eased;
                    scale.y += block.amount.y * eased;
                    scale.z += block.amount.z * eased;
                }
                break;
            }
            case 'size': {
                if (typeof block.amount === 'object') {
                    size.width = Math.max(0.01, size.width + block.amount.x * eased);
                    size.height = Math.max(0.01, size.height + block.amount.y * eased);
                }
                break;
            }
            case 'opacity': {
                if (typeof block.amount === 'number') {
                    opacity = clamp(opacity + block.amount * eased, 0, 1);
                }
                break;
            }
            case 'maskSweep': {
                maskSweepProgress = clamp(eased, 0, 1);
                break;
            }
            case 'shimmer': {
                // Shimmer only sweeps while the playhead is inside the block
                if (isCurrentlyInside) {
                    shimmerProgress = eased;
                }
                break;
            }
            case 'counter': {
                const delta = typeof block.amount === 'number' ? block.amount : block.amount.x;
                counterValue = (counterValue ?? 0) + delta * eased;
                break;
            }
            case 'pathReveal': {
                pathRevealProgress = clamp(eased, 0, 1);
                break;
            }
            case 'glow': {
                const delta = typeof block.amount === 'number' ? block.amount : block.amount.x;
                glowBoost += delta * eased;
                break;
            }
        }
    }

    // 3. Evaluate Exit Transition(s) - stackable
    const allExits =
        layer.exits && layer.exits.length > 0
            ? layer.exits
            : layer.exit && layer.exit.type !== 'none'
                ? [layer.exit]
                : [];

    for (const ext of allExits) {
        if (ext.type === 'none' || ext.durationMs <= 0) continue;
        const extStart = Math.max(layer.inMs, layer.outMs - ext.durationMs);
        if (shotTimeMs >= extStart) {
            phase = 'exiting';
            const rawExit = (shotTimeMs - extStart) / ext.durationMs;
            const easedExit = evaluateEasing(rawExit, ext.easing);
            const remaining = 1 - easedExit; // Goes from 1 down to 0
            const res = applyTransitionOffset(
                ext,
                remaining,
                position,
                scale,
                opacity,
                maskSweepProgress
            );
            opacity = res.opacity;
            maskSweepProgress = res.maskSweep;
        }
    }

    return {
        id: layer.id,
        name: layer.name,
        kind: layer.kind,
        layer,
        visible: opacity > 0.001,
        position: {
            x: Number(position.x.toFixed(5)),
            y: Number(position.y.toFixed(5)),
            z: Number(position.z.toFixed(5)),
        },
        rotation: {
            x: Number(rotation.x.toFixed(5)),
            y: Number(rotation.y.toFixed(5)),
            z: Number(rotation.z.toFixed(5)),
        },
        scale: {
            x: Number(scale.x.toFixed(4)),
            y: Number(scale.y.toFixed(4)),
            z: Number(scale.z.toFixed(4)),
        },
        size: {
            width: Number(size.width.toFixed(4)),
            height: Number(size.height.toFixed(4)),
        },
        opacity: Number(clamp(opacity, 0, 1).toFixed(4)),
        maskSweepProgress: Number(clamp(maskSweepProgress, 0, 1).toFixed(4)),
        shimmerProgress: Number(clamp(shimmerProgress, 0, 1).toFixed(4)),
        pathRevealProgress: Number(clamp(pathRevealProgress, 0, 1).toFixed(4)),
        counterValue: counterValue !== undefined ? Number(counterValue.toFixed(2)) : undefined,
        glowBoost: Number(glowBoost.toFixed(3)),
        activeBlockIds,
        phase,
    };
}
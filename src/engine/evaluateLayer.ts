// src/engine/evaluateLayer.ts
import type { Layer, Vec3, Size2D, AnimationBlockSettings, Transitionish } from '../model/types';
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
    shimmerSettings?: AnimationBlockSettings;
    pathRevealProgress: number;
    glowIntensityOffset: number;
    glowRadiusOffset: number;
    textContentOverride?: string;
    layer: Layer;
}

const SCRAMBLE_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#@%&*';

/** Keep whitespace attached to the preceding word/line and never split a Unicode code point. */
export function revealText(
    content: string,
    progress: number,
    unit: Transitionish['stagger'] = 'letter',
    scramble = false
): string {
    const clamped = Math.max(0, Math.min(1, progress));
    const effectiveUnit = !unit || unit === 'none' ? 'letter' : unit;
    const parts = effectiveUnit === 'word' ? content.match(/\S+\s*|\s+/g) ?? []
        : effectiveUnit === 'line' ? content.match(/[^\n]*\n|[^\n]+$/g) ?? [] : Array.from(content);
    const revealedCount = Math.floor(clamped * parts.length);

    if (!scramble || clamped <= 0) {
        return parts.slice(0, revealedCount).join('');
    }
    if (clamped >= 1) {
        return content;
    }

    const frontierEnd = Math.min(parts.length, Math.max(revealedCount + 1, Math.ceil(clamped * parts.length) + 2));
    const stepSeed = Math.floor(clamped * 24);
    const resolved = parts.slice(0, revealedCount).join('');
    let scrambledTail = '';
    for (let i = revealedCount; i < frontierEnd; i++) {
        const part = parts[i];
        scrambledTail += Array.from(part)
            .map((ch, j) => (/\s/.test(ch) ? ch : SCRAMBLE_GLYPHS[((i + j) * 17 + stepSeed * 31) % SCRAMBLE_GLYPHS.length]))
            .join('');
    }
    return resolved + scrambledTail;
}

function evaluateSplineOffset(amount: Vec3 | number, u: number): Vec3 {
    const ax = typeof amount === 'number' ? amount : amount.x;
    const ay = typeof amount === 'number' ? 0 : amount.y;
    const az = typeof amount === 'number' ? 0 : amount.z;

    // Cubic Bezier Spline Arc from (0,0,0) to (ax, ay, az)
    const p1x = 0.2 * ax - 0.5 * ay;
    const p1y = 0.8 * ay + 0.5 * ax;
    const p1z = 0.3 * az;

    const p2x = 0.8 * ax + 0.5 * ay;
    const p2y = 0.2 * ay - 0.5 * ax;
    const p2z = 0.7 * az;

    const inv = 1 - u;
    const b1 = 3 * inv * inv * u;
    const b2 = 3 * inv * u * u;
    const b3 = u * u * u;

    return {
        x: b1 * p1x + b2 * p2x + b3 * ax,
        y: b1 * p1y + b2 * p2y + b3 * ay,
        z: b1 * p1z + b2 * p2z + b3 * az,
    };
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
            ? { width: layer.maxWidth, height: layer.font.size * Math.max(2.5, (layer.content.split('\n').length - 1) * (layer.font.lineHeight ?? 1.22) + 1.5) }
            : { ...layer.size };

    let opacity = layer.opacity;
    let cornerRadius = layer.kind !== 'text' ? layer.cornerRadius : 0;
    let extraLayerBlur = 0;
    let maskSweepProgress = 1;
    let shimmerProgress = 0;
    let shimmerSettings: AnimationBlockSettings | undefined;
    let pathRevealProgress = 1;
    let glowIntensityOffset = 0;
    let glowRadiusOffset = 0;
    let textContentOverride: string | undefined = undefined;

    // 1. Evaluate Entrance Transition (In) — supports stacked entrances via layer.entrances
    const entranceList =
        layer.entrances && layer.entrances.length > 0
            ? layer.entrances
            : layer.entrance
                ? [layer.entrance]
                : [];

    for (const ent of entranceList) {
        if (ent && ent.enabled !== false && ent.type !== 'none' && ent.durationMs > 0) {
            const entStart = layer.inMs + (ent.delayMs || 0);
            const rawP = (shotLocalTimeMs - entStart) / ent.durationMs;
            if (rawP < 1) {
                const p = evaluateEasing(Math.max(0, Math.min(1, rawP)), ent.easing);
                const inv = 1 - p;
                const dist = ent.distance ?? 0.18;

                if (layer.kind === 'text' && (ent.type === 'typewriter' || ent.type === 'scramble' || (ent.stagger && ent.stagger !== 'none'))) {
                    textContentOverride = revealText(
                        textContentOverride ?? layer.content,
                        p,
                        ent.stagger,
                        ent.type === 'scramble'
                    );
                }
                if (ent.type === 'blur' || ent.type === 'focus' || ent.type === 'rack-focus') {
                    const blur = Math.max(0, ent.blur ?? 40);
                    const unfocused = Math.max(0, Math.min(1, inv));
                    extraLayerBlur += blur * (ent.type === 'focus' ? unfocused * unfocused : ent.type === 'rack-focus' ? Math.sqrt(unfocused) : unfocused);
                    if (ent.fade !== false) opacity *= p;
                    if (ent.type === 'focus') { scale.x *= 1 + .06 * inv; scale.y *= 1 + .06 * inv; }
                    if (ent.type === 'rack-focus') position.z -= dist * inv;
                } else if (ent.type === 'fade') opacity *= p;
                else if (ent.type === 'slide-up') {
                    if (ent.fade !== false) opacity *= p;
                    position.y += dist * inv;
                } else if (ent.type === 'slide-down') {
                    if (ent.fade !== false) opacity *= p;
                    position.y -= dist * inv;
                } else if (ent.type === 'slide-left') {
                    if (ent.fade !== false) opacity *= p;
                    position.x += dist * inv;
                } else if (ent.type === 'slide-right') {
                    if (ent.fade !== false) opacity *= p;
                    position.x -= dist * inv;
                } else if (ent.type === 'float-out') {
                    if (ent.fade !== false) opacity *= p;
                    position.z -= dist * inv;
                } else if (ent.type === 'scale-out') {
                    if (ent.fade !== false) opacity *= p;
                    scale.x *= 0.7 + 0.3 * p;
                    scale.y *= 0.7 + 0.3 * p;
                } else if (ent.type === 'pop') {
                    if (ent.fade !== false) opacity *= Math.min(1, p * 1.4);
                    const popFactor = 0.25 + 0.75 * p + Math.sin(p * Math.PI) * 0.14 * inv;
                    scale.x *= popFactor;
                    scale.y *= popFactor;
                } else if (ent.type === 'spin') {
                    if (ent.fade !== false) opacity *= p;
                    rotation.z -= Math.PI * inv;
                    scale.x *= 0.65 + 0.35 * p;
                    scale.y *= 0.65 + 0.35 * p;
                } else if (ent.type === 'flip-x') {
                    if (ent.fade !== false) opacity *= p;
                    rotation.x += (Math.PI / 2) * inv;
                } else if (ent.type === 'flip-y') {
                    if (ent.fade !== false) opacity *= p;
                    rotation.y += (Math.PI / 2) * inv;
                } else if (ent.type === 'swing') {
                    if (ent.fade !== false) opacity *= p;
                    rotation.z += Math.sin(inv * Math.PI * 2.5) * 0.35 * inv;
                } else if (ent.type === 'mask-sweep' || ent.type === 'wipe') {
                    maskSweepProgress = Math.min(maskSweepProgress, p);
                } else if (ent.type === 'scramble') {
                    if (ent.fade !== false) opacity *= Math.min(1, 0.25 + 0.75 * p);
                }
            }
        }
    }

    // 2. Evaluate Exit Transition (Out) — supports stacked exits via layer.exits
    const exitList =
        layer.exits && layer.exits.length > 0
            ? layer.exits
            : layer.exit
                ? [layer.exit]
                : [];

    for (const ext of exitList) {
        if (ext && ext.enabled !== false && ext.type !== 'none' && ext.durationMs > 0) {
            const extEnd = layer.outMs - (ext.delayMs || 0);
            const extStart = extEnd - ext.durationMs;
            if (shotLocalTimeMs > extStart) {
                const rawP = (shotLocalTimeMs - extStart) / ext.durationMs;
                const p = evaluateEasing(Math.max(0, Math.min(1, rawP)), ext.easing);
                const dist = ext.distance ?? 0.16;

                if (layer.kind === 'text' && (ext.type === 'typewriter' || ext.type === 'scramble' || (ext.stagger && ext.stagger !== 'none'))) {
                    textContentOverride = revealText(
                        textContentOverride ?? layer.content,
                        1 - p,
                        ext.stagger,
                        ext.type === 'scramble'
                    );
                }
                if (ext.type === 'blur' || ext.type === 'focus' || ext.type === 'rack-focus') {
                    const blur = Math.max(0, ext.blur ?? 40);
                    const unfocused = Math.max(0, Math.min(1, p));
                    extraLayerBlur += blur * (ext.type === 'focus' ? unfocused * unfocused : ext.type === 'rack-focus' ? Math.sqrt(unfocused) : unfocused);
                    if (ext.fade !== false) opacity *= 1 - p;
                    if (ext.type === 'focus') { scale.x *= 1 + .06 * p; scale.y *= 1 + .06 * p; }
                    if (ext.type === 'rack-focus') position.z += dist * p;
                } else if (ext.type === 'fade') opacity *= 1 - p;
                else if (ext.type === 'slide-up') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    position.y -= dist * p;
                } else if (ext.type === 'slide-down') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    position.y += dist * p;
                } else if (ext.type === 'slide-left') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    position.x -= dist * p;
                } else if (ext.type === 'slide-right') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    position.x += dist * p;
                } else if (ext.type === 'float-out') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    position.z += dist * p;
                } else if (ext.type === 'scale-out') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    scale.x *= 1 - 0.3 * p;
                    scale.y *= 1 - 0.3 * p;
                } else if (ext.type === 'pop') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    const popFactor = 1 - 0.75 * p;
                    scale.x *= popFactor;
                    scale.y *= popFactor;
                } else if (ext.type === 'spin') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    rotation.z += Math.PI * p;
                    scale.x *= 1 - 0.35 * p;
                    scale.y *= 1 - 0.35 * p;
                } else if (ext.type === 'flip-x') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    rotation.x -= (Math.PI / 2) * p;
                } else if (ext.type === 'flip-y') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    rotation.y -= (Math.PI / 2) * p;
                } else if (ext.type === 'swing') {
                    if (ext.fade !== false) opacity *= 1 - p;
                    rotation.z -= Math.sin(p * Math.PI * 2.5) * 0.35 * p;
                } else if (ext.type === 'mask-sweep' || ext.type === 'wipe') {
                    maskSweepProgress = Math.min(maskSweepProgress, 1 - p);
                } else if (ext.type === 'scramble') {
                    if (ext.fade !== false) opacity *= 1 - p;
                }
            }
        }
    }

    // 3. Evaluate Relative Animation Blocks (During)
    for (const blk of layer.blocks || []) {
        if (blk.enabled === false || shotLocalTimeMs < blk.startMs) continue;
        const rawP =
            blk.durationMs > 0
                ? Math.max(0, Math.min(1, (shotLocalTimeMs - blk.startMs) / blk.durationMs))
                : 1;
        const eased = evaluateEasing(rawP, blk.easing);

        if (blk.property === 'morph') {
            const targets = blk.settings;
            for (const axis of ['x', 'y', 'z'] as const) {
                if (targets?.targetPosition) position[axis] += (targets.targetPosition[axis] - position[axis]) * eased;
                if (targets?.targetScale) scale[axis] += (targets.targetScale[axis] - scale[axis]) * eased;
            }
            if (targets?.targetSize) {
                size.width += (targets.targetSize.width - size.width) * eased;
                size.height += (targets.targetSize.height - size.height) * eased;
            }
        } else if (blk.property === 'wiggle') {
            if (rawP < 1) {
                // Amount is a normalized stage distance, matching the Inspector's pixel offset control.
                const amplitude = typeof blk.amount === 'number' ? { x: blk.amount, y: blk.amount * .65, z: 0 } : blk.amount;
                const decay = (1 - rawP) * (1 - rawP);
                position.x += Math.sin(rawP * Math.PI * 8) * decay * amplitude.x;
                position.y += Math.sin(rawP * Math.PI * 11) * decay * amplitude.y;
                position.z += Math.sin(rawP * Math.PI * 6) * decay * amplitude.z;
            }
        } else if (blk.property === 'emphasis') {
            const strength = typeof blk.amount === 'number' ? blk.amount : blk.amount.x;
            const pulse = rawP < 1 ? Math.sin(eased * Math.PI) * strength : 0;
            scale.x *= 1 + pulse; scale.y *= 1 + pulse;
        } else if (blk.property === 'changeText' && layer.kind === 'text' && blk.settings?.text !== undefined) {
            // Replace progressively: erase the current string, then type the replacement.
            textContentOverride = eased < .5 ? revealText(textContentOverride ?? layer.content, 1 - eased * 2)
                : revealText(blk.settings.text, (eased - .5) * 2);
        } else if (blk.property === 'followPath') {
            const splineOffset = evaluateSplineOffset(blk.amount, eased);
            position.x += splineOffset.x;
            position.y += splineOffset.y;
            position.z += splineOffset.z;
        } else if (
            blk.property === 'position' &&
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
            extraLayerBlur = Math.max(0, extraLayerBlur + blk.amount * 100 * eased);
        } else if (blk.property === 'maskSweep' && typeof blk.amount === 'number') {
            maskSweepProgress = Math.max(0, Math.min(1, eased * blk.amount));
        } else if (blk.property === 'shimmer') {
            shimmerProgress = rawP < 1 ? eased : 0;
            shimmerSettings = rawP < 1 ? blk.settings : undefined;
        } else if (blk.property === 'pathReveal') {
            const maxVal = typeof blk.amount === 'number' ? blk.amount : 1;
            pathRevealProgress = Math.max(0, Math.min(1, maxVal * eased));
        } else if (blk.property === 'glow') {
            if (typeof blk.amount === 'number') {
                glowIntensityOffset += blk.amount * eased;
            } else if (typeof blk.amount === 'object') {
                glowIntensityOffset += blk.amount.x * eased;
                glowRadiusOffset += blk.amount.y * eased;
            }
        } else if (blk.property === 'counter' && layer.kind === 'text') {
            const currentContent: string = textContentOverride ?? layer.content;
            const match = currentContent.match(/(-?\d[\d,]*\.?\d*)/);
            if (match) {
                const numStr = match[1].replace(/,/g, '');
                const baseNum = parseFloat(numStr);
                if (Number.isFinite(baseNum)) {
                    const delta = typeof blk.amount === 'number' ? blk.amount : (blk.amount && typeof blk.amount.x === 'number' ? blk.amount.x : 0);
                    const currentNum = baseNum + delta * eased;
                    const hasDecimals = numStr.includes('.');
                    const decimalPlaces = hasDecimals ? (numStr.split('.')[1] || '').length : 0;
                    const formattedNum = currentNum.toLocaleString('en-US', {
                        minimumFractionDigits: decimalPlaces,
                        maximumFractionDigits: decimalPlaces,
                    });
                    textContentOverride = currentContent.replace(match[1], formattedNum);
                }
            }
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
        opacity: Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 0)),
        cornerRadius,
        extraLayerBlur,
        maskSweepProgress,
        shimmerProgress,
        shimmerSettings,
        pathRevealProgress,
        glowIntensityOffset,
        glowRadiusOffset,
        textContentOverride,
        layer,
    };
}
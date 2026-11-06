// src/engine/evaluateEffects.ts
import type { Shot, Effects, EffectKey, DepthOfField, SceneEffectAnimationBlock } from '../model/types';
import { evaluateEasing } from './easing';
import { lerp } from './math';

import { DEFAULT_EFFECTS_ORDER } from '../model/enums';

export interface ActiveEffectPass {
    key: EffectKey;
    orderIndex: number;
    summary: string;
}

export interface EvaluatedEffects {
    state: Effects;
    orderedEnabledPasses: ActiveEffectPass[];
    deterministicSeed: number; // Driven by frameNumber so two exports always match
    motionVector?: { x: number; y: number };
}

/**
 * Pure helper to evaluate depth-of-field rack focus and aperture pulls across the timeline.
 * Interpolates 3D target coordinates, aperture f-number, and focus distance with configured easing.
 */
export function evaluateDepthOfFieldAtTime(
    dof: DepthOfField,
    effectBlocks: SceneEffectAnimationBlock[] | undefined,
    localTimeMs: number
): DepthOfField {
    if (!effectBlocks || effectBlocks.length === 0) {
        return dof;
    }

    const dofBlocks = effectBlocks
        .filter((b) => b.effectKey === 'depthOfField')
        .sort((a, b) => a.startMs - b.startMs);

    if (dofBlocks.length === 0) {
        return dof;
    }

    let target = { ...dof.target };
    let aperture = dof.aperture;
    let focusDistance = dof.focusDistance;

    for (const b of dofBlocks) {
        if (localTimeMs < b.startMs) continue;
        const progress =
            b.durationMs > 0
                ? Math.max(0, Math.min(1, (localTimeMs - b.startMs) / b.durationMs))
                : 1;
        const eased = evaluateEasing(progress, b.easing);
        const p = b.direction === 'reverse' ? 1 - eased : eased;

        // 1. Target Position (Rack Focus)
        if (b.property === 'target' || b.toTarget || (typeof b.amount === 'object' && b.amount !== null)) {
            const startTarget = b.fromTarget ?? target;
            const endTarget = b.toTarget ?? (typeof b.amount === 'object' && b.amount !== null ? b.amount : target);
            target = {
                x: Number(lerp(startTarget.x, endTarget.x, p).toFixed(4)),
                y: Number(lerp(startTarget.y, endTarget.y, p).toFixed(4)),
                z: Number(lerp(startTarget.z, endTarget.z, p).toFixed(4)),
            };
        }
        // 2. Aperture Pulling
        else if (b.property === 'aperture' || (b.property === undefined && Number.isFinite(b.toValue))) {
            const fromAp = Number.isFinite(b.fromValue) ? b.fromValue : aperture;
            const toAp = Number.isFinite(b.toValue) ? b.toValue : (typeof b.amount === 'number' ? b.amount : aperture);
            aperture = Number(lerp(fromAp, toAp, p).toFixed(2));
        }
        // 3. Manual Focus Distance
        else if (b.property === 'focusDistance') {
            const fromDist = Number.isFinite(b.fromValue) ? b.fromValue : focusDistance;
            const toDist = Number.isFinite(b.toValue) ? b.toValue : (typeof b.amount === 'number' ? b.amount : focusDistance);
            focusDistance = Number(lerp(fromDist, toDist, p).toFixed(4));
        }
    }

    return {
        ...dof,
        target,
        aperture,
        focusDistance,
    };
}

// Pure Function: Evaluates ordered scene effects and deterministic frame seed
export function evaluateEffectsAtTime(
    shot: Shot,
    frameNumber: number,
    localTimeMs: number = 0
): EvaluatedEffects {
    let effects = shot.effects;

    // Evaluates dynamic Depth of Field rack focus and aperture pulls if animated blocks exist
    if (effects.depthOfField && shot.effectBlocks && shot.effectBlocks.length > 0) {
        effects = {
            ...effects,
            depthOfField: evaluateDepthOfFieldAtTime(effects.depthOfField, shot.effectBlocks, localTimeMs),
        };
    }

    // Deterministic pseudo-random seed from frameNumber (never uses Math.random())
    const frame = Math.max(0, Math.floor(Number.isFinite(frameNumber) ? frameNumber : 0));
    const seedRaw = ((frame * 1664525 + 1013904223) % 4294967296 + 4294967296) % 4294967296;
    const deterministicSeed = seedRaw / 4294967296;

    const orderedEnabledPasses: ActiveEffectPass[] = [];
    const configuredOrder = Array.isArray(shot.appliedEffects)
        ? shot.appliedEffects
        : [...(shot.effectsOrder || []), ...DEFAULT_EFFECTS_ORDER];
    const effectOrder = [...new Set(configuredOrder)].filter((key): key is EffectKey =>
        DEFAULT_EFFECTS_ORDER.includes(key)
    );

    effectOrder.forEach((key, index) => {
        const item = effects[key];
        if (!item || !item.enabled) return;

        let summary = 'Active';
        switch (key) {
            case 'atmosphere':
                summary = `Fog: ${Math.round(effects.atmosphere.fog * 100)}% | Mist: ${Math.round(effects.atmosphere.mist * 100)}%`;
                break;
            case 'gradientMap':
                summary = `${effects.gradientMap.blendMode} | Blend: ${Math.round(effects.gradientMap.blend * 100)}%`;
                break;
            case 'fishEye':
                summary = `Distortion: ${Math.round(effects.fishEye.amount * 100)}%`;
                break;
            case 'lensDistortion':
                summary = `${effects.lensDistortion.mode} | Strength: ${Math.round(effects.lensDistortion.strength * 100)}%`;
                break;
            case 'bloom':
                summary = `Intensity: ${effects.bloom.intensity} | Threshold: ${effects.bloom.threshold}`;
                break;
            case 'vignette':
                summary = `Intensity: ${effects.vignette.intensity}`;
                break;
            case 'motionBlur':
                summary = `${effects.motionBlur.samples} samples @ ${effects.motionBlur.shutterAngle}°`;
                break;
            case 'chromaticAberration':
                summary = `Offset: ${effects.chromaticAberration.offset}`;
                break;
            case 'filmGrain':
                summary = `Intensity: ${effects.filmGrain.intensity} | Seed: ${deterministicSeed.toFixed(3)}`;
                break;
            case 'ghost':
                summary = `Opacity: ${effects.ghost.opacity} | Blur: ${effects.ghost.blur}`;
                break;
            case 'colorGrade':
                summary = `Exp: ${effects.colorGrade.exposure} | Con: ${effects.colorGrade.contrast} | Sat: ${effects.colorGrade.saturation}`;
                break;
            case 'edgeFade':
                summary = `T:${effects.edgeFade.top} R:${effects.edgeFade.right} B:${effects.edgeFade.bottom} L:${effects.edgeFade.left}`;
                break;
            case 'glitch':
                summary = `Intensity: ${effects.glitch.intensity} | Seed: ${deterministicSeed.toFixed(3)}`;
                break;
            case 'depthOfField': {
                const dof = effects.depthOfField ?? ({} as any);
                const focus = Number(dof.focusDistance);
                const range = Number(dof.focusRange);
                const aperture = Number(dof.aperture);
                const fl = Number(dof.focalLength);
                summary = `Focus ${ (Number.isFinite(focus) ? focus : 2.65).toFixed(2) }u | f/${ (Number.isFinite(aperture) ? aperture : 2.8).toFixed(1) } | ${ Math.round(Number.isFinite(fl) ? fl : 50) }mm | DoF ±${ (Number.isFinite(range) ? range : 0.85).toFixed(2) }`;
                break;
            }
        }

        orderedEnabledPasses.push({
            key,
            orderIndex: index + 1,
            summary,
        });
    });

    return {
        state: effects,
        orderedEnabledPasses,
        deterministicSeed: Number(deterministicSeed.toFixed(6)),
    };
}

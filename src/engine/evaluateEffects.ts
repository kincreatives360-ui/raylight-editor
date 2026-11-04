// src/engine/evaluateEffects.ts
import type { Shot, Effects, EffectKey } from '../model/types';

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

// Pure Function: Evaluates the 10-effect chain and deterministic frame seed
export function evaluateEffectsAtTime(
    shot: Shot,
    frameNumber: number
): EvaluatedEffects {
    const effects = shot.effects;

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

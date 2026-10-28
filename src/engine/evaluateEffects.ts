// src/engine/evaluateEffects.ts
import type { Shot, Effects, EffectKey } from '../model/types';

import { DEFAULT_EFFECTS_ORDER } from '../model/defaults';
import { evaluateEasing } from './easing';

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
 * Resolves the Depth-of-Field focus plane Z coordinate.
 * When auto-resolving from visible layers without an explicit selected layer,
 * prioritizes the foreground hero layer (topmost in layer order) over the background.
 */
export function resolveDepthOfFieldFocusZ(
    dofTargetZ: number | undefined,
    visibleLayers: ReadonlyArray<{ id?: string; position: { z: number } }>,
    selectedLayerId?: string
): number {
    if (selectedLayerId) {
        const matched = visibleLayers.find((l) => l.id === selectedLayerId);
        if (matched) return Number(matched.position.z.toFixed(4));
    }
    if (dofTargetZ !== undefined && Number.isFinite(dofTargetZ)) {
        return Number(dofTargetZ.toFixed(4));
    }
    if (visibleLayers.length > 0) {
        return Number(visibleLayers[visibleLayers.length - 1].position.z.toFixed(4));
    }
    return 0;
}

// Pure Function: Calculates exact Depth-of-Field blur in pixels for a layer at layerZ
export function calculateLayerDofBlurPx(
    layerZ: number,
    dof: Effects['depthOfField']
): number {
    if (!dof.enabled) return 0;

    const distanceToFocus = Math.abs(layerZ - dof.target.z);
    const halfFocusZone = dof.focusRange * 0.5;

    // Inside the sharp focus range -> 0 blur
    if (distanceToFocus <= halfFocusZone) return 0;

    const outOfFocusDist = distanceToFocus - halfFocusZone;
    // Circle of Confusion scaled by aperture, bokehScale, and focalLength
    const lensFactor = (dof.focalLength ?? 50) / 50;
    const rawBlur =
        outOfFocusDist * (2.8 * 2.8 / Math.max(0.1, dof.aperture)) * dof.bokehScale * lensFactor * 1.6;

    if (!Number.isFinite(rawBlur)) return 0;
    return Number(Math.min(40, Math.max(0, rawBlur)).toFixed(2));
}

// Pure Function: Evaluates the 10-effect chain and deterministic frame seed
export function evaluateEffectsAtTime(
    shot: Shot,
    frameNumber: number,
    shotLocalTimeMs = 0
): EvaluatedEffects {
    let effects = shot.effects;

    // Animate depth of field target.z if focusBlocks are configured (Rack Focus)
    if (shot.focusBlocks && shot.focusBlocks.length > 0 && effects.depthOfField.enabled) {
        let activeZ = effects.depthOfField.target.z;
        for (const original of shot.focusBlocks) {
            const fb = {...original, startMs: original.sourceStartMs ?? original.startMs, durationMs: original.sourceDurationMs ?? original.durationMs};
            if (shotLocalTimeMs >= fb.startMs && shotLocalTimeMs <= fb.startMs + fb.durationMs) {
                const raw = (shotLocalTimeMs - fb.startMs) / Math.max(1, fb.durationMs);
                const progress = evaluateEasing(raw, fb.easing);
                activeZ = fb.fromZ + (fb.toZ - fb.fromZ) * progress;
                break;
            } else if (shotLocalTimeMs > fb.startMs + fb.durationMs) {
                activeZ = fb.toZ;
            }
        }
        effects = {
            ...effects,
            depthOfField: {
                ...effects.depthOfField,
                target: {
                    ...effects.depthOfField.target,
                    z: Number(activeZ.toFixed(4)),
                },
            },
        };
    }

    // Deterministic pseudo-random seed from frameNumber (never uses Math.random())
    const frame = Math.max(0, Math.floor(Number.isFinite(frameNumber) ? frameNumber : 0));
    const seedRaw = ((frame * 1664525 + 1013904223) % 4294967296 + 4294967296) % 4294967296;
    const deterministicSeed = seedRaw / 4294967296;

    const orderedEnabledPasses: ActiveEffectPass[] = [];

    [...new Set([...(shot.effectsOrder || []), ...DEFAULT_EFFECTS_ORDER])].forEach((key, index) => {
        const item = effects[key];
        if (!item || !item.enabled) return;

        let summary = 'Active';
        switch (key) {
            case 'depthOfField':
                summary = `Target Z:${effects.depthOfField.target.z.toFixed(2)} | f/${effects.depthOfField.aperture} | ${effects.depthOfField.bokehShape}`;
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
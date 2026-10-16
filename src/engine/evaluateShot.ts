// src/engine/evaluateShot.ts
import type { Project, Shot, LightRig, SceneEffects } from '../model/types';
import { evaluateEasing } from './easing';
import { evaluateLayerAtTime, type EvaluatedLayer } from './evaluateLayer';
import { evaluateShotCameraAtTime, type EvaluatedCamera } from './evaluateCamera';
import {
    evaluateEffectsAtTime,
    calculateLayerDofBlurPx,
    type EvaluatedEffects,
} from './evaluateEffects';

export interface EvaluatedLayerWithEffects extends EvaluatedLayer {
    dofBlurPx: number;
    totalBlurPx: number;
}

export interface EvaluatedProjectFrame {
    globalTimeMs: number;
    frameNumber: number;
    activeShot: Shot;
    shotIndex: number;
    shotLocalTimeMs: number;
    shotProgress: number;
    camera: EvaluatedCamera;
    layers: EvaluatedLayerWithEffects[];
    effects: EvaluatedEffects;
    shotTransition: {
        isTransitioning: boolean;
        type: Shot['transition']['type'];
        progress: number;
        outgoingFrame?: EvaluatedProjectFrame;
    };
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function evaluateProjectAtTime(
    project: Project,
    globalTimeMs: number
): EvaluatedProjectFrame {
    const clampedGlobalMs = Math.max(0, globalTimeMs);
    const frameNumber = Math.floor((clampedGlobalMs / 1000) * project.fps);

    let shotIndex = project.shots.findIndex(
        (s) =>
            clampedGlobalMs >= s.startMs &&
            clampedGlobalMs <= s.startMs + s.durationMs
    );

    if (shotIndex === -1) {
        shotIndex = project.shots.length - 1;
    }

    const baseShot = project.shots[shotIndex] || project.shots[0];
    const shotLocalTimeMs = Math.max(
        0,
        Math.min(baseShot.durationMs, clampedGlobalMs - baseShot.startMs)
    );
    const shotProgress =
        baseShot.durationMs > 0 ? shotLocalTimeMs / baseShot.durationMs : 0;

    // 1. Evaluate Animated Light Blocks on the Timeline (if any)
    const evaluatedLight: LightRig = {
        ...baseShot.light,
        position: { ...baseShot.light.position },
    };
    for (const lb of baseShot.lightBlocks || []) {
        if (shotLocalTimeMs < lb.startMs) continue;
        const rawP =
            lb.durationMs > 0
                ? Math.max(0, Math.min(1, (shotLocalTimeMs - lb.startMs) / lb.durationMs))
                : 1;
        const eased = evaluateEasing(rawP, lb.easing);
        evaluatedLight.position.x = Number(
            lerp(lb.fromX, lb.toX, eased).toFixed(3)
        );
        evaluatedLight.position.y = Number(
            lerp(lb.fromY, lb.toY, eased).toFixed(3)
        );
        evaluatedLight.intensity = Number(
            lerp(lb.fromIntensity, lb.toIntensity, eased).toFixed(2)
        );
    }

    // 2. Evaluate Animated Scene Effect Blocks on the Timeline (if any)
    const evaluatedEffectsConfig: SceneEffects = JSON.parse(
        JSON.stringify(baseShot.effects)
    );
    for (const eb of baseShot.effectBlocks || []) {
        if (shotLocalTimeMs < eb.startMs) continue;
        const rawP =
            eb.durationMs > 0
                ? Math.max(0, Math.min(1, (shotLocalTimeMs - eb.startMs) / eb.durationMs))
                : 1;
        const eased = evaluateEasing(rawP, eb.easing);
        const val = lerp(eb.fromValue, eb.toValue, eased);

        if (eb.effectKey === 'depthOfField') {
            evaluatedEffectsConfig.depthOfField.enabled = true;
            evaluatedEffectsConfig.depthOfField.target.z = val;
        } else if (eb.effectKey === 'bloom') {
            evaluatedEffectsConfig.bloom.enabled = true;
            evaluatedEffectsConfig.bloom.intensity = Math.max(0, val);
        } else if (eb.effectKey === 'vignette') {
            evaluatedEffectsConfig.vignette.enabled = true;
            evaluatedEffectsConfig.vignette.intensity = Math.max(0, Math.min(1, val));
        } else if (eb.effectKey === 'filmGrain') {
            evaluatedEffectsConfig.filmGrain.enabled = true;
            evaluatedEffectsConfig.filmGrain.intensity = Math.max(0, val);
        } else if (eb.effectKey === 'chromaticAberration') {
            evaluatedEffectsConfig.chromaticAberration.enabled = true;
            evaluatedEffectsConfig.chromaticAberration.offset = Math.max(0, val);
        } else if (eb.effectKey === 'glitch') {
            evaluatedEffectsConfig.glitch.enabled = true;
            evaluatedEffectsConfig.glitch.intensity = Math.max(0, val);
        } else if (eb.effectKey === 'colorGrade') {
            evaluatedEffectsConfig.colorGrade.enabled = true;
            evaluatedEffectsConfig.colorGrade.exposure = Math.max(0.2, val);
        }
    }

    const activeShot: Shot = {
        ...baseShot,
        light: evaluatedLight,
        effects: evaluatedEffectsConfig,
    };

    // 3. Evaluate Camera Rig
    const camera = evaluateShotCameraAtTime(activeShot, shotLocalTimeMs);

    // 4. Evaluate Scene Effects Rack
    const effects = evaluateEffectsAtTime(activeShot, frameNumber, shotLocalTimeMs);

    // 5. Evaluate All Layers (Ignoring hidden groups)
    const hiddenGroupIds = new Set(
        activeShot.groups.filter((g) => g.hidden).map((g) => g.id)
    );

    const sortedLayers = [...activeShot.layers].sort((a, b) => a.order - b.order);

    const layers: EvaluatedLayerWithEffects[] = sortedLayers.map((layer) => {
        const isGroupHidden = Boolean(
            layer.groupId && hiddenGroupIds.has(layer.groupId)
        );
        const effectiveLayer = layer;

        const evalLayer = evaluateLayerAtTime(
            isGroupHidden ? { ...effectiveLayer, hidden: true } : effectiveLayer,
            shotLocalTimeMs
        );

        const dofBlurPx = calculateLayerDofBlurPx(
            evalLayer.position.z,
            activeShot.effects.depthOfField
        );
        const manualBlurPx =
            (layer.effects.layerBlur ?? 0) * 100 + evalLayer.extraLayerBlur;

        return {
            ...evalLayer,
            layer:
                layer.kind !== 'text'
                    ? { ...layer, cornerRadius: evalLayer.cornerRadius }
                    : layer,
            dofBlurPx,
            totalBlurPx: Number((dofBlurPx + manualBlurPx).toFixed(2)),
        };
    });

    // 6. Evaluate Shot-to-Shot Transition
    const trans = activeShot.transition;
    const isInTransitionWindow =
        trans.type !== 'cut' &&
        trans.durationMs > 0 &&
        shotLocalTimeMs >= activeShot.durationMs - trans.durationMs;

    const rawTransProgress = isInTransitionWindow
        ? (shotLocalTimeMs - (activeShot.durationMs - trans.durationMs)) /
        trans.durationMs
        : 0;

    return {
        globalTimeMs: clampedGlobalMs,
        frameNumber,
        activeShot,
        shotIndex,
        shotLocalTimeMs,
        shotProgress,
        camera,
        layers,
        effects,
        shotTransition: {
            isTransitioning: isInTransitionWindow,
            type: trans.type,
            progress: evaluateEasing(
                Math.max(0, Math.min(1, rawTransProgress)),
                trans.easing
            ),
        },
    };
}
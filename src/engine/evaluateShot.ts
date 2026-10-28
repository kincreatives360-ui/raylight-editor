import type { Project, Shot, SceneEffects, Group } from '../model/types';
import { createDefaultShot } from '../model/defaults';
import { evaluateEasing } from './easing';
import { evaluateLightBlocks } from './evaluateLight';
import { evaluateLayerAtTime, type EvaluatedLayer } from './evaluateLayer';
import { evaluateShotCameraAtTime, type EvaluatedCamera } from './evaluateCamera';
import {
    evaluateEffectsAtTime,
    calculateLayerDofBlurPx,
    type EvaluatedEffects,
} from './evaluateEffects';

export interface EvaluatedLayerWithEffects extends EvaluatedLayer {
    dofBlurPx: number;
    dofBokehShape?: SceneEffects['depthOfField']['bokehShape'];
    totalBlurPx: number;
    motionBlur?: { x: number; y: number; samples: number };
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

export function isLayerEffectivelyHidden(
    layer: { hidden?: boolean; groupId?: string },
    groups?: Group[] | Map<string, Group>
): boolean {
    if (layer.hidden) return true;
    if (!layer.groupId || !groups) return false;
    const groupById = groups instanceof Map ? groups : new Map(groups.map((g) => [g.id, g]));
    let currentId: string | undefined = layer.groupId;
    const visited = new Set<string>();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const group = groupById.get(currentId);
        if (!group) break;
        if (group.hidden) return true;
        currentId = group.parentGroupId;
    }
    return false;
}

export function isLayerEffectivelyLocked(
    layer: { locked?: boolean; groupId?: string },
    groups?: Group[] | Map<string, Group>
): boolean {
    if (layer.locked) return true;
    if (!layer.groupId || !groups) return false;
    const groupById = groups instanceof Map ? groups : new Map(groups.map((g) => [g.id, g]));
    let currentId: string | undefined = layer.groupId;
    const visited = new Set<string>();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const group = groupById.get(currentId);
        if (!group) break;
        if (group.locked) return true;
        currentId = group.parentGroupId;
    }
    return false;
}

export function evaluateProjectAtTime(
    project: Project,
    globalTimeMs: number
): EvaluatedProjectFrame {
    const clampedGlobalMs = Math.max(0, globalTimeMs);
    const frameNumber = Math.floor((clampedGlobalMs / 1000) * project.fps);

    const shots = project.shots || [];
    let shotIndex = -1;

    for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        const isLastShot = i === shots.length - 1;
        // Consistent half-open interval [startMs, startMs + durationMs) for non-terminal shots,
        // and closed [startMs, startMs + durationMs] for the final project endpoint.
        const containsTime = isLastShot
            ? clampedGlobalMs >= s.startMs && clampedGlobalMs <= s.startMs + s.durationMs
            : clampedGlobalMs >= s.startMs && clampedGlobalMs < s.startMs + s.durationMs;

        if (containsTime) {
            shotIndex = i;
            break;
        }
    }

    if (shotIndex === -1) {
        if (shots.length === 0) {
            shotIndex = 0;
        } else if (
            clampedGlobalMs >=
            shots[shots.length - 1].startMs + shots[shots.length - 1].durationMs
        ) {
            shotIndex = shots.length - 1;
        } else {
            let latestIdx = 0;
            for (let i = 0; i < shots.length; i++) {
                if (shots[i].startMs <= clampedGlobalMs) {
                    latestIdx = i;
                }
            }
            shotIndex = latestIdx;
        }
    }

    const baseShot = shots[shotIndex] || shots[0] || createDefaultShot({ layers: [], cameraBlocks: [] });
    const shotLocalTimeMs = Math.max(
        0,
        Math.min(baseShot.durationMs, clampedGlobalMs - baseShot.startMs)
    );
    const shotProgress =
        baseShot.durationMs > 0 ? shotLocalTimeMs / baseShot.durationMs : 0;

    // 1. Evaluate Animated Light Blocks on the Timeline (if any)
    const evaluatedLight = evaluateLightBlocks(
        baseShot.light,
        baseShot.lightBlocks,
        shotLocalTimeMs
    );

    // 2. Evaluate Animated Scene Effect Blocks on the Timeline (Zero-allocation when idle)
    let evaluatedEffectsConfig: SceneEffects = baseShot.effects;
    const effectBlocks = baseShot.effectBlocks?.map(b => ({...b, startMs:b.sourceStartMs ?? b.startMs, durationMs:b.sourceDurationMs ?? b.durationMs}));
    if (effectBlocks && effectBlocks.length > 0) {
        let hasActiveBlock = false;
        for (const eb of effectBlocks) {
            if (shotLocalTimeMs >= eb.startMs) {
                hasActiveBlock = true;
                break;
            }
        }
        if (hasActiveBlock) {
            evaluatedEffectsConfig = {
                ...baseShot.effects,
                depthOfField: {
                    ...baseShot.effects.depthOfField,
                    target: { ...baseShot.effects.depthOfField.target },
                },
                bloom: { ...baseShot.effects.bloom },
                vignette: { ...baseShot.effects.vignette },
                filmGrain: { ...baseShot.effects.filmGrain },
                chromaticAberration: { ...baseShot.effects.chromaticAberration },
                glitch: { ...baseShot.effects.glitch },
                colorGrade: { ...baseShot.effects.colorGrade },
                motionBlur: { ...baseShot.effects.motionBlur },
                ghost: { ...baseShot.effects.ghost },
                edgeFade: { ...baseShot.effects.edgeFade },
            };
            for (const eb of effectBlocks) {
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
                } else if (eb.effectKey === 'motionBlur') {
                    evaluatedEffectsConfig.motionBlur.enabled = true;
                    evaluatedEffectsConfig.motionBlur.shutterAngle = Math.max(0, val);
                } else if (eb.effectKey === 'ghost') {
                    evaluatedEffectsConfig.ghost.enabled = true;
                    evaluatedEffectsConfig.ghost.opacity = Math.max(0, Math.min(1, val));
                } else if (eb.effectKey === 'edgeFade') {
                    evaluatedEffectsConfig.edgeFade.enabled = true;
                    evaluatedEffectsConfig.edgeFade.top = Math.max(0, Math.min(1, val));
                    evaluatedEffectsConfig.edgeFade.bottom = Math.max(0, Math.min(1, val));
                }
            }
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

    // 5. Evaluate All Layers (Ignoring hidden groups and ancestor groups)
    const groupById = new Map((activeShot.groups || []).map((g) => [g.id, g]));

    const sortedLayers = [...(activeShot.layers || [])].sort((a, b) => a.order - b.order);

    const layers: EvaluatedLayerWithEffects[] = sortedLayers.map((layer) => {
        const isHidden = isLayerEffectivelyHidden(layer, groupById);
        const evalLayer = evaluateLayerAtTime(
            isHidden ? { ...layer, hidden: true } : layer,
            shotLocalTimeMs
        );

        const dofBlurPx = calculateLayerDofBlurPx(
            evalLayer.position.z,
            effects.state.depthOfField
        );
        const manualBlurPx =
            (layer.effects.layerBlur ?? 0) * 100 + evalLayer.extraLayerBlur;

        let motionBlur: { x: number; y: number; samples: number } | undefined;
        if (effects.state.motionBlur?.enabled && shotLocalTimeMs > 0) {
            const fps = project.fps && project.fps > 0 ? project.fps : 60;
            const dt = 1000 / fps;
            const prevTime = Math.max(0, shotLocalTimeMs - dt);
            const prevLayer = evaluateLayerAtTime(
                isHidden ? { ...layer, hidden: true } : layer,
                prevTime
            );
            const shutter = (effects.state.motionBlur.shutterAngle ?? 180) / 360;
            const dx = (evalLayer.position.x - prevLayer.position.x) * shutter;
            const dy = (evalLayer.position.y - prevLayer.position.y) * shutter;
            if (Math.hypot(dx, dy) > 0.0001) {
                motionBlur = {
                    x: dx,
                    y: dy,
                    samples: Math.max(2, Math.min(32, Math.round(effects.state.motionBlur.samples ?? 8))),
                };
            }
        }

        return {
            ...evalLayer,
            layer:
                layer.kind !== 'text'
                    ? { ...layer, cornerRadius: evalLayer.cornerRadius }
                    : layer,
            dofBlurPx,
            dofBokehShape: effects.state.depthOfField.bokehShape,
            totalBlurPx: Number((dofBlurPx + manualBlurPx).toFixed(2)),
            motionBlur,
        };
    });

    // 6. Evaluate Shot-to-Shot Transition
    const trans = activeShot.transition || { type: 'cut' as const, durationMs: 0, easing: { kind: 'preset' as const, name: 'linear' as const } };
    const isIncomingTransition =
        trans.type !== 'cut' &&
        trans.durationMs > 0 &&
        shotIndex > 0 &&
        shotLocalTimeMs < trans.durationMs;

    const rawTransProgress = isIncomingTransition
        ? shotLocalTimeMs / trans.durationMs
        : 1;

    let outgoingFrame: EvaluatedProjectFrame | undefined;
    if (isIncomingTransition) {
        const prevShot = project.shots[shotIndex - 1];
        if (prevShot) {
            const prevLocalTime = Math.max(
                0,
                prevShot.durationMs - (trans.durationMs - shotLocalTimeMs)
            );
            // Reuse the full evaluator so outgoing animated effects, lights and
            // hidden groups follow the same rules as the incoming shot.
            const previous = evaluateProjectAtTime({
                ...project, shots: [{...prevShot, startMs:0, transition:{...prevShot.transition,type:'cut'}}],
            }, prevLocalTime);
            outgoingFrame = {
                ...previous,
                globalTimeMs: clampedGlobalMs,
                frameNumber,
                shotIndex: shotIndex - 1,
                activeShot: { ...previous.activeShot, startMs: prevShot.startMs },
                effects: evaluateEffectsAtTime(previous.activeShot, frameNumber, prevLocalTime),
            };
        }
    }

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
            isTransitioning: isIncomingTransition,
            type: trans.type,
            progress: evaluateEasing(
                Math.max(0, Math.min(1, rawTransProgress)),
                trans.easing
            ),
            outgoingFrame,
        },
    };
}

import type { Project, Shot, SceneEffects, Group, Vec3 } from '../model/types';
import { createDefaultShot } from '../model/defaults';
import { evaluateEasing } from './easing';
import { evaluateLightBlocks } from './evaluateLight';
import { evaluateLayerAtTime, type EvaluatedLayer } from './evaluateLayer';
import { evaluateShotCameraAtTime, type EvaluatedCamera } from './evaluateCamera';
import {
    evaluateEffectsAtTime,
    calculateLayerDofBlurPx,
    resolveDepthOfFieldFocusZ,
    type EvaluatedEffects,
} from './evaluateEffects';
export { resolveDepthOfFieldFocusZ };

export interface ShotTransitionCompositeState {
    isActive: boolean;
    incomingOpacity: number;
    incomingSlideX: number;
    outgoingOpacity: number;
    outgoingSlideX: number;
    incomingLayers: EvaluatedLayerWithEffects[];
    outgoingLayers: EvaluatedLayerWithEffects[];
    outgoingShotStartMs: number;
    outgoingCamera?: EvaluatedCamera;
}

/**
 * Pure helper computing transition-modulated incoming and outgoing layer sets
 * so WebGL (ViewportCanvas) and Canvas 2D (canvasRenderer) share identical shot transition composition.
 */
export function getShotTransitionCompositeState(
    frame: EvaluatedProjectFrame
): ShotTransitionCompositeState {
    const outgoing = frame.shotTransition.outgoingFrame;
    const progress = frame.shotTransition.progress;
    const isActive = Boolean(
        frame.shotTransition.isTransitioning && outgoing && progress < 1
    );

    if (!isActive || !outgoing) {
        return {
            isActive: false,
            incomingOpacity: 1,
            incomingSlideX: 0,
            outgoingOpacity: 0,
            outgoingSlideX: 0,
            incomingLayers: frame.layers,
            outgoingLayers: [],
            outgoingShotStartMs: frame.activeShot.startMs,
        };
    }

    let outgoingOpacity = 1;
    let outgoingSlideX = 0;
    let incomingOpacity = 1;
    let incomingSlideX = 0;

    if (frame.shotTransition.type === 'crossfade') {
        outgoingOpacity = 1 - progress;
        incomingOpacity = progress;
    } else if (frame.shotTransition.type === 'push') {
        outgoingSlideX = -progress;
        incomingSlideX = 1 - progress;
    } else if (frame.shotTransition.type === 'slide') {
        outgoingSlideX = -progress * 0.25;
        incomingSlideX = 1 - progress;
    }

    const modulateLayers = (
        sourceLayers: EvaluatedLayerWithEffects[],
        opacityMult: number,
        slideX: number
    ): EvaluatedLayerWithEffects[] =>
        sourceLayers.map((l) => {
            const nextOpacity = Math.max(0, Math.min(1, Number((l.opacity * opacityMult).toFixed(4))));
            return {
                ...l,
                opacity: nextOpacity,
                visible: l.visible && nextOpacity > 0.001,
                position:
                    slideX !== 0
                        ? { ...l.position, x: l.position.x + slideX }
                        : l.position,
            };
        });

    return {
        isActive: true,
        incomingOpacity,
        incomingSlideX,
        outgoingOpacity,
        outgoingSlideX,
        incomingLayers: modulateLayers(frame.layers, incomingOpacity, incomingSlideX),
        outgoingLayers: modulateLayers(outgoing.layers, outgoingOpacity, outgoingSlideX),
        outgoingShotStartMs: outgoing.activeShot.startMs,
        outgoingCamera: outgoing.camera,
    };
}

export interface EvaluatedLayerWithEffects extends EvaluatedLayer {
    dofBlurPx: number;
    dofBokehShape?: SceneEffects['depthOfField']['bokehShape'];
    totalBlurPx: number;
    motionBlur?: {
        x: number;
        y: number;
        z?: number;
        rotZ?: number;
        scaleX?: number;
        scaleY?: number;
        samples: number;
    };
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



export function computeGroupTransform(
    groupId: string | undefined,
    groups: Group[] | Map<string, Group> | undefined,
    shotLocalTimeMs: number
): {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
    opacity: number;
} {
    if (!groupId || !groups) {
        return {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            opacity: 1,
        };
    }
    const groupById = groups instanceof Map ? groups : new Map(groups.map((g) => [g.id, g]));
    let currentId: string | undefined = groupId;
    let posX = 0, posY = 0, posZ = 0;
    let rotX = 0, rotY = 0, rotZ = 0;
    let scaleX = 1, scaleY = 1, scaleZ = 1;
    let opacity = 1;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const group = groupById.get(currentId);
        if (!group) break;

        let gPos = group.position ?? { x: 0, y: 0, z: 0 };
        let gRot = group.rotation ?? { x: 0, y: 0, z: 0 };
        let gScale = group.scale ?? { x: 1, y: 1, z: 1 };
        let gOpacity = group.opacity ?? 1;

        if (group.blocks && group.blocks.length > 0) {
            for (const b of group.blocks) {
                if (b.enabled === false) continue;
                if (shotLocalTimeMs < b.startMs || shotLocalTimeMs > b.startMs + b.durationMs) continue;
                const p = evaluateEasing((shotLocalTimeMs - b.startMs) / Math.max(1, b.durationMs), b.easing);
                const amt = b.amount;
                if (b.property === 'position' && typeof amt === 'object') {
                    gPos = { x: gPos.x + amt.x * p, y: gPos.y + amt.y * p, z: gPos.z + amt.z * p };
                } else if (b.property === 'rotation' && typeof amt === 'object') {
                    gRot = { x: gRot.x + amt.x * p, y: gRot.y + amt.y * p, z: gRot.z + amt.z * p };
                } else if (b.property === 'scale' && typeof amt === 'object') {
                    gScale = { x: gScale.x * (1 + (amt.x - 1) * p), y: gScale.y * (1 + (amt.y - 1) * p), z: gScale.z * (1 + (amt.z - 1) * p) };
                } else if (b.property === 'opacity' && typeof amt === 'number') {
                    gOpacity *= (1 - p) + amt * p;
                }
            }
        }

        posX += gPos.x;
        posY += gPos.y;
        posZ += gPos.z;
        rotX += gRot.x;
        rotY += gRot.y;
        rotZ += gRot.z;
        scaleX *= gScale.x;
        scaleY *= gScale.y;
        scaleZ *= gScale.z;
        opacity *= gOpacity;

        currentId = group.parentGroupId;
    }

    return {
        position: { x: posX, y: posY, z: posZ },
        rotation: { x: rotX, y: rotY, z: rotZ },
        scale: { x: scaleX, y: scaleY, z: scaleZ },
        opacity,
    };
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

    // Populate scene-level motionVector when motionBlur is enabled so Canvas 2D fallback matches WebGL
    const fps = project.fps && project.fps > 0 ? project.fps : 60;
    const frameDt = 1000 / fps;
    const prevShotLocalTime = Math.max(0, shotLocalTimeMs - frameDt);
    let maxLayerMotionX = 0;
    let maxLayerMotionY = 0;

    // 5. Evaluate All Layers (Ignoring hidden groups and ancestor groups)
    const groupById = new Map((activeShot.groups || []).map((g) => [g.id, g]));

    const sortedLayers = [...(activeShot.layers || [])].sort((a, b) => a.order - b.order);

    const layers: EvaluatedLayerWithEffects[] = sortedLayers.map((layer) => {
        const isHidden = isLayerEffectivelyHidden(layer, groupById);
        const rawEvalLayer = evaluateLayerAtTime(
            isHidden ? { ...layer, hidden: true } : layer,
            shotLocalTimeMs
        );
        const groupTransform = computeGroupTransform(layer.groupId, groupById, shotLocalTimeMs);
        const evalLayer = {
            ...rawEvalLayer,
            position: {
                x: Number((rawEvalLayer.position.x * groupTransform.scale.x + groupTransform.position.x).toFixed(4)),
                y: Number((rawEvalLayer.position.y * groupTransform.scale.y + groupTransform.position.y).toFixed(4)),
                z: Number((rawEvalLayer.position.z + groupTransform.position.z).toFixed(4)),
            },
            rotation: {
                x: rawEvalLayer.rotation.x + groupTransform.rotation.x,
                y: rawEvalLayer.rotation.y + groupTransform.rotation.y,
                z: rawEvalLayer.rotation.z + groupTransform.rotation.z,
            },
            scale: {
                x: rawEvalLayer.scale.x * groupTransform.scale.x,
                y: rawEvalLayer.scale.y * groupTransform.scale.y,
                z: rawEvalLayer.scale.z * groupTransform.scale.z,
            },
            opacity: rawEvalLayer.opacity * groupTransform.opacity,
        };

        const dofBlurPx = calculateLayerDofBlurPx(
            evalLayer.position.z,
            effects.state.depthOfField
        );
        const manualBlurPx =
            (layer.effects.layerBlur ?? 0) * 100 + evalLayer.extraLayerBlur;

        let motionBlur: EvaluatedLayerWithEffects['motionBlur'] | undefined;
        if (effects.state.motionBlur?.enabled && shotLocalTimeMs > 0) {
            const rawPrev = evaluateLayerAtTime(
                isHidden ? { ...layer, hidden: true } : layer,
                prevShotLocalTime
            );
            const prevGroupTransform = computeGroupTransform(layer.groupId, groupById, prevShotLocalTime);
            const prevX = rawPrev.position.x * prevGroupTransform.scale.x + prevGroupTransform.position.x;
            const prevY = rawPrev.position.y * prevGroupTransform.scale.y + prevGroupTransform.position.y;
            const prevZ = rawPrev.position.z + prevGroupTransform.position.z;
            const prevRotZ = (rawPrev.rotation.z + prevGroupTransform.rotation.z) * (Math.PI / 180);
            const curRotZ = evalLayer.rotation.z * (Math.PI / 180);
            const prevScaleX = rawPrev.scale.x * prevGroupTransform.scale.x;
            const prevScaleY = rawPrev.scale.y * prevGroupTransform.scale.y;

            const rawDx = evalLayer.position.x - prevX;
            const rawDy = evalLayer.position.y - prevY;
            const rawDz = evalLayer.position.z - prevZ;
            const rawDrotZ = curRotZ - prevRotZ;
            const rawDscaleX = (evalLayer.scale.x - prevScaleX) / Math.max(0.001, Math.abs(prevScaleX));
            const rawDscaleY = (evalLayer.scale.y - prevScaleY) / Math.max(0.001, Math.abs(prevScaleY));

            if (Math.hypot(rawDx, rawDy) > Math.hypot(maxLayerMotionX, maxLayerMotionY)) {
                maxLayerMotionX = rawDx;
                maxLayerMotionY = rawDy;
            }
            const shutter = (effects.state.motionBlur.shutterAngle ?? 180) / 360;
            const dx = rawDx * shutter;
            const dy = rawDy * shutter;
            const dz = rawDz * shutter;
            const dRotZ = rawDrotZ * shutter;
            const dScaleX = rawDscaleX * shutter;
            const dScaleY = rawDscaleY * shutter;

            const hasMotion = Math.hypot(dx, dy) > 0.0001 || Math.abs(dRotZ) > 0.0001 || Math.abs(dScaleX) > 0.0001 || Math.abs(dScaleY) > 0.0001;
            if (hasMotion) {
                motionBlur = {
                    x: dx,
                    y: dy,
                    z: dz,
                    rotZ: dRotZ,
                    scaleX: dScaleX,
                    scaleY: dScaleY,
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

    if (effects.state.motionBlur?.enabled && shotLocalTimeMs > 0) {
        const prevCamera = evaluateShotCameraAtTime(activeShot, prevShotLocalTime);
        const camDx = -(camera.target.x - prevCamera.target.x) / 1920 + (camera.zoom - prevCamera.zoom) * 0.25;
        const camDy = -(camera.target.y - prevCamera.target.y) / 1080 + (camera.rotation.x - prevCamera.rotation.x) * 0.25;
        const mvX = Math.abs(camDx) > Math.abs(maxLayerMotionX) ? camDx : maxLayerMotionX;
        const mvY = Math.abs(camDy) > Math.abs(maxLayerMotionY) ? camDy : maxLayerMotionY;
        if (Math.hypot(mvX, mvY) > 0.0001) {
            effects.motionVector = { x: Number(mvX.toFixed(6)), y: Number(mvY.toFixed(6)) };
        }
    }

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

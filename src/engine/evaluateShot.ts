import type { Project, Shot, Group, SceneEffects, Vec3 } from '../model/types';
import { createDefaultShot } from '../model/defaults';
import { evaluateEasing } from './easing';
import { evaluateLightBlocks } from './evaluateLight';
import { evaluateLayerAtTime, type EvaluatedLayer } from './evaluateLayer';
import { evaluateShotCameraAtTime, type EvaluatedCamera } from './evaluateCamera';
import {
    evaluateEffectsAtTime,
    evaluateDepthOfFieldAtTime,
    type EvaluatedEffects,
} from './evaluateEffects';
import { lerp } from './math';
import { getArtboardDimensions } from '../stage/stageUtils';

/** Deep clone SceneEffects to prevent mutation of original shot object. */
function deepCloneEffects(effects: SceneEffects): SceneEffects {
    if (typeof structuredClone === 'function') {
        return structuredClone(effects);
    }
    return JSON.parse(JSON.stringify(effects));
}

/** Effect block handler type: receives the config object and the animated value, mutates config. */
type EffectBlockHandler = (config: Shot['effects'], val: number) => void;

/** Map of effectKey to handler function. Replaces long if-else chain for extensibility. */
const EFFECT_BLOCK_HANDLERS: Record<string, EffectBlockHandler> = {
    bloom: (config, val) => { config.bloom.enabled = true; config.bloom.intensity = Math.max(0, val); },
    vignette: (config, val) => { config.vignette.enabled = true; config.vignette.intensity = Math.max(0, Math.min(1, val)); },
    filmGrain: (config, val) => { config.filmGrain.enabled = true; config.filmGrain.intensity = Math.max(0, val); },
    chromaticAberration: (config, val) => { config.chromaticAberration.enabled = true; config.chromaticAberration.offset = Math.max(0, val); },
    glitch: (config, val) => { config.glitch.enabled = true; config.glitch.intensity = Math.max(0, val); },
    colorGrade: (config, val) => { config.colorGrade.enabled = true; config.colorGrade.exposure = Math.max(0.2, val); },
    motionBlur: (config, val) => { config.motionBlur.enabled = true; config.motionBlur.shutterAngle = Math.max(0, val); },
    ghost: (config, val) => { config.ghost.enabled = true; config.ghost.opacity = Math.max(0, Math.min(1, val)); },
    edgeFade: (config, val) => { config.edgeFade.enabled = true; config.edgeFade.top = Math.max(0, Math.min(1, val)); config.edgeFade.bottom = Math.max(0, Math.min(1, val)); },
    atmosphere: (config, val) => { config.atmosphere.enabled = true; config.atmosphere.fog = Math.max(0, Math.min(1, val)); },
    gradientMap: (config, val) => { config.gradientMap.enabled = true; config.gradientMap.blend = Math.max(0, Math.min(1, val)); },
    fishEye: (config, val) => { config.fishEye.enabled = true; config.fishEye.amount = Math.max(-1, Math.min(1, val)); },
    lensDistortion: (config, val) => { config.lensDistortion.enabled = true; config.lensDistortion.strength = Math.max(-1, Math.min(1, val)); },
    depthOfField: (config) => { config.depthOfField.enabled = true; },
};

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
                if (b.enabled === false || shotLocalTimeMs < b.startMs) continue;
                const rawP = b.durationMs > 0
                    ? Math.max(0, Math.min(1, (shotLocalTimeMs - b.startMs) / b.durationMs))
                    : 1;
                const p = evaluateEasing(rawP, b.easing);
                const amt = b.amount;
                if (b.property === 'position') {
                    const px = typeof amt === 'number' ? amt : (amt?.x ?? 0);
                    const py = typeof amt === 'number' ? amt : (amt?.y ?? 0);
                    const pz = typeof amt === 'number' ? 0 : (amt?.z ?? 0);
                    gPos = { x: gPos.x + px * p, y: gPos.y + py * p, z: gPos.z + pz * p };
                } else if (b.property === 'rotation') {
                    const rx = typeof amt === 'number' ? 0 : (amt?.x ?? 0);
                    const ry = typeof amt === 'number' ? 0 : (amt?.y ?? 0);
                    const rz = typeof amt === 'number' ? amt : (amt?.z ?? 0);
                    gRot = { x: gRot.x + rx * p, y: gRot.y + ry * p, z: gRot.z + rz * p };
                } else if (b.property === 'scale') {
                    const sx = typeof amt === 'number' ? amt : (amt?.x ?? 1);
                    const sy = typeof amt === 'number' ? amt : (amt?.y ?? 1);
                    const sz = typeof amt === 'number' ? amt : (amt?.z ?? 1);
                    gScale = {
                        x: gScale.x * (1 + (sx - 1) * p),
                        y: gScale.y * (1 + (sy - 1) * p),
                        z: gScale.z * (1 + (sz - 1) * p),
                    };
                } else if (b.property === 'opacity') {
                    const targetOp = typeof amt === 'number' ? amt : 1;
                    gOpacity = Math.max(0, Math.min(1, gOpacity * ((1 - p) + targetOp * p)));
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
            // Time is before the first shot's startMs - clamp to first shot
            if (clampedGlobalMs < shots[0].startMs) {
                shotIndex = 0;
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
            // Deep clone ALL effects to prevent mutation of original shot object
            evaluatedEffectsConfig = deepCloneEffects(baseShot.effects);
            for (const eb of effectBlocks) {
                if (shotLocalTimeMs < eb.startMs) continue;
                const rawP =
                    eb.durationMs > 0
                        ? Math.max(0, Math.min(1, (shotLocalTimeMs - eb.startMs) / eb.durationMs))
                        : 1;
                const eased = evaluateEasing(rawP, eb.easing);
                const val = lerp(eb.fromValue, eb.toValue, eased);

                const handler = Object.hasOwn(EFFECT_BLOCK_HANDLERS, eb.effectKey) ? EFFECT_BLOCK_HANDLERS[eb.effectKey] : undefined;
                if (handler) {
                    handler(evaluatedEffectsConfig, val);
                }
            }

            // Dedicated depth-of-field rack focus & aperture pulling
            if (evaluatedEffectsConfig.depthOfField) {
                evaluatedEffectsConfig.depthOfField = evaluateDepthOfFieldAtTime(
                    evaluatedEffectsConfig.depthOfField,
                    effectBlocks,
                    shotLocalTimeMs
                );
            }
        }
    }

    const activeShot: Shot = {
        ...baseShot,
        light: evaluatedLight,
        effects: evaluatedEffectsConfig,
    };

    // 3. Evaluate Camera Rig
    const camera = evaluateShotCameraAtTime(activeShot, shotLocalTimeMs, frameNumber);

    // 4. Evaluate Scene Effects Rack
    const effects = evaluateEffectsAtTime(activeShot, frameNumber);

    // Populate scene-level motionVector when motionBlur is enabled so Canvas 2D fallback matches WebGL
    const fps = project.fps && project.fps > 0 ? project.fps : 60;
    const frameDt = 1000 / fps;
    const prevShotLocalTime = Math.max(0, shotLocalTimeMs - frameDt);
    let maxLayerMotionX = 0;
    let maxLayerMotionY = 0;

    // 5. Evaluate All Layers (Ignoring hidden groups and ancestor groups)
    const groupById = new Map((activeShot.groups || []).map((g) => [g.id, g]));

    const sortedLayers = [...(activeShot.layers || [])].sort((a, b) => a.order - b.order);

    // 6. Pre-evaluate all layers at prevShotLocalTime for motion blur memoization
    // This avoids re-evaluating each layer at t-frameDt for every layer with motion blur
    const prevLayersMap = new Map<string, EvaluatedLayer>();
    if (effects.state.motionBlur?.enabled && shotLocalTimeMs > 0) {
        for (const layer of sortedLayers) {
            const isHidden = isLayerEffectivelyHidden(layer, groupById);
            prevLayersMap.set(layer.id, evaluateLayerAtTime(
                isHidden ? { ...layer, hidden: true } : layer,
                prevShotLocalTime
            ));
        }
    }

    // 7. Evaluate All Layers (Ignoring hidden groups and ancestor groups)
    const layers: EvaluatedLayerWithEffects[] = sortedLayers.map((layer) => {
        const isHidden = isLayerEffectivelyHidden(layer, groupById);
        const rawEvalLayer = evaluateLayerAtTime(
            isHidden ? { ...layer, hidden: true } : layer,
            shotLocalTimeMs
        );
        const groupTransform = computeGroupTransform(layer.groupId, groupById, shotLocalTimeMs);
        const scaledX = rawEvalLayer.position.x * groupTransform.scale.x;
        const scaledY = rawEvalLayer.position.y * groupTransform.scale.y;
        let rotPosX = scaledX;
        let rotPosY = scaledY;
        if (Math.abs(groupTransform.rotation.z) > 1e-6) {
            const radZ = (groupTransform.rotation.z * Math.PI) / 180;
            const cosZ = Math.cos(radZ);
            const sinZ = Math.sin(radZ);
            rotPosX = scaledX * cosZ - scaledY * sinZ;
            rotPosY = scaledX * sinZ + scaledY * cosZ;
        }

        const evalLayer = {
            ...rawEvalLayer,
            position: {
                x: Number((rotPosX + groupTransform.position.x).toFixed(4)),
                y: Number((rotPosY + groupTransform.position.y).toFixed(4)),
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

        const manualBlurPx =
            (layer.effects.layerBlur ?? 0) * 100 + evalLayer.extraLayerBlur;

        let motionBlur: EvaluatedLayerWithEffects['motionBlur'] | undefined;
        if (effects.state.motionBlur?.enabled && shotLocalTimeMs > 0) {
            const rawPrev = prevLayersMap.get(layer.id);
            if (!rawPrev) {
                // Fallback if not memoized (shouldn't happen)
                const isHidden = isLayerEffectivelyHidden(layer, groupById);
                const rawPrevFallback = evaluateLayerAtTime(
                    isHidden ? { ...layer, hidden: true } : layer,
                    prevShotLocalTime
                );
                return {
                    ...evalLayer,
                    layer:
                        layer.kind !== 'text'
                            ? { ...layer, cornerRadius: evalLayer.cornerRadius }
                            : layer,
                    totalBlurPx: Number(manualBlurPx.toFixed(2)),
                };
            }
            const prevGroupTransform = computeGroupTransform(layer.groupId, groupById, prevShotLocalTime);
            const prevScaledX = rawPrev.position.x * prevGroupTransform.scale.x;
            const prevScaledY = rawPrev.position.y * prevGroupTransform.scale.y;
            let prevRotPosX = prevScaledX;
            let prevRotPosY = prevScaledY;
            if (Math.abs(prevGroupTransform.rotation.z) > 1e-6) {
                const pRadZ = (prevGroupTransform.rotation.z * Math.PI) / 180;
                const pCosZ = Math.cos(pRadZ);
                const pSinZ = Math.sin(pRadZ);
                prevRotPosX = prevScaledX * pCosZ - prevScaledY * pSinZ;
                prevRotPosY = prevScaledX * pSinZ + prevScaledY * pCosZ;
            }
            const prevX = prevRotPosX + prevGroupTransform.position.x;
            const prevY = prevRotPosY + prevGroupTransform.position.y;
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
            totalBlurPx: Number(manualBlurPx.toFixed(2)),
            motionBlur,
        };
    });

    if (effects.state.motionBlur?.enabled && shotLocalTimeMs > 0) {
        const prevFrameNumber = frameNumber > 0 ? frameNumber - 1 : 0;
        const prevCamera = evaluateShotCameraAtTime(activeShot, prevShotLocalTime, prevFrameNumber);
        const artboard = getArtboardDimensions(project.aspectRatio);
        const camDx = -(camera.target.x - prevCamera.target.x) / artboard.width + (camera.zoom - prevCamera.zoom) * 0.25;
        const camDy = -(camera.target.y - prevCamera.target.y) / artboard.height + (camera.rotation.x - prevCamera.rotation.x) * 0.25;
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
                effects: evaluateEffectsAtTime(previous.activeShot, frameNumber),
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

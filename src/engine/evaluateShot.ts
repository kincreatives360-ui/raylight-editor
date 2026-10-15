// src/engine/evaluateShot.ts
import type { Project, Shot, Group } from '../model/types';
import { evaluateEasing } from './easing';
import { evaluateLayerAtTime, type EvaluatedLayer } from './evaluateLayer';
import { evaluateCameraAtTime, type EvaluatedCamera } from './evaluateCamera';
import {
    evaluateEffectsAtTime,
    calculateLayerDofBlurPx,
    type EvaluatedEffects,
} from './evaluateEffects';

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

// Checks if a group or any of its parent groups are hidden
function isGroupHierarchyHidden(
    groupId: string | undefined,
    groups: Group[]
): boolean {
    let currentId = groupId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const grp = groups.find((g) => g.id === currentId);
        if (!grp) break;
        if (grp.hidden) return true;
        currentId = grp.parentGroupId;
    }
    return false;
}

export interface EvaluatedLayerWithEffects extends EvaluatedLayer {
    dofBlurPx: number;
    totalBlurPx: number;
}

export interface EvaluatedShotFrame {
    shot: Shot;
    localTimeMs: number;
    camera: EvaluatedCamera;
    effects: EvaluatedEffects;
    layers: EvaluatedLayerWithEffects[];
}

export interface EvaluatedProjectFrame {
    globalTimeMs: number;
    shotLocalTimeMs: number;
    frameNumber: number;
    activeShot: Shot;
    shotTransition: {
        type: Shot['transition']['type'];
        progress: number;
        outgoingFrame?: EvaluatedShotFrame;
    };
    camera: EvaluatedCamera;
    effects: EvaluatedEffects;
    layers: EvaluatedLayerWithEffects[];
}

/**
 * Pure evaluator for a single scene at a specific local timestamp.
 */
export function evaluateSingleShot(
    shot: Shot,
    localTimeMs: number,
    defaultCamera: Project['defaultCamera'],
    frameNumber: number
): EvaluatedShotFrame {
    const clampedLocalMs = clamp(localTimeMs, 0, shot.durationMs);
    const camera = evaluateCameraAtTime(shot, defaultCamera, clampedLocalMs);
    const effects = evaluateEffectsAtTime(shot, frameNumber, clampedLocalMs);
    const sortedLayers = [...shot.layers].sort((a, b) => a.order - b.order);

    const layers: EvaluatedLayerWithEffects[] = sortedLayers.map((layer) => {
        const groupHidden = isGroupHierarchyHidden(layer.groupId, shot.groups);
        const effectiveLayer = groupHidden ? { ...layer, hidden: true } : layer;

        const evaluated = evaluateLayerAtTime(effectiveLayer, clampedLocalMs);
        const dofBlurPx = calculateLayerDofBlurPx(
            evaluated.position.z,
            effects.state.depthOfField
        );
        const ownLayerBlurPx = (layer.effects.layerBlur || 0) * 100;

        return {
            ...evaluated,
            dofBlurPx,
            totalBlurPx: Number((dofBlurPx + ownLayerBlurPx).toFixed(2)),
        };
    });

    return {
        shot,
        localTimeMs: clampedLocalMs,
        camera,
        effects,
        layers,
    };
}

/**
 * Master Project Evaluator: returns the active scene frame and any outgoing scene frame
 * during scene-to-scene transition windows (Crossfade, Slide, Push).
 */
export function evaluateProjectAtTime(
    project: Project,
    globalTimeMs: number
): EvaluatedProjectFrame {
    const totalDurationMs = project.shots.reduce(
        (max, s) => Math.max(max, s.startMs + s.durationMs),
        1000
    );
    const clampedGlobalMs = clamp(globalTimeMs, 0, totalDurationMs);

    let activeIndex = project.shots.findIndex(
        (s, idx) =>
            clampedGlobalMs >= s.startMs &&
            (idx === project.shots.length - 1
                ? clampedGlobalMs <= s.startMs + s.durationMs
                : clampedGlobalMs < s.startMs + s.durationMs)
    );
    if (activeIndex === -1) {
        activeIndex = Math.max(0, project.shots.length - 1);
    }
    const activeShot = project.shots[activeIndex];

    const shotLocalTimeMs = clamp(
        clampedGlobalMs - activeShot.startMs,
        0,
        activeShot.durationMs
    );

    const frameNumber = Math.floor((clampedGlobalMs / 1000) * project.fps);

    let transitionProgress = 1;
    let outgoingFrame: EvaluatedShotFrame | undefined = undefined;

    if (
        activeIndex > 0 &&
        activeShot.transition.type !== 'cut' &&
        activeShot.transition.durationMs > 0 &&
        shotLocalTimeMs < activeShot.transition.durationMs
    ) {
        const raw = shotLocalTimeMs / activeShot.transition.durationMs;
        transitionProgress = evaluateEasing(raw, activeShot.transition.easing);

        const outgoingShot = project.shots[activeIndex - 1];
        if (outgoingShot) {
            // Outgoing scene local time is near its completion during the transition overlap
            const outgoingLocalTimeMs = clamp(
                outgoingShot.durationMs - (activeShot.transition.durationMs - shotLocalTimeMs),
                0,
                outgoingShot.durationMs
            );
            outgoingFrame = evaluateSingleShot(
                outgoingShot,
                outgoingLocalTimeMs,
                project.defaultCamera,
                frameNumber
            );
        }
    }

    const currentShotEvaluated = evaluateSingleShot(
        activeShot,
        shotLocalTimeMs,
        project.defaultCamera,
        frameNumber
    );

    return {
        globalTimeMs: clampedGlobalMs,
        shotLocalTimeMs,
        frameNumber,
        activeShot,
        shotTransition: {
            type: activeShot.transition.type,
            progress: Number(transitionProgress.toFixed(4)),
            outgoingFrame,
        },
        camera: currentShotEvaluated.camera,
        effects: currentShotEvaluated.effects,
        layers: currentShotEvaluated.layers,
    };
}

export function verifyDeterministicEvaluator(project: Project): {
    passed: boolean;
    testedTimestampsMs: number[];
} {
    const testedTimestampsMs = [0, 250, 1200, 2500, 4200];
    for (const t of testedTimestampsMs) {
        const firstRun = JSON.stringify(evaluateProjectAtTime(project, t));
        const secondRun = JSON.stringify(evaluateProjectAtTime(project, t));
        if (firstRun !== secondRun) {
            return { passed: false, testedTimestampsMs };
        }
    }
    return { passed: true, testedTimestampsMs };
}
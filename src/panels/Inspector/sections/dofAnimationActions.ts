import { evaluateEffectsAtTime } from '../../../engine/evaluateEffects';
import { DEFAULT_SCENE_EFFECTS } from '../../../model/defaults';
import type { FocusBlock, SceneEffectAnimationBlock, Shot } from '../../../model/types';
import { generateId } from '../../../model/id';

const DOF_ANIMATION_DURATION_MS = 800;
const DOF_ANIMATION_EASING = { kind: 'preset', name: 'ease-in-out' } as const;

function getShotLocalTime(shot: Shot, currentTimeMs: number): number {
  return Math.max(0, Math.min(shot.durationMs, currentTimeMs - shot.startMs));
}

export function createDofFocusBlock(
  shot: Shot,
  currentTimeMs: number,
  targetZ: number
): FocusBlock {
  const localTimeMs = getShotLocalTime(shot, currentTimeMs);
  const dofSettings = shot.effects?.depthOfField;
  const enabledShot = {
    ...shot,
    effects: {
      ...shot.effects,
      depthOfField: {
        ...DEFAULT_SCENE_EFFECTS.depthOfField,
        ...dofSettings,
        target: {
          ...DEFAULT_SCENE_EFFECTS.depthOfField.target,
          ...dofSettings?.target,
        },
        enabled: true,
      },
    },
  };
  const fromZ = evaluateEffectsAtTime(enabledShot, 0, localTimeMs).state.depthOfField.target.z;

  return {
    id: generateId('focus-blk'),
    label: 'Animate focus',
    startMs: localTimeMs,
    durationMs: DOF_ANIMATION_DURATION_MS,
    fromZ,
    toZ: targetZ,
    easing: DOF_ANIMATION_EASING,
  };
}

export function createDofBlurBlock(
  shot: Shot,
  currentTimeMs: number,
  currentBokehScale: number
): SceneEffectAnimationBlock {
  return {
    id: generateId('effect-blk'),
    label: 'Animate blur',
    effectKey: 'depthOfField',
    parameter: 'blur',
    startMs: getShotLocalTime(shot, currentTimeMs),
    durationMs: DOF_ANIMATION_DURATION_MS,
    fromValue: 0,
    toValue: currentBokehScale,
    easing: DOF_ANIMATION_EASING,
  };
}

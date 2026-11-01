// src/engine/index.ts
// Public API exports for the evaluation engine

export { lerp, clamp, invlerp, smoothstep, smootherstep, lerpLog, lerpAngle } from './math';
export { evaluateEasing } from './easing';
export { evaluateShotCameraAtTime, focalLengthToFov, type EvaluatedCamera } from './evaluateCamera';
export { evaluateLayerAtTime, evaluateSplineOffset, revealText, type EvaluatedLayer } from './evaluateLayer';
export { evaluateEffectsAtTime, calculateLayerDofBlurPx, resolveDepthOfFieldFocusZ, type EvaluatedEffects } from './evaluateEffects';
export { evaluateLightBlocks, cloneLightRig, type LightRig } from './evaluateLight';
export { resolveLighting, getKelvinPreviewColor, type ResolvedLighting, LIGHT_ANIMATION_PRESETS, applyLightAnimationPreset } from './lightingSystem';
export { evaluateProjectAtTime, type EvaluatedProjectFrame, getShotTransitionCompositeState } from './evaluateShot';
export * from './constants';
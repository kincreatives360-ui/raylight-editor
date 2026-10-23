import * as THREE from 'three';

// Backgrounds must blend before both opaque hardware and transparent layers.
// Custom blending keeps transition alpha without putting the backdrop in the transparent queue.
export const BACKGROUND_RENDER_STATE = {
  transparent: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
} as const;

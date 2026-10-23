import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { renderDeviceScene } from './deviceScenePass';

/** Renders a usable scene even during the composer's first demand-rendered frame. */
export function renderSceneFrame(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  composer: EffectComposer | null,
): void {
  if (!composer) {
    renderer.render(scene, camera);
    return;
  }
  renderDeviceScene(renderer, scene, camera, composer.readBuffer, () => composer.render());
}

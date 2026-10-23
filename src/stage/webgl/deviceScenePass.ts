import * as THREE from 'three';

/** One transaction owns prepass, isolated captures, final composition and cleanup. */
export function renderDeviceScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.Camera, scratch: THREE.WebGLRenderTarget, renderFinal: () => void) {
  const sources: THREE.Object3D[] = [];
  scene.traverse(object => {
    if (!object.userData.deviceOpacityFading) return;
    let parent = object.parent;
    while (parent) {
      if (!parent.visible) return;
      parent = parent.parent;
    }
    sources.push(object);
  });
  const autoClear = renderer.autoClear;
  if (!sources.length) {
    try { renderFinal(); } finally { renderer.autoClear = autoClear; }
    return;
  }
  const visibility = sources.map(source => source.visible);
  const previousTarget = renderer.getRenderTarget();
  const { autoUpdate, needsUpdate } = renderer.shadowMap;
  try {
    if (renderer.shadowMap.enabled) {
      for (const source of sources) source.visible = true;
      renderer.setRenderTarget(scratch);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previousTarget);
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
    }
    for (const source of sources) source.visible = false;
    for (const source of sources) source.userData.capture();
    renderFinal();
  } finally {
    sources.forEach((source, index) => { source.visible = visibility[index]; });
    renderer.shadowMap.autoUpdate = autoUpdate;
    renderer.shadowMap.needsUpdate = needsUpdate;
    renderer.autoClear = autoClear;
    renderer.setRenderTarget(previousTarget);
  }
}

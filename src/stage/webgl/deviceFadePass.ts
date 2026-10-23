import * as THREE from 'three';

export function renderDeviceToTarget(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  source: THREE.Group,
  target: THREE.WebGLRenderTarget
): void {
  const previousTarget = renderer.getRenderTarget();
  const clearColor = renderer.getClearColor(new THREE.Color()).clone();
  const clearAlpha = renderer.getClearAlpha();
  const autoClear = renderer.autoClear;
  const scissorTest = renderer.getScissorTest();
  const background = scene.background;
  const sourceVisible = source.visible;
  const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
  const shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
  const members = new Set<THREE.Object3D>();
  source.traverse(object => members.add(object));
  const hidden: THREE.Object3D[] = [];

  try {
    scene.traverse(object => {
      if (object.visible && !members.has(object) && (
        object instanceof THREE.Mesh || object instanceof THREE.Line ||
        object instanceof THREE.Points || object instanceof THREE.Sprite
      )) {
        hidden.push(object);
        object.visible = false;
      }
    });
    source.visible = true;
    // Isolation must never replace complete-scene shadow maps with this one device.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    scene.background = null;
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    for (const object of hidden) object.visible = true;
    source.visible = sourceVisible;
    scene.background = background;
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
    renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
  }
}

export function createDeviceFadeMaterial(target: THREE.WebGLRenderTarget): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      deviceColor: { value: target.texture },
      deviceDepth: { value: target.depthTexture },
      layerOpacity: { value: 1 },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D deviceColor;
      uniform sampler2D deviceDepth;
      uniform float layerOpacity;
      varying vec2 vUv;
      #include <common>
      void main() {
        vec4 color = texture2D(deviceColor, vUv);
        if (color.a <= 0.00001) discard;
        // Render-target RGB is already premultiplied; convert once before output-space blending.
        gl_FragColor = vec4(color.rgb / color.a, color.a * layerOpacity);
        gl_FragDepth = texture2D(deviceDepth, vUv).x;
        #include <colorspace_fragment>
        #include <premultiplied_alpha_fragment>
      }
    `,
  });
}

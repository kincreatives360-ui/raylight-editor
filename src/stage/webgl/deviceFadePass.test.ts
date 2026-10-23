import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createDeviceFadeMaterial, renderDeviceToTarget } from './deviceFadePass';

describe('isolated complete-device fade pass', () => {
  function fixture(fail = false) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#345678');
    const background = scene.background;
    const device = new THREE.Group();
    device.visible = false;
    const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
    device.add(body, screen);
    const other = new THREE.Mesh();
    const hidden = new THREE.Mesh();
    hidden.visible = false;
    const light = new THREE.DirectionalLight();
    scene.add(device, other, hidden, light);
    const previous = new THREE.WebGLRenderTarget(5, 5);
    const target = new THREE.WebGLRenderTarget(8, 8);
    let activeTarget = previous;
    let alpha = 0.7;
    const clearColor = new THREE.Color('#112233');
    const renderer = {
      autoClear: false,
      shadowMap: { autoUpdate: true, needsUpdate: true },
      getRenderTarget: () => activeTarget,
      setRenderTarget: vi.fn((next: THREE.WebGLRenderTarget) => { activeTarget = next; }),
      getClearColor: (color: THREE.Color) => color.copy(clearColor),
      getClearAlpha: () => alpha,
      setClearColor: vi.fn((color: THREE.Color | number, value: number) => { clearColor.set(color); alpha = value; }),
      getScissorTest: () => true,
      setScissorTest: vi.fn(),
      render: vi.fn(() => {
        expect(activeTarget).toBe(target);
        expect(scene.background).toBeNull();
        expect(device.visible).toBe(true);
        expect(other.visible).toBe(false);
        expect(light.visible).toBe(true);
        expect(renderer.shadowMap.autoUpdate).toBe(false);
        expect(renderer.shadowMap.needsUpdate).toBe(false);
        expect((body.material as THREE.MeshBasicMaterial).opacity).toBe(1);
        expect((screen.material as THREE.MeshBasicMaterial).opacity).toBe(1);
        if (fail) throw new Error('GPU render failed');
      }),
    };
    return { scene, device, other, hidden, background, renderer, previous, target, state: () => ({ activeTarget, alpha, clearColor }) };
  }

  it.each([false, true])('restores scene and renderer state after capture (failure=%s)', fail => {
    const f = fixture(fail);
    const run = () => renderDeviceToTarget(f.renderer as unknown as THREE.WebGLRenderer, f.scene, new THREE.PerspectiveCamera(), f.device, f.target);
    if (fail) expect(run).toThrow('GPU render failed'); else run();
    expect(f.renderer.render).toHaveBeenCalledOnce();
    expect(f.device.visible).toBe(false);
    expect(f.other.visible).toBe(true);
    expect(f.hidden.visible).toBe(false);
    expect(f.scene.background).toBe(f.background);
    expect(f.renderer.autoClear).toBe(false);
    expect(f.renderer.shadowMap).toEqual({ autoUpdate: true, needsUpdate: true });
    expect(f.renderer.setScissorTest).toHaveBeenLastCalledWith(true);
    expect(f.state().activeTarget).toBe(f.previous);
    expect(f.state().alpha).toBe(0.7);
    expect(f.state().clearColor.getHexString()).toBe('112233');
    f.target.dispose(); f.previous.dispose();
  });

  it('composites premultiplied color once and writes the captured device depth', () => {
    const target = new THREE.WebGLRenderTarget(8, 8);
    target.depthTexture = new THREE.DepthTexture(8, 8);
    const material = createDeviceFadeMaterial(target);
    expect(material.transparent).toBe(true);
    expect(material.premultipliedAlpha).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.uniforms.deviceColor.value).toBe(target.texture);
    expect(material.uniforms.deviceDepth.value).toBe(target.depthTexture);
    expect(material.fragmentShader).toContain('gl_FragDepth');
    material.dispose(); target.dispose();
  });
});

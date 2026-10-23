import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderDeviceScene } from './deviceScenePass';

describe('device scene render transaction', () => {
  it.each(['success', 'prepass', 'capture', 'final'])('restores state after %s', phase => {
    const scene = new THREE.Scene();
    const source = new THREE.Group();
    source.visible = false;
    source.userData.deviceOpacityFading = true;
    source.userData.capture = vi.fn(() => {
      expect(source.visible).toBe(false);
      expect(renderer.shadowMap.autoUpdate).toBe(false);
      if (phase === 'capture') throw Error('capture');
    });
    scene.add(source);
    const previous = new THREE.WebGLRenderTarget(1, 1);
    const scratch = new THREE.WebGLRenderTarget(1, 1);
    let target = previous;
    const renderer = {
      autoClear: true,
      shadowMap: { enabled: true, autoUpdate: true, needsUpdate: true },
      getRenderTarget: () => target,
      setRenderTarget: (next: THREE.WebGLRenderTarget) => { target = next; },
      render: vi.fn(() => {
        expect(source.visible).toBe(true);
        if (phase === 'prepass') throw Error('prepass');
      }),
    };
    const final = vi.fn(() => { renderer.autoClear = false; if (phase === 'final') throw Error('final'); });
    const run = () => renderDeviceScene(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.Camera(), scratch, final);
    if (phase === 'success') run(); else expect(run).toThrow(phase);
    expect(source.visible).toBe(false);
    expect(renderer.shadowMap).toEqual({ enabled: true, autoUpdate: true, needsUpdate: true });
    expect(target).toBe(previous);
    expect(renderer.autoClear).toBe(true);
    previous.dispose(); scratch.dispose();
  });

  it('ignores a fading device inside a hidden parent', () => {
    const scene = new THREE.Scene(), parent = new THREE.Group(), device = new THREE.Group();
    parent.visible = false;
    device.userData = { deviceOpacityFading: true, capture: vi.fn() };
    parent.add(device); scene.add(parent);
    const final = vi.fn();
    renderDeviceScene({} as THREE.WebGLRenderer, scene, new THREE.Camera(), {} as THREE.WebGLRenderTarget, final);
    expect(device.userData.capture).not.toHaveBeenCalled();
    expect(final).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { renderSceneFrame, renderSceneFrameWithFallback } from './sceneRenderLoop';

describe('scene render loop', () => {
  it('renders directly while the effect composer is not ready', () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = {};

    renderSceneFrame(renderer as never, scene as never, camera as never, null);

    expect(renderer.render).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  });

  it('renders the base scene and reports errors when post-processing fails', () => {
    const renderError = new Error('composer failed');
    const renderer = {
      setRenderTarget: vi.fn(),
      render: vi.fn(),
    };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const composer = {
      readBuffer: new THREE.WebGLRenderTarget(1, 1),
      render: vi.fn(() => {
        throw renderError;
      }),
    };
    const onCompositionError = vi.fn();
    const onFallbackError = vi.fn();

    renderSceneFrameWithFallback(
      renderer as never,
      scene,
      camera,
      composer as never,
      onCompositionError,
      onFallbackError
    );

    expect(onCompositionError).toHaveBeenCalledWith(renderError);
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(null);
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(onFallbackError).not.toHaveBeenCalled();
    composer.readBuffer.dispose();
  });

  it('reports an error if the base scene fallback also fails', () => {
    const fallbackError = new Error('renderer unavailable');
    const renderer = {
      setRenderTarget: vi.fn(),
      render: vi.fn(() => {
        throw fallbackError;
      }),
    };
    const scene = new THREE.Scene();
    const composer = {
      readBuffer: new THREE.WebGLRenderTarget(1, 1),
      render: vi.fn(() => {
        throw new Error('composer failed');
      }),
    };
    const onCompositionError = vi.fn();
    const onFallbackError = vi.fn();

    renderSceneFrameWithFallback(
      renderer as never,
      scene,
      new THREE.PerspectiveCamera(),
      composer as never,
      onCompositionError,
      onFallbackError
    );

    expect(onCompositionError).toHaveBeenCalledOnce();
    expect(onFallbackError).toHaveBeenCalledWith(fallbackError);
    composer.readBuffer.dispose();
  });
});

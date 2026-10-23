import { describe, expect, it, vi } from 'vitest';
import { renderSceneFrame } from './sceneRenderLoop';

describe('scene render loop', () => {
  it('renders directly while the effect composer is not ready', () => {
    const renderer = { render: vi.fn() };
    const scene = {};
    const camera = {};

    renderSceneFrame(renderer as never, scene as never, camera as never, null);

    expect(renderer.render).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  });
});

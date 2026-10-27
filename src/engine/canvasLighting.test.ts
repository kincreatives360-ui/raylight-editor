import { describe, expect, it, vi } from 'vitest';
import type { LightRig, SceneLight } from '../model/types';
import type { EvaluatedCamera } from './evaluateCamera';
import { renderSceneLightSources } from './canvasRenderer';

function makeCanvasContext() {
  const gradient = { addColorStop: vi.fn() };
  return {
    context: {
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      createRadialGradient: vi.fn(() => gradient),
      translate: vi.fn(), rotate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
      arc: vi.fn(), closePath: vi.fn(), clip: vi.fn(),
      globalCompositeOperation: 'source-over', fillStyle: '',
    } as unknown as CanvasRenderingContext2D,
    gradient,
  };
}

const makeSource = (id: string, type: SceneLight['type']): SceneLight => ({
  id, name: id, type, enabled: true, position: { x: 0.2, y: 0.1, z: 1 },
  target: { x: 0, y: 0, z: 0 }, intensity: 1, color: '#ffffff', angle: Math.PI / 5,
});

describe('Canvas fallback lighting', () => {
  it('renders the resolved ambient, directional, point, spot, and area source paths', () => {
    const { context, gradient } = makeCanvasContext();
    const rig: LightRig = {
      position: { x: -0.28, y: 0.36, z: 0.9 }, target: { x: 0, y: 0, z: 0 },
      intensity: 1, temperature: 6100, ambience: 0.4,
      sources: (['ambient', 'directional', 'point', 'spot', 'area'] as const).map((type, i) => makeSource(`source-${i}`, type)),
    };
    renderSceneLightSources(
      context,
      rig,
      { zoom: 1, target: { x: 0, y: 0 } } as EvaluatedCamera,
      1920,
      1080,
      '16:9'
    );
    expect(context.createLinearGradient).toHaveBeenCalledTimes(3);
    expect(context.createRadialGradient).toHaveBeenCalledTimes(3);
    expect(context.arc).toHaveBeenCalledOnce();
    expect(context.clip).toHaveBeenCalledOnce();
    expect(context.fillRect).toHaveBeenCalled();
    expect(gradient.addColorStop).toHaveBeenCalled();
  });
});

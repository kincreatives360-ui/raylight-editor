import { describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, type ReactNode } from 'react';
import type { Layer } from '../../../model/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultShapeLayer } from '../../../model/defaults';
import { addLayerEffect } from '../../../model/layerEffects';
import type { LayerEffects } from '../../../model/types';
import { LayerEffectsSection } from './LayerEffectsSection';

const { updateLayer } = vi.hoisted(() => ({ updateLayer: vi.fn() }));
vi.mock('../../../store/useProjectStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../store/useProjectStore')>();
  return { ...actual, useProjectStore: Object.assign(() => ({ updateLayer }), { getState: actual.useProjectStore.getState }) };
});

const render = (effects: LayerEffects) => renderToStaticMarkup(<LayerEffectsSection activeShotId="test" layer={createDefaultShapeLayer({ effects })} />);

describe('layer effect controls', () => {
  it('exposes radial and zoom blur centers and sample quality without losing progression', () => {
    for (const type of ['radial', 'zoom'] as const) {
      const html = render({ layerBlur: .2, layerBlurSettings: { type, centerX: 0, centerY: 1, quality: 32, mode: 'progressive', start: 2, end: 20, angle: 45 } });
      for (const label of ['Layer blur type', 'Layer blur center X', 'Layer blur center Y', 'Layer blur quality', 'Start', 'End', 'Blur angle']) expect(html).toContain(label);
    }
    expect(render({ layerBlur: .2 })).not.toContain('Layer blur center X');
  });
  it('exposes RGB split modes, signed channels, softness and cell alignment', () => {
    let effects: LayerEffects = {};
    for (const key of ['rgbSplit', 'bevel', 'halftone', 'pixelate'] as const) effects = addLayerEffect(effects, key);
    const linear = render(effects);
    for (const label of ['RGB split mode', 'RGB split amount', 'RGB split angle', 'RGB split red', 'RGB split green', 'RGB split blue', 'Bevel and emboss softness', 'Halftone offset X', 'Halftone offset Y', 'Halftone contrast', 'Pixelate offset X', 'Pixelate offset Y']) expect(linear).toContain(label);
    const radial = render({ ...effects, rgbSplit: { ...effects.rgbSplit!, mode: 'radial' } });
    expect(radial).toContain('RGB split center X');
    expect(radial).toContain('RGB split center Y');
    expect(radial).not.toContain('RGB split angle');
  });
  it('initializes turbulent mode visibly and preserves authored values including zero', () => {
    for (const existing of [{ enabled: true }, { enabled: false, amount: 0, speed: 0, seed: 0, size: 75, evolution: 50, loop: true }]) {
      let layer = createDefaultShapeLayer({ effects: { layerBlur: .2, warp: existing } });
      updateLayer.mockImplementation((_shot: string, _id: string, edit: (current: Layer) => Layer) => { layer = edit(layer) as typeof layer; });
      const findMode = (node: ReactNode): { onChange: (mode: string) => void } | undefined => {
        for (const child of Children.toArray(node)) {
          if (!isValidElement<{ label?: string; children?: ReactNode; onChange: (mode: string) => void }>(child)) continue;
          if (child.props.label === 'Wrap mode') return child.props;
          const found = findMode(child.props.children);
          if (found) return found;
        }
      };
      findMode(LayerEffectsSection({ activeShotId: 'test', layer }))!.onChange('turbulent');
      expect(layer.effects.warp).toEqual({ mode: 'turbulent', amount: 30, size: 100, complexity: 3, seed: 1, pinning: 'none', evolution: 0, loop: false, loopDuration: 4, speed: 60, ...existing });
      expect(layer.effects.layerBlur).toBe(.2);
    }
  });
  it('hides the inactive evolution speed while turbulent looping is enabled', () => {
    const html = render({ warp: { enabled: true, mode: 'turbulent', loop: true } });
    expect(html).not.toContain('Evolution speed');
    expect(html).toContain('Loop duration');
  });
  it('toggles and removes each added effect while preserving the rest of the layer', () => {
    for (const [key, title] of [['outline', 'Alpha outline'], ['colorCorrection', 'Color correction'], ['noise', 'Noise'], ['bevel', 'Bevel and emboss'], ['halftone', 'Halftone'], ['roughen', 'Roughen edges'], ['colorKey', 'Color key'], ['pixelate', 'Pixelate'], ['rgbSplit', 'RGB split']] as const) {
      let layer = createDefaultShapeLayer({ effects: addLayerEffect({ layerBlur: .2 }, key) });
      updateLayer.mockImplementation((_shot: string, _id: string, edit: (current: Layer) => Layer) => { layer = edit(layer) as typeof layer; });
      const findCard = (node: ReactNode): { onToggle: () => void; onRemove: () => void } | undefined => {
        for (const child of Children.toArray(node)) {
          if (!isValidElement<{ title?: string; children?: ReactNode; onToggle: () => void; onRemove: () => void }>(child)) continue;
          if (child.props.title === title) return child.props;
          const found = findCard(child.props.children);
          if (found) return found;
        }
      };
      const controls = findCard(LayerEffectsSection({ activeShotId: 'test', layer }))!;
      controls.onToggle();
      expect(layer.effects[key]?.enabled).toBe(false);
      expect(layer.effects.layerBlur).toBe(.2);
      controls.onRemove();
      expect(layer.effects[key]).toBeUndefined();
      expect(layer.effects.layerBlur).toBe(.2);
    }
  });
  it('exposes all recommended effects and their complete controls', () => {
    let effects: LayerEffects = {};
    for (const key of ['outline', 'colorCorrection', 'noise', 'bevel', 'halftone', 'roughen', 'colorKey', 'pixelate'] as const) effects = addLayerEffect(effects, key);
    const html = render(effects);
    for (const label of ['Alpha outline width', 'Alpha outline placement', 'Alpha outline softness', 'Color correction exposure', 'Color correction black point', 'Color correction white point', 'Color correction gamma', 'Color correction curve shadows', 'Color correction curve midtones', 'Color correction curve highlights', 'Noise seed', 'Noise animated', 'Noise monochrome', 'Bevel and emboss depth', 'Bevel and emboss highlight color', 'Halftone source color', 'Halftone invert', 'Roughen edges evolution', 'Color key spill', 'Pixelate aspect', 'Pixelate start', 'Pixelate end']) expect(html).toContain(label);
    for (const name of ['Alpha outline', 'Color correction', 'Noise', 'Bevel and emboss', 'Halftone', 'Roughen edges', 'Color key', 'Pixelate']) {
      expect(html).toContain('Remove ' + name);
      expect(html).toContain('Disable ' + name);
    }
  });
  it('upgrades shadow and wrap cards with long and turbulent modes', () => {
    const html = render({ ...addLayerEffect({}, 'dropShadow'), ...addLayerEffect({}, 'warp'), dropShadow: { enabled: true, mode: 'long', color: '#000000', opacity: .4, blur: 0, offsetX: 0, offsetY: 0 }, warp: { enabled: true, mode: 'turbulent' } });
    for (const label of ['Shadow length', 'Shadow angle', 'Shadow fade', 'Turbulent amount', 'Complexity', 'Turbulent seed', 'Pinned edges', 'Evolution speed', 'Loop duration']) expect(html).toContain(label);
  });
  it('keeps zero-valued blur effects editable', () => {
    const html = render({ layerBlur: 0, backdropBlur: 0 });
    expect(html).toContain('Remove Layer blur');
    expect(html).toContain('Remove Backdrop blur');
  });
  it('exposes all reference parameters in the existing cards', () => {
    let effects: LayerEffects = {};
    for (const key of ['dropShadow', 'glow', 'liquidGlass', 'warp', 'screen'] as const) effects = addLayerEffect(effects, key);
    const html = render(effects);
    for (const label of ['Shadow mode', 'Spread', 'Add shadow', 'Glow mode', 'Glow angle', 'Sheen', 'Rim', 'Depth', 'Glow blending', 'Frost', 'Refract', 'Disperse', 'Shine', 'Wrap mode', 'Strength', 'Size', 'Center X', 'Center Y', 'Screen type', 'Pixel', 'Moiré', 'Bands', 'Focus', 'Flicker', 'Speed', 'Off-axis', 'Snap to pixels']) expect(html).toContain(label);
  });
  it('keeps progressive endpoints and angle separate from uniform blur', () => {
    const html = render({ layerBlur: .24, layerBlurSettings: { mode: 'progressive', start: 0, end: 24, angle: 270 } });
    expect(html).toContain('Start'); expect(html).toContain('End'); expect(html).toContain('Blur angle');
  });
});

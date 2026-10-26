import { expect, it } from 'vitest';
import { createDefaultProject } from '../model/defaults';
import { evaluateEffectsAtTime } from './evaluateEffects';
import { applyCanvasSceneEffects } from './canvasSceneEffects';
it('applies exposure stops and temperature to fallback pixels', () => {
  const shot = createDefaultProject().shots[0];
  for (const key of shot.effectsOrder) shot.effects[key].enabled = false;
  shot.effects.colorGrade = { enabled: true, exposure: 1, contrast: 1, saturation: 1, temperature: 0.5 };
  const pixels = new Uint8ClampedArray([128,128,128,255]);
  applyCanvasSceneEffects(pixels, 1, 1, evaluateEffectsAtTime(shot, 0));
  expect(pixels[0]).toBeGreaterThan(128);
  expect(pixels[0]).toBeGreaterThan(pixels[2]);
});
it('respects bloom threshold and effect order', () => {
  const shot = createDefaultProject().shots[0];
  for (const key of shot.effectsOrder) shot.effects[key].enabled = false;
  shot.effects.bloom = {enabled:true,intensity:1,threshold:0.9};
  const pixels = new Uint8ClampedArray([100,100,100,255]);
  applyCanvasSceneEffects(pixels,1,1,evaluateEffectsAtTime(shot,0));
  expect([...pixels]).toEqual([100,100,100,255]);
});

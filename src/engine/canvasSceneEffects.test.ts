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
it('applies scene-level motionBlur using evaluated.motionVector (F-14)', () => {
  const shot = createDefaultProject().shots[0];
  for (const key of shot.effectsOrder) shot.effects[key].enabled = false;
  shot.effects.motionBlur = { enabled: true, shutterAngle: 360, samples: 5 };
  const pixels = new Uint8ClampedArray([
    255, 255, 255, 255,
    255, 255, 255, 255,
    0, 0, 0, 255,
    0, 0, 0, 255,
  ]);
  const evaluated = {
    ...evaluateEffectsAtTime(shot, 1),
    motionVector: { x: 1, y: 0 },
  };
  applyCanvasSceneEffects(pixels, 4, 1, evaluated);
  expect(pixels[4]).toBeLessThan(255);
  expect(pixels[8]).toBeGreaterThan(0);
});

it('applies the ghost offset in the same direction as the scene shader', () => {
  const shot = createDefaultProject().shots[0];
  for (const key of shot.effectsOrder) shot.effects[key].enabled = false;
  shot.effects.ghost = { enabled: true, opacity: 1, offset: 1, blur: 0, angle: 0, spread: 1 };
  const pixels = new Uint8ClampedArray([255,0,0,255, 0,0,0,255, 0,0,0,255]);

  applyCanvasSceneEffects(pixels, 3, 1, evaluateEffectsAtTime(shot, 0));

  expect(pixels[4]).toBe(255);
});

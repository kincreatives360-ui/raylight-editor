import { describe, expect, it } from 'vitest';
import { createDefaultTextLayer, createDefaultShot, DEFAULT_PROJECT } from '../model/defaults';
import { TransitionishSchema, AnimationBlockSchema, validateProject } from '../model/schema';
import { evaluateLayerAtTime } from './evaluateLayer';
import type { AnimationBlock, Transitionish } from '../model/types';
const easing = { kind: 'preset', name: 'linear' } as const;
const transition = (type: string, extra = {}) => ({ type, durationMs: 1000, delayMs: 0, distance: .2, easing, ...extra }) as Transitionish;
const textLayer = () => createDefaultTextLayer({ content: 'Hello world\nNext line', inMs: 0, outMs: 4000, entrance: transition('none'), exit: transition('none') });
const block = (property: string, extra = {}) => ({ id: 'b', label: property, property, startMs: 0, durationMs: 1000, amount: .15, easing, ...extra }) as AnimationBlock;
describe('Animate controls', () => {
 it('persists new options', () => {
  const t = transition('rack-focus', { enabled: false, blur: 64, fade: false, stagger: 'word' }); expect(TransitionishSchema.parse(t)).toEqual(t);
  for (const property of ['wiggle', 'emphasis', 'changeText', 'shimmer']) { const b = block(property, { enabled: false, settings: { text: 'New', color: '#ff0000', intensity: 2, width: .3, direction: 'left' } }); expect(AnimationBlockSchema.parse(b)).toEqual(b); }
 });
 it('round-trips a saved project with muted stacked transitions and all block settings', () => {
  const entrance={...transition('focus',{enabled:false,blur:70,fade:false,stagger:'line'}),id:'transition'};
  const settings={targetPosition:{x:.2,y:.3,z:.1},targetScale:{x:2,y:2,z:1},targetSize:{width:.4,height:.2},color:'#22aaff',intensity:1.5,width:.25,direction:'down' as const,text:'Replacement'};
  const blocks=['wiggle','emphasis','changeText','shimmer','morph'].map(property=>block(property,{enabled:false,settings}));
  const layer={...textLayer(),entrances:[entrance],exits:[entrance],blocks};
  const parsed=validateProject(JSON.parse(JSON.stringify({...DEFAULT_PROJECT,shots:[createDefaultShot({layers:[layer]})]})));
  expect(parsed.success).toBe(true); if (!parsed.success) throw new Error(parsed.errors.join(', '));
  expect(parsed.data.shots[0].layers[0].entrances).toEqual([entrance]);
  expect(parsed.data.shots[0].layers[0].blocks).toEqual(blocks);
 });
 it('uses distinct real blur and focus depth', () => {
  const l = textLayer(); const r = ['blur', 'focus', 'rack-focus'].map(type => evaluateLayerAtTime({ ...l, entrance: transition(type, { fade: false }) }, 250));
  expect(r[0].extraLayerBlur).toBeCloseTo(30); expect(r[1].extraLayerBlur).toBeCloseTo(22.5); expect(r[2].extraLayerBlur).toBeGreaterThan(0); expect(r[2].position.z).not.toBe(l.position.z); expect(r.every(x => x.opacity === 1)).toBe(true);
  expect(evaluateLayerAtTime({ ...l, entrance: transition('blur') }, 1000).extraLayerBlur).toBe(0);
 });
 it('reveals text in letter word line units, reverses exit, staggers slide', () => {
  const l = textLayer();
  expect(evaluateLayerAtTime({ ...l, content: 'Hello world', entrance: transition('typewriter') }, 500).textContentOverride).toBe('Hello');
  expect(evaluateLayerAtTime({ ...l, entrance: transition('typewriter', { stagger: 'word' }) }, 250).textContentOverride).toBe('Hello ');
  expect(evaluateLayerAtTime({ ...l, entrance: transition('typewriter', { stagger: 'line' }) }, 500).textContentOverride).toBe('Hello world\n');
  expect(evaluateLayerAtTime({ ...l, exit: transition('typewriter') }, 4000).textContentOverride).toBe('');
  expect(evaluateLayerAtTime({ ...l, entrance: transition('slide-up', { stagger: 'word' }) }, 250).textContentOverride).toBe('Hello ');
 });
 it('mutes transitions and blocks', () => { const l = textLayer(); const r = evaluateLayerAtTime({ ...l, entrance: transition('blur', { enabled: false }), exit: transition('fade', { enabled: false }), blocks: [block('scale', { enabled: false })] }, 3500); expect(r.extraLayerBlur).toBe(0); expect(r.opacity).toBe(1); expect(r.scale).toEqual(l.scale); });
 it('wiggles transiently, pulses emphasis and changes text', () => {
  const l = textLayer(); const wiggle = { ...l, blocks: [block('wiggle')] }; expect(evaluateLayerAtTime(wiggle, 310).position.x).not.toBe(l.position.x); expect(evaluateLayerAtTime(wiggle, 310).position.y).not.toBe(l.position.y); expect(evaluateLayerAtTime(wiggle, 310).rotation).toEqual(l.rotation); expect(evaluateLayerAtTime(wiggle, 1000).position).toEqual(l.position);
  const pulse = { ...l, blocks: [block('emphasis')] }; expect(evaluateLayerAtTime(pulse, 500).scale.x).toBeGreaterThan(l.scale.x); expect(evaluateLayerAtTime(pulse, 1000).scale.x).toBe(l.scale.x);
  const change = { ...l, blocks: [block('changeText', { settings: { text: 'Updated' } })] }; expect(evaluateLayerAtTime(change, 500).textContentOverride).not.toBe(l.content); expect(evaluateLayerAtTime(change, 1000).textContentOverride).toBe('Updated');
 });
 it('honors Fade off for all motion entrances and exits', () => {
  const l = textLayer();
  for (const type of ['slide-up', 'slide-down', 'slide-left', 'slide-right', 'float-out', 'scale-out']) {
   const entrance = evaluateLayerAtTime({...l, entrance:transition(type,{fade:false})},500);
   const exit = evaluateLayerAtTime({...l, exit:transition(type,{fade:false})},3500);
   expect(entrance.opacity).toBe(1); expect(exit.opacity).toBe(1);
  }
 });
 it('keeps blur finite under back and spring easing overshoot', () => {
  const l = textLayer();
  for (const type of ['blur','focus','rack-focus']) for (const name of ['ease-in-back','ease-out-back'] as const) {
   for (const t of [100,250,500,750,900]) {
    const r=evaluateLayerAtTime({...l,entrance:transition(type,{easing:{kind:'preset',name}})},t);
    expect(Number.isFinite(r.extraLayerBlur)).toBe(true); expect(r.extraLayerBlur).toBeGreaterThanOrEqual(0);
   }
  }
 });
 it('morphs captured geometry without looking up mutable targets', () => {
  const l = textLayer(); const settings = { targetPosition: {x: .8,y: .6,z: .2}, targetScale: {x: 2,y: 3,z: 1}, targetSize: {width: .5,height: .3} };
  const b = block('morph', {settings}); expect(AnimationBlockSchema.parse(b)).toEqual(b);
  const initial = evaluateLayerAtTime(l, 0); const middle = evaluateLayerAtTime({...l, blocks:[b]}, 500);
  expect(middle.position.x).toBeCloseTo((l.position.x + .8)/2); expect(middle.size.width).toBeCloseTo((initial.size.width + .5)/2);
  expect(evaluateLayerAtTime({...l, blocks:[b]}, 1000).scale).toEqual(settings.targetScale);
 });
 it('carries active shimmer settings', () => { const l = textLayer(); const settings = { color: '#ff0000', intensity: 2, width: .3, direction: 'up' as const }; const active = { ...l, blocks: [block('shimmer', { settings })] }; expect(evaluateLayerAtTime(active, 500).shimmerSettings).toEqual(settings); expect(evaluateLayerAtTime(active, 1000).shimmerProgress).toBe(0); });
});

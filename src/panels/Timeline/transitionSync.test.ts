import {describe,it,expect} from 'vitest';
import {createDefaultTextLayer} from '../../model/defaults';
import {evaluateLayerAtTime} from '../../engine/evaluateLayer';
import {getTimelineTransition, updateTimelineTransition} from './transitionSync';
const easing={kind:'preset',name:'linear'} as const;
describe('timeline transition synchronization',()=>{
 it('updates timing used by playback and preserves stack ids, settings and siblings',()=>{
  const first={type:'blur' as const,id:'first',durationMs:1000,delayMs:0,distance:.2,easing,blur:70,fade:false,stagger:'word' as const};
  const second={...first,id:'second',enabled:false};
  const l=createDefaultTextLayer({inMs:0,outMs:5000,entrances:[first,second]});
  const updated=updateTimelineTransition(l,'entrance',{delayMs:1000,durationMs:2000});
  expect(updated.entrance).toEqual(updated.entrances?.[0]); expect(updated.entrances?.[0]).toMatchObject({...first,delayMs:1000,durationMs:2000}); expect(updated.entrances?.[1]).toBe(second);
  expect(getTimelineTransition(updated,'entrance').type).toBe('blur');
  expect(evaluateLayerAtTime(updated,1500).extraLayerBlur).toBeCloseTo(52.5);
 });
 it('supports exit easing and explicit secondary id without replacing first mirror',()=>{
  const l=createDefaultTextLayer(); const a={...l.exit,id:'a',type:'focus' as const,enabled:false,blur:60}; const b={...a,id:'b'};
  const updated=updateTimelineTransition({...l,exits:[a,b]},'exit',{easing},'b');
  expect(updated.exit).toBe(a); expect(updated.exits?.[0]).toBe(a); expect(updated.exits?.[1]).toEqual({...b,easing});
 });
 it('creates a stack when editing legacy projects and falls back from missing selection ids',()=>{
  const l=createDefaultTextLayer(); const updated=updateTimelineTransition(l,'exit',{type:'fade',delayMs:200});
  expect(updated.exit).toEqual(updated.exits?.[0]); expect(updated.exit.delayMs).toBe(200);
  expect(updateTimelineTransition(updated,'exit',{durationMs:800},'missing').exit.durationMs).toBe(800);
 });
});

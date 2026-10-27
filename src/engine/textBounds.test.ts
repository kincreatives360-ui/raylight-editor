import {describe,it,expect} from 'vitest';
import {createDefaultTextLayer} from '../model/defaults';
import {evaluateLayerAtTime} from './evaluateLayer';
describe('multiline text bounds',()=>{
 it('contains both lines at the maximum editable line height',()=>{const layer=createDefaultTextLayer({content:'First line\nSecond line'});layer.font.lineHeight=4;const frame=evaluateLayerAtTime(layer,1000);expect(frame.size.height).toBeGreaterThanOrEqual(layer.font.size*5);});
 it('preserves single-line geometry',()=>{const layer=createDefaultTextLayer();expect(evaluateLayerAtTime(layer,1000).size.height).toBe(layer.font.size*2.5);});
});
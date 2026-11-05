import { describe, expect, it } from 'vitest';
import { getWorkspaceLayout, defaultInspectorWidth, clampPanelWidth } from './workspaceLayout';
describe('workspace sizing', () => {
 it('keeps defaults compact at standard widths', () => { expect(defaultInspectorWidth(1280)).toBe(260); expect(defaultInspectorWidth(1536)).toBe(260); expect(defaultInspectorWidth(1920)).toBe(300); });
 it('reserves canvas space without mutating saved preferences', () => { const input={viewport:1024,left:460,right:500,leftOpen:true,rightOpen:true}; const result=getWorkspaceLayout(input); expect(result.left+result.right).toBeLessThanOrEqual(684); expect(result.right).toBeGreaterThanOrEqual(260); expect(input.right).toBe(500); expect(getWorkspaceLayout({...input,viewport:1920}).right).toBe(500); });
 it('collapses panels that cannot fit and preserves canvas', () => { const result=getWorkspaceLayout({viewport:700,left:260,right:300,leftOpen:true,rightOpen:true}); expect(result.showLeft).toBe(false); expect(result.showRight).toBe(true); expect(result.right).toBeLessThanOrEqual(360); });
 it('constrains keyboard, pointer and reset values equally', () => { expect(clampPanelWidth(500,260,500,310)).toBe(310); expect(clampPanelWidth(300,260,500,280)).toBe(280); expect(clampPanelWidth(NaN,260,500,310)).toBe(260); });
});

it('honors the resized panel width when both saved preferences exceed the budget', () => {
 const result = getWorkspaceLayout({viewport:1024,left:460,right:358,leftOpen:true,rightOpen:true,priority:'right'});
 expect(result.right).toBe(358);
 expect(result.left).toBe(326);
});
it('allows explicitly reopening the inspector on a phone-sized viewport', () => {
 const result = getWorkspaceLayout({viewport:390,left:260,right:300,leftOpen:false,rightOpen:true});
 expect(result.showRight).toBe(true);
 expect(result.right).toBe(260);
});

import { describe, expect, it } from 'vitest';
import { createDefaultImageLayer, createDefaultVideoLayer, createDefaultProject } from '../../model/defaults';
import { evaluateProjectAtTime } from '../../engine/evaluateShot';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDevicePlacementSize, resizeDeviceFromHandle, resizeDevicePlacement } from '../../model/deviceFrame';
import { validateProject } from '../../model/schema';
import { getLayer3DWorldTransform, getLayerProjectedCorners, getLayerRenderLayout } from './cameraMath';

function evaluated(framed = true) {
  const project = createDefaultProject();
  project.shots[0].layers = [createDefaultImageLayer({
    size: { width: 0.7, height: 0.6 },
    deviceFrame: framed ? { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true } : undefined,
    entrance: { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } },
  })];
  return evaluateProjectAtTime(project, 1000).layers[0];
}

describe('device frame stage layout contract', () => {
  it.each([16 / 9, 9 / 16, 1])('preserves physical ratios and height-relative placement at project aspect %s', aspect => {
    const ev = evaluated();
    const raw = getLayer3DWorldTransform(ev, aspect);
    const result = getLayerRenderLayout(ev, aspect);
    expect(result.frameMetrics?.bodyHeight).toBeCloseTo(raw.meshH);
    expect(result.frameMetrics!.bodyWidth / result.frameMetrics!.bodyHeight).toBeCloseTo(70.6 / 146.6, 8);
    expect(result.meshW / result.meshH).toBeCloseTo(1179 / 2556, 8);
    expect(result.worldX).toBe(raw.worldX);
    expect(result.worldY).toBe(raw.worldY);
  });

  it('keeps hardware uniform when an animation or inspector supplies unequal axis scales', () => {
    const ev = evaluated();
    ev.scale = { x: 4, y: 1, z: 0.5 };
    expect(getLayerRenderLayout(ev, 16 / 9).scale).toEqual({ x: 2, y: 2, z: 2 });
    ev.scale = { x: -4, y: 1, z: 1 };
    expect(getLayerRenderLayout(ev, 16 / 9).scale).toEqual({ x: -2, y: 2, z: 2 });
  });

  it('leaves ordinary media transforms and dimensions unchanged', () => {
    const ev = evaluated(false);
    ev.scale = { x: 4, y: 1, z: 0.5 };
    const raw = getLayer3DWorldTransform(ev, 16 / 9);
    const result = getLayerRenderLayout(ev, 16 / 9);
    expect(result).toMatchObject(raw);
    expect(result.frameMetrics).toBeNull();
    expect(result.scale).toEqual(ev.scale);
  });

  it('projects the fixed body rather than the original landscape media box', () => {
    const ev = evaluated();
    const corners = getLayerProjectedCorners(ev, 1600, 900, 16 / 9);
    const width = Math.abs(corners.pNE.x - corners.pNW.x);
    const height = Math.abs(corners.pSW.y - corners.pNW.y);
    // Physical bounds also include the buttons projecting beyond the shell.
    expect(width / height).toBeGreaterThan(70.6 / 146.6);
    expect(width / height).toBeLessThan(70.6 / 146.6 + 0.005);
  });

  it('resizes uniformly from either placement dimension', () => {
    const initial = { width: 0.7, height: 0.6 };
    expect(resizeDevicePlacement(initial, 'width', 1.4)).toEqual({ width: 1.4, height: 1.2 });
    expect(resizeDevicePlacement(initial, 'height', 1.2)).toEqual({ width: 1.4, height: 1.2 });
    expect(initial).toEqual({ width: 0.7, height: 0.6 });
  });

  it('uses the visible phone dimensions for width inputs and anchored edge resizing', () => {
    const initial = { width: 0.7, height: 0.6 };
    const visible = getDevicePlacementSize(initial, DEFAULT_DEVICE_FRAME_SETTINGS, 16 / 9);
    expect(visible.width * (16 / 9) / visible.height).toBeCloseTo(70.6 / 146.6, 8);
    const resized = resizeDevicePlacement(initial, 'width', visible.width + 0.1, visible);
    const next = getDevicePlacementSize(resized, DEFAULT_DEVICE_FRAME_SETTINGS, 16 / 9);
    expect(next.width - visible.width).toBeCloseTo(0.1, 8);
    expect(next.height / visible.height).toBeCloseTo(next.width / visible.width, 8);
  });

  it('keeps extreme shrink operations valid for project save/reopen', () => {
    const initial = { width: 0.7, height: 0.6 };
    const settings = { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true, deviceScale: 2 };
    const visible = getDevicePlacementSize(initial, settings, 16 / 9);
    const size = resizeDevicePlacement(initial, 'height', 0.01, visible);
    const project = createDefaultProject();
    project.shots[0].layers = [createDefaultImageLayer({ size, deviceFrame: settings })];
    expect(validateProject(JSON.parse(JSON.stringify(project))).success).toBe(true);
    expect(size.width / size.height).toBeCloseTo(initial.width / initial.height, 8);
  });

  it.each([1, -1])('anchors the opposite edge at evaluated scale 2 with mirror sign %s', mirrorX => {
    const ev = evaluated();
    ev.scale = { x: 4 * mirrorX, y: 1, z: 0.5 };
    const layer = ev.layer;
    if (layer.kind !== 'image' || !layer.deviceFrame) throw new Error('fixture');
    const visible = getDevicePlacementSize(layer.size, layer.deviceFrame, 16 / 9, ev.scale);
    const base = getDevicePlacementSize(layer.size, layer.deviceFrame, 16 / 9);
    expect(visible.width).toBeCloseTo(base.width * 2, 8);
    const resized = resizeDeviceFromHandle(layer.size, visible, 'e', 0.1 * mirrorX, 0, { x: mirrorX, y: 1 });
    const next = getDevicePlacementSize(resized.size, layer.deviceFrame, 16 / 9, ev.scale);
    expect(next.width - visible.width).toBeCloseTo(0.1, 8);
    expect(resized.centerOffset.x - mirrorX * next.width / 2).toBeCloseTo(-mirrorX * visible.width / 2, 8);
  });

  it('correctly resolves frame metrics and device settings for video layers', () => {
    const project = createDefaultProject();
    project.shots[0].layers = [createDefaultVideoLayer({
      size: { width: 0.7, height: 0.6 },
      deviceFrame: { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true },
      entrance: { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: 'linear' } },
    })];
    const ev = evaluateProjectAtTime(project, 1000).layers[0];
    const layout = getLayerRenderLayout(ev, 16 / 9);
    expect(layout.deviceSettings).not.toBeNull();
    expect(layout.frameMetrics).not.toBeNull();
    expect(layout.frameMetrics!.bodyWidth / layout.frameMetrics!.bodyHeight).toBeCloseTo(70.6 / 146.6, 8);
  });
});

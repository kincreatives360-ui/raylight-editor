import { describe, expect, it } from 'vitest';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDeviceFrameMetrics } from '../../model/deviceFrame';
import { getPhoneLayout, getPhoneLocalBounds } from './phoneLayout';
import { getLayerProjectedCorners } from './cameraMath';
import { createDefaultImageLayer, createDefaultProject } from '../../model/defaults';
import { evaluateProjectAtTime } from '../../engine/evaluateShot';
import { createBodyGeometry } from './phoneGeometry';
import { getIPhone15ProBounds, getIPhone15ProLayout } from './iphone15ProLayout';

describe('physical device selection bounds', () => {
  const settings = { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true };
  const metrics = getDeviceFrameMetrics(0.4, 0.8, settings);

  it('includes side buttons and rear camera surfaces but excludes the decorative shadow', () => {
    const layout = getPhoneLayout(metrics, settings);
    const hardwareLayout = getIPhone15ProLayout(metrics, settings);
    const bounds = getPhoneLocalBounds(metrics, settings);
    expect(bounds.min.x).toBeLessThan(-metrics.bodyWidth / 2);
    expect(bounds.max.x).toBeGreaterThan(metrics.bodyWidth / 2);
    expect(bounds).toEqual(getIPhone15ProBounds(hardwareLayout));
    expect(bounds.min.z).toBeLessThan(layout.cameraZ - metrics.bodyDepth * 0.025);
    expect(bounds.max.z).toBeCloseTo(hardwareLayout.front.dynamicIslandZ, 8);
    expect(getPhoneLocalBounds(metrics, { ...settings, shadowBlur: 1, shadowOffset: 0.5 })).toEqual(bounds);
    const plain = getPhoneLocalBounds(metrics, { ...settings, showSideButtons: false, showRearCameras: false });
    expect(plain.min.x).toBeCloseTo(-metrics.bodyWidth / 2, 8);
    expect(plain.min.z).toBeGreaterThan(bounds.min.z);
  });

  it.each([Math.PI / 2, -Math.PI / 2])('keeps selection handles apart at edge-on yaw %s', yaw => {
    const project = createDefaultProject();
    project.shots[0].layers = [createDefaultImageLayer({ deviceFrame: settings, rotation: { x: 0, y: yaw, z: 0 } })];
    const ev = evaluateProjectAtTime(project, 1500).layers[0];
    const projected = getLayerProjectedCorners(ev, 1600, 900, 16 / 9);
    expect(projected.pNE.x - projected.pNW.x).toBeGreaterThan(10);
    expect(projected.corners.length).toBeGreaterThanOrEqual(4);
    const crop = getLayerProjectedCorners(ev, 1600, 900, 16 / 9, undefined, undefined, undefined, 'screen');
    // A raised screen plane has a small perspective sliver at 90 degrees.
    expect(Math.abs(crop.pNE.x - crop.pNW.x)).toBeLessThan((projected.pNE.x - projected.pNW.x) * 0.1);
  });

  it.each([Math.PI, -Math.PI, 2 * Math.PI])('projects valid selection bounds for full 3D rotation at yaw %s', yaw => {
    const project = createDefaultProject();
    project.shots[0].layers = [createDefaultImageLayer({ deviceFrame: settings, rotation: { x: 0, y: yaw, z: 0 } })];
    const ev = evaluateProjectAtTime(project, 1500).layers[0];
    const projected = getLayerProjectedCorners(ev, 1600, 900, 16 / 9);
    expect(projected.pNE.x - projected.pNW.x).toBeGreaterThan(50);
    expect(projected.pSE.y - projected.pNE.y).toBeGreaterThan(50);
    expect(projected.corners.length).toBeGreaterThanOrEqual(4);
  });

  it('includes a thick legacy chassis rear bevel independently of corner radius', () => {
    const legacy = { ...settings, geometryVersion: undefined, showRearCameras: false, showSideButtons: false };
    const thick = { ...metrics, bodyDepth: 0.4, bodyCornerRadius: 0.02 };
    const geometry = createBodyGeometry(thick.bodyWidth, thick.bodyHeight, thick.bodyCornerRadius, thick.bodyDepth, false);
    geometry.computeBoundingBox();
    const actualRear = geometry.boundingBox!.min.z + getPhoneLayout(thick, legacy).bodyZ;
    expect(getPhoneLocalBounds(thick, legacy).min.z).toBeLessThanOrEqual(actualRear + 0.000001);
    geometry.dispose();
  });

  it('rotates selection handles synchronously with the device body under planar roll', () => {
    const project = createDefaultProject();
    project.shots[0].layers = [createDefaultImageLayer({ deviceFrame: settings, rotation: { x: 0, y: 0, z: Math.PI / 2 } })];
    const ev = evaluateProjectAtTime(project, 1500).layers[0];
    const projected = getLayerProjectedCorners(ev, 1600, 900, 16 / 9);

    expect(projected.corners).toHaveLength(4);
    // At 90 deg roll, the rotation handle pRot should be oriented perpendicular to the rotated top edge (along screen X)
    expect(Math.abs(projected.pRot.y - projected.pN.y)).toBeLessThan(5);
    expect(Math.abs(projected.pRot.x - projected.pN.x)).toBeGreaterThan(20);
  });

  it('produces convex hull bounding corners under 3D tilt', () => {
    const project = createDefaultProject();
    project.shots[0].layers = [createDefaultImageLayer({ deviceFrame: settings, rotation: { x: 0.5, y: 0.5, z: 0 } })];
    const ev = evaluateProjectAtTime(project, 1500).layers[0];
    const projected = getLayerProjectedCorners(ev, 1600, 900, 16 / 9);

    expect(projected.corners.length).toBeGreaterThan(4);
    expect(projected.pNW.x).toBeLessThan(projected.pNE.x);
    expect(projected.pNW.y).toBeLessThan(projected.pSW.y);
  });
});

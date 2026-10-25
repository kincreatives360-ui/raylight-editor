import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDeviceFrameMetrics } from '../../model/deviceFrame';
import { createAppleMarkGeometry, createBodyGeometry, createCameraBarrelGeometry, createRoundedPanelGeometry, createScreenGeometry } from './phoneGeometry';

describe('fixed phone body geometry', () => {
  it('includes bevels inside the specified width, height, and depth', () => {
    const metrics = getDeviceFrameMetrics(0.7, 0.6, DEFAULT_DEVICE_FRAME_SETTINGS);
    const geometry = createBodyGeometry(metrics.bodyWidth, metrics.bodyHeight, metrics.bodyCornerRadius, metrics.bodyDepth, true);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(metrics.bodyWidth, 6);
    expect(size.y).toBeCloseTo(metrics.bodyHeight, 6);
    expect(size.z).toBeCloseTo(metrics.bodyDepth, 6);
    expect(geometry.boundingBox!.min.z).toBeCloseTo(0, 6);
    geometry.dispose();
  });

  it.each([[0.3, 0.65], [3, 6.5]])('normalizes glass/reflection UVs at screen size %s × %s', (width, height) => {
    const geometry = createScreenGeometry(width, height, width * 0.1);
    const uv = geometry.attributes.uv;
    const u = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const v = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    expect(Math.min(...u)).toBeCloseTo(0, 7);
    expect(Math.max(...u)).toBeCloseTo(1, 7);
    expect(Math.min(...v)).toBeCloseTo(0, 7);
    expect(Math.max(...v)).toBeCloseTo(1, 7);
    geometry.dispose();
  });
});

describe('detailed iPhone hardware geometry', () => {
  it('creates a rear panel with the requested footprint and actual depth', () => {
    const geometry = createRoundedPanelGeometry(0.3, 0.4, 0.04, 0.02);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.3, 6);
    expect(size.y).toBeCloseTo(0.4, 6);
    expect(size.z).toBeCloseTo(0.02, 6);
    geometry.dispose();
  });

  it('creates a camera barrel with a raised ring and a recessed glass plane', () => {
    const barrel = createCameraBarrelGeometry(0.04, 0.016, 0.007);
    barrel.ring.computeBoundingBox();
    barrel.glass.computeBoundingBox();
    expect(barrel.ring.boundingBox!.getSize(new Vector3()).z).toBeGreaterThan(0.01);
    // The lens is set behind the rear-facing ring lip, inside the aperture.
    expect(barrel.ring.boundingBox!.min.z).toBeLessThan(barrel.glassPositionZ + barrel.glass.boundingBox!.min.z);
    expect(barrel.glassPositionZ + barrel.glass.boundingBox!.max.z).toBeLessThan(barrel.ring.boundingBox!.max.z);
    barrel.ring.dispose();
    barrel.glass.dispose();
  });

  it('centers an Apple mark inside its supplied rear mark bounds', () => {
    const geometry = createAppleMarkGeometry(0.08, 0.1, 0.006);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-box.max.x, 7);
    expect(box.min.y).toBeCloseTo(-box.max.y, 7);
    expect(box.getSize(new Vector3()).x).toBeLessThanOrEqual(0.08);
    expect(box.getSize(new Vector3()).y).toBeLessThanOrEqual(0.1);
    expect(geometry.groups.length).toBeGreaterThanOrEqual(2);
    geometry.dispose();
  });

  it('allocates high tessellation segment counts for smooth curves and round hardware apertures', () => {
    const barrel = createCameraBarrelGeometry(0.04, 0.016, 0.007);
    expect(barrel.ring.parameters.radialSegments).toBeGreaterThanOrEqual(32);
    expect(barrel.ring.parameters.tubularSegments).toBeGreaterThanOrEqual(96);
    expect(barrel.glass.parameters.radialSegments).toBeGreaterThanOrEqual(96);
    barrel.ring.dispose();
    barrel.glass.dispose();

    const screen = createScreenGeometry(0.3, 0.65, 0.03);
    // 64 curve segments ensures high polygon density for corners
    expect(screen.attributes.position.count).toBeGreaterThan(100);
    screen.dispose();
  });
});

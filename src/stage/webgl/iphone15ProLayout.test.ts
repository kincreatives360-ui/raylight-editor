import { describe, expect, it } from 'vitest';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDeviceFrameMetrics } from '../../model/deviceFrame';
import { getIPhone15ProBounds, getIPhone15ProLayout } from './iphone15ProLayout';

describe('iPhone 15 Pro feature layout', () => {
  const settings = { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true };
  const metrics = getDeviceFrameMetrics(0.4, 0.8, settings);

  it('keeps the Dynamic Island centered inside the upper display inset', () => {
    const layout = getIPhone15ProLayout(metrics, settings);

    expect(layout.dynamicIsland.center.x).toBeCloseTo(0, 8);
    expect(layout.dynamicIsland.center.y).toBeGreaterThan(0);
    expect(layout.dynamicIsland.center.y + layout.dynamicIsland.height / 2).toBeLessThan(metrics.screenHeight / 2);
    expect(layout.dynamicIsland.width).toBeLessThan(metrics.screenWidth * 0.45);
  });

  it('places action and volume controls on the left rail and the side button on the right rail', () => {
    const layout = getIPhone15ProLayout(metrics, settings);

    expect(layout.buttons.action.center.x).toBeLessThanOrEqual(-metrics.bodyWidth / 2);
    expect(layout.buttons.volumeUp.center.x).toBeLessThanOrEqual(-metrics.bodyWidth / 2);
    expect(layout.buttons.volumeDown.center.x).toBeLessThanOrEqual(-metrics.bodyWidth / 2);
    expect(layout.buttons.side.center.x).toBeGreaterThanOrEqual(metrics.bodyWidth / 2);
    expect(layout.buttons.action.center.x - layout.buttons.action.width / 2).toBeLessThan(-metrics.bodyWidth / 2);
    expect(layout.buttons.side.center.x + layout.buttons.side.width / 2).toBeGreaterThan(metrics.bodyWidth / 2);
    expect(layout.buttons.action.depth).toBeGreaterThan(0);
  });

  it('keeps three rear lenses, flash, and LiDAR inside the upper-left camera plateau', () => {
    const layout = getIPhone15ProLayout(metrics, settings);
    const plateau = layout.camera.plateau;
    const components = [...layout.camera.lenses, layout.camera.flash, layout.camera.lidar];

    expect(layout.camera.lenses).toHaveLength(3);
    for (const component of components) {
      expect(component.center.x - component.radius).toBeGreaterThanOrEqual(plateau.center.x - plateau.width / 2);
      expect(component.center.x + component.radius).toBeLessThanOrEqual(plateau.center.x + plateau.width / 2);
      expect(component.center.y - component.radius).toBeGreaterThanOrEqual(plateau.center.y - plateau.height / 2);
      expect(component.center.y + component.radius).toBeLessThanOrEqual(plateau.center.y + plateau.height / 2);
    }
    expect(plateau.center.x).toBeLessThan(0);
    expect(plateau.center.y).toBeGreaterThan(0);
  });

  it('includes protruding hardware in physical bounds without including the decorative shadow', () => {
    const layout = getIPhone15ProLayout(metrics, settings);
    const bounds = getIPhone15ProBounds(layout);

    expect(bounds.min.x).toBeLessThan(-metrics.bodyWidth / 2);
    expect(bounds.max.x).toBeGreaterThan(metrics.bodyWidth / 2);
    expect(bounds.min.z).toBeLessThan(layout.camera.plateau.z - layout.camera.plateau.depth / 2);
    expect(bounds.max.z).toBeCloseTo(layout.front.dynamicIslandZ, 8);
  });

  it('keeps rear glass and the Apple mark inside bounds when cameras are hidden', () => {
    const layout = getIPhone15ProLayout(metrics, settings);
    const bounds = getIPhone15ProBounds(layout, { includeCameras: false });

    expect(bounds.min.z).toBeLessThanOrEqual(layout.rearGlass.z - layout.rearGlass.depth / 2);
    expect(bounds.min.z).toBeLessThanOrEqual(layout.appleMark.z - layout.appleMark.depth / 2);
  });
});

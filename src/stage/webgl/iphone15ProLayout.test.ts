import { describe, expect, it } from 'vitest';
import { DEFAULT_DEVICE_FRAME_SETTINGS, getDeviceFrameMetrics, SCREEN_PLANE_Z } from '../../model/deviceFrame';
import {
  BASE_UNIT_IPHONE_15_PRO_LAYOUT,
  UNIT_IPHONE_15_PRO_METRICS,
  getIPhone15ProBounds,
  getIPhone15ProLayout,
} from './iphone15ProLayout';

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

  it('adapts cutout layout to notch, punch-hole, and custom dimensions', () => {
    const notchLayout = getIPhone15ProLayout(metrics, { ...settings, cutoutStyle: 'notch', cutoutWidth: 0.5 });
    expect(notchLayout.dynamicIsland.width).toBeGreaterThan(metrics.screenWidth * 0.5);
    expect(notchLayout.dynamicIsland.center.y + notchLayout.dynamicIsland.height / 2).toBeCloseTo(metrics.screenHeight / 2, 5);

    const punchLayout = getIPhone15ProLayout(metrics, { ...settings, cutoutStyle: 'punch-hole' });
    expect(punchLayout.dynamicIsland.width).toBeCloseTo(punchLayout.dynamicIsland.height, 5);

    const wideIsland = getIPhone15ProLayout(metrics, { ...settings, cutoutWidth: 0.6 });
    const standardIsland = getIPhone15ProLayout(metrics, settings);
    expect(wideIsland.dynamicIsland.width).toBeGreaterThan(standardIsland.dynamicIsland.width);
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

  it('provides normalized unit metrics with unit body height', () => {
    expect(UNIT_IPHONE_15_PRO_METRICS.bodyHeight).toBe(1);
    expect(UNIT_IPHONE_15_PRO_METRICS.bodyWidth).toBeCloseTo(70.6 / 146.6, 6);
    expect(UNIT_IPHONE_15_PRO_METRICS.bodyDepth).toBeCloseTo(8.25 / 146.6, 6);
  });

  it('preserves exact spatial congruence when scaling base unit layout to world metrics', () => {
    const scaleFactor = metrics.bodyHeight;
    const directLayout = getIPhone15ProLayout(metrics, settings);

    // Body dimensions and Z position relative to SCREEN_PLANE_Z
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.width * scaleFactor).toBeCloseTo(directLayout.body.width, 6);
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.height * scaleFactor).toBeCloseTo(directLayout.body.height, 6);
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.body.z - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.body.z, 6);

    // Front bezel, glass, reflection
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.bezelZ - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.front.bezelZ, 6);
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.glassZ - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.front.glassZ, 6);
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.front.reflectionZ - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.front.reflectionZ, 6);

    // Rear components: plateau, lenses, apple mark
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.center.x * scaleFactor).toBeCloseTo(directLayout.camera.plateau.center.x, 6);
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.center.y * scaleFactor).toBeCloseTo(directLayout.camera.plateau.center.y, 6);
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.camera.plateau.z - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.camera.plateau.z, 6);
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.z - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.appleMark.z, 6);
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.appleMark.center.y * scaleFactor).toBeCloseTo(directLayout.appleMark.center.y, 6);

    // Side buttons
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.center.x * scaleFactor).toBeCloseTo(directLayout.buttons.action.center.x, 6);
    expect(BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.center.y * scaleFactor).toBeCloseTo(directLayout.buttons.action.center.y, 6);
    expect(SCREEN_PLANE_Z + (BASE_UNIT_IPHONE_15_PRO_LAYOUT.buttons.action.z - SCREEN_PLANE_Z) * scaleFactor).toBeCloseTo(directLayout.buttons.action.z, 6);
  });
});

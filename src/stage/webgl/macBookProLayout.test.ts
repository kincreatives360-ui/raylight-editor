import { describe, expect, it } from 'vitest';
import {
    DEFAULT_DEVICE_FRAME_SETTINGS,
    getDeviceFrameMetrics,
    MACBOOK_PRO_16,
} from '../../model/deviceFrame';
import {
    getMacBookProLayout,
    UNIT_MACBOOK_PRO_16_METRICS,
} from './macBookProLayout';

describe('MacBook Pro layout and geometry', () => {
    const settings = {
        ...DEFAULT_DEVICE_FRAME_SETTINGS,
        enabled: true,
        deviceId: 'macbook-pro-16',
        lidAngle: 110,
    };
    const metrics = getDeviceFrameMetrics(1.6, 1.0, settings);

    it('calculates calibrated display lid and screen bounds', () => {
        const layout = getMacBookProLayout(metrics, settings);

        expect(layout.lid.width).toBeGreaterThan(layout.screen.width);
        expect(layout.lid.height).toBeGreaterThan(layout.screen.height);
        expect(layout.lid.depth).toBeGreaterThan(0);
        expect(layout.screen.cornerRadius).toBeGreaterThan(0);
        expect(layout.screen.cornerRadius).toBeLessThan(layout.lid.cornerRadius);
    });

    it('places the camera notch cutout centered at top of display', () => {
        const layout = getMacBookProLayout(metrics, settings);

        expect(layout.notch.center.x).toBeCloseTo(0, 5);
        expect(layout.notch.center.y).toBeGreaterThan(0);
        expect(layout.notch.width).toBeLessThan(layout.screen.width * 0.25);
        expect(layout.notch.height).toBeLessThan(layout.screen.height * 0.1);
        expect(layout.notch.center.y + layout.notch.height / 2).toBeCloseTo(
            layout.screen.height / 2,
            1
        );
    });

    it('positions the keyboard base, recessed keyboard well, and trackpad with hinge pivot', () => {
        const layout = getMacBookProLayout(metrics, settings);

        expect(layout.base.width).toBeCloseTo(layout.lid.width, 2);
        expect(layout.base.length).toBeGreaterThan(0);
        expect(layout.base.thickness).toBeGreaterThan(layout.lid.depth);
        expect(layout.base.pivotY).toBeCloseTo(-metrics.bodyHeight / 2, 5);
        expect(layout.base.lidAngleDeg).toBe(110);

        // Keyboard well should be wider than trackpad and positioned above trackpad on the base
        expect(layout.keyboardWell.width).toBeGreaterThan(layout.trackpad.width);
        expect(layout.keyboardWell.center.y).toBeGreaterThan(layout.trackpad.center.y);

        // Trackpad should be centered on X
        expect(layout.trackpad.center.x).toBeCloseTo(0, 5);
        expect(layout.trackpad.width).toBeLessThan(layout.base.width * 0.5);
    });

    it('provides valid unit metrics for MacBook Pro 16', () => {
        expect(UNIT_MACBOOK_PRO_16_METRICS.bodyHeight).toBe(1);
        expect(UNIT_MACBOOK_PRO_16_METRICS.bodyWidth).toBeCloseTo(
            MACBOOK_PRO_16.body.width / MACBOOK_PRO_16.body.height,
            4
        );
        expect(UNIT_MACBOOK_PRO_16_METRICS.screenWidth).toBeLessThan(
            UNIT_MACBOOK_PRO_16_METRICS.bodyWidth
        );
    });
});

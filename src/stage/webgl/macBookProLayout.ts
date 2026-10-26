import { MACBOOK_PRO_16, SCREEN_PLANE_Z, type DeviceFrameMetrics } from '../../model/deviceFrame';
import type { DeviceFrameSettings } from '../../model/types';

export interface MacBookProLayout {
    lid: {
        width: number;
        height: number;
        depth: number;
        cornerRadius: number;
        bezelDepth: number;
        bezelZ: number;
        glassZ: number;
    };
    screen: {
        width: number;
        height: number;
        cornerRadius: number;
    };
    notch: {
        width: number;
        height: number;
        radius: number;
        center: { x: number; y: number };
    };
    base: {
        width: number;
        length: number;
        thickness: number;
        pivotY: number;
        pivotZ: number;
        lidAngleDeg: number;
        basePivotAngleRad: number;
    };
    keyboardWell: {
        width: number;
        height: number;
        depth: number;
        center: { x: number; y: number };
    };
    trackpad: {
        width: number;
        height: number;
        center: { x: number; y: number };
    };
    appleLogo: {
        width: number;
        height: number;
        center: { x: number; y: number };
    };
}

export const UNIT_MACBOOK_PRO_16_METRICS: DeviceFrameMetrics = {
    bodyWidth: MACBOOK_PRO_16.body.width / MACBOOK_PRO_16.body.height,
    bodyHeight: 1,
    bodyDepth: MACBOOK_PRO_16.body.depth / MACBOOK_PRO_16.body.height,
    bodyCornerRadius: MACBOOK_PRO_16.body.cornerRadius / MACBOOK_PRO_16.body.height,
    screenWidth: MACBOOK_PRO_16.screen.width / MACBOOK_PRO_16.body.height,
    screenHeight: MACBOOK_PRO_16.screen.height / MACBOOK_PRO_16.body.height,
    cornerRadius: MACBOOK_PRO_16.screen.cornerRadius / MACBOOK_PRO_16.body.height,
    bezel: (MACBOOK_PRO_16.body.width - MACBOOK_PRO_16.screen.width) / (MACBOOK_PRO_16.body.height * 2),
};

/**
 * Calibrated dimensions and physical pivots for MacBook Pro 16" device frame.
 */
export function getMacBookProLayout(
    metrics: DeviceFrameMetrics,
    settings: DeviceFrameSettings
): MacBookProLayout {
    const lidDepth = Math.max(0.003, metrics.bodyDepth * 0.5);
    const baseLength = metrics.bodyHeight * 0.94;
    const baseThickness = Math.max(0.006, metrics.bodyDepth * 1.1);
    const hingeY = -metrics.bodyHeight / 2;
    const hingeZ = -lidDepth * 0.6;
    const lidAngleDeg = settings.lidAngle ?? 110;
    const basePivotAngleRad = ((180 - lidAngleDeg) * Math.PI) / 180;

    const notchW = metrics.screenWidth * 0.14;
    const notchH = metrics.screenHeight * 0.052;
    const notchRadius = notchH * 0.25;
    const notchY = metrics.screenHeight / 2 - notchH / 2;

    const keyboardW = metrics.bodyWidth * 0.78;
    const keyboardH = baseLength * 0.46;
    const keyboardY = -baseLength * 0.22;

    const trackpadW = metrics.bodyWidth * 0.38;
    const trackpadH = baseLength * 0.32;
    const trackpadY = -baseLength * 0.66;

    return {
        lid: {
            width: metrics.bodyWidth,
            height: metrics.bodyHeight,
            depth: lidDepth,
            cornerRadius: metrics.bodyCornerRadius,
            bezelDepth: lidDepth * 0.25,
            bezelZ: SCREEN_PLANE_Z - 0.0005,
            glassZ: SCREEN_PLANE_Z + 0.0003,
        },
        screen: {
            width: metrics.screenWidth,
            height: metrics.screenHeight,
            cornerRadius: metrics.cornerRadius,
        },
        notch: {
            width: notchW,
            height: notchH,
            radius: notchRadius,
            center: { x: 0, y: notchY },
        },
        base: {
            width: metrics.bodyWidth,
            length: baseLength,
            thickness: baseThickness,
            pivotY: hingeY,
            pivotZ: hingeZ,
            lidAngleDeg,
            basePivotAngleRad,
        },
        keyboardWell: {
            width: keyboardW,
            height: keyboardH,
            depth: baseThickness * 0.12,
            center: { x: 0, y: keyboardY },
        },
        trackpad: {
            width: trackpadW,
            height: trackpadH,
            center: { x: 0, y: trackpadY },
        },
        appleLogo: {
            width: metrics.bodyWidth * 0.12,
            height: metrics.bodyHeight * 0.12,
            center: { x: 0, y: 0 },
        },
    };
}

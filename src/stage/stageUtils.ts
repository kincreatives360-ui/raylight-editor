// src/stage/stageUtils.ts
import type { AspectRatio, CameraKeyframeEndpoint } from '../model/types';
import type { EvaluatedLayerWithEffects } from '../engine/evaluateShot';

export interface FramingBox {
    left: number;
    top: number;
    width: number;
    height: number;
    cx: number;
    cy: number;
}

export function computeFramingBox(
    ep: CameraKeyframeEndpoint | { anchorX?: number; anchorY?: number; zoom: number },
    frameWidth: number,
    frameHeight: number,
    artboardWidth: number = 1920,
    artboardHeight: number = 1080
): FramingBox {
    const safeZoom = Math.max(0.15, ep.zoom);
    const width = frameWidth / safeZoom;
    const height = frameHeight / safeZoom;
    const scaleX = frameWidth / artboardWidth;
    const scaleY = frameHeight / artboardHeight;
    const cx = frameWidth / 2 + (ep.anchorX ?? 0) * scaleX;
    const cy = frameHeight / 2 - (ep.anchorY ?? 0) * scaleY; // world Y is up, DOM Y is down
    return {
        left: cx - width / 2,
        top: cy - height / 2,
        width,
        height,
        cx,
        cy,
    };
}

export const ASPECT_RATIO_CONFIG: Record<
    AspectRatio,
    { widthRatio: number; heightRatio: number; label: string }
> = {
    '16:9': { widthRatio: 16, heightRatio: 9, label: '16:9 Widescreen' },
    '4:3': { widthRatio: 4, heightRatio: 3, label: '4:3 Classic' },
    '3:2': { widthRatio: 3, heightRatio: 2, label: '3:2 Presentation' },
    '21:9': { widthRatio: 21, heightRatio: 9, label: '21:9 Ultrawide' },
    '1:1': { widthRatio: 1, heightRatio: 1, label: '1:1 Square' },
    '9:16': { widthRatio: 9, heightRatio: 16, label: '9:16 Vertical' },
    '3:4': { widthRatio: 3, heightRatio: 4, label: '3:4 Portrait' },
    '2:3': { widthRatio: 2, heightRatio: 3, label: '2:3 Social' },
    '4:5': { widthRatio: 4, heightRatio: 5, label: '4:5 Feed' },
};

export function getArtboardDimensions(
    aspectRatio: AspectRatio = '16:9'
): { width: number; height: number } {
    const spec = ASPECT_RATIO_CONFIG[aspectRatio] ?? ASPECT_RATIO_CONFIG['16:9'];
    const aspect = spec.widthRatio / spec.heightRatio;

    if (aspect >= 1) {
        const width = 1920;
        const height = Math.round(width / aspect / 2) * 2;
        return { width, height };
    }
    const height = 1920;
    const width = Math.round((height * aspect) / 2) * 2;
    return { width, height };
}


export interface SnapGuideLine {
    axis: 'x' | 'y'; // 'x' = vertical line at a fractional X, 'y' = horizontal line at a fractional Y
    positionFrac: number; // -0.5 to 0.5
    label: string;
}

export interface SnapCalculationResult {
    snappedX: number;
    snappedY: number;
    guides: SnapGuideLine[];
}

// Calculates magnetic snapping against Stage Center (0, 0), Safe Margins (-0.45, 0.45),
// and the Center / Edges of all other unselected visible layers.
export function computeSmartSnap(
    rawX: number,
    rawY: number,
    widthFrac: number,
    heightFrac: number,
    otherLayers: EvaluatedLayerWithEffects[],
    thresholdFrac = 0.012
): SnapCalculationResult {
    let snappedX = rawX;
    let snappedY = rawY;
    const guides: SnapGuideLine[] = [];

    const halfW = widthFrac / 2;
    const halfH = heightFrac / 2;

    // Candidate X targets (Center 0, plus other layers' centers and edges)
    const xCandidates: { targetX: number; guideX: number; label: string }[] = [
        { targetX: 0, guideX: 0, label: 'Stage Center X' },
        { targetX: -0.45 + halfW, guideX: -0.45, label: 'Left Safe Margin' },
        { targetX: 0.45 - halfW, guideX: 0.45, label: 'Right Safe Margin' },
    ];

    // Candidate Y targets (Center 0, plus other layers' centers and edges)
    const yCandidates: { targetY: number; guideY: number; label: string }[] = [
        { targetY: 0, guideY: 0, label: 'Stage Center Y' },
        { targetY: -0.45 + halfH, guideY: -0.45, label: 'Top Safe Margin' },
        { targetY: 0.45 - halfH, guideY: 0.45, label: 'Bottom Safe Margin' },
    ];

    for (const other of otherLayers) {
        if (!other.visible) continue;
        const ox = other.position.x;
        const oy = other.position.y;
        const oHalfW = other.size.width / 2;
        const oHalfH = other.size.height / 2;

        // Center-to-center alignment
        xCandidates.push({
            targetX: ox,
            guideX: ox,
            label: `Center (${other.name})`,
        });
        // Left-edge to Left-edge alignment
        xCandidates.push({
            targetX: ox - oHalfW + halfW,
            guideX: ox - oHalfW,
            label: 'Align Left',
        });
        // Right-edge to Right-edge alignment
        xCandidates.push({
            targetX: ox + oHalfW - halfW,
            guideX: ox + oHalfW,
            label: 'Align Right',
        });

        // Vertical center-to-center alignment
        yCandidates.push({
            targetY: oy,
            guideY: oy,
            label: `Middle (${other.name})`,
        });
        // Top-edge to Top-edge alignment
        yCandidates.push({
            targetY: oy - oHalfH + halfH,
            guideY: oy - oHalfH,
            label: 'Align Top',
        });
        // Bottom-edge to Bottom-edge alignment
        yCandidates.push({
            targetY: oy + oHalfH - halfH,
            guideY: oy + oHalfH,
            label: 'Align Bottom',
        });
    }

    // Find closest X snap within threshold
    let bestDx = thresholdFrac;
    let matchedXGuide: SnapGuideLine | null = null;
    for (const cand of xCandidates) {
        const dist = Math.abs(rawX - cand.targetX);
        if (dist < bestDx) {
            bestDx = dist;
            snappedX = cand.targetX;
            matchedXGuide = {
                axis: 'x',
                positionFrac: cand.guideX,
                label: cand.label,
            };
        }
    }
    if (matchedXGuide) guides.push(matchedXGuide);

    // Find closest Y snap within threshold
    let bestDy = thresholdFrac;
    let matchedYGuide: SnapGuideLine | null = null;
    for (const cand of yCandidates) {
        const dist = Math.abs(rawY - cand.targetY);
        if (dist < bestDy) {
            bestDy = dist;
            snappedY = cand.targetY;
            matchedYGuide = {
                axis: 'y',
                positionFrac: cand.guideY,
                label: cand.label,
            };
        }
    }
    if (matchedYGuide) guides.push(matchedYGuide);

    return {
        snappedX: Number(snappedX.toFixed(4)),
        snappedY: Number(snappedY.toFixed(4)),
        guides,
    };
}


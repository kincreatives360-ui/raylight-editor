// src/stage/stageUtils.ts
import type { AspectRatio } from '../model/types';
import type { EvaluatedLayerWithEffects } from '../engine/evaluateShot';

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

export function kelvinToRgb(
    kelvin: number,
    alpha = 1
): { r: number; g: number; b: number; css: string } {
    const temp = Math.max(1000, Math.min(15000, kelvin)) / 100;
    let r: number;
    let g: number;
    let b: number;

    if (temp <= 66) {
        r = 255;
        g = 99.4708025861 * Math.log(temp) - 161.1195681661;
        b =
            temp <= 19
                ? 0
                : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
        r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
        b = 255;
    }

    const clampByte = (n: number) => Math.round(Math.max(0, Math.min(255, n)));
    const rByte = clampByte(r);
    const gByte = clampByte(g);
    const bByte = clampByte(b);

    return {
        r: rByte,
        g: gByte,
        b: bByte,
        css: `rgba(${rByte}, ${gByte}, ${bByte}, ${alpha})`,
    };
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

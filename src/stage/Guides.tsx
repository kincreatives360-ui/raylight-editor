// src/stage/Guides.tsx
import React from 'react';
import type { EvaluatedLayerWithEffects } from '../engine/evaluateShot';

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

interface GuidesProps {
    guides: SnapGuideLine[];
    showSafeArea: boolean;
    frameWidth: number;
    frameHeight: number;
    cameraZoom: number;
    cameraTargetX: number;
    cameraTargetY: number;
}

export const Guides: React.FC<GuidesProps> = ({
    guides,
    showSafeArea,
    frameWidth,
    frameHeight,
    cameraZoom,
    cameraTargetX,
    cameraTargetY,
}) => {
    const camOffsetX = -cameraTargetX * frameWidth * cameraZoom;
    const camOffsetY = -cameraTargetY * frameHeight * cameraZoom;

    return (
        <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
            {/* 90% Action Safe Area Box */}
            {showSafeArea && (
                <div className="absolute inset-[5%] border border-dashed border-white/10 rounded flex items-center justify-center">
                    <div className="w-3 h-px bg-white/20 absolute" />
                    <div className="h-3 w-px bg-white/20 absolute" />
                </div>
            )}

            {/* Active Magenta Smart-Snap Alignment Lines */}
            {guides.map((g, idx) => {
                if (g.axis === 'x') {
                    const screenX =
                        frameWidth / 2 + g.positionFrac * frameWidth * cameraZoom + camOffsetX;
                    return (
                        <div
                            key={`x-${idx}`}
                            className="absolute top-0 bottom-0 w-px bg-fuchsia-500 shadow-[0_0_8px_#d946ef]"
                            style={{ left: `${screenX}px` }}
                        >
                            <span className="absolute top-2 left-1.5 px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[9px] font-mono whitespace-nowrap shadow">
                                {g.label}
                            </span>
                        </div>
                    );
                }

                const screenY =
                    frameHeight / 2 + g.positionFrac * frameHeight * cameraZoom + camOffsetY;
                return (
                    <div
                        key={`y-${idx}`}
                        className="absolute left-0 right-0 h-px bg-fuchsia-500 shadow-[0_0_8px_#d946ef]"
                        style={{ top: `${screenY}px` }}
                    >
                        <span className="absolute left-2 -top-5 px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[9px] font-mono whitespace-nowrap shadow">
                            {g.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
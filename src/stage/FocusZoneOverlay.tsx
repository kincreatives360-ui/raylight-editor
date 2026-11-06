// src/stage/FocusZoneOverlay.tsx
import React, { useMemo } from 'react';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { useSelectionStore } from '../store/useSelectionStore';
import { Crosshair } from 'lucide-react';

interface FocusZoneOverlayProps {
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
}

export const FocusZoneOverlay: React.FC<FocusZoneOverlayProps> = ({
    frame,
    frameWidth,
    frameHeight,
}) => {
    const focusZonePreview = useSelectionStore((s) => s.focusZonePreview);
    const dof = frame.activeShot?.effects?.depthOfField;

    const isVisible = focusZonePreview && Boolean(dof?.enabled);

    const info = useMemo(() => {
        if (!isVisible || !dof) return null;

        const focusDist = dof.focusDistance ?? 2.65;
        const aperture = dof.aperture ?? 2.8;
        const shape = dof.bokehShape ?? 'spherical';

        // Project target coordinates to viewport if focus on a point
        let targetScreen: { x: number; y: number } | null = null;
        if (!dof.focusAssetId && dof.target) {
            // Normalized target mapping to screen center offset
            const cx = frameWidth * 0.5 + (dof.target.x / 10) * (frameWidth * 0.4);
            const cy = frameHeight * 0.5 - (dof.target.y / 10) * (frameHeight * 0.4);
            targetScreen = {
                x: Math.max(20, Math.min(frameWidth - 20, cx)),
                y: Math.max(20, Math.min(frameHeight - 20, cy)),
            };
        }

        return {
            focusDist,
            aperture,
            shape,
            targetScreen,
            focusAssetId: dof.focusAssetId,
        };
    }, [isVisible, dof, frameWidth, frameHeight]);

    if (!isVisible || !info) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden" data-testid="focus-zone-overlay">
            {/* Visual focus plane indicator frame */}
            <div className="absolute inset-2 rounded-lg border border-emerald-400/40 shadow-[inset_0_0_12px_rgba(52,211,153,0.15)] transition-opacity duration-200" />

            {/* Target Reticle if focused on point */}
            {info.targetScreen && (
                <div
                    className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    style={{ left: `${info.targetScreen.x}px`, top: `${info.targetScreen.y}px` }}
                >
                    <Crosshair className="w-6 h-6 animate-pulse" />
                    <span className="absolute top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 whitespace-nowrap">
                        Focus Target
                    </span>
                </div>
            )}

            {/* Top-Right HUD Badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-xs border border-emerald-500/40 text-[10px] text-emerald-300 font-medium tracking-wide shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Focus Plane: {info.focusDist.toFixed(2)}m</span>
                <span className="text-white/40">|</span>
                <span>f/{info.aperture.toFixed(1)}</span>
                <span className="text-white/40">|</span>
                <span>{info.shape.charAt(0).toUpperCase() + info.shape.slice(1)}</span>
            </div>
        </div>
    );
};

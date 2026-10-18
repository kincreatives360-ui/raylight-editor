// src/stage/Guides.tsx
import React from 'react';
import type { SnapGuideLine } from './stageUtils';

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
            {/* Safe Area & Grid Guides */}
            {showSafeArea && (
                <>
                    {/* 90% Action Safe Area Box */}
                    <div className="absolute inset-[5%] border border-dashed border-white/10 rounded flex items-center justify-center pointer-events-none">
                        <div className="w-3 h-px bg-white/20 absolute" />
                        <div className="h-3 w-px bg-white/20 absolute" />
                    </div>

                    {/* Rule of Thirds Grid */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        <div className="border-r border-b border-white/[0.04]" />
                        <div className="border-r border-b border-white/[0.04]" />
                        <div className="border-b border-white/[0.04]" />
                        <div className="border-r border-b border-white/[0.04]" />
                        <div className="border-r border-b border-white/[0.04]" />
                        <div className="border-b border-white/[0.04]" />
                        <div className="border-r border-white/[0.04]" />
                        <div className="border-r border-white/[0.04]" />
                        <div />
                    </div>

                    {/* Social Safe Zone Overlay for 9:16 Vertical Video (TikTok / Reels / Shorts) */}
                    {frameWidth < frameHeight && (
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Top header margin */}
                            <div className="absolute top-0 inset-x-0 h-[12%] bg-black/20 border-b border-dashed border-[#0088ff]/40 flex items-center justify-center">
                                <span className="text-[10px] font-mono tabular-nums text-[#38bdf8]/80 uppercase tracking-wider">
                                    Header Safe Zone
                                </span>
                            </div>
                            {/* Bottom caption margin */}
                            <div className="absolute bottom-0 inset-x-0 h-[22%] bg-black/20 border-t border-dashed border-[#0088ff]/40 flex items-center justify-center">
                                <span className="text-[10px] font-mono tabular-nums text-[#38bdf8]/80 uppercase tracking-wider">
                                    Caption &amp; Sound Zone
                                </span>
                            </div>
                            {/* Right action icons margin */}
                            <div className="absolute top-[12%] bottom-[22%] right-0 w-[18%] bg-black/20 border-l border-dashed border-[#0088ff]/40 flex items-center justify-center">
                                <span className="text-[10px] font-mono tabular-nums text-[#38bdf8]/80 rotate-90 uppercase tracking-wider">
                                    UI Buttons
                                </span>
                            </div>
                        </div>
                    )}
                </>
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
                            <span className="absolute top-2 left-1.5 px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-sm">
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
                        <span className="absolute left-2 -top-5 px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-mono tabular-nums whitespace-nowrap shadow-sm">
                            {g.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
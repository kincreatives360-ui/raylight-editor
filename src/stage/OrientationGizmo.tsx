import { IconButton } from '../ui/primitives';
import { ShortcutKey } from '../ui/ShortcutKey';
// src/stage/OrientationGizmo.tsx
import React, { useState } from 'react';
import { RotateCcw, Focus, ChevronDown, ChevronUp } from 'lucide-react';
import { radToDeg } from '../model/defaults';
import { CAMERA_ANGLE_VIEWS } from './cameraAngleViews';

interface OrientationGizmoProps {
    cameraRotation: { x: number; y: number; z: number };
    onSetOrientation: (orbitDeg: number, tiltDeg: number, rollDeg?: number, zoom?: number) => void;
    onResetCamera: () => void;
    onFrameSelection?: () => void;
    hasSelection?: boolean;
    currentZoom?: number;
    topInset?: number;
}

export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
    cameraRotation,
    onSetOrientation,
    onResetCamera,
    onFrameSelection,
    hasSelection = false,
    currentZoom = 1,
    topInset = 12,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // Current angles in degrees for tooltip / readout
    const pitchDeg = Math.round(radToDeg(cameraRotation.x));
    const yawDeg = Math.round(radToDeg(cameraRotation.y));
    const cubeFaces = [
        { id: 'front', transform: 'translateZ(18px)' },
        { id: 'back', transform: 'rotateY(180deg) translateZ(18px)' },
        { id: 'right', transform: 'rotateY(90deg) translateZ(18px)' },
        { id: 'left', transform: 'rotateY(-90deg) translateZ(18px)' },
        { id: 'top', transform: 'rotateX(90deg) translateZ(18px)' },
        { id: 'bottom', transform: 'rotateX(-90deg) translateZ(18px)' },
    ] as const;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 z-35 flex flex-col items-center gap-1.5 select-none"
            style={{ top: topInset }}
        >
            <div
                role="group"
                aria-label="Camera orientation"
                className="relative flex h-16 w-16 items-center justify-center [perspective:160px]"
            >
                <div
                    className="relative h-9 w-9 [transform-style:preserve-3d] transition-transform duration-200"
                    style={{ transform: `rotateX(${-pitchDeg}deg) rotateY(${yawDeg}deg)` }}
                >
                    {cubeFaces.map((face) => {
                        const view = CAMERA_ANGLE_VIEWS.find(({ id }) => id === face.id)!;
                        return (
                            <button
                                key={face.id}
                                type="button"
                                tabIndex={0}
                                aria-label={`${view.label} view`}
                                title={`${view.label} view`}
                                onClick={() => onSetOrientation(view.orbit, view.tilt, view.roll)}
                                className="absolute inset-0 flex items-center justify-center rounded-md border border-white/25 bg-slate-800/90 text-[9px] font-semibold text-slate-100 shadow-sm transition-colors hover:bg-sky-700/90 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
                                style={{ transform: face.transform, backfaceVisibility: 'hidden' }}
                            >
                                {view.label.slice(0, 1)}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        tabIndex={0}
                        aria-label="Perspective view"
                        title="Perspective view"
                        onClick={() => {
                            const view = CAMERA_ANGLE_VIEWS.find(({ id }) => id === 'isometric')!;
                            onSetOrientation(view.orbit, view.tilt, view.roll);
                        }}
                        className="absolute left-1/2 top-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300/70 bg-sky-600 text-[8px] font-bold text-white shadow-md transition-colors hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                        P
                    </button>
                </div>
            </div>

            {/* Reset and quick-view controls */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={onResetCamera}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Reset Camera Pose to Default"
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface/90 hover:bg-muted border border-subtle hover:border-medium text-muted-foreground hover:text-foreground text-[11px] font-mono cursor-pointer transition shadow-xs"
                >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                </button>

                {/* Screen settings trigger for presets and framing */}
                <IconButton
                    unstyled
                    tooltip={false}
                    label="Angle menu"
                    icon={<>
                        {menuOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}

                    </>}
                    onClick={() => setMenuOpen((prev) => !prev)}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Angle"
                    className={`p-1 rounded-full bg-surface/90 hover:bg-muted border border-subtle text-muted-foreground hover:text-foreground cursor-pointer transition shadow-xs ${
                        menuOpen ? 'bg-white/20 text-white' : ''
                    }`}
                />
            </div>

            {/* Hidden-by-default Screen Settings Popover (Keeps canvas clean) */}
            <div
                role="group"
                aria-label="Quick views"
                className={`flex max-h-[min(70vh,24rem)] w-44 flex-col gap-1.5 overflow-y-auto overscroll-contain p-2 rounded-xl bg-surface/95 backdrop-blur-xl border border-subtle shadow-2xl z-40 text-left pointer-events-auto select-none transition-all duration-150 ${
                    menuOpen ? 'opacity-100 translate-y-0 scale-100' : 'hidden'
                }`}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="text-[11px] font-semibold text-disabled uppercase tracking-wider px-1">
                    Quick Views
                </div>
                <div className="grid grid-cols-2 gap-1">
                    {CAMERA_ANGLE_VIEWS.map((view) => (
                        <button
                            key={view.id}
                            type="button"
                            onClick={() => { onSetOrientation(view.orbit, view.tilt, view.roll); setMenuOpen(false); }}
                            className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition text-left ${
                                view.id === 'isometric'
                                    ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300'
                                    : 'bg-white/[0.05] hover:bg-white/10 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>

                {onFrameSelection && (
                    <button
                        type="button"
                        onClick={() => { onFrameSelection(); setMenuOpen(false); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="mt-1 w-full flex items-center justify-between px-2 py-1 rounded bg-white/[0.05] hover:bg-white/10 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition"
                    >
                        <span className="flex items-center gap-1.5">
                            <Focus className="w-3 h-3 text-sky-400" />
                            <span>{hasSelection ? 'Frame Selection' : 'Frame Scene'}</span>
                        </span>
                        <ShortcutKey className="text-[10px] text-disabled font-mono">F</ShortcutKey>
                    </button>
                )}
            </div>

            {/* Readout pill stays hidden until the orientation HUD is hovered */}
            <div className={`px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-subtle text-[11px] font-mono tabular-nums text-muted-foreground tracking-tight pointer-events-none transition-opacity duration-150 ${
                isHovered ? 'opacity-100' : 'opacity-0'
            }`}>
                {yawDeg}° / {pitchDeg}° • {Number(currentZoom.toFixed(2))}x
            </div>
        </div>
    );
};

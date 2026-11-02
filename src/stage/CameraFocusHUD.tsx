import React from 'react';
import type { EvaluatedCameraOptics } from '../engine/evaluateCameraOptics';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { Focus, Eye } from 'lucide-react';

interface CameraFocusHUDProps {
  optics?: EvaluatedCameraOptics;
  shotId?: string;
}

export const CameraFocusHUD: React.FC<CameraFocusHUDProps> = ({ optics, shotId }) => {
  const { activeTool } = useSelectionStore();
  const { updateShot } = useProjectStore();

  if (!optics || (!optics.enabled && activeTool !== 'focus')) {
    return null;
  }

  const toggleFocusPlane = () => {
    if (!shotId) return;
    updateShot(shotId, (s) => ({
      ...s,
      cameraOptics: {
        ...s.cameraOptics!,
        enabled: true,
        showFocusPlane: !s.cameraOptics?.showFocusPlane,
      },
    }));
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-[#00e5ff]/40 text-white shadow-2xl animate-fade-in select-none">
      <div className="flex items-center gap-1.5 text-[#00e5ff] font-mono text-[11px] font-semibold">
        <Focus className="w-3.5 h-3.5 text-[#00e5ff] animate-pulse" />
        <span>Focus: {optics.resolvedFocusDistance.toFixed(2)}m</span>
      </div>

      <div className="h-3 w-px bg-white/20" />

      <div className="text-[10px] text-white/70 font-mono">
        f/{optics.aperture.toFixed(1)} · {optics.focalLength}mm
      </div>

      <div className="h-3 w-px bg-white/20" />

      <div className="text-[10px] text-white/50 font-mono">
        DoF: {optics.nearFocusDistance.toFixed(2)}m – {optics.farFocusDistance.toFixed(2)}m
      </div>

      <button
        type="button"
        onClick={toggleFocusPlane}
        className={`ml-1 p-1 rounded-md transition-colors cursor-pointer ${
          optics.showFocusPlane
            ? 'bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40'
            : 'text-white/40 hover:text-white hover:bg-white/10'
        }`}
        title={optics.showFocusPlane ? 'Hide Focus Plane Guide' : 'Show Focus Plane Guide'}
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

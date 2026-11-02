import React from 'react';
import type { Shot } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { Switch } from '../../../ui/primitives';
import { ScrubInput } from '../../../ui/ScrubInput';
import {
  type CameraOptics,
  DEFAULT_CAMERA_OPTICS,
  F_STOP_PRESETS,
  FOCAL_LENGTH_PRESETS,
  type FocusMode,
  type SensorFormat,
  type BokehQuality,
  type BokehShape,
} from '../../../model/cameraOpticsTypes';

interface CameraOpticsSectionProps {
  shot: Shot;
}

export const CameraOpticsSection: React.FC<CameraOpticsSectionProps> = ({ shot }) => {
  const { updateShot } = useProjectStore();

  const optics: CameraOptics = shot.cameraOptics
    ? { ...DEFAULT_CAMERA_OPTICS, ...shot.cameraOptics }
    : { ...DEFAULT_CAMERA_OPTICS };

  const setOptics = (updater: (prev: CameraOptics) => CameraOptics) => {
    updateShot(shot.id, (s) => ({
      ...s,
      cameraOptics: updater(s.cameraOptics ? { ...DEFAULT_CAMERA_OPTICS, ...s.cameraOptics } : { ...DEFAULT_CAMERA_OPTICS }),
    }));
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[.04em]">
            Camera Optics (DOF)
          </span>
        </div>
        <Switch
          ariaLabel="Enable Depth of Field"
          checked={optics.enabled}
          onChange={(enabled) => setOptics((prev) => ({ ...prev, enabled }))}
        />
      </div>

      {optics.enabled && (
        <div className="space-y-3.5 pl-1 border-l-2 border-brand-blue/30 ml-0.5">
          {/* Focal Length Lens Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>Lens Focal Length</span>
              <span className="font-mono text-foreground">{optics.focalLength} mm</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {FOCAL_LENGTH_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setOptics((prev) => ({ ...prev, focalLength: preset.value }))}
                  className={`py-1 text-[10px] font-mono rounded transition border ${
                    optics.focalLength === preset.value
                      ? 'bg-brand-blue text-white border-brand-blue font-semibold'
                      : 'bg-surface border-subtle text-muted-foreground hover:bg-subtle hover:text-foreground'
                  }`}
                >
                  {preset.value}m
                </button>
              ))}
            </div>
          </div>

          {/* Aperture (f-stop) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>Aperture (f-stop)</span>
              <span className="font-mono text-foreground">f/{optics.aperture.toFixed(1)}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {F_STOP_PRESETS.map((fstop) => (
                <button
                  key={fstop}
                  type="button"
                  onClick={() => setOptics((prev) => ({ ...prev, aperture: fstop }))}
                  className={`py-1 text-[10px] font-mono rounded transition border ${
                    Math.abs(optics.aperture - fstop) < 0.1
                      ? 'bg-brand-blue text-white border-brand-blue font-semibold'
                      : 'bg-surface border-subtle text-muted-foreground hover:bg-subtle hover:text-foreground'
                  }`}
                >
                  f/{fstop}
                </button>
              ))}
            </div>
          </div>

          {/* Focus Mode & Target */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>Focus Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-surface border border-subtle">
              {(['manual', 'target'] as FocusMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOptics((prev) => ({ ...prev, focusMode: mode }))}
                  className={`py-1 text-[11px] capitalize rounded transition font-medium ${
                    optics.focusMode === mode
                      ? 'bg-muted text-foreground shadow-sm'
                      : 'text-disabled hover:text-foreground'
                  }`}
                >
                  {mode === 'target' ? 'Subject Target' : 'Manual Distance'}
                </button>
              ))}
            </div>

            {optics.focusMode === 'target' ? (
              <div className="space-y-1 pt-1">
                <label className="text-[10px] text-muted-foreground block font-medium">Focus Target Subject</label>
                <div className="flex gap-1.5">
                  <select
                    value={optics.targetObjectId || ''}
                    onChange={(e) => setOptics((prev) => ({ ...prev, targetObjectId: e.target.value || undefined }))}
                    className="flex-1 h-7 px-2 rounded bg-surface border border-subtle text-[11px] text-foreground outline-none focus:border-brand-blue font-mono"
                  >
                    <option value="">-- Choose Layer --</option>
                    {shot.layers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {optics.targetObjectId && (
                    <button
                      type="button"
                      onClick={() => setOptics((prev) => ({ ...prev, targetObjectId: undefined, focusMode: 'manual' }))}
                      className="px-2 h-7 rounded bg-surface hover:bg-subtle border border-subtle text-[10px] text-muted-foreground hover:text-foreground transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <ScrubInput
                  label="Focus Distance"
                  value={optics.focusDistance}
                  onChange={(val) => setOptics((prev) => ({ ...prev, focusDistance: Math.max(0.1, Number(val.toFixed(2))) }))}
                  min={0.1}
                  max={20}
                  step={0.05}
                  unit="m"
                />
              </div>
            )}
          </div>

          {/* Show Focus Plane Guide Toggle */}
          <div className="flex items-center justify-between py-1 border-t border-subtle/50 pt-2">
            <span className="text-[10px] font-medium text-foreground">Show Focus Plane Guide</span>
            <Switch
              ariaLabel="Show Focus Plane Guide"
              checked={optics.showFocusPlane}
              onChange={(showFocusPlane) => setOptics((prev) => ({ ...prev, showFocusPlane }))}
            />
          </div>

          {/* Optical Advanced (Sensor & Bokeh Shape) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-subtle/50">
            <div>
              <label className="text-[9px] text-muted-foreground block font-medium uppercase mb-0.5">Sensor Format</label>
              <select
                value={optics.sensorFormat}
                onChange={(e) => setOptics((prev) => ({ ...prev, sensorFormat: e.target.value as SensorFormat }))}
                className="w-full h-6 px-1.5 rounded bg-surface border border-subtle text-[10px] text-foreground outline-none"
              >
                <option value="full-frame">Full Frame (35mm)</option>
                <option value="super-35">Super 35</option>
                <option value="micro-four-thirds">Micro 4/3</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground block font-medium uppercase mb-0.5">Bokeh Shape</label>
              <select
                value={optics.bokehShape}
                onChange={(e) => setOptics((prev) => ({ ...prev, bokehShape: e.target.value as BokehShape }))}
                className="w-full h-6 px-1.5 rounded bg-surface border border-subtle text-[10px] text-foreground outline-none capitalize"
              >
                <option value="circular">Circular</option>
                <option value="bladed">Bladed</option>
                <option value="anamorphic">Anamorphic</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

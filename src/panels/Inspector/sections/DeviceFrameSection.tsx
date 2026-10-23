import React from 'react';
import { ColorField } from '../ColorPicker';
import { ScrubInput } from '../../../ui/ScrubInput';
import type { DeviceFrameSettings, ImageLayer, VideoLayer } from '../../../model/types';
import {
  DEFAULT_DEVICE_FRAME_SETTINGS,
  isFixedDeviceFrame,
  resolveDeviceFrameSettings,
  upgradeDeviceFrameSettings,
  SUPPORTED_DEVICES,
} from '../../../model/deviceFrame';

interface DeviceFrameSectionProps {
  layer: ImageLayer | VideoLayer;
  onChange: (settings: DeviceFrameSettings) => void;
  projectAspect: number;
}

export const DeviceFrameSection: React.FC<DeviceFrameSectionProps> = ({ layer, onChange, projectAspect }) => {
  const settings = resolveDeviceFrameSettings(layer.deviceFrame ?? DEFAULT_DEVICE_FRAME_SETTINGS);
  const fixed = isFixedDeviceFrame(settings);
  const update = (patch: Partial<DeviceFrameSettings>) => onChange({ ...settings, ...patch });

  return (
    <section className="px-3.5 py-3 space-y-2.5 border-y border-white/[0.06]">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="flex items-center gap-2 text-[11px] font-medium text-[#e4e4e7]">
          <span className="w-5 h-5 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-center text-[12px] text-[#b8b8b5]">▱</span>
          Device frame
        </span>
        <input
          type="checkbox"
          aria-label="Enable device frame"
          checked={settings.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
          className="w-3.5 h-3.5 rounded accent-[#0088ff] cursor-pointer"
        />
      </label>

      {settings.enabled && (
        <>
          {!fixed && (
            <div className="text-[10px] text-[#a1a1aa] space-y-1.5">
              <p>Legacy layout retained for this frame.</p>
              <button
                type="button"
                className="text-[#0088ff] cursor-pointer"
                onClick={() =>
                  onChange(
                    upgradeDeviceFrameSettings(
                      settings,
                      layer.size.width * projectAspect,
                      layer.size.height,
                      layer.scale
                    )
                  )
                }
              >
                Use calibrated 3D hardware proportions
              </button>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <label className="text-[10px] text-[#a1a1aa] space-y-1">
              <span className="block">Hardware Model</span>
              <select
                aria-label="Device model"
                value={fixed ? (settings.deviceId || 'iphone-15-pro') : settings.model}
                onChange={(event) => {
                  const val = event.target.value;
                  if (fixed) {
                    update({ deviceId: val });
                  } else {
                    update({ model: val as DeviceFrameSettings['model'] });
                  }
                }}
                className="w-full h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff] cursor-pointer"
              >
                {fixed ? (
                  <>
                    <optgroup label="Phones" className="bg-[#18181b] text-white font-medium">
                      <option value="iphone-15-pro">{SUPPORTED_DEVICES['iphone-15-pro'].name}</option>
                      <option value="android-flagship">{SUPPORTED_DEVICES['android-flagship'].name}</option>
                    </optgroup>
                    <optgroup label="Laptops & Tablets" className="bg-[#18181b] text-white font-medium">
                      <option value="macbook-pro-16">{SUPPORTED_DEVICES['macbook-pro-16'].name}</option>
                      <option value="ipad-pro-13">{SUPPORTED_DEVICES['ipad-pro-13'].name}</option>
                    </optgroup>
                    <optgroup label="Displays" className="bg-[#18181b] text-white font-medium">
                      <option value="studio-display-27">{SUPPORTED_DEVICES['studio-display-27'].name}</option>
                    </optgroup>
                  </>
                ) : (
                  <>
                    <option value="iphone-pro">iPhone Pro (legacy)</option>
                    <option value="iphone">iPhone (legacy)</option>
                    <option value="iphone-classic">iPhone Classic (legacy)</option>
                  </>
                )}
              </select>
            </label>
            <div className="space-y-1">
              <span className="block text-[10px] text-[#a1a1aa]">Chassis</span>
              <ColorField
                value={settings.frameColor}
                aria-label="Device frame color"
                onChange={(event) => update({ frameColor: event.target.value })}
                className="w-8 h-7 rounded-md border border-white/10 cursor-pointer"
              />
            </div>
          </div>

          {/* Scale & Bezel */}
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label={fixed ? 'Scale' : 'Rim scale'}
              value={Math.round((fixed ? settings.deviceScale ?? 1 : settings.scale) * 100)}
              min={65}
              max={200}
              step={1}
              unit="%"
              onChange={(value) => update(fixed ? { deviceScale: value / 100 } : { scale: value / 100 })}
              className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
            />
            {!fixed && (
              <ScrubInput
                label="Bezel"
                value={Math.round(settings.bezelWidth * 1000)}
                min={10}
                max={200}
                step={1}
                unit="‰"
                onChange={(value) => update({ bezelWidth: value / 1000 })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
            )}
            {fixed && settings.deviceId === 'macbook-pro-16' && (
              <ScrubInput
                label="Lid Angle"
                value={settings.hingeAngleDeg ?? 105}
                min={0}
                max={135}
                step={1}
                unit="°"
                onChange={(v) => update({ hingeAngleDeg: v })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
            )}
            {fixed && settings.deviceId === 'studio-display-27' && (
              <ScrubInput
                label="Tilt"
                value={settings.tiltAngleDeg ?? 10}
                min={-15}
                max={30}
                step={1}
                unit="°"
                onChange={(v) => update({ tiltAngleDeg: v })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
            )}
          </div>

          {/* Screen Fit & Letterbox Backing */}
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <label className="grid grid-cols-[72px_1fr] gap-2 items-center text-[10px] text-[#a1a1aa]">
              <span>Screen fit</span>
              <select
                aria-label="Screen fit"
                value={settings.screenFit}
                onChange={(event) => update({ screenFit: event.target.value as DeviceFrameSettings['screenFit'] })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff] cursor-pointer"
              >
                <option value="contain">Fit (letterbox)</option>
                <option value="cover">Fill (crop edges)</option>
                <option value="stretch">Direct UV (stretch)</option>
              </select>
            </label>
            <div className="space-y-0.5">
              <ColorField
                value={settings.screenFillColor || '#050507'}
                aria-label="Screen backing color"
                onChange={(event) => update({ screenFillColor: event.target.value })}
                className="w-8 h-7 rounded-md border border-white/10 cursor-pointer"
              />
            </div>
          </div>

          {/* Interactive Screen Pan & Zoom */}
          <div className="space-y-1.5 p-2 rounded-lg bg-[#161619] border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[#e4e4e7]">Screen Viewport Framing</span>
              {((settings.screenPan?.x ?? 0) !== 0 || (settings.screenPan?.y ?? 0) !== 0 || (settings.screenZoom ?? 1) !== 1) && (
                <button
                  type="button"
                  onClick={() => update({ screenPan: { x: 0, y: 0 }, screenZoom: 1 })}
                  className="text-[9px] text-[#0088ff] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <ScrubInput
                label="Zoom"
                value={Math.round((settings.screenZoom ?? 1) * 100)}
                min={100}
                max={300}
                step={5}
                unit="%"
                onChange={(v) => update({ screenZoom: v / 100 })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
              <ScrubInput
                label="Pan X"
                value={Math.round((settings.screenPan?.x ?? 0) * 100)}
                min={-100}
                max={100}
                step={2}
                unit="%"
                onChange={(v) => update({ screenPan: { ...(settings.screenPan ?? { x: 0, y: 0 }), x: v / 100 } })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
              <ScrubInput
                label="Pan Y"
                value={Math.round((settings.screenPan?.y ?? 0) * 100)}
                min={-100}
                max={100}
                step={2}
                unit="%"
                onChange={(v) => update({ screenPan: { ...(settings.screenPan ?? { x: 0, y: 0 }), y: v / 100 } })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
            </div>
          </div>

          <details className="group rounded-lg bg-[#17171a] border border-white/[0.06]">
            <summary className="px-2.5 py-2 list-none flex items-center justify-between text-[10px] text-[#a1a1aa] cursor-pointer select-none">
              <span>Hardware &amp; Optical Details</span>
              <span className="text-[#71717a] group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <div className="px-2.5 pb-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="Metal"
                  value={Math.round(settings.frameMetalness * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ frameMetalness: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
                <ScrubInput
                  label="Matte"
                  value={Math.round(settings.frameRoughness * 100)}
                  min={4}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ frameRoughness: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="Reflection"
                  value={Math.round(settings.reflection * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ reflection: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
                <ScrubInput
                  label="Glass opacity"
                  value={Math.round(settings.glassOpacity * 100)}
                  min={0}
                  max={45}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ glassOpacity: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
              </div>

              {settings.deviceId === 'iphone-15-pro' && (
                <label className="grid grid-cols-[72px_1fr] gap-2 items-center text-[10px] text-[#a1a1aa]">
                  <span>Cutout</span>
                  <select
                    aria-label="Top cutout style"
                    value={settings.cutoutStyle}
                    onChange={(event) => update({ cutoutStyle: event.target.value as DeviceFrameSettings['cutoutStyle'] })}
                    className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff] cursor-pointer"
                  >
                    <option value="dynamic-island">Dynamic Island</option>
                    <option value="notch">Notch</option>
                    <option value="none">No cutout</option>
                  </select>
                </label>
              )}

              <label className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Physical buttons</span>
                <input
                  type="checkbox"
                  checked={settings.showSideButtons}
                  onChange={(event) => update({ showSideButtons: event.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0088ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Rear camera system</span>
                <input
                  type="checkbox"
                  checked={settings.showRearCameras}
                  onChange={(event) => update({ showRearCameras: event.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0088ff] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Studio contact shadow</span>
                <input
                  type="checkbox"
                  checked={settings.shadowEnabled}
                  onChange={(event) => update({ shadowEnabled: event.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0088ff] cursor-pointer"
                />
              </label>

              {settings.shadowEnabled && (
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label="Strength"
                    value={Math.round(settings.shadowOpacity * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(value) => update({ shadowOpacity: value / 100 })}
                    className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                  />
                  <ScrubInput
                    label="Softness"
                    value={Math.round(settings.shadowBlur * 100)}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(value) => update({ shadowBlur: value / 100 })}
                    className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                  />
                </div>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
};

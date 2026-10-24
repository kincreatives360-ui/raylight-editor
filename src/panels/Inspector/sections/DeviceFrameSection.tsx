import React from 'react';
import { ColorField } from '../ColorPicker';
import { ScrubInput } from '../../../ui/ScrubInput';
import type { DeviceFrameSettings, ImageLayer, VideoLayer } from '../../../model/types';
import {
  DEFAULT_DEVICE_FRAME_SETTINGS,
  DEVICE_FINISH_PRESETS,
  DEVICE_SPECS,
  getDeviceSpec,
  IPHONE_15_PRO,
  isFixedDeviceFrame,
  resolveDeviceFrameSettings,
  upgradeDeviceFrameSettings,
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
              <button type="button" className="text-[#0088ff] cursor-pointer" onClick={() => onChange(upgradeDeviceFrameSettings(settings, layer.size.width * projectAspect, layer.size.height, layer.scale))}>
                Use fixed phone proportions
              </button>
              <p>Retains center and body height; width changes to match the phone.</p>
            </div>
          )}
          {fixed && settings.deviceId && !DEVICE_SPECS[settings.deviceId] && (
            <p className="text-[10px] text-[#a1a1aa]">This device is unavailable. Showing {IPHONE_15_PRO.name}; the saved device ID is retained.</p>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <label className="text-[10px] text-[#a1a1aa] space-y-1">
              <span className="block">Device</span>
              <select
                aria-label="Device model"
                value={fixed ? (settings.deviceId ?? 'iphone-15-pro') : settings.model}
                onChange={(event) => {
                  if (fixed) {
                    const nextId = event.target.value;
                    const spec = getDeviceSpec(nextId);
                    update({
                      deviceId: nextId,
                      cutoutStyle: spec.defaultCutout,
                    });
                  } else {
                    update({ model: event.target.value as DeviceFrameSettings['model'] });
                  }
                }}
                className="w-full h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff]"
              >
                {fixed ? (
                  <>
                    <optgroup label="Smartphones">
                      <option value="iphone-15-pro">iPhone 15 Pro</option>
                      <option value="samsung-galaxy">Galaxy S24 Ultra</option>
                    </optgroup>
                    <optgroup label="Computers & Tablets">
                      <option value="macbook-pro">MacBook Pro</option>
                      <option value="ipad-pro">iPad Pro</option>
                      <option value="studio-display">Studio Display</option>
                    </optgroup>
                    <optgroup label="Window & UI">
                      <option value="browser">Browser Window</option>
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
              <span className="block text-[10px] text-[#a1a1aa]">Custom</span>
              <ColorField
                value={settings.frameColor}
                aria-label="Device frame color"
                onChange={(event) => update({ frameColor: event.target.value })}
                className="w-8 h-7 rounded-md border border-white/10 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-[10px] text-[#a1a1aa]">Finish presets</span>
            <div className="flex flex-wrap gap-1">
              {DEVICE_FINISH_PRESETS.map((preset) => {
                const isSelected = settings.frameColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={`${preset.name} (${preset.color})`}
                    onClick={() => update({
                      frameColor: preset.color,
                      frameMetalness: preset.metalness,
                      frameRoughness: preset.roughness,
                    })}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors border ${
                      isSelected
                        ? 'bg-white/15 text-white border-white/30 font-medium'
                        : 'bg-[#1c1c1f] text-[#a1a1aa] border-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span>{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={fixed && settings.deviceId !== 'macbook-pro' ? 'grid grid-cols-1 gap-1.5' : 'grid grid-cols-2 gap-1.5'}>
            <ScrubInput
              label={fixed ? 'Size' : 'Rim scale'}
              value={Math.round((fixed ? settings.deviceScale ?? 1 : settings.scale) * 100)}
              min={65}
              max={200}
              step={1}
              unit="%"
              onChange={(value) => update(fixed ? { deviceScale: value / 100 } : { scale: value / 100 })}
              className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
            />
            {fixed && settings.deviceId === 'macbook-pro' && (
              <ScrubInput
                label="Lid angle"
                value={Math.round(settings.lidAngle ?? 110)}
                min={70}
                max={140}
                step={1}
                unit="°"
                onChange={(value) => update({ lidAngle: value })}
                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
              />
            )}
            {!fixed && <ScrubInput
              label="Bezel"
              value={Math.round(settings.bezelWidth * 1000)}
              min={10}
              max={200}
              step={1}
              unit="‰"
              onChange={(value) => update({ bezelWidth: value / 1000 })}
              className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
            />}
          </div>

          <label className="grid grid-cols-[72px_1fr] gap-2 items-center text-[10px] text-[#a1a1aa]">
            <span>Screen fit</span>
            <select
              aria-label="Screen fit"
              value={settings.screenFit}
              onChange={(event) => update({ screenFit: event.target.value as DeviceFrameSettings['screenFit'] })}
              className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff]"
            >
              <option value="stretch">Stretch</option>
              <option value="contain">Fit</option>
              <option value="cover">Fill</option>
            </select>
          </label>

          <details className="group rounded-lg bg-[#17171a] border border-white/[0.06]">
            <summary className="px-2.5 py-2 list-none flex items-center justify-between text-[10px] text-[#a1a1aa] cursor-pointer select-none">
              <span>Frame details</span>
              <span className="text-[#71717a] group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <div className="px-2.5 pb-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {!fixed && <ScrubInput
                  label="Depth"
                  value={Math.round(settings.thickness * 1000)}
                  min={5}
                  max={160}
                  step={1}
                  unit="‰"
                  onChange={(value) => update({ thickness: value / 1000 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />}
                {!fixed && <ScrubInput
                  label="Corners"
                  value={Math.round(settings.cornerRadius * 1000)}
                  min={40}
                  max={240}
                  step={1}
                  unit="‰"
                  onChange={(value) => update({ cornerRadius: value / 1000 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />}
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
                  label="Glass"
                  value={Math.round(settings.glassOpacity * 100)}
                  min={0}
                  max={45}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ glassOpacity: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
                <ScrubInput
                  label="Polish"
                  value={Math.round(settings.glassRoughness * 100)}
                  min={2}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ glassRoughness: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
                <ScrubInput
                  label="Gloss"
                  value={Math.round(settings.gloss * 100)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => update({ gloss: value / 100 })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                />
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
              </div>

              <label className="grid grid-cols-[72px_1fr] gap-2 items-center text-[10px] text-[#a1a1aa]">
                <span>Top cutout</span>
                <select
                  aria-label="Top cutout style"
                  value={settings.cutoutStyle}
                  onChange={(event) => update({ cutoutStyle: event.target.value as DeviceFrameSettings['cutoutStyle'] })}
                  className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff]"
                >
                  <option value="dynamic-island">Dynamic Island</option>
                  <option value="notch">Notch</option>
                  <option value="punch-hole">Punch hole</option>
                  <option value="none">No cutout</option>
                </select>
              </label>

              {settings.cutoutStyle !== 'none' && settings.cutoutStyle !== 'punch-hole' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label="Cutout W"
                    value={Math.round(settings.cutoutWidth * 100)}
                    min={8}
                    max={85}
                    step={1}
                    unit="%"
                    onChange={(value) => update({ cutoutWidth: value / 100 })}
                    className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                  />
                  <ScrubInput
                    label="Cutout H"
                    value={Math.round(settings.cutoutHeight * 1000)}
                    min={15}
                    max={140}
                    step={1}
                    unit="‰"
                    onChange={(value) => update({ cutoutHeight: value / 1000 })}
                    className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                  />
                </div>
              )}

              <label className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Side buttons</span>
                <input
                  type="checkbox"
                  checked={settings.showSideButtons}
                  onChange={(event) => update({ showSideButtons: event.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0088ff]"
                />
              </label>
              <label className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Rear camera cluster</span>
                <input
                  type="checkbox"
                  checked={settings.showRearCameras}
                  onChange={(event) => update({ showRearCameras: event.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0088ff]"
                />
              </label>
              <label className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                <span>Studio shadow</span>
                <input
                  type="checkbox"
                  checked={settings.shadowEnabled}
                  onChange={(event) => update({ shadowEnabled: event.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0088ff]"
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

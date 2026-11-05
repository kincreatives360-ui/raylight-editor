import { NativeInspectorDisclosure } from '../../../ui/InspectorDisclosure';
import { CheckboxRow } from '../../../ui/CheckboxRow';
import { ChevronRight, Maximize2, Minus, PanelsTopLeft, Plus, Sun } from 'lucide-react';
import React from 'react';
import {
    DEFAULT_DEVICE_FRAME_SETTINGS,
    DEVICE_FINISH_PRESETS,
    DEVICE_SPECS,
    getDeviceSpec,
    IPHONE_15_PRO,
    isFixedDeviceFrame,
    resolveDeviceFrameSettings,
    SUPPORTED_DEVICES,
    upgradeDeviceFrameSettings,
} from '../../../model/deviceFrame';
import type { DeviceFrameSettings, ImageLayer, VideoLayer } from '../../../model/types';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { IconButton, InspectorRow } from '../../../ui/primitives';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorField } from '../ColorPicker';

interface DeviceFrameSectionProps {
    layer: ImageLayer | VideoLayer;
    onChange: (settings: DeviceFrameSettings) => void;
    projectAspect: number;
}

export const DeviceFrameSection: React.FC<DeviceFrameSectionProps> = ({ layer, onChange, projectAspect }) => {
    const settings = resolveDeviceFrameSettings(layer.deviceFrame ?? DEFAULT_DEVICE_FRAME_SETTINGS);
    const fixed = isFixedDeviceFrame(settings);
    const update = (patch: Partial<DeviceFrameSettings>) => onChange({ ...settings, ...patch });

    return (<section aria-label="Frame" className="object-design-frame">
        <div className="object-design-frame-heading"><span>Frame</span><IconButton label={settings.enabled ? 'Remove frame' : 'Add frame'} aria-label="Enable device frame" aria-pressed={settings.enabled} icon={settings.enabled ? <Minus /> : <Plus />} onClick={() => update({ enabled: !settings.enabled })} /></div>
        {settings.enabled && <div className="object-design-frame-fields">
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
            {fixed && settings.deviceId && !DEVICE_SPECS[settings.deviceId] && !SUPPORTED_DEVICES[settings.deviceId] && (
                <p className="text-[10px] text-[#a1a1aa]">This device is unavailable. Showing {IPHONE_15_PRO.name}; the saved device ID is retained.</p>
            )}


            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <label className="device-model-field text-[10px] text-[#a1a1aa] space-y-1">
                    <span className="sr-only">Hardware Model</span>
                    <FigmaSelect
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
                                    <option value="android-flagship">Android Flagship</option>
                                    <option value="samsung-galaxy">Galaxy S24 Ultra</option>
                                </optgroup>
                                <optgroup label="Computers & Tablets">
                                    <option value="macbook-pro">MacBook Pro</option>
                                    <option value="macbook-pro-16">MacBook Pro 16"</option>
                                    <option value="ipad-pro">iPad Pro</option>
                                    <option value="ipad-pro-13">iPad Pro 13"</option>
                                    <option value="studio-display">Studio Display</option>
                                    <option value="studio-display-27">Studio Display 27"</option>
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
                    </FigmaSelect>
                </label>
                <div className="space-y-1">
                    <ColorField
                        value={settings.frameColor}
                        aria-label="Device frame color"
                        onChange={(event) => update({ frameColor: event.target.value })}
                        className="w-8 h-7 rounded-md border border-white/10 cursor-pointer"
                    />
                </div>
            </div>


            <NativeInspectorDisclosure
                className="object-design-screen"
                summaryProps={{}}
                summary={<><Maximize2 /><span>Screen</span><span className="screen-fit-value">{settings.screenFit === 'stretch' ? 'Stretch' : settings.screenFit === 'contain' ? 'Fit' : 'Fill'}</span><ChevronRight /></>}
            ><div className="object-design-screen-fields">          {/* Screen Fit & Letterbox Backing */}
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <label className="grid grid-cols-[72px_1fr] gap-2 items-center text-[10px] text-[#a1a1aa]">
                        <span>Screen fit</span>
                        <FigmaSelect
                            aria-label="Screen fit"
                            value={settings.screenFit}
                            onChange={(event) => update({ screenFit: event.target.value as DeviceFrameSettings['screenFit'] })}
                            className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff] cursor-pointer"
                        >
                            <option value="contain">Fit (letterbox)</option>
                            <option value="cover">Fill (crop edges)</option>
                            <option value="stretch">Direct UV (stretch)</option>
                        </FigmaSelect>
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
                                className="text-[10px] text-[#0088ff] hover:underline cursor-pointer"
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

            </div></NativeInspectorDisclosure>
            <InspectorRow label="Gloss & reflection" stacked><div className="object-design-pair object-design-action-space"><ScrubInput label={<Sun />} aria-label="Gloss" value={Math.round(settings.gloss * 100)} min={0} max={100} unit=" %" onChange={(v) => update({ gloss: v / 100 })} /><ScrubInput label={<PanelsTopLeft />} aria-label="Reflection" value={Math.round(settings.reflection * 100)} min={0} max={100} unit=" %" onChange={(v) => update({ reflection: v / 100 })} /></div></InspectorRow>
            <NativeInspectorDisclosure
                className="group rounded-lg bg-[#17171a] border border-white/[0.06]"
                summaryProps={{"className": "px-2.5 py-2 list-none flex items-center justify-between text-[10px] text-[#a1a1aa] cursor-pointer select-none"}}
                summary={<>
                    <span>Hardware &amp; Optical Details</span>
                    <span className="text-[#71717a] group-open:rotate-180 transition-transform">⌄</span>
                </>}
            >
                <div className="px-2.5 pb-2.5 space-y-2">          <InspectorRow
                    unstyled
                    className="space-y-1"
                    labelTag="span"
                    labelClassName="block text-[10px] text-[#a1a1aa]"
                    label={<>Finish presets</>}
                >
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
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors border ${isSelected
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
                </InspectorRow>

                    <div className={fixed && settings.deviceId !== 'macbook-pro' && settings.deviceId !== 'macbook-pro-16' && settings.deviceId !== 'studio-display' && settings.deviceId !== 'studio-display-27' ? 'grid grid-cols-1 gap-1.5' : 'grid grid-cols-2 gap-1.5'}>
                        {/* Scale & Bezel */}
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
                        {fixed && (settings.deviceId === 'macbook-pro' || settings.deviceId === 'macbook-pro-16') && (
                            <ScrubInput
                                label="Lid angle"
                                value={Math.round(settings.hingeAngleDeg ?? settings.lidAngle ?? 105)}
                                min={0}
                                max={140}
                                step={1}
                                unit="°"
                                onChange={(value) => update({ lidAngle: value, hingeAngleDeg: value })}
                                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 flex items-center justify-between text-[10px]"
                            />
                        )}
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
                        {fixed && (settings.deviceId === 'studio-display' || settings.deviceId === 'studio-display-27') && (
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

                    <ScrubInput label="Glass opacity" value={Math.round(settings.glassOpacity * 100)} min={0} max={100} unit="%" onChange={(v) => update({ glassOpacity: v / 100 })} />              {settings.deviceId === 'iphone-15-pro' && (
                        <label className="grid grid-cols-[72px_1fr] gap-2 items-center text-[10px] text-[#a1a1aa]">
                            <span>Cutout</span>
                            <FigmaSelect
                                aria-label="Top cutout style"
                                value={settings.cutoutStyle}
                                onChange={(event) => update({ cutoutStyle: event.target.value as DeviceFrameSettings['cutoutStyle'] })}
                                className="h-7 px-2 rounded-md bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-[#0088ff] cursor-pointer"
                            >
                                <option value="dynamic-island">Dynamic Island</option>
                                <option value="notch">Notch</option>
                                <option value="none">No cutout</option>
                            </FigmaSelect>
                        </label>
                    )}

                    <CheckboxRow
                        label={<>Physical buttons</>}
                        rowClassName="flex items-center justify-between text-[10px] text-[#a1a1aa]"
                        checked={settings.showSideButtons}
                        onChange={(event) => update({ showSideButtons: event.target.checked })}
                        className="w-3.5 h-3.5 accent-[#0088ff] cursor-pointer"
                    />

                    <CheckboxRow
                        label={<>Rear camera system</>}
                        rowClassName="flex items-center justify-between text-[10px] text-[#a1a1aa]"
                        checked={settings.showRearCameras}
                        onChange={(event) => update({ showRearCameras: event.target.checked })}
                        className="w-3.5 h-3.5 accent-[#0088ff] cursor-pointer"
                    />

                    <CheckboxRow
                        label={<>Studio contact shadow</>}
                        rowClassName="flex items-center justify-between text-[10px] text-[#a1a1aa]"
                        checked={settings.shadowEnabled}
                        onChange={(event) => update({ shadowEnabled: event.target.checked })}
                        className="w-3.5 h-3.5 accent-[#0088ff] cursor-pointer"
                    />

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
            </NativeInspectorDisclosure>

        </div>}
    </section>);
};

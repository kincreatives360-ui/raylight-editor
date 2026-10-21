import React, { useState, useRef, useEffect } from 'react';
import {
    Search,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    Maximize2,
    Sun,
    Sparkles,
    Minus,
    Plus,
    Check,
} from 'lucide-react';
import type { ImageLayer, VideoLayer, Layer, DeviceFrame as DeviceFrameType, ScreenFit } from '../../../model/types';
import { resolveDeviceColor, getDeviceModelSpecByType } from '../../../model/defaults';
import { ColorPicker } from '../ColorPicker';

interface DeviceFrameSectionProps {
    layer: ImageLayer | VideoLayer;
    activeShotId: string;
    updateLayer: (shotId: string, layerId: string, updater: (layer: Layer) => Layer) => void;
}

const DEVICE_OPTIONS: { id: DeviceFrameType['type'] | 'none'; label: string; defaultSize: { width: number; height: number } }[] = [
    { id: 'iphone', label: 'iPhone', defaultSize: { width: 0.28, height: 0.58 } },
    { id: 'samsung-galaxy', label: 'Galaxy', defaultSize: { width: 0.28, height: 0.58 } },
    { id: 'ipad', label: 'iPad', defaultSize: { width: 0.48, height: 0.56 } },
    { id: 'macbook', label: 'MacBook', defaultSize: { width: 0.64, height: 0.56 } },
    { id: 'display', label: 'Display', defaultSize: { width: 0.72, height: 0.48 } },
    { id: 'browser', label: 'Browser', defaultSize: { width: 0.64, height: 0.46 } },
    { id: 'none', label: 'None', defaultSize: { width: 0.5, height: 0.5 } },
];

const STAGING_OPTIONS: { id: 'held' | 'floating' | 'desk' | 'none'; label: string }[] = [
    { id: 'held', label: 'Held in hand' },
    { id: 'floating', label: 'Floating' },
    { id: 'desk', label: 'Desk' },
    { id: 'none', label: 'None' },
];

const PRESET_DEVICE_COLORS = [
    { name: 'Space Black', hex: '#1c1c1f' },
    { name: 'Natural Titanium', hex: '#484745' },
    { name: 'Silver', hex: '#e2e8f0' },
    { name: 'Desert Titanium', hex: '#d4c5b9' },
    { name: 'Midnight', hex: '#161c28' },
    { name: 'Deep Blue', hex: '#1e293b' },
];

export const DeviceFrameSection: React.FC<DeviceFrameSectionProps> = ({
    layer,
    activeShotId,
    updateLayer,
}) => {
    const [frameExpanded, setFrameExpanded] = useState(true);
    const [stagingExpanded, setStagingExpanded] = useState(true);
    const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
    const [stagingMenuOpen, setStagingMenuOpen] = useState(false);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [screenFitMenuOpen, setScreenFitMenuOpen] = useState(false);

    const deviceMenuRef = useRef<HTMLDivElement>(null);
    const stagingMenuRef = useRef<HTMLDivElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const screenFitRef = useRef<HTMLDivElement>(null);

    // Close popovers on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
                setDeviceMenuOpen(false);
            }
            if (stagingMenuRef.current && !stagingMenuRef.current.contains(e.target as Node)) {
                setStagingMenuOpen(false);
            }
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
                setColorPickerOpen(false);
            }
            if (screenFitRef.current && !screenFitRef.current.contains(e.target as Node)) {
                setScreenFitMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const device = layer.device;
    const currentDeviceType = device?.type || 'none';
    const currentDeviceLabel = DEVICE_OPTIONS.find((d) => d.id === currentDeviceType)?.label || 'None';
    const currentChassisColor = resolveDeviceColor(device?.color);
    const currentScreenFit: ScreenFit =
        device?.screenFit ?? (device ? getDeviceModelSpecByType(device.type)?.defaultFit : undefined) ?? 'contain';
    const currentOrientation = device?.orientation;
    const currentStaging = device?.staging || 'none';
    const currentStagingLabel = STAGING_OPTIONS.find((s) => s.id === currentStaging)?.label || 'None';

    const handleSelectDevice = (type: DeviceFrameType['type'] | 'none') => {
        setDeviceMenuOpen(false);
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (type === 'none') {
                return { ...l, device: undefined };
            }
            const devOption = DEVICE_OPTIONS.find((d) => d.id === type);
            const modelSpec = getDeviceModelSpecByType(type);
            return {
                ...l,
                size: devOption?.defaultSize || l.size,
                device: {
                    type,
                    color: l.device?.color || '#1c1c1f',
                    gloss: l.device?.gloss ?? 0.5,
                    glare: l.device?.glare ?? 1.0,
                    lidAngle: l.device?.lidAngle ?? 100,
                    screenGlow: l.device?.screenGlow ?? 0.4,
                    screenFit: modelSpec?.defaultFit || (l.device?.screenFit || 'contain'),
                    staging: l.device?.staging || 'held',
                    modelSpecId: modelSpec?.id,
                },
            };
        });
    };

    const handleResetDevice = () => {
        if (!device) {
            handleSelectDevice('iphone');
        } else {
            updateLayer(activeShotId, layer.id, (l) => {
                if (l.kind !== 'image' && l.kind !== 'video') return l;
                const modelSpec = getDeviceModelSpecByType(device.type);
                return {
                    ...l,
                    device: {
                        type: device.type,
                        color: '#1c1c1f',
                        gloss: 0.5,
                        glare: 1.0,
                        lidAngle: 100,
                        screenGlow: 0.4,
                        screenFit: modelSpec?.defaultFit || 'contain',
                        staging: 'held',
                        modelSpecId: modelSpec?.id,
                    },
                };
            });
        }
    };

    const handleUpdateColor = (hex: string) => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (!l.device) return l;
            return {
                ...l,
                device: {
                    ...l.device,
                    color: hex,
                },
            };
        });
    };

    const handleUpdateGloss = (glossVal: number) => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (!l.device) return l;
            return {
                ...l,
                device: {
                    ...l.device,
                    gloss: Math.min(1, Math.max(0, glossVal)),
                },
            };
        });
    };

    const handleUpdateGlare = (glareVal: number) => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (!l.device) return l;
            return {
                ...l,
                device: {
                    ...l.device,
                    glare: Math.min(1, Math.max(0, glareVal)),
                },
            };
        });
    };

    const handleSelectScreenFit = (fit: ScreenFit) => {
        setScreenFitMenuOpen(false);
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (!l.device) return l;
            return {
                ...l,
                device: {
                    ...l.device,
                    screenFit: fit,
                },
            };
        });
    };

    // Rotates the device body (portrait <-> landscape). The body is never stretched to the content.
    const handleToggleOrientation = () => {
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (!l.device) return l;
            const spec = getDeviceModelSpecByType(l.device.type);
            const native = spec && spec.nominalWidth > spec.nominalHeight ? 'landscape' : 'portrait';
            const current = l.device.orientation ?? native;
            const next = current === 'portrait' ? 'landscape' : 'portrait';
            return {
                ...l,
                // Swap the layer box so the rotated device keeps its on-canvas size.
                size: { width: l.size.height, height: l.size.width },
                device: { ...l.device, orientation: next },
            };
        });
    };

    const handleSelectStaging = (staging: 'held' | 'floating' | 'desk' | 'none') => {
        setStagingMenuOpen(false);
        updateLayer(activeShotId, layer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (!l.device) return l;
            return {
                ...l,
                device: {
                    ...l.device,
                    staging,
                },
            };
        });
    };

    const filteredDevices = DEVICE_OPTIONS.filter((d) =>
        d.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

    return (
        <div className="divide-y divide-white/[0.06]">
            {/* FRAME SECTION */}
            <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-white">Frame</span>
                    <button
                        type="button"
                        onClick={() => setFrameExpanded((v) => !v)}
                        className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-white transition"
                    >
                        {frameExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {frameExpanded && (
                    <div className="space-y-2">
                        {/* Row 1: Device Dropdown + Color Swatch + Reset/Swap */}
                        <div className="flex items-center gap-1.5">
                            {/* Device Select Trigger */}
                            <div className="relative flex-1" ref={deviceMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setDeviceMenuOpen((v) => !v)}
                                    className="w-full h-8 px-2.5 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-white/10 flex items-center justify-between text-[11px] text-white transition cursor-pointer"
                                >
                                    <span>{currentDeviceLabel}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-[#71717a]" />
                                </button>

                                {/* Dropdown Menu with Search */}
                                {deviceMenuOpen && (
                                    <div className="absolute left-0 top-9 w-48 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1.5 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                        {/* Search Input */}
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#121214] border border-white/10 text-[11px]">
                                            <Search className="w-3 h-3 text-[#71717a]" />
                                            <input
                                                type="text"
                                                placeholder="Search..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full bg-transparent text-white focus:outline-none placeholder-[#71717a] text-[11px]"
                                                autoFocus
                                            />
                                        </div>

                                        {/* Device List */}
                                        <div className="max-h-48 overflow-y-auto space-y-0.5 pt-0.5">
                                            {filteredDevices.map((d) => (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    onClick={() => handleSelectDevice(d.id)}
                                                    className={`w-full px-2 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between cursor-pointer transition ${currentDeviceType === d.id
                                                        ? 'bg-[#0088ff] text-white font-medium'
                                                        : 'text-[#d4d4d8] hover:bg-white/5'
                                                        }`}
                                                >
                                                    <span>{d.label}</span>
                                                    {currentDeviceType === d.id && <Check className="w-3.5 h-3.5 text-white" />}
                                                </button>
                                            ))}
                                            {filteredDevices.length === 0 && (
                                                <div className="p-2 text-center text-[10px] text-[#71717a]">
                                                    No devices found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Color Swatch Button (opens ColorPicker) */}
                            <div className="relative" ref={colorPickerRef}>
                                <button
                                    type="button"
                                    onClick={() => setColorPickerOpen((v) => !v)}
                                    title="Frame Color"
                                    className="w-8 h-8 rounded-lg border border-white/15 hover:border-white/30 flex items-center justify-center p-0.5 transition cursor-pointer shadow-sm"
                                    style={{ backgroundColor: currentChassisColor }}
                                >
                                    <span className="sr-only">Frame Color</span>
                                </button>

                                {colorPickerOpen && (
                                    <div className="absolute right-0 top-9 w-64 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-3 z-40 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
                                            <span>Chassis Finish</span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-[#a1a1aa] font-mono">
                                                <span>{currentChassisColor.toUpperCase()}</span>
                                            </div>
                                        </div>

                                        {/* Color Presets */}
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {PRESET_DEVICE_COLORS.map((preset) => (
                                                <button
                                                    key={preset.hex}
                                                    type="button"
                                                    onClick={() => handleUpdateColor(preset.hex)}
                                                    title={preset.name}
                                                    className={`w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer transition ${currentChassisColor.toLowerCase() === preset.hex.toLowerCase()
                                                        ? 'border-[#0088ff] ring-2 ring-[#0088ff]/40'
                                                        : 'border-white/10 hover:border-white/30'
                                                        }`}
                                                    style={{ backgroundColor: preset.hex }}
                                                >
                                                    {currentChassisColor.toLowerCase() === preset.hex.toLowerCase() && (
                                                        <Check className="w-3 h-3 text-white" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* HEX Color Picker */}
                                        <div className="pt-1 border-t border-white/10">
                                            <ColorPicker
                                                color={currentChassisColor}
                                                onChange={handleUpdateColor}
                                                compact
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Reset / Swap Button */}
                            <button
                                type="button"
                                onClick={handleResetDevice}
                                title="Reset Frame"
                                className="w-8 h-8 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white transition cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Row 2: Screen Mapping (orientation toggle + Contain / Cover) */}
                        {device && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    title="Toggle device orientation"
                                    onClick={handleToggleOrientation}
                                    className="h-7 px-2.5 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-white/10 flex items-center gap-1.5 text-[11px] text-[#d4d4d8] transition cursor-pointer capitalize"
                                >
                                    <Maximize2 className="w-3 h-3 text-[#71717a]" />
                                    <span>{currentOrientation ?? 'Native'}</span>
                                </button>

                                <div className="relative flex-1" ref={screenFitRef}>
                                    <button
                                        type="button"
                                        onClick={() => setScreenFitMenuOpen((v) => !v)}
                                        className="w-full h-7 px-2.5 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-white/10 flex items-center justify-between text-[11px] text-white capitalize transition cursor-pointer"
                                    >
                                        <span>{currentScreenFit}</span>
                                        <ChevronRight className="w-3 h-3 text-[#71717a]" />
                                    </button>

                                    {screenFitMenuOpen && (
                                        <div className="absolute right-0 top-8 w-32 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 z-40 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                                            {(['contain', 'cover'] as const).map((fit) => (
                                                <button
                                                    key={fit}
                                                    type="button"
                                                    onClick={() => handleSelectScreenFit(fit)}
                                                    className={`w-full px-2 py-1 rounded-md text-left text-[11px] capitalize cursor-pointer transition ${currentScreenFit === fit
                                                        ? 'bg-[#0088ff] text-white font-medium'
                                                        : 'text-[#d4d4d8] hover:bg-white/5'
                                                        }`}
                                                >
                                                    {fit}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Row 3: Gloss & Reflection */}
                        {device && (
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] text-[#71717a] block font-normal">Gloss &amp; reflection</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <div className="flex items-center h-7 px-2 rounded-lg bg-[#18181b] border border-white/10 gap-1.5 text-[11px]">
                                        <Sun className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={Math.round((device.gloss ?? 0.5) * 100)}
                                            onChange={(e) => handleUpdateGloss(Number(e.target.value) / 100)}
                                            className="w-full bg-transparent text-right text-white focus:outline-none text-[11px]"
                                        />
                                        <span className="text-[#71717a] text-[10px] shrink-0">%</span>
                                    </div>
                                    <div className="flex items-center h-7 px-2 rounded-lg bg-[#18181b] border border-white/10 gap-1.5 text-[11px]">
                                        <Sparkles className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={Math.round((device.glare ?? 1.0) * 100)}
                                            onChange={(e) => handleUpdateGlare(Number(e.target.value) / 100)}
                                            className="w-full bg-transparent text-right text-white focus:outline-none text-[11px]"
                                        />
                                        <span className="text-[#71717a] text-[10px] shrink-0">%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MacBook Lid Angle */}
                        {device?.type === 'macbook' && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                                    <span>Lid angle</span>
                                    <span className="text-white">{device.lidAngle ?? 100}°</span>
                                </div>
                                <input
                                    type="range"
                                    min="35"
                                    max="125"
                                    value={device.lidAngle ?? 100}
                                    onChange={(e) =>
                                        updateLayer(activeShotId, layer.id, (l) => {
                                            if (l.kind !== 'image' && l.kind !== 'video') return l;
                                            if (!l.device) return l;
                                            return {
                                                ...l,
                                                device: { ...l.device, lidAngle: Number(e.target.value) },
                                            };
                                        })
                                    }
                                    className="w-full accent-[#0088ff] h-1.5 bg-[#27272a] rounded cursor-pointer"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* STAGING SECTION */}
            <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-white">Staging</span>
                    <button
                        type="button"
                        onClick={() => setStagingExpanded((v) => !v)}
                        className="p-1 rounded hover:bg-white/10 text-[#71717a] hover:text-white transition"
                    >
                        {stagingExpanded ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                </div>

                {stagingExpanded && device && (
                    <div className="relative" ref={stagingMenuRef}>
                        <button
                            type="button"
                            onClick={() => setStagingMenuOpen((v) => !v)}
                            className="w-full h-8 px-2.5 rounded-lg bg-[#18181b] hover:bg-[#202024] border border-white/10 flex items-center justify-between text-[11px] text-white transition cursor-pointer"
                        >
                            <span>{currentStagingLabel}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-[#71717a]" />
                        </button>

                        {stagingMenuOpen && (
                            <div className="absolute left-0 top-9 w-full rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 z-40 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                                {STAGING_OPTIONS.map((st) => (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => handleSelectStaging(st.id)}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between cursor-pointer transition ${currentStaging === st.id
                                            ? 'bg-[#0088ff] text-white font-medium'
                                            : 'text-[#d4d4d8] hover:bg-white/5'
                                            }`}
                                    >
                                        <span>{st.label}</span>
                                        {currentStaging === st.id && <Check className="w-3.5 h-3.5 text-white" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

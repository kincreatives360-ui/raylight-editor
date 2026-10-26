// src/panels/Inspector/sections/LightInspector.tsx
import React, { useCallback } from 'react';
import { X, Sun, Thermometer } from 'lucide-react';
import type { Shot, SceneLight, LightSourceType, Vec3 } from '../../../model/types';
import { radToDeg, degToRad } from '../../../model/defaults';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
import { useProjectStore } from '../../../store/useProjectStore';

interface LightInspectorProps {
    activeShot: Shot;
    selectedLightId: string;
    onClose: () => void;
}

export const LightInspector: React.FC<LightInspectorProps> = ({
    activeShot,
    selectedLightId,
    onClose,
}) => {
    const { updateShot } = useProjectStore();
    const shotLight = activeShot.light;

    const isKey =
        selectedLightId === 'sun-key' ||
        selectedLightId === 'key' ||
        selectedLightId === 'sun';

    // Find the current light model
    const currentLight: SceneLight | null = isKey
        ? {
            id: 'sun-key',
            name: 'Sun',
            type: 'directional',
            enabled: shotLight?.keyLightEnabled !== false,
            position: shotLight?.position || { x: -0.28, y: 0.36, z: 0.9 },
            target: (shotLight as unknown as { target?: Vec3 })?.target || { x: 0, y: 0, z: 0 },
            intensity: shotLight?.intensity ?? 1.2,
            color: '#ffffff',
            temperature: shotLight?.temperature ?? 6500,
            castShadow: shotLight?.castShadow !== false,
        }
        : ((shotLight?.sources || []).find((s) => s.id === selectedLightId) ?? null);

    const updateLight = useCallback(
        (patch: Partial<SceneLight>) => {
            const currentRig = activeShot.light || {
                position: { x: -0.28, y: 0.36, z: 0.9 },
                intensity: 1.2,
                temperature: 6500,
                ambience: 0.45,
            };

            if (isKey) {
                const { type: _ignoredType, color: _ignoredColor, ...validKeyPatch } = patch;
                updateShot(activeShot.id, {
                    light: {
                        ...currentRig,
                        ...validKeyPatch,
                        position: patch.position
                            ? { ...currentRig.position, ...patch.position }
                            : currentRig.position,
                        target: patch.target
                            ? { ...((currentRig as unknown as { target?: Vec3 })?.target || { x: 0, y: 0, z: 0 }), ...patch.target }
                            : (currentRig as unknown as { target?: Vec3 })?.target,
                    },
                });
            } else {
                const currentSources = currentRig.sources || [];
                const nextSources = currentSources.map((s) => {
                    if (s.id === selectedLightId) {
                        return {
                            ...s,
                            ...patch,
                            position: patch.position
                                ? { ...s.position, ...patch.position }
                                : s.position,
                            target: patch.target
                                ? { ...(s.target || { x: 0, y: 0, z: 0 }), ...patch.target }
                                : s.target,
                        };
                    }
                    return s;
                });
                updateShot(activeShot.id, {
                    light: {
                        ...currentRig,
                        sources: nextSources,
                    },
                });
            }
        },
        [activeShot.id, activeShot.light, isKey, selectedLightId, updateShot]
    );

    if (!currentLight) {
        return null;
    }

    const typeDisplayNames: Record<LightSourceType, string> = {
        directional: 'Sun',
        spot: 'Spot',
        point: 'Point',
        area: 'Area',
        ambient: 'Ambient',
    };

    const hasTarget =
        currentLight.type === 'directional' ||
        currentLight.type === 'spot' ||
        currentLight.type === 'area';

    const target = currentLight.target || { x: 0, y: 0, z: 0 };

    return (
        <div data-testid="light-inspector" className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {/* Header: Light Title + Close X */}
            <div className="p-3.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-white tracking-wide">
                    {typeDisplayNames[currentLight.type] || currentLight.name}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    title="Close Inspector"
                    className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white transition cursor-pointer"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Type Dropdown */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Type</span>
                <select
                    value={currentLight.type}
                    disabled={isKey}
                    onChange={(e) => updateLight({ type: e.target.value as LightSourceType })}
                    className={`w-full h-8 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none transition ${
                        isKey ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'
                    }`}
                >
                    <option value="directional">Sun</option>
                    <option value="spot">Spot</option>
                    <option value="point">Point</option>
                    <option value="area">Area</option>
                </select>
            </div>

            {/* Position: X, Y */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Position</span>
                <div className="grid grid-cols-2 gap-2">
                    <ScrubInput
                        label="X"
                        value={currentLight.position.x}
                        step={0.05}
                        decimals={2}
                        onChange={(x) =>
                            updateLight({ position: { ...currentLight.position, x } })
                        }
                    />
                    <ScrubInput
                        label="Y"
                        value={currentLight.position.y}
                        step={0.05}
                        decimals={2}
                        onChange={(y) =>
                            updateLight({ position: { ...currentLight.position, y } })
                        }
                    />
                </div>
            </div>

            {/* Depth: Z */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Depth</span>
                <ScrubInput
                    label="Z"
                    value={currentLight.position.z}
                    step={0.05}
                    decimals={2}
                    onChange={(z) =>
                        updateLight({ position: { ...currentLight.position, z } })
                    }
                />
            </div>

            {/* Aim at: X, Y, Z (for Sun, Spot, Area) */}
            {hasTarget && (
                <div className="p-3.5 space-y-2">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Aim at</span>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <ScrubInput
                            label="X"
                            value={target.x}
                            step={0.05}
                            decimals={2}
                            onChange={(x) => updateLight({ target: { ...target, x } })}
                        />
                        <ScrubInput
                            label="Y"
                            value={target.y}
                            step={0.05}
                            decimals={2}
                            onChange={(y) => updateLight({ target: { ...target, y } })}
                        />
                    </div>
                    <ScrubInput
                        label="Z"
                        value={target.z}
                        step={0.05}
                        decimals={2}
                        onChange={(z) => updateLight({ target: { ...target, z } })}
                    />
                </div>
            )}

            {/* Effect: Intensity + Temperature */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Effect</span>
                <div className="grid grid-cols-2 gap-2">
                    <ScrubInput
                        label={<Sun className="w-3.5 h-3.5 text-[#e4e4e7]" />}
                        value={currentLight.intensity}
                        min={0}
                        max={10}
                        step={0.1}
                        decimals={1}
                        onChange={(intensity) => updateLight({ intensity })}
                    />
                    <ScrubInput
                        label={<Thermometer className="w-3.5 h-3.5 text-[#e4e4e7]" />}
                        value={currentLight.temperature ?? 6500}
                        min={1000}
                        max={12000}
                        step={100}
                        unit="K"
                        onChange={(temperature) => updateLight({ temperature })}
                    />
                </div>
            </div>

            {/* Color */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Color</span>
                <ColorPicker
                    color={currentLight.color || '#ffffff'}
                    label="Color"
                    compact={false}
                    showGradientMode={false}
                    disabled={isKey}
                    onChange={(color) => updateLight({ color })}
                />
            </div>

            {/* Cone (Spot light) */}
            {currentLight.type === 'spot' && (
                <div className="p-3.5 space-y-2">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Cone</span>
                    <div className="grid grid-cols-2 gap-2">
                        <ScrubInput
                            label="Angle"
                            value={Math.round(radToDeg(currentLight.angle || Math.PI / 6))}
                            min={5}
                            max={85}
                            unit="°"
                            onChange={(deg) => updateLight({ angle: degToRad(deg) })}
                        />
                        <ScrubInput
                            label="Soft"
                            value={Math.round((currentLight.penumbra ?? 0.2) * 100)}
                            min={0}
                            max={100}
                            unit="%"
                            onChange={(soft) => updateLight({ penumbra: soft / 100 })}
                        />
                    </div>
                </div>
            )}

            {/* Range (Spot or Point light) */}
            {(currentLight.type === 'spot' || currentLight.type === 'point') && (
                <div className="p-3.5 space-y-2">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Range</span>
                    <ScrubInput
                        label="Reach"
                        value={currentLight.distance ?? 5}
                        min={0.5}
                        max={100}
                        step={0.5}
                        decimals={1}
                        onChange={(distance) => updateLight({ distance })}
                    />
                </div>
            )}

            {/* Size (Area light) */}
            {currentLight.type === 'area' && (
                <div className="p-3.5 space-y-2">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Size</span>
                    <div className="grid grid-cols-2 gap-2">
                        <ScrubInput
                            label="Width"
                            value={currentLight.width ?? 3}
                            min={0.2}
                            max={50}
                            step={0.2}
                            decimals={1}
                            onChange={(width) => updateLight({ width })}
                        />
                        <ScrubInput
                            label="Height"
                            value={currentLight.height ?? 3}
                            min={0.2}
                            max={50}
                            step={0.2}
                            decimals={1}
                            onChange={(height) => updateLight({ height })}
                        />
                    </div>
                </div>
            )}

            {/* Shadows */}
            <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Shadows</span>
                    <label className="flex items-center gap-2 cursor-pointer text-[10px] text-[#a1a1aa]">
                        <span>Cast shadows</span>
                        <input
                            type="checkbox"
                            checked={currentLight.castShadow !== false}
                            onChange={(e) => updateLight({ castShadow: e.target.checked })}
                            className="w-4 h-4 rounded accent-[#0088ff] cursor-pointer"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

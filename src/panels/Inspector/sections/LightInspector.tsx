import { CheckboxRow } from '../../../ui/CheckboxRow';
import { InspectorRow } from '../../../ui/primitives';
import { LIGHT_TYPE_META } from '../../../ui/lightTypes';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { AxisFields } from '../../../ui/AxisFields';
import { MenuSurface, MenuItem } from '../../../ui/Menu';
import { IconButton, InspectorModeTabs } from '../../../ui/primitives';
import React, { useCallback, useState } from 'react';
import { X, Sun, Thermometer, Sparkles, Plus, ChevronDown } from 'lucide-react';
import type { Shot, SceneLight, LightSourceType, LightAnimationBlock, LightRig } from '../../../model/types';
import { radToDeg, degToRad } from '../../../model/defaults';
import { generateId } from '../../../model/id';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { SceneLightsList } from './SceneLightsList';

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
    const selectLight = useSelectionStore((s) => s.selectLight);
    const selectLightBlock = useSelectionStore((s) => s.selectLightBlock);
    const shotLight = activeShot.light;
    const [activeTab, setActiveTab] = useState<'design' | 'animate'>('design');
    const [addAnimationOpen, setAddAnimationOpen] = useState(false);
    const isRoom = selectedLightId === 'room';

    const isKey =
        selectedLightId === 'sun-key' ||
        selectedLightId === 'key' ||
        selectedLightId === 'sun';

    // Find the current light model
    const currentLight: SceneLight | null = isRoom
        ? {
            id: 'room', name: 'Room', type: 'ambient', enabled: true,
            position: { x: 0, y: 0, z: 0 }, intensity: shotLight?.ambience ?? 0.45,
            color: shotLight?.ambientColor ?? '#f8fafc', temperature: shotLight?.temperature ?? 6500,
        }
        : isKey
        ? {
            id: 'sun-key',
            name: 'Sun',
            type: 'directional',
            enabled: shotLight?.keyLightEnabled !== false,
            position: shotLight?.position || { x: -0.28, y: 0.36, z: 0.9 },
            target: shotLight?.target || { x: 0, y: 0, z: 0 },
            intensity: shotLight?.keyIntensity ?? shotLight?.intensity ?? 1.2,
            color: '#ffffff',
            temperature: shotLight?.temperature ?? 6500,
            castShadow: shotLight?.castShadow !== false,
        }
        : ((shotLight?.sources || []).find((s) => s.id === selectedLightId) ?? null);

    const updateLight = useCallback(
        (patch: Partial<SceneLight> & { environment?: LightRig['environment'] }) => {
            const currentRig = activeShot.light || {
                position: { x: -0.28, y: 0.36, z: 0.9 },
                intensity: 1.2,
                temperature: 6500,
                ambience: 0.45,
            };

            if (isRoom) {
                updateShot(activeShot.id, {
                    light: {
                        ...currentRig,
                        ambience: patch.intensity ?? currentRig.ambience,
                        ambientColor: patch.color ?? currentRig.ambientColor,
                        environment: 'environment' in patch ? patch.environment : currentRig.environment,
                    },
                });
            } else if (isKey) {
                const { type: _ignoredType, color: _ignoredColor, intensity: requestedIntensity, ...validKeyPatch } = patch;
                updateShot(activeShot.id, {
                    light: {
                        ...currentRig,
                        ...validKeyPatch,
                        ...(requestedIntensity !== undefined ? { keyIntensity: requestedIntensity } : {}),
                        position: patch.position
                            ? { ...currentRig.position, ...patch.position }
                            : currentRig.position,
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
        [activeShot.id, activeShot.light, isKey, isRoom, selectedLightId, updateShot]
    );

    if (!currentLight) {
        return null;
    }


    const hasTarget =
        currentLight.type === 'directional' ||
        currentLight.type === 'spot' ||
        currentLight.type === 'area';

    const target = currentLight.target || { x: 0, y: 0, z: 0 };

    const handleAnimateLight = (property: NonNullable<LightAnimationBlock['property']>) => {
        const id = generateId('light-blk');
        const startMs = 0;
        const durationMs = 1000;
        const targetLightId = isRoom ? 'room' : isKey ? 'key' : currentLight.id;
        const currentIntensity = isRoom ? (shotLight?.ambience ?? 0.45) : currentLight.intensity;
        const currentTemperature = currentLight.temperature ?? 6500;
        const newBlock: LightAnimationBlock = {
            id,
            label: property === 'position' ? 'Position' : property === 'intensity' ? 'Power' : property === 'temperature' ? 'Temp' : 'Ambience',
            targetLightId,
            property,
            startMs,
            durationMs,
            fromX: currentLight.position.x,
            fromY: currentLight.position.y,
            fromZ: currentLight.position.z,
            toX: Number((currentLight.position.x + (property === 'position' ? 0.2 : 0)).toFixed(2)),
            toY: currentLight.position.y,
            toZ: currentLight.position.z,
            fromIntensity: currentIntensity,
            toIntensity: Number((property === 'intensity' || property === 'ambience'
                ? Math.min(1, currentIntensity + (isRoom ? 0.15 : currentIntensity * 0.5))
                : currentIntensity).toFixed(2)),
            fromTemperature: currentTemperature,
            toTemperature: property === 'temperature' ? Math.min(12000, currentTemperature + 500) : currentTemperature,
            easing: { kind: 'preset', name: 'ease-in-out' },
        };

        updateShot(activeShot.id, (s) => ({
            ...s,
            lightBlocks: [...(s.lightBlocks || []), newBlock],
        }));
        selectLightBlock(id);
        setAddAnimationOpen(false);
    };

    const animationTargetId = isRoom ? 'room' : isKey ? 'key' : currentLight.id;
    const animations = (activeShot.lightBlocks || []).filter((block) => (block.targetLightId ?? 'key') === animationTargetId);

    return (
        <div data-testid="light-inspector" className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            <div className="sticky top-0 z-10 bg-[#0b0b0d] border-b border-white/[0.07]">
                <InspectorModeTabs
                    mode={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Lighting settings"
                    animateTestId="animate-light-btn"
                    className="flex items-center gap-1 px-3 py-2"
                    actions={
                        <>
                            <span className="flex-1" />
                            <IconButton
                                unstyled
                                tooltip={false}
                                label="Close Inspector"
                                onClick={onClose}
                                title="Close Inspector"
                                className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white transition cursor-pointer"
                                icon={<X className="w-3.5 h-3.5" />}
                            />
                        </>
                    }
                />
            </div>
            {activeTab === 'animate' ? <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Animations</span>
                    <div className="relative">
                        <IconButton
                            unstyled
                            tooltip={false}
                            label="Add light animation"
                            aria-expanded={addAnimationOpen}
                            onClick={() => setAddAnimationOpen((open) => !open)}
                            className="w-7 h-7 rounded-md bg-[#222226] hover:bg-[#303035] border border-white/10 text-white flex items-center justify-center cursor-pointer"
                            icon={<Plus className="w-4 h-4" />}
                        />
                        {addAnimationOpen && <MenuSurface
                            className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-[#1c1c1f]/85 backdrop-blur-xl saturate-180 border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] p-1 z-30 origin-top-right"
                        >
                            <span className="block px-2.5 pt-1.5 pb-1 text-[10px] text-[#8e8e93]">Custom</span>
                            {(isRoom ? [['ambience', 'Ambience']] : [['position', 'Position'], ['intensity', 'Power'], ['temperature', 'Temp']]).map(([property, label]) => <MenuItem
                                unstyled
                                key={property}
                                onClick={() => handleAnimateLight(property as NonNullable<LightAnimationBlock['property']>)}
                                className="w-full px-2.5 py-2 rounded-lg text-left text-[11px] text-white hover:bg-white/10 cursor-pointer"
                            >{label}</MenuItem>)}
                        </MenuSurface>}
                    </div>
                </div>
                {animations.length ? <div className="divide-y divide-white/[0.07]">{animations.map((block) => <button type="button"  key={block.id} onClick={() => selectLightBlock(block.id)} className="w-full py-3 flex items-center justify-between text-left text-[11px] text-white hover:text-[#38bdf8] cursor-pointer"><span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-[#a1a1aa]" />{block.label}</span><ChevronDown className="w-3.5 h-3.5 text-[#71717a] -rotate-90" /></button>)}</div> : <div className="py-5 text-center text-[11px] text-[#71717a]">No animations yet</div>}
                <div className="pt-2 border-t border-white/[0.07]"><SceneLightsList activeShot={activeShot} selectedLightId={selectedLightId} onSelectLight={(id) => { if (id) selectLight(id); else onClose(); }} /></div>
            </div> : <>
            {/* Header: Light Title + Close X */}
            <div className="p-3.5 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-white tracking-wide">{isRoom ? 'Room' : isKey ? 'Light' : LIGHT_TYPE_META[currentLight.type]?.label || currentLight.name}</span>
            </div>


            {isRoom ? <div className="p-3.5 space-y-3">
                <InspectorRow
                    unstyled
                    className="space-y-2"
                    labelTag="span"
                    labelClassName="text-[11px] font-medium text-[#e4e4e7]"
                    label={<>Ambience</>}
                >
                    <ScrubInput label={<Sun className="w-3.5 h-3.5 text-[#e4e4e7]" />} value={Math.round(currentLight.intensity * 100)} min={0} max={100} step={1} unit="%"
                        onChange={(intensity) => updateLight({ intensity: intensity / 100 })} />
                </InspectorRow>
                <InspectorRow
                    unstyled
                    className="space-y-2"
                    labelTag="span"
                    labelClassName="text-[11px] font-medium text-[#e4e4e7]"
                    label={<>Environment</>}
                >
                    <FigmaSelect value={shotLight?.environment ?? (shotLight?.ambientColor ? 'studio' : 'custom')} onChange={(event) => updateLight({ environment: event.target.value as LightRig['environment'] })}
                        className="w-full h-8 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none cursor-pointer hover:border-white/20 transition">
                        <option value="studio">Studio</option><option value="softbox">Softbox</option><option value="strip-light">Strip light</option><option value="daylight">Daylight</option><option value="night-city">Night city</option><option value="warehouse">Warehouse</option><option value="custom">Custom</option>
                    </FigmaSelect>
                </InspectorRow>
                <InspectorRow
                    unstyled
                    className="space-y-2"
                    labelTag="span"
                    labelClassName="text-[11px] font-medium text-[#e4e4e7]"
                    label={<>Color</>}
                >
                    <ColorPicker color={currentLight.color} label="Room color" compact={false} showGradientMode={false}
                        onChange={(color) => updateLight({ color, environment: 'custom' })} />
                </InspectorRow>
            </div> : <>
            {/* Type Dropdown */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Type</span>
                <FigmaSelect
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
                </FigmaSelect>
            </div>

            {/* Position: X, Y */}
            <div className="p-3.5 space-y-2">
                <span className="text-[11px] font-medium text-[#e4e4e7]">Position</span>
                <AxisFields
                    className="grid grid-cols-2 gap-2"
                    fields={[{ key: "0", label: "X", value: currentLight.position.x, step: 0.05, decimals: 2, onChange: (x) =>
                       updateLight({ position: { ...currentLight.position, x } })
                    }, { key: "1", label: "Y", value: currentLight.position.y, step: 0.05, decimals: 2, onChange: (y) =>
                       updateLight({ position: { ...currentLight.position, y } })
                    }]}
                />
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
                    <AxisFields
                        className="grid grid-cols-2 gap-2 mb-2"
                        fields={[{ key: "0", label: "X", value: target.x, step: 0.05, decimals: 2, onChange: (x) => updateLight({ target: { ...target, x } }) }, { key: "1", label: "Y", value: target.y, step: 0.05, decimals: 2, onChange: (y) => updateLight({ target: { ...target, y } }) }]}
                    />
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
            {currentLight.type !== 'area' && currentLight.type !== 'ambient' && <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#e4e4e7]">Shadows</span>
                    <CheckboxRow
                        label={<>Cast shadows</>}
                        rowClassName="flex items-center gap-2 cursor-pointer text-[10px] text-[#a1a1aa]"
                        checked={currentLight.castShadow !== false}
                        onChange={(e) => updateLight({ castShadow: e.target.checked })}
                        className="w-4 h-4 rounded accent-[#0088ff] cursor-pointer"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <ScrubInput label="Strength" value={Math.round(((isKey ? shotLight?.shadowStrength : currentLight.shadowStrength) ?? 0.7) * 100)} min={0} max={100} unit="%"
                        onChange={(value) => isKey ? updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, shadowStrength: value / 100 } })) : updateLight({ shadowStrength: value / 100 })} />
                    <ScrubInput label="Soft" value={(isKey ? shotLight?.shadowSoftness : currentLight.shadowSoftness) ?? 50} min={0} max={100} unit="%"
                        onChange={(value) => isKey ? updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, shadowSoftness: value } })) : updateLight({ shadowSoftness: value })} />
                </div>
            </div>}
            </>}
            <div className="p-3.5 border-t border-white/[0.06]"><SceneLightsList activeShot={activeShot} selectedLightId={selectedLightId}
                onSelectLight={(id) => { if (id) selectLight(id); else onClose(); }} /></div>
            </>}
        </div>
    );
};



import { CheckboxRow } from '../../../ui/CheckboxRow';
import { InspectorRow } from '../../../ui/primitives';
import { LIGHT_TYPE_META } from '../../../ui/lightTypes';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { AxisFields } from '../../../ui/AxisFields';
import { MenuSurface, MenuItem } from '../../../ui/Menu';
import { IconButton, InspectorModeTabs } from '../../../ui/primitives';
import React, { useCallback, useState } from 'react';
import { X, Sparkles, Plus, ChevronDown, Wand2 } from 'lucide-react';
import type { Shot, SceneLight, LightSourceType, LightAnimationBlock, LightRig } from '../../../model/types';
import { radToDeg, degToRad } from '../../../model/defaults';
import { generateId } from '../../../model/id';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { SceneLightsList } from './SceneLightsList';
import {
    LIGHT_ANIMATION_PRESETS,
    getKelvinPreviewColor,
} from '../../../engine/lightingSystem';

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
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [aimOpen, setAimOpen] = useState(false);
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
            color: shotLight?.keyColor ?? '#ffffff',
            temperature: shotLight?.temperature ?? 6500,
            castShadow: shotLight?.castShadow !== false,
        }
        : ((shotLight?.sources || []).find((s) => s.id === selectedLightId) ?? null);

    const updateLight = useCallback(
        (patch: Partial<SceneLight> & Pick<Partial<LightRig>, 'environment' | 'fillEnabled' | 'fillIntensity' | 'backgroundReceivesLight' | 'showGizmos'>) => {
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
                        fillEnabled: patch.fillEnabled ?? currentRig.fillEnabled,
                        fillIntensity: patch.fillIntensity ?? currentRig.fillIntensity,
                        backgroundReceivesLight: patch.backgroundReceivesLight ?? currentRig.backgroundReceivesLight,
                        showGizmos: patch.showGizmos ?? currentRig.showGizmos,
                    },
                });
            } else if (isKey) {
                const { type: _ignoredType, color: requestedColor, intensity: requestedIntensity, ...validKeyPatch } = patch;
                updateShot(activeShot.id, {
                    light: {
                        ...currentRig,
                        ...validKeyPatch,
                        ...(requestedColor !== undefined ? { keyColor: requestedColor } : {}),
                        ...(requestedIntensity !== undefined ? { keyIntensity: requestedIntensity, intensity: requestedIntensity } : {}),
                        position: patch.position
                            ? { ...currentRig.position, ...patch.position }
                            : currentRig.position,
                        target: patch.target
                            ? { ...(currentRig.target || { x: 0, y: 0, z: 0 }), ...patch.target }
                            : currentRig.target,
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

    const handleApplyAnimationPreset = (presetId: string) => {
        const id = generateId('light-blk');
        const targetLightId = isRoom ? 'room' : isKey ? 'key' : currentLight.id;
        const preset = LIGHT_ANIMATION_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;

        const baseBlock: LightAnimationBlock = {
            id,
            label: preset.label,
            targetLightId,
            property: preset.property,
            startMs: 0,
            durationMs: 1200,
            fromX: currentLight.position.x,
            fromY: currentLight.position.y,
            fromZ: currentLight.position.z,
            toX: currentLight.position.x,
            toY: currentLight.position.y,
            toZ: currentLight.position.z,
            fromIntensity: currentLight.intensity,
            toIntensity: currentLight.intensity,
            fromTemperature: currentLight.temperature ?? 6500,
            toTemperature: currentLight.temperature ?? 6500,
            easing: { kind: 'preset', name: 'ease-in-out' },
            ...preset.apply({} as LightAnimationBlock),
        };

        updateShot(activeShot.id, (s) => ({
            ...s,
            lightBlocks: [...(s.lightBlocks || []), baseBlock],
        }));
        selectLightBlock(id);
        setAddAnimationOpen(false);
    };

    const animationTargetId = isRoom ? 'room' : isKey ? 'key' : currentLight.id;
    const animations = (activeShot.lightBlocks || []).filter((block) => (block.targetLightId ?? 'key') === animationTargetId);
    const kelvinPreviewColor = getKelvinPreviewColor(currentLight.temperature ?? 6500);

    return (
        <div data-testid="light-inspector" className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {/* Inspector Mode Tabs with Close Button */}
            <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-border/60">
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

            {activeTab === 'animate' ? (
                <div className="p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-foreground">Animations</span>
                        <div className="relative">
                            <IconButton
                                unstyled
                                tooltip={false}
                                label="Add light animation"
                                aria-expanded={addAnimationOpen}
                                onClick={() => setAddAnimationOpen((open) => !open)}
                                className="w-7 h-7 rounded-md bg-surface-elevated hover:bg-surface-elevated/80 border border-border/60 text-foreground flex items-center justify-center cursor-pointer transition"
                                icon={<Plus className="w-4 h-4" />}
                            />
                            {addAnimationOpen && (
                                <MenuSurface
                                    className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[#1c1c1f]/95 backdrop-blur-xl saturate-180 border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] p-1 z-30 origin-top-right text-[11px]"
                                >
                                    <span className="block px-2.5 pt-1.5 pb-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                        Custom Properties
                                    </span>
                                    {(isRoom ? [['ambience', 'Ambience']] : [['position', 'Position'], ['intensity', 'Power'], ['temperature', 'Temp']]).map(([property, label]) => (
                                        <MenuItem
                                            unstyled
                                            key={property}
                                            onClick={() => handleAnimateLight(property as NonNullable<LightAnimationBlock['property']>)}
                                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] text-foreground hover:bg-white/10 cursor-pointer transition"
                                        >
                                            {label}
                                        </MenuItem>
                                    ))}

                                    <div className="my-1 border-t border-white/[0.08]" />
                                    <span className="block px-2.5 pt-1 pb-1 text-[10px] text-sky-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                        <Wand2 className="w-3 h-3" />
                                        <span>Movement Presets</span>
                                    </span>
                                    {LIGHT_ANIMATION_PRESETS.map((preset) => (
                                        <MenuItem
                                            unstyled
                                            key={preset.id}
                                            onClick={() => handleApplyAnimationPreset(preset.id)}
                                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] text-foreground hover:bg-sky-500/15 hover:text-sky-300 cursor-pointer transition flex flex-col"
                                        >
                                            <span className="font-medium">{preset.label}</span>
                                            <span className="text-[9px] text-muted-foreground">{preset.description}</span>
                                        </MenuItem>
                                    ))}
                                </MenuSurface>
                            )}
                        </div>
                    </div>
                    {animations.length ? (
                        <div className="divide-y divide-white/[0.07]">
                            {animations.map((block) => (
                                <button
                                    type="button"
                                    key={block.id}
                                    onClick={() => selectLightBlock(block.id)}
                                    className="w-full py-2.5 flex items-center justify-between text-left text-[11px] text-foreground hover:text-sky-400 cursor-pointer transition"
                                >
                                    <span className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                        <span>{block.label}</span>
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground -rotate-90" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-5 text-center text-[11px] text-muted-foreground">
                            No animations yet
                        </div>
                    )}
                    <div className="pt-2 border-t border-white/[0.07]">
                        <SceneLightsList activeShot={activeShot} selectedLightId={selectedLightId} onSelectLight={(id) => { if (id) selectLight(id); else onClose(); }} />
                    </div>
                </div>
            ) : (
                <>
                    {/* Header: Light Title */}
                    <div className="p-3.5 flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-white tracking-wide">
                            {isRoom ? 'Room' : isKey ? 'Sun' : LIGHT_TYPE_META[currentLight.type]?.label || currentLight.name}
                        </span>
                    </div>

                    {isRoom ? (
                        <div className="p-3.5 space-y-3">
                            <InspectorRow
                                unstyled
                                className="space-y-2"
                                labelTag="span"
                                labelClassName="text-[11px] font-medium text-foreground"
                                label={<>Ambience</>}
                            >
                                <ScrubInput
                                    label="Ambient"
                                    value={Math.round(currentLight.intensity * 100)}
                                    min={0}
                                    max={100}
                                    step={1}
                                    unit="%"
                                    onChange={(intensity) => updateLight({ intensity: intensity / 100 })}
                                />
                            </InspectorRow>
                            <InspectorRow
                                unstyled
                                className="space-y-2"
                                labelTag="span"
                                labelClassName="text-[11px] font-medium text-foreground"
                                label={<>Environment</>}
                            >
                                <FigmaSelect
                                    value={shotLight?.environment ?? (shotLight?.ambientColor ? 'studio' : 'custom')}
                                    onChange={(event) => updateLight({ environment: event.target.value as LightRig['environment'] })}
                                    className="w-full h-8 px-2.5 rounded-lg bg-surface-elevated border border-border/80 text-[11px] text-foreground outline-none cursor-pointer hover:border-border transition"
                                >
                                    <option value="studio">Studio</option>
                                    <option value="softbox">Softbox</option>
                                    <option value="strip-light">Strip light</option>
                                    <option value="daylight">Daylight</option>
                                    <option value="night-city">Night city</option>
                                    <option value="warehouse">Warehouse</option>
                                    <option value="custom">Custom</option>
                                </FigmaSelect>
                            </InspectorRow>
                            <InspectorRow
                                unstyled
                                className="space-y-2"
                                labelTag="span"
                                labelClassName="text-[11px] font-medium text-foreground"
                                label={<>Color</>}
                            >
                                <ColorPicker
                                    color={currentLight.color}
                                    label="Room color"
                                    compact={false}
                                    showGradientMode={false}
                                    onChange={(color) => updateLight({ color, environment: 'custom' })}
                                />
                            </InspectorRow>
                            <CheckboxRow
                                label={<>Background receives light</>}
                                checked={shotLight?.backgroundReceivesLight ?? false}
                                onChange={(event) => updateLight({ backgroundReceivesLight: event.target.checked })}
                                rowClassName="flex items-center justify-between gap-3 text-[11px] text-foreground"
                                className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                            />
                            <details
                                className="group border-t border-white/[0.06] pt-2"
                                open={advancedOpen}
                                onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
                            >
                                <summary className="flex items-center justify-between cursor-pointer select-none text-[11px] font-medium text-foreground hover:text-white transition list-none [&::-webkit-details-marker]:hidden">
                                    <span>Advanced lighting</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="pt-3 space-y-3">
                                    <CheckboxRow
                                        label={<>Fill light</>}
                                        checked={shotLight?.fillEnabled ?? (shotLight?.keyLightEnabled !== false)}
                                        onChange={(event) => updateLight({ fillEnabled: event.target.checked })}
                                        rowClassName="flex items-center justify-between gap-3 text-[11px] text-foreground"
                                        className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                                    />
                                    <CheckboxRow
                                        label={<>Show light guides</>}
                                        checked={shotLight?.showGizmos ?? true}
                                        onChange={(event) => updateLight({ showGizmos: event.target.checked })}
                                        rowClassName="flex items-center justify-between gap-3 text-[11px] text-foreground"
                                        className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                                    />
                                    <ScrubInput
                                        label="Fill strength"
                                        value={Math.round((shotLight?.fillIntensity ?? 0.38) * 100)}
                                        min={0}
                                        max={100}
                                        unit="%"
                                        onChange={(value) => updateLight({ fillIntensity: value / 100 })}
                                    />
                                </div>
                            </details>
                        </div>
                    ) : (
                        <>
                            {/* Type Dropdown */}
                            <div className="p-3.5 space-y-2">
                                <span className="text-[11px] font-medium text-foreground">Type</span>
                                <FigmaSelect
                                    value={currentLight.type}
                                    disabled={isKey}
                                    onChange={(e) => updateLight({ type: e.target.value as LightSourceType })}
                                    className={`w-full h-8 px-2.5 rounded-lg bg-surface-elevated border border-border/80 text-[11px] text-foreground outline-none transition ${
                                        isKey ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-border'
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
                                <span className="text-[11px] font-medium text-foreground">
                                    Position <span className="text-muted-foreground">(scene units)</span>
                                </span>
                                <AxisFields
                                    className="grid grid-cols-2 gap-2"
                                    fields={[
                                        {
                                            key: "0",
                                            label: "X",
                                            value: currentLight.position.x * 6,
                                            step: 0.3,
                                            decimals: 1,
                                            onChange: (x) => updateLight({ position: { ...currentLight.position, x: x / 6 } }),
                                        },
                                        {
                                            key: "1",
                                            label: "Y",
                                            value: currentLight.position.y * 6,
                                            step: 0.3,
                                            decimals: 1,
                                            onChange: (y) => updateLight({ position: { ...currentLight.position, y: y / 6 } }),
                                        },
                                    ]}
                                />
                            </div>

                            {/* Depth: Z */}
                            <div className="p-3.5 space-y-2">
                                <span className="text-[11px] font-medium text-foreground">
                                    Depth <span className="text-muted-foreground">(scene units)</span>
                                </span>
                                <ScrubInput
                                    label="Z"
                                    value={currentLight.position.z * 5}
                                    step={0.25}
                                    decimals={1}
                                    onChange={(z) => updateLight({ position: { ...currentLight.position, z: z / 5 } })}
                                />
                            </div>

                            {/* Aim at controls */}
                            <details
                                className="group border-t border-white/[0.06] px-3.5 py-2"
                                open={aimOpen}
                                onToggle={(e) => setAimOpen(e.currentTarget.open)}
                            >
                                <summary className="flex items-center justify-between cursor-pointer select-none text-[11px] font-medium text-foreground hover:text-white transition list-none [&::-webkit-details-marker]:hidden">
                                    <span>Aim controls</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="pt-2 -mx-3.5">
                                    {hasTarget && (
                                        <div className="p-3.5 space-y-2">
                                            <span className="text-[11px] font-medium text-foreground">Aim at</span>
                                            <AxisFields
                                                className="grid grid-cols-2 gap-2 mb-2"
                                                fields={[
                                                    {
                                                        key: "0",
                                                        label: "X",
                                                        value: target.x * 6,
                                                        step: 0.3,
                                                        decimals: 1,
                                                        onChange: (x) => updateLight({ target: { ...target, x: x / 6 } }),
                                                    },
                                                    {
                                                        key: "1",
                                                        label: "Y",
                                                        value: target.y * 6,
                                                        step: 0.3,
                                                        decimals: 1,
                                                        onChange: (y) => updateLight({ target: { ...target, y: y / 6 } }),
                                                    },
                                                ]}
                                            />
                                            <ScrubInput
                                                label="Z"
                                                value={target.z * 5}
                                                step={0.25}
                                                decimals={1}
                                                onChange={(z) => updateLight({ target: { ...target, z: z / 5 } })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </details>

                            {/* Effect: Intensity + Temperature with live Kelvin indicator */}
                            <div className="p-3.5 space-y-2">
                                <span className="text-[11px] font-medium text-foreground">Effect</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <ScrubInput
                                        label="Power"
                                        value={currentLight.intensity}
                                        min={0}
                                        max={10}
                                        step={0.1}
                                        decimals={1}
                                        onChange={(intensity) => updateLight({ intensity })}
                                    />
                                    <div className="space-y-1">
                                        <ScrubInput
                                            label="Temperature"
                                            value={currentLight.temperature ?? 6500}
                                            min={1000}
                                            max={12000}
                                            step={100}
                                            unit="K"
                                            onChange={(temperature) => updateLight({ temperature })}
                                        />
                                        <div
                                            className="h-1.5 w-full rounded-full border border-white/10"
                                            style={{ backgroundColor: kelvinPreviewColor }}
                                            title={`Temperature color: ${kelvinPreviewColor}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Color */}
                            <div className="p-3.5 space-y-2">
                                <span className="text-[11px] font-medium text-foreground">Color</span>
                                <ColorPicker
                                    color={currentLight.color || '#ffffff'}
                                    label="Color"
                                    compact={false}
                                    showGradientMode={false}
                                    onChange={(color) => updateLight({ color })}
                                />
                            </div>

                            {/* Advanced controls */}
                            <details
                                className="group border-t border-white/[0.06] px-3.5 py-2"
                                open={advancedOpen}
                                onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
                            >
                                <summary className="flex items-center justify-between cursor-pointer select-none text-[11px] font-medium text-foreground hover:text-white transition list-none [&::-webkit-details-marker]:hidden">
                                    <span>Advanced controls</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="pt-2 -mx-3.5 space-y-3">
                                    {/* Cone (Spot light) */}
                                    {currentLight.type === 'spot' && (
                                        <div className="p-3.5 space-y-2">
                                            <span className="text-[11px] font-medium text-foreground">Cone</span>
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
                                            <span className="text-[11px] font-medium text-foreground">Range</span>
                                            <ScrubInput
                                                label="Reach"
                                                value={currentLight.distance ?? 5}
                                                min={0.5}
                                                max={100}
                                                step={0.5}
                                                decimals={1}
                                                unit="u"
                                                onChange={(distance) => updateLight({ distance })}
                                            />
                                        </div>
                                    )}

                                    {/* Size (Area light) */}
                                    {currentLight.type === 'area' && (
                                        <div className="p-3.5 space-y-2">
                                            <span className="text-[11px] font-medium text-foreground">Size</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <ScrubInput
                                                    label="Width"
                                                    value={currentLight.width ?? 3}
                                                    min={0.2}
                                                    max={50}
                                                    step={0.2}
                                                    decimals={1}
                                                    unit="u"
                                                    onChange={(width) => updateLight({ width })}
                                                />
                                                <ScrubInput
                                                    label="Height"
                                                    value={currentLight.height ?? 3}
                                                    min={0.2}
                                                    max={50}
                                                    step={0.2}
                                                    decimals={1}
                                                    unit="u"
                                                    onChange={(height) => updateLight({ height })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Shadows */}
                                    {currentLight.type !== 'area' && currentLight.type !== 'ambient' && (
                                        <div className="p-3.5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-foreground">Shadows</span>
                                                <CheckboxRow
                                                    label={<>Cast shadows</>}
                                                    rowClassName="flex items-center gap-2 cursor-pointer text-[10px] text-muted-foreground"
                                                    checked={currentLight.castShadow !== false}
                                                    onChange={(e) => updateLight({ castShadow: e.target.checked })}
                                                    className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <ScrubInput
                                                    label="Strength"
                                                    value={Math.round(((isKey ? shotLight?.shadowStrength : currentLight.shadowStrength) ?? 0.7) * 100)}
                                                    min={0}
                                                    max={100}
                                                    unit="%"
                                                    onChange={(value) => isKey
                                                        ? updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, shadowStrength: value / 100 } }))
                                                        : updateLight({ shadowStrength: value / 100 })}
                                                />
                                                <ScrubInput
                                                    label="Soft"
                                                    value={(isKey ? shotLight?.shadowSoftness : currentLight.shadowSoftness) ?? 50}
                                                    min={0}
                                                    max={100}
                                                    unit="%"
                                                    onChange={(value) => isKey
                                                        ? updateShot(activeShot.id, (shot) => ({ ...shot, light: { ...shot.light, shadowSoftness: value } }))
                                                        : updateLight({ shadowSoftness: value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </>
                    )}

                    <div className="p-3.5 border-t border-white/[0.06]">
                        <SceneLightsList
                            activeShot={activeShot}
                            selectedLightId={selectedLightId}
                            onSelectLight={(id) => { if (id) selectLight(id); else onClose(); }}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

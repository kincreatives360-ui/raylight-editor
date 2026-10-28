import React, { useState } from 'react';
import {
    Sun,
    Flashlight,
    Lightbulb,
    Square,
    Eye,
    EyeOff,
    Copy,
    Trash2,
    Plus,
    ChevronDown,
} from 'lucide-react';
import type { Shot, SceneLight, LightSourceType } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { generateId } from '../../../model/id';

export interface SceneLightsListProps {
    activeShot: Shot;
    selectedLightId: string | null;
    onSelectLight: (id: string | null) => void;
    className?: string;
    compact?: boolean;
}

export const SceneLightsList: React.FC<SceneLightsListProps> = ({
    activeShot,
    selectedLightId,
    onSelectLight,
    className = '',
    compact: _compact = false,
}) => {
    const updateShot = useProjectStore((s) => s.updateShot);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [editingLightId, setEditingLightId] = useState<string | null>(null);

    const shotLight = activeShot.light;
    const keyEnabled = shotLight?.keyLightEnabled !== false;
    const sources = shotLight?.sources || [];

    const handleToggleKeyLight = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentRig = shotLight || {
            position: { x: -0.28, y: 0.36, z: 0.9 },
            intensity: 1.2,
            temperature: 6500,
            ambience: 0.45,
        };
        updateShot(activeShot.id, {
            light: {
                ...currentRig,
                keyLightEnabled: !keyEnabled,
            },
        });
    };

    const handleToggleSource = (e: React.MouseEvent, sourceId: string) => {
        e.stopPropagation();
        if (!shotLight) return;
        const nextSources = sources.map((s) =>
            s.id === sourceId ? { ...s, enabled: !s.enabled } : s
        );
        updateShot(activeShot.id, {
            light: {
                ...shotLight,
                sources: nextSources,
            },
        });
    };

    const handleDuplicateSource = (e: React.MouseEvent, source: SceneLight) => {
        e.stopPropagation();
        if (!shotLight) return;
        const newId = generateId();
        const duplicate: SceneLight = {
            ...source,
            id: newId,
            name: `${source.name || 'Light'} Copy`,
            position: {
                x: Number((source.position.x + 0.1).toFixed(2)),
                y: source.position.y,
                z: source.position.z,
            },
        };
        updateShot(activeShot.id, {
            light: {
                ...shotLight,
                sources: [...sources, duplicate],
            },
        });
        onSelectLight(newId);
    };

    const handleDeleteSource = (e: React.MouseEvent, sourceId: string) => {
        e.stopPropagation();
        if (!shotLight) return;
        const nextSources = sources.filter((s) => s.id !== sourceId);
        updateShot(activeShot.id, {
            light: {
                ...shotLight,
                sources: nextSources,
            },
        });
        if (selectedLightId === sourceId) {
            onSelectLight(null);
        }
    };

    const handleAddLight = (type: LightSourceType) => {
        setAddMenuOpen(false);
        const currentRig = shotLight || {
            position: { x: -0.28, y: 0.36, z: 0.9 },
            intensity: 1.2,
            temperature: 6500,
            ambience: 0.45,
        };
        const newId = generateId();
        const typeNames: Record<LightSourceType, string> = {
            directional: 'Sun',
            spot: 'Spot',
            point: 'Point',
            area: 'Area',
            ambient: 'Ambient',
        };

        const newLight: SceneLight = {
            id: newId,
            name: `${typeNames[type]} ${sources.length + 1}`,
            type,
            enabled: true,
            position: { x: 0, y: 0.5, z: 1.0 },
            target: { x: 0, y: 0, z: 0 },
            intensity: 1.2,
            color: '#ffffff',
            temperature: 6500,
            distance: type === 'point' || type === 'spot' ? 6 : undefined,
            angle: type === 'spot' ? Math.PI / 6 : undefined,
            penumbra: type === 'spot' ? 0.2 : undefined,
            width: type === 'area' ? 3 : undefined,
            height: type === 'area' ? 3 : undefined,
            castShadow: true,
        };

        updateShot(activeShot.id, {
            light: {
                ...currentRig,
                sources: [...sources, newLight],
            },
        });
        onSelectLight(newId);
    };

    const handleRename = (sourceId: string, newName: string) => {
        setEditingLightId(null);
        if (!shotLight || !newName.trim()) return;
        const nextSources = sources.map((s) =>
            s.id === sourceId ? { ...s, name: newName.trim() } : s
        );
        updateShot(activeShot.id, {
            light: {
                ...shotLight,
                sources: nextSources,
            },
        });
    };

    const renderLightIcon = (type: LightSourceType) => {
        switch (type) {
            case 'directional':
                return <Sun className="w-3.5 h-3.5 text-amber-400" />;
            case 'spot':
                return <Flashlight className="w-3.5 h-3.5 text-orange-400" />;
            case 'point':
                return <Lightbulb className="w-3.5 h-3.5 text-yellow-300" />;
            case 'area':
                return <Square className="w-3.5 h-3.5 text-blue-400" />;
            default:
                return <Sun className="w-3.5 h-3.5 text-amber-400" />;
        }
    };

    const isSunSelected =
        selectedLightId === 'sun-key' ||
        selectedLightId === 'key' ||
        selectedLightId === 'sun';

    return (
        <div data-testid="scene-lights-list" className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#e4e4e7] uppercase tracking-wider">
                    Scene Lights
                </span>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setAddMenuOpen(!addMenuOpen)}
                        className="h-6 px-2 rounded bg-white/[0.06] hover:bg-white/10 text-white text-[11px] font-medium flex items-center gap-1 border border-white/10 transition cursor-pointer"
                        title="Add light to scene"
                    >
                        <Plus className="w-3 h-3 text-[#0088ff]" />
                        <span>Add Light</span>
                        <ChevronDown className="w-2.5 h-2.5 text-[#a1a1aa]" />
                    </button>

                    {addMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-[#18181b]/85 backdrop-blur-xl saturate-180 border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] py-1 z-50 text-[11px] origin-top-right">
                            <button
                                type="button"
                                onClick={() => handleAddLight('spot')}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-white/10 text-left text-white transition"
                            >
                                <Flashlight className="w-3.5 h-3.5 text-orange-400" />
                                <span>Spot Light</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddLight('point')}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-white/10 text-left text-white transition"
                            >
                                <Lightbulb className="w-3.5 h-3.5 text-yellow-300" />
                                <span>Point Light</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddLight('area')}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-white/10 text-left text-white transition"
                            >
                                <Square className="w-3.5 h-3.5 text-blue-400" />
                                <span>Area Light</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddLight('directional')}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-white/10 text-left text-white transition"
                            >
                                <Sun className="w-3.5 h-3.5 text-amber-400" />
                                <span>Directional</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <div data-testid="scene-light-item-room" data-selected={selectedLightId === 'room' ? 'true' : 'false'}
                    onClick={() => onSelectLight('room')}
                    className={`group px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] transition cursor-pointer ${selectedLightId === 'room' ? 'bg-[#0088ff]/15 border-[#0088ff]/40 text-white' : 'bg-[#18181b] border-white/[0.06] text-[#d4d4d8] hover:bg-white/[0.04]'}`}>
                    <div className="flex items-center gap-2 min-w-0"><Sun className="w-3.5 h-3.5 text-[#a1a1aa]" /><span className="truncate font-medium">Room</span></div>
                    <span className="text-[10px] text-[#71717a]">Environment</span>
                </div>
                {/* 1. Primary Sun Key Light */}
                <div
                    data-testid="scene-light-item-sun-key"
                    data-selected={isSunSelected ? 'true' : 'false'}
                    onClick={() => onSelectLight('sun-key')}
                    className={`group px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] transition cursor-pointer ${
                        isSunSelected
                            ? 'bg-[#0088ff]/15 border-[#0088ff]/40 text-white'
                            : 'bg-[#18181b] border-white/[0.06] text-[#d4d4d8] hover:bg-white/[0.04] hover:border-white/15'
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {renderLightIcon('directional')}
                        <span className="truncate font-medium">Sun</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={handleToggleKeyLight}
                            title="Toggle light visibility"
                            className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                        >
                            {keyEnabled ? (
                                <Eye className="w-3 h-3 text-[#a1a1aa]" />
                            ) : (
                                <EyeOff className="w-3 h-3 text-red-400" />
                            )}
                        </button>
                    </div>
                </div>

                {/* 2. Additional Light Sources */}
                {sources.map((source) => {
                    const isSelected = selectedLightId === source.id;
                    const isEditing = editingLightId === source.id;

                    return (
                        <div
                            key={source.id}
                            data-testid={`scene-light-item-${source.id}`}
                            data-selected={isSelected ? 'true' : 'false'}
                            onClick={() => onSelectLight(source.id)}
                            className={`group px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] transition cursor-pointer ${
                                isSelected
                                    ? 'bg-[#0088ff]/15 border-[#0088ff]/40 text-white'
                                    : 'bg-[#18181b] border-white/[0.06] text-[#d4d4d8] hover:bg-white/[0.04] hover:border-white/15'
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                {renderLightIcon(source.type)}
                                {isEditing ? (
                                    <input
                                        type="text"
                                        autoFocus
                                        defaultValue={source.name || 'Light'}
                                        onBlur={(e) => handleRename(source.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleRename(source.id, e.currentTarget.value);
                                            } else if (e.key === 'Escape') {
                                                setEditingLightId(null);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-5 px-1 bg-[#121214] border border-[#0088ff] rounded text-white text-[11px] outline-none w-full"
                                    />
                                ) : (
                                    <span
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLightId(source.id);
                                        }}
                                        title="Double click to rename"
                                        className="truncate font-medium"
                                    >
                                        {source.name || 'Light'}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={(e) => handleToggleSource(e, source.id)}
                                    title="Toggle light visibility"
                                    className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                                >
                                    {source.enabled ? (
                                        <Eye className="w-3 h-3 text-[#a1a1aa]" />
                                    ) : (
                                        <EyeOff className="w-3 h-3 text-red-400" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleDuplicateSource(e, source)}
                                    title="Duplicate light"
                                    className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer opacity-0 group-hover:opacity-100"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteSource(e, source.id)}
                                    title="Delete light"
                                    className="p-1 rounded hover:bg-red-500/20 text-[#a1a1aa] hover:text-red-400 transition cursor-pointer opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

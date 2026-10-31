import { LIGHT_TYPE_META } from '../../../ui/lightTypes';
import { InlineRenameInput } from '../../../ui/InlineRenameInput';
import React, { useState } from 'react';
import {
    Sun,
    Copy,
    Trash2,
    Plus,
    ChevronDown,
} from 'lucide-react';
import type { Shot, SceneLight, LightSourceType } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { SceneLightRow } from './SceneLightRow';
import { LightTypeIcon } from '../../../ui/LightTypeIcon';
import { IconButton } from '../../../ui/primitives';
import { MenuSurface, MenuItem } from '../../../ui/Menu';
import { Eye, EyeOff } from 'lucide-react';
import { generateId } from '../../../model/id';
import { useSelectionStore } from '../../../store/useSelectionStore';

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
    const setActiveLightTool = useSelectionStore((s) => s.setActiveLightTool);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [editingLightId, setEditingLightId] = useState<string | null>(null);

    const shotLight = activeShot.light;
    const keyEnabled = shotLight ? shotLight.keyLightEnabled !== false : false;
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
        if (keyEnabled) onSelectLight(null);
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
        onSelectLight(null);
        setActiveLightTool(type);
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
                        <Plus className="w-3 h-3 text-sky-400" />
                        <span>Add Light</span>
                        <ChevronDown className="w-2.5 h-2.5 text-[#a1a1aa]" />
                    </button>

                    {addMenuOpen && (
                        <MenuSurface
                            className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-[#18181b]/85 backdrop-blur-xl saturate-180 border border-white/12 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] py-1 z-50 text-[11px] origin-top-right"
                        >
                            {(['spot', 'point', 'area', 'directional'] as const).map((type) => <MenuItem
                                key={type}
                                unstyled
                                onClick={() => handleAddLight(type)}
                                className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-white/10 text-left text-white transition"
                            >
                                <LightTypeIcon type={type} /><span>{LIGHT_TYPE_META[type].menuLabel}</span>
                            </MenuItem>)}
                        </MenuSurface>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <SceneLightRow id="room" selected={selectedLightId === 'room'} onSelect={() => onSelectLight('room')}
                    environment icon={<Sun className="w-3.5 h-3.5 text-[#a1a1aa]" />}
                    name={<span className="truncate font-medium">Room</span>}
                    actions={<span className="text-[10px] text-[#71717a]">Environment</span>} />
                {/* 1. Primary Sun Key Light */}
                {keyEnabled && <SceneLightRow id="sun-key" selected={isSunSelected} onSelect={() => onSelectLight('sun-key')}
                    icon={<LightTypeIcon type="directional" />} name={<span className="truncate font-medium">Sun</span>}
                    actions={<IconButton
                        unstyled
                        tooltip={false}
                        label="Remove sunlight"
                        title="Remove sunlight"
                        onClick={handleToggleKeyLight}
                        icon={keyEnabled ? <Eye className="w-3 h-3 text-[#a1a1aa]" /> : <EyeOff className="w-3 h-3 text-red-400" />}
                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                    />} />}

                {/* 2. Additional Light Sources */}
                {sources.map((source) => {
                    const isSelected = selectedLightId === source.id;
                    const isEditing = editingLightId === source.id;

                    return (
                        <SceneLightRow key={source.id} id={source.id} selected={isSelected} custom
                            onSelect={() => onSelectLight(source.id)} icon={<LightTypeIcon type={source.type} />}
                            name={<>{isEditing ? (
                                    <InlineRenameInput
                                        type="text"
                                        defaultValue={source.name || 'Light'}
                                        className="h-5 px-1 bg-[#121214] border border-sky-500 rounded text-white text-[11px] outline-none w-full"
                                        onCommit={value => handleRename(source.id, value)}
                                        onCancel={() => setEditingLightId(null)}
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
                                )}</>}
                            actions={<>
                                <IconButton
                                    unstyled
                                    tooltip={false}
                                    label="Toggle light visibility"
                                    title="Toggle light visibility"
                                    onClick={(e) => handleToggleSource(e, source.id)}
                                    icon={source.enabled ? <Eye className="w-3 h-3 text-[#a1a1aa]" /> : <EyeOff className="w-3 h-3 text-red-400" />}
                                    className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer"
                                />
                                <IconButton
                                    unstyled
                                    tooltip={false}
                                    label="Duplicate light"
                                    title="Duplicate light"
                                    onClick={(e) => handleDuplicateSource(e, source)}
                                    icon={<Copy className="w-3 h-3" />}
                                    className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white transition cursor-pointer opacity-0 group-hover:opacity-100"
                                />
                                <IconButton
                                    unstyled
                                    tooltip={false}
                                    label="Delete light"
                                    title="Delete light"
                                    onClick={(e) => handleDeleteSource(e, source.id)}
                                    icon={<Trash2 className="w-3 h-3" />}
                                    className="p-1 rounded hover:bg-red-500/20 text-[#a1a1aa] hover:text-red-400 transition cursor-pointer opacity-0 group-hover:opacity-100"
                                />
                            </>} />
                    );
                })}
            </div>
        </div>
    );
};

import { MenuSurface, MenuItem } from '../../ui/Menu';
import { IconButton } from '../../ui/primitives';
import { SearchField } from '../../ui/SearchField';
import { InlineRenameInput } from '../../ui/InlineRenameInput';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronRight, ChevronDown, Eye, EyeOff, Trash2, Copy, Image as ImageIcon, Square, Circle, Type, Hash, Music, Activity, Video, Sun, Volume2, VolumeX, PanelLeftClose, Play, Pause, Upload, Download, FolderOpen, RotateCcw } from 'lucide-react';
import { isBlankProjectState, type Shot, type Layer, type Group, type AudioClip } from '../../model/types';
import { isLayerEffectivelyHidden } from '../../engine/evaluateShot';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { BUILTIN_SOUND_PACKS } from '../../engine/soundPacks';
import { CURATED_SOUNDS } from '../../data/curatedSounds';
import { getSoundCategoryLabels, normalizeSoundCategory } from '../../data/soundCategories';
import { exportProjectToFile, importProjectFromFile, useStorageStatus } from '../../storage/projectIO';
import { createDefaultProject } from '../../model/defaults';
import {
    SHADER_PRESETS,
    SHADER_PRESET_METADATA,
    DEFAULT_SHADER_CONFIGS,
} from '../../model/backgroundPresets';

interface LeftPanelProps {
    activeShot: Shot;
    onUploadClick: () => void;
    audioLabel: string;
    onSelectAudioClick: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = React.memo(({
    activeShot,
    onUploadClick,
    audioLabel,
    onSelectAudioClick,
}) => {
    const {
        project,
        updateProject,
        updateShot,
        updateLayer,
        addLayerToShot,
        addCameraBlockToShot,
        toggleProjectAudioMuted,
        deleteLayerFromShot,
        moveLayerToOrderAndGroup,
        updateGroupInShot,
        addShot,
        duplicateShot,
        deleteShot,
    } = useProjectStore();

    const {
        selectedLayerIds,
        selectedBlockId,
        selectedCameraBlockId,
        selectedPresetType,
        timelineView,
        timelineHeightPx,
        timelineScrollTop,
        expandedTimelineLayerIds,
        selectLayer,
        selectLayerRange,
        setSelectedLayerIds,
        selectShot,
        selectBlock,
        selectCameraBlock,
        selectPreset,
        clearLayerSelection,
        inspectorTab,
        setInspectorTab,
        setTimelineView,
        setTimelineScrollTop,
        toggleTimelineLayerExpanded,
        toggleLeftPanel,
        leftPanelWidth,
    } = useSelectionStore();

    const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
    const expandedTimelineLayerSet = useMemo(
        () => new Set(expandedTimelineLayerIds),
        [expandedTimelineLayerIds]
    );

    const setCurrentTimeMs = usePlayheadStore((s) => s.setCurrentTimeMs);

    const [activeTab, setActiveTab] = useState<'file' | 'assets'>('file');
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [assetCategory, setAssetCategory] = useState<'uploads' | 'shaders' | 'sfx'>('uploads');
    const [selectedSfxCategory, setSelectedSfxCategory] = useState<string>('All');
    const [soundSearchQuery, setSoundSearchQuery] = useState<string>('');
    const [playingSfxId, setPlayingSfxId] = useState<string | null>(null);
    const activeAudioRef = useRef<HTMLAudioElement | null>(null);
    const projectFileInputRef = useRef<HTMLInputElement | null>(null);
    const storage = useStorageStatus();

    const handleImportProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        try {
            const result = await importProjectFromFile(file);
            if (result.success) {
                updateProject(() => result.data);
                setProjectMenuOpen(false);
            } else {
                alert(`Could not load project: ${result.errors[0] || 'Invalid file format'}`);
            }
        } catch (err) {
            alert(`Error reading project file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    useEffect(() => {
        return () => {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
        };
    }, []);

    const handleTogglePreviewSound = (id: string, src: string) => {
        if (playingSfxId === id) {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
            setPlayingSfxId(null);
            return;
        }

        if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current = null;
        }

        const audio = new Audio(src);
        activeAudioRef.current = audio;
        setPlayingSfxId(id);
        audio.onended = () => {
            if (activeAudioRef.current === audio) {
                activeAudioRef.current = null;
                setPlayingSfxId(null);
            }
        };
        audio.onerror = () => {
            if (activeAudioRef.current === audio) {
                activeAudioRef.current = null;
                setPlayingSfxId(null);
            }
        };
        audio.play().catch(() => {
            setPlayingSfxId(null);
        });
    };

    const soundItems = useMemo(() => [
        ...CURATED_SOUNDS.map((sound) => ({
            id: sound.slug,
            name: sound.name,
            category: normalizeSoundCategory(sound.category),
            durationMs: sound.durationMs,
            description: `${sound.category} sound effect`,
            getUrl: () => sound.src,
        })),
        ...BUILTIN_SOUND_PACKS.map((sound) => ({
            id: sound.id,
            name: sound.name,
            category: normalizeSoundCategory(sound.category),
            durationMs: sound.durationMs,
            description: sound.description,
            getUrl: () => sound.generateWavDataUrl(),
        })),
    ], []);

    const soundCategories = useMemo(
        () => getSoundCategoryLabels(soundItems.map((sound) => sound.category)),
        [soundItems]
    );

    const filteredCuratedSounds = useMemo(() => {
        const q = soundSearchQuery.trim().toLowerCase();
        return soundItems.filter((item) => {
            if (selectedSfxCategory !== 'All' && item.category !== selectedSfxCategory) {
                return false;
            }
            if (!q) return true;
            return [item.name, item.category, item.description]
                .some((field) => field.toLowerCase().includes(q));
        });
    }, [soundItems, soundSearchQuery, selectedSfxCategory]);

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedShots, setCollapsedShots] = useState<Record<string, boolean>>(
        {}
    );
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState<string>('');
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const dimensionRepairsInFlight = useRef(new Set<string>());

    // Repair dimensions for assets imported by older builds, which stored 0×0.
    useEffect(() => {
        Object.values(project.assets).forEach((asset) => {
            if ((asset.width > 0 && asset.height > 0) || !asset.dataUrl || dimensionRepairsInFlight.current.has(asset.id)) return;
            if (!asset.mimeType.startsWith('image/') && !asset.mimeType.startsWith('video/')) return;
            dimensionRepairsInFlight.current.add(asset.id);

            const saveDimensions = (width: number, height: number) => {
                if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
                updateProject((current) => {
                    const stored = current.assets[asset.id];
                    if (!stored || (stored.width > 0 && stored.height > 0)) return current;
                    return {
                        ...current,
                        assets: { ...current.assets, [asset.id]: { ...stored, width, height } },
                    };
                }, { skipHistory: true });
            };

            if (asset.mimeType.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    saveDimensions(video.videoWidth, video.videoHeight);
                    video.src = '';
                };
                video.onerror = () => {
                    dimensionRepairsInFlight.current.delete(asset.id);
                    video.src = '';
                };
                video.src = asset.dataUrl;
            } else {
                const image = new Image();
                image.onload = () => saveDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height);
                image.onerror = () => {
                    dimensionRepairsInFlight.current.delete(asset.id);
                };
                image.src = asset.dataUrl;
            }
        });
    }, [project.assets, updateProject]);

    useEffect(() => {
        const primaryId = selectedLayerIds[0];
        if (primaryId && rowRefs.current[primaryId]) {
            rowRefs.current[primaryId]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [selectedLayerIds]);

    const startRename = (id: string, currentName: string) => {
        setEditingId(id);
        setEditingText(currentName);
    };

    const commitLayerRename = (shotId: string, layerId: string) => {
        if (editingText.trim()) {
            updateLayer(shotId, layerId, (l) => ({
                ...l,
                name: editingText.trim(),
            }));
        }
        setEditingId(null);
    };

    const commitGroupRename = (shotId: string, groupId: string) => {
        if (editingText.trim()) {
            updateGroupInShot(shotId, groupId, (g) => ({
                ...g,
                name: editingText.trim(),
            }));
        }
        setEditingId(null);
    };

    const commitShotRename = (shotId: string) => {
        if (editingText.trim()) {
            updateShot(shotId, (s) => ({
                ...s,
                name: editingText.trim(),
            }));
        }
        setEditingId(null);
    };

    const normalizedSearch = searchQuery.trim().toLowerCase();

    const renderLayerIcon = (layer: Layer, isSelected: boolean) => {
        if (layer.kind === 'video') {
            return (
                <Video
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#38bdf8]' : 'text-[#38bdf8]'}`}
                />
            );
        }
        if (layer.kind === 'image') {
            return (
                <ImageIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#38bdf8]' : 'text-[#0ea5e9]'
                        }`}
                />
            );
        }
        if (layer.kind === 'shape') {
            return layer.shape === 'ellipse' ? (
                <Circle className="w-3.5 h-3.5 shrink-0 text-[#8b5cf6]" />
            ) : (
                <Square className="w-3.5 h-3.5 shrink-0 text-[#8b5cf6]" />
            );
        }
        return (
            <Type
                className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#ec4899]'
                    }`}
            />
        );
    };

    const renderLayerRow = (
        shot: Shot,
        layer: Layer,
        orderedIdsInShot: string[],
        indentLevel = 1,
        isInsideSelectedContainer = false
    ) => {
        if (
            normalizedSearch &&
            !layer.name.toLowerCase().includes(normalizedSearch)
        ) {
            return null;
        }

        const isSelected =
            shot.id === activeShot.id && selectedLayerSet.has(layer.id);
        const isEditing = editingId === layer.id;
        const isDragTarget = dragOverId === layer.id;

        return (
            <div
                key={layer.id}
                ref={(el) => {
                    rowRefs.current[layer.id] = el;
                }}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData(
                        'application/x-raylight-layer',
                        JSON.stringify({ shotId: shot.id, layerId: layer.id })
                    );
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverId(layer.id);
                }}
                onDragLeave={() => {
                    if (dragOverId === layer.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverId(null);
                    const raw = e.dataTransfer.getData('application/x-raylight-layer');
                    if (!raw) return;
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed.shotId === shot.id && parsed.layerId !== layer.id) {
                            moveLayerToOrderAndGroup(
                                shot.id,
                                parsed.layerId,
                                layer.id,
                                layer.groupId
                            );
                        }
                    } catch {
                        // Ignore invalid drag-and-drop payload
                    }
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setInspectorTab('layer');
                    if (shot.id !== activeShot.id) {
                        selectShot(shot.id, layer.id);
                        setCurrentTimeMs(shot.startMs + 100);
                        return;
                    }
                    if (e.shiftKey) {
                        selectLayerRange(orderedIdsInShot, layer.id);
                    } else if (e.metaKey || e.ctrlKey) {
                        selectLayer(layer.id, true);
                    } else {
                        selectLayer(layer.id, false);
                    }
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(layer.id, layer.name);
                }}
                role="treeitem"
                tabIndex={0}
                aria-selected={isSelected}
                aria-label={`${layer.name}, ${layer.kind} layer`}
                onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (isEditing) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setInspectorTab('layer');
                        if (shot.id !== activeShot.id) {
                            selectShot(shot.id, layer.id);
                            setCurrentTimeMs(shot.startMs + 100);
                        } else {
                            selectLayer(layer.id, false);
                        }
                    } else if (e.key === 'F2') {
                        e.preventDefault();
                        e.stopPropagation();
                        startRename(layer.id, layer.name);
                    }
                }}
                style={{ paddingLeft: `${12 + indentLevel * 14}px` }}
                className={`group h-7 pr-2 flex items-center justify-between text-[11px] cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${isDragTarget ? 'border-t border-[#0088ff]' : ''
                    } ${isSelected || isInsideSelectedContainer
                        ? 'bg-[#09355c] text-white font-medium'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.04]'
                    } ${isLayerEffectivelyHidden(layer, shot.groups) ? 'opacity-40' : ''}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {renderLayerIcon(layer, isSelected)}
                    {isEditing ? (
                        <InlineRenameInput
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-black/90 border border-[#0088ff] rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                            onCommit={() => commitLayerRename(shot.id, layer.id)}
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <span className="truncate">{layer.name}</span>
                    )}
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label={layer.hidden ? `Show ${layer.name}` : `Hide ${layer.name}`}
                        icon={<>
                            {layer.hidden ? (
                                <EyeOff className="w-3 h-3 text-rose-400" />
                            ) : (
                                <Eye className="w-3 h-3" />
                            )}
                        </>}
                        onClick={(e) => {
                            e.stopPropagation();
                            updateLayer(shot.id, layer.id, (l) => ({
                                ...l,
                                hidden: !l.hidden,
                            }));
                        }}
                        title={layer.hidden ? "Show layer" : "Hide layer"}
                        className="p-1 rounded hover:bg-white/10 text-gray-300 cursor-pointer"
                    />
                    <IconButton
                        unstyled
                        tooltip={false}
                        label={`Delete ${layer.name}`}
                        icon={<>
                            <Trash2 className="w-3 h-3" />
                        </>}
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteLayerFromShot(shot.id, layer.id);
                        }}
                        title="Delete layer"
                        className="p-1 rounded hover:bg-rose-500/20 text-gray-300 hover:text-rose-400 cursor-pointer"
                    />
                </div>
            </div>
        );
    };

    const renderGroupNode = (
        shot: Shot,
        group: Group,
        layersTopDown: Layer[],
        orderedIdsInShot: string[],
        indentLevel = 1
    ): React.ReactNode => {
        const childLayers = layersTopDown.filter((l) => l.groupId === group.id);
        const isGroupSelected =
            shot.id === activeShot.id &&
            childLayers.length > 0 &&
            childLayers.every((l) => selectedLayerSet.has(l.id));
        const isEditing = editingId === group.id;

        return (
            <div
                key={group.id}
                className={
                    isGroupSelected ? 'rounded-lg overflow-hidden my-0.5' : 'my-0.5'
                }
            >
                <div
                    role="treeitem"
                    tabIndex={isGroupSelected ? 0 : -1}
                    aria-selected={isGroupSelected}
                    aria-expanded={!group.collapsed}
                    aria-label={`${group.name} group`}
                    style={{ paddingLeft: `${8 + indentLevel * 12}px` }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setInspectorTab('layer');
                        selectShot(shot.id);
                        setSelectedLayerIds(childLayers.map((l) => l.id));
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(group.id, group.name);
                    }}
                    className={`group h-7 pr-2 flex items-center justify-between text-[11px] cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff] ${isGroupSelected
                        ? 'bg-[#0088ff] text-white font-semibold'
                        : 'text-[#d4d4d8] hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <IconButton
                            unstyled
                            tooltip={false}
                            label={group.collapsed ? `Expand group ${group.name}` : `Collapse group ${group.name}`}
                            icon={<>
                                {group.collapsed ? (
                                    <ChevronRight className="w-3 h-3 opacity-70" />
                                ) : (
                                    <ChevronDown className="w-3 h-3 opacity-70" />
                                )}
                            </>}
                            onClick={(e) => {
                                e.stopPropagation();
                                updateGroupInShot(shot.id, group.id, (g) => ({
                                    ...g,
                                    collapsed: !g.collapsed,
                                }));
                            }}
                            className="p-0.5 cursor-pointer"
                        />
                        <Hash
                            className={`w-3.5 h-3.5 shrink-0 ${isGroupSelected ? 'text-white' : 'text-[#0088ff]'
                                }`}
                        />
                        {isEditing ? (
                            <InlineRenameInput
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full bg-black/90 border border-white rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                                onCommit={() => commitGroupRename(shot.id, group.id)}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <span className="truncate">{group.name}</span>
                        )}
                    </div>
                </div>

                {!group.collapsed && (
                    <div>
                        {childLayers.map((lyr) =>
                            renderLayerRow(
                                shot,
                                lyr,
                                orderedIdsInShot,
                                indentLevel + 1,
                                isGroupSelected
                            )
                        )}
                    </div>
                )}
            </div>
        );
    };

    const assetList = Object.values(project.assets);
    const hasCameraBlocks = (activeShot.cameraBlocks?.length || 0) > 0;
    const hasLightBlocks = (activeShot.lightBlocks?.length || 0) > 0;

    return (
        <aside
            style={{ width: `${leftPanelWidth}px` }}
            className="border-r border-white/[0.07] bg-[#0b0b0d] flex flex-col shrink-0 text-xs select-none h-full relative"
        >
            {/* 1. TOP HEADER: [R Canvas v] + [+] */}
            <div className="h-11 px-3 flex items-center justify-between shrink-0 relative">
                {/* Hidden Project JSON File Input */}
                <input
                    ref={projectFileInputRef}
                    type="file"
                    accept=".json,.raylight.json,application/json"
                    onChange={handleImportProjectFile}
                    className="hidden"
                    aria-hidden="true"
                />

                <button
                    onClick={() => setProjectMenuOpen((v) => !v)}
                    aria-expanded={projectMenuOpen}
                    aria-haspopup="menu"
                    title={`Project Menu • ${storage.message}`}
                    className="px-2.5 py-1 rounded-full bg-[#18181b] hover:bg-[#222226] border border-white/[0.07] flex items-center gap-1.5 text-[11px] font-semibold text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                >
                    <span className="font-bold tracking-tight text-sm leading-none">
                        R
                    </span>
                    <span>Canvas</span>
                    <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                            storage.status === 'saved'
                                ? 'bg-emerald-400'
                                : storage.status === 'saving'
                                ? 'bg-sky-400 animate-pulse'
                                : storage.status === 'warning'
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                        }`}
                        title={storage.message}
                    />
                    <ChevronDown className="w-3 h-3 text-[#a1a1aa]" />
                </button>

                {projectMenuOpen && (
                    <MenuSurface className="absolute top-11 left-3 w-60 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 text-xs z-50">
                        <div className="px-2.5 py-1.5 border-b border-white/[0.08] mb-1">
                            <div className="font-semibold text-white truncate text-[11px]">{project.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#a1a1aa]">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    storage.status === 'saved'
                                        ? 'bg-emerald-400'
                                        : storage.status === 'saving'
                                        ? 'bg-sky-400 animate-pulse'
                                        : storage.status === 'warning'
                                        ? 'bg-amber-400'
                                        : 'bg-rose-400'
                                }`} />
                                <span className="truncate">{storage.message}</span>
                            </div>
                        </div>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                exportProjectToFile(project);
                                setProjectMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-[#38bdf8]" />
                            <span>Export Project (.raylight.json)</span>
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                projectFileInputRef.current?.click();
                                setProjectMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                            <span>Import Project File...</span>
                        </MenuItem>
                        <div className="my-1 border-t border-white/[0.08]" />
                        <MenuItem
                            unstyled
                            onClick={() => {
                                setTimelineView(timelineView === 'video' ? 'scene' : 'video');
                                setProjectMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-[#a1a1aa] hover:text-white hover:bg-white/5 cursor-pointer"
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Switch to {timelineView === 'video' ? 'Scene (3D Layers)' : 'Video (Timeline Clips)'}</span>
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                if (window.confirm('Reset this project to a fresh blank canvas? Unsaved changes will be replaced.')) {
                                    updateProject(() => createDefaultProject());
                                    setProjectMenuOpen(false);
                                }
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>New Blank Project</span>
                        </MenuItem>
                    </MenuSurface>
                )}

                <div className="flex items-center gap-1">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Add blank shot, layer, or camera"
                        icon={<>
                            <Plus className="w-3.5 h-3.5" />
                        </>}
                        onClick={() => setAddMenuOpen((v) => !v)}
                        aria-expanded={addMenuOpen}
                        aria-haspopup="menu"
                        className="w-7 h-7 rounded-full bg-[#18181b] hover:bg-[#242429] border border-white/[0.07] flex items-center justify-center text-[#d4d4d8] hover:text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                        title="Add Blank Shot, Layer, or Camera"
                    />

                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Collapse Left Panel ( [ )"
                        icon={<>
                            <PanelLeftClose className="w-3.5 h-3.5" />
                        </>}
                        onClick={toggleLeftPanel}
                        className="w-7 h-7 rounded-full hover:bg-[#18181b] border border-transparent hover:border-white/[0.07] flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                        title="Collapse Left Panel ( [ )"
                    />
                </div>

                {addMenuOpen && (
                    <MenuSurface
                        className="absolute top-11 right-3 w-48 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 text-xs z-50"
                    >
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const created = addShot();
                                selectShot(created.id);
                                setInspectorTab('shot');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + Blank Shot (Scene)
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'image');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + Image Layer
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'shape');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + Rectangle Shape
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'text');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + 3D Text Layer
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const block = addCameraBlockToShot(activeShot.id);
                                if (!block) return;
                                selectCameraBlock(block.id);
                                setTimelineView('scene');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-emerald-400 hover:bg-white/5 cursor-pointer border-t border-white/10 mt-1 pt-1.5"
                        >
                            + Add Camera Move
                        </MenuItem>
                    </MenuSurface>
                )}
            </div>

            {/* 2. SUB-HEADER: Clean [File] | [Assets] + Search Icon */}
            <div className="h-9 border-y border-white/[0.07] px-3 flex items-center justify-between shrink-0" role="tablist" aria-label="Left panel views">
                <div className="flex items-center gap-1.5">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'file'}
                        onClick={() => setActiveTab('file')}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${activeTab === 'file'
                            ? 'bg-[#1f1f23] text-white shadow-xs'
                            : 'text-[#a1a1aa] hover:text-white'
                            }`}
                    >
                        File
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'assets'}
                        onClick={() => setActiveTab('assets')}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${activeTab === 'assets'
                            ? 'bg-[#1f1f23] text-white shadow-xs'
                            : 'text-[#a1a1aa] hover:text-white'
                            }`}
                    >
                        Assets
                    </button>
                </div>

                <IconButton
                    unstyled
                    tooltip={false}
                    label="Search layers"
                    icon={<>
                        <Search className="w-3.5 h-3.5" />
                    </>}
                    onClick={() => {
                        setSearchOpen((v) => !v);
                        if (searchOpen) setSearchQuery('');
                    }}
                    className={`p-1 rounded hover:bg-white/5 cursor-pointer ${searchOpen ? 'text-[#0088ff]' : 'text-[#a1a1aa] hover:text-white'
                    }`}
                />
            </div>

            {searchOpen && (
                <SearchField
                    containerClassName="px-3 py-1.5 border-b border-white/[0.07] bg-[#111114] flex items-center gap-1.5"
                    iconClassName="w-3 h-3 text-[#a1a1aa]"
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find layer..."
                    aria-label="Filter layers by name"
                    className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-[#a1a1aa]"
                    onClear={() => setSearchQuery('')}
                    clearButtonClassName="text-[#a1a1aa] hover:text-white cursor-pointer"
                ></SearchField>
            )}

            {/* =================================================================== */}
            {/* FILE TAB: UPPER TREE + LOWER SYNCHRONIZED TIMELINE TRACK RACK       */}
            {/* =================================================================== */}
            {activeTab === 'file' && (
                <div className="flex-1 flex flex-col min-h-0">
                    <div
                        className="flex-1 overflow-y-auto p-2 space-y-1"
                        role="tree"
                        aria-label="Project layer hierarchy"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                clearLayerSelection();
                            }
                        }}
                    >
                        {isBlankProjectState(project) && (
                            <div className="rounded-lg border border-dashed border-white/10 p-3 text-center">
                                <p className="mb-2 text-[11px] text-zinc-400">No shots yet</p>
                                <button
                                    type="button"
                                    aria-label="Add shot"
                                    onClick={() => {
                                        const created = addShot();
                                        selectShot(created.id);
                                        setInspectorTab('shot');
                                        setCurrentTimeMs(created.startMs + 100);
                                    }}
                                    className="rounded-md px-2 py-1 text-[11px] text-sky-300 hover:bg-white/5"
                                >
                                    + Add shot
                                </button>
                            </div>
                        )}
                        {project.shots.filter((shot) => !shot.isPlaceholder && !(isBlankProjectState(project) && shot === project.shots[0])).map((shot) => {
                            const isShotSelected = shot.id === activeShot.id && inspectorTab === 'shot' && selectedLayerIds.length === 0;
                            const isCollapsed = Boolean(collapsedShots[shot.id]);
                            const isEditingShot = editingId === shot.id;

                            const layersTopDown = [...shot.layers].sort(
                                (a, b) => b.order - a.order
                            );
                            const orderedIdsInShot = layersTopDown.map((l) => l.id);
                            const rootGroups = shot.groups.filter((g) => !g.parentGroupId);
                            const ungroupedLayers = layersTopDown.filter((l) => !l.groupId);

                            return (
                                <div
                                    key={shot.id}
                                    className={
                                        isShotSelected
                                            ? 'rounded-lg overflow-hidden my-1'
                                            : 'my-0.5'
                                    }
                                >
                                    <div
                                        onClick={() => {
                                            selectShot(shot.id);
                                            setInspectorTab('shot');
                                            setCurrentTimeMs(shot.startMs + 100);
                                        }}
                                        onDoubleClick={() => startRename(shot.id, shot.name)}
                                        className={`group h-7 px-2 flex items-center justify-between text-[11px] cursor-pointer transition rounded-lg ${isShotSelected
                                            ? 'bg-[#0088ff] text-white font-semibold'
                                            : 'text-[#d4d4d8] hover:bg-white/[0.04]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            <IconButton
                                                unstyled
                                                tooltip={false}
                                                label={`${isCollapsed ? 'Expand' : 'Collapse'} ${shot.name} layers`}
                                                icon={<>
                                                    {isCollapsed ? (
                                                        <ChevronRight className="w-3 h-3 opacity-70" />
                                                    ) : (
                                                        <ChevronDown className="w-3 h-3 opacity-70" />
                                                    )}
                                                </>}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCollapsedShots((prev) => ({
                                                        ...prev,
                                                        [shot.id]: !prev[shot.id],
                                                    }));
                                                }}
                                                className="p-0.5 cursor-pointer"
                                            />
                                            <Hash
                                                className={`w-3.5 h-3.5 shrink-0 ${isShotSelected
                                                    ? 'text-white'
                                                    : 'text-[#38bdf8]'
                                                    }`}
                                            />
                                            {isEditingShot ? (
                                                <InlineRenameInput
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    className="w-full bg-black/90 border border-white rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                                                    onCommit={() => commitShotRename(shot.id)}
                                                    onCancel={() => setEditingId(null)}
                                                />
                                            ) : (
                                                <span className="truncate">{shot.name}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                            <IconButton
                                                unstyled
                                                tooltip={false}
                                                label={`Duplicate shot ${shot.name}`}
                                                icon={<>
                                                    <Copy className="w-3 h-3" />
                                                </>}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const copy = duplicateShot(shot.id);
                                                    if (copy) {
                                                        selectShot(copy.id);
                                                        setInspectorTab('shot');
                                                        setCurrentTimeMs(copy.startMs + 100);
                                                    }
                                                }}
                                                title="Duplicate Shot"
                                                className="p-1 rounded hover:bg-black/20 cursor-pointer"
                                            />
                                            <IconButton
                                                    unstyled
                                                    tooltip={false}
                                                    label={`Delete shot ${shot.name}`}
                                                    icon={<>
                                                        <Trash2 className="w-3 h-3" />
                                                    </>}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteShot(shot.id);
                                                    }}
                                                    title="Delete Shot"
                                                    className="p-1 rounded hover:bg-rose-500/40 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div>
                                            {rootGroups.map((grp) =>
                                                renderGroupNode(
                                                    shot,
                                                    grp,
                                                    layersTopDown,
                                                    orderedIdsInShot,
                                                    1
                                                )
                                            )}
                                            {ungroupedLayers.map((lyr) =>
                                                renderLayerRow(
                                                    shot,
                                                    lyr,
                                                    orderedIdsInShot,
                                                    1,
                                                    false
                                                )
                                            )}
                                            {shot.layers.length === 0 && (
                                                <div className="px-5 py-2 text-[10px] text-[var(--text-muted,#a1a1aa)] italic">
                                                    No layers in this shot
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* =============================================================== */}
                    {/* SYNCHRONIZED LOWER TIMELINE RACK (Matches Timeline Height & Scroll!) */}
                    {/* =============================================================== */}
                    {timelineView === 'scene' && (
                        <div
                            style={{ height: `${timelineHeightPx}px` }}
                            className="border-t border-white/[0.08] bg-[#0b0b0d] flex flex-col shrink-0"
                        >
                            {/* Header Spacer matching Timeline Transport (h-8) + Ruler (h-6) = 56px (h-14) */}
                            <div className="h-14 border-b border-white/[0.06] px-3 flex items-center text-[10px] font-mono text-[#a1a1aa] shrink-0">
                                <span className="truncate">{activeShot.name} TRACKS</span>
                            </div>

                            {/* Track labels move with the main timeline scroll; only the timeline owns a scrollbar. */}
                            <div
                                className="flex-1 overflow-hidden"
                                onWheel={(event) => {
                                    event.preventDefault();
                                    const timelineScroller = document.getElementById('timeline-tracks-scroll');
                                    if (timelineScroller) {
                                        timelineScroller.scrollTop += event.deltaY;
                                    } else {
                                        setTimelineScrollTop(Math.max(0, timelineScrollTop + event.deltaY));
                                    }
                                }}
                            >
                                <div
                                    style={{ transform: `translate3d(0, -${timelineScrollTop}px, 0)` }}
                                    className="px-1.5 py-2 flex flex-col gap-0.5"
                                >
                                {/* 0. Media Track Row (Matching Timeline Media row when audio/video clips exist!) */}
                                {(project.audio?.clips?.length || 0) > 0 && (
                                    <div
                                        className="h-7 mb-2 px-2 rounded-md bg-white/[0.025] border border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Music className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                                            <span className="truncate">Media</span>
                                        </div>
                                        <IconButton
                                            unstyled
                                            tooltip={false}
                                            label={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                            icon={<>
                                                {project.audio?.muted ? (
                                                    <VolumeX className="w-3 h-3 text-rose-400" />
                                                ) : (
                                                    <Volume2 className="w-3 h-3 text-slate-300" />
                                                )}
                                            </>}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleProjectAudioMuted();
                                            }}
                                            title={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                            className="p-1 hover:text-white cursor-pointer"
                                        />
                                    </div>
                                )}

                                {/* Add-layer lane is first in the scene timeline. */}
                                <button
                                    onClick={() => {
                                        const layer = addLayerToShot(activeShot.id, 'shape');
                                        selectLayer(layer.id);
                                        setInspectorTab('layer');
                                    }}
                                    className="order-0 h-10 rounded-lg border border-[#087fad] px-2 flex items-center gap-1.5 text-[10px] text-[#91a9b5] hover:border-[#12b8f5] hover:bg-sky-500/[0.07] hover:text-sky-100 cursor-pointer transition"
                                >
                                    <Plus className="w-3 h-3 text-sky-400" />
                                    <span>Add layer</span>
                                </button>

                                {/* Camera track stays visible even before its first move is added. */}
                                <div
                                    onClick={() => {
                                        if (activeShot.cameraBlocks && activeShot.cameraBlocks.length > 0) {
                                            selectCameraBlock(activeShot.cameraBlocks[0].id);
                                        } else {
                                            const block = addCameraBlockToShot(activeShot.id);
                                            if (block) selectCameraBlock(block.id);
                                        }
                                    }}
                                    style={{ order: 30 }}
                                    className={`h-10 px-2 rounded-md flex items-center gap-1.5 text-[11px] cursor-pointer transition ${selectedCameraBlockId
                                        ? 'bg-emerald-600/30 text-emerald-200 font-semibold border border-emerald-500/40'
                                        : hasCameraBlocks
                                            ? 'text-emerald-400 hover:bg-white/[0.04]'
                                            : 'text-[#a1a1aa] hover:text-emerald-300 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <Video className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">Camera</span>
                                </div>

                                {/* 2. Light Track Row (ONLY shown when Light animation is added) */}
                                {hasLightBlocks && (
                                    <div style={{ order: 20 }} className="h-10 px-2 rounded-md flex items-center gap-1.5 text-[11px] text-red-300 hover:bg-white/[0.04] cursor-pointer">
                                        <Sun className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                        <span className="truncate">Lighting Rig</span>
                                    </div>
                                )}

                                {/* 3. Layer Track Rows + Indented ♦ Presets & ♦ Property Sub-rows */}
                                {activeShot.layers
                                    .slice()
                                    .sort((a, b) => b.order - a.order)
                                    .map((layer) => {
                                        const isSelected = selectedLayerSet.has(layer.id);
                                        const hasAnimItems =
                                            layer.entrance.type !== 'none' ||
                                            layer.exit.type !== 'none' ||
                                            layer.blocks.length > 0;
                                        const isExpanded =
                                            expandedTimelineLayerSet.has(layer.id) ||
                                            (isSelected && hasAnimItems);

                                        return (
                                            <div key={`mirror-${layer.id}`} style={{ order: 10 }} className="space-y-0.5">
                                                {/* Main Layer Row (h-7 = 28px) */}
                                                <div
                                                    onClick={() => {
                                                        setInspectorTab('layer');
                                                        selectLayer(layer.id, false);
                                                    }}
                                                    className={`h-10 px-2 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition ${isSelected
                                                        ? 'bg-[#0088ff] text-white font-semibold'
                                                        : 'text-[#d4d4d8] hover:bg-white/[0.04]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        <IconButton
                                                            unstyled
                                                            tooltip={false}
                                                            label="Open options"
                                                            icon={<>
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-3 h-3" />
                                                                ) : (
                                                                    <ChevronRight className="w-3 h-3" />
                                                                )}
                                                            </>}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTimelineLayerExpanded(layer.id);
                                                            }}
                                                            className="p-0.5 cursor-pointer"
                                                        />
                                                        {renderLayerIcon(layer, isSelected)}
                                                        <span className="truncate">{layer.name}</span>
                                                    </div>

                                                    {hasAnimItems && (
                                                        <IconButton
                                                            unstyled
                                                            tooltip={false}
                                                            label={`Toggle ${layer.name} animations`}
                                                            icon={<>
                                                                <Activity className="w-3 h-3" />
                                                            </>}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTimelineLayerExpanded(layer.id);
                                                            }}
                                                            className={`p-0.5 rounded ${isSelected
                                                            ? 'text-white'
                                                            : 'text-[#8b5cf6] bg-[#8b5cf6]/15'
                                                            }`}
                                                        />
                                                    )}
                                                </div>

                                                {/* Sub-rows UNDER the layer name (h-6 = 24px each, matching Timeline sub-rows!) */}
                                                {isExpanded && (
                                                    <div className="space-y-0.5">
                                                        {/* ♦ Presets sub-row (In / Out transitions) */}
                                                        <div
                                                            onClick={() =>
                                                                selectPreset('entrance', layer.id)
                                                            }
                                                            className={`h-9 pl-7 pr-2 rounded flex items-center justify-between text-[10px] cursor-pointer ${isSelected && selectedPresetType
                                                                ? 'bg-purple-500/20 text-purple-200 font-medium'
                                                                : 'text-[#a1a1aa] hover:text-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="w-1.5 h-1.5 rotate-45 bg-[#8b5cf6] shrink-0" />
                                                                <span>Presets</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono tracking-tight opacity-60">
                                                                In/Out
                                                            </span>
                                                        </div>

                                                        {/* ♦ Property Block sub-rows (Position, Tilt, Scale, etc.) */}
                                                        {layer.blocks.map((blk) => (
                                                            <div
                                                                key={blk.id}
                                                                onClick={() => selectBlock(blk.id, layer.id)}
                                                                className={`h-9 pl-7 pr-2 rounded flex items-center justify-between text-[10px] cursor-pointer capitalize ${selectedBlockId === blk.id
                                                                    ? 'bg-purple-500/25 text-white font-medium'
                                                                    : 'text-[#a1a1aa] hover:text-white'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <span className="w-1.5 h-1.5 rotate-45 bg-[#a855f7] shrink-0" />
                                                                    <span className="truncate">
                                                                        {blk.property}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* =================================================================== */}
            {/* ASSETS TAB: UNIFIED STUDIO ASSET LIBRARY                            */}
            {/* =================================================================== */}
            {activeTab === 'assets' && (
                <div className="flex-1 flex flex-col min-h-0 p-3 gap-2.5">
                    {/* Subcategory Navigation Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar shrink-0 border-b border-white/[0.06]">
                        {([
                            { id: 'uploads', label: 'Uploads' },
                            { id: 'shaders', label: 'Shaders' },
                            { id: 'sfx', label: 'Sound FX' },
                        ] as const).map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setAssetCategory(cat.id)}
                                className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition cursor-pointer ${
                                    assetCategory === cat.id
                                        ? 'bg-[#0088ff] text-white shadow-xs'
                                        : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-white/5'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* SUBCATEGORY 1: UPLOADS */}
                    {assetCategory === 'uploads' && (
                        <div className="flex-1 flex flex-col min-h-0 gap-2.5">
                            <button
                                onClick={onUploadClick}
                                className="w-full py-2 px-3 rounded-xl bg-[#0088ff] hover:bg-[#0077e6] text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-[#0088ff]/15"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Upload Media</span>
                            </button>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                                {assetList.map((asset) => (
                                    <div
                                        key={asset.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData(
                                                'application/x-raylight-asset-id',
                                                asset.id
                                            );
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => {
                                            const created = addLayerToShot(activeShot.id, 'image', {
                                                assetId: asset.id,
                                                name: asset.name,
                                                rotation: { x: 0, y: 0, z: 0 },
                                            });
                                            setInspectorTab('layer');
                                            selectLayer(created.id);
                                        }}
                                        className="p-2 rounded-xl bg-[#161619] hover:bg-[#1f1f23] border border-white/[0.06] flex items-center gap-2.5 cursor-grab transition group"
                                    >
                                        <div className="w-10 h-8 rounded-lg bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                            {asset.thumbUrl || asset.dataUrl ? (
                                                <img
                                                    src={asset.thumbUrl || asset.dataUrl}
                                                    alt={asset.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="w-4 h-4 text-[#0088ff]" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[11px] font-medium text-white truncate group-hover:text-[#0088ff] transition-colors">
                                                {asset.name}
                                            </div>
                                            <div className="text-[10px] font-mono text-[#a1a1aa]">
                                                {asset.width}&times;{asset.height}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            title="Set as Canvas Background"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateProject((proj) => ({
                                                    ...proj,
                                                    background: {
                                                        kind: 'image',
                                                        assetId: asset.id,
                                                        src: asset.dataUrl,
                                                        color: '#000000',
                                                        fit: 'cover',
                                                        dim: 0,
                                                        blur: 0,
                                                        opacity: 1,
                                                    },
                                                }));
                                            }}
                                            className="px-2 py-1 rounded-md bg-white/10 hover:bg-[#0088ff] text-[#c4c4cc] hover:text-white text-[10px] font-medium transition cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 shadow-xs"
                                        >
                                            Set Bg
                                        </button>
                                    </div>
                                ))}
                                {assetList.length === 0 && (
                                    <div className="py-10 text-center text-xs text-[#71717a] border border-dashed border-white/10 rounded-xl p-4">
                                        No uploaded media yet.<br />Click Upload Media to add photos or videos.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}



                    {/* SUBCATEGORY 3: SHADERS */}
                    {assetCategory === 'shaders' && (
                        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                            <div className="text-[10px] text-[#71717a] px-0.5 flex justify-between items-center">
                                <span>Animated Shader Presets</span>
                                <span>{SHADER_PRESETS.length} presets</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {SHADER_PRESETS.map((p) => {
                                    const meta = SHADER_PRESET_METADATA[p];
                                    const cfg = DEFAULT_SHADER_CONFIGS[p];
                                    const pColors = cfg?.colors?.length ? cfg.colors : [cfg?.color || '#3b82f6', cfg?.backgroundColor || '#05050a'];
                                    const c1 = pColors[0];
                                    const c2 = pColors[1] || pColors[0];

                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => {
                                                updateProject((proj) => ({
                                                    ...proj,
                                                    background: {
                                                        kind: 'shader',
                                                        preset: p,
                                                        color: c1,
                                                        backgroundColor: c2,
                                                        color1: c1,
                                                        color2: c2,
                                                        color3: pColors[2] || '#06b6d4',
                                                        colors: pColors,
                                                        speed: cfg?.speed ?? 1,
                                                        waves: cfg?.waves ?? 1,
                                                        noiseScale: cfg?.waves ?? 1,
                                                        focus: cfg?.focus ?? 1,
                                                        glow: cfg?.glow ?? 1,
                                                        shine: cfg?.shine ?? 1,
                                                        angle: cfg?.angle ?? 28,
                                                    },
                                                }));
                                            }}
                                            className="p-2 rounded-xl bg-[#161619] hover:bg-[#1f1f23] border border-white/[0.08] hover:border-[#0088ff] text-left transition cursor-pointer flex flex-col gap-1.5 group shadow-xs"
                                        >
                                            <div
                                                className="w-full h-12 rounded-lg border border-white/10 relative overflow-hidden group-hover:scale-105 transition-transform"
                                                style={{
                                                    background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
                                                }}
                                            />
                                            <div>
                                                <div className="text-[11px] font-semibold text-white truncate group-hover:text-[#0088ff] transition-colors">
                                                    {meta?.label || p}
                                                </div>
                                                <div className="text-[10px] text-[#71717a] truncate">
                                                    Procedural GLSL
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* SUBCATEGORY 4: SOUND FX */}
                    {assetCategory === 'sfx' && (
                        <div className="flex-1 flex flex-col min-h-0 gap-2.5">
                            <button
                                type="button"
                                onClick={onSelectAudioClick}
                                className="w-full py-2 px-3 rounded-xl bg-[#0088ff] hover:bg-[#0077e6] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-[#0088ff]/15"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload Audio Track</span>
                            </button>

                            {audioLabel && (
                                <div className="p-2.5 rounded-xl bg-[#161619] border border-white/10 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="text-[11px] font-medium text-white truncate">{audioLabel}</span>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 font-mono shrink-0">Active</span>
                                </div>
                            )}

                            {/* Sound Search Bar */}
                            <SearchField
                                containerClassName="relative"
                                iconClassName="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                type="text"
                                placeholder="Search 150+ sound effects..."
                                value={soundSearchQuery}
                                onChange={(e) => setSoundSearchQuery(e.target.value)}
                                className="w-full bg-[#161619] border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-[#71717a] outline-none focus:border-[#0088ff] transition"
                                onClear={() => setSoundSearchQuery('')}
                                clearButtonClassName="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
                            ></SearchField>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar shrink-0">
                                {soundCategories.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedSfxCategory(cat)}
                                        className={`px-2 py-0.5 rounded-full shrink-0 font-medium transition cursor-pointer ${
                                            selectedSfxCategory === cat
                                                ? 'bg-[#0088ff]/25 text-[#38bdf8] border border-[#0088ff]/50'
                                                : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-white/5'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* SFX List */}
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                                {filteredCuratedSounds.map((sound) => {
                                    const isPlaying = playingSfxId === sound.id;
                                    const durationFormatted = sound.durationMs >= 1000
                                        ? `${(sound.durationMs / 1000).toFixed(1)}s`
                                        : `${sound.durationMs}ms`;

                                    return (
                                        <div
                                            key={sound.id}
                                            className="p-2 rounded-xl bg-[#161619] hover:bg-[#1f1f23] border border-white/[0.06] flex items-center justify-between gap-2 transition"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-white truncate">
                                                        {sound.name}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0088ff]/10 text-[#38bdf8] font-mono tabular-nums tracking-tight shrink-0">
                                                        {durationFormatted}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#a1a1aa] font-medium uppercase tracking-wider">
                                                        {sound.category}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <IconButton
                                                    unstyled
                                                    tooltip={false}
                                                    label={`${isPlaying ? 'Pause' : 'Preview'} ${sound.name}`}
                                                    icon={<>
                                                        {isPlaying ? (
                                                            <Pause className="w-3.5 h-3.5 fill-current" />
                                                        ) : (
                                                            <Play className="w-3.5 h-3.5 fill-current" />
                                                        )}
                                                    </>}
                                                    onClick={() => handleTogglePreviewSound(sound.id, sound.getUrl())}
                                                    title={isPlaying ? "Pause Preview" : "Preview Sound"}
                                                    className={`p-1.5 rounded-lg border transition cursor-pointer ${isPlaying
                                                    ? 'bg-[#0088ff] text-white border-[#38bdf8]'
                                                    : 'bg-[#222226] hover:bg-[#2a2a30] text-[#d4d4d8] border-white/10'
                                                    }`}
                                                />

                                                <IconButton
                                                    unstyled
                                                    tooltip={false}
                                                    label={`Add ${sound.name} to Timeline at playhead`}
                                                    icon={<>
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </>}
                                                    onClick={() => {
                                                        const clip: AudioClip = {
                                                            id: `sfx-${sound.id}-${Date.now()}`,
                                                            name: sound.name,
                                                            dataUrl: sound.getUrl(),
                                                            startMs: usePlayheadStore.getState().currentTimeMs,
                                                            durationMs: sound.durationMs,
                                                            offsetMs: 0,
                                                            volume: 1,
                                                            muted: false,
                                                        };
                                                        updateProject((p) => ({
                                                            ...p,
                                                            audio: {
                                                                clips: [...(p.audio?.clips || []), clip],
                                                                muted: p.audio?.muted || false,
                                                                masterVolume: p.audio?.masterVolume ?? 1,
                                                            },
                                                        }));
                                                    }}
                                                    title="Add to Timeline at Playhead"
                                                    className="p-1.5 rounded-lg bg-[#0088ff]/20 hover:bg-[#0088ff]/30 text-[#38bdf8] border border-[#0088ff]/40 transition cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredCuratedSounds.length === 0 && (
                                    <div className="py-8 text-center text-xs text-[#71717a]">
                                        No sound effects match &quot;{soundSearchQuery}&quot;
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </aside>
    );
});


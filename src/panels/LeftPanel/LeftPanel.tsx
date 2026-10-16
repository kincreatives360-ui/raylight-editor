// src/panels/LeftPanel/LeftPanel.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
    Search,
    X,
    Plus,
    ChevronRight,
    ChevronDown,
    Eye,
    EyeOff,
    Trash2,
    Copy,
    Image as ImageIcon,
    Square,
    Circle,
    Type,
    Hash,
    Music,
    Activity,
    Video,
    Sun,
    Volume2,
    VolumeX,
} from 'lucide-react';
import type { Shot, Layer, Group } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';

interface LeftPanelProps {
    activeShot: Shot;
    onUploadClick: () => void;
    audioLabel: string;
    onSelectAudioClick: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
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
        setInspectorTab,
        setTimelineView,
        setTimelineScrollTop,
        toggleTimelineLayerExpanded,
    } = useSelectionStore();

    const { setCurrentTimeMs } = usePlayheadStore();

    const [activeTab, setActiveTab] = useState<'file' | 'assets'>('file');
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
    const mirrorScrollRef = useRef<HTMLDivElement | null>(null);

    // Keep Left Panel mirror rack scrollTop synced with Timeline scrollTop!
    useEffect(() => {
        const el = mirrorScrollRef.current;
        if (el && Math.abs(el.scrollTop - timelineScrollTop) > 1) {
            el.scrollTop = timelineScrollTop;
        }
    }, [timelineScrollTop]);

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
            shot.id === activeShot.id && selectedLayerIds.includes(layer.id);
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
                    } catch { }
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
                style={{ paddingLeft: `${12 + indentLevel * 14}px` }}
                className={`group h-7 pr-2 flex items-center justify-between text-[11px] cursor-pointer transition ${isDragTarget ? 'border-t border-[#0088ff]' : ''
                    } ${isSelected || isInsideSelectedContainer
                        ? 'bg-[#09355c] text-white font-medium'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.04]'
                    } ${layer.hidden ? 'opacity-40' : ''}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {renderLayerIcon(layer, isSelected)}
                    {isEditing ? (
                        <input
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => commitLayerRename(shot.id, layer.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitLayerRename(shot.id, layer.id);
                                if (e.key === 'Escape') setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-black/90 border border-[#0088ff] rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                        />
                    ) : (
                        <span className="truncate">{layer.name}</span>
                    )}
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            updateLayer(shot.id, layer.id, (l) => ({
                                ...l,
                                hidden: !l.hidden,
                            }));
                        }}
                        className="p-1 rounded hover:bg-white/10 text-gray-300 cursor-pointer"
                    >
                        {layer.hidden ? (
                            <EyeOff className="w-3 h-3 text-rose-400" />
                        ) : (
                            <Eye className="w-3 h-3" />
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteLayerFromShot(shot.id, layer.id);
                        }}
                        className="p-1 rounded hover:bg-rose-500/20 text-gray-300 hover:text-rose-400 cursor-pointer"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
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
            childLayers.every((l) => selectedLayerIds.includes(l.id));
        const isEditing = editingId === group.id;

        return (
            <div
                key={group.id}
                className={
                    isGroupSelected ? 'rounded-lg overflow-hidden my-0.5' : 'my-0.5'
                }
            >
                <div
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
                    className={`group h-7 pr-2 flex items-center justify-between text-[11px] cursor-pointer transition ${isGroupSelected
                            ? 'bg-[#0088ff] text-white font-semibold'
                            : 'text-[#d4d4d8] hover:bg-white/[0.04]'
                        }`}
                >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                updateGroupInShot(shot.id, group.id, (g) => ({
                                    ...g,
                                    collapsed: !g.collapsed,
                                }));
                            }}
                            className="p-0.5 cursor-pointer"
                        >
                            {group.collapsed ? (
                                <ChevronRight className="w-3 h-3 opacity-70" />
                            ) : (
                                <ChevronDown className="w-3 h-3 opacity-70" />
                            )}
                        </button>
                        <Hash
                            className={`w-3.5 h-3.5 shrink-0 ${isGroupSelected ? 'text-white' : 'text-[#0088ff]'
                                }`}
                        />
                        {isEditing ? (
                            <input
                                autoFocus
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={() => commitGroupRename(shot.id, group.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitGroupRename(shot.id, group.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-black/90 border border-white rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
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
        <aside className="w-60 border-r border-white/[0.07] bg-[#0b0b0d] flex flex-col shrink-0 text-xs select-none h-full">
            {/* 1. TOP HEADER: [R Canvas v] + [+] */}
            <div className="h-11 px-3 flex items-center justify-between shrink-0 relative">
                <button
                    onClick={() =>
                        setTimelineView(timelineView === 'video' ? 'scene' : 'video')
                    }
                    className="px-2.5 py-1 rounded-full bg-[#18181b] hover:bg-[#222226] border border-white/[0.07] flex items-center gap-1.5 text-[11px] font-semibold text-white cursor-pointer transition"
                >
                    <span className="font-bold tracking-tight text-sm leading-none">
                        R
                    </span>
                    <span>Canvas</span>
                    <ChevronDown className="w-3 h-3 text-[#71717a]" />
                </button>

                <button
                    onClick={() => setAddMenuOpen((v) => !v)}
                    className="w-7 h-7 rounded-full bg-[#18181b] hover:bg-[#242429] border border-white/[0.07] flex items-center justify-center text-[#d4d4d8] hover:text-white cursor-pointer transition"
                    title="Add Blank Shot, Layer, or Camera"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>

                {addMenuOpen && (
                    <div className="absolute top-11 right-3 w-48 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl p-1 text-xs z-50">
                        <button
                            onClick={() => {
                                const created = addShot();
                                selectShot(created.id);
                                setInspectorTab('shot');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + Blank Shot (Scene)
                        </button>
                        <button
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'image');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + Image Layer
                        </button>
                        <button
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'shape');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + Rectangle Shape
                        </button>
                        <button
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'text');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-white/5 cursor-pointer"
                        >
                            + 3D Text Layer
                        </button>
                        <button
                            onClick={() => {
                                const camId = `cam-blk-${Date.now()}`;
                                updateShot(activeShot.id, (s) => ({
                                    ...s,
                                    cameraBlocks: [
                                        ...(s.cameraBlocks || []),
                                        {
                                            id: camId,
                                            label: 'Camera Move',
                                            startMs: 0,
                                            durationMs: s.durationMs,
                                            fromFramingId: s.framings[0]?.id || 'f1',
                                            toFramingId: s.framings[1]?.id || 'f2',
                                            mode: 'dolly',
                                            easing: { kind: 'preset', name: 'linear' },
                                            from: {
                                                anchorX: 0,
                                                anchorY: 0,
                                                zoom: 1,
                                                roll: 0,
                                                orbit: 0,
                                                tilt: 0,
                                            },
                                            to: {
                                                anchorX: -0.05,
                                                anchorY: 0.02,
                                                zoom: 1.15,
                                                roll: 0,
                                                orbit: 0,
                                                tilt: 0,
                                            },
                                            shake: { from: 0, to: 0 },
                                        },
                                    ],
                                }));
                                selectCameraBlock(camId);
                                setTimelineView('scene');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-emerald-400 hover:bg-white/5 cursor-pointer border-t border-white/10 mt-1 pt-1.5"
                        >
                            + Add Camera Move
                        </button>
                    </div>
                )}
            </div>

            {/* 2. SUB-HEADER: [File] | Assets + Search Icon */}
            <div className="h-9 border-y border-white/[0.07] px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab('file')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${activeTab === 'file'
                                ? 'bg-[#1f1f23] text-white'
                                : 'text-[#71717a] hover:text-[#d4d4d8]'
                            }`}
                    >
                        File
                    </button>
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${activeTab === 'assets'
                                ? 'bg-[#1f1f23] text-white'
                                : 'text-[#71717a] hover:text-[#d4d4d8]'
                            }`}
                    >
                        Assets
                    </button>
                </div>

                <button
                    onClick={() => {
                        setSearchOpen((v) => !v);
                        if (searchOpen) setSearchQuery('');
                    }}
                    className={`p-1 rounded hover:bg-white/5 cursor-pointer ${searchOpen ? 'text-[#0088ff]' : 'text-[#71717a] hover:text-white'
                        }`}
                >
                    <Search className="w-3.5 h-3.5" />
                </button>
            </div>

            {searchOpen && (
                <div className="px-3 py-1.5 border-b border-white/[0.07] bg-[#111114] flex items-center gap-1.5">
                    <Search className="w-3 h-3 text-[#71717a]" />
                    <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Find layer..."
                        className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-[#52525b]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="text-[#71717a] hover:text-white cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {/* =================================================================== */}
            {/* FILE TAB: UPPER TREE + LOWER SYNCHRONIZED TIMELINE TRACK RACK       */}
            {/* =================================================================== */}
            {activeTab === 'file' && (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {project.shots.map((shot) => {
                            const isShotActive = shot.id === activeShot.id;
                            const isCollapsed = Boolean(collapsedShots[shot.id]);
                            const isEditingShot = editingId === shot.id;

                            const layersTopDown = [...shot.layers].sort(
                                (a, b) => b.order - a.order
                            );
                            const orderedIdsInShot = layersTopDown.map((l) => l.id);
                            const rootGroups = shot.groups.filter((g) => !g.parentGroupId);
                            const ungroupedLayers = layersTopDown.filter((l) => !l.groupId);

                            const hasGroupSelected = rootGroups.some((g) => {
                                const gl = layersTopDown.filter((l) => l.groupId === g.id);
                                return (
                                    gl.length > 0 &&
                                    gl.every((l) => selectedLayerIds.includes(l.id))
                                );
                            });

                            return (
                                <div
                                    key={shot.id}
                                    className={
                                        isShotActive && !hasGroupSelected
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
                                        className={`group h-7 px-2 flex items-center justify-between text-[11px] cursor-pointer transition ${isShotActive && !hasGroupSelected
                                                ? 'bg-[#0088ff] text-white font-semibold'
                                                : 'text-[#d4d4d8] hover:bg-white/[0.04]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCollapsedShots((prev) => ({
                                                        ...prev,
                                                        [shot.id]: !prev[shot.id],
                                                    }));
                                                }}
                                                className="p-0.5 cursor-pointer"
                                            >
                                                {isCollapsed ? (
                                                    <ChevronRight className="w-3 h-3 opacity-70" />
                                                ) : (
                                                    <ChevronDown className="w-3 h-3 opacity-70" />
                                                )}
                                            </button>
                                            <Hash
                                                className={`w-3.5 h-3.5 shrink-0 ${isShotActive && !hasGroupSelected
                                                        ? 'text-white'
                                                        : 'text-[#0088ff]'
                                                    }`}
                                            />
                                            {isEditingShot ? (
                                                <input
                                                    autoFocus
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    onBlur={() => commitShotRename(shot.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') commitShotRename(shot.id);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full bg-black/90 border border-white rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                                                />
                                            ) : (
                                                <span className="truncate">{shot.name}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                            <button
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
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                            {project.shots.length > 1 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteShot(shot.id);
                                                    }}
                                                    title="Delete Shot"
                                                    className="p-1 rounded hover:bg-rose-500/40 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
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
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div
                            onClick={onSelectAudioClick}
                            className="h-7 px-3 mt-1 rounded-md flex items-center gap-2 text-[11px] text-[#a1a1aa] hover:text-white hover:bg-white/[0.04] cursor-pointer transition"
                        >
                            <Music className="w-3.5 h-3.5 text-[#f97316] shrink-0" />
                            <span className="truncate">{audioLabel}</span>
                        </div>
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
                            <div className="h-14 border-b border-white/[0.06] px-3 flex items-center justify-between text-[10px] font-mono text-[#71717a] shrink-0">
                                <span className="truncate">{activeShot.name} TRACKS</span>
                                <button
                                    onClick={() => {
                                        const camId = `cam-blk-${Date.now()}`;
                                        updateShot(activeShot.id, (s) => ({
                                            ...s,
                                            cameraBlocks: [
                                                ...(s.cameraBlocks || []),
                                                {
                                                    id: camId,
                                                    label: 'Camera Move',
                                                    startMs: 0,
                                                    durationMs: s.durationMs,
                                                    fromFramingId: s.framings[0]?.id || 'f1',
                                                    toFramingId: s.framings[1]?.id || 'f2',
                                                    mode: 'dolly',
                                                    easing: { kind: 'preset', name: 'linear' },
                                                    from: {
                                                        anchorX: 0,
                                                        anchorY: 0,
                                                        zoom: 1,
                                                        roll: 0,
                                                        orbit: 0,
                                                        tilt: 0,
                                                    },
                                                    to: {
                                                        anchorX: -0.05,
                                                        anchorY: 0.02,
                                                        zoom: 1.15,
                                                        roll: 0,
                                                        orbit: 0,
                                                        tilt: 0,
                                                    },
                                                    shake: { from: 0, to: 0 },
                                                },
                                            ],
                                        }));
                                        selectCameraBlock(camId);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[9px] cursor-pointer"
                                    title="Add Camera Move Track"
                                >
                                    + Camera
                                </button>
                            </div>

                            {/* Scroll-Synced Track Labels (1-to-1 with Timeline Bars on the Right!) */}
                            <div
                                ref={mirrorScrollRef}
                                onScroll={(e) =>
                                    setTimelineScrollTop(e.currentTarget.scrollTop)
                                }
                                className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5"
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
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateProject((p) => ({
                                                    ...p,
                                                    audio: {
                                                        clips: p.audio?.clips || [],
                                                        muted: !p.audio?.muted,
                                                        masterVolume: p.audio?.masterVolume ?? 1,
                                                    },
                                                }));
                                            }}
                                            title={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                            className="p-1 hover:text-white cursor-pointer"
                                        >
                                            {project.audio?.muted ? (
                                                <VolumeX className="w-3 h-3 text-rose-400" />
                                            ) : (
                                                <Volume2 className="w-3 h-3 text-slate-300" />
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* 1. Camera Track Row (ONLY shown when Camera is added!) */}
                                {hasCameraBlocks && (
                                    <div
                                        onClick={() =>
                                            selectCameraBlock(activeShot.cameraBlocks[0]?.id || null)
                                        }
                                        className={`h-7 px-2 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition ${selectedCameraBlockId
                                                ? 'bg-emerald-600/30 text-emerald-200 font-semibold border border-emerald-500/40'
                                                : 'text-emerald-400 hover:bg-white/[0.04]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Video className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">Camera</span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateShot(activeShot.id, (s) => ({
                                                    ...s,
                                                    cameraBlocks: [],
                                                }));
                                                selectCameraBlock(null);
                                            }}
                                            className="text-[10px] opacity-60 hover:opacity-100 hover:text-rose-400 cursor-pointer"
                                            title="Remove Camera Track"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                )}

                                {/* 2. Light Track Row (ONLY shown when Light animation is added) */}
                                {hasLightBlocks && (
                                    <div className="h-7 px-2 rounded-md flex items-center gap-1.5 text-[11px] text-amber-300 hover:bg-white/[0.04] cursor-pointer">
                                        <Sun className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                        <span className="truncate">Lighting Rig</span>
                                    </div>
                                )}

                                {/* 3. Layer Track Rows + Indented ♦ Presets & ♦ Property Sub-rows */}
                                {activeShot.layers
                                    .slice()
                                    .sort((a, b) => b.order - a.order)
                                    .map((layer) => {
                                        const isSelected = selectedLayerIds.includes(layer.id);
                                        const isExpanded = expandedTimelineLayerIds.includes(
                                            layer.id
                                        );
                                        const hasAnimItems =
                                            layer.entrance.type !== 'none' ||
                                            layer.exit.type !== 'none' ||
                                            layer.blocks.length > 0;

                                        return (
                                            <div key={`mirror-${layer.id}`} className="space-y-0.5">
                                                {/* Main Layer Row (h-7 = 28px) */}
                                                <div
                                                    onClick={() => {
                                                        setInspectorTab('layer');
                                                        selectLayer(layer.id, false);
                                                    }}
                                                    className={`h-7 px-2 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition ${isSelected
                                                            ? 'bg-[#0088ff] text-white font-semibold'
                                                            : 'text-[#d4d4d8] hover:bg-white/[0.04]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTimelineLayerExpanded(layer.id);
                                                            }}
                                                            className="p-0.5 cursor-pointer"
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-3 h-3" />
                                                            ) : (
                                                                <ChevronRight className="w-3 h-3" />
                                                            )}
                                                        </button>
                                                        {renderLayerIcon(layer, isSelected)}
                                                        <span className="truncate">{layer.name}</span>
                                                    </div>

                                                    {hasAnimItems && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTimelineLayerExpanded(layer.id);
                                                            }}
                                                            className={`p-0.5 rounded ${isSelected
                                                                    ? 'text-white'
                                                                    : 'text-[#8b5cf6] bg-[#8b5cf6]/15'
                                                                }`}
                                                        >
                                                            <Activity className="w-3 h-3" />
                                                        </button>
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
                                                            className={`h-6 pl-7 pr-2 rounded flex items-center justify-between text-[10px] cursor-pointer ${isSelected && selectedPresetType
                                                                    ? 'bg-purple-500/20 text-purple-200 font-medium'
                                                                    : 'text-[#a1a1aa] hover:text-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="w-1.5 h-1.5 rotate-45 bg-[#8b5cf6] shrink-0" />
                                                                <span>Presets</span>
                                                            </div>
                                                            <span className="text-[9px] font-mono opacity-50">
                                                                In/Out
                                                            </span>
                                                        </div>

                                                        {/* ♦ Property Block sub-rows (Position, Tilt, Scale, etc.) */}
                                                        {layer.blocks.map((blk) => (
                                                            <div
                                                                key={blk.id}
                                                                onClick={() => selectBlock(blk.id, layer.id)}
                                                                className={`h-6 pl-7 pr-2 rounded flex items-center justify-between text-[10px] cursor-pointer capitalize ${selectedBlockId === blk.id
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

                                {/* Quick + Add Layer Row at bottom of track list */}
                                <button
                                    onClick={() => {
                                        const l = addLayerToShot(activeShot.id, 'shape');
                                        selectLayer(l.id);
                                        setInspectorTab('layer');
                                    }}
                                    className="w-full h-7 px-2 rounded-md flex items-center gap-1.5 text-[10px] text-[#71717a] hover:text-white hover:bg-white/[0.04] cursor-pointer transition"
                                >
                                    <Plus className="w-3 h-3 text-[#0088ff]" />
                                    <span>Add Layer Track</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ASSETS TAB */}
            {activeTab === 'assets' && (
                <div className="flex-1 flex flex-col min-h-0 p-3 gap-3">
                    <button
                        onClick={onUploadClick}
                        className="w-full py-1.5 px-3 rounded-lg bg-[#0088ff] hover:bg-[#0077e6] text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Upload Media</span>
                    </button>

                    <div className="flex-1 overflow-y-auto space-y-2">
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
                                        device: undefined,
                                    });
                                    setInspectorTab('layer');
                                    selectLayer(created.id);
                                }}
                                className="p-2 rounded-lg bg-[#161619] hover:bg-[#1f1f23] border border-white/[0.06] flex items-center gap-2.5 cursor-grab transition"
                            >
                                <div className="w-10 h-8 rounded bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
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
                                    <div className="text-[11px] font-medium text-white truncate">
                                        {asset.name}
                                    </div>
                                    <div className="text-[10px] font-mono text-[#71717a]">
                                        {asset.width}&times;{asset.height}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
};
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, FolderMinus, Hash, Trash2 } from 'lucide-react';
import { ContextMenu, type ContextMenuItemDef } from '../../ui/ContextMenu';
import { IconButton } from '../../ui/primitives';
import { InlineRenameInput } from '../../ui/InlineRenameInput';
import { isBlankProjectState, type Shot, type Layer, type Group } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { LeftTimelineRack } from './LeftTimelineRack';
import { FileTabLayerRow } from './FileTabLayerRow';

interface FileTabProps {
    activeTab: 'file' | 'assets';
    activeShot: Shot;
    searchQuery: string;
}

export const FileTab: React.FC<FileTabProps> = ({ activeTab, activeShot, searchQuery }) => {
    const {
        project,
        updateShot,
        updateLayer,
        addLayerToShot,
        addCameraBlockToShot,
        toggleProjectAudioMuted,
        deleteLayerFromShot,
        duplicateLayerInShot,
        createGroupFromLayers,
        ungroupInShot,
        restackLayerInShot,
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
        setTimelineScrollTop,
        toggleTimelineLayerExpanded,
    } = useSelectionStore();

    const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
    const expandedTimelineLayerSet = useMemo(
        () => new Set(expandedTimelineLayerIds),
        [expandedTimelineLayerIds]
    );
    const setCurrentTimeMs = usePlayheadStore((state) => state.setCurrentTimeMs);

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        items: ContextMenuItemDef[];
    } | null>(null);
    const [collapsedShots, setCollapsedShots] = useState<Record<string, boolean>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        const primaryId = selectedLayerIds[0];
        if (primaryId && rowRefs.current[primaryId]) {
            rowRefs.current[primaryId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedLayerIds]);

    const startRename = (id: string, currentName: string) => {
        setEditingId(id);
        setEditingText(currentName);
    };

    const commitLayerRename = (shotId: string, layerId: string) => {
        if (editingText.trim()) {
            updateLayer(shotId, layerId, (layer) => ({ ...layer, name: editingText.trim() }));
        }
        setEditingId(null);
    };

    const commitGroupRename = (shotId: string, groupId: string) => {
        if (editingText.trim()) {
            updateGroupInShot(shotId, groupId, (group) => ({ ...group, name: editingText.trim() }));
        }
        setEditingId(null);
    };

    const commitShotRename = (shotId: string) => {
        if (editingText.trim()) {
            updateShot(shotId, (shot) => ({ ...shot, name: editingText.trim() }));
        }
        setEditingId(null);
    };
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const renderLayerRow = (
        shot: Shot,
        layer: Layer,
        orderedIdsInShot: string[],
        indentLevel = 1,
        isInsideSelectedContainer = false
    ) => (
        <FileTabLayerRow
            shot={shot}
            layer={layer}
            activeShot={activeShot}
            orderedIdsInShot={orderedIdsInShot}
            indentLevel={indentLevel}
            isInsideSelectedContainer={isInsideSelectedContainer}
            normalizedSearch={normalizedSearch}
            selectedLayerSet={selectedLayerSet}
            expandedTimelineLayerSet={expandedTimelineLayerSet}
            editingId={editingId}
            editingText={editingText}
            setEditingId={setEditingId}
            setEditingText={setEditingText}
            dragOverId={dragOverId}
            setDragOverId={setDragOverId}
            setRowElement={(id, element) => { rowRefs.current[id] = element; }}
            focusLayerRow={(id) => rowRefs.current[id]?.focus()}
            setContextMenu={setContextMenu}
            projectActions={{ updateLayer, deleteLayerFromShot, duplicateLayerInShot, createGroupFromLayers, ungroupInShot, restackLayerInShot, moveLayerToOrderAndGroup }}
            selectionActions={{ selectLayer, selectLayerRange, selectShot, setInspectorTab, toggleTimelineLayerExpanded }}
            setCurrentTimeMs={setCurrentTimeMs}
            startRename={startRename}
            commitLayerRename={commitLayerRename}
        />
    );
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
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            items: [
                                { type: 'header', label: group.name },
                                {
                                    id: 'rename',
                                    label: 'Rename group',
                                    shortcut: 'F2',
                                    onClick: () => startRename(group.id, group.name),
                                },
                                {
                                    id: 'ungroup',
                                    label: 'Ungroup',
                                    icon: FolderMinus,
                                    shortcut: '⌘⇧G',
                                    onClick: () => ungroupInShot(shot.id, group.id),
                                },
                                { type: 'divider' },
                                {
                                    id: 'delete',
                                    label: 'Delete group',
                                    icon: Trash2,
                                    shortcut: '⌫',
                                    danger: true,
                                    onClick: () => {
                                        childLayers.forEach((child) => deleteLayerFromShot(shot.id, child.id));
                                        ungroupInShot(shot.id, group.id);
                                    },
                                },
                            ],
                        });
                    }}
                    className={`group h-7 pr-2 flex items-center justify-between text-[11px] cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue ${isGroupSelected
                        ? 'bg-brand-blue text-white font-semibold'
                        : 'text-muted-foreground hover:bg-white/[0.04]'
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
                            className={`w-3.5 h-3.5 shrink-0 ${isGroupSelected ? 'text-white' : 'text-brand-blue'
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


    const hasLightBlocks = (activeShot.lightBlocks?.length || 0) > 0;

    return (
        <>
            {activeTab === 'file' && (
                <div id="left-panel-panel-file" role="tabpanel" aria-labelledby="left-panel-tab-file" className="flex-1 flex flex-col min-h-0">
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
                                            ? 'bg-brand-blue text-white font-semibold'
                                            : 'text-muted-foreground hover:bg-white/[0.04]'
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

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition">
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
                                                <div className="px-5 py-2 text-[10px] text-muted-foreground italic">
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
                    <LeftTimelineRack
                        activeShot={activeShot}
                        project={project}
                        timelineView={timelineView}
                        timelineHeightPx={timelineHeightPx}
                        timelineScrollTop={timelineScrollTop}
                        selectedLayerSet={selectedLayerSet}
                        expandedTimelineLayerSet={expandedTimelineLayerSet}
                        selectedCameraBlockId={selectedCameraBlockId}
                        selectedPresetType={selectedPresetType}
                        selectedBlockId={selectedBlockId}
                        hasLightBlocks={hasLightBlocks}
                        toggleProjectAudioMuted={toggleProjectAudioMuted}
                        addLayerToShot={addLayerToShot}
                        addCameraBlockToShot={addCameraBlockToShot}
                        setTimelineScrollTop={setTimelineScrollTop}
                        setInspectorTab={setInspectorTab}
                        selectLayer={selectLayer}
                        selectCameraBlock={selectCameraBlock}
                        toggleTimelineLayerExpanded={toggleTimelineLayerExpanded}
                        selectPreset={selectPreset}
                        selectBlock={selectBlock}
                    />
                </div>
            )}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </>
    );
};

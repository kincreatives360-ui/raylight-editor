import React from 'react';
import { Copy, Eye, EyeOff, FolderMinus, FolderPlus, Lock, Trash2, Unlock } from 'lucide-react';
import type { ContextMenuItemDef } from '../../ui/ContextMenu';
import { IconButton } from '../../ui/primitives';
import { InlineRenameInput } from '../../ui/InlineRenameInput';
import type { Layer, Shot } from '../../model/types';
import { isLayerEffectivelyHidden } from '../../engine/evaluateShot';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { LayerIcon } from './LayerIcon';

type ProjectActions = Pick<ReturnType<typeof useProjectStore.getState>,
    'updateLayer' | 'deleteLayerFromShot' | 'duplicateLayerInShot' | 'createGroupFromLayers' |
    'ungroupInShot' | 'restackLayerInShot' | 'moveLayerToOrderAndGroup'>;
type SelectionActions = Pick<ReturnType<typeof useSelectionStore.getState>,
    'selectLayer' | 'selectLayerRange' | 'selectShot' | 'setInspectorTab' | 'toggleTimelineLayerExpanded'>;
type ContextMenuState = { x: number; y: number; items: ContextMenuItemDef[] } | null;

interface FileTabLayerRowProps {
    shot: Shot;
    layer: Layer;
    activeShot: Shot;
    orderedIdsInShot: string[];
    indentLevel: number;
    isInsideSelectedContainer: boolean;
    normalizedSearch: string;
    selectedLayerSet: Set<string>;
    expandedTimelineLayerSet: Set<string>;
    editingId: string | null;
    editingText: string;
    setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
    setEditingText: React.Dispatch<React.SetStateAction<string>>;
    dragOverId: string | null;
    setDragOverId: React.Dispatch<React.SetStateAction<string | null>>;
    setRowElement: (id: string, element: HTMLDivElement | null) => void;
    focusLayerRow: (id: string) => void;
    setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
    projectActions: ProjectActions;
    selectionActions: SelectionActions;
    setCurrentTimeMs: (timeMs: number) => void;
    startRename: (id: string, name: string) => void;
    commitLayerRename: (shotId: string, layerId: string) => void;
}

export const FileTabLayerRow: React.FC<FileTabLayerRowProps> = ({
    shot, layer, activeShot, orderedIdsInShot, indentLevel, isInsideSelectedContainer,
    normalizedSearch, selectedLayerSet, expandedTimelineLayerSet, editingId, editingText,
    setEditingId, setEditingText, dragOverId, setDragOverId, setRowElement, focusLayerRow, setContextMenu,
    projectActions, selectionActions, setCurrentTimeMs, startRename, commitLayerRename,
}) => {
    const {
        updateLayer, deleteLayerFromShot, duplicateLayerInShot, createGroupFromLayers,
        ungroupInShot, restackLayerInShot, moveLayerToOrderAndGroup,
    } = projectActions;
    const {
        selectLayer, selectLayerRange, selectShot, setInspectorTab,
        toggleTimelineLayerExpanded,
    } = selectionActions;
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
                    setRowElement(layer.id, el);
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
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                            { type: 'header', label: layer.name },
                            {
                                id: 'rename',
                                label: 'Rename',
                                shortcut: 'F2',
                                onClick: () => startRename(layer.id, layer.name),
                            },
                            {
                                id: 'focus',
                                label: 'Focus in timeline',
                                onClick: () => {
                                    if (shot.id !== activeShot.id) {
                                        selectShot(shot.id);
                                    }
                                    selectLayer(layer.id, false);
                                    if (!expandedTimelineLayerSet.has(layer.id)) {
                                        toggleTimelineLayerExpanded(layer.id);
                                    }
                                },
                            },
                            { type: 'divider' },
                            {
                                id: 'duplicate',
                                label: 'Duplicate',
                                icon: Copy,
                                shortcut: '⌘D',
                                onClick: () => {
                                    if (shot.id !== activeShot.id) {
                                        selectShot(shot.id);
                                    }
                                    const dup = duplicateLayerInShot(shot.id, layer.id);
                                    if (dup) selectLayer(dup.id, false);
                                },
                            },
                            {
                                id: 'group',
                                label: 'Group',
                                icon: FolderPlus,
                                shortcut: '⌘G',
                                onClick: () => createGroupFromLayers(shot.id, [layer.id]),
                            },
                            ...(layer.groupId
                                ? [
                                      {
                                          id: 'ungroup',
                                          label: 'Ungroup',
                                          icon: FolderMinus,
                                          shortcut: '⌘⇧G',
                                          onClick: () => ungroupInShot(shot.id, layer.groupId!),
                                      } as ContextMenuItemDef,
                                  ]
                                : []),
                            { type: 'divider' },
                            {
                                id: 'toggle-lock',
                                label: layer.locked ? 'Unlock Layer' : 'Lock Layer',
                                icon: layer.locked ? Unlock : Lock,
                                onClick: () =>
                                    updateLayer(shot.id, layer.id, (l) => ({
                                        ...l,
                                        locked: !l.locked,
                                    })),
                            },
                            {
                                id: 'toggle-visibility',
                                label: layer.hidden ? 'Show Layer' : 'Hide Layer',
                                icon: layer.hidden ? Eye : EyeOff,
                                shortcut: '⌘⇧H',
                                onClick: () =>
                                    updateLayer(shot.id, layer.id, (l) => ({
                                        ...l,
                                        hidden: !l.hidden,
                                    })),
                            },
                            { type: 'divider' },
                            {
                                id: 'delete',
                                label: 'Delete',
                                icon: Trash2,
                                shortcut: '⌫',
                                danger: true,
                                onClick: () => deleteLayerFromShot(shot.id, layer.id),
                            },
                        ],
                    });
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
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.altKey) {
                            restackLayerInShot(shot.id, layer.id, 'backward');
                        } else {
                            const idx = orderedIdsInShot.indexOf(layer.id);
                            if (idx >= 0 && idx < orderedIdsInShot.length - 1) {
                                const nextId = orderedIdsInShot[idx + 1];
                                selectLayer(nextId, false);
                                focusLayerRow(nextId);
                            }
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.altKey) {
                            restackLayerInShot(shot.id, layer.id, 'forward');
                        } else {
                            const idx = orderedIdsInShot.indexOf(layer.id);
                            if (idx > 0) {
                                const prevId = orderedIdsInShot[idx - 1];
                                selectLayer(prevId, false);
                                focusLayerRow(prevId);
                            }
                        }
                    }
                }}
                style={{ paddingLeft: `${12 + indentLevel * 14}px` }}
                className={`group h-7 pr-2 flex items-center justify-between text-[11px] cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue ${isDragTarget ? 'border-t border-brand-blue' : ''
                    } ${isSelected || isInsideSelectedContainer
                        ? 'bg-[var(--accent-selection)] text-white font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                    } ${isLayerEffectivelyHidden(layer, shot.groups) ? 'opacity-40' : ''}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <LayerIcon layer={layer} isSelected={isSelected} />
                    {isEditing ? (
                        <InlineRenameInput
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-black/90 border border-brand-blue rounded px-1.5 py-0.5 text-[11px] text-foreground outline-none"
                            onCommit={() => commitLayerRename(shot.id, layer.id)}
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <span className="truncate">{layer.name}</span>
                    )}
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition">
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

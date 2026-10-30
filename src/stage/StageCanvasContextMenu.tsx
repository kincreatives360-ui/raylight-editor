import React from 'react';
import { AlignCenterHorizontal, AlignLeft, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Circle, ClipboardCopy, ClipboardPaste, Copy, Focus, FolderMinus, FolderPlus, Layers, Lock, RotateCcw, Sparkles, Square, Trash2, Type, Unlock, Eye, EyeOff } from 'lucide-react';
import { ContextMenu, type ContextMenuItemDef } from '../ui/ContextMenu';
import type { Layer } from '../model/types';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { copyLayerEffects, getCopiedLayerEffects, hasCopiedLayerEffects } from '../utils/editorClipboard';
import { alignLayers as alignShotLayers } from './alignLayers';

interface StageCanvasContextMenuProps {
    menu: { x: number; y: number } | null;
    layer: Layer | null;
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    selectedLayerSet: Set<string>;
    targetAspect: number;
    effectiveTimeMs: number;
    onClose: () => void;
    onFrameSelection: () => void;
}

export const StageCanvasContextMenu: React.FC<StageCanvasContextMenuProps> = ({ menu, layer, frame, selectedLayerIds, selectedLayerSet, targetAspect, effectiveTimeMs, onClose, onFrameSelection }) => {
    const { createGroupFromLayers, ungroupInShot, updateShot, recordAnimatedBlockAtPlayhead, restackLayerInShot, updateLayer, duplicateLayerInShot, deleteLayerFromShot, addLayerToShot } = useProjectStore();
    const { selectLayer, setSelectedLayerIds, resetCanvasView } = useSelectionStore();
    return (
        <>
            {menu && (() => {
                const idsToAlign = layer
                    ? new Set(selectedLayerSet.has(layer.id) ? selectedLayerIds : [layer.id])
                    : new Set<string>();

                const alignLayers = (alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
                    updateShot(frame.activeShot.id, (s) => ({
                        ...s,
                        layers: alignShotLayers(s.layers, idsToAlign, alignment, targetAspect),
                    }));
                };

                return (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    onClose={onClose}
                    items={
                        layer
                            ? [
                                  { type: 'header', label: layer.name },
                                  {
                                      id: 'group',
                                      label: 'Group',
                                      icon: FolderPlus,
                                      shortcut: '⌘G',
                                      onClick: () => {
                                          const idsToGroup = selectedLayerSet.has(layer.id)
                                              ? selectedLayerIds
                                              : [layer.id];
                                          createGroupFromLayers(frame.activeShot.id, idsToGroup);
                                      },
                                  },
                                  {
                                      id: 'frame-selection',
                                      label: 'Frame selection',
                                      icon: Focus,
                                      shortcut: '⌥⌘G',
                                      onClick: onFrameSelection,
                                  },
                                  ...(layer.groupId
                                      ? [
                                            {
                                                id: 'ungroup',
                                                label: 'Ungroup',
                                                icon: FolderMinus,
                                                shortcut: '⌘⇧G',
                                                onClick: () => {
                                                    if (layer.groupId) {
                                                        ungroupInShot(frame.activeShot.id, layer.groupId);
                                                    }
                                                },
                                            } as ContextMenuItemDef,
                                        ]
                                      : []),
                                  {
                                      id: 'align',
                                      label: 'Align',
                                      icon: AlignCenterHorizontal,
                                      children: [
                                          {
                                              id: 'align-left',
                                              label: 'Align Left',
                                              icon: AlignLeft,
                                              onClick: () => alignLayers('left'),
                                          },
                                          {
                                              id: 'align-center-h',
                                              label: 'Center Horizontal',
                                              icon: AlignCenterHorizontal,
                                              onClick: () => alignLayers('center-h'),
                                          },
                                          {
                                              id: 'align-right',
                                              label: 'Align Right',
                                              icon: AlignRight,
                                              onClick: () => alignLayers('right'),
                                          },
                                          {
                                              id: 'align-top',
                                              label: 'Align Top',
                                              icon: AlignStartVertical,
                                              onClick: () => alignLayers('top'),
                                          },
                                          {
                                              id: 'align-center-v',
                                              label: 'Center Vertical',
                                              icon: AlignCenterVertical,
                                              onClick: () => alignLayers('center-v'),
                                          },
                                          {
                                              id: 'align-bottom',
                                              label: 'Align Bottom',
                                              icon: AlignEndVertical,
                                              onClick: () => alignLayers('bottom'),
                                          },
                                      ],
                                  },
                                  { type: 'divider' },
                                  {
                                      id: 'animate-last-change',
                                      label: 'Animate position offset',
                                      icon: Sparkles,
                                      shortcut: '⇧K',
                                      onClick: () => {
                                          recordAnimatedBlockAtPlayhead(
                                              frame.activeShot.id,
                                              layer.id,
                                              'position',
                                              { x: 0.05, y: 0.05, z: 0 },
                                              Math.max(0, (effectiveTimeMs ?? 0) - frame.activeShot.startMs),
                                              'Animate'
                                          );
                                      },
                                  },
                                  { type: 'divider' },
                                  {
                                      id: 'bring-to-front',
                                      label: 'Bring to Front',
                                      icon: ChevronsUp,
                                      shortcut: ']',
                                      onClick: () => restackLayerInShot(frame.activeShot.id, layer.id, 'front'),
                                  },
                                  {
                                      id: 'bring-forward',
                                      label: 'Bring Forward',
                                      icon: ChevronUp,
                                      shortcut: '⌘]',
                                      onClick: () => restackLayerInShot(frame.activeShot.id, layer.id, 'forward'),
                                  },
                                  {
                                      id: 'send-backward',
                                      label: 'Send Backward',
                                      icon: ChevronDown,
                                      shortcut: '⌘[',
                                      onClick: () => restackLayerInShot(frame.activeShot.id, layer.id, 'backward'),
                                  },
                                  {
                                      id: 'send-to-back',
                                      label: 'Send to Back',
                                      icon: ChevronsDown,
                                      shortcut: '[',
                                      onClick: () => restackLayerInShot(frame.activeShot.id, layer.id, 'back'),
                                  },
                                  { type: 'divider' },
                                  {
                                      id: 'copy-effects',
                                      label: 'Copy effects',
                                      icon: ClipboardCopy,
                                      shortcut: '⌥⌘C',
                                      onClick: () => copyLayerEffects(layer.effects),
                                  },
                                  {
                                      id: 'paste-effects',
                                      label: 'Paste effects',
                                      icon: ClipboardPaste,
                                      shortcut: '⌥⌘V',
                                      disabled: !hasCopiedLayerEffects(),
                                      onClick: () => {
                                          const eff = getCopiedLayerEffects();
                                          if (eff) {
                                              updateLayer(frame.activeShot.id, layer.id, (l) => ({
                                                  ...l,
                                                  effects: eff,
                                              }));
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
                                          const dup = duplicateLayerInShot(frame.activeShot.id, layer.id);
                                          if (dup) selectLayer(dup.id, false);
                                      },
                                  },
                                  {
                                      id: 'toggle-lock',
                                      label: layer.locked ? 'Unlock Layer' : 'Lock Layer',
                                      icon: layer.locked ? Unlock : Lock,
                                      onClick: () => updateLayer(frame.activeShot.id, layer.id, (l) => ({ ...l, locked: !l.locked })),
                                  },
                                  {
                                      id: 'toggle-visibility',
                                      label: layer.hidden ? 'Show Layer' : 'Hide Layer',
                                      icon: layer.hidden ? Eye : EyeOff,
                                      shortcut: '⌘⇧H',
                                      onClick: () => updateLayer(frame.activeShot.id, layer.id, (l) => ({ ...l, hidden: !l.hidden })),
                                  },
                                  { type: 'divider' },
                                  {
                                      id: 'delete',
                                      label: 'Delete',
                                      icon: Trash2,
                                      shortcut: '⌫',
                                      danger: true,
                                      onClick: () => deleteLayerFromShot(frame.activeShot.id, layer.id),
                                  },
                              ]
                            : [
                                  { type: 'header', label: 'Canvas' },
                                  {
                                      id: 'add-text',
                                      label: 'Add Text',
                                      icon: Type,
                                      shortcut: 'T',
                                      onClick: () => {
                                          const l = addLayerToShot(frame.activeShot.id, 'text', { position: { x: 0, y: 0, z: 0 } });
                                          selectLayer(l.id, false);
                                      },
                                  },
                                  {
                                      id: 'add-rect',
                                      label: 'Add Rectangle',
                                      icon: Square,
                                      shortcut: 'R',
                                      onClick: () => {
                                          const l = addLayerToShot(frame.activeShot.id, 'shape', { shape: 'rectangle', position: { x: 0, y: 0, z: 0 } });
                                          selectLayer(l.id, false);
                                      },
                                  },
                                  {
                                      id: 'add-ellipse',
                                      label: 'Add Ellipse',
                                      icon: Circle,
                                      shortcut: 'O',
                                      onClick: () => {
                                          const l = addLayerToShot(frame.activeShot.id, 'shape', { shape: 'ellipse', position: { x: 0, y: 0, z: 0 } });
                                          selectLayer(l.id, false);
                                      },
                                  },
                                  { type: 'divider' },
                                  {
                                      id: 'select-all',
                                      label: 'Select All Layers',
                                      icon: Layers,
                                      shortcut: '⌘A',
                                      onClick: () => setSelectedLayerIds(frame.activeShot.layers.map((l) => l.id)),
                                  },
                                  {
                                      id: 'reset-fit',
                                      label: 'Reset View to Fit',
                                      icon: RotateCcw,
                                      onClick: () => resetCanvasView(),
                                  },
                              ]
                    }
                />
                );
            })()}


        </>
    );
};

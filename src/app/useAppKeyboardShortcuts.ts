import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import type { Layer, Project } from '../model/types';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { isLayerEffectivelyLocked } from '../engine/evaluateShot';
import { exportProjectToFile } from '../storage/projectIO';
import { isEditableElement, isInteractiveElement } from '../utils/shortcuts';
import { matchesCameraToolShortcut, matchesScissorsShortcut } from '../utils/cameraShortcuts';
import { matchesPenPathShortcut } from '../utils/penPathShortcut';
import { withViewTransition } from '../utils/viewTransitions';

type ProjectActions = Pick<ReturnType<typeof useProjectStore.getState>,
  | 'updateShot'
  | 'restackLayerInShot'
  | 'recordAnimatedBlockAtPlayhead'
  | 'createGroupFromLayers'
  | 'ungroupInShot'
  | 'duplicateLayerInShot'
  | 'deleteLayerFromShot'
  | 'deleteMultipleLayersFromShot'
  | 'deleteShot'
  | 'updateLayer'
  | 'undo'
  | 'redo'
  | 'splitAtPlayhead'
>;

type SelectionActions = Pick<ReturnType<typeof useSelectionStore.getState>,
  | 'setTimelineLayerExpanded'
  | 'selectLayer'
  | 'selectShot'
  | 'setSelectedLayerIds'
  | 'selectBlock'
  | 'selectCameraBlock'
  | 'selectLightBlock'
  | 'clearLayerSelection'
  | 'setInspectorTab'
  | 'setActiveTool'
  | 'toggleAnimateMode'
  | 'setIsCropping'
  | 'toggleLeftPanel'
  | 'toggleRightSidebar'
  | 'setLeftPanelOpen'
  | 'setRightSidebarOpen'
>;

type PlayheadActions = Pick<ReturnType<typeof usePlayheadStore.getState>, 'togglePlay'>;

interface UndoToast {
  message: string;
  isOpen: boolean;
  historyLength?: number;
}

interface UseAppKeyboardShortcutsOptions extends ProjectActions, SelectionActions, PlayheadActions {
  project: Project;
  activeShot: Project['shots'][number];
  selectedLayer: Layer | undefined;
  selectedLayerIds: string[];
  selectedLayerSet: Set<string>;
  isAnimateMode: boolean;
  selectedBlockId: string | null;
  selectedCameraBlockId: string | null;
  selectedLightBlockId: string | null;
  leftPanelOpen: boolean;
  rightSidebarOpen: boolean;
  shortcutsModalOpen: boolean;
  commandMenuOpen: boolean;
  undoToastOpen: boolean;
  copiedLayersRef: MutableRefObject<Layer[]>;
  projectFileInputRef: RefObject<HTMLInputElement | null>;
  setUndoToast: Dispatch<SetStateAction<UndoToast>>;
  setShowSafeArea: Dispatch<SetStateAction<boolean>>;
  setShortcutsModalOpen: Dispatch<SetStateAction<boolean>>;
  setCommandMenuOpen: Dispatch<SetStateAction<boolean>>;
  setExportModalOpen: Dispatch<SetStateAction<boolean>>;
  handleOpenExportModal: () => void;
}

export function useAppKeyboardShortcuts(options: UseAppKeyboardShortcutsOptions): void {
  const {
    project,
    activeShot,
    selectedLayer,
    selectedLayerIds,
    selectedLayerSet,
    isAnimateMode,
    selectedBlockId,
    selectedCameraBlockId,
    selectedLightBlockId,
    leftPanelOpen,
    rightSidebarOpen,
    shortcutsModalOpen,
    commandMenuOpen,
    undoToastOpen,
    copiedLayersRef,
    projectFileInputRef,
    setUndoToast,
    setShowSafeArea,
    setShortcutsModalOpen,
    setCommandMenuOpen,
    setExportModalOpen,
    handleOpenExportModal,
    updateShot,
    restackLayerInShot,
    recordAnimatedBlockAtPlayhead,
    setTimelineLayerExpanded,
    createGroupFromLayers,
    ungroupInShot,
    duplicateLayerInShot,
    deleteLayerFromShot,
    deleteMultipleLayersFromShot,
    deleteShot,
    selectLayer,
    selectShot,
    selectBlock,
    selectCameraBlock,
    selectLightBlock,
    updateLayer,
    clearLayerSelection,
    setInspectorTab,
    setActiveTool,
    toggleAnimateMode,
    setIsCropping,
    undo,
    redo,
    splitAtPlayhead,
    togglePlay,
    toggleLeftPanel,
    toggleRightSidebar,
    setLeftPanelOpen,
    setRightSidebarOpen,
    setSelectedLayerIds,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (isEditableElement(el)) {
        return;
      }

      // Escape: Close shortcuts modal or reset tools/selection
      if (e.key === 'Escape') {
        if (commandMenuOpen) {
          setCommandMenuOpen(false);
          return;
        }
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          return;
        }
        setIsCropping(false);
        setActiveTool('select');
        clearLayerSelection();
        setInspectorTab('project');
        setExportModalOpen(false);
        return;
      }

      // ?: Open Keyboard Shortcuts Cheat Sheet (or Cmd/Ctrl + /)
      if (e.key === '?' || ((e.metaKey || e.ctrlKey) && e.key === '/')) {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Suppress all other shortcuts while shortcuts modal is open
      if (shortcutsModalOpen || commandMenuOpen) {
        return;
      }

      const key = e.key.toLowerCase();

      // Cmd/Ctrl + E: Export Video / GIF / Frame (Detail 4)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === 'e') {
        e.preventDefault();
        handleOpenExportModal();
        return;
      }

      // Cmd/Ctrl + Shift + S: Export Project (.raylight.json)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 's') {
        e.preventDefault();
        exportProjectToFile(project);
        return;
      }

      // Cmd/Ctrl + O: Import Project (.raylight.json)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === 'o') {
        e.preventDefault();
        projectFileInputRef.current?.click();
        return;
      }

      // Cmd/Ctrl + K: Open Command Menu (Detail 3)
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        setCommandMenuOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + A: Select All Layers in Active Shot
      if ((e.metaKey || e.ctrlKey) && key === 'a') {
        e.preventDefault();
        setInspectorTab('layer');
        setSelectedLayerIds(activeShot.layers.map((l) => l.id));
        return;
      }

      // Cmd/Ctrl + Shift + H: Toggle Hide/Show Selected Layer(s)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'h') {
        e.preventDefault();
        if (selectedLayerIds.length > 0) {
          updateShot(activeShot.id, (s) => ({
            ...s,
            layers: s.layers.map((l) =>
              selectedLayerSet.has(l.id)
                ? { ...l, hidden: !l.hidden }
                : l
            ),
          }));
        }
        return;
      }

      // Cmd/Ctrl + C: Copy Selected Layer(s)
      if ((e.metaKey || e.ctrlKey) && key === 'c') {
        const toCopy = activeShot.layers.filter((l) =>
          selectedLayerSet.has(l.id)
        );
        if (toCopy.length > 0) {
          copiedLayersRef.current = structuredClone(toCopy);
        }
        return;
      }

      // Shift + A: Toggle Live Animate Recording Mode
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && key === 'a') {
        e.preventDefault();
        toggleAnimateMode();
        return;
      }

      if (matchesCameraToolShortcut(e)) {
        e.preventDefault();
        setActiveTool('camera');
        return;
      }
      if (matchesScissorsShortcut(e)) {
        e.preventDefault();
        splitAtPlayhead(usePlayheadStore.getState().currentTimeMs);
        return;
      }

      // Single-Key Tool Shortcuts (V, G, Y, H, T, I, R, O, L, Escape)
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (isInteractiveElement(el)) {
          return;
        }
        if (key === 'v') {
          setActiveTool('select');
          return;
        }
        if (key === 'g') {
          setActiveTool('move');
          return;
        }
        if (key === 'y') {
          setActiveTool('tilt');
          return;
        }
        if (key === 'h') {
          setActiveTool('hand');
          return;
        }
        if (key === 't') {
          setActiveTool('text');
          return;
        }
        if (key === 'i') {
          setActiveTool('image');
          return;
        }
        if (key === 'r') {
          setActiveTool('rectangle');
          return;
        }
        if (key === 'o') {
          setActiveTool('ellipse');
          return;
        }
        if (key === 'l') { setActiveTool('line'); return; }
        if (key === 'a') { setActiveTool('arrow'); return; }
        if (matchesPenPathShortcut(e)) { setActiveTool('pen'); return; }
      }

      // ': Toggle Safe Zones & Rule of Thirds Grid (or Cmd/Ctrl + ')
      if (e.key === "'" && !e.altKey) {
        e.preventDefault();
        setShowSafeArea((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + [ and Cmd/Ctrl + ]: Restack Layer Forward / Backward
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.code === 'BracketRight' || e.code === 'BracketLeft') &&
        selectedLayer
      ) {
        e.preventDefault();
        const isForward = e.code === 'BracketRight';
        const isExtreme = e.shiftKey;
        restackLayerInShot(
          activeShot.id,
          selectedLayer.id,
          isForward
            ? isExtreme
              ? 'front'
              : 'forward'
            : isExtreme
              ? 'back'
              : 'backward'
        );
        return;
      }

      // [ and ]: Toggle Left Panel / Right Sidebar (Adaptive Viewport)
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.code === 'BracketLeft') {
          e.preventDefault();
          toggleLeftPanel();
          return;
        }
        if (e.code === 'BracketRight') {
          e.preventDefault();
          toggleRightSidebar();
          return;
        }
      }

      // \: Zen Mode (Distraction-free 3D & Timeline stage) with View Transition (Detail 9)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === '\\') {
        e.preventDefault();
        withViewTransition(() => {
          if (leftPanelOpen || rightSidebarOpen) {
            setLeftPanelOpen(false);
            setRightSidebarOpen(false);
          } else {
            setLeftPanelOpen(true);
            setRightSidebarOpen(true);
          }
        });
        return;
      }

      // Cmd/Ctrl + Z / Cmd/Ctrl + Shift + Z: Undo / Redo
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
          if (undoToastOpen) {
            setUndoToast((prev) => ({ ...prev, isOpen: false }));
          }
        }
        return;
      }

      // Cmd/Ctrl + G / Cmd/Ctrl + Shift + G: Group / Ungroup
      if ((e.metaKey || e.ctrlKey) && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedLayer?.groupId) {
            ungroupInShot(activeShot.id, selectedLayer.groupId);
          }
        } else if (selectedLayerIds.length > 0) {
          createGroupFromLayers(activeShot.id, selectedLayerIds);
        }
        return;
      }

      // Cmd/Ctrl + D: Duplicate Layer
      if ((e.metaKey || e.ctrlKey) && key === 'd') {
        e.preventDefault();
        if (selectedLayer) {
          const dup = duplicateLayerInShot(activeShot.id, selectedLayer.id);
          if (dup) {
            setInspectorTab('layer');
            selectLayer(dup.id);
          }
        }
        return;
      }

      // Delete / Backspace: Delete Selected Layer(s), Block(s) or Active Shot
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedCameraBlockId && activeShot) {
          e.preventDefault();
          updateShot(activeShot.id, (s) => ({
            ...s,
            cameraBlocks: s.cameraBlocks.filter((b) => b.id !== selectedCameraBlockId),
          }));
          selectCameraBlock(null);
          setUndoToast({
            message: 'Deleted camera block',
            isOpen: true,
            historyLength: useProjectStore.getState().past.length,
          });
          return;
        }
        if (selectedLightBlockId && activeShot) {
          e.preventDefault();
          updateShot(activeShot.id, (s) => ({
            ...s,
            lightBlocks: (s.lightBlocks || []).filter((b) => b.id !== selectedLightBlockId),
          }));
          selectLightBlock(null);
          setUndoToast({
            message: 'Deleted light block',
            isOpen: true,
            historyLength: useProjectStore.getState().past.length,
          });
          return;
        }
        if (selectedBlockId && activeShot) {
          e.preventDefault();
          for (const layer of activeShot.layers) {
            if (layer.blocks.some((b) => b.id === selectedBlockId)) {
              updateLayer(activeShot.id, layer.id, (l) => ({
                ...l,
                blocks: l.blocks.filter((b) => b.id !== selectedBlockId),
              }));
              break;
            }
          }
          selectBlock(null);
          setUndoToast({
            message: 'Deleted animation block',
            isOpen: true,
            historyLength: useProjectStore.getState().past.length,
          });
          return;
        }
        if (selectedLayerIds.length > 0) {
          e.preventDefault();
          const count = selectedLayerIds.length;
          deleteMultipleLayersFromShot(activeShot.id, selectedLayerIds);
          clearLayerSelection();
          setInspectorTab('project');
          setUndoToast({
            message: count === 1 ? 'Deleted layer' : `Deleted ${count} layers`,
            isOpen: true,
            historyLength: useProjectStore.getState().past.length,
          });
          return;
        } else if (project.shots.length > 1) {
          e.preventDefault();
          const shotIndex = project.shots.findIndex((s) => s.id === activeShot.id);
          deleteShot(activeShot.id);
          const remaining = project.shots.filter((s) => s.id !== activeShot.id);
          const nextIndex = Math.max(0, Math.min(shotIndex - 1, remaining.length - 1));
          if (remaining[nextIndex]) {
            selectShot(remaining[nextIndex].id);
          }
          setUndoToast({
            message: 'Deleted shot',
            isOpen: true,
            historyLength: useProjectStore.getState().past.length,
          });
          return;
        }
      }

      // Space: Play / Pause (preserves native button/tab activation)
      if (e.code === 'Space') {
        if (isInteractiveElement(el)) {
          return;
        }
        e.preventDefault();
        togglePlay();
        return;
      }

      if (e.defaultPrevented) return;

      // Arrow Keys: Nudge Layer (or Record Block if Shift+A Animate Mode is ON)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 0.025 : 0.005;
        const dx =
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy =
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        if (isAnimateMode && selectedLayer && !isLayerEffectivelyLocked(selectedLayer, activeShot.groups)) {
          const playheadTimeMs = usePlayheadStore.getState().currentTimeMs;
          const shotLocalTimeMs = Math.max(0, playheadTimeMs - activeShot.startMs);
          const blkId = recordAnimatedBlockAtPlayhead(
            activeShot.id,
            selectedLayer.id,
            'position',
            { x: dx, y: dy, z: 0 },
            shotLocalTimeMs,
            'Nudge'
          );
          if (blkId) {
            setTimelineLayerExpanded(selectedLayer.id, true);
            selectBlock(blkId, selectedLayer.id);
          }
          return;
        }

        updateShot(activeShot.id, (s) => ({
          ...s,
          layers: s.layers.map((l) =>
            selectedLayerSet.has(l.id) && !isLayerEffectivelyLocked(l, s.groups)
              ? {
                ...l,
                position: {
                  ...l.position,
                  x: Number((l.position.x + dx).toFixed(4)),
                  y: Number((l.position.y + dy).toFixed(4)),
                },
              }
              : l
          ),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    project,
    selectedLayer,
    selectedLayerIds,
    selectedLayerSet,
    activeShot.id,
    activeShot.layers,
    activeShot.groups,
    isAnimateMode,
    updateShot,
    restackLayerInShot,
    recordAnimatedBlockAtPlayhead,
    setTimelineLayerExpanded,
    createGroupFromLayers,
    ungroupInShot,
    duplicateLayerInShot,
    deleteLayerFromShot,
    deleteMultipleLayersFromShot,
    deleteShot,
    selectLayer,
    selectShot,
    setSelectedLayerIds,
    selectBlock,
    selectCameraBlock,
    selectLightBlock,
    selectedBlockId,
    selectedCameraBlockId,
    selectedLightBlockId,
    updateLayer,
    activeShot,
    clearLayerSelection,
    setInspectorTab,
    setActiveTool,
    toggleAnimateMode,
    setIsCropping,
    undo,
    redo,
    splitAtPlayhead,
    togglePlay,
    leftPanelOpen,
    rightSidebarOpen,
    toggleLeftPanel,
    toggleRightSidebar,
    setLeftPanelOpen,
    setRightSidebarOpen,
    setShowSafeArea,
    setShortcutsModalOpen,
    shortcutsModalOpen,
    commandMenuOpen,
    handleOpenExportModal,
    undoToastOpen,
    copiedLayersRef,
    projectFileInputRef,
    setCommandMenuOpen,
    setExportModalOpen,
    setUndoToast,
  ]);
}

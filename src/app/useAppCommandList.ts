import { useMemo, type RefObject } from 'react';
import { Camera, Download, Feather, PanelLeftOpen, PanelRightOpen, Sparkles, Upload } from 'lucide-react';
import type { Project } from '../model/types';
import { useProjectStore } from '../store/useProjectStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { exportProjectToFile } from '../storage/projectIO';
import { CAMERA_TOOL_SHORTCUT, SCISSORS_SHORTCUT } from '../utils/cameraShortcuts';
import { PEN_PATH_SHORTCUT } from '../utils/penPathShortcut';
import { withViewTransition } from '../utils/viewTransitions';
import type { CommandItem } from '../ui/CommandMenu';

interface UseAppCommandListOptions {
  project: Project;
  activeShotId: string;
  isPlaying: boolean;
  leftPanelOpen: boolean;
  rightSidebarOpen: boolean;
  projectFileInputRef: RefObject<HTMLInputElement | null>;
  togglePlay: ReturnType<typeof usePlayheadStore.getState>['togglePlay'];
  splitAtPlayhead: ReturnType<typeof useProjectStore.getState>['splitAtPlayhead'];
  addLayerToShot: ReturnType<typeof useProjectStore.getState>['addLayerToShot'];
  setActiveTool: ReturnType<typeof useSelectionStore.getState>['setActiveTool'];
  handleOpenExportModal: () => void;
  setLeftPanelOpen: ReturnType<typeof useSelectionStore.getState>['setLeftPanelOpen'];
  setRightSidebarOpen: ReturnType<typeof useSelectionStore.getState>['setRightSidebarOpen'];
  toggleLeftPanel: ReturnType<typeof useSelectionStore.getState>['toggleLeftPanel'];
  toggleRightSidebar: ReturnType<typeof useSelectionStore.getState>['toggleRightSidebar'];
  undo: ReturnType<typeof useProjectStore.getState>['undo'];
  redo: ReturnType<typeof useProjectStore.getState>['redo'];
  toggleProjectAudioMuted: ReturnType<typeof useProjectStore.getState>['toggleProjectAudioMuted'];
  setShortcutsModalOpen: (open: boolean) => void;
}

export function useAppCommandList({
  project,
  activeShotId,
  isPlaying,
  leftPanelOpen,
  rightSidebarOpen,
  projectFileInputRef,
  togglePlay,
  splitAtPlayhead,
  addLayerToShot,
  setActiveTool,
  handleOpenExportModal,
  setLeftPanelOpen,
  setRightSidebarOpen,
  toggleLeftPanel,
  toggleRightSidebar,
  undo,
  redo,
  toggleProjectAudioMuted,
  setShortcutsModalOpen,
}: UseAppCommandListOptions): CommandItem[] {
  return useMemo(() => [
    {
      id: 'play-pause',
      title: isPlaying ? 'Pause Playback' : 'Play Timeline',
      subtitle: 'Toggle real-time viewport playback',
      category: 'Playback',
      icon: Sparkles,
      shortcut: ['Space'],
      action: togglePlay,
    },
    {
      id: 'split-clip',
      title: 'Split Clip at Playhead',
      subtitle: 'Cut current active shot into two clips',
      category: 'Editing',
      icon: Download,
      shortcut: [...SCISSORS_SHORTCUT.keys],
      action: () => splitAtPlayhead(usePlayheadStore.getState().currentTimeMs),
    },
    {
      id: 'add-text',
      title: 'Add Text Layer',
      subtitle: 'Create new 3D typography layer',
      category: 'Tools',
      icon: Sparkles,
      shortcut: ['T'],
      action: () => addLayerToShot(activeShotId, 'text'),
    },
    {
      id: 'add-rect',
      title: 'Add Rectangle Shape',
      subtitle: 'Draw rectangular vector geometry',
      category: 'Tools',
      icon: Sparkles,
      shortcut: ['R'],
      action: () => addLayerToShot(activeShotId, 'shape'),
    },
    {
      id: 'tool-pen-path',
      title: 'Pen Path Tool',
      subtitle: 'Draw a freehand closed polygon path',
      category: 'Tools',
      icon: Feather,
      shortcut: [...PEN_PATH_SHORTCUT.keys],
      action: () => setActiveTool('pen'),
    },
    {
      id: 'tool-camera',
      title: 'Camera Navigation Tool',
      subtitle: 'Orbit, pan, and dolly 3D scene camera',
      category: 'Tools',
      icon: Camera,
      shortcut: [...CAMERA_TOOL_SHORTCUT.keys],
      action: () => setActiveTool('camera'),
    },
    {
      id: 'export-video',
      title: 'Export Video / GIF / Frame',
      subtitle: 'Render and save project to disk',
      category: 'Project',
      icon: Download,
      shortcut: ['Mod', 'E'],
      action: handleOpenExportModal,
    },
    {
      id: 'export-project-file',
      title: 'Export Project (.raylight.json)',
      subtitle: 'Save complete project document to JSON file',
      category: 'Project',
      icon: Download,
      shortcut: ['Mod', 'Shift', 'S'],
      action: () => exportProjectToFile(project),
    },
    {
      id: 'import-project-file',
      title: 'Import Project (.raylight.json)...',
      subtitle: 'Open an existing .raylight.json project file',
      category: 'Project',
      icon: Upload,
      shortcut: ['Mod', 'O'],
      action: () => projectFileInputRef.current?.click(),
    },
    {
      id: 'toggle-zen',
      title: 'Toggle Zen Mode',
      subtitle: 'Maximize viewport workspace',
      category: 'View',
      icon: Sparkles,
      shortcut: ['\\'],
      action: () => {
        withViewTransition(() => {
          if (leftPanelOpen || rightSidebarOpen) {
            setLeftPanelOpen(false);
            setRightSidebarOpen(false);
          } else {
            setLeftPanelOpen(true);
            setRightSidebarOpen(true);
          }
        });
      },
    },
    {
      id: 'toggle-left-panel',
      title: 'Toggle Left Sidebar',
      subtitle: 'Show/hide layers and audio assets',
      category: 'View',
      icon: PanelLeftOpen,
      shortcut: ['['],
      action: toggleLeftPanel,
    },
    {
      id: 'toggle-right-sidebar',
      title: 'Toggle Right Inspector',
      subtitle: 'Show/hide scene and layer properties',
      category: 'View',
      icon: PanelRightOpen,
      shortcut: [']'],
      action: toggleRightSidebar,
    },
    {
      id: 'undo',
      title: 'Undo Last Action',
      subtitle: 'Revert previous project edit',
      category: 'Editing',
      icon: Sparkles,
      shortcut: ['Mod', 'Z'],
      action: undo,
    },
    {
      id: 'redo',
      title: 'Redo Action',
      subtitle: 'Re-apply previously undone edit',
      category: 'Editing',
      icon: Sparkles,
      shortcut: ['Mod', 'Shift', 'Z'],
      action: redo,
    },
    {
      id: 'toggle-audio-mute',
      title: project.audio?.muted ? 'Unmute Audio' : 'Mute Audio',
      subtitle: 'Toggle master audio volume',
      category: 'Project',
      icon: Sparkles,
      action: toggleProjectAudioMuted,
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts Guide',
      subtitle: 'View cheat sheet of all keybindings',
      category: 'Project',
      icon: Sparkles,
      shortcut: ['?'],
      action: () => setShortcutsModalOpen(true),
    },
  ], [
    isPlaying,
    togglePlay,
    splitAtPlayhead,
    activeShotId,
    addLayerToShot,
    setActiveTool,
    project,
    handleOpenExportModal,
    projectFileInputRef,
    leftPanelOpen,
    rightSidebarOpen,
    setLeftPanelOpen,
    setRightSidebarOpen,
    toggleLeftPanel,
    toggleRightSidebar,
    undo,
    redo,
    toggleProjectAudioMuted,
    setShortcutsModalOpen,
  ]);
}

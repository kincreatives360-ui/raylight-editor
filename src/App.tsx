import {
  defaultInspectorWidth,
  MIN_STAGE_WIDTH,
  MIN_LEFT_PANEL_WIDTH,
  MAX_LEFT_PANEL_WIDTH,
  DEFAULT_LEFT_PANEL_WIDTH,
  MIN_RIGHT_SIDEBAR_WIDTH,
  MAX_RIGHT_SIDEBAR_WIDTH,
} from './ui/workspaceLayout';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftOpen, PanelRightOpen, Plus } from 'lucide-react';
import { DisplaySettingsMenu } from './ui/DisplaySettingsMenu';
import type { Layer } from './model/types';
import { useProjectStore } from './store/useProjectStore';
import { usePlayheadStore } from './store/usePlayheadStore';
import { useSelectionStore } from './store/useSelectionStore';
import { decodeAudioFromDataUrl } from './engine/audioEngine';
import { useAppPlayback } from './app/useAppPlayback';
import { useAppProjectPersistence } from './app/useAppProjectPersistence';
import { handleAppMediaUpload } from './app/mediaImport';
import { useAppClipboardPaste } from './app/useAppClipboardPaste';
import { useAppKeyboardShortcuts } from './app/useAppKeyboardShortcuts';
import { useAppExport } from './app/useAppExport';
import { useAppCommandList } from './app/useAppCommandList';
import { handleAppAudioUpload } from './app/audioImport';
import { handleAppProjectImport } from './app/projectImport';
import { ModalErrorBoundary, StageErrorBoundary } from './app/AppErrorBoundaries';
import { useAppWorkspaceLayout } from './app/useAppWorkspaceLayout';
const Stage = lazy(() => import('./stage/Stage').then(({ Stage }) => ({ default: Stage })));
import { LeftPanel } from './panels/LeftPanel/LeftPanel';
import { RightSidebar } from './panels/Inspector/RightSidebar';
import { Timeline } from './panels/Timeline/Timeline';
import { estimateExportMetrics } from './engine/exportMetrics';
import { preloadProjectFonts } from './engine/fontLoader';
const KeyboardShortcutsModal = lazy(() =>
  import('./ui/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal }))
);
const ExportModal = lazy(() =>
  import('./ui/ExportModal').then((m) => ({ default: m.ExportModal }))
);
import { CommandMenu } from './ui/CommandMenu';
import { SidebarResizeHandle } from './ui/SidebarResizeHandle';
import { IconButton } from './ui/primitives';
import { UndoToast } from './ui/UndoToast';
import { StageSkeletonLoader } from './ui/StageSkeletonLoader';

export default function App() {
  const {
    project,
    updateProject,
    updateShot,
    updateLayer,
    addLayerToShot,
    addMultipleLayersToShot,
    duplicateLayerInShot,
    deleteLayerFromShot,
    deleteMultipleLayersFromShot,
    deleteShot,
    restackLayerInShot,
    recordAnimatedBlockAtPlayhead,
    createGroupFromLayers,
    ungroupInShot,
    splitAtPlayhead,
    undo,
    redo,
    isHydrating,
    setHydrated,
  } = useProjectStore();

  const {
    hoverTimeMs,
    isPlaying,
    loop,
    setCurrentTimeMs,
    setIsPlaying,
    togglePlay,
  } = usePlayheadStore();

  const {
    selectedShotId,
    selectedLayerIds,
    selectedBlockId,
    selectedCameraBlockId,
    selectedLightBlockId,
    selectCameraBlock,
    selectLightBlock,
    isAnimateMode,
    selectLayer,
    selectShot,
    setSelectedLayerIds,
    selectBlock,
    setTimelineLayerExpanded,
    clearLayerSelection,
    setInspectorTab,
    setActiveTool,
    toggleAnimateMode,
    setIsCropping,
    leftPanelOpen,
    rightSidebarOpen,
    timelineOpen,
    toggleLeftPanel,
    toggleRightSidebar,
    setLeftPanelOpen,
    setRightSidebarOpen,
    leftPanelWidth,
    rightSidebarWidth,
    setLeftPanelWidth,
    setRightSidebarWidth,
  } = useSelectionStore();

  const [audioLabel, setAudioLabel] = useState<string>('');
  const [showSafeArea, setShowSafeArea] = useState<boolean>(() => {
    try {
      return localStorage.getItem('raylight_safe_area') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('raylight_safe_area', String(showSafeArea));
    } catch {
      // ignore
    }
  }, [showSafeArea]);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState<boolean>(false);
  const [undoToast, setUndoToast] = useState<{ message: string; isOpen: boolean; historyLength?: number }>({ message: '', isOpen: false });

  const handleDismissUndoToast = useCallback(() => {
    setUndoToast((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleToastUndo = useCallback(() => {
    if (undoToast.isOpen) {
      if (undoToast.historyLength !== undefined) {
        if (useProjectStore.getState().past.length >= undoToast.historyLength) {
          undo();
        }
      } else {
        undo();
      }
      handleDismissUndoToast();
    }
  }, [undoToast.isOpen, undoToast.historyLength, undo, handleDismissUndoToast]);

  useEffect(() => {
    if (!undoToast.isOpen || undoToast.historyLength === undefined) return;
    return useProjectStore.subscribe((state) => {
      if (state.past.length < undoToast.historyLength!) {
        setUndoToast((prev) => ({ ...prev, isOpen: false }));
      }
    });
  }, [undoToast.isOpen, undoToast.historyLength]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const copiedLayersRef = useRef<Layer[]>([]);

  const totalDurationMs = useMemo(
    () =>
      project.shots.reduce(
        (max, s) => Math.max(max, s.startMs + s.durationMs),
        0
      ),
    [project.shots]
  );

  const activeShot = useMemo(
    () => project.shots.find((s) => s.id === selectedShotId) || project.shots[0],
    [project.shots, selectedShotId]
  );
  const projectActiveShot = activeShot;

  const selectedLayerSet = useMemo(
    () => new Set(selectedLayerIds),
    [selectedLayerIds]
  );

  // IMPORTANT FIX: Do NOT fall back to activeShot.layers[0] when selectedLayerIds is empty!
  // When selectedLayerIds is empty, selectedLayer is undefined so RightSidebar shows Shot Settings.
  const selectedLayer = useMemo(
    () =>
      selectedLayerIds.length > 0 && projectActiveShot?.layers
        ? projectActiveShot.layers.find((l) => selectedLayerSet.has(l.id))
        : undefined,
    [selectedLayerIds.length, projectActiveShot, selectedLayerSet]
  );

  const {
    exportModalOpen,
    setExportModalOpen,
    exportSettings,
    setExportSettings,
    exporting,
    exportProgressText,
    exportPercent,
    exportError,
    handleOpenExportModal,
    handleStartExport,
    cancelExport,
  } = useAppExport({ project, selectedShotId: activeShot?.id ?? '', setIsPlaying, setCurrentTimeMs });

  const exportMetrics = useMemo(
    () =>
      estimateExportMetrics(project, {
        ...exportSettings,
        selectedShotId: activeShot?.id ?? '',
      }),
    [project, exportSettings, activeShot?.id]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSelectAudioClick = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  const handleSelectLayer = useCallback(
    (id: string, multi?: boolean) => {
      setInspectorTab('layer');
      selectLayer(id, multi);
    },
    [setInspectorTab, selectLayer]
  );

  const handleToggleSafeArea = useCallback(() => {
    setShowSafeArea((prev) => !prev);
  }, []);

  const handleOpenShortcuts = useCallback(() => {
    setShortcutsModalOpen(true);
  }, []);

  useAppProjectPersistence({ project, isHydrating, updateProject, setHydrated });

  // Decode imported audio assets and keep WebAudio playback synchronized with the active playhead.
  useEffect(() => {
    for (const clip of project.audio?.clips || []) {
      if (clip.dataUrl && !clip.muted) void decodeAudioFromDataUrl(clip.dataUrl);
    }
  }, [project.audio?.clips]);

  const projectFontKey = useMemo(() => {
    const families = new Set<string>();
    for (const shot of project.shots || []) {
      for (const layer of shot.layers || []) {
        if (layer.kind === 'text' && layer.font?.family) {
          families.add(layer.font.family);
        }
      }
    }
    return Array.from(families).sort().join('|');
  }, [project.shots]);

  useEffect(() => {
    void preloadProjectFonts(project);
  }, [projectFontKey, project]);

  useAppPlayback({
    project,
    isPlaying,
    hoverTimeMs,
    loop,
    totalDurationMs,
    setCurrentTimeMs,
    setIsPlaying,
  });

  useAppClipboardPaste({
    activeShot,
    copiedLayersRef,
    addLayerToShot,
    addMultipleLayersToShot,
    updateProject,
    selectLayer,
    setSelectedLayerIds,
    setInspectorTab,
  });
  const { workspaceWidth, setResizePriority, panelLayout } = useAppWorkspaceLayout({
    leftPanelWidth,
    rightSidebarWidth,
    leftPanelOpen,
    rightSidebarOpen,
    setLeftPanelOpen,
    setRightSidebarOpen,
  });
  useAppKeyboardShortcuts({
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
    undoToastOpen: undoToast.isOpen,
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
  });
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) =>
    handleAppMediaUpload(event, {
      activeShot,
      selectedLayer,
      updateProject,
      addLayerToShot,
      addMultipleLayersToShot,
      selectLayer,
      setSelectedLayerIds,
      setInspectorTab,
      setAudioLabel,
    });
  const commandList = useAppCommandList({
    project,
    activeShotId: activeShot?.id ?? '',
    projectFileInputRef,
    handleOpenExportModal,
    setShortcutsModalOpen,
  });
  return (
    <div className="raylight-app-shell flex h-full w-full flex-col select-none overflow-hidden font-sans">
      {/* Hidden File Inputs */}
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".json,.raylight.json,application/json"
        onChange={(event) => handleAppProjectImport(event, updateProject, (msg) => setUndoToast({ message: msg, isOpen: true }))}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.svg"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(event) => handleAppAudioUpload(event, updateProject, setAudioLabel)}
        className="hidden"
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden" style={{ '--workspace-left-width': panelLayout.left + 'px', '--workspace-right-width': panelLayout.right + 'px' } as React.CSSProperties}>
        {/* COLUMN 1: FULL-HEIGHT LEFT SIDEBAR OR FLOATING RESTORE TAB */}
        {panelLayout.showLeft ? (
          <>
            <LeftPanel
              activeShot={projectActiveShot}
              onUploadClick={handleUploadClick}
              audioLabel={audioLabel}
              onSelectAudioClick={handleSelectAudioClick}
              onImportProjectClick={() => projectFileInputRef.current?.click()}
            />
            {/* Draggable vertical splitter for Left Panel */}
            <SidebarResizeHandle
              side="left" width={panelLayout.left}
              minWidth={MIN_LEFT_PANEL_WIDTH} maxWidth={MAX_LEFT_PANEL_WIDTH}
              resetWidth={DEFAULT_LEFT_PANEL_WIDTH}
              getMaxWidth={() => window.innerWidth - panelLayout.right - MIN_STAGE_WIDTH}
              onResize={width => { setResizePriority('left'); setLeftPanelWidth(width); }} label="Resize left panel" title="Drag to resize left panel (double-click to reset)"
            />
          </>
        ) : (
          <div className="absolute left-3 top-3 z-30 flex items-center gap-1 p-1 rounded-xl bg-surface/90 hover:bg-subtle/90 border border-subtle shadow-xl backdrop-blur-md transition-colors duration-150">
            <IconButton
              unstyled
              tooltip={false}
              label="Expand Left Panel"
              type="button"
              onClick={() => {
                setResizePriority('left');
                setLeftPanelOpen(true);
                if (workspaceWidth < leftPanelWidth + rightSidebarWidth + MIN_STAGE_WIDTH) {
                  setRightSidebarOpen(false);
                }
              }}
              title="Expand Left Panel ( [ )"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
              icon={<>
                <PanelLeftOpen className="w-3.5 h-3.5 text-brand-blue" />
                <span className="hidden sm:inline">Panels</span>
              </>}
            />
            <button
              type="button"
              onClick={handleUploadClick}
              title="Upload media or assets"
              aria-label="Upload media or assets"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-subtle cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* COLUMN 2: CENTER 3D WEBGL STAGE + FLOATING TOOLBAR + BOTTOM TIMELINE */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full bg-panel raylight-stage">
          <StageErrorBoundary>
            <Suspense fallback={<StageSkeletonLoader />}>
              <Stage
                project={project}
                selectedLayerIds={selectedLayerIds}
                onSelectLayer={handleSelectLayer}
                showSafeArea={showSafeArea}
                snapEnabled={true}
                onToggleSafeArea={handleToggleSafeArea}
                onOpenShortcuts={handleOpenShortcuts}
              />
            </Suspense>
          </StageErrorBoundary>

          {timelineOpen && <Timeline totalDurationMs={totalDurationMs} />}
        </main>

        {/* COLUMN 3: FULL-HEIGHT RIGHT SIDEBAR (Design / Animate) OR FLOATING RESTORE TAB */}
        {panelLayout.showRight ? (
          <>
            {/* Draggable vertical splitter for Right Sidebar */}
            <SidebarResizeHandle
              side="right" width={panelLayout.right}
              minWidth={MIN_RIGHT_SIDEBAR_WIDTH} maxWidth={MAX_RIGHT_SIDEBAR_WIDTH}
              resetWidth={defaultInspectorWidth(workspaceWidth)}
              getMaxWidth={() => window.innerWidth - panelLayout.left - MIN_STAGE_WIDTH}
              onResize={width => { setResizePriority('right'); setRightSidebarWidth(width); }} label="Resize right inspector" title="Drag to resize inspector (double-click to reset)"
            />
            <RightSidebar
              activeShot={projectActiveShot}
              selectedLayer={selectedLayer}
              selectedLayerIds={selectedLayerIds}
              onSwapImageClick={handleUploadClick}
              onOpenExportModal={handleOpenExportModal}
              onOpenShortcuts={handleOpenShortcuts}
              showSafeArea={showSafeArea}
              onToggleSafeArea={handleToggleSafeArea}
              leftPanelOpen={panelLayout.showLeft}
              timelineOpen={timelineOpen}
            />
          </>
        ) : (
          <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 p-1 rounded-xl bg-surface/90 hover:bg-subtle/90 border border-subtle shadow-xl backdrop-blur-md transition-colors duration-150">
            <DisplaySettingsMenu
              showSafeArea={showSafeArea}
              onToggleSafeArea={handleToggleSafeArea}
              leftPanelOpen={panelLayout.showLeft}
              rightSidebarOpen={panelLayout.showRight}
              timelineOpen={timelineOpen}
              align="right"
            />
            <button
              type="button"
              onClick={handleOpenExportModal}
              title="Export project"
              aria-label="Export project"
              className="px-2.5 py-1 rounded-lg bg-brand-blue hover:bg-brand-blue-hover text-white font-medium text-[11px] cursor-pointer transition shadow-xs"
            >
              Export
            </button>
            <IconButton
              unstyled
              tooltip={false}
              label="Expand Inspector"
              type="button"
              onClick={toggleRightSidebar}
              title="Expand Inspector ( ] )"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
              icon={<>
                <PanelRightOpen className="w-3.5 h-3.5 text-brand-blue" />
                <span className="hidden sm:inline">Inspector</span>
              </>}
            />
          </div>
        )}

      </div>

      {/* EXPORT / SHARE MODAL */}
      {exportModalOpen && (
        <ModalErrorBoundary title="Export Dialog" onClose={() => setExportModalOpen(false)}>
          <Suspense fallback={null}>
            <ExportModal
              isOpen={exportModalOpen}
              onClose={() => setExportModalOpen(false)}
              exportSettings={exportSettings}
              setExportSettings={setExportSettings}
              exportMetrics={exportMetrics}
              project={project}
              activeShot={activeShot}
              exporting={exporting}
              exportProgressText={exportProgressText}
              exportPercent={exportPercent}
              exportError={exportError}
              onStartExport={handleStartExport}
              onCancelExport={cancelExport}
            />
          </Suspense>
        </ModalErrorBoundary>
      )}

      {/* KEYBOARD SHORTCUTS MODAL */}
      <UndoToast
        message={undoToast.message}
        isOpen={undoToast.isOpen}
        onUndo={handleToastUndo}
        onDismiss={handleDismissUndoToast}
      />
      <CommandMenu isOpen={commandMenuOpen} onClose={() => setCommandMenuOpen(false)} commands={commandList} />
      {shortcutsModalOpen && (
        <ModalErrorBoundary title="Shortcuts Guide" onClose={() => setShortcutsModalOpen(false)}>
          <Suspense fallback={null}>
            <KeyboardShortcutsModal
              isOpen={shortcutsModalOpen}
              onClose={() => setShortcutsModalOpen(false)}
            />
          </Suspense>
        </ModalErrorBoundary>
      )}
    </div>
  );
}

import { ModalShell } from './ui/ModalShell';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Download, Upload, PanelLeftOpen, PanelRightOpen, Camera } from 'lucide-react';
import type { Layer, VideoLayer } from './model/types';
import { createDefaultShot } from './model/defaults';
import { useProjectStore } from './store/useProjectStore';
import { usePlayheadStore } from './store/usePlayheadStore';
import {
  useSelectionStore,
  MIN_LEFT_PANEL_WIDTH,
  MAX_LEFT_PANEL_WIDTH,
  DEFAULT_LEFT_PANEL_WIDTH,
  MIN_RIGHT_SIDEBAR_WIDTH,
  MAX_RIGHT_SIDEBAR_WIDTH,
  DEFAULT_RIGHT_SIDEBAR_WIDTH,
} from './store/useSelectionStore';
import { evaluateProjectAtTime, isLayerEffectivelyLocked } from './engine/evaluateShot';
import {
  parseFigmaSvgToLayers,
  readImageFileWithThumbnail,
} from './engine/figmaSvgImporter';
import { decodeAudioFromDataUrl, syncAudioPlayback, stopAudioPlayback } from './engine/audioEngine';
const Stage = lazy(() => import('./stage/Stage').then(({ Stage }) => ({ default: Stage })));
import { LeftPanel } from './panels/LeftPanel/LeftPanel';
import { RightSidebar } from './panels/Inspector/RightSidebar';
import { Timeline } from './panels/Timeline/Timeline';
import { saveProjectToBrowser, loadProjectFromIndexedDB, exportProjectToFile, importProjectFromFile } from './storage/projectIO';
import type { ExportSettings } from './engine/exporter';
import { isMediaRecorderMp4Supported } from './engine/exportCapabilities';
import { estimateExportMetrics } from './engine/exportMetrics';
import { preloadProjectFonts } from './engine/fontLoader';
const KeyboardShortcutsModal = lazy(() =>
  import('./ui/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal }))
);
const ExportModal = lazy(() =>
  import('./ui/ExportModal').then((m) => ({ default: m.ExportModal }))
);
import { CommandMenu, type CommandItem } from './ui/CommandMenu';
import { SidebarResizeHandle } from './ui/SidebarResizeHandle';
import { IconButton } from './ui/primitives';
import { UndoToast } from './ui/UndoToast';
import { StageSkeletonLoader } from './ui/StageSkeletonLoader';
import { isEditableElement, isInteractiveElement } from './utils/shortcuts';
import { withViewTransition } from './utils/viewTransitions';

interface StageErrorBoundaryProps {
  children: React.ReactNode;
}

interface StageErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class StageErrorBoundary extends React.Component<StageErrorBoundaryProps, StageErrorBoundaryState> {
  constructor(props: StageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): StageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Stage render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#111114] text-[#a1a1aa] p-6 text-center select-none">
          <div className="text-sm font-semibold text-white mb-1.5">Stage Canvas Failed to Load</div>
          <div className="text-xs text-rose-400 mb-4 max-w-md">
            {this.state.error?.message || 'A runtime error occurred in the 3D viewport.'}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-3.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs font-medium text-white transition cursor-pointer"
          >
            Retry Loading Stage
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ModalErrorBoundaryProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ModalErrorBoundary extends React.Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  constructor(props: ModalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ModalErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ModalShell
            backdropProps={{ className: "fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" }}
            surfaceProps={{ className: "w-full max-w-sm rounded-2xl bg-[#121216] border border-red-500/30 p-5 space-y-3 text-center text-xs" }}
        >
            <div className="text-sm font-semibold text-white">Failed to load {this.props.title}</div>
            <p className="text-zinc-400 text-[11px]">
              {this.state.error?.message || 'A network error occurred while loading this dialog.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-medium transition cursor-pointer"
            >
              Close
            </button>
        </ModalShell>
      );
    }
    return this.props.children;
  }
}

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
    toggleProjectAudioMuted,
    isHydrating,
    setHydrated,
  } = useProjectStore();

  const {
    currentTimeMs,
    hoverTimeMs,
    isPlaying,
    loop,
    setCurrentTimeMs,
    setIsPlaying,
    togglePlay,
  } = usePlayheadStore();

  const {
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
  const [showSafeArea, setShowSafeArea] = useState<boolean>(false);
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
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(() => ({
    format: isMediaRecorderMp4Supported() ? 'mp4' : 'webm',
    resolution: '1080p',
    fps: 60,
    quality: 'social',
    scope: 'entire',
  }));
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');
  const [exportPercent, setExportPercent] = useState<number>(0);
  const [exportError, setExportError] = useState<string>('');
  const exportAbortRef = useRef<AbortController | null>(null);
  const exportCloseTimerRef = useRef<number | null>(null);

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

  // Skimmer support: Canvas renders skimTime ?? playheadTime
  const effectiveTimeMs = hoverTimeMs !== null ? hoverTimeMs : currentTimeMs;

  const frame = useMemo(
    () => evaluateProjectAtTime(project, effectiveTimeMs),
    [project, effectiveTimeMs]
  );

  const activeShot = frame.activeShot;
  const projectActiveShot = useMemo(
    () => project.shots.find((s) => s.id === frame.activeShot.id) || project.shots[0] || frame.activeShot,
    [project.shots, frame.activeShot]
  );

  const selectedLayerSet = useMemo(
    () => new Set(selectedLayerIds),
    [selectedLayerIds]
  );

  // IMPORTANT FIX: Do NOT fall back to activeShot.layers[0] when selectedLayerIds is empty!
  // When selectedLayerIds is empty, selectedLayer is undefined so RightSidebar shows Shot Settings.
  const selectedLayer = useMemo(
    () =>
      selectedLayerIds.length > 0
        ? projectActiveShot.layers.find((l) => selectedLayerSet.has(l.id))
        : undefined,
    [selectedLayerIds.length, projectActiveShot.layers, selectedLayerSet]
  );

  const exportMetrics = useMemo(
    () =>
      estimateExportMetrics(project, {
        ...exportSettings,
        selectedShotId: activeShot.id,
      }),
    [project, exportSettings, activeShot.id]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSelectAudioClick = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  const handleOpenExportModal = useCallback(() => {
    setExportProgressText('');
    setExportError('');
    setExportModalOpen(true);
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

  useEffect(() => {
    if (isHydrating) return;
    const timeoutId = window.setTimeout(() => saveProjectToBrowser(project), 250);
    const saveOnPageHide = () => {
      if (!isHydrating) {
        saveProjectToBrowser(project);
      }
    };
    window.addEventListener('pagehide', saveOnPageHide);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pagehide', saveOnPageHide);
    };
  }, [project, isHydrating]);

  // Restore heavy assets from IndexedDB on startup if available
  useEffect(() => {
    void loadProjectFromIndexedDB()
      .then((idbProject) => {
        if (idbProject && idbProject.assets && Object.keys(idbProject.assets).length > 0) {
          updateProject(
            (curr) => {
              if (idbProject.id !== curr.id) return curr;

              const restoredAssets = { ...curr.assets };
              let hasNewData = false;
              for (const [id, asset] of Object.entries(idbProject.assets)) {
                if (asset.dataUrl && (!restoredAssets[id] || !restoredAssets[id].dataUrl)) {
                  if (!restoredAssets[id]) {
                    const isReferenced =
                      (curr.background?.kind === 'image' && curr.background.assetId === id) ||
                      curr.shots.some(
                        (s) =>
                          (s.background?.kind === 'image' && s.background.assetId === id) ||
                          s.layers.some(
                            (l) => 'assetId' in l && (l as { assetId?: string }).assetId === id
                          )
                      ) ||
                      (curr.audio?.clips?.some((c) => c.assetId === id) ?? false);

                    if (!isReferenced) continue;
                  }

                  restoredAssets[id] = { ...(restoredAssets[id] || {}), ...asset };
                  hasNewData = true;
                }
              }
              if (!hasNewData) return curr;
              return {
                ...curr,
                assets: restoredAssets,
              };
            },
            { skipHistory: true }
          );
        }
      })
      .catch((err) => {
        console.warn('[Raylight Storage] Hydration from IndexedDB failed:', err);
      })
      .finally(() => {
        setHydrated(true);
      });
  }, [updateProject, setHydrated]);

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

  useEffect(() => {
    syncAudioPlayback(project.audio, isPlaying && hoverTimeMs === null, usePlayheadStore.getState().currentTimeMs);
  }, [project.audio, isPlaying, hoverTimeMs]);

  useEffect(() => {
    let lastSyncPlayhead = usePlayheadStore.getState().currentTimeMs;
    let lastSyncWallTime = performance.now();

    const unsub = usePlayheadStore.subscribe((state) => {
      if (!state.isPlaying || state.hoverTimeMs !== null) {
        lastSyncPlayhead = state.currentTimeMs;
        lastSyncWallTime = performance.now();
        return;
      }

      const elapsed = performance.now() - lastSyncWallTime;
      const expectedTime = lastSyncPlayhead + elapsed;
      const drift = Math.abs(state.currentTimeMs - expectedTime);

      // Normal playback ticks advance smoothly with drift < 35ms.
      // Any seek (small or large) causes drift > 45ms from the expected audio playback clock.
      if (drift > 45) {
        lastSyncPlayhead = state.currentTimeMs;
        lastSyncWallTime = performance.now();
      }
      syncAudioPlayback(project.audio, true, state.currentTimeMs);
    });
    return unsub;
  }, [project.audio]);

  useEffect(() => () => stopAudioPlayback(), []);

  // 60fps Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    if (totalDurationMs <= 0) {
      setIsPlaying(false);
      return;
    }
    let rafId: number;
    let lastTime = performance.now();
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      const dt = now - lastTime;
      lastTime = now;

      let reachedEnd = false;
      setCurrentTimeMs((prev) => {
        const next = prev + dt;
        if (next >= totalDurationMs) {
          if (loop) return 0;
          reachedEnd = true;
          return totalDurationMs;
        }
        return next;
      });

      if (reachedEnd) {
        stopped = true;
        setIsPlaying(false);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, loop, totalDurationMs, setCurrentTimeMs, setIsPlaying]);

  // Global Clipboard Paste Listener (Figma SVG, Screenshots, & Copied Layers)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const clipboard = e.clipboardData;
      if (!clipboard) return;

      const plainText = clipboard.getData('text/plain') || '';
      if (plainText.trim().startsWith('<svg') || plainText.includes('<svg')) {
        e.preventDefault();
        const parsed = parseFigmaSvgToLayers(
          plainText,
          activeShot.durationMs,
          activeShot.layers.length
        );
        if (parsed.layers.length > 0) {
          addMultipleLayersToShot(
            activeShot.id,
            parsed.layers,
            parsed.assets
          );
          setInspectorTab('layer');
          setSelectedLayerIds(parsed.layers.map((l) => l.id));
        }
        return;
      }

      const items = Array.from(clipboard.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (file) {
          const assetRecord = await readImageFileWithThumbnail(file);
          const newLayer = addLayerToShot(activeShot.id, 'image', {
            name: 'Pasted image',
            assetId: assetRecord.id,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
          });
          updateProject(
            (p) => ({
              ...p,
              assets: { ...p.assets, [assetRecord.id]: assetRecord },
            }),
            { skipHistory: true }
          );
          setInspectorTab('layer');
          selectLayer(newLayer.id, false);
        }
        return;
      }

      if (copiedLayersRef.current.length > 0) {
        e.preventDefault();
        const clonedLayers: Layer[] = copiedLayersRef.current.map((orig, i) => {
          const clone: Layer = structuredClone(orig);
          clone.id = `layer-${orig.kind}-${Date.now()}-${i}`;
          clone.name = `${orig.name} Copy`;
          clone.position = {
            ...orig.position,
            x: Number((orig.position.x + 0.03).toFixed(4)),
            y: Number((orig.position.y + 0.03).toFixed(4)),
          };
          return clone;
        });
        addMultipleLayersToShot(activeShot.id, clonedLayers);
        setInspectorTab('layer');
        setSelectedLayerIds(clonedLayers.map((l) => l.id));
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [
    activeShot.id,
    activeShot.durationMs,
    activeShot.layers.length,
    addLayerToShot,
    addMultipleLayersToShot,
    updateProject,
    selectLayer,
    setSelectedLayerIds,
    setInspectorTab,
  ]);

  // Responsive auto-collapse sidebars on smaller screens / split view
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        setLeftPanelOpen(false);
      }
      if (width < 860) {
        setRightSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setLeftPanelOpen, setRightSidebarOpen]);

  // Global Studio Keyboard Shortcuts
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
        setInspectorTab('shot');
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

      // Single-Key Tool Shortcuts (V, G, Y, H, T, I, R, O, L, Escape)
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (isInteractiveElement(el)) {
          return;
        }
        if (key === 'v') {
          setActiveTool('select');
          return;
        }
        if (key === 'c') {
          setActiveTool('camera');
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
        if (key === 'p') { setActiveTool('pen'); return; }
        if (key === 's') {
          e.preventDefault();
          splitAtPlayhead(usePlayheadStore.getState().currentTimeMs);
          return;
        }
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
          if (undoToast.isOpen) {
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
          setInspectorTab('shot');
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
          const blkId = recordAnimatedBlockAtPlayhead(
            activeShot.id,
            selectedLayer.id,
            'position',
            { x: dx, y: dy, z: 0 },
            frame.shotLocalTimeMs,
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
    frame.shotLocalTimeMs,
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
    undoToast.isOpen,
  ]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = dataUrl;
      const addVideoClip = (durationMs: number) => {
        const assetId = `video-asset-${Date.now()}`;
        const vw = video.videoWidth || 1920;
        const vh = video.videoHeight || 1080;
        const asset = {
          id: assetId,
          name: file.name,
          mimeType: file.type,
          dataUrl,
          width: vw,
          height: vh,
        };
        const currentPlayheadMs = usePlayheadStore.getState().currentTimeMs;
        const clipDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
        const clipEnd = currentPlayheadMs + clipDuration;

        const videoLayer: VideoLayer = {
          id: `layer-video-${Date.now()}`,
          name: file.name,
          kind: 'video',
          order: (activeShot?.layers.length || 0) + 1,
          hidden: false,
          locked: false,
          inMs: 0,
          outMs: activeShot?.durationMs || 4000,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
          blendMode: 'normal',
          entrance: { type: 'none', durationMs: 400, delayMs: 0, distance: 0.2, easing: { kind: 'preset', name: 'ease-out' } },
          exit: { type: 'none', durationMs: 400, delayMs: 0, distance: 0.2, easing: { kind: 'preset', name: 'ease-out' } },
          blocks: [],
          effects: {},
          assetId,
          size: { width: 0.65, height: Math.min(0.85, 0.65 * (vh / (vw || 1))) },
          cornerRadius: 0.04,
        };

        updateProject((p) => {
          const currentTotal = p.shots.reduce((max, s) => Math.max(max, s.startMs + s.durationMs), 0);
          let nextShots = p.shots;
          if (clipEnd > currentTotal) {
            if (nextShots.length === 0) {
              nextShots = [createDefaultShot({ durationMs: clipEnd })];
            } else {
              const lastIdx = nextShots.length - 1;
              nextShots = nextShots.map((s, idx) =>
                idx === lastIdx ? { ...s, durationMs: clipEnd - s.startMs } : s
              );
            }
          }
          const targetShotId = activeShot?.id || nextShots[0]?.id;
          nextShots = nextShots.map((s) =>
            s.id === targetShotId ? { ...s, layers: [...s.layers, videoLayer] } : s
          );

          return {
            ...p,
            shots: nextShots,
            assets: { ...p.assets, [assetId]: asset },
            audio: {
              clips: [
                ...(p.audio?.clips || []),
                {
                  id: `audio-${assetId}`,
                  name: file.name,
                  assetId,
                  dataUrl,
                  startMs: currentPlayheadMs,
                  durationMs: clipDuration,
                  offsetMs: 0,
                  volume: 1,
                  muted: false,
                },
              ],
              muted: p.audio?.muted || false,
              masterVolume: p.audio?.masterVolume ?? 1,
            },
          };
        });

        setSelectedLayerIds([videoLayer.id]);
        setInspectorTab('layer');
        setAudioLabel(file.name);
        e.target.value = '';
      };
      video.addEventListener('loadedmetadata', () => addVideoClip(video.duration * 1000), { once: true });
      video.addEventListener('error', () => addVideoClip(10000), { once: true });
      return;
    }
    if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
      const svgText = await file.text();
      const parsed = parseFigmaSvgToLayers(
        svgText,
        activeShot.durationMs,
        activeShot.layers.length
      );
      if (parsed.layers.length > 0) {
        addMultipleLayersToShot(
          activeShot.id,
          parsed.layers,
          parsed.assets
        );
        setInspectorTab('layer');
        setSelectedLayerIds(parsed.layers.map((l) => l.id));
      }
      e.target.value = '';
      return;
    }

    const assetRecord = await readImageFileWithThumbnail(file);
    updateProject((proj) => ({ ...proj, assets: { ...proj.assets, [assetRecord.id]: assetRecord } }), { skipHistory: true });
    if (selectedLayer?.kind === 'image') {
      updateProject((proj) => ({
        ...proj,
        shots: proj.shots.map((shot) => shot.id !== activeShot.id ? shot : ({
          ...shot,
          layers: shot.layers.map((layer) => layer.id === selectedLayer.id && layer.kind === 'image' ? { ...layer, assetId: assetRecord.id, name: file.name } : layer),
        })),
      }));
      selectLayer(selectedLayer.id, false);
    } else {
      const currentPlayheadMs = usePlayheadStore.getState().currentTimeMs;
      const newLayer = addLayerToShot(activeShot.id, 'image', {
        name: file.name,
        assetId: assetRecord.id,
        position: { x: 0, y: 0, z: 0.1 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { width: Math.min(0.85, assetRecord.width / Math.max(1, assetRecord.height) * 0.42), height: 0.72 },
        inMs: Math.max(
          0,
          Math.min(
            Math.max(0, activeShot.durationMs - 1),
            currentPlayheadMs - activeShot.startMs
          )
        ),
        outMs: activeShot.durationMs,
      });
      selectLayer(newLayer.id, false);
    }
    setInspectorTab('layer');
    e.target.value = '';
  };

  const handleStartExport = async () => {
    setIsPlaying(false);
    setExportError('');
    setExportProgressText('');
    let controller: AbortController | null = null;
    try {
      if (exportSettings.format === 'png') {
        const { exportCurrentFrameAsPng } = await import('./engine/exporter');
        await exportCurrentFrameAsPng(
          project,
          project.name,
          usePlayheadStore.getState().currentTimeMs,
          exportSettings.resolution
        );
        setExportModalOpen(false);
        return;
      }

      if (exportCloseTimerRef.current !== null) {
        window.clearTimeout(exportCloseTimerRef.current);
        exportCloseTimerRef.current = null;
      }
      controller = new AbortController();
      exportAbortRef.current = controller;
      setExporting(true);
      setExportPercent(0);

      const { runVideoExportPipeline } = await import('./engine/exporter');
      await runVideoExportPipeline(
        project,
        (prog) => {
          setExportProgressText(prog.statusText);
          setExportPercent(prog.percent);
        },
        {
          ...exportSettings,
          selectedShotId: activeShot.id,
          onSeekFrame: async (seekTimeMs: number) => {
            setCurrentTimeMs(seekTimeMs);
          },
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setExportPercent(100);
        setExportProgressText('Export Complete!');
        exportCloseTimerRef.current = window.setTimeout(() => {
          setExportModalOpen(false);
          exportCloseTimerRef.current = null;
        }, 1200);
      }
    } catch (error) {
      if (controller?.signal.aborted) {
        setExportProgressText('Export cancelled.');
      } else {
        setExportError(error instanceof Error ? error.message : 'Export failed.');
      }
    } finally {
      setExporting(false);
      exportAbortRef.current = null;
    }
  };


  const commandList: CommandItem[] = useMemo(() => [
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
      shortcut: ['S'],
      action: () => splitAtPlayhead(usePlayheadStore.getState().currentTimeMs),
    },
    {
      id: 'add-text',
      title: 'Add Text Layer',
      subtitle: 'Create new 3D typography layer',
      category: 'Tools',
      icon: Sparkles,
      shortcut: ['T'],
      action: () => addLayerToShot(activeShot.id, 'text'),
    },
    {
      id: 'add-rect',
      title: 'Add Rectangle Shape',
      subtitle: 'Draw rectangular vector geometry',
      category: 'Tools',
      icon: Sparkles,
      shortcut: ['R'],
      action: () => addLayerToShot(activeShot.id, 'shape'),
    },
    {
      id: 'tool-camera',
      title: 'Camera Navigation Tool',
      subtitle: 'Orbit, pan, and dolly 3D scene camera',
      category: 'Tools',
      icon: Camera,
      shortcut: ['C'],
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
  ], [isPlaying, togglePlay, splitAtPlayhead, addLayerToShot, activeShot.id, setActiveTool, undo, redo, project, toggleProjectAudioMuted, leftPanelOpen, rightSidebarOpen, setLeftPanelOpen, setRightSidebarOpen, toggleLeftPanel, toggleRightSidebar, handleOpenExportModal, setShortcutsModalOpen]);

  return (
    <div className="flex h-full w-full flex-col bg-[#0b0b0d] text-[#e4e4e7] select-none overflow-hidden font-sans">
      {/* Hidden File Inputs */}
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".json,.raylight.json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          e.target.value = '';
          const res = await importProjectFromFile(f);
          if (res.success) {
            updateProject(() => res.project, { skipHistory: false });
          } else {
            console.error('Failed to import project file:', res.errors);
            alert('Failed to import project: ' + (res.errors?.[0] || 'Invalid file format'));
          }
        }}
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
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            e.target.value = '';
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = String(reader.result || '');
              const audio = new Audio(dataUrl);
              const currentPlayheadMs = usePlayheadStore.getState().currentTimeMs;
              const addClip = (durationMs: number) => {
                const clipDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
                const clipEnd = currentPlayheadMs + clipDuration;
                const clip = {
                  id: `audio-${Date.now()}`,
                  name: f.name,
                  dataUrl,
                  startMs: currentPlayheadMs,
                  durationMs: clipDuration,
                  offsetMs: 0,
                  volume: 1,
                  muted: false,
                };
                updateProject((p) => {
                  const currentTotal = p.shots.reduce((max, s) => Math.max(max, s.startMs + s.durationMs), 0);
                  let nextShots = p.shots;
                  if (clipEnd > currentTotal) {
                    if (nextShots.length === 0) {
                      nextShots = [createDefaultShot({ durationMs: clipEnd })];
                    } else {
                      const lastIdx = nextShots.length - 1;
                      nextShots = nextShots.map((s, idx) =>
                        idx === lastIdx ? { ...s, durationMs: clipEnd - s.startMs } : s
                      );
                    }
                  }
                  return {
                    ...p,
                    shots: nextShots,
                    audio: {
                      clips: [...(p.audio?.clips || []), clip],
                      muted: p.audio?.muted || false,
                      masterVolume: p.audio?.masterVolume ?? 1,
                    },
                  };
                });
                setAudioLabel(f.name);
              };
              audio.addEventListener('loadedmetadata', () => addClip(audio.duration * 1000), { once: true });
              audio.addEventListener('error', () => addClip(10000), { once: true });
            };
            reader.readAsDataURL(f);
          }
        }}
        className="hidden"
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* COLUMN 1: FULL-HEIGHT LEFT SIDEBAR OR FLOATING RESTORE TAB */}
        {leftPanelOpen ? (
          <>
            <LeftPanel
              activeShot={projectActiveShot}
              onUploadClick={handleUploadClick}
              audioLabel={audioLabel}
              onSelectAudioClick={handleSelectAudioClick}
            />
            {/* Draggable vertical splitter for Left Panel */}
            <SidebarResizeHandle
              side="left" width={leftPanelWidth}
              minWidth={MIN_LEFT_PANEL_WIDTH} maxWidth={MAX_LEFT_PANEL_WIDTH}
              resetWidth={DEFAULT_LEFT_PANEL_WIDTH}
              getMaxWidth={() => window.innerWidth - (rightSidebarOpen ? rightSidebarWidth : 0) - 340}
              onResize={setLeftPanelWidth} label="Resize left panel" title="Drag to resize left panel (double-click to reset)"
            />
          </>
        ) : (
          <IconButton
              unstyled
              tooltip={false}
              label="Expand Left Panel"
              type="button"
              onClick={toggleLeftPanel}
              title="Expand Left Panel ( [ )"
              className="absolute left-3 top-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18181b]/90 hover:bg-[#27272a] text-[#a1a1aa] hover:text-white border border-white/10 shadow-xl backdrop-blur-md transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff] text-xs font-medium"
              icon={<>
                <PanelLeftOpen className="w-3.5 h-3.5 text-[#0088ff]" />
                <span className="hidden sm:inline">Panels</span>
              </>}
          />
        )}

        {/* COLUMN 2: CENTER 3D WEBGL STAGE + FLOATING TOOLBAR + BOTTOM TIMELINE */}
        <main className="flex-1 flex flex-col min-w-0 h-full bg-[#111114]">
          <StageErrorBoundary>
            <Suspense fallback={<StageSkeletonLoader />}>
              <Stage
                project={project}
                frame={frame}
                selectedLayerIds={selectedLayerIds}
                onSelectLayer={handleSelectLayer}
                showSafeArea={showSafeArea}
                snapEnabled={true}
                onToggleSafeArea={handleToggleSafeArea}
                onOpenShortcuts={handleOpenShortcuts}
              />
            </Suspense>
          </StageErrorBoundary>

          <Timeline totalDurationMs={totalDurationMs} />
        </main>

        {/* COLUMN 3: FULL-HEIGHT RIGHT SIDEBAR (Design / Animate) OR FLOATING RESTORE TAB */}
        {rightSidebarOpen ? (
          <>
            {/* Draggable vertical splitter for Right Sidebar */}
            <SidebarResizeHandle
              side="right" width={rightSidebarWidth}
              minWidth={MIN_RIGHT_SIDEBAR_WIDTH} maxWidth={MAX_RIGHT_SIDEBAR_WIDTH}
              resetWidth={DEFAULT_RIGHT_SIDEBAR_WIDTH}
              getMaxWidth={() => window.innerWidth - (leftPanelOpen ? leftPanelWidth : 0) - 340}
              onResize={setRightSidebarWidth} label="Resize right inspector" title="Drag to resize inspector (double-click to reset)"
            />
            <RightSidebar
              activeShot={projectActiveShot}
              selectedLayer={selectedLayer}
              selectedLayerIds={selectedLayerIds}
              onSwapImageClick={handleUploadClick}
              onOpenExportModal={handleOpenExportModal}
              onOpenShortcuts={handleOpenShortcuts}
            />
          </>
        ) : (
          <IconButton
              unstyled
              tooltip={false}
              label="Expand Inspector"
              type="button"
              onClick={toggleRightSidebar}
              title="Expand Inspector ( ] )"
              className="absolute right-3 top-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18181b]/90 hover:bg-[#27272a] text-[#a1a1aa] hover:text-white border border-white/10 shadow-xl backdrop-blur-md transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff] text-xs font-medium"
              icon={<>
                <PanelRightOpen className="w-3.5 h-3.5 text-[#0088ff]" />
                <span className="hidden sm:inline">Inspector</span>
              </>}
          />
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
              onCancelExport={() => exportAbortRef.current?.abort()}
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

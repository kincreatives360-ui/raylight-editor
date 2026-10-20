// src/App.tsx
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, X, Sparkles, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
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
import { evaluateProjectAtTime } from './engine/evaluateShot';
import {
  parseFigmaSvgToLayers,
  readImageFileWithThumbnail,
} from './engine/figmaSvgImporter';
import { decodeAudioFromDataUrl, syncAudioPlayback, stopAudioPlayback } from './engine/audioEngine';
const Stage = lazy(() => import('./stage/Stage').then(({ Stage }) => ({ default: Stage })));
import { LeftPanel } from './panels/LeftPanel/LeftPanel';
import { RightSidebar } from './panels/Inspector/RightSidebar';
import { Timeline } from './panels/Timeline/Timeline';
import { saveProjectToBrowser, loadProjectFromIndexedDB } from './storage/projectIO';
import type {
  ExportSettings,
  ExportFormat,
  ExportResolution,
} from './engine/exporter';
import { isMediaRecorderMp4Supported } from './engine/exportCapabilities';
import { estimateExportMetrics } from './engine/exportMetrics';
import { preloadProjectFonts } from './engine/fontLoader';
import { KeyboardShortcutsModal } from './ui/KeyboardShortcutsModal';

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

export default function App() {
  const {
    project,
    updateProject,
    updateShot,
    addLayerToShot,
    addMultipleLayersToShot,
    duplicateLayerInShot,
    deleteLayerFromShot,
    deleteMultipleLayersFromShot,
    restackLayerInShot,
    recordAnimatedBlockAtPlayhead,
    createGroupFromLayers,
    ungroupInShot,
    splitAtPlayhead,
    undo,
    redo,
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
    isAnimateMode,
    selectLayer,
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
    () => project.shots.find((s) => s.id === frame.activeShot.id) || project.shots[0],
    [project.shots, frame.activeShot.id]
  );

  // IMPORTANT FIX: Do NOT fall back to activeShot.layers[0] when selectedLayerIds is empty!
  // When selectedLayerIds is empty, selectedLayer is undefined so RightSidebar shows Shot Settings.
  const selectedLayer = useMemo(
    () =>
      selectedLayerIds.length > 0
        ? projectActiveShot.layers.find((l) => selectedLayerIds.includes(l.id))
        : undefined,
    [selectedLayerIds, projectActiveShot.layers]
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

  const handleStartResizeLeftPanel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startW = leftPanelWidth;
      const currentTarget = e.currentTarget;
      currentTarget.setPointerCapture(pointerId);

      const handlePointerMove = (ev: PointerEvent) => {
        const deltaX = ev.clientX - startX;
        const maxAllowed = Math.min(
          MAX_LEFT_PANEL_WIDTH,
          window.innerWidth - (rightSidebarOpen ? rightSidebarWidth : 0) - 340
        );
        const newWidth = Math.max(MIN_LEFT_PANEL_WIDTH, Math.min(maxAllowed, startW + deltaX));
        setLeftPanelWidth(newWidth);
      };

      const handlePointerUp = () => {
        if (currentTarget.hasPointerCapture(pointerId)) {
          currentTarget.releasePointerCapture(pointerId);
        }
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [leftPanelWidth, rightSidebarOpen, rightSidebarWidth, setLeftPanelWidth]
  );

  const handleStartResizeRightSidebar = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startW = rightSidebarWidth;
      const currentTarget = e.currentTarget;
      currentTarget.setPointerCapture(pointerId);

      const handlePointerMove = (ev: PointerEvent) => {
        const deltaX = startX - ev.clientX; // Dragging left increases right sidebar width
        const maxAllowed = Math.min(
          MAX_RIGHT_SIDEBAR_WIDTH,
          window.innerWidth - (leftPanelOpen ? leftPanelWidth : 0) - 340
        );
        const newWidth = Math.max(MIN_RIGHT_SIDEBAR_WIDTH, Math.min(maxAllowed, startW + deltaX));
        setRightSidebarWidth(newWidth);
      };

      const handlePointerUp = () => {
        if (currentTarget.hasPointerCapture(pointerId)) {
          currentTarget.releasePointerCapture(pointerId);
        }
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [rightSidebarWidth, leftPanelOpen, leftPanelWidth, setRightSidebarWidth]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => saveProjectToBrowser(project), 250);
    const saveOnPageHide = () => saveProjectToBrowser(project);
    window.addEventListener('pagehide', saveOnPageHide);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pagehide', saveOnPageHide);
    };
  }, [project]);

  // Restore heavy assets from IndexedDB on startup if available
  useEffect(() => {
    void loadProjectFromIndexedDB().then((idbProject) => {
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
    });
  }, [updateProject]);

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
        syncAudioPlayback(project.audio, true, state.currentTimeMs);
      }
    });
    return unsub;
  }, [project.audio]);

  useEffect(() => () => stopAudioPlayback(), []);

  // 60fps Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      setCurrentTimeMs((prev) => {
        const next = prev + dt;
        if (next >= totalDurationMs) {
          if (loop) return 0;
          setIsPlaying(false);
          return totalDurationMs;
        }
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
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
            device: undefined,
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
      if (width < 768) {
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
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable ||
          el.getAttribute('role') === 'spinbutton' ||
          el.getAttribute('role') === 'textbox')
      ) {
        return;
      }

      // Escape: Close shortcuts modal or reset tools/selection
      if (e.key === 'Escape') {
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
      if (shortcutsModalOpen) {
        return;
      }

      const key = e.key.toLowerCase();

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
              selectedLayerIds.includes(l.id)
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
          selectedLayerIds.includes(l.id)
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

      // \: Zen Mode (Distraction-free 3D & Timeline stage)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === '\\') {
        e.preventDefault();
        if (leftPanelOpen || rightSidebarOpen) {
          setLeftPanelOpen(false);
          setRightSidebarOpen(false);
        } else {
          setLeftPanelOpen(true);
          setRightSidebarOpen(true);
        }
        return;
      }

      // Cmd/Ctrl + Z / Cmd/Ctrl + Shift + Z: Undo / Redo
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
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

      // Delete / Backspace: Delete Selected Layer(s)
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        selectedLayerIds.length > 0
      ) {
        e.preventDefault();
        deleteMultipleLayersFromShot(activeShot.id, selectedLayerIds);
        clearLayerSelection();
        setInspectorTab('shot');
        return;
      }

      // Space: Play / Pause
      if (e.code === 'Space') {
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

        if (isAnimateMode && selectedLayer && !selectedLayer.locked) {
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
            selectedLayerIds.includes(l.id) && !l.locked
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
    selectedLayer,
    selectedLayerIds,
    activeShot.id,
    activeShot.layers,
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
    selectLayer,
    setSelectedLayerIds,
    selectBlock,
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
      const controller = new AbortController();
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
        exportCloseTimerRef.current = window.setTimeout(() => {
          setExportModalOpen(false);
          exportCloseTimerRef.current = null;
        }, 600);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
      exportAbortRef.current = null;
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0b0b0d] text-[#e4e4e7] select-none overflow-hidden font-sans">
      {/* Hidden File Inputs */}
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
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left panel"
              aria-valuenow={leftPanelWidth}
              aria-valuemin={MIN_LEFT_PANEL_WIDTH}
              aria-valuemax={MAX_LEFT_PANEL_WIDTH}
              tabIndex={0}
              onPointerDown={handleStartResizeLeftPanel}
              onDoubleClick={() => setLeftPanelWidth(DEFAULT_LEFT_PANEL_WIDTH)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setLeftPanelWidth(leftPanelWidth - 10);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setLeftPanelWidth(leftPanelWidth + 10);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setLeftPanelWidth(MIN_LEFT_PANEL_WIDTH);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setLeftPanelWidth(MAX_LEFT_PANEL_WIDTH);
                }
              }}
              className="w-1.5 -mx-[3px] relative flex items-center justify-center cursor-col-resize group select-none shrink-0 z-20 hover:bg-[#0088ff]/40 active:bg-[#0088ff] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
              title="Drag to resize left panel (double-click to reset)"
            >
              <div className="w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-[#0088ff] transition-colors" />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={toggleLeftPanel}
            title="Expand Left Panel ( [ )"
            aria-label="Expand Left Panel"
            className="absolute left-3 top-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18181b]/90 hover:bg-[#27272a] text-[#a1a1aa] hover:text-white border border-white/10 shadow-xl backdrop-blur-md transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff] text-xs font-medium"
          >
            <PanelLeftOpen className="w-3.5 h-3.5 text-[#0088ff]" />
            <span className="hidden sm:inline">Panels</span>
          </button>
        )}

        {/* COLUMN 2: CENTER 3D WEBGL STAGE + FLOATING TOOLBAR + BOTTOM TIMELINE */}
        <main className="flex-1 flex flex-col min-w-0 h-full bg-[#111114]">
          <StageErrorBoundary>
            <Suspense fallback={<div className="flex-1 bg-[var(--bg-canvas,#07080d)]" />}>
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
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right inspector"
              aria-valuenow={rightSidebarWidth}
              aria-valuemin={MIN_RIGHT_SIDEBAR_WIDTH}
              aria-valuemax={MAX_RIGHT_SIDEBAR_WIDTH}
              tabIndex={0}
              onPointerDown={handleStartResizeRightSidebar}
              onDoubleClick={() => setRightSidebarWidth(DEFAULT_RIGHT_SIDEBAR_WIDTH)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setRightSidebarWidth(rightSidebarWidth + 10);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setRightSidebarWidth(rightSidebarWidth - 10);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setRightSidebarWidth(MIN_RIGHT_SIDEBAR_WIDTH);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setRightSidebarWidth(MAX_RIGHT_SIDEBAR_WIDTH);
                }
              }}
              className="w-1.5 -mx-[3px] relative flex items-center justify-center cursor-col-resize group select-none shrink-0 z-20 hover:bg-[#0088ff]/40 active:bg-[#0088ff] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
              title="Drag to resize inspector (double-click to reset)"
            >
              <div className="w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-[#0088ff] transition-colors" />
            </div>
            <RightSidebar
              activeShot={projectActiveShot}
              selectedLayer={selectedLayer}
              selectedLayerIds={selectedLayerIds}
              onSwapImageClick={handleUploadClick}
              onOpenExportModal={handleOpenExportModal}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={toggleRightSidebar}
            title="Expand Inspector ( ] )"
            aria-label="Expand Inspector"
            className="absolute right-3 top-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18181b]/90 hover:bg-[#27272a] text-[#a1a1aa] hover:text-white border border-white/10 shadow-xl backdrop-blur-md transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088ff] text-xs font-medium"
          >
            <PanelRightOpen className="w-3.5 h-3.5 text-[#0088ff]" />
            <span className="hidden sm:inline">Inspector</span>
          </button>
        )}

      </div>

      {/* EXPORT / SHARE MODAL */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#121216] border border-white/15 p-6 space-y-5 shadow-2xl text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0088ff]/20 border border-[#0088ff]/40 flex items-center justify-center text-[#0088ff]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Export &amp; Share Video
                  </h3>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Render MP4, Looping GIF, or High-Res PNG
                  </p>
                </div>
              </div>
              <button
                disabled={exporting}
                onClick={() => setExportModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: isMediaRecorderMp4Supported() ? ('mp4' as const) : ('webm' as const),
                    label: isMediaRecorderMp4Supported() ? 'MP4 Video' : 'WebM Video',
                    desc: isMediaRecorderMp4Supported() ? 'With sound' : 'VP9 with sound',
                  },
                  { id: 'gif' as const, label: 'Animated GIF', desc: 'Silent loop' },
                  { id: 'png' as const, label: 'PNG Still', desc: 'Current frame' },
                ] as { id: ExportFormat; label: string; desc: string }[]
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  disabled={exporting}
                  onClick={() =>
                    setExportSettings((s) => ({ ...s, format: fmt.id }))
                  }
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${exportSettings.format === fmt.id
                    ? 'bg-[#0088ff]/20 border-[#0088ff] text-white'
                    : 'bg-[#1c1c1f] border-white/10 text-[#a1a1aa] hover:text-white'
                    }`}
                >
                  <div className="font-semibold text-xs">{fmt.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {fmt.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Scope */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#8e8e93] block font-medium">Scope</span>
              <div className="h-8 p-0.5 rounded-lg bg-[#18181c] border border-white/[0.08] grid grid-cols-2 gap-0.5">
                <button
                  type="button"
                  disabled={exporting || exportSettings.format === 'png'}
                  onClick={() => setExportSettings((s) => ({ ...s, scope: 'entire' }))}
                  className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${
                    exportSettings.scope === 'entire'
                      ? 'bg-[#0088ff] text-white shadow-xs'
                      : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  Entire Timeline ({project.shots.length} shots)
                </button>
                <button
                  type="button"
                  disabled={exporting || exportSettings.format === 'png'}
                  onClick={() => setExportSettings((s) => ({ ...s, scope: 'shot' }))}
                  className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center truncate px-2 ${
                    exportSettings.scope === 'shot'
                      ? 'bg-[#0088ff] text-white shadow-xs'
                      : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  Selected Shot ({activeShot.name})
                </button>
              </div>
            </div>

            {/* Resolution & Frame Rate Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[11px] text-[#8e8e93] block font-medium">Resolution</span>
                <div className="h-8 p-0.5 rounded-lg bg-[#18181c] border border-white/[0.08] grid grid-cols-3 gap-0.5">
                  {(['720p', '1080p', '4k'] as ExportResolution[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      disabled={exporting || exportSettings.format === 'gif'}
                      onClick={() => setExportSettings((s) => ({ ...s, resolution: res }))}
                      className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${
                        exportSettings.resolution === res
                          ? 'bg-[#0088ff] text-white shadow-xs'
                          : 'text-[#8e8e93] hover:text-white'
                      }`}
                    >
                      {res === '4k' ? '4K' : res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] text-[#8e8e93] block font-medium">Frame Rate</span>
                <div className="h-8 p-0.5 rounded-lg bg-[#18181c] border border-white/[0.08] grid grid-cols-3 gap-0.5">
                  {([24, 30, 60] as (24 | 30 | 60)[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      disabled={exporting || exportSettings.format !== 'mp4'}
                      onClick={() => setExportSettings((s) => ({ ...s, fps: f }))}
                      className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${
                        exportSettings.fps === f
                          ? 'bg-[#0088ff] text-white shadow-xs'
                          : 'text-[#8e8e93] hover:text-white'
                      }`}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality & Compression */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#8e8e93] block font-medium">Compression</span>
              <div className="h-8 p-0.5 rounded-lg bg-[#18181c] border border-white/[0.08] grid grid-cols-3 gap-0.5">
                {[
                  { id: 'studio' as const, label: 'Studio (Sharp)' },
                  { id: 'social' as const, label: 'Social Media' },
                  { id: 'web' as const, label: 'Web (Fast)' },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    disabled={exporting || (exportSettings.format !== 'mp4' && exportSettings.format !== 'webm')}
                    onClick={() => setExportSettings((s) => ({ ...s, quality: q.id }))}
                    className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center truncate px-1 ${
                      exportSettings.quality === q.id
                        ? 'bg-[#0088ff] text-white shadow-xs'
                        : 'text-[#8e8e93] hover:text-white'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Made in Raylight Badge */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#18181c] border border-white/[0.08]">
              <div>
                <span className="text-[11px] text-white font-medium block">Made in Raylight Watermark</span>
                <span className="text-[10px] text-[#71717a]">Free plan watermark included on export</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/30">
                Included
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#18181c] border border-white/10 font-mono tabular-nums text-[11px] space-y-1.5 text-[#f4f4f5] tracking-tight">
              <div className="flex justify-between items-center">
                <span className="text-[#a1a1aa] font-sans">Dimensions:</span>
                <span className="font-semibold text-white">
                  {exportMetrics.width}&times;{exportMetrics.height}px
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#a1a1aa] font-sans">Estimated Size:</span>
                <span className="text-emerald-400 font-semibold">
                  ~{exportMetrics.estimatedSizeMb} MB
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#a1a1aa] font-sans">Estimated Time:</span>
                <span className="text-[#38bdf8] font-semibold">
                  ~{exportMetrics.estimatedTimeSec}s
                </span>
              </div>
            </div>

            {exporting && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#38bdf8] tracking-tight">
                  <span>{exportProgressText}</span>
                  <span className="font-semibold">{exportPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#0088ff] transition-[width] duration-150 ease-out"
                    style={{ width: `${exportPercent}%` }}
                  />
                </div>
              </div>
            )}

            {exportError && (
              <p role="alert" className="text-xs text-red-400">{exportError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  exporting
                    ? exportAbortRef.current?.abort()
                    : setExportModalOpen(false)
                }
                className="px-4 py-2 rounded-lg bg-[#1c1c1f] hover:bg-[#27272c] text-[#d4d4d8] cursor-pointer"
              >
                {exporting ? 'Cancel' : 'Close'}
              </button>
              <button
                disabled={exporting}
                onClick={handleStartExport}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0088ff] hover:bg-[#0077e6] text-white font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exporting
                    ? 'Rendering...'
                    : `Export ${exportSettings.format === 'webm' ? 'WebM' : exportSettings.format.toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS MODAL */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}

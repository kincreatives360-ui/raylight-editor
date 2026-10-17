// src/App.tsx
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Download, X, Sparkles } from 'lucide-react';
import type { Layer } from './model/types';
import { createDefaultShot } from './model/defaults';
import { useProjectStore } from './store/useProjectStore';
import { usePlayheadStore } from './store/usePlayheadStore';
import { useSelectionStore } from './store/useSelectionStore';
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
  ExportQuality,
  ExportScope,
} from './engine/exporter';
import { estimateExportMetrics } from './engine/exportMetrics';
import { preloadProjectFonts } from './engine/fontLoader';

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
  } = useSelectionStore();

  const [audioLabel, setAudioLabel] = useState<string>('');
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'mp4',
    resolution: '1080p',
    fps: 60,
    quality: 'social',
    scope: 'entire',
  });
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
          (curr) => ({
            ...curr,
            assets: {
              ...idbProject.assets,
              ...curr.assets,
            },
          }),
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

  useEffect(() => {
    void preloadProjectFonts(project);
  }, [project]);

  useEffect(() => {
    syncAudioPlayback(project.audio, isPlaying && hoverTimeMs === null, currentTimeMs);
  }, [project.audio, isPlaying, hoverTimeMs, currentTimeMs]);

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
          const clone: Layer = JSON.parse(JSON.stringify(orig));
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

  // Global Studio Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = document.activeElement?.tagName;
      if (
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT'
      ) {
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
          copiedLayersRef.current = JSON.parse(JSON.stringify(toCopy));
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
        if (e.key === 'Escape') {
          setIsCropping(false);
          setActiveTool('select');
          clearLayerSelection();
          setInspectorTab('shot');
          setExportModalOpen(false);
          return;
        }
      }

      // [ and ] (plus Cmd+[ and Cmd+]): Restack Layer Forward / Backward
      if ((e.key === ']' || e.key === '[') && selectedLayer) {
        e.preventDefault();
        const isForward = e.key === ']';
        const isExtreme = e.metaKey || e.ctrlKey;
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
    togglePlay,
  ]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file); });
      const video = document.createElement('video'); video.preload = 'metadata'; video.src = dataUrl;
      const addVideoClip = (durationMs: number) => {
        const assetId = `video-${Date.now()}`;
        const asset = {
          id: assetId,
          name: file.name,
          mimeType: file.type,
          dataUrl,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
        };
        const clipDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
        const clipEnd = currentTimeMs + clipDuration;
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
            assets: { ...p.assets, [assetId]: asset },
            audio: {
              clips: [
                ...(p.audio?.clips || []),
                {
                  id: assetId,
                  name: file.name,
                  assetId,
                  dataUrl,
                  startMs: currentTimeMs,
                  durationMs: clipDuration,
                  offsetMs: 0,
                  volume: 1,
                  muted: true,
                },
              ],
              muted: p.audio?.muted || false,
              masterVolume: p.audio?.masterVolume ?? 1,
            },
          };
        });
        setAudioLabel(file.name); e.target.value = '';
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
            currentTimeMs - activeShot.startMs
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
          currentTimeMs,
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
              const addClip = (durationMs: number) => {
                const clipDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
                const clipEnd = currentTimeMs + clipDuration;
                const clip = {
                  id: `audio-${Date.now()}`,
                  name: f.name,
                  dataUrl,
                  startMs: currentTimeMs,
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* COLUMN 1: FULL-HEIGHT LEFT SIDEBAR */}
        <LeftPanel
          activeShot={projectActiveShot}
          onUploadClick={() => fileInputRef.current?.click()}
          audioLabel={audioLabel}
          onSelectAudioClick={() => audioInputRef.current?.click()}
        />

        {/* COLUMN 2: CENTER 3D WEBGL STAGE + FLOATING TOOLBAR + BOTTOM TIMELINE */}
        <main className="flex-1 flex flex-col min-w-0 h-full bg-[#111114]">
          <StageErrorBoundary>
            <Suspense fallback={<div className="flex-1 bg-[#242424]" />}>
              <Stage
                project={project}
                frame={frame}
                selectedLayerIds={selectedLayerIds}
                onSelectLayer={(id, multi) => {
                  setInspectorTab('layer');
                  selectLayer(id, multi);
                }}
                showSafeArea={false}
                snapEnabled={true}
              />
            </Suspense>
          </StageErrorBoundary>

          <Timeline totalDurationMs={totalDurationMs} />
        </main>

        {/* COLUMN 3: FULL-HEIGHT RIGHT SIDEBAR (Design / Animate) */}
        <RightSidebar
          activeShot={projectActiveShot}
          selectedLayer={selectedLayer}
          selectedLayerIds={selectedLayerIds}
          onSwapImageClick={() => fileInputRef.current?.click()}
          onOpenExportModal={() => setExportModalOpen(true)}
        />

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
                  { id: 'mp4', label: 'MP4 Video', desc: 'With sound' },
                  { id: 'gif', label: 'Animated GIF', desc: 'Silent loop' },
                  { id: 'png', label: 'PNG Still', desc: 'Current frame' },
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[#a1a1aa] block mb-1">Resolution</span>
                <select
                  disabled={exporting || exportSettings.format === 'gif'}
                  value={exportSettings.resolution}
                  onChange={(e) =>
                    setExportSettings((s) => ({
                      ...s,
                      resolution: e.target.value as ExportResolution,
                    }))
                  }
                  className="w-full rounded-lg bg-[#1c1c1f] border border-white/10 px-3 py-2 text-white outline-none"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="4k">4K Ultra HD</option>
                </select>
              </div>
              <div>
                <span className="text-[#a1a1aa] block mb-1">Frame Rate</span>
                <select
                  disabled={exporting || exportSettings.format !== 'mp4'}
                  value={exportSettings.fps}
                  onChange={(e) =>
                    setExportSettings((s) => ({
                      ...s,
                      fps: Number(e.target.value) as 30 | 60,
                    }))
                  }
                  className="w-full rounded-lg bg-[#1c1c1f] border border-white/10 px-3 py-2 text-white outline-none"
                >
                  <option value={60}>60 FPS (Smooth)</option>
                  <option value={30}>30 FPS (Standard)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[#a1a1aa] block mb-1">Quality</span>
                <select
                  disabled={exporting || exportSettings.format !== 'mp4'}
                  value={exportSettings.quality}
                  onChange={(e) =>
                    setExportSettings((s) => ({
                      ...s,
                      quality: e.target.value as ExportQuality,
                    }))
                  }
                  className="w-full rounded-lg bg-[#1c1c1f] border border-white/10 px-3 py-2 text-white outline-none"
                >
                  <option value="studio">Studio (Sharpest)</option>
                  <option value="social">Social Media</option>
                  <option value="web">Web (Smallest)</option>
                </select>
              </div>
              <div>
                <span className="text-[#a1a1aa] block mb-1">Scope</span>
                <select
                  disabled={exporting || exportSettings.format === 'png'}
                  value={exportSettings.scope}
                  onChange={(e) =>
                    setExportSettings((s) => ({
                      ...s,
                      scope: e.target.value as ExportScope,
                    }))
                  }
                  className="w-full rounded-lg bg-[#1c1c1f] border border-white/10 px-3 py-2 text-white outline-none"
                >
                  <option value="entire">
                    Entire Timeline ({project.shots.length} Shots)
                  </option>
                  <option value="shot">
                    Selected Shot ({activeShot.name})
                  </option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#18181c] border border-white/10 font-mono text-[11px] space-y-1 text-[#d4d4d8]">
              <div className="flex justify-between">
                <span className="text-[#71717a]">Dimensions:</span>
                <span>
                  {exportMetrics.width}&times;{exportMetrics.height}px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717a]">Estimated Size:</span>
                <span className="text-emerald-400">
                  ~{exportMetrics.estimatedSizeMb} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#71717a]">Estimated Time:</span>
                <span className="text-[#38bdf8]">
                  ~{exportMetrics.estimatedTimeSec}s
                </span>
              </div>
            </div>

            {exporting && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-[#38bdf8]">
                  <span>{exportProgressText}</span>
                  <span>{exportPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#0088ff] transition-all duration-150"
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
                    : `Export ${exportSettings.format.toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

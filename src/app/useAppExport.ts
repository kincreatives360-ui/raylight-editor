import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '../model/types';
import type { ExportScope, ExportSettings } from '../engine/exporter';
import { getExportCapabilities } from '../engine/export/capabilities';
import { usePlayheadStore } from '../store/usePlayheadStore';

export const EXPORT_SETTINGS_STORAGE_KEY = 'raylight:export-settings-v2';

function loadInitialExportSettings(projectFps: Project['fps']): ExportSettings {
  const defaults: ExportSettings = {
    format: 'mp4',
    resolution: '1080p',
    fps: projectFps === 24 || projectFps === 30 || projectFps === 60 ? projectFps : 60,
    quality: 'social',
    scope: 'entire',
    gifHighQuality: true,
    gifLoop: true,
    imageFormat: 'png',
    imageDestination: 'file',
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ExportSettings>;
    return {
      ...defaults,
      ...(parsed.format ? { format: parsed.format } : {}),
      ...(parsed.resolution ? { resolution: parsed.resolution } : {}),
      ...(parsed.fps === 15 || parsed.fps === 24 || parsed.fps === 30 || parsed.fps === 60
        ? { fps: parsed.fps }
        : {}),
      ...(parsed.quality ? { quality: parsed.quality } : {}),
      ...(parsed.scope === 'entire' || parsed.scope === 'shot' ? { scope: parsed.scope } : {}),
      ...(typeof parsed.gifHighQuality === 'boolean' ? { gifHighQuality: parsed.gifHighQuality } : {}),
      ...(typeof parsed.gifLoop === 'boolean' ? { gifLoop: parsed.gifLoop } : {}),
      ...(parsed.imageFormat === 'png' || parsed.imageFormat === 'jpg'
        ? { imageFormat: parsed.imageFormat }
        : {}),
      ...(parsed.imageDestination === 'file' || parsed.imageDestination === 'clipboard'
        ? { imageDestination: parsed.imageDestination }
        : {}),
    };
  } catch {
    return defaults;
  }
}

interface UseAppExportOptions {
  project: Project;
  selectedShotId: string;
  setIsPlaying: ReturnType<typeof usePlayheadStore.getState>['setIsPlaying'];
  setCurrentTimeMs: ReturnType<typeof usePlayheadStore.getState>['setCurrentTimeMs'];
}

export function useAppExport({ project, selectedShotId, setIsPlaying, setCurrentTimeMs }: UseAppExportOptions) {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(() =>
    loadInitialExportSettings(project.fps)
  );
  const [exporting, setExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  const [exportPercent, setExportPercent] = useState(0);
  const [exportError, setExportError] = useState('');
  const exportAbortRef = useRef<AbortController | null>(null);
  const exportCloseTimerRef = useRef<number | null>(null);
  const prevProjectFpsRef = useRef(project.fps);

  // Sync export FPS when project FPS changes in Project Settings.
  useEffect(() => {
    if (prevProjectFpsRef.current !== project.fps) {
      prevProjectFpsRef.current = project.fps;
      if (project.fps === 24 || project.fps === 30 || project.fps === 60) {
        setExportSettings((prev) =>
          prev.format === 'gif' ? prev : { ...prev, fps: project.fps }
        );
      }
    }
  }, [project.fps]);

  // Persist user export settings to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(exportSettings));
    } catch {
      // Ignore storage quota errors
    }
  }, [exportSettings]);

  // Fall back from MP4 when this browser cannot encode H.264 video.
  useEffect(() => {
    let cancelled = false;
    getExportCapabilities().then((caps) => {
      if (cancelled) return;
      setExportSettings((current) => {
        if (current.format === 'mp4' && !caps.mp4.available && caps.webm.available) {
          return { ...current, format: 'webm' };
        }
        if (current.format === 'webm' && !caps.webm.available && caps.mp4.available) {
          return { ...current, format: 'mp4' };
        }
        return current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (exportCloseTimerRef.current !== null) {
        window.clearTimeout(exportCloseTimerRef.current);
        exportCloseTimerRef.current = null;
      }
    };
  }, []);

  const handleOpenExportModal = useCallback((initialScope?: ExportScope | unknown) => {
    if (initialScope === 'entire' || initialScope === 'shot') {
      setExportSettings((prev) => ({ ...prev, scope: initialScope }));
    }
    setExportProgressText('');
    setExportError('');
    setExportModalOpen(true);
  }, []);

  const handleStartExport = async () => {
    setIsPlaying(false);
    setExportError('');
    setExportProgressText('');
    let controller: AbortController | null = null;
    try {
      if (exportCloseTimerRef.current !== null) {
        window.clearTimeout(exportCloseTimerRef.current);
        exportCloseTimerRef.current = null;
      }
      controller = new AbortController();
      exportAbortRef.current = controller;
      setExporting(true);
      setExportPercent(0);

      const playheadTimeMs = usePlayheadStore.getState().currentTimeMs;
      const { runVideoExportPipeline } = await import('../engine/exporter');
      await runVideoExportPipeline(
        project,
        (progress) => {
          setExportProgressText(progress.statusText);
          setExportPercent(progress.percent);
        },
        {
          ...exportSettings,
          selectedShotId,
          playheadTimeMs,
          onSeekFrame: async (seekTimeMs: number) => {
            setCurrentTimeMs(seekTimeMs);
          },
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setExportPercent(100);
        setExportProgressText(
          exportSettings.format === 'png' && exportSettings.imageDestination === 'clipboard'
            ? 'Copied to Clipboard!'
            : 'Export Complete!'
        );
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

  const cancelExport = useCallback(() => exportAbortRef.current?.abort(), []);

  return {
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
  };
}

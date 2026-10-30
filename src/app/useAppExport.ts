import { useCallback, useRef, useState } from 'react';
import type { Project } from '../model/types';
import type { ExportSettings } from '../engine/exporter';
import { isMediaRecorderMp4Supported } from '../engine/exportCapabilities';
import { usePlayheadStore } from '../store/usePlayheadStore';

interface UseAppExportOptions {
  project: Project;
  selectedShotId: string;
  setIsPlaying: ReturnType<typeof usePlayheadStore.getState>['setIsPlaying'];
  setCurrentTimeMs: ReturnType<typeof usePlayheadStore.getState>['setCurrentTimeMs'];
}

export function useAppExport({ project, selectedShotId, setIsPlaying, setCurrentTimeMs }: UseAppExportOptions) {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(() => ({
    format: isMediaRecorderMp4Supported() ? 'mp4' : 'webm',
    resolution: '1080p',
    fps: 60,
    quality: 'social',
    scope: 'entire',
  }));
  const [exporting, setExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  const [exportPercent, setExportPercent] = useState(0);
  const [exportError, setExportError] = useState('');
  const exportAbortRef = useRef<AbortController | null>(null);
  const exportCloseTimerRef = useRef<number | null>(null);

  const handleOpenExportModal = useCallback(() => {
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
      if (exportSettings.format === 'png') {
        const { exportCurrentFrameAsPng } = await import('../engine/exporter');
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

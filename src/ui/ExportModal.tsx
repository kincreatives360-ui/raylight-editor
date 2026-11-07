import { IconButton, SegmentedControl, Switch } from './primitives';
import { ModalShell } from './ModalShell';
// src/ui/ExportModal.tsx
import React from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  Download,
} from 'lucide-react';
import type {
  Project,
  Shot,
} from '../model/types';
import type {
  ExportFormat,
  ExportFps,
  ExportImageDestination,
  ExportImageFormat,
  ExportQuality,
  ExportResolution,
  ExportSettings,
} from '../engine/exporter';
import {
  getExportCapabilities,
  type ExportCapabilities,
} from '../engine/export/capabilities';

export const COMPRESSION_DESCRIPTIONS: Record<ExportQuality, string> = {
  studio: 'Highest quality for final delivery and editing',
  social: 'Balanced quality and file size for social platforms',
  web: 'Optimized for fast web playback and embeds',
  'web-low': 'Smallest file size for quick previews and sharing',
};

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportSettings: ExportSettings;
  setExportSettings: React.Dispatch<React.SetStateAction<ExportSettings>>;
  exportMetrics: {
    width: number;
    height: number;
    estimatedSizeMb: number | string;
    estimatedTimeSec: number;
    hasFilmGrain?: boolean;
    bitrateFactor?: number;
  };
  project: Project;
  activeShot: Shot;
  exporting: boolean;
  exportProgressText: string;
  exportPercent: number;
  exportError: string | null;
  onStartExport: () => void;
  onCancelExport: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  exportSettings,
  setExportSettings,
  exportMetrics,
  project,
  activeShot,
  exporting,
  exportProgressText,
  exportPercent,
  exportError,
  onStartExport,
  onCancelExport,
}) => {
  const [capabilities, setCapabilities] = React.useState<ExportCapabilities | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getExportCapabilities().then((caps) => {
      if (!cancelled) setCapabilities(caps);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isGif = exportSettings.format === 'gif';
  const isImage = exportSettings.format === 'png';
  const isVideo = exportSettings.format === 'mp4' || exportSettings.format === 'webm';

  const resolutionOptions: ExportResolution[] = isGif
    ? ['480p', '720p', '1080p']
    : ['720p', '1080p', '4k'];
  const activeResolution: ExportResolution = resolutionOptions.includes(exportSettings.resolution)
    ? exportSettings.resolution
    : isGif
      ? '720p'
      : '1080p';

  const fpsOptions: ExportFps[] = isGif ? [15, 30] : [24, 30, 60];
  const activeFps: ExportFps = fpsOptions.includes(exportSettings.fps)
    ? exportSettings.fps
    : isGif
      ? 15
      : (project.fps as ExportFps);

  const formatOptions: {
    id: ExportFormat;
    label: string;
    desc: string;
    disabledReason?: string;
  }[] = [
    {
      id: 'mp4',
      label: 'MP4 Video',
      desc: 'H.264 with sound',
      disabledReason: capabilities?.mp4.available ? undefined : capabilities?.mp4.reason,
    },
    {
      id: 'webm',
      label: 'WebM Video',
      desc: 'VP9 with sound',
      disabledReason: capabilities?.webm.available ? undefined : capabilities?.webm.reason,
    },
    { id: 'gif', label: 'Animated GIF', desc: 'Silent loop' },
    { id: 'png', label: 'PNG Still', desc: 'Current frame' },
    { id: 'png-seq', label: 'PNG Sequence', desc: 'Lossless frames' },
  ];

  const handleSelectFormat = (format: ExportFormat) => {
    setExportSettings((s) => {
      if (format === 'gif') {
        return {
          ...s,
          format,
          resolution: s.resolution === '4k' ? '720p' : s.resolution,
          fps: s.fps === 30 ? 30 : 15,
        };
      }
      const nextRes = s.resolution === '480p' ? '720p' : s.resolution;
      const nextFps = s.fps === 15 ? (project.fps as ExportFps) : s.fps;
      return {
        ...s,
        format,
        resolution: nextRes,
        fps: nextFps,
      };
    });
  };

  return (
    <ModalShell
        onClose={onClose}
        backdropProps={{
            "className": "fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4",
            "aria-labelledby": "export-modal-title"
        }}
        surfaceProps={{"id": "raylight-export-modal", "className": "raylight-modal w-full max-w-md rounded-2xl bg-surface border border-subtle p-6 space-y-5 shadow-2xl text-xs"}}
    >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue/20 border border-brand-blue/40 flex items-center justify-center text-brand-blue">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="export-modal-title" className="text-sm font-bold text-foreground">
                Export Video
              </h3>
              <p className="text-xs text-muted-foreground">
                Render MP4, WebM, Looping GIF, or lossless PNG
              </p>
            </div>
          </div>
          <IconButton
              unstyled
              tooltip={false}
              label="Close"
              icon={<>
                <X className="w-4 h-4" />
              </>}
              disabled={exporting}
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-subtle text-muted-foreground hover:text-foreground cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {formatOptions.map((fmt) => {
            const selected = exportSettings.format === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                disabled={exporting || !!fmt.disabledReason}
                title={fmt.disabledReason}
                onClick={() => handleSelectFormat(fmt.id)}
                className={`p-2.5 rounded-xl border text-left transition ${selected
                  ? 'bg-brand-blue/20 border-brand-blue text-white'
                  : fmt.disabledReason
                    ? 'bg-subtle/50 border-subtle text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-subtle border-subtle text-muted-foreground hover:text-foreground cursor-pointer'
                  }`}
              >
                <div className="font-semibold text-xs">{fmt.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {fmt.disabledReason ? 'Unavailable' : fmt.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scope */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-muted-foreground block font-medium">Scope</span>
          <SegmentedControl
              unstyled
              ariaLabel="Export scope"
              value={exportSettings.scope}
              onChange={scope => setExportSettings(s => ({ ...s, scope }))}
              className="h-8 p-0.5 rounded-lg bg-app border border-subtle grid grid-cols-2 gap-0.5"
              buttonClassName={(option, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center${option.value === 'shot' ? ' truncate px-2' : ''} ${selected ? 'bg-brand-blue text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              options={[
                { value: 'entire', label: <>Entire Timeline ({project.shots.length} shots)</>, disabled: exporting || isImage },
                { value: 'shot', label: <>Selected Shot ({activeShot.name})</>, disabled: exporting || isImage },
              ]}
          />
          {isImage && (
            <p className="text-[11px] text-muted-foreground">
              Exports the frame at the playhead.
            </p>
          )}
        </div>

        {/* Resolution & Frame Rate Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Resolution</span>
            <SegmentedControl
              unstyled
              ariaLabel="Export resolution"
              value={activeResolution}
              onChange={(resolution) => setExportSettings((s) => ({ ...s, resolution }))}
              className="h-8 p-0.5 rounded-lg bg-app border border-subtle grid grid-cols-3 gap-0.5"
              buttonClassName={(_option, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${selected ? 'bg-brand-blue text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              options={resolutionOptions.map((res) => ({
                value: res,
                label: res === '4k' ? '4K' : res.toUpperCase(),
                disabled: exporting,
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Frame Rate</span>
            <SegmentedControl
              unstyled
              ariaLabel="Export frame rate"
              value={activeFps}
              onChange={(fps) => setExportSettings((s) => ({ ...s, fps }))}
              className={`h-8 p-0.5 rounded-lg bg-app border border-subtle grid ${isGif ? 'grid-cols-2' : 'grid-cols-3'} gap-0.5`}
              buttonClassName={(_option, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${selected ? 'bg-brand-blue text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              options={fpsOptions.map((f) => ({
                value: f,
                label: `${f} FPS`,
                disabled: exporting || isImage,
              }))}
            />
          </div>
        </div>

        {/* Image Still Specific Controls (PNG vs JPG, File vs Clipboard) */}
        {isImage && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground block font-medium">Image Format</span>
              <SegmentedControl
                unstyled
                ariaLabel="Still image format"
                value={(exportSettings.imageFormat ?? 'png') as ExportImageFormat}
                onChange={(imageFormat) => setExportSettings((s) => ({ ...s, imageFormat }))}
                className="h-8 p-0.5 rounded-lg bg-app border border-subtle grid grid-cols-2 gap-0.5"
                buttonClassName={(_option, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${selected ? 'bg-brand-blue text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                options={[
                  { value: 'png', label: 'PNG', disabled: exporting },
                  { value: 'jpg', label: 'JPG', disabled: exporting },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground block font-medium">Destination</span>
              <SegmentedControl
                unstyled
                ariaLabel="Still image destination"
                value={(exportSettings.imageDestination ?? 'file') as ExportImageDestination}
                onChange={(imageDestination) => setExportSettings((s) => ({ ...s, imageDestination }))}
                className="h-8 p-0.5 rounded-lg bg-app border border-subtle grid grid-cols-2 gap-0.5"
                buttonClassName={(_option, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${selected ? 'bg-brand-blue text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                options={[
                  { value: 'file', label: 'File', disabled: exporting },
                  { value: 'clipboard', label: 'Clipboard', disabled: exporting },
                ]}
              />
            </div>
          </div>
        )}

        {/* GIF Specific Controls (High Quality + Disable Loop) */}
        {isGif && (
          <div className="space-y-2 p-3 rounded-xl bg-app border border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground font-medium">
                High quality (slower export)
              </span>
              <Switch
                ariaLabel="High quality GIF export"
                checked={exportSettings.gifHighQuality !== false}
                disabled={exporting}
                onChange={(gifHighQuality) =>
                  setExportSettings((s) => ({ ...s, gifHighQuality }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground font-medium">
                Disable loop
              </span>
              <Switch
                ariaLabel="Disable GIF loop"
                checked={exportSettings.gifLoop === false}
                disabled={exporting}
                onChange={(disableLoop) =>
                  setExportSettings((s) => ({ ...s, gifLoop: !disableLoop }))
                }
              />
            </div>
            {exportMetrics.hasFilmGrain && (
              <p className="text-[11px] text-amber-400/90 pt-1">
                Film grain increases GIF file size and may cause color banding.
              </p>
            )}
          </div>
        )}

        {/* Quality & Compression */}
        {!isGif && !isImage && (
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Compression</span>
            <SegmentedControl
              unstyled
              ariaLabel="Export compression"
              value={exportSettings.quality}
              onChange={(quality) => setExportSettings((s) => ({ ...s, quality }))}
              className="h-8 p-0.5 rounded-lg bg-app border border-subtle grid grid-cols-4 gap-0.5"
              buttonClassName={(_option, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center truncate px-1 ${selected ? 'bg-brand-blue text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              options={[
                { value: 'studio', label: 'Studio', disabled: exporting || !isVideo },
                { value: 'social', label: 'Social', disabled: exporting || !isVideo },
                { value: 'web', label: 'Web', disabled: exporting || !isVideo },
                { value: 'web-low', label: 'Low', disabled: exporting || !isVideo },
              ]}
            />
            {isVideo && (
              <p className="text-[11px] text-muted-foreground">
                {COMPRESSION_DESCRIPTIONS[exportSettings.quality]}
                {exportMetrics.hasFilmGrain ? ' • Film grain bitrate boost active' : ''}
              </p>
            )}
          </div>
        )}

        <div className="p-3 rounded-xl bg-app border border-subtle font-mono tabular-nums text-[11px] space-y-1.5 text-foreground tracking-tight">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-sans">Dimensions:</span>
            <span className="font-semibold text-foreground">
              {exportMetrics.width}&times;{exportMetrics.height}px
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-sans">Estimated Size:</span>
            <span className="text-emerald-400 font-semibold">
              ~{exportMetrics.estimatedSizeMb} MB
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-sans">Estimated Time:</span>
            <span className="text-sky-400 font-semibold">
              ~{exportMetrics.estimatedTimeSec}s
            </span>
          </div>
        </div>

        {exporting && (
          <div className="space-y-2 p-3 rounded-xl bg-app border border-brand-blue/30 shadow-lg animate-fade-in">
            <div className="flex justify-between items-center text-[11px] font-mono tabular-nums tracking-tight">
              <span className="flex items-center gap-2 text-sky-400 font-medium truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue shrink-0" />
                <span className="truncate">{exportProgressText}</span>
              </span>
              <span className="font-semibold text-foreground shrink-0 ml-2">{exportPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-brand-blue via-sky-400 to-brand-blue shadow-xs transition-[width] duration-150 ease-out"
                style={{ width: `${exportPercent}%` }}
              />
            </div>
          </div>
        )}

        {!exporting && exportProgressText && (exportProgressText.includes('Complete') || exportProgressText.includes('Copied')) && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-[11px] font-medium shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {exportProgressText}
                {exportProgressText.includes('Copied') ? '' : ' Saved to Downloads.'}
              </span>
            </div>
            <span className="text-[11px] text-emerald-400/90 font-mono px-1.5 py-0.5 rounded bg-emerald-500/20">Ready</span>
          </div>
        )}

        {exportError && (
          <p role="alert" className="text-xs text-red-400">{exportError}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={exporting ? onCancelExport : onClose}
            className="px-4 py-2 rounded-lg bg-subtle hover:bg-muted text-muted-foreground cursor-pointer"
          >
            {exporting ? 'Cancel' : 'Close'}
          </button>
          <button type="button"  disabled={exporting} onClick={onStartExport} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold cursor-pointer shadow-xs">
            <Download className="w-3.5 h-3.5" />
            <span>
              {exporting
                ? 'Rendering...'
                : exportSettings.format === 'png-seq'
                  ? 'Export PNG Sequence'
                  : exportSettings.format === 'png'
                    ? exportSettings.imageDestination === 'clipboard'
                      ? 'Copy to Clipboard'
                      : `Export ${(exportSettings.imageFormat ?? 'png').toUpperCase()} Still`
                    : exportSettings.format === 'webm'
                      ? 'Export WebM'
                      : `Export ${exportSettings.format.toUpperCase()}`}
            </span>
          </button>
        </div>
      </ModalShell>
  );
};

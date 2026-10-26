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
  ExportResolution,
  ExportSettings,
} from '../engine/exporter';
import { isMediaRecorderMp4Supported } from '../engine/exportCapabilities';

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
  if (!isOpen) return null;

  return (
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
            onClick={onClose}
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
          <div className="space-y-2 p-3 rounded-xl bg-[#18181c] border border-[#0088ff]/30 shadow-lg animate-fade-in">
            <div className="flex justify-between items-center text-[11px] font-mono tabular-nums tracking-tight">
              <span className="flex items-center gap-2 text-[#38bdf8] font-medium truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0088ff] shrink-0" />
                <span className="truncate">{exportProgressText}</span>
              </span>
              <span className="font-semibold text-white shrink-0 ml-2">{exportPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#0088ff] via-[#38bdf8] to-[#0088ff] shadow-[0_0_12px_rgba(0,136,255,0.5)] transition-[width] duration-150 ease-out"
                style={{ width: `${exportPercent}%` }}
              />
            </div>
          </div>
        )}

        {!exporting && exportProgressText && exportProgressText.includes('Complete') && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-[11px] font-medium shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{exportProgressText} Saved to Downloads.</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono px-1.5 py-0.5 rounded bg-emerald-500/20">Ready</span>
          </div>
        )}

        {exportError && (
          <p role="alert" className="text-xs text-red-400">{exportError}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={exporting ? onCancelExport : onClose}
            className="px-4 py-2 rounded-lg bg-[#1c1c1f] hover:bg-[#27272c] text-[#d4d4d8] cursor-pointer"
          >
            {exporting ? 'Cancel' : 'Close'}
          </button>
          <button
            disabled={exporting}
            onClick={onStartExport}
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
  );
};

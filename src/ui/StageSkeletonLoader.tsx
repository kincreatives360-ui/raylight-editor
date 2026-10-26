// src/ui/StageSkeletonLoader.tsx
import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';

export interface StageSkeletonLoaderProps {
  delayMs?: number;
}

export const StageSkeletonLoader: React.FC<StageSkeletonLoaderProps> = ({
  delayMs = 300,
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const aspectRatio = useProjectStore((s) => s.project?.aspectRatio || '16:9');

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!shouldRender) {
    return <div className="flex-1 bg-[var(--canvas-workspace,#080a10)]" />;
  }

  // Sizing: One dimension is relative to the workspace container, and the other is derived via aspectRatio.
  const isPortrait = aspectRatio === '9:16';
  const ratioString =
    aspectRatio === '9:16'
      ? '9 / 16'
      : aspectRatio === '1:1'
      ? '1 / 1'
      : aspectRatio === '4:3'
      ? '4 / 3'
      : aspectRatio === '21:9'
      ? '21 / 9'
      : '16 / 9';

  const aspectStyle: React.CSSProperties = isPortrait
    ? {
        height: '75%',
        maxHeight: '75%',
        maxWidth: '85%',
        aspectRatio: ratioString,
      }
    : {
        width: '75%',
        maxWidth: '85%',
        maxHeight: '75%',
        aspectRatio: ratioString,
      };

  return (
    <div
      role="progressbar"
      aria-label="Loading Stage Viewport"
      className="flex-1 w-full h-full bg-[var(--canvas-workspace,#080a10)] flex flex-col items-center justify-center relative overflow-hidden select-none"
    >
      {/* Top stage toolbar skeleton */}
      <div className="absolute top-4 z-10 w-48 h-8 rounded-full bg-[#18181f]/80 border border-white/[0.06] animate-pulse" />

      {/* Stage Artboard Skeleton */}
      <div
        style={aspectStyle}
        className="rounded-lg border border-white/[0.08] bg-[#121217]/60 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center animate-pulse"
      >
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-3" />
        <div className="w-32 h-2.5 rounded bg-white/[0.05] mb-1.5" />
        <div className="w-20 h-2 rounded bg-white/[0.03]" />
      </div>

      {/* Bottom status skeleton */}
      <div className="absolute bottom-4 z-10 w-64 h-6 rounded-md bg-[#18181f]/60 border border-white/[0.04] animate-pulse" />
    </div>
  );
};

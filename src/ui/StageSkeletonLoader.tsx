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
    return <div data-slot="skeleton" className="flex-1 bg-[var(--canvas-workspace,#080a10)]" />;
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
      data-slot="skeleton"
      aria-label="Loading Stage Viewport"
      className="flex-1 w-full h-full bg-[var(--canvas-workspace,#080a10)] flex flex-col items-center justify-center relative overflow-hidden select-none"
    >
      {/* Stage Artboard Skeleton */}
      <div
        data-slot="skeleton"
        style={aspectStyle}
        className="rounded-lg border border-border/40 bg-[var(--skeleton-base)]/60 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center animate-pulse motion-reduce:animate-none"
      >
        <div className="w-16 h-16 rounded-2xl bg-[var(--skeleton-pulse)]/20 border border-border/40 mb-3" />
        <div className="w-32 h-2.5 rounded bg-[var(--skeleton-pulse)]/25 mb-1.5" />
        <div className="w-20 h-2 rounded bg-[var(--skeleton-pulse)]/15" />
      </div>

      {/* Floating bottom toolbar skeleton */}
      <div data-slot="skeleton" className="absolute bottom-3 z-10 w-96 h-10 rounded-xl bg-popover/80 border border-border/40 animate-pulse motion-reduce:animate-none" />
    </div>
  );
};

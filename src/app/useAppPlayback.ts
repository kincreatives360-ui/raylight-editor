import { useEffect } from 'react';
import type { Project } from '../model/types';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { stopAudioPlayback, syncAudioPlayback } from '../engine/audioEngine';

interface UseAppPlaybackOptions {
  project: Project;
  isPlaying: boolean;
  hoverTimeMs: number | null;
  loop: boolean;
  totalDurationMs: number;
  setCurrentTimeMs: ReturnType<typeof usePlayheadStore.getState>['setCurrentTimeMs'];
  setIsPlaying: ReturnType<typeof usePlayheadStore.getState>['setIsPlaying'];
}

export function useAppPlayback({
  project,
  isPlaying,
  hoverTimeMs,
  loop,
  totalDurationMs,
  setCurrentTimeMs,
  setIsPlaying,
}: UseAppPlaybackOptions): void {
  useEffect(() => {
    syncAudioPlayback(
      project.audio,
      isPlaying && hoverTimeMs === null,
      usePlayheadStore.getState().currentTimeMs
    );
  }, [project.audio, isPlaying, hoverTimeMs]);

  useEffect(() => {
    let lastSyncPlayhead = usePlayheadStore.getState().currentTimeMs;
    let lastSyncWallTime = performance.now();

    const unsubscribe = usePlayheadStore.subscribe((state) => {
      if (!state.isPlaying || state.hoverTimeMs !== null) {
        lastSyncPlayhead = state.currentTimeMs;
        lastSyncWallTime = performance.now();
        return;
      }

      const elapsed = performance.now() - lastSyncWallTime;
      const expectedTime = lastSyncPlayhead + elapsed;
      const drift = Math.abs(state.currentTimeMs - expectedTime);
      if (drift > 45) {
        lastSyncPlayhead = state.currentTimeMs;
        lastSyncWallTime = performance.now();
      }
      syncAudioPlayback(project.audio, true, state.currentTimeMs);
    });
    return unsubscribe;
  }, [project.audio]);

  useEffect(() => () => stopAudioPlayback(), []);

  useEffect(() => {
    if (!isPlaying) return;
    if (totalDurationMs <= 0) {
      setIsPlaying(false);
      return;
    }

    let animationFrameId: number;
    let lastTime = performance.now();
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = now - lastTime;
      lastTime = now;

      let reachedEnd = false;
      setCurrentTimeMs((previous) => {
        const next = previous + elapsed;
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

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, loop, totalDurationMs, setCurrentTimeMs, setIsPlaying]);
}

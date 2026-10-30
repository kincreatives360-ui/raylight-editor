import type { ChangeEvent } from 'react';
import { createDefaultShot } from '../model/defaults';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useProjectStore } from '../store/useProjectStore';

type UpdateProject = ReturnType<typeof useProjectStore.getState>['updateProject'];

export function handleAppAudioUpload(
  event: ChangeEvent<HTMLInputElement>,
  updateProject: UpdateProject,
  setAudioLabel: (label: string) => void
): void {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';

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
        name: file.name,
        dataUrl,
        startMs: currentPlayheadMs,
        durationMs: clipDuration,
        offsetMs: 0,
        volume: 1,
        muted: false,
      };
      updateProject((project) => {
        const currentTotal = project.shots.reduce((max, shot) => Math.max(max, shot.startMs + shot.durationMs), 0);
        let nextShots = project.shots;
        if (clipEnd > currentTotal) {
          if (nextShots.length === 0) {
            nextShots = [createDefaultShot({ durationMs: clipEnd })];
          } else {
            const lastIndex = nextShots.length - 1;
            nextShots = nextShots.map((shot, index) =>
              index === lastIndex ? { ...shot, durationMs: clipEnd - shot.startMs } : shot
            );
          }
        }
        return {
          ...project,
          shots: nextShots,
          audio: {
            clips: [...(project.audio?.clips || []), clip],
            muted: project.audio?.muted || false,
            masterVolume: project.audio?.masterVolume ?? 1,
          },
        };
      });
      setAudioLabel(file.name);
    };
    audio.addEventListener('loadedmetadata', () => addClip(audio.duration * 1000), { once: true });
    audio.addEventListener('error', () => addClip(10000), { once: true });
  };
  reader.readAsDataURL(file);
}

// src/engine/audioEngine.ts
import type { AudioClip, ProjectAudio } from '../model/types';

// Audio Context Singleton
let audioCtx: AudioContext | null = null;
const audioBufferCache = new Map<string, AudioBuffer>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Active Playback State
interface ActivePlaybackSource {
  stop: () => void;
}

let activeSources: ActivePlaybackSource[] = [];
let masterGainNode: GainNode | null = null;
let lastSyncedTimeMs = -1;
let isCurrentlyPlaying = false;

/**
 * Procedurally generates realistic waveform peak amplitudes for rendering SVG waveform bars.
 * If audio buffer data exists for the clip, extracts true RMS peaks.
 */
export function generateWaveformPeaks(clip: AudioClip, count: number): number[] {
  const barsCount = Math.max(16, count);
  const cachedBuffer = clip.dataUrl ? audioBufferCache.get(clip.dataUrl) : null;

  if (cachedBuffer) {
    const pcm = cachedBuffer.getChannelData(0);
    const totalSamples = pcm.length;
    const clipStartSample = Math.floor((clip.offsetMs / 1000) * cachedBuffer.sampleRate);
    const clipDurationSamples = Math.floor((clip.durationMs / 1000) * cachedBuffer.sampleRate);
    const step = Math.max(1, Math.floor(clipDurationSamples / barsCount));

    const peaks: number[] = [];
    for (let i = 0; i < barsCount; i++) {
      const start = clipStartSample + i * step;
      if (start >= totalSamples) {
        peaks.push(0.1);
        continue;
      }
      let maxVal = 0;
      const end = Math.min(totalSamples, start + step);
      for (let j = start; j < end; j += Math.max(1, Math.floor(step / 32))) {
        const abs = Math.abs(pcm[j]);
        if (abs > maxVal) maxVal = abs;
      }
      peaks.push(Math.max(0.08, Math.min(1.0, maxVal * 1.4)));
    }
    return peaks;
  }

  // Procedural musical waveform for default/preset clips (seed based on clip.id & clip.name)
  let seed = 0;
  const str = clip.id + clip.name;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) & 0xffffff;
  }

  const peaks: number[] = [];
  const beatPattern = [0.95, 0.35, 0.75, 0.45, 0.9, 0.38, 0.8, 0.42]; // Kick/Snare rhythm
  for (let i = 0; i < barsCount; i++) {
    const beatIndex = i % beatPattern.length;
    const baseAmp = beatPattern[beatIndex];
    const pseudoRand = Math.sin(seed + i * 0.4) * 0.22 + Math.cos(i * 0.17) * 0.15;
    const peak = Math.max(0.12, Math.min(0.98, baseAmp + pseudoRand));
    peaks.push(peak);
  }
  return peaks;
}

/**
 * Loads and decodes an audio file into an AudioBuffer
 */
export async function decodeAudioFromDataUrl(dataUrl: string): Promise<AudioBuffer | null> {
  if (audioBufferCache.has(dataUrl)) {
    return audioBufferCache.get(dataUrl)!;
  }
  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferCache.set(dataUrl, audioBuffer);
    return audioBuffer;
  } catch (err) {
    console.warn('Failed to decode audio file data URL', err);
    return null;
  }
}

/**
 * Synchronizes audio playback with current timeline time and play state
 */
export function syncAudioPlayback(
  audio: ProjectAudio | undefined,
  isPlaying: boolean,
  currentTimeMs: number
): void {
  if (!audio || audio.clips.length === 0 || audio.muted || audio.masterVolume <= 0) {
    stopAudioPlayback();
    isCurrentlyPlaying = isPlaying;
    lastSyncedTimeMs = currentTimeMs;
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  // Check if play state changed or playhead jumped significantly (> 180ms)
  const playStateChanged = isCurrentlyPlaying !== isPlaying;
  const playheadJumped = Math.abs(currentTimeMs - lastSyncedTimeMs) > 180;

  if (!isPlaying) {
    if (isCurrentlyPlaying) {
      stopAudioPlayback();
    }
    isCurrentlyPlaying = false;
    lastSyncedTimeMs = currentTimeMs;
    return;
  }

  if (!playStateChanged && !playheadJumped) {
    lastSyncedTimeMs = currentTimeMs;
    return;
  }

  // Stop current active sources before rescheduling
  stopAudioPlayback();
  isCurrentlyPlaying = true;
  lastSyncedTimeMs = currentTimeMs;

  // Set up Master Gain
  if (!masterGainNode) {
    masterGainNode = ctx.createGain();
    masterGainNode.connect(ctx.destination);
  }
  masterGainNode.gain.setValueAtTime(audio.muted ? 0 : audio.masterVolume, ctx.currentTime);

  // Schedule each eligible clip
  for (const clip of audio.clips) {
    if (clip.muted || clip.volume <= 0) continue;

    const clipStart = clip.startMs;
    const clipEnd = clip.startMs + clip.durationMs;

    // Clip is active if playhead is within clip or ahead of clip start
    if (currentTimeMs >= clipStart && currentTimeMs < clipEnd) {
      const clipOffsetSec = (clip.offsetMs + (currentTimeMs - clipStart)) / 1000;
      const remainingDurationSec = (clipEnd - currentTimeMs) / 1000;

      if (clip.dataUrl) {
        if (!audioBufferCache.has(clip.dataUrl)) {
          // Preload into cache so it will be ready to play on upcoming playback ticks
          void decodeAudioFromDataUrl(clip.dataUrl);
        } else {
          // Play decoded user audio
          const buffer = audioBufferCache.get(clip.dataUrl)!;
          if (clipOffsetSec < buffer.duration) {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = clip.volume;
            source.connect(gain);
            gain.connect(masterGainNode);

            source.start(ctx.currentTime, clipOffsetSec, remainingDurationSec);
            activeSources.push({
              stop: () => {
                try {
                  source.stop();
                  source.disconnect();
                  gain.disconnect();
                } catch {
                  // Source might already be stopped or disconnected
                }
              },
            });
          }
        }
      }
    }
  }
}

/**
 * Stops all active audio playback voices
 */
export function stopAudioPlayback(): void {
  for (const src of activeSources) {
    try {
      src.stop();
    } catch {
      // Source might already have finished playing
    }
  }
  activeSources = [];
}

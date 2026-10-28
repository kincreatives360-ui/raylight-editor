// src/engine/audioEngine.ts
import type { AudioClip, ProjectAudio } from '../model/types';

// Audio Context Singleton
let audioCtx: AudioContext | null = null;
let lastAudioContextClass: unknown = null;
const audioBufferCache = new Map<string, AudioBuffer>();
const inFlightDecodes = new Set<string>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!audioCtx || (AudioContextClass && AudioContextClass !== lastAudioContextClass)) {
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      lastAudioContextClass = AudioContextClass;
      masterGainNode = null;
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
let lastAudioStateKey = '';

// Waveform Peak Amplitudes LRU Cache
const waveformPeakCache = new Map<string, number[]>();
const MAX_WAVEFORM_CACHE_ENTRIES = 512;

// Compact identity mapping for data URLs to avoid embedding massive base64 strings into cache keys
const urlIdMap = new Map<string, number>();
let nextUrlId = 1;

function getUrlCompactId(url: string | undefined): string {
  if (!url) return '';
  let id = urlIdMap.get(url);
  if (!id) {
    id = nextUrlId++;
    urlIdMap.set(url, id);
  }
  return `u${id}`;
}

export function clearWaveformCache(): void {
  waveformPeakCache.clear();
  urlIdMap.clear();
  nextUrlId = 1;
}

/**
 * Procedurally generates realistic waveform peak amplitudes for rendering SVG waveform bars.
 * If audio buffer data exists for the clip, extracts true RMS peaks.
 * Caches calculated peak arrays by clip properties and bar count to eliminate repeated PCM scans.
 */
export function generateWaveformPeaks(clip: AudioClip, count: number): number[] {
  const barsCount = Math.max(16, count);
  const cachedBuffer = clip.dataUrl ? audioBufferCache.get(clip.dataUrl) : null;
  const hasBuffer = Boolean(cachedBuffer);
  const urlId = getUrlCompactId(clip.dataUrl);
  const cacheKey = `${clip.id}:${clip.name}:${clip.offsetMs}:${clip.durationMs}:${urlId}:${hasBuffer ? 'buf' : 'proc'}:${barsCount}`;

  const cachedPeaks = waveformPeakCache.get(cacheKey);
  if (cachedPeaks) {
    return cachedPeaks;
  }

  let peaks: number[];

  if (cachedBuffer) {
    const pcm = cachedBuffer.getChannelData(0);
    const totalSamples = pcm.length;
    const clipStartSample = Math.floor((clip.offsetMs / 1000) * cachedBuffer.sampleRate);
    const clipDurationSamples = Math.floor((clip.durationMs / 1000) * cachedBuffer.sampleRate);
    const step = Math.max(1, Math.floor(clipDurationSamples / barsCount));

    peaks = [];
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
  } else {
    // Procedural musical waveform for default/preset clips (seed based on clip.id & clip.name)
    let seed = 0;
    const str = clip.id + clip.name;
    for (let i = 0; i < str.length; i++) {
      seed = (seed * 31 + str.charCodeAt(i)) & 0xffffff;
    }

    peaks = [];
    const beatPattern = [0.95, 0.35, 0.75, 0.45, 0.9, 0.38, 0.8, 0.42]; // Kick/Snare rhythm
    for (let i = 0; i < barsCount; i++) {
      const beatIndex = i % beatPattern.length;
      const baseAmp = beatPattern[beatIndex];
      const pseudoRand = Math.sin(seed + i * 0.4) * 0.22 + Math.cos(i * 0.17) * 0.15;
      const peak = Math.max(0.12, Math.min(0.98, baseAmp + pseudoRand));
      peaks.push(peak);
    }
  }

  if (waveformPeakCache.size >= MAX_WAVEFORM_CACHE_ENTRIES) {
    const oldestKey = waveformPeakCache.keys().next().value;
    if (oldestKey) waveformPeakCache.delete(oldestKey);
  }
  waveformPeakCache.set(cacheKey, peaks);

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
    if (!response.ok) {
      throw new Error(`Failed to fetch audio (${response.status} ${response.statusText})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferCache.set(dataUrl, audioBuffer);
    // Invalidate any procedural peak entries for this dataUrl so the newly decoded buffer is used
    const compactId = urlIdMap.get(dataUrl);
    if (compactId) {
      const matchPattern = `:u${compactId}:proc:`;
      for (const key of Array.from(waveformPeakCache.keys())) {
        if (key.includes(matchPattern)) {
          waveformPeakCache.delete(key);
        }
      }
    }
    return audioBuffer;
  } catch (err) {
    console.warn('Failed to decode audio file data URL', err);
    return null;
  }
}

function computeAudioStateKey(audio: ProjectAudio): string {
  const clipsKey = audio.clips
    .map((c) => {
      const ready = c.dataUrl && audioBufferCache.has(c.dataUrl) ? '1' : '0';
      return `${c.id}:${c.startMs}:${c.durationMs}:${c.offsetMs}:${c.volume}:${c.muted ? 1 : 0}:${getUrlCompactId(c.dataUrl)}:${ready}`;
    })
    .join('|');
  return `${audio.muted ? 1 : 0}:${audio.masterVolume}:${clipsKey}`;
}

/**
 * Synchronizes audio playback with current timeline time and play state.
 * Schedules both currently overlapping clips and future lookahead clips via Web Audio timestamps.
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
    lastAudioStateKey = '';
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const audioStateKey = computeAudioStateKey(audio);
  const audioStateChanged = audioStateKey !== lastAudioStateKey;
  const playStateChanged = isCurrentlyPlaying !== isPlaying;
  // Detect timeline seeks, loops (currentTimeMs < lastSyncedTimeMs), or jumps (> 180ms)
  const playheadJumped =
    lastSyncedTimeMs < 0 ||
    currentTimeMs < lastSyncedTimeMs - 5 ||
    Math.abs(currentTimeMs - lastSyncedTimeMs) > 180;

  if (!isPlaying) {
    if (isCurrentlyPlaying) {
      stopAudioPlayback();
    }
    isCurrentlyPlaying = false;
    lastSyncedTimeMs = currentTimeMs;
    lastAudioStateKey = audioStateKey;
    return;
  }

  if (!playStateChanged && !playheadJumped && !audioStateChanged) {
    lastSyncedTimeMs = currentTimeMs;
    return;
  }

  // Stop current active sources before rescheduling
  stopAudioPlayback();
  isCurrentlyPlaying = true;
  lastSyncedTimeMs = currentTimeMs;
  lastAudioStateKey = audioStateKey;

  // Set up Master Gain
  if (!masterGainNode) {
    masterGainNode = ctx.createGain();
    masterGainNode.connect(ctx.destination);
  }
  const nowSec = ctx.currentTime ?? 0;
  if (typeof masterGainNode.gain.setValueAtTime === 'function') {
    masterGainNode.gain.setValueAtTime(audio.muted ? 0 : audio.masterVolume, nowSec);
  } else {
    masterGainNode.gain.value = audio.muted ? 0 : audio.masterVolume;
  }

  // Schedule each eligible clip (active now OR starting in the future)
  for (const clip of audio.clips) {
    if (clip.muted || clip.volume <= 0 || clip.durationMs <= 0) continue;

    const clipStart = clip.startMs;
    const clipEnd = clip.startMs + clip.durationMs;

    // Skip clips that have already finished before the current playhead
    if (clipEnd <= currentTimeMs) continue;

    if (!clip.dataUrl) continue;

    if (!audioBufferCache.has(clip.dataUrl)) {
      // Preload into cache so it will be ready to schedule as soon as decoding completes
      if (!inFlightDecodes.has(clip.dataUrl)) {
        inFlightDecodes.add(clip.dataUrl);
        void decodeAudioFromDataUrl(clip.dataUrl).finally(() => {
          inFlightDecodes.delete(clip.dataUrl!);
          lastSyncedTimeMs = -1;
        });
      }
      continue;
    }

    const buffer = audioBufferCache.get(clip.dataUrl)!;
    const isFutureClip = clipStart > currentTimeMs;
    const startWhenSec = isFutureClip
      ? nowSec + (clipStart - currentTimeMs) / 1000
      : nowSec;
    const clipOffsetSec = isFutureClip
      ? Math.max(0, clip.offsetMs / 1000)
      : Math.max(0, (clip.offsetMs + (currentTimeMs - clipStart)) / 1000);
    const requestedDurationSec = isFutureClip
      ? clip.durationMs / 1000
      : (clipEnd - currentTimeMs) / 1000;

    if (clipOffsetSec < buffer.duration && requestedDurationSec > 0) {
      const playDurationSec = Math.min(requestedDurationSec, buffer.duration - clipOffsetSec);
      if (playDurationSec <= 0) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = clip.volume;
      source.connect(gain);
      gain.connect(masterGainNode);

      source.start(startWhenSec, clipOffsetSec, playDurationSec);
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

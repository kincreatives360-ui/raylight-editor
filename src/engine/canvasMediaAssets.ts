import type { ImageLayer, Project, VideoLayer } from '../model/types';
import { evaluateProjectAtTime, type EvaluatedProjectFrame } from './evaluateShot';

const MAX_IMAGE_CACHE_SIZE = 100;
const imageElementCache = new Map<string, HTMLImageElement>();
const MAX_VIDEO_CACHE_SIZE = 20;
const videoElementCache = new Map<string, HTMLVideoElement>();

export function getOrCreateVideoElement(
  dataUrl: string,
  instanceKey?: string
): HTMLVideoElement {
  const cacheKey = instanceKey ? `${dataUrl}::${instanceKey}` : dataUrl;
  let video = videoElementCache.get(cacheKey);
  if (video) {
    videoElementCache.delete(cacheKey);
    videoElementCache.set(cacheKey, video);
    return video;
  }
  if (videoElementCache.size >= MAX_VIDEO_CACHE_SIZE) {
    const oldestKey = videoElementCache.keys().next().value;
    if (oldestKey) {
      const oldVid = videoElementCache.get(oldestKey);
      if (oldVid) {
        oldVid.pause();
        oldVid.removeAttribute('src');
        oldVid.load();
      }
      videoElementCache.delete(oldestKey);
    }
  }
  video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = dataUrl;
  video.load();
  videoElementCache.set(cacheKey, video);
  if (instanceKey && !videoElementCache.has(dataUrl)) {
    videoElementCache.set(dataUrl, video);
  }
  return video;
}

export function getOrCreateImageElement(dataUrl: string): HTMLImageElement | undefined {
  const img = imageElementCache.get(dataUrl);
  if (img) {
    imageElementCache.delete(dataUrl);
    imageElementCache.set(dataUrl, img);
    return img;
  }
  return undefined;
}

export function clearImageElementCache(): void {
  imageElementCache.clear();
}

export function clearVideoElementCache(): void {
  for (const video of videoElementCache.values()) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  videoElementCache.clear();
}

/**
 * Deterministically seeks a video element to a target timestamp.
 * Awaits decoded frame presentation via requestVideoFrameCallback when available,
 * with bounded timeout and thorough listener cleanup.
 */
export function seekVideoElement(
  video: HTMLVideoElement,
  targetSec: number,
  timeoutMs = 600
): Promise<void> {
  const tolerance = 0.05;

  if (Math.abs(video.currentTime - targetSec) <= tolerance && video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let rvfcHandle: number | null = null;
    let isSettled = false;

    const cleanup = () => {
      isSettled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (rvfcHandle !== null && 'cancelVideoFrameCallback' in video) {
        (video as unknown as { cancelVideoFrameCallback: (h: number) => void }).cancelVideoFrameCallback(rvfcHandle);
        rvfcHandle = null;
      }
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onFinish = () => {
      if (isSettled) return;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (isSettled) return;
      cleanup();
      reject(new Error(`Failed to decode video frame at ${targetSec}s.`));
    };

    const onSeeked = () => {
      if (isSettled) return;
      if (typeof (video as unknown as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function') {
        rvfcHandle = (video as unknown as { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(() => {
          onFinish();
        });
      } else {
        onFinish();
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    timer = setTimeout(() => {
      if (isSettled) return;
      cleanup();
      if ((video as { error?: MediaError | null }).error) {
        reject(new Error(`Video decode error while seeking to ${targetSec}s.`));
        return;
      }
      if (Math.abs(video.currentTime - targetSec) > tolerance) {
        try {
          video.currentTime = targetSec;
        } catch {
          // Ignore synchronous reassignment failure on timeout fallback
        }
        console.warn(`[Raylight] Video seek to ${targetSec}s timed out (current: ${video.currentTime}s)`);
      }
      resolve(); // Documented fallback to avoid indefinitely stalling export pipeline
    }, timeoutMs);

    try {
      video.currentTime = targetSec;
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

export async function syncAndSeekAllProjectVideos(
  project: Project,
  timeMs: number
): Promise<void> {
  const seekPromises: Promise<void>[] = [];
  const frame = evaluateProjectAtTime(project, timeMs);

  const seekShotFrameVideos = (evalFrame: EvaluatedProjectFrame) => {
    for (const evalLayer of evalFrame.layers || []) {
      const layer = evalLayer.layer;
      if (layer.kind === 'video' || layer.kind === 'image') {
        const asset = project.assets[(layer as ImageLayer | VideoLayer).assetId];
        if (asset?.dataUrl && (layer.kind === 'video' || asset.mimeType?.startsWith('video/'))) {
          const video = getOrCreateVideoElement(asset.dataUrl, layer.id);
          const targetSec = Math.max(0, (evalFrame.shotLocalTimeMs - layer.inMs) / 1000);
          if (Number.isFinite(targetSec)) {
            seekPromises.push(seekVideoElement(video, targetSec));
          }
        }
      }
    }
  };

  seekShotFrameVideos(frame);
  if (frame.shotTransition.isTransitioning && frame.shotTransition.outgoingFrame) {
    seekShotFrameVideos(frame.shotTransition.outgoingFrame);
  }

  await Promise.all(seekPromises);
}

export interface ImagePreloadSummary {
  loaded: number;
  failed: number;
  failedUrls: string[];
}

export async function preloadProjectImages(project: Project): Promise<ImagePreloadSummary> {
  const urls = new Set<string>();
  for (const a of Object.values(project.assets || {})) {
    if (a?.dataUrl) urls.add(a.dataUrl);
  }
  if (project.background?.kind === 'image') {
    if (project.background.src) urls.add(project.background.src);
    if (project.background.assetId) {
      const bgAsset = project.assets?.[project.background.assetId];
      if (bgAsset?.dataUrl) urls.add(bgAsset.dataUrl);
    }
  }
  if (project.shots) {
    for (const shot of project.shots) {
      if (shot.background?.kind === 'image') {
        if (shot.background.src) urls.add(shot.background.src);
        if (shot.background.assetId) {
          const shotBgAsset = project.assets?.[shot.background.assetId];
          if (shotBgAsset?.dataUrl) urls.add(shotBgAsset.dataUrl);
        }
      }
    }
  }

  const failedUrls: string[] = [];
  let loadedCount = 0;

  await Promise.all(
    Array.from(urls).map(
      (url) =>
        new Promise<void>((resolve) => {
          if (getOrCreateImageElement(url)) {
            loadedCount++;
            resolve();
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (imageElementCache.size >= MAX_IMAGE_CACHE_SIZE) {
              const oldestKey = imageElementCache.keys().next().value;
              if (oldestKey) imageElementCache.delete(oldestKey);
            }
            imageElementCache.set(url, img);
            loadedCount++;
            resolve();
          };
          img.onerror = () => {
            failedUrls.push(url);
            console.warn('[Raylight Image Preload] Could not load image asset:', url.slice(0, 80));
            resolve();
          };
          img.src = url;
        })
    )
  );

  return {
    loaded: loadedCount,
    failed: failedUrls.length,
    failedUrls,
  };
}


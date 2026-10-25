import React from 'react';
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ViewportCanvas } from '../../src/stage/webgl/ViewportCanvas';
import { createDefaultProject, createDefaultShapeLayer, createDefaultImageLayer } from '../../src/model/defaults';
import { DEFAULT_DEVICE_FRAME_SETTINGS } from '../../src/model/deviceFrame';
import { evaluateProjectAtTime } from '../../src/engine/evaluateShot';
import { preloadProjectImages, renderProjectFrameToCanvas } from '../../src/engine/canvasRenderer';
import { runVideoExportPipeline } from '../../src/engine/exporter';
import { usePlayheadStore } from '../../src/store/usePlayheadStore';
import type { Project } from '../../src/model/types';

const root = createRoot(document.getElementById('stage')!);
const output: Record<string, unknown> = { environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio, viewport: [640, 360], recordedAt: new Date().toISOString() } };
const status = document.getElementById('status')!;
const reference = document.getElementById('reference') as HTMLCanvasElement;

const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
async function frames(count = 5) { for (let i = 0; i < count; i++) await frame(); }
function publish() { document.getElementById('results')!.textContent = JSON.stringify(output, null, 2); }
const emptyTransition = { type: 'none' as const, durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset' as const, name: 'linear' as const } };
function fixture(name: string, layers = false): Project {
  const p = createDefaultProject({ name, fps: 30, background: { kind: 'solid', color: '#808080' } });
  p.shots[0].durationMs = 1000;
  p.shots[0].transition.type = 'cut';
  p.shots[0].light = { ...p.shots[0].light, ambience: 0, keyLightEnabled: false, sources: [] };
  p.shots[0].layers = layers ? [createDefaultShapeLayer({ name: 'Moving cyan rectangle', receivesLight: false, position: { x: -0.25, y: 0, z: 0 }, size: { width: 0.2, height: 0.3 }, fill: { kind: 'solid', color: '#00bfff', opacity: 1 }, stroke: undefined, effects: {}, entrance: emptyTransition, exit: emptyTransition, blocks: [{ id: 'move', label: 'Audit movement', property: 'position', startMs: 0, durationMs: 1000, amount: { x: 0.5, y: 0, z: 0 }, easing: { kind: 'preset', name: 'linear' } }] })] : [];
  return p;
}
async function show(p: Project, t = 500, settleFrames = 5) {

  const evaluated = evaluateProjectAtTime(p, t);
  flushSync(() => root.render(<ViewportCanvas project={p} frame={evaluated} canvasZoom={1} frameWidth={640} frameHeight={360} selectedLayerIds={[]} onSelectLayer={() => {}} />));
  await frames(settleFrames);
  const canvas = document.querySelector('#stage canvas') as HTMLCanvasElement;
  if (!canvas?.width) throw new Error('WebGL canvas did not initialize');
  return canvas;
}
function pixels(canvas: HTMLCanvasElement) {
  const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(canvas, 0, 0);
  return { canvas: copy, image: ctx.getImageData(0, 0, copy.width, copy.height) };
}
function compare(a: ImageData, b: ImageData) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Pixel dimensions differ');
  let sum = 0, max = 0, changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let different = false;
    for (let c = 0; c < 3; c++) { const d = Math.abs(a.data[i + c] - b.data[i + c]); sum += d; max = Math.max(max, d); different ||= d > 1; }
    if (different) changed++;
  }
  const mid = (Math.floor(a.height / 2) * a.width + Math.floor(a.width / 2)) * 4;
  return { rgbMeanAbsoluteError: sum / (a.width * a.height * 3), maximumChannelError: max, changedPixelPercent: changed / (a.width * a.height) * 100, centerA: Array.from(a.data.slice(mid, mid + 4)), centerB: Array.from(b.data.slice(mid, mid + 4)) };
}
function artifact(name: string, href: string) {
  const link = document.createElement('a'); link.download = name; link.href = href; link.textContent = name; document.getElementById('downloads')!.append(link); return link;
}
async function canvasReference(p: Project, canvas: HTMLCanvasElement, t = 500) {
  reference.width = canvas.width; reference.height = canvas.height;
  await preloadProjectImages(p);
  await renderProjectFrameToCanvas(reference.getContext('2d')!, p, evaluateProjectAtTime(p, t), canvas.width, canvas.height);
  return pixels(reference).image;
}
async function runPixels() {
  const results: Record<string, unknown> = {};
  const neutral = fixture('Neutral gray');
  let canvas = await show(neutral); let capture = pixels(canvas);
  const gl = canvas.getContext('webgl2')!;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  output.gpu = { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), size: [canvas.width, canvas.height] };
  results.neutralGpuVsCanvas = compare(capture.image, await canvasReference(neutral, canvas));
  artifact('neutral-gpu.png', capture.canvas.toDataURL()); artifact('neutral-canvas.png', reference.toDataURL());
  const graded = structuredClone(neutral); graded.shots[0].effects.colorGrade = { enabled: true, exposure: 2, contrast: 1, saturation: 1 };
  canvas = await show(graded); results.gradedGpuVsCanvas = compare(pixels(canvas).image, await canvasReference(graded, canvas));
  artifact('graded-gpu.png', pixels(canvas).canvas.toDataURL()); artifact('graded-canvas.png', reference.toDataURL());
  const base = fixture('Layer effects', true); base.shots[0].layers[0].blocks = [];
  canvas = await show(base); const basePixels = pixels(canvas).image;
  results.layerBaselineVsEmpty = compare(basePixels, capture.image);
  artifact('layer-baseline-gpu.png', pixels(canvas).canvas.toDataURL());
  const shadow = structuredClone(base); shadow.shots[0].layers[0].effects.dropShadow = { enabled: true, color: '#000000', opacity: 1, blur: 0.03, offsetX: 0.08, offsetY: 0.08 };
  canvas = await show(shadow); results.layerShadowGpuOnVsOff = compare(basePixels, pixels(canvas).image);
  const baseRef = await canvasReference(base, canvas); const shadowRef = await canvasReference(shadow, canvas);
  results.layerShadowCanvasOnVsOff = compare(baseRef, shadowRef);
  const glow = structuredClone(base); glow.shots[0].layers[0].effects.glow = { enabled: true, color: '#ff0000', intensity: 1, radius: 0.08 };
  canvas = await show(glow); results.layerGlowGpuOnVsOff = compare(basePixels, pixels(canvas).image);
  const warp = structuredClone(base); warp.shots[0].layers[0].effects.warp = { enabled: true, amount: 30, frequency: 3 };
  canvas = await show(warp); results.layerWarpGpuOnVsOff = compare(basePixels, pixels(canvas).image);
  const vignette = structuredClone(neutral); vignette.shots[0].effects.vignette = { enabled: true, intensity: 0.8 };
  canvas = await show(vignette); results.vignetteGpuVsCanvas = compare(pixels(canvas).image, await canvasReference(vignette, canvas));
  const grain = structuredClone(neutral); grain.shots[0].effects.filmGrain = { enabled: true, intensity: 0.8, size: 2 };
  canvas = await show(grain); const first = pixels(canvas).image;
  usePlayheadStore.getState().setIsPlaying(true); await frames(12); usePlayheadStore.getState().setIsPlaying(false); await frames(2);
  results.grainSameTimelineFrameAfterRendering = compare(first, pixels(canvas).image);
  output.pixels = results;
}
interface CapturedDownload { filename: string; blob: Blob; fetchError?: string; }
const captured: CapturedDownload[] = [];

function captureAnchorDownload(anchor: HTMLAnchorElement) {
  if (anchor?.tagName === 'A' && anchor.href.startsWith('blob:') && anchor.download && !anchor.dataset.audit) {
    const filename = anchor.download;
    fetch(anchor.href)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => captured.push({ filename, blob }))
      .catch(err => {
        captured.push({
          filename,
          blob: new Blob(),
          fetchError: err instanceof Error ? err.message : String(err),
        });
      });
  }
}

document.addEventListener('click', event => {
  const anchor = event.target as HTMLAnchorElement;
  if (anchor?.isConnected) {
    captureAnchorDownload(anchor);
  }
}, true);

const originalAnchorClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  if (!this.isConnected) {
    captureAnchorDownload(this);
  }
  return originalAnchorClick.apply(this);
};
async function decodeVideo(blob: Blob, filename: string) {
  const bounded = <T,>(promise: Promise<T>) => Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Video operation timed out after 20 seconds')), 20000))]);
  const dataUrl = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
  const link = artifact(filename, dataUrl); link.dataset.audit = 'true';
  const video = document.createElement('video'); video.controls = true; video.muted = true; video.playsInline = true;
  const url = URL.createObjectURL(blob); video.src = url; document.getElementById('players')!.append(video);
  await bounded(new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error(video.error?.message || 'Metadata failed')); }));
  const samples: unknown[] = [];
  const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
  for (const t of [0.05, 0.45, 0.85]) {
    await bounded(new Promise<void>((resolve, reject) => { video.onseeked = () => resolve(); video.onerror = () => reject(new Error(video.error?.message || 'Seek failed')); video.currentTime = t; }));
    const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(video, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let count = 0, sumX = 0;
    for (let y = 0; y < c.height; y += 4) for (let x = 0; x < c.width; x += 4) { const i = (y * c.width + x) * 4; if (data[i + 1] > data[i] + 40 && data[i + 2] > data[i] + 40) { count++; sumX += x; } }
    samples.push({ time: video.currentTime, coloredPixelCount: count, movingShapeCentroidX: count ? sumX / count : null });
    artifact(`${filename}-${Math.round(t * 1000)}ms.png`, c.toDataURL());
  }
  let callbacks = 0; let firstPresented = 0; let lastPresented = 0;
  const observe = (_now: number, meta: VideoFrameCallbackMetadata) => { callbacks++; if (!firstPresented) firstPresented = meta.presentedFrames; lastPresented = meta.presentedFrames; if (!video.ended) video.requestVideoFrameCallback(observe); };
  video.currentTime = 0; video.requestVideoFrameCallback(observe);
  const ended = new Promise<void>((resolve, reject) => { video.onended = () => resolve(); video.onerror = () => reject(new Error(video.error?.message || 'Playback failed')); });
  await video.play(); await bounded(ended);
  const quality = video.getVideoPlaybackQuality();
  return { bytes: blob.size, mime: blob.type, width: video.videoWidth, height: video.videoHeight, duration: video.duration, samples, playback: { ended: video.ended, callbacks, firstPresented, lastPresented, totalFrames: quality.totalVideoFrames, droppedFrames: quality.droppedVideoFrames, error: video.error?.message ?? null } };
}
async function exportOne(format: 'mp4' | 'webm', device = false) {
  const p = fixture(`audit-${device ? 'device' : 'plain'}-${format}`, true);
  if (device) {
    const source = document.createElement('canvas'); source.width = 256; source.height = 512; const ctx = source.getContext('2d')!; ctx.fillStyle = '#ff0088'; ctx.fillRect(0, 0, 256, 512);
    p.assets.audit = { id: 'audit', name: 'Audit screen', mimeType: 'image/png', dataUrl: source.toDataURL(), width: 256, height: 512 };
    p.shots[0].layers = [createDefaultImageLayer({ assetId: 'audit', deviceFrame: { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true }, entrance: emptyTransition, exit: emptyTransition })];
  }
  await show(p, 0); const before = captured.length; const started = performance.now();
  await runVideoExportPipeline(p, progress => { status.textContent = progress.statusText; }, { format, resolution: '720p', fps: 30, quality: 'studio', scope: 'shot', selectedShotId: p.shots[0].id, onSeekFrame: async t => { await show(p, t, 1); } });
  for (let i = 0; i < 90 && captured.length === before; i++) await frame();
  const item = captured[before]; if (!item) throw new Error('Exporter finished without a captured download');
  if (item.fetchError) return { exportWallMs: performance.now() - started, filename: item.filename, fetchError: item.fetchError };
  const details = { exportWallMs: performance.now() - started, filename: item.filename, bytes: item.blob.size, mime: item.blob.type };
  try { return { ...details, ...await decodeVideo(item.blob, item.filename) }; }
  catch (error) { return { ...details, playbackError: String(error) }; }
}
async function runExports() {
  output.exportVisibility = document.visibilityState;
  output.exportCanvasElement = { tagName: document.getElementById('raylight-stage-webgl-canvas')?.tagName };
  const results: Record<string, unknown> = {};
  for (const [name, format, device] of [['mp4', 'mp4', false], ['webm', 'webm', false], ['deviceMp4', 'mp4', true]] as const) {
    status.textContent = `Exporting ${name}`;
    try { results[name] = await exportOne(format, device); } catch (error) { results[name] = { error: String(error) }; }
    output.exports = results; publish();
  }
}
function stats(values: number[]) { const a = [...values].sort((x, y) => x - y); return { samples: a.length, meanMs: a.reduce((s, v) => s + v, 0) / a.length, medianMs: a[Math.floor(a.length * 0.5)], p95Ms: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))], maxMs: a.at(-1) }; }
async function runBenchmark() {
  const results: Record<string, unknown> = {};
  for (const count of [1, 10]) for (const enabled of [false, true]) {
    const p = fixture('Benchmark', true); const base = p.shots[0].layers[0];
    p.shots[0].layers = Array.from({ length: count }, (_, i) => ({ ...structuredClone(base), id: `bench-${i}`, position: { x: (i % 5 - 2) * 0.15, y: (Math.floor(i / 5) - 0.5) * 0.3, z: 0 }, blocks: [] }));
    if (enabled) { const e = p.shots[0].effects; e.vignette.enabled = true; e.bloom.enabled = true; e.colorGrade.enabled = true; e.filmGrain.enabled = true; e.chromaticAberration.enabled = true; e.glitch.enabled = true; }
    await show(p); usePlayheadStore.getState().setIsPlaying(true); await frames(20);
    const times: number[] = []; let previous = await frame(); for (let i = 0; i < 90; i++) { const now = await frame(); times.push(now - previous); previous = now; }
    usePlayheadStore.getState().setIsPlaying(false);
    const evalTimes: number[] = []; for (let i = 0; i < 200; i++) { const start = performance.now(); evaluateProjectAtTime(p, i * 16); evalTimes.push(performance.now() - start); }
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const ctx = c.getContext('2d')!; const canvasTimes: number[] = [];
    for (let i = 0; i < 15; i++) { const start = performance.now(); await renderProjectFrameToCanvas(ctx, p, evaluateProjectAtTime(p, i * 16), 1920, 1080); ctx.getImageData(0, 0, 1, 1); canvasTimes.push(performance.now() - start); }
    results[`${count}layers-effects-${enabled ? 'on' : 'off'}`] = { frameIntervals: stats(times), approximateFps: 1000 / (times.reduce((a, b) => a + b, 0) / times.length), evaluation: stats(evalTimes), canvas1080pRenderAndReadback: stats(canvasTimes) };
    output.benchmarks = results; publish();
  }
}
function button(id: string, task: () => Promise<void>) {
  document.getElementById(id)!.addEventListener('click', () => {
    document.querySelectorAll('button').forEach(b => b.disabled = true); status.textContent = `Running ${id}`;
    void task().then(() => { status.textContent = `${id} complete`; }).catch(error => { output.error = String(error); status.textContent = `Failed: ${String(error)}`; }).finally(() => { publish(); document.querySelectorAll('button').forEach(b => b.disabled = false); });
  });
}
button('pixels', runPixels); button('exports', runExports); button('benchmark', runBenchmark);
button('control', async () => {
  const controls: Record<string, unknown> = {};
  for (const [mime, detached] of [['video/webm;codecs=vp9', false], ['video/webm;codecs=vp9', true], ['video/webm;codecs=vp8', false], ['video/mp4', false]] as const) {
    const key = `${mime}-${detached ? 'detached' : 'attached'}`;
    if (!MediaRecorder.isTypeSupported(mime)) { controls[key] = { supported: false }; continue; }
    const target = detached ? document.createElement('canvas') : reference;
    target.width = 1280; target.height = 720;
    const ctx = target.getContext('2d')!;
    const stream = target.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime }); const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
    recorder.start();
    for (let i = 0; i < 60; i++) { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 1280, 720); ctx.fillStyle = '#00bfff'; ctx.fillRect(i * 15, 100, 150, 150); await frame(); }
    recorder.stop(); await stopped; stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType });
    try { controls[key] = await decodeVideo(blob, `browser-control-${detached ? 'detached' : 'attached'}-${mime.includes('vp8') ? 'vp8' : 'vp9'}.${mime.includes('mp4') ? 'mp4' : 'webm'}`); }
    catch (error) { controls[key] = { bytes: blob.size, error: String(error) }; }
    output.recordingControls = controls; publish();
  }
});
void show(fixture('Initial')).then(() => { output.ready = true; publish(); });


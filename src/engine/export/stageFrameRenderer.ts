/**
 * App-facing FrameRenderer: seeks the project (store + <video> elements),
 * captures the WebGL stage through a resize-once session, and falls back to
 * the deterministic 2D renderer when WebGL capture is unavailable.
 *
 * This replaces the seek/capture/fallback pattern that previously lived
 * separately in the PNG, GIF and video export branches.
 */
import { evaluateProjectAtTime } from '../evaluateShot';
import {
    renderProjectFrameToCanvas,
    syncAndSeekAllProjectVideos,
} from '../canvasRenderer';
import { acquireCanvas, releaseCanvas } from '../canvasPool';
import { beginCaptureSession, captureStageFrame } from '../stageCapture';
import type { FrameRenderer } from './contract';

export interface StageFrameRendererOptions {
    /** Seeks the editor playhead so the live stage renders the frame. */
    onSeek?: (timeMs: number) => Promise<void> | void;
}

export interface StageFrameRendererHandle {
    renderFrame: FrameRenderer;
    dispose: () => Promise<void>;
}

function nextMacrotask(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
}

export async function createStageFrameRenderer(
    project: Parameters<typeof evaluateProjectAtTime>[0],
    width: number,
    height: number,
    options: StageFrameRendererOptions = {}
): Promise<StageFrameRendererHandle> {
    const session = await beginCaptureSession(width, height);
    // 2D fallback surface, acquired lazily — only if WebGL capture fails.
    let fallbackCanvas: HTMLCanvasElement | null = null;
    let fallbackCtx: CanvasRenderingContext2D | null = null;
    let disposed = false;

    const render2DFallback = async (timeMs: number): Promise<HTMLCanvasElement | null> => {
        if (!fallbackCanvas) {
            fallbackCanvas = acquireCanvas(width, height);
            fallbackCtx = fallbackCanvas.getContext('2d');
        }
        if (!fallbackCtx) return null;
        const evaluated = evaluateProjectAtTime(project, timeMs);
        await renderProjectFrameToCanvas(fallbackCtx, project, evaluated, width, height);
        return fallbackCanvas;
    };

    const renderFrame: FrameRenderer = async (timeMs) => {
        if (disposed) return null;

        if (options.onSeek) {
            await options.onSeek(timeMs);
        }
        await nextMacrotask();
        await syncAndSeekAllProjectVideos(project, timeMs);

        const captured = session
            ? await session.captureFrame(timeMs)
            : await captureStageFrame(timeMs, width, height);
        if (captured) return captured;

        return render2DFallback(timeMs);
    };

    const dispose = async (): Promise<void> => {
        if (disposed) return;
        disposed = true;
        if (session) {
            await session.end();
        }
        releaseCanvas(fallbackCanvas);
        fallbackCanvas = null;
        fallbackCtx = null;
    };

    return { renderFrame, dispose };
}

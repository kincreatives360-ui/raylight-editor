/**
 * The shared offline capture loop.
 *
 * Every export format renders frames through this loop, so seek behavior,
 * frame-exact timestamps and the no-skip/no-duplicate policy are defined in
 * exactly one place. Frame N is always rendered at its timeline position;
 * a renderer that produces nothing is a hard failure, never a skipped frame.
 */
import {
    ExportFrameError,
    throwIfAborted,
    type FrameRenderer,
} from './contract';
import { frameTimestampSec } from './frameMath';

export interface FrameLoopOptions {
    totalFrames: number;
    fps: number;
    /** Timeline origin of the export window, in ms. */
    startMs: number;
    renderFrame: FrameRenderer;
    /** Called with each rendered frame; awaiting it applies natural backpressure. */
    onFrame: (frameIndex: number, source: CanvasImageSource, timestampSec: number) => Promise<void> | void;
    signal?: AbortSignal;
    onFrameCaptured?: (frameIndex: number, totalFrames: number) => void;
    /** Yield to the event loop between frames so UI stays responsive. */
    yieldBetweenFrames?: boolean;
}

function nextMacrotask(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function runFrameLoop(options: FrameLoopOptions): Promise<number> {
    const { totalFrames, fps, startMs, renderFrame, onFrame, signal } = options;
    let rendered = 0;

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        throwIfAborted(signal);

        const timestampSec = frameTimestampSec(frameIndex, fps);
        const timeMs = startMs + timestampSec * 1000;

        const source = await renderFrame(timeMs);
        if (!source) {
            throw new ExportFrameError(timeMs);
        }

        await onFrame(frameIndex, source, timestampSec);
        rendered++;

        options.onFrameCaptured?.(frameIndex, totalFrames);

        if (options.yieldBetweenFrames !== false) {
            await nextMacrotask();
        }
    }

    throwIfAborted(signal);
    return rendered;
}

export type StageCapture = (timeMs: number, width: number, height: number) => Promise<HTMLCanvasElement | null>;

/**
 * A capture session renders many frames at a fixed export size. Sessions let
 * the stage resize its surface once per export instead of per frame, and reuse
 * one capture canvas instead of allocating a full-resolution canvas per frame.
 */
export interface StageCaptureSession {
    captureFrame(timeMs: number): Promise<HTMLCanvasElement | null>;
    end(): Promise<void>;
}

export type StageCaptureSessionFactory = (
    width: number,
    height: number
) => Promise<StageCaptureSession | null>;

let capture: StageCapture | null = null;
let sessionFactory: StageCaptureSessionFactory | null = null;

export function registerStageCapture(
    renderer: StageCapture,
    factory?: StageCaptureSessionFactory
): () => void {
    capture = renderer;
    sessionFactory = factory ?? null;
    return () => {
        if (capture === renderer) capture = null;
        if (factory && sessionFactory === factory) sessionFactory = null;
    };
}

/** Single-shot capture (PNG stills). Falls back to per-call rendering. */
export async function captureStageFrame(
    timeMs: number,
    width: number,
    height: number
): Promise<HTMLCanvasElement | null> {
    if (capture) {
        return capture(timeMs, width, height);
    }
    return null;
}

/**
 * Begins a multi-frame capture session at the given size, or null when the
 * stage is unavailable (callers then use the 2D fallback renderer).
 */
export async function beginCaptureSession(
    width: number,
    height: number
): Promise<StageCaptureSession | null> {
    if (!sessionFactory) return null;
    return sessionFactory(width, height);
}

export type StageCapture = (timeMs: number, width: number, height: number) => Promise<HTMLCanvasElement | null>;
let capture: StageCapture | null = null;

export function registerStageCapture(renderer: StageCapture): () => void {
  capture = renderer;
  return () => { if (capture === renderer) capture = null; };
}

export async function captureStageFrame(timeMs: number, width: number, height: number): Promise<HTMLCanvasElement | null> {
  if (capture) {
    return capture(timeMs, width, height);
  }
  return null;
}



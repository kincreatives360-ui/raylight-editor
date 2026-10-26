export type StageCapture = (timeMs: number, width: number, height: number) => Promise<HTMLCanvasElement>;
let capture: StageCapture | null = null;

export function registerStageCapture(renderer: StageCapture): () => void {
  capture = renderer;
  return () => { if (capture === renderer) capture = null; };
}

export function getStageWebGLCanvas(): HTMLCanvasElement | null {
  const host = document.getElementById('raylight-stage-webgl-canvas');
  const canvas = host?.tagName === 'CANVAS' ? host : host?.querySelector('canvas');
  return canvas?.tagName === 'CANVAS' ? canvas as HTMLCanvasElement : null;
}

export async function captureStageFrame(timeMs: number, width: number, height: number): Promise<HTMLCanvasElement | null> {
  if (capture) {
    return capture(timeMs, width, height);
  }
  return getStageWebGLCanvas();
}

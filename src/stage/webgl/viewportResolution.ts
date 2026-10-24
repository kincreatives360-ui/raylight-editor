export function getViewportPixelRatio(width: number, height: number, zoom: number, devicePixelRatio: number, maxTextureSize: number) {
  const limit = Math.min(4096, maxTextureSize);
  return Math.min(
    devicePixelRatio * Math.max(1, zoom),
    limit / Math.max(1, width, height),
  );
}

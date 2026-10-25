export function getViewportPixelRatio(
  width: number,
  height: number,
  zoom: number,
  devicePixelRatio: number,
  maxTextureSize: number,
  maxBufferDimension = 8192
) {
  const limit = Math.min(maxBufferDimension, maxTextureSize);
  return Math.min(
    devicePixelRatio * Math.max(1, zoom),
    limit / Math.max(1, width, height),
  );
}

export function getDeviceShadowOpacity(opacity: number, rotation?: { x: number; y: number }) {
  const facingCamera = Math.max(0, Math.cos(rotation?.x ?? 0) * Math.cos(rotation?.y ?? 0));
  return Math.max(0, Math.min(1, opacity * facingCamera));
}

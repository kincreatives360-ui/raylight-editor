// Read-only probes of the current implementation. Run from the repository root:
// node docs/audits/device-frame-probes.mjs
import { createServer } from 'vite';
import * as THREE from 'three';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const device = await server.ssrLoadModule('/src/model/deviceFrame.ts');
  const schema = await server.ssrLoadModule('/src/model/schema.ts');
  const settings = device.resolveDeviceFrameSettings({ ...device.DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true });
  const proportions = [[0.34, 0.68], [0.34, 0.34], [0.68, 0.34]].map(([width, height]) => {
    const metrics = device.getDeviceFrameMetrics(width, height, settings);
    return { screen: [width, height], bodyAspect: metrics.bodyWidth / metrics.bodyHeight };
  });
  const sizeControl = [0.65, 1, 2].map(deviceScale => ({
    deviceScale, ...device.getDeviceFrameMetrics(0.34, 0.68, { ...settings, deviceScale }),
  }));

  const { roundedRect } = await server.ssrLoadModule('/src/stage/webgl/phoneGeometry.ts');
  const geometry = new THREE.ShapeGeometry(roundedRect(0.34, 0.68, 0.0391), 10);
  const uv = geometry.attributes.uv;
  const valuesU = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
  const valuesV = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
  const reflectionUv = {
    minU: Math.min(...valuesU), maxU: Math.max(...valuesU),
    minV: Math.min(...valuesV), maxV: Math.max(...valuesV),
  };
  geometry.dispose();
  console.log(JSON.stringify({
    proportions, sizeControl, reflectionUv,
    partialSettingsAccepted: schema.DeviceFrameSettingsSchema.safeParse({ enabled: true, model: 'iphone-pro' }).success,
    fullSettingsAccepted: schema.DeviceFrameSettingsSchema.safeParse(settings).success,
  }, null, 2));
} finally {
  await server.close();
}

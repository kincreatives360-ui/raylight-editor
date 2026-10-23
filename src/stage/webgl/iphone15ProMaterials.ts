import * as THREE from 'three';
import type { DeviceFrameSettings } from '../../model/types';

interface MaterialInput {
  gloss: number;
  reflection: number;
  glassOpacity: number;
  frameMetalness?: number;
  frameRoughness?: number;
}

export function getIPhone15ProMaterialPolicy(input: MaterialInput) {
  const gloss = Math.max(0, Math.min(1, input.gloss));
  const reflection = Math.max(0, Math.min(1, input.reflection));
  return {
    // The display is supplied by ThreeLayerObject; these values document the
    // material contract the device shell must preserve.
    displayOpaque: true,
    displayToneMapped: false,
    headOnReflectionOpacity: Math.min(0.1, 0.028 + gloss * reflection * 0.06),
    screenGlassOpacity: Math.min(0.12, Math.max(0.015, input.glassOpacity * 0.72)),
    titanium: {
      metalness: input.frameMetalness !== undefined ? Math.max(0, Math.min(1, input.frameMetalness)) : 0.88,
      roughness: input.frameRoughness !== undefined ? Math.max(0.04, Math.min(1, input.frameRoughness)) : 0.31,
    },
    rearGlass: { metalness: 0.06, roughness: 0.24 },
    lensGlass: { metalness: 0.18, roughness: 0.055 },
    flash: { emissiveIntensity: 0.42 },
    renderOrder: { rear: 0, screenGlass: 20, reflection: 21, dynamicIsland: 22 },
  };
}

function createReflectionTexture(opacity: number, tint: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const band = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    band.addColorStop(0, `${tint}00`);
    band.addColorStop(0.28, `${tint}00`);
    band.addColorStop(0.48, `${tint}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`);
    band.addColorStop(0.64, `${tint}${Math.round(opacity * 0.26 * 255).toString(16).padStart(2, '0')}`);
    band.addColorStop(0.82, `${tint}00`);
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Soft local compositing shadow retained from the original device frame. */
export function createDeviceShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,0.78)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.38)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createIPhone15ProMaterials(settings: DeviceFrameSettings) {
  const policy = getIPhone15ProMaterialPolicy(settings);
  const reflectionTexture = createReflectionTexture(policy.headOnReflectionOpacity, settings.glassTint);
  return {
    policy,
    reflectionTexture,
    titanium: new THREE.MeshPhysicalMaterial({ color: settings.frameColor, ...policy.titanium, clearcoat: 0.34, clearcoatRoughness: 0.29, side: THREE.DoubleSide }),
    rearGlass: new THREE.MeshPhysicalMaterial({ color: settings.frameColor, ...policy.rearGlass, clearcoat: 0.75, clearcoatRoughness: 0.17, side: THREE.DoubleSide }),
    screenGlass: new THREE.MeshPhysicalMaterial({ color: settings.glassTint, transparent: true, opacity: policy.screenGlassOpacity, roughness: Math.max(0.04, settings.glassRoughness), metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false, side: THREE.DoubleSide }),
    reflection: new THREE.MeshBasicMaterial({ map: reflectionTexture, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }),
    island: new THREE.MeshBasicMaterial({ color: '#050507', toneMapped: false, side: THREE.DoubleSide }),
    lensRing: new THREE.MeshPhysicalMaterial({ color: '#2b2e33', metalness: 0.86, roughness: 0.19, clearcoat: 0.54, side: THREE.DoubleSide }),
    lensGlass: new THREE.MeshPhysicalMaterial({ color: '#101722', ...policy.lensGlass, clearcoat: 1, clearcoatRoughness: 0.045, side: THREE.DoubleSide }),
    sensor: new THREE.MeshPhysicalMaterial({ color: '#111419', metalness: 0.12, roughness: 0.22, side: THREE.DoubleSide }),
    flash: new THREE.MeshStandardMaterial({ color: '#fff5d2', emissive: '#ffd788', emissiveIntensity: policy.flash.emissiveIntensity, roughness: 0.35, metalness: 0.04, side: THREE.DoubleSide }),
    appleMark: new THREE.MeshPhysicalMaterial({ color: '#d2d6dc', metalness: 0.35, roughness: 0.34, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
  };
}

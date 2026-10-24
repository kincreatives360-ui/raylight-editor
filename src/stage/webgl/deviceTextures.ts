import * as THREE from 'three';

export function createReflectionTexture(gloss: number, reflection: number, tint: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, `${tint}${Math.round(gloss * 26).toString(16).padStart(2, '0')}`);
  wash.addColorStop(0.26, `${tint}00`);
  wash.addColorStop(0.52, `${tint}${Math.round(reflection * 23).toString(16).padStart(2, '0')}`);
  wash.addColorStop(0.7, `${tint}00`);
  wash.addColorStop(1, `${tint}${Math.round(gloss * 12).toString(16).padStart(2, '0')}`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const specular = ctx.createRadialGradient(42, 48, 1, 42, 48, 190);
  specular.addColorStop(0, `rgba(255,255,255,${0.38 * gloss})`);
  specular.addColorStop(0.22, `rgba(255,255,255,${0.11 * gloss})`);
  specular.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specular;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createShadowTexture(): THREE.CanvasTexture {
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
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

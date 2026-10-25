import * as THREE from 'three';

export function createReflectionTexture(gloss: number, reflection: number, tint: string): THREE.CanvasTexture {
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : ({ width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement);
  canvas.width = 1024;
  canvas.height = 2048;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;

  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return texture;

  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, `${tint}${Math.round(gloss * 26).toString(16).padStart(2, '0')}`);
  wash.addColorStop(0.26, `${tint}00`);
  wash.addColorStop(0.52, `${tint}${Math.round(reflection * 23).toString(16).padStart(2, '0')}`);
  wash.addColorStop(0.7, `${tint}00`);
  wash.addColorStop(1, `${tint}${Math.round(gloss * 12).toString(16).padStart(2, '0')}`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const specular = ctx.createRadialGradient(168, 192, 4, 168, 192, 760);
  specular.addColorStop(0, `rgba(255,255,255,${0.38 * gloss})`);
  specular.addColorStop(0.22, `rgba(255,255,255,${0.11 * gloss})`);
  specular.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specular;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return texture;
}

export function createShadowTexture(): THREE.CanvasTexture {
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : ({ width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement);
  canvas.width = 1024;
  canvas.height = 1024;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) {
    const gradient = ctx.createRadialGradient(512, 512, 8, 512, 512, 500);
    gradient.addColorStop(0, 'rgba(0,0,0,0.78)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.38)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.12)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
  }
  return texture;
}


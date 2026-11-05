import type { WarpEffect } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function lattice(x: number, y: number, z: number, seed: number): number {
  let hash = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1597334677);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

/** Coherent, seeded value noise; quintic interpolation keeps evolution continuous. */
export function proceduralNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const u = smooth(x - ix), v = smooth(y - iy), w = smooth(z - iz);
  const plane = (dz: number) => mix(
    mix(lattice(ix, iy, iz + dz, seed), lattice(ix + 1, iy, iz + dz, seed), u),
    mix(lattice(ix, iy + 1, iz + dz, seed), lattice(ix + 1, iy + 1, iz + dz, seed), u), v);
  return mix(plane(0), plane(1), w);
}

/** Fractional complexity fades in the final octave without a discontinuity. */
export function sampleFractalNoise(x: number, y: number, z: number, seed: number, complexity = 3): number {
  const octaves = Math.max(1, Math.min(6, complexity));
  let sum = 0, weights = 0;
  for (let octave = 0; octave < Math.ceil(octaves); octave++) {
    const frequency = 2 ** octave;
    const weight = 2 ** -octave * Math.min(1, octaves - octave);
    sum += proceduralNoise(x * frequency, y * frequency, z * frequency, seed + octave * 1013) * weight;
    weights += weight;
  }
  return sum / weights;
}

export function turbulentWarpPoint(x: number, y: number, warp: WarpEffect, timeSeconds = 0, bounds?: { width: number; height: number; centerX?: number; centerY?: number }): { x: number; y: number; z: number } {
  const amount = warp.amount ?? 0;
  if (!warp.enabled || amount === 0) return { x, y, z: 0 };
  const size = Math.max(1, warp.size ?? 100);
  let u = (x - (warp.centerX ?? 0)) / size;
  let v = (y - (warp.centerY ?? 0)) / size;
  let evolution = ((warp.evolution ?? 0) + timeSeconds * (warp.speed ?? 0)) / 360;
  if (warp.loop) {
    const duration = Math.max(.001, warp.loopDuration ?? 4);
    // A circle samples the same smooth field at both ends, including derivatives.
    const cycle = ((timeSeconds % duration) + duration) % duration / duration;
    const phase = (cycle + (warp.evolution ?? 0) / 360) * Math.PI * 2;
    u += Math.cos(phase);
    v += Math.sin(phase);
    evolution = 0;
  }
  let fade = 1;
  if (bounds && warp.pinning && warp.pinning !== 'none') {
    const nx = (x - (bounds.centerX ?? 0) + bounds.width / 2) / Math.max(1, bounds.width);
    const ny = (y - (bounds.centerY ?? 0) + bounds.height / 2) / Math.max(1, bounds.height);
    const edge = (distance: number) => smooth(clamp01(distance / .15));
    const pin = warp.pinning;
    if (pin === 'all' || pin === 'vertical' || pin === 'left') fade *= edge(nx);
    if (pin === 'all' || pin === 'vertical' || pin === 'right') fade *= edge(1 - nx);
    if (pin === 'all' || pin === 'horizontal' || pin === 'top') fade *= edge(ny);
    if (pin === 'all' || pin === 'horizontal' || pin === 'bottom') fade *= edge(1 - ny);
  }
  const seed = warp.seed ?? 0, complexity = warp.complexity ?? 3;
  const dx = sampleFractalNoise(u, v, evolution, seed, complexity) * 2 - 1;
  const dy = sampleFractalNoise(u + 19.17, v - 7.43, evolution + 11.31, seed + 7919, complexity) * 2 - 1;
  return { x: x + dx * amount * fade, y: y + dy * amount * fade, z: 0 };
}

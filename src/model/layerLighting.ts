import type { Layer } from './types';

/** Text stays flat for readability; visual surfaces participate in scene lighting. */
export function layerReceivesLight(layer: Layer): boolean {
  return layer.receivesLight ?? (layer.kind === 'shape' || layer.kind === 'image' || layer.kind === 'video');
}

import type { Layer, Transitionish } from '../../model/types';
export type TransitionSide = 'entrance' | 'exit';
/** Timeline displays the first transition on each side, matching the renderer's stack precedence. */
export function getTimelineTransition(layer: Layer, side: TransitionSide): Transitionish & {id?:string} {
 return (side === 'entrance' ? layer.entrances : layer.exits)?.[0] ?? layer[side];
}
/** Keep the legacy mirror and the edited stack entry aligned without rebuilding other entries. */
export function updateTimelineTransition<T extends Layer>(layer: T, side: TransitionSide, patch: Partial<Transitionish>, presetId?: string): T {
 const key = side === 'entrance' ? 'entrances' : 'exits';
 const stack = layer[key];
 const selectedIndex = presetId ? stack?.findIndex(preset => preset.id === presetId) ?? -1 : 0;
 const index = selectedIndex >= 0 ? selectedIndex : 0;
 const next = {...(stack?.[index] ?? layer[side]), ...patch};
 const entries = stack?.length ? stack.map((preset,i) => i === index ? next : preset) : [next];
 return {...layer, [side]: entries[0], [key]: entries};
}

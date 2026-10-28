import { degToRad } from '../../model/defaults';
import { generateId } from '../../model/id';
import type { AnimationBlock, AnimationBlockProperty, Layer, Shot, Transitionish, TransitionType } from '../../model/types';
export type PresetSide = 'in' | 'out';
export type LayerPreset = Transitionish & {
    id?: string;
};
export const PRESETS: {
    type: TransitionType;
    label: string;
    textOnly?: boolean;
}[] = [
    { type: 'fade', label: 'Fade' }, { type: 'blur', label: 'Blur' }, { type: 'slide-up', label: 'Slide' },
    { type: 'focus', label: 'Focus' }, { type: 'rack-focus', label: 'Rack Focus' }, { type: 'mask-sweep', label: 'Wipe' },
    { type: 'typewriter', label: 'Typewriter', textOnly: true }, { type: 'scramble', label: 'Scramble', textOnly: true },
    { type: 'slide-down', label: 'Slide down' }, { type: 'slide-left', label: 'Slide left' }, { type: 'slide-right', label: 'Slide right' },
    { type: 'float-out', label: 'Float' }, { type: 'scale-out', label: 'Scale' },
    { type: 'pop', label: 'Pop' }, { type: 'spin', label: 'Spin' },
    { type: 'flip-x', label: 'Flip X' }, { type: 'flip-y', label: 'Flip Y' },
    { type: 'swing', label: 'Swing' }, { type: 'wipe', label: 'Mask sweep' },
];
export const ANIMATIONS: {
    property: AnimationBlockProperty;
    label: string;
    group: 'Custom' | 'Appearance' | 'Effects';
    textOnly?: boolean;
    shapeOnly?: boolean;
}[] = [
    { property: 'position', label: 'Position', group: 'Custom' }, { property: 'rotation', label: 'Rotation', group: 'Custom' },
    { property: 'tilt', label: 'Tilt', group: 'Custom' }, { property: 'scale', label: 'Scale', group: 'Custom' },
    { property: 'opacity', label: 'Opacity', group: 'Custom' }, { property: 'size', label: 'Size', group: 'Custom' },
    { property: 'followPath', label: 'Follow path', group: 'Custom' }, { property: 'wiggle', label: 'Wiggle', group: 'Custom' },
    { property: 'shimmer', label: 'Shimmer', group: 'Custom' }, { property: 'emphasis', label: 'Emphasis', group: 'Custom' },
    { property: 'counter', label: 'Counter', group: 'Custom', textOnly: true }, { property: 'changeText', label: 'Change text', group: 'Custom', textOnly: true },
    { property: 'maskSweep', label: 'Wipe', group: 'Appearance' }, { property: 'cornerRadius', label: 'Corner radius', group: 'Appearance', shapeOnly: true },
    { property: 'pathReveal', label: 'Path reveal', group: 'Appearance', shapeOnly: true },
    { property: 'layerBlur', label: 'Blur', group: 'Effects' }, { property: 'glow', label: 'Glow', group: 'Effects' },
];
export const presetLabel = (type: TransitionType) => PRESETS.find(p => p.type === type)?.label ?? type;
export const animationLabel = (property: AnimationBlockProperty) => ANIMATIONS.find(p => p.property === property)?.label ?? (property === 'morph' ? 'Morph into' : property);
export const availablePresets = (layers: Layer[]) => PRESETS.filter(p => !p.textOnly || layers.every(l => l.kind === 'text'));
export const availableAnimations = (layers: Layer[]) => ANIMATIONS.filter(p => (!p.textOnly || layers.every(l => l.kind === 'text')) && (!p.shapeOnly || layers.every(l => l.kind === 'shape' || (p.property === 'cornerRadius' && (l.kind === 'image' || l.kind === 'video')))) && (p.property !== 'glow' || layers.every(l => l.effects.glow?.enabled)));
export function presetList(layer: Layer, side: PresetSide): LayerPreset[] {
    const stack = side === 'in' ? layer.entrances : layer.exits;
    const legacy = side === 'in' ? layer.entrance : layer.exit;
    return stack?.length ? stack : legacy.type !== 'none' ? [legacy] : [];
}
export function replacePresets(layer: Layer, side: PresetSide, list: LayerPreset[]): Layer {
    const empty: Transitionish = { type: 'none', durationMs: 0, delayMs: 0, distance: 0, easing: { kind: 'preset', name: side === 'in' ? 'ease-out' : 'ease-in' } };
    return side === 'in' ? { ...layer, entrances: list.length ? list : undefined, entrance: list[0] ?? empty } : { ...layer, exits: list.length ? list : undefined, exit: list[0] ?? empty };
}
export function createPreset(type: TransitionType, side: PresetSide, durationMs: number): LayerPreset {
    return { id: generateId(side), type, durationMs: Math.max(10, Math.min(600, durationMs)), delayMs: 0, distance: .25, blur: 40, fade: true, stagger: 'none', enabled: true, easing: { kind: 'preset', name: side === 'in' ? 'ease-out' : 'ease-in' } };
}
export function createAnimationBlock(property: AnimationBlockProperty, shot: Shot, localMs: number, layer?: Layer): AnimationBlock {
    const windowStart = layer?.inMs ?? 0;
    const windowEnd = Math.min(shot.durationMs, layer?.outMs ?? shot.durationMs);
    const durationMs = Math.max(10, Math.min(1200, windowEnd - windowStart));
    const amount = property === 'position' || property === 'followPath' ? { x: .25, y: 0, z: 0 } : property === 'rotation' ? { x: 0, y: 0, z: degToRad(45) } : property === 'tilt' ? { x: degToRad(15), y: degToRad(-20), z: 0 } : property === 'size' ? { x: .1, y: .1, z: 0 } : property === 'opacity' ? -.5 : property === 'scale' || property === 'emphasis' ? .25 : property === 'layerBlur' ? .4 : property === 'cornerRadius' ? .1 : property === 'counter' ? 100 : property === 'wiggle' ? .03 : 1;
    return { id: generateId('blk'), label: animationLabel(property), property, startMs: Math.round(Math.max(windowStart, Math.min(windowEnd - durationMs, localMs))), durationMs, easing: { kind: 'preset', name: property === 'shimmer' ? 'linear' : 'ease-in-out' }, amount, enabled: true, ...(property === 'shimmer' ? { settings: { color: '#ffffff', intensity: 1, width: .18, direction: 'right' as const } } : property === 'changeText' ? { settings: { text: 'New text' } } : {}) };
}
export function addBlocksToShot(shot: Shot, ids: string[], property: AnimationBlockProperty, localMs: number): Shot {
    return { ...shot, layers: shot.layers.map(layer => ids.includes(layer.id) && !layer.locked && availableAnimations([layer]).some(p => p.property === property) ? { ...layer, blocks: [...layer.blocks, createAnimationBlock(property, shot, localMs, layer)] } : layer) };
}
export function editPreset(layer: Layer, side: PresetSide, index: number, expectedType: TransitionType, patch: Partial<Transitionish>): Layer {
    const list = presetList(layer, side);
    const preset = list[index];
    if (!preset || preset.type !== expectedType || (patch.type === 'typewriter' && layer.kind !== 'text'))
        return layer;
    const window = Math.max(10, layer.outMs - layer.inMs);
    const next = { ...preset, ...patch };
    next.durationMs = Math.max(10, Math.min(next.durationMs, window));
    next.delayMs = Math.max(0, Math.min(next.delayMs, window - next.durationMs));
    return replacePresets(layer, side, list.map((item, i) => i === index ? next : item));
}

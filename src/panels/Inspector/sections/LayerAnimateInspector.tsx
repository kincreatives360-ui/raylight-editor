import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, CircleDashed, Compass, Eye, EyeOff, Focus, Maximize2, Move, Plus, RotateCw, Scan, Sparkles, Spline, Square, Star, Type, Waves, X } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { degToRad, radToDeg } from '../../../model/defaults';
import type { AnimationBlock, AnimationBlockProperty, Easing, Layer, Shot, Transitionish, TransitionType, Vec3 } from '../../../model/types';
import { usePlayheadStore } from '../../../store/usePlayheadStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { EasingControl } from '../../../ui/EasingControl';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { IconButton, InspectorRow, Switch } from '../../../ui/primitives';
import { ScrubInput } from '../../../ui/ScrubInput';
import { addBlocksToShot, animationLabel, availableAnimations, availablePresets, createAnimationBlock, createPreset, editPreset, presetLabel, presetList, replacePresets, type PresetSide } from '../animationModel';
import { ColorPicker } from '../ColorPicker';
import { InspectorFlyout } from './InspectorFlyout';
import './layerAnimate.css';
function AnimationIcon({ property }: {
    property: string;
}) {
    const Icon = property === 'position' || property.startsWith('slide') ? Move : property === 'rotation' ? RotateCw : property === 'tilt' ? Compass : property === 'size' || property === 'scale' || property === 'emphasis' ? Maximize2 : property === 'opacity' || property === 'fade' ? CircleDashed : property === 'shimmer' ? Star : property === 'followPath' ? Spline : property === 'wiggle' ? Waves : property === 'typewriter' || property === 'counter' || property === 'changeText' ? Type : property === 'blur' || property === 'focus' || property === 'rack-focus' || property === 'layerBlur' ? Focus : property === 'mask-sweep' || property === 'maskSweep' || property === 'pathReveal' ? Scan : property === 'cornerRadius' ? Square : Sparkles;
    return <Icon aria-hidden="true"/>;
}
function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <InspectorRow label={label} stacked>{children}</InspectorRow>; }
function EasingField({ value, onChange }: {
    value: Easing;
    onChange: (next: Easing) => void;
}) {
    return <Field label="Easing"><EasingControl value={value} onChange={onChange} rowClassName="animate-field-action"/></Field>;
}
function Directions({ value, onChange, vertical = false }: {
    value: string;
    onChange: (direction: 'left' | 'right' | 'up' | 'down') => void;
    vertical?: boolean;
}) {
    return <div className="animate-directions" role="group" aria-label="Direction">{(['left', 'right', ...(vertical ? ['up', 'down'] : [])] as const).map(direction => <button key={direction} type="button" aria-label={direction} aria-pressed={value === direction} onClick={() => onChange(direction as 'left' | 'right' | 'up' | 'down')}>{direction === 'left' ? <ArrowLeft /> : direction === 'right' ? <ArrowRight /> : direction === 'up' ? <ArrowUp /> : <ArrowDown />}</button>)}</div>;
}
function PresetSettings({ preset, side, layers, maxDuration, onChange }: {
    preset: Transitionish;
    side: PresetSide;
    layers: Layer[];
    maxDuration: number;
    onChange: (patch: Partial<Transitionish>) => void;
}) {
    const blur = ['blur', 'focus', 'rack-focus'].includes(preset.type);
    const move = preset.type.startsWith('slide') || preset.type === 'float-out';
    return <div className="animate-settings-fields">
        <Field label="Type"><FigmaSelect aria-label="Preset type" value={preset.type} onChange={event => onChange({ type: event.target.value as TransitionType })}>{availablePresets(layers).map(p => <option key={p.type} value={p.type}>{p.label}</option>)}</FigmaSelect></Field>
        <ScrubInput label="Duration" value={preset.durationMs} min={10} max={Math.max(10, maxDuration - preset.delayMs)} unit=" ms" onChange={durationMs => onChange({ durationMs })}/>
        {blur && <Field label="Blur"><ScrubInput aria-label="Blur amount" label={side === 'in' ? 'From' : 'To'} value={preset.blur ?? 40} min={0} max={200} unit=" px" onChange={value => onChange({ blur: value })}/></Field>}
        {move && <Field label="Distance"><ScrubInput label="Offset" value={preset.distance * 100} min={0} max={200} unit=" %" onChange={value => onChange({ distance: value / 100 })}/></Field>}
        {(blur || move || preset.type === 'scale-out') && <div className="animate-toggle-row"><span>Fade</span><Switch ariaLabel="Fade" checked={preset.fade !== false} className="animate-switch" onChange={fade => onChange({ fade })}/></div>}
        {layers.every(layer => layer.kind === 'text') && <Field label="Stagger"><FigmaSelect aria-label="Stagger" value={preset.stagger ?? 'none'} onChange={event => onChange({ stagger: event.target.value as Transitionish['stagger'] })}>{[['none', 'None'], ['letter', 'Letter'], ['word', 'Word'], ['line', 'Line']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FigmaSelect></Field>}
        <EasingField value={preset.easing} onChange={easing => onChange({ easing })}/>
        <details className="animate-timing"><summary>Timing</summary><ScrubInput label="Delay" value={preset.delayMs} min={0} max={Math.max(0, maxDuration - preset.durationMs)} unit=" ms" onChange={delayMs => onChange({ delayMs })}/></details>
    </div>;
}
function BlockSettings({ block, shot, onChange }: {
    block: AnimationBlock;
    shot: Shot;
    onChange: (patch: Partial<AnimationBlock>) => void;
}) {
    const settings = block.settings ?? {};
    const patchSettings = (patch: Partial<NonNullable<AnimationBlock['settings']>>) => onChange({ settings: { ...settings, ...patch } });
    const vec: Vec3 = typeof block.amount === 'number' ? { x: block.amount, y: 0, z: 0 } : block.amount;
    const amount = typeof block.amount === 'number' ? block.amount : block.amount.x;
    const scalar = (label: string, unit: string, multiplier: number, min: number, max: number) => <ScrubInput label={label} value={amount * multiplier} min={min} max={max} step={multiplier === 1 ? .01 : 1} unit={unit} onChange={value => onChange({ amount: value / multiplier })}/>;
    const vector = (axes: ('x' | 'y' | 'z')[], rotation = false) => <div className="animate-pair">{axes.map(axis => <ScrubInput key={axis} label={axis.toUpperCase()} value={rotation ? radToDeg(vec[axis]) : vec[axis] * (axis === 'y' ? 1080 : 1920)} min={rotation ? -3600 : -10000} max={rotation ? 3600 : 10000} unit={rotation ? '°' : ' px'} onChange={value => onChange({ amount: { ...vec, [axis]: rotation ? degToRad(value) : value / (axis === 'y' ? 1080 : 1920) } })}/>)}</div>;
    return <div className="animate-block-fields">
        {block.property === 'shimmer' ? <>
            <Field label="Color"><ColorPicker color={settings.color ?? '#ffffff'} label="Shimmer color" showGradientMode={false} onChange={color => patchSettings({ color })}/></Field>
            <Field label="Intensity"><div className="animate-pair"><ScrubInput aria-label="Shimmer intensity" label={<Sparkles />} value={(settings.intensity ?? 1) * 100} min={0} max={500} unit=" %" onChange={value => patchSettings({ intensity: value / 100 })}/><ScrubInput label="Width" value={(settings.width ?? .18) * 100} min={1} max={100} unit=" %" onChange={value => patchSettings({ width: value / 100 })}/></div></Field>
            <Field label="Direction"><Directions value={settings.direction ?? 'right'} onChange={direction => patchSettings({ direction })}/></Field>
        </> : block.property === 'position' || block.property === 'followPath' ? <Field label={block.property === 'followPath' ? 'Path offset' : 'Position'}>{vector(['x', 'y', 'z'])}</Field>
            : block.property === 'rotation' ? <Field label="Rotation">{vector(['z'], true)}</Field>
                : block.property === 'tilt' ? <Field label="Tilt">{vector(['x', 'y'], true)}</Field>
                    : block.property === 'size' ? <Field label="Size">{vector(['x', 'y'])}</Field>
                        : block.property === 'changeText' ? <Field label="Text"><textarea aria-label="Animation text" className="animate-text" rows={3} value={settings.text ?? ''} onChange={event => patchSettings({ text: event.target.value })}/></Field>
                            : block.property === 'morph' ? <p className="animate-note">Matches the target’s position, scale, and size.</p>
                                : block.property === 'glow' ? <Field label="Glow"><div className="animate-pair"><ScrubInput label="Intensity" value={vec.x} min={-5} max={10} step={.1} onChange={x => onChange({ amount: { ...vec, x } })}/><ScrubInput label="Radius" value={vec.y * 100} min={-100} max={200} unit=" %" onChange={y => onChange({ amount: { ...vec, y: y / 100 } })}/></div></Field>
                                    : <Field label={block.property === 'counter' ? 'Count by' : block.property === 'layerBlur' ? 'Blur' : block.property === 'wiggle' ? 'Distance' : 'Amount'}>{block.property === 'counter' ? scalar('Δ', '', 1, -1000000, 1000000) : block.property === 'layerBlur' ? scalar('Blur', ' px', 100, -100, 200) : block.property === 'wiggle' ? scalar('Offset', ' px', 1920, 0, 500) : block.property === 'cornerRadius' ? scalar('Radius', ' %', 100, 0, 200) : scalar('Amount', ' %', 100, -100, 1000)}</Field>}
        <EasingField value={block.easing} onChange={easing => onChange({ easing })}/>
        <details className="animate-timing"><summary>Timing</summary><div className="animate-pair"><ScrubInput label="Start" value={block.startMs} min={0} max={Math.max(0, shot.durationMs - block.durationMs)} unit=" ms" onChange={startMs => onChange({ startMs })}/><ScrubInput label="Duration" value={block.durationMs} min={10} max={Math.max(10, shot.durationMs - block.startMs)} unit=" ms" onChange={durationMs => onChange({ durationMs })}/></div></details>
    </div>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function addLayerAnimation(shot: Shot, ids: string[], property: AnimationBlockProperty) {
    const localMs = usePlayheadStore.getState().currentTimeMs - shot.startMs;
    const next = addBlocksToShot(shot, ids, property, localMs);
    useProjectStore.getState().updateShot(shot.id, next);
    const selection = useSelectionStore.getState();
    selection.setTimelineView('scene');
    next.layers.filter(layer => ids.includes(layer.id) && !layer.locked).forEach(layer => selection.setTimelineLayerExpanded(layer.id, true));
    const first = next.layers.find(layer => ids.includes(layer.id) && !layer.locked)?.blocks.at(-1);
    if (first)
        selection.selectBlock(first.id);
}
export function LayerAnimateInspector({ activeShot, selectedLayer, selectedLayerIds }: {
    activeShot: Shot;
    selectedLayer: Layer;
    selectedLayerIds: string[];
}) {
    const updateShot = useProjectStore(state => state.updateShot);
    const selectedBlockId = useSelectionStore(state => state.selectedBlockId);
    const layers = activeShot.layers.filter(layer => selectedLayerIds.includes(layer.id));
    const editable = layers.filter(layer => !layer.locked);
    const [flyout, setFlyout] = useState<{
        kind: 'animation' | 'in' | 'out' | 'settings';
        anchor: HTMLElement;
        side?: PresetSide;
        index?: number;
    } | null>(null);
    const [submenu, setSubmenu] = useState<'Appearance' | 'Effects' | 'Morph into' | null>(null);
    const close = useCallback(() => { setFlyout(null); setSubmenu(null); }, []);
    const open = (kind: 'animation' | 'in' | 'out', anchor: HTMLElement) => { setSubmenu(null); setFlyout(old => old?.kind === kind ? null : { kind, anchor }); };
    const updateSelected = (change: (layer: Layer) => Layer) => updateShot(activeShot.id, shot => ({ ...shot, layers: shot.layers.map(layer => selectedLayerIds.includes(layer.id) && !layer.locked ? change(layer) : layer) }));
    const updatePreset = (side: PresetSide, index: number, patch: Partial<Transitionish>) => updateSelected(layer => editPreset(layer, side, index, presetList(selectedLayer, side)[index].type, patch));
    const addPreset = (side: PresetSide, type: TransitionType) => {
        updateSelected(layer => replacePresets(layer, side, [...presetList(layer, side), createPreset(type, side, Math.min(activeShot.durationMs, layer.outMs - layer.inMs))]));
        const selection = useSelectionStore.getState();
        selection.selectPreset(side === 'in' ? 'entrance' : 'exit');
        selection.setTimelineView('scene');
        editable.forEach(layer => selection.setTimelineLayerExpanded(layer.id, true));
        close();
    };
    const updateBlock = (id: string, patch: Partial<AnimationBlock>) => updateShot(activeShot.id, shot => ({ ...shot, layers: shot.layers.map(layer => layer.id === selectedLayer.id && !layer.locked ? { ...layer, blocks: layer.blocks.map(block => block.id === id ? { ...block, ...patch } : block) } : layer) }));
    const add = (property: AnimationBlockProperty) => { addLayerAnimation(activeShot, selectedLayerIds, property); close(); };
    const animations = availableAnimations(editable);
    const menuItem = (label: string, icon: ReactNode, onClick: () => void, more = false) => <button key={label} type="button" role="menuitem" onClick={onClick}>{icon}<span>{label}</span>{more && <ChevronRight className="animate-menu-chevron"/>}</button>;
    const presets = flyout?.side ? presetList(selectedLayer, flyout.side) : [];
    const preset = flyout?.index !== undefined ? presets[flyout.index] : undefined;
    return <div className="layer-animate-inspector flex-1 min-h-0 overflow-y-auto" data-testid="layer-animate-inspector">
        <section aria-label="Animations" className="animate-overview"><header><span>Animations</span><IconButton label="Add animation" disabled={!editable.length} icon={<Plus />} onClick={event => open('animation', event.currentTarget)}/></header></section>
        {(['in', 'out'] as const).map(side => <section key={side} aria-label={side === 'in' ? 'In' : 'Out'} className={`animate-overview animate-${side}`}><header><span>{side === 'in' ? 'In' : 'Out'}</span><IconButton label={`Add ${side} preset`} disabled={!editable.length} icon={<Plus />} onClick={event => open(side, event.currentTarget)}/></header>
            {presetList(selectedLayer, side).map((preset, index) => <div key={preset.id ?? `${preset.type}-${index}`} className="animate-preset-row" data-muted={preset.enabled === false}>
                <button type="button" disabled={selectedLayer.locked} className="animate-preset-pill" aria-label={`Edit ${side} ${presetLabel(preset.type)}`} aria-expanded={flyout?.kind === 'settings' && flyout.side === side && flyout.index === index} onClick={event => { const anchor = event.currentTarget; setFlyout(old => old?.kind === 'settings' && old.side === side && old.index === index ? null : { kind: 'settings', anchor, side, index }); }}><AnimationIcon property={preset.type}/><span>{presetLabel(preset.type)}</span></button>
                <IconButton label={`${preset.enabled === false ? 'Enable' : 'Disable'} ${side} ${presetLabel(preset.type)}`} disabled={selectedLayer.locked} icon={preset.enabled === false ? <EyeOff /> : <Eye />} onClick={() => updatePreset(side, index, { enabled: preset.enabled === false })}/>
                <IconButton label={`Remove ${side} ${presetLabel(preset.type)}`} disabled={selectedLayer.locked} icon={<X />} onClick={() => { updateSelected(layer => replacePresets(layer, side, presetList(layer, side).filter((item, i) => i !== index || item.type !== preset.type))); close(); }}/>
            </div>)}
        </section>)}
        {selectedLayer.blocks.map(block => <section key={block.id} aria-label={animationLabel(block.property)} className="animate-block" data-muted={block.enabled === false} data-selected={selectedBlockId === block.id}>
            <header><AnimationIcon property={block.property}/><span>{animationLabel(block.property)}</span><div className="animate-block-actions"><IconButton label={`${block.enabled === false ? 'Enable' : 'Disable'} ${animationLabel(block.property)} animation`} disabled={selectedLayer.locked} icon={block.enabled === false ? <EyeOff /> : <Eye />} onClick={() => updateBlock(block.id, { enabled: block.enabled === false })}/><IconButton label={`Remove ${animationLabel(block.property)} animation`} disabled={selectedLayer.locked} icon={<X />} onClick={() => { updateShot(activeShot.id, shot => ({ ...shot, layers: shot.layers.map(layer => layer.id === selectedLayer.id && !layer.locked ? { ...layer, blocks: layer.blocks.filter(b => b.id !== block.id) } : layer) })); if (selectedBlockId === block.id)
            useSelectionStore.getState().selectBlock(null); }}/></div></header>
            <fieldset disabled={selectedLayer.locked}><BlockSettings block={block} shot={activeShot} onChange={patch => updateBlock(block.id, patch)}/></fieldset>
        </section>)}
        {flyout && <InspectorFlyout anchor={flyout.anchor} label={flyout.kind === 'settings' ? `${flyout.side} preset settings` : flyout.kind === 'animation' ? 'Add animation' : `${flyout.kind} presets`} menu={flyout.kind !== 'settings'} onClose={close}>
            {flyout.kind === 'settings' && preset && flyout.side ? <PresetSettings preset={preset} side={flyout.side} layers={editable} maxDuration={Math.max(10, Math.min(activeShot.durationMs, ...editable.map(layer => layer.outMs - layer.inMs)))} onChange={patch => updatePreset(flyout.side!, flyout.index!, patch)}/>
                : flyout.kind === 'animation' ? <>
                {submenu ? <>{menuItem(submenu, <ChevronLeft />, () => setSubmenu(null))}<div className="animate-menu-divider"/>{submenu === 'Morph into' ? activeShot.layers.filter(layer => !selectedLayerIds.includes(layer.id)).map(target => menuItem(target.name, <AnimationIcon property="morph"/>, () => {
                            updateSelected(layer => ({ ...layer, blocks: [...layer.blocks, { ...createAnimationBlock('morph', activeShot, usePlayheadStore.getState().currentTimeMs - activeShot.startMs, layer), label: `Morph into ${target.name}`, settings: { targetPosition: target.position, targetScale: target.scale, targetSize: target.kind === 'text' ? { width: target.maxWidth, height: target.font.size * 2.5 } : target.size } }] }));
                            close();
                        })) : animations.filter(item => item.group === submenu).map(item => menuItem(item.label, <AnimationIcon property={item.property}/>, () => add(item.property)))}</>
                        : <><div className="animate-menu-label">Custom</div>{animations.filter(item => item.group === 'Custom').map(item => menuItem(item.label, <AnimationIcon property={item.property}/>, () => add(item.property)))}{activeShot.layers.some(layer => !selectedLayerIds.includes(layer.id)) && menuItem('Morph into', <Sparkles />, () => setSubmenu('Morph into'), true)}<div className="animate-menu-divider"/><div className="animate-menu-label">Appearance</div>{menuItem('Appearance', <Eye />, () => setSubmenu('Appearance'), true)}<div className="animate-menu-divider"/><div className="animate-menu-label">Effects</div>{animations.filter(item => item.group === 'Effects').map(item => menuItem(item.label, <AnimationIcon property={item.property}/>, () => add(item.property)))}</>}
            </> : <><div className="animate-menu-label">Presets</div>{availablePresets(editable).map(preset => menuItem(preset.label, <AnimationIcon property={preset.type}/>, () => addPreset(flyout.kind as PresetSide, preset.type)))}</>}
        </InspectorFlyout>}
    </div>;
}

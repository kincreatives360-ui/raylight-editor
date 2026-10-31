import { Copy, Droplet, Eye, Layers, Monitor, Plus, Spline, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BlurSettings, DropShadowEffect, Layer, LayerEffects } from '../../../model/types';
import { addLayerEffect, defaultShadow, EFFECT_STAGE, getBlurSettings, LAYER_EFFECT_NAMES, type AddableLayerEffect, type BlurEffectKey } from '../../../model/layerEffects';
import { useProjectStore } from '../../../store/useProjectStore';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
import { LayerEffectCard } from './LayerEffectCard';

type Option = readonly [string, string];
function Mode({ label, value, options, onChange }: { label: string; value: string; options: readonly Option[]; onChange: (value: string) => void }) {
    return <FigmaSelect aria-label={label} value={value} className="object-design-input w-full" onChange={e => onChange(e.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</FigmaSelect>;
}
function NumberControl({ label, value, onChange, min = 0, max = 200, unit = ' px', step = 1, ariaLabel }: { label: string; ariaLabel?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string; step?: number }) {
    return <ScrubInput label={label} aria-label={ariaLabel ?? label} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />;
}
function Percent({ label, value, onChange, max = 100, ariaLabel }: { label: string; ariaLabel?: string; value: number; onChange: (v: number) => void; max?: number }) {
    return <NumberControl label={label} ariaLabel={ariaLabel} value={value * 100} onChange={v => onChange(v / 100)} max={max} unit=" %" />;
}
function ShadowControls({ shadow, onChange }: { shadow: DropShadowEffect; onChange: (patch: Partial<DropShadowEffect>) => void }) {
    return <div className="space-y-3 pt-3">
        <Mode label="Shadow mode" value={shadow.mode ?? 'drop'} options={[["drop", "Drop"], ["inner", "Inner"], ["long", "Long"]]} onChange={mode => onChange({ mode: mode as DropShadowEffect['mode'] })} />
        {shadow.mode === 'long' && <div className="grid grid-cols-2 gap-2"><NumberControl label="Shadow length" value={shadow.length ?? 120} max={2000} onChange={length => onChange({ length })} /><NumberControl label="Shadow angle" value={shadow.angle ?? 45} min={-360} max={360} unit="°" onChange={angle => onChange({ angle })} /><Percent label="Shadow fade" value={shadow.fade ?? 0} onChange={fade => onChange({ fade })} /></div>}
        <ColorPicker showGradientMode={false} label="Shadow color" color={shadow.color} onChange={color => onChange({ color })} />
        <Percent label="Shadow opacity" value={shadow.opacity} onChange={opacity => onChange({ opacity })} />
        <div className="grid grid-cols-2 gap-2">
            <NumberControl label="Offset X" value={shadow.offsetX * EFFECT_STAGE.width} min={-1000} max={1000} onChange={v => onChange({ offsetX: v / EFFECT_STAGE.width })} />
            <NumberControl label="Offset Y" value={shadow.offsetY * EFFECT_STAGE.height} min={-1000} max={1000} onChange={v => onChange({ offsetY: v / EFFECT_STAGE.height })} />
            <NumberControl label="Shadow blur" value={shadow.blur * EFFECT_STAGE.width} onChange={v => onChange({ blur: v / EFFECT_STAGE.width })} />
            <NumberControl label="Distance" value={shadow.distance ?? 0} min={0} max={500} onChange={distance => onChange({ distance })} />
            <NumberControl label="Spread" value={shadow.spread ?? 0} min={-200} onChange={spread => onChange({ spread })} />
        </div>
    </div>;
}
function BlurControls({ effectKey, effects, onChange }: { effectKey: BlurEffectKey; effects: LayerEffects; onChange: (patch: LayerEffects) => void }) {
    const settings = getBlurSettings(effects, effectKey);
    const settingsKey = `${effectKey}Settings` as const;
    const patch = (next: Partial<BlurSettings>) => onChange({ [settingsKey]: { ...settings, ...next } });
    return <div className="space-y-3 pt-3">
        <Mode label={`${LAYER_EFFECT_NAMES[effectKey]} type`} value={settings.type ?? 'gaussian'} options={[["gaussian", "Gaussian"], ["radial", "Radial"], ["zoom", "Zoom"]]} onChange={type => patch({ type: type as BlurSettings['type'] })} />
        {(settings.type === 'radial' || settings.type === 'zoom') && <div className="grid grid-cols-2 gap-2">
            <Percent label="Center X" ariaLabel={`${LAYER_EFFECT_NAMES[effectKey]} center X`} value={settings.centerX ?? .5} onChange={centerX => patch({ centerX })} />
            <Percent label="Center Y" ariaLabel={`${LAYER_EFFECT_NAMES[effectKey]} center Y`} value={settings.centerY ?? .5} onChange={centerY => patch({ centerY })} />
        </div>}
        <Mode label={`${LAYER_EFFECT_NAMES[effectKey]} quality`} value={String(settings.quality ?? 16)} options={[["8", "Draft (8)"], ["16", "Standard (16)"], ["32", "High (32)"]]} onChange={quality => patch({ quality: Number(quality) as BlurSettings['quality'] })} />
        <Mode label={`${LAYER_EFFECT_NAMES[effectKey]} mode`} value={settings.mode} options={[["uniform", "Uniform"], ["progressive", "Progressive"]]} onChange={mode => patch({ mode: mode as BlurSettings['mode'] })} />
        {settings.mode === 'uniform' ? <NumberControl label="Blur" value={(effects[effectKey] ?? 0) * 100} onChange={v => onChange({ [effectKey]: v / 100, [settingsKey]: { ...settings, end: v } })} /> : <>
            <div className="grid grid-cols-2 gap-2"><NumberControl label="Start" value={settings.start} onChange={start => patch({ start })} /><NumberControl label="End" value={settings.end} onChange={end => patch({ end })} /></div>
            <NumberControl label="Blur angle" value={settings.angle} min={-360} max={360} unit="°" onChange={angle => patch({ angle })} />
        </>}
    </div>;
}

export function LayerEffectsSection({ activeShotId, layer }: { activeShotId: string; layer: Layer }) {
    const { updateLayer } = useProjectStore();
    const effects = layer.effects;
    const change = (edit: (current: LayerEffects) => LayerEffects) => updateLayer(activeShotId, layer.id, l => ({ ...l, effects: edit(l.effects) }));
    const patch = (next: LayerEffects) => change(current => ({ ...current, ...next }));
    const objectPatch = <K extends 'dropShadow' | 'glow' | 'liquidGlass' | 'warp' | 'screen' | 'outline' | 'colorCorrection' | 'noise' | 'bevel' | 'halftone' | 'roughen' | 'colorKey' | 'pixelate' | 'rgbSplit'>(key: K, next: Partial<NonNullable<LayerEffects[K]>>) => change(current => ({ ...current, [key]: { ...current[key], ...next } }));
    const remove = (key: AddableLayerEffect) => change(current => {
        const next = { ...current }; delete next[key];
        if (key === 'dropShadow') delete next.shadows;
        if (key === 'layerBlur' || key === 'backdropBlur') delete next[`${key}Settings`];
        return next;
    });
    const card = (key: AddableLayerEffect, icon: ReactNode, children: ReactNode) => {
        const effect = effects[key];
        const toggle = typeof effect === 'object' ? () => change(current => ({ ...current, [key]: { ...current[key] as object, enabled: !effect.enabled }, ...(key === 'dropShadow' ? { shadows: current.shadows?.map(s => ({ ...s, enabled: !effect.enabled })) } : {}) })) : undefined;
        return <LayerEffectCard title={LAYER_EFFECT_NAMES[key]} icon={icon} enabled={typeof effect === 'object' ? effect.enabled : true} onToggle={toggle} onRemove={() => remove(key)}>{children}</LayerEffectCard>;
    };
    const glow = effects.glow, glass = effects.liquidGlass, warp = effects.warp, screen = effects.screen;
    const shadows = [effects.dropShadow, ...(effects.shadows ?? [])];
    const selectWarpMode = (mode: string) => {
        if (mode !== 'turbulent') { objectPatch('warp', { mode: mode as NonNullable<LayerEffects['warp']>['mode'] }); return; }
        change(current => ({ ...current, warp: {
            ...current.warp, enabled: current.warp?.enabled ?? true, mode: 'turbulent',
            amount: current.warp?.amount ?? 30, size: current.warp?.size ?? 100,
            complexity: current.warp?.complexity ?? 3, seed: current.warp?.seed ?? 1,
            pinning: current.warp?.pinning ?? 'none', evolution: current.warp?.evolution ?? 0,
            loop: current.warp?.loop ?? false, loopDuration: current.warp?.loopDuration ?? 4,
            speed: current.warp?.speed ?? 60,
        } }));
    };
    return <section aria-label="Layer effects" className="p-3.5 space-y-3 border-t border-[var(--object-divider)]">
        <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[.04em]">Layer effects</span>
            <FigmaSelect aria-label="Add layer effect" title="Add layer effect" className="object-design-effect-add" value="" onChange={e => change(current => addLayerEffect(current, e.target.value as AddableLayerEffect))}>
                <option value="">+</option>{(Object.entries(LAYER_EFFECT_NAMES) as [AddableLayerEffect, string][]).map(([key, name]) => <option key={key} value={key} disabled={effects[key] !== undefined}>{name}</option>)}
            </FigmaSelect>
        </div>
        <div className="space-y-3">
            {effects.dropShadow && card('dropShadow', <Copy className="w-3.5 h-3.5" />, <>
                {shadows.map((shadow, index) => shadow && <div key={index} className={index ? 'pt-3 mt-3 border-t border-border' : ''}>
                    {index > 0 && <button type="button" aria-label={`Delete shadow ${index + 1}`} onClick={() => change(current => ({ ...current, shadows: current.shadows?.filter((_, i) => i !== index - 1) }))} className="text-[11px] text-rose-400 hover:text-rose-300 mb-1">Delete shadow {index + 1}</button>}
                    <ShadowControls shadow={shadow} onChange={next => index === 0 ? objectPatch('dropShadow', next) : change(current => ({ ...current, shadows: current.shadows?.map((s, i) => i === index - 1 ? { ...s, ...next } : s) }))} />
                </div>)}
                <button type="button" className="flex items-center justify-center gap-2 w-full rounded-lg border border-subtle bg-surface/50 hover:bg-subtle py-2 mt-3 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40" disabled={(effects.shadows?.length ?? 0) >= 16} onClick={() => change(current => ({ ...current, shadows: [...(current.shadows ?? []), defaultShadow()] }))}><Plus size={14} />Add shadow</button>
            </>)}
            {glow && card('glow', <Zap className="w-3.5 h-3.5" />, <div className="space-y-3 pt-3">
                <Mode label="Glow placement" value={glow.placement ?? 'outer'} options={[["outer", "Outer"], ["inner", "Inner"]]} onChange={placement => objectPatch('glow', { placement: placement as 'outer' | 'inner' })} />
                <div className="grid grid-cols-2 gap-2"><NumberControl label="Glow blur" value={glow.radius * EFFECT_STAGE.width} max={500} onChange={v => objectPatch('glow', { radius: v / EFFECT_STAGE.width })} /><Percent label="Intensity" value={glow.intensity} max={200} onChange={intensity => objectPatch('glow', { intensity })} /></div>
                <div className="grid grid-cols-2 gap-2"><NumberControl label="Glow angle" value={glow.angle ?? 106} min={-360} max={360} unit="°" onChange={angle => objectPatch('glow', { angle })} /><Percent label="Rim" value={glow.rim ?? 1} onChange={rim => objectPatch('glow', { rim })} /></div>
                <div className="grid grid-cols-2 gap-2"><Percent label="Sheen" value={glow.sheen ?? 1} onChange={sheen => objectPatch('glow', { sheen })} /><NumberControl label="Depth" value={glow.depth ?? 0} min={-200} max={200} onChange={depth => objectPatch('glow', { depth })} /></div>
                <ColorPicker showGradientMode={false} label="Glow color" color={glow.color} onChange={color => objectPatch('glow', { color })} />
                <Mode label="Glow blend" value={glow.blend ?? 'normal'} options={[["normal", "Normal"], ["add", "Add"]]} onChange={blend => objectPatch('glow', { blend: blend as typeof glow.blend })} />
            </div>)}
            {(['backdropBlur', 'layerBlur'] as const).map(key => effects[key] !== undefined && <div key={key}>{card(key, key === 'layerBlur' ? <Layers size={14} /> : <Eye size={14} />, <BlurControls effectKey={key} effects={effects} onChange={patch} />)}</div>)}
            {glass && card('liquidGlass', <Droplet size={14} />, <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2">
                    <NumberControl label="Bevel" value={glass.bevelWidth ?? 24} min={0} max={150} unit=" px" onChange={bevelWidth => objectPatch('liquidGlass', { bevelWidth })} />
                    <Percent label="Double bevel" value={glass.doubleBevel ?? .4} max={100} onChange={doubleBevel => objectPatch('liquidGlass', { doubleBevel })} />
                    <Percent label="Refract" value={glass.refraction ?? .6} max={200} onChange={refraction => objectPatch('liquidGlass', { refraction })} />
                    <NumberControl label="IOR" value={glass.ior ?? 1.52} min={1} max={2.5} step={0.01} unit="" onChange={ior => objectPatch('liquidGlass', { ior })} />
                    <Percent label="Disperse" value={glass.dispersion ?? .45} max={200} onChange={dispersion => objectPatch('liquidGlass', { dispersion })} />
                    <Percent label="Chroma boost" value={glass.chromaBoost ?? .8} max={200} onChange={chromaBoost => objectPatch('liquidGlass', { chromaBoost })} />
                    <NumberControl label="Frost" value={(glass.roughness ?? .05) * 100} max={100} unit=" %" onChange={v => objectPatch('liquidGlass', { roughness: v / 100 })} />
                    <Percent label="Shine" value={glass.shine ?? .7} max={200} onChange={shine => objectPatch('liquidGlass', { shine })} />
                    <Percent label="Fresnel" value={glass.fresnel ?? .6} onChange={fresnel => objectPatch('liquidGlass', { fresnel })} />
                    <NumberControl label="Light angle" value={glass.lightAngle ?? 45} min={-180} max={180} unit="°" onChange={lightAngle => objectPatch('liquidGlass', { lightAngle })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <ColorPicker showGradientMode={false} label="Glass tint" color={glass.tint ?? '#ffffff'} onChange={tint => objectPatch('liquidGlass', { tint })} />
                    <ColorPicker showGradientMode={false} label="Rim color" color={glass.rimColor ?? '#cce4ff'} onChange={rimColor => objectPatch('liquidGlass', { rimColor })} />
                </div>
            </div>)}
            {warp && card('warp', <Spline size={14} />, <div className="space-y-3 pt-3">
                <Mode label="Wrap mode" value={warp.mode ?? 'legacy'} options={[...(!warp.mode ? [['legacy', 'Wave (existing)'] as const] : []), ['bulge', 'Bulge'], ['ripple', 'Ripple'], ['bend', 'Bend'], ['curl', 'Curl'], ['turbulent', 'Turbulent']]} onChange={selectWarpMode} />
                {warp.mode === 'turbulent' && <div className="space-y-3">
                    <NumberControl label="Turbulent amount" value={warp.amount ?? 30} max={500} onChange={amount => objectPatch('warp', { amount })} />
                    <NumberControl label="Complexity" value={warp.complexity ?? 3} min={1} max={6} unit="" onChange={complexity => objectPatch('warp', { complexity })} />
                    <NumberControl label="Turbulent seed" value={warp.seed ?? 1} max={2147483647} unit="" onChange={seed => objectPatch('warp', { seed: Math.round(seed) })} />
                    <Mode label="Pinned edges" value={warp.pinning ?? 'none'} options={['none', 'all', 'horizontal', 'vertical', 'left', 'right', 'top', 'bottom'].map(v => [v, v] as const)} onChange={pinning => objectPatch('warp', { pinning: pinning as typeof warp.pinning })} />
                    <NumberControl label="Evolution" value={warp.evolution ?? 0} min={-3600} max={3600} unit="°" onChange={evolution => objectPatch('warp', { evolution })} />
                    {!warp.loop && <NumberControl label="Evolution speed" value={warp.speed ?? 60} min={-360} max={360} unit="°/s" onChange={speed => objectPatch('warp', { speed })} />}
                    <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Loop<input type="checkbox" checked={warp.loop ?? false} onChange={e => objectPatch('warp', { loop: e.target.checked })} /></label>
                    <NumberControl label="Loop duration" value={warp.loopDuration ?? 4} min={.1} max={60} step={.1} unit=" s" onChange={loopDuration => objectPatch('warp', { loopDuration })} />
                </div>}
                {warp.mode ? <><div className="grid grid-cols-2 gap-2">{warp.mode !== 'turbulent' && <NumberControl label="Strength" value={(warp.strength ?? .5) * 100} min={-200} max={200} unit=" %" onChange={v => objectPatch('warp', { strength: v / 100 })} />}<NumberControl label="Size" value={warp.size ?? (warp.mode === 'turbulent' ? 100 : 183)} min={1} max={2000} onChange={size => objectPatch('warp', { size })} /><NumberControl label="Center X" value={warp.centerX ?? 0} min={-1920} max={1920} onChange={centerX => objectPatch('warp', { centerX })} /><NumberControl label="Center Y" value={warp.centerY ?? 0} min={-1080} max={1080} onChange={centerY => objectPatch('warp', { centerY })} /></div>
                {warp.mode === 'ripple' ? <div className="grid grid-cols-2 gap-2"><NumberControl label="Ripple width" value={warp.width ?? 61} min={1} max={2000} onChange={width => objectPatch('warp', { width })} /><Percent label="Travel" value={warp.travel ?? .5} onChange={travel => objectPatch('warp', { travel })} /></div> : (warp.mode === 'bend' || warp.mode === 'curl') && <NumberControl label="Wrap angle" value={warp.angle ?? 0} min={-360} max={360} unit="°" onChange={angle => objectPatch('warp', { angle })} />}</> : <div className="grid grid-cols-2 gap-2"><NumberControl label="Amount" value={warp.amount ?? 10} onChange={amount => objectPatch('warp', { amount })} /><NumberControl label="Frequency" value={warp.frequency ?? 1} min={1} max={10} unit="" onChange={frequency => objectPatch('warp', { frequency })} /></div>}
            </div>)}
            {effects.outline && card('outline', <Layers size={14} />, <div className="space-y-3 pt-3">
                <NumberControl label="Width" ariaLabel="Alpha outline width" value={effects.outline.width} min={0} max={200} step={0.1} unit=" px" onChange={value => objectPatch('outline', { width: value })} />
                <Mode label="Alpha outline placement" value={effects.outline.placement} options={[["inside","Inside"],["outside","Outside"]]} onChange={value => objectPatch('outline', { placement: value as typeof effects.outline.placement })} />
                <ColorPicker showGradientMode={false} label="Alpha outline color" color={effects.outline.color} onChange={value => objectPatch('outline', { color: value })} />
                <Percent label="Opacity" ariaLabel="Alpha outline opacity" value={effects.outline.opacity} onChange={value => objectPatch('outline', { opacity: value })} />
                <NumberControl label="Softness" ariaLabel="Alpha outline softness" value={effects.outline.softness} min={0} max={200} step={0.1} unit=" px" onChange={value => objectPatch('outline', { softness: value })} />
            </div>)}
            {effects.colorCorrection && card('colorCorrection', <Layers size={14} />, <div className="space-y-3 pt-3">
                <NumberControl label="Exposure" ariaLabel="Color correction exposure" value={effects.colorCorrection.exposure} min={-5} max={5} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { exposure: value })} />
                <NumberControl label="Contrast" ariaLabel="Color correction contrast" value={effects.colorCorrection.contrast} min={0} max={3} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { contrast: value })} />
                <NumberControl label="Saturation" ariaLabel="Color correction saturation" value={effects.colorCorrection.saturation} min={0} max={3} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { saturation: value })} />
                <NumberControl label="Temperature" ariaLabel="Color correction temperature" value={effects.colorCorrection.temperature} min={-1} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { temperature: value })} />
                <NumberControl label="Tint" ariaLabel="Color correction tint" value={effects.colorCorrection.tint} min={-1} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { tint: value })} />
                <NumberControl label="Black point" ariaLabel="Color correction black point" value={effects.colorCorrection.blackPoint} min={0} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { blackPoint: value })} />
                <NumberControl label="White point" ariaLabel="Color correction white point" value={effects.colorCorrection.whitePoint} min={0} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { whitePoint: value })} />
                <NumberControl label="Gamma" ariaLabel="Color correction gamma" value={effects.colorCorrection.gamma} min={0.1} max={4} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { gamma: value })} />
                <NumberControl label="Curve shadows" ariaLabel="Color correction curve shadows" value={effects.colorCorrection.curveShadows} min={-1} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { curveShadows: value })} />
                <NumberControl label="Curve midtones" ariaLabel="Color correction curve midtones" value={effects.colorCorrection.curveMidtones} min={-1} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { curveMidtones: value })} />
                <NumberControl label="Curve highlights" ariaLabel="Color correction curve highlights" value={effects.colorCorrection.curveHighlights} min={-1} max={1} step={0.1} unit="" onChange={value => objectPatch('colorCorrection', { curveHighlights: value })} />
            </div>)}
            {effects.noise && card('noise', <Layers size={14} />, <div className="space-y-3 pt-3">
                <Percent label="Amount" ariaLabel="Noise amount" value={effects.noise.amount} onChange={value => objectPatch('noise', { amount: value })} />
                <NumberControl label="Scale" ariaLabel="Noise scale" value={effects.noise.scale} min={0.5} max={100} step={0.1} unit=" px" onChange={value => objectPatch('noise', { scale: value })} />
                <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Noise monochrome<input aria-label="Noise monochrome" type="checkbox" checked={effects.noise.monochrome} onChange={e => objectPatch('noise', { monochrome: e.target.checked })} /></label>
                <Percent label="Density" ariaLabel="Noise density" value={effects.noise.density} onChange={value => objectPatch('noise', { density: value })} />
                <NumberControl label="Seed" ariaLabel="Noise seed" value={effects.noise.seed} min={0} max={2147483647} step={1} unit="" onChange={value => objectPatch('noise', { seed: Math.round(value) })} />
                <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Noise animated<input aria-label="Noise animated" type="checkbox" checked={effects.noise.animated} onChange={e => objectPatch('noise', { animated: e.target.checked })} /></label>
                <NumberControl label="Speed" ariaLabel="Noise speed" value={effects.noise.speed} min={0} max={20} step={0.1} unit=" /s" onChange={value => objectPatch('noise', { speed: value })} />
            </div>)}
            {effects.rgbSplit && card('rgbSplit', <Layers size={14} />, <div className="space-y-3 pt-3">
                <Mode label="RGB split mode" value={effects.rgbSplit.mode} options={[["linear", "Linear"], ["radial", "Radial"]]} onChange={mode => objectPatch('rgbSplit', { mode: mode as NonNullable<LayerEffects['rgbSplit']>['mode'] })} />
                <NumberControl label="Amount" ariaLabel="RGB split amount" value={effects.rgbSplit.amount} max={200} onChange={amount => objectPatch('rgbSplit', { amount })} />
                {effects.rgbSplit.mode === 'linear' ? <NumberControl label="Angle" ariaLabel="RGB split angle" value={effects.rgbSplit.angle} min={-360} max={360} unit="°" onChange={angle => objectPatch('rgbSplit', { angle })} /> : <div className="grid grid-cols-2 gap-2">
                    <Percent label="Center X" ariaLabel="RGB split center X" value={effects.rgbSplit.centerX} onChange={centerX => objectPatch('rgbSplit', { centerX })} />
                    <Percent label="Center Y" ariaLabel="RGB split center Y" value={effects.rgbSplit.centerY} onChange={centerY => objectPatch('rgbSplit', { centerY })} />
                </div>}
                <div className="grid grid-cols-3 gap-2">{(['red', 'green', 'blue'] as const).map(channel => <NumberControl key={channel} label={channel[0].toUpperCase() + channel.slice(1)} ariaLabel={'RGB split ' + channel} value={effects.rgbSplit![channel]} min={-2} max={2} step={.1} unit="×" onChange={value => objectPatch('rgbSplit', { [channel]: value })} />)}</div>
            </div>)}
            {effects.bevel && card('bevel', <Layers size={14} />, <div className="space-y-3 pt-3">
                <NumberControl label="Softness" ariaLabel="Bevel and emboss softness" value={effects.bevel.softness ?? effects.bevel.thickness * .35} onChange={softness => objectPatch('bevel', { softness })} />
                <NumberControl label="Thickness" ariaLabel="Bevel and emboss thickness" value={effects.bevel.thickness} min={0} max={200} step={0.1} unit=" px" onChange={value => objectPatch('bevel', { thickness: value })} />
                <NumberControl label="Depth" ariaLabel="Bevel and emboss depth" value={effects.bevel.depth} min={-200} max={200} step={0.1} unit=" px" onChange={value => objectPatch('bevel', { depth: value })} />
                <NumberControl label="Angle" ariaLabel="Bevel and emboss angle" value={effects.bevel.angle} min={-3600} max={3600} step={0.1} unit="°" onChange={value => objectPatch('bevel', { angle: value })} />
                <ColorPicker showGradientMode={false} label="Bevel and emboss highlight color" color={effects.bevel.highlightColor} onChange={value => objectPatch('bevel', { highlightColor: value })} />
                <ColorPicker showGradientMode={false} label="Bevel and emboss shadow color" color={effects.bevel.shadowColor} onChange={value => objectPatch('bevel', { shadowColor: value })} />
                <Percent label="Intensity" ariaLabel="Bevel and emboss intensity" value={effects.bevel.intensity} onChange={value => objectPatch('bevel', { intensity: value })} />
            </div>)}
            {effects.halftone && card('halftone', <Layers size={14} />, <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2"><NumberControl label="Offset X" ariaLabel="Halftone offset X" value={effects.halftone.offsetX ?? 0} min={-2000} max={2000} onChange={offsetX => objectPatch('halftone', { offsetX })} /><NumberControl label="Offset Y" ariaLabel="Halftone offset Y" value={effects.halftone.offsetY ?? 0} min={-2000} max={2000} onChange={offsetY => objectPatch('halftone', { offsetY })} /></div>
                <NumberControl label="Contrast" ariaLabel="Halftone contrast" value={effects.halftone.contrast ?? 1} min={.1} max={4} step={.1} unit="×" onChange={contrast => objectPatch('halftone', { contrast })} />
                <NumberControl label="Dot size" ariaLabel="Halftone dot size" value={effects.halftone.dotSize} min={0.5} max={200} step={0.1} unit=" px" onChange={value => objectPatch('halftone', { dotSize: value })} />
                <NumberControl label="Spacing" ariaLabel="Halftone spacing" value={effects.halftone.spacing} min={0.5} max={200} step={0.1} unit=" px" onChange={value => objectPatch('halftone', { spacing: value })} />
                <NumberControl label="Angle" ariaLabel="Halftone angle" value={effects.halftone.angle} min={-3600} max={3600} step={0.1} unit="°" onChange={value => objectPatch('halftone', { angle: value })} />
                <Mode label="Halftone shape" value={effects.halftone.shape} options={[["circle","Circle"],["square","Square"],["line","Line"]]} onChange={value => objectPatch('halftone', { shape: value as typeof effects.halftone.shape })} />
                <ColorPicker showGradientMode={false} label="Halftone foreground" color={effects.halftone.foreground} onChange={value => objectPatch('halftone', { foreground: value })} />
                <ColorPicker showGradientMode={false} label="Halftone background" color={effects.halftone.background} onChange={value => objectPatch('halftone', { background: value })} />
                <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Halftone source color<input aria-label="Halftone source color" type="checkbox" checked={effects.halftone.sourceColor} onChange={e => objectPatch('halftone', { sourceColor: e.target.checked })} /></label>
                <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Halftone invert<input aria-label="Halftone invert" type="checkbox" checked={effects.halftone.invert} onChange={e => objectPatch('halftone', { invert: e.target.checked })} /></label>
            </div>)}
            {effects.roughen && card('roughen', <Layers size={14} />, <div className="space-y-3 pt-3">
                <NumberControl label="Border" ariaLabel="Roughen edges border" value={effects.roughen.border} min={0} max={200} step={0.1} unit=" px" onChange={value => objectPatch('roughen', { border: value })} />
                <NumberControl label="Scale" ariaLabel="Roughen edges scale" value={effects.roughen.scale} min={0.5} max={100} step={0.1} unit=" px" onChange={value => objectPatch('roughen', { scale: value })} />
                <Percent label="Sharpness" ariaLabel="Roughen edges sharpness" value={effects.roughen.sharpness} onChange={value => objectPatch('roughen', { sharpness: value })} />
                <Percent label="Amount" ariaLabel="Roughen edges amount" value={effects.roughen.amount} onChange={value => objectPatch('roughen', { amount: value })} />
                <NumberControl label="Seed" ariaLabel="Roughen edges seed" value={effects.roughen.seed} min={0} max={2147483647} step={1} unit="" onChange={value => objectPatch('roughen', { seed: Math.round(value) })} />
                <NumberControl label="Evolution" ariaLabel="Roughen edges evolution" value={effects.roughen.evolution} min={-3600} max={3600} step={0.1} unit="°" onChange={value => objectPatch('roughen', { evolution: value })} />
                <NumberControl label="Speed" ariaLabel="Roughen edges speed" value={effects.roughen.speed} min={-360} max={360} step={0.1} unit=" /s" onChange={value => objectPatch('roughen', { speed: value })} />
            </div>)}
            {effects.colorKey && card('colorKey', <Layers size={14} />, <div className="space-y-3 pt-3">
                <ColorPicker showGradientMode={false} label="Color key color" color={effects.colorKey.color} onChange={value => objectPatch('colorKey', { color: value })} />
                <Percent label="Similarity" ariaLabel="Color key similarity" value={effects.colorKey.similarity} onChange={value => objectPatch('colorKey', { similarity: value })} />
                <Percent label="Softness" ariaLabel="Color key softness" value={effects.colorKey.softness} onChange={value => objectPatch('colorKey', { softness: value })} />
                <Percent label="Spill" ariaLabel="Color key spill" value={effects.colorKey.spill} onChange={value => objectPatch('colorKey', { spill: value })} />
                <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Color key invert<input aria-label="Color key invert" type="checkbox" checked={effects.colorKey.invert} onChange={e => objectPatch('colorKey', { invert: e.target.checked })} /></label>
            </div>)}
            {effects.pixelate && card('pixelate', <Layers size={14} />, <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2"><NumberControl label="Offset X" ariaLabel="Pixelate offset X" value={effects.pixelate.offsetX ?? 0} min={-2000} max={2000} onChange={offsetX => objectPatch('pixelate', { offsetX })} /><NumberControl label="Offset Y" ariaLabel="Pixelate offset Y" value={effects.pixelate.offsetY ?? 0} min={-2000} max={2000} onChange={offsetY => objectPatch('pixelate', { offsetY })} /></div>
                <NumberControl label="Block size" ariaLabel="Pixelate block size" value={effects.pixelate.blockSize} min={1} max={500} step={0.1} unit=" px" onChange={value => objectPatch('pixelate', { blockSize: value })} />
                <NumberControl label="Aspect" ariaLabel="Pixelate aspect" value={effects.pixelate.aspect} min={0.1} max={10} step={0.1} unit="" onChange={value => objectPatch('pixelate', { aspect: value })} />
                <Mode label="Pixelate mode" value={effects.pixelate.mode} options={[["uniform","Uniform"],["progressive","Progressive"]]} onChange={value => objectPatch('pixelate', { mode: value as typeof effects.pixelate.mode })} />
                <NumberControl label="Start" ariaLabel="Pixelate start" value={effects.pixelate.start} min={1} max={500} step={0.1} unit=" px" onChange={value => objectPatch('pixelate', { start: value })} />
                <NumberControl label="End" ariaLabel="Pixelate end" value={effects.pixelate.end} min={1} max={500} step={0.1} unit=" px" onChange={value => objectPatch('pixelate', { end: value })} />
                <NumberControl label="Angle" ariaLabel="Pixelate angle" value={effects.pixelate.angle} min={-3600} max={3600} step={0.1} unit="°" onChange={value => objectPatch('pixelate', { angle: value })} />
            </div>)}
            {screen && card('screen', <Monitor size={14} />, <div className="space-y-3 pt-3">
                <Mode label="Screen type" value={screen.mode} options={[["lcd", "LCD"], ["oled", "OLED"], ["crt", "CRT"], ["led", "LED"]]} onChange={mode => objectPatch('screen', { mode: mode as typeof screen.mode })} />
                <div className="grid grid-cols-2 gap-2"><NumberControl label="Pixel" value={screen.pixelSize} min={.5} max={100} step={.1} onChange={pixelSize => objectPatch('screen', { pixelSize })} />
                    {(['grid', 'moire', 'bands'] as const).map(key => <Percent key={key} label={key === 'moire' ? 'Moiré' : key === 'grid' ? 'Grid' : 'Bands'} value={screen[key]} onChange={v => objectPatch('screen', { [key]: v })} />)}
                </div>
                <details><summary className="text-xs text-muted-foreground cursor-pointer py-2">Camera</summary><div className="grid grid-cols-2 gap-2 pt-2">
                    {(['focus', 'glow', 'flicker', 'offAxis'] as const).map(key => <Percent key={key} label={key === 'offAxis' ? 'Off-axis' : key[0].toUpperCase() + key.slice(1)} value={screen[key]} max={key === 'glow' ? 200 : 100} onChange={v => objectPatch('screen', { [key]: v })} />)}
                    <NumberControl label="Speed" value={screen.speed} max={20} step={.1} unit=" /s" onChange={speed => objectPatch('screen', { speed })} />
                </div></details>
                <label className="flex items-center justify-between text-[11px] text-muted-foreground py-0.5 cursor-pointer hover:text-foreground transition">Snap to pixels<input type="checkbox" checked={screen.snapToPixels} onChange={e => objectPatch('screen', { snapToPixels: e.target.checked })} className="accent-primary" /></label>
            </div>)}
        </div>
    </section>;
}

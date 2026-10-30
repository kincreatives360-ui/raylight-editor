import { MenuSurface, MenuItem } from '../../../ui/Menu';
import { IconButton } from '../../../ui/primitives';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { useState, useMemo } from 'react';
import type { Shot, EffectKey } from '../../../model/types';
import type { GradientStop } from '../../../model/types';
import { DEFAULT_EFFECTS_ORDER, DEFAULT_SCENE_EFFECTS } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import {
  Aperture,
  Sun,
  Triangle,
  Circle,
  Film,
  Move,
  Copy,
  SlidersHorizontal,
  Square,
  Zap,
  Sparkles,
  Plus,
  Minus,
  Eye,
  EyeOff,
  ChevronDown,
  Waves,
  Image as ImageIcon,
  Fish,
  ScanSearch,
  Settings2,
  X,
} from 'lucide-react';
import { ColorPicker } from '../ColorPicker';

const EFFECT_NAMES: Record<EffectKey, string> = {
  depthOfField: 'Depth of field',
  bloom: 'Bloom',
  chromaticAberration: 'Color split',
  vignette: 'Vignette',
  filmGrain: 'Film grain',
  motionBlur: 'Motion blur',
  ghost: 'Ghost',
  colorGrade: 'Color grade',
  edgeFade: 'Edge fade',
  glitch: 'Glitch',
  atmosphere: 'Atmosphere',
  gradientMap: 'Gradient map',
  fishEye: 'Fish eye',
  lensDistortion: 'Lens distortion',
};

function EffectIcon({ effectKey, className = 'w-3.5 h-3.5' }: { effectKey: EffectKey; className?: string }) {
  switch (effectKey) {
    case 'depthOfField':
      return <Aperture className={className} />;
    case 'bloom':
      return <Sun className={className} />;
    case 'chromaticAberration':
      return <Triangle className={className} />;
    case 'vignette':
      return <Circle className={className} />;
    case 'filmGrain':
      return <Film className={className} />;
    case 'motionBlur':
      return <Move className={className} />;
    case 'ghost':
      return <Copy className={className} />;
    case 'colorGrade':
      return <SlidersHorizontal className={className} />;
    case 'edgeFade':
      return <Square className={className} />;
    case 'glitch':
      return <Zap className={className} />;
    case 'atmosphere': return <Waves className={className} />;
    case 'gradientMap': return <ImageIcon className={className} />;
    case 'fishEye': return <Fish className={className} />;
    case 'lensDistortion': return <ScanSearch className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const SETTINGS_FIELDS: Partial<Record<EffectKey, string[]>> = {
  depthOfField: ['sceneSize', 'highlightThreshold', 'highlightIntensity'],
  chromaticAberration: ['edgeStrength', 'centerX', 'centerY', 'channelRed', 'channelGreen', 'channelBlue', 'fringeColorAngle'],
  filmGrain: ['softness', 'colorAmount', 'aspect', 'seed', 'shadowStrength', 'midStrength', 'highlightStrength', 'midpoint', 'blendMode', 'motion'],
  lensDistortion: ['centerX', 'centerY', 'edgeMode', 'measure'],
};

const FIELD_RANGES: Record<string, [number, number, number]> = {
  aperture: [0.1, 32, 0.1], focalLength: [10, 300, 1], focusRange: [0, 20, 0.01], bokehScale: [0, 20, 0.01],
  intensity: [0, 1, 0.01], threshold: [0, 4, 0.01], radius: [0, 4, 0.01], softness: [0, 1, 0.01],
  shutterAngle: [0, 360, 1], samples: [2, 32, 1], angle: [-180, 180, 1], amount: [-1, 1, 0.01],
  offset: [0, 100, 1], verticalOffset: [-100, 100, 1], edgeStrength: [0, 4, 0.01], size: [0.1, 32, 0.01],
  opacity: [0, 1, 0.01], blur: [0, 100, 0.1], spread: [0, 4, 0.01], exposure: [-4, 4, 0.01], contrast: [0, 4, 0.01],
  saturation: [0, 4, 0.01], temperature: [-4, 4, 0.01], tint: [-4, 4, 0.01], highlights: [-1, 1, 0.01], shadows: [-1, 1, 0.01],
  lift: [-1, 1, 0.01], gamma: [0.1, 4, 0.01], vibrance: [-1, 1, 0.01], blackPoint: [0, 1, 0.01], whitePoint: [0, 1, 0.01],
  top: [0, 1, 0.01], bottom: [0, 1, 0.01], left: [0, 1, 0.01], right: [0, 1, 0.01], bandSize: [2, 200, 1], colorShift: [0, 2, 0.01],
  fog: [0, 1, 0.01], mist: [0, 1, 0.01], haze: [0, 1, 0.01], start: [0, 1, 0.01], reach: [0.01, 1, 0.01], mistHeight: [0, 1, 0.01],
  blend: [0, 1, 0.01], shift: [-1, 1, 0.01], scale: [0.1, 2, 0.01], strength: [-1, 1, 0.01], centerX: [-1, 1, 0.01], centerY: [-1, 1, 0.01],
  aspect: [0.25, 4, 0.01], seed: [0, 100000, 1], shadowStrength: [0, 1, 0.01], midStrength: [0, 1, 0.01], highlightStrength: [0, 1, 0.01], midpoint: [0, 1, 0.01],
  colorAmount: [0, 1, 0.01], sceneSize: [1, 200, 0.1], highlightThreshold: [0, 1, 0.01], highlightIntensity: [0, 2, 0.01],
  x: [-20,20,.01], y: [-20,20,.01], channelRed: [-2,2,.01], channelGreen: [-2,2,.01], channelBlue: [-2,2,.01], fringeColorAngle: [-180,180,1],
};

const SELECT_OPTIONS: Partial<Record<EffectKey, Record<string, string[]>>> = {
  depthOfField: { focusMode: ['point', 'subject'], bokehShape: ['spherical', 'anamorphic', 'vintage', 'portrait'] },
  bloom: { blendMode: ['screen', 'add', 'softLight'] },
  motionBlur: { direction: ['camera', 'angle'] },
  filmGrain: { stock: ['Tungsten 500', 'Kodak 5219', 'Fuji 400', 'Custom'], blendMode: ['film', 'overlay', 'softLight', 'multiply'], motion: ['frame', '12fps', 'static'] },
  glitch: { mode: ['digital', 'analog', 'datamosh'] },
  gradientMap: { blendMode: ['normal', 'multiply', 'screen', 'overlay', 'softLight', 'hardLight', 'difference', 'exclusion', 'lighten', 'darken', 'colorDodge', 'colorBurn'] },
  fishEye: { edgeMode: ['fill', 'balanced', 'none'] },
  lensDistortion: { mode: ['pinch', 'barrel'], edgeMode: ['fill', 'balanced', 'none'], measure: ['width', 'height', 'diagonal'] },
};

export function SceneEffectsSection({ shot }: { shot: Shot }) {
  const updateShot = useProjectStore((s) => s.updateShot);
  const focusModeActive = useSelectionStore((s) => s.dofFocusActive);
  const setDofFocusActive = useSelectionStore((s) => s.setDofFocusActive);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<EffectKey | null>(null);
  const [settingsKey, setSettingsKey] = useState<EffectKey | null>(null);

  const order = useMemo(
    () => [...new Set([...(shot.effectsOrder || []), ...DEFAULT_EFFECTS_ORDER])],
    [shot.effectsOrder]
  );

  // Applied effects list (Figma style)
  const appliedKeys = useMemo<EffectKey[]>(() => {
    if (shot.appliedEffects && shot.appliedEffects.length > 0) {
      return shot.appliedEffects;
    }
    // Fall back to any enabled effects in shot
    const enabled = order.filter((k) => Boolean(shot.effects?.[k]?.enabled));
    return enabled;
  }, [shot.appliedEffects, shot.effects, order]);

  const setValue = (key: EffectKey, field: string, value: number | string | boolean | GradientStop[]) => {
    updateShot(shot.id, (s) => ({
      ...s,
      effects: {
        ...s.effects,
        [key]: {
          ...(s.effects?.[key] || {}),
          [field]: value,
        },
      },
    }));
  };

  const addEffect = (key: EffectKey) => {
    const current = shot.appliedEffects ?? order.filter((k) => shot.effects?.[k]?.enabled);
    const next = current.includes(key) ? current : [...current, key];
    updateShot(shot.id, (s) => ({
      ...s,
      appliedEffects: next,
      effects: {
        ...s.effects,
        [key]: {
          ...(s.effects?.[key] || DEFAULT_SCENE_EFFECTS[key]),
          enabled: true,
        },
      },
    }));
    setExpandedKey(key);
    setSettingsKey(null);
    setAddMenuOpen(false);
  };

  const removeEffect = (key: EffectKey) => {
    const current = shot.appliedEffects ?? order.filter((k) => shot.effects?.[k]?.enabled);
    const next = current.filter((k) => k !== key);
    updateShot(shot.id, (s) => ({
      ...s,
      appliedEffects: next,
      effects: {
        ...s.effects,
        [key]: {
          ...(s.effects?.[key] || {}),
          enabled: false,
        },
      },
    }));
    if (expandedKey === key) setExpandedKey(null);
  };

  const renderNumber = (key: EffectKey, field: string, rawValue: number) => {
    const percentFields = new Set(['intensity', 'threshold', 'softness', 'fog', 'mist', 'haze', 'start', 'reach', 'mistHeight', 'blend', 'amount', 'colorAmount', 'shadowStrength', 'midStrength', 'highlightStrength', 'midpoint', 'highlightThreshold', 'highlightIntensity', 'top', 'bottom', 'left', 'right']);
    const scaledPixels = (key === 'chromaticAberration' && ['offset', 'verticalOffset'].includes(field)) || (key === 'ghost' && field === 'offset');
    const scale = scaledPixels ? 1920 : key === 'lensDistortion' && field === 'strength' ? 90 : key === 'fishEye' && field === 'amount' || percentFields.has(field) ? 100 : 1;
    let [min, max] = FIELD_RANGES[field] ?? [0, 1, 0.01];
    const step = FIELD_RANGES[field]?.[2] ?? 0.01;
    if (key === 'bloom' && field === 'threshold') [min, max] = [0, 100];
    if (field === 'intensity' && key === 'bloom') max=100;
    if (key === 'motionBlur' && field === 'amount') [min,max]=[0,10];
    if (key === 'lensDistortion' && field === 'strength') [min,max]=[-90,90];
    const fieldLabel=key==='chromaticAberration'&&field==='edgeStrength'?'Edges':label(field);
    return <ScrubInput key={field} label={fieldLabel} value={rawValue*scale} min={min} max={max} step={step} unit={scale===100?' %':scaledPixels?' px':key==='lensDistortion'&&field==='strength'?'°':['angle','shutterAngle','fringeColorAngle'].includes(field)?'°':field==='aperture'?' f':field==='sceneSize'?' cm':''} onChange={value=>setValue(key,field,value/scale)} />;
  };

  const renderSelect = (key: EffectKey, field: string, value: string) => {
    const options=SELECT_OPTIONS[key]?.[field];
    if(!options) return null;
    return <div key={field} className="flex flex-col gap-1"><label className="text-[10px] text-muted-foreground font-medium">{label(field)}</label><FigmaSelect aria-label={label(field)} className="w-full h-8 px-2 rounded-lg bg-[#18181b] border border-white/[0.08] text-[11px] text-white outline-none focus:border-white/20 cursor-pointer" value={value} onChange={event=>setValue(key,field,event.target.value)}>{options.map(option=><option key={option} value={option}>{option}</option>)}</FigmaSelect></div>;
  };


  return (
    <section className="space-y-2.5" aria-label="Scene effects" data-testid="scene-effects-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[12px] font-semibold text-white tracking-wide">Scene effects</h3>
          <span
            title="Shader post-processing passes evaluated in visual order. Use (+) to add effects."
            className="w-3.5 h-3.5 rounded-full bg-white/10 hover:bg-white/20 text-[#a1a1aa] hover:text-white flex items-center justify-center text-[10px] cursor-help transition"
          >
            ?
          </span>
        </div>
        <div className="flex items-center gap-1 relative">
          <IconButton
              unstyled
              tooltip={false}
              label="Add scene effect"
              icon={<>
                <Plus className="w-3.5 h-3.5" />
              </>}
              title="Add scene effect"
              onClick={() => setAddMenuOpen((v) => !v)}
              className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                addMenuOpen ? 'bg-white/20 text-white' : 'text-[#8e8e93] hover:text-white hover:bg-white/10'
              }`}
          />

          {/* Add Effect Flyout Menu */}
          {addMenuOpen && (
            <MenuSurface
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#18181b]/85 backdrop-blur-xl saturate-180 border border-white/15 p-1 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] z-30 space-y-0.5 origin-top-right"
            >
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Add Effect
              </div>
              {order.map((key) => {
                const isAlreadyAdded = appliedKeys.includes(key);
                return (
                  <MenuItem
                      unstyled
                      key={key}
                      type="button"
                      onClick={() => addEffect(key)}
                      className="w-full h-7 px-2 rounded-lg flex items-center gap-2 hover:bg-white/10 text-left transition cursor-pointer group"
                  >
                    <div className="text-[#a1a1aa] group-hover:text-white">
                      <EffectIcon effectKey={key} className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] text-white flex-1">{EFFECT_NAMES[key]}</span>
                    {isAlreadyAdded && (
                      <span className="text-[10px] text-muted-foreground font-medium">Added</span>
                    )}
                  </MenuItem>
                );
              })}
            </MenuSurface>
          )}
        </div>
      </div>

      {/* Applied Effects List (Figma Style) */}
      <div className="space-y-1.5">
        {
          appliedKeys.map((key) => {
            const effect = shot.effects?.[key] || { enabled: false };
            const mergedFields = { ...DEFAULT_SCENE_EFFECTS[key], ...effect } as Record<string, unknown>;
            const isExpanded = expandedKey === key;
            const isEnabled = Boolean(effect.enabled);

            return (
              <div key={key} className="space-y-1">
                {/* Effect Row Matching Mockup */}
                <div className="flex items-center gap-1.5">
                  {/* Left Icon Badge */}
                  <div
                    className="w-7 h-7 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-center text-[#a1a1aa] shrink-0"
                    title={EFFECT_NAMES[key]}
                  >
                    <EffectIcon effectKey={key} className="w-3.5 h-3.5" />
                  </div>

                  {/* Center Pill Button */}
                  <button type="button"  onClick={() => setExpandedKey(isExpanded ? null : key)} className={`flex-1 h-7 px-3 rounded-full border border-white/[0.08] flex items-center justify-between text-[11px] transition cursor-pointer ${
                      isExpanded
                        ? 'bg-surface text-foreground hover:bg-surface-active text-white shadow-xs border-white/20'
                        : 'bg-[#18181b] hover:bg-surface text-foreground hover:bg-surface-active text-white'
                    }`}>
                    <span className="font-medium truncate">{EFFECT_NAMES[key]}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-muted-foreground transition-transform ${
                        isExpanded ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>

                  {/* Visibility Eye Button */}
                  <IconButton
                      unstyled
                      tooltip={false}
                      label={isEnabled ? 'Mute effect' : 'Enable effect'}
                      icon={<>
                        {isEnabled ? (
                          <Eye className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </>}
                      onClick={() => setValue(key, 'enabled', !isEnabled)}
                      title={isEnabled ? 'Mute effect' : 'Enable effect'}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        isEnabled
                          ? 'text-white hover:bg-white/10'
                          : 'text-muted-foreground hover:text-white hover:bg-white/10'
                      }`}
                  />

                  {/* Minus (Remove) Button */}
                  <IconButton
                      unstyled
                      tooltip={false}
                      label={`Remove ${EFFECT_NAMES[key]}`}
                      icon={<>
                        <Minus className="w-3.5 h-3.5" />
                      </>}
                      onClick={() => removeEffect(key)}
                      title={`Remove ${EFFECT_NAMES[key]}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  />
                </div>

                {/* Expanded Parameter Inputs Card */}
                {isExpanded && (
                  <div className="relative p-2.5 rounded-xl bg-surface-elevated border border-border/60 space-y-2 mt-1">
                    {['chromaticAberration'].includes(key) && <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1"><button type="button" onClick={()=>setValue(key,'mode','lens')} className={`h-7 rounded-md text-[11px] ${mergedFields['mode']==='lens'?'bg-muted text-foreground text-white':'text-muted-foreground'}`}>Lens</button><button type="button" onClick={()=>setValue(key,'mode','split')} className={`h-7 rounded-md text-[11px] ${mergedFields['mode']==='split'?'bg-muted text-foreground text-white':'text-muted-foreground'}`}>Split</button></div>}
                    {key === 'lensDistortion' && <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1"><button type="button" onClick={()=>setValue(key,'mode','pinch')} className={`h-7 rounded-md text-[11px] ${mergedFields['mode']==='pinch'?'bg-muted text-foreground text-white':'text-muted-foreground'}`}>Pinch</button><button type="button" onClick={()=>setValue(key,'mode','barrel')} className={`h-7 rounded-md text-[11px] ${mergedFields['mode']==='barrel'?'bg-muted text-foreground text-white':'text-muted-foreground'}`}>Barrel</button></div>}
                    {['depthOfField','chromaticAberration','filmGrain','lensDistortion'].includes(key) && <div className="flex justify-end"><button type="button" aria-label={`${key==='depthOfField'?'Blur':key==='chromaticAberration'?'Fringe':key==='filmGrain'?'Grain':'Lens'} settings`} title="Settings" onClick={()=>setSettingsKey(settingsKey===key?null:key)} className={`w-7 h-7 rounded-md flex items-center justify-center ${settingsKey===key?'bg-sky-500 text-white':'text-muted-foreground hover:bg-white/10 hover:text-white'}`}><Settings2 className="w-3.5 h-3.5"/></button></div>}
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(mergedFields)
                        .filter(([field, value]) => field !== 'enabled' && typeof value === 'number' && !(SETTINGS_FIELDS[key]??[]).includes(field) && !(key==='atmosphere'&&['start','reach','mistHeight'].includes(field)))
                        .map(([field, rawVal]) => renderNumber(key,field,Number(rawVal)))}
                      {Object.entries(mergedFields).filter(([field,value])=>typeof value==='string'&&SELECT_OPTIONS[key]?.[field]&&!(SETTINGS_FIELDS[key]??[]).includes(field)&&!((key==='lensDistortion')&&field==='mode')).map(([field,value])=>renderSelect(key,field,String(value)))}

                      {key === 'depthOfField' && (
                        <>
                          {renderNumber(key,'x',shot.effects.depthOfField.target.x)}
                          {renderNumber(key,'y',shot.effects.depthOfField.target.y)}
                          <ScrubInput
                            label="Focus Z"
                            value={shot.effects?.depthOfField?.target?.z ?? 0}
                            min={-20}
                            max={20}
                            step={0.01}
                            onChange={(z) =>
                              updateShot(shot.id, (s) => ({
                                ...s,
                                effects: {
                                  ...s.effects,
                                  depthOfField: {
                                    ...s.effects?.depthOfField,
                                    target: { ...(s.effects?.depthOfField?.target || { x: 0, y: 0, z: 0 }), z },
                                  },
                                },
                              }))
                            }
                          />
                        </>
                      )}
                      {key==='atmosphere'&&<ColorPicker label="Color" color={String(mergedFields['color'])} onChange={color=>setValue(key,'color',color)} compact />}
                      {key==='edgeFade'&&<ColorPicker label="Color" color={String(mergedFields['color'])} onChange={color=>setValue(key,'color',color)} compact />}
                    </div>
                    {key==='depthOfField'&&<div className="flex gap-2"><button type="button" onClick={()=>setDofFocusActive(!focusModeActive)} className={`flex-1 h-8 rounded-lg text-[11px] font-medium ${focusModeActive?'bg-sky-500 text-white':'bg-surface text-foreground hover:bg-surface-active text-foreground hover:bg-[#303035]'}`}>{focusModeActive?'Click the canvas to focus…':'Click the canvas to focus'}</button><button type="button" onClick={()=>{const selected=useSelectionStore.getState().selectedLayerIds[0];const layer=shot.layers.find(item=>item.id===selected);if(layer){setValue(key,'focusMode','subject');updateShot(shot.id,s=>({...s,effects:{...s.effects,depthOfField:{...s.effects.depthOfField,target:{...s.effects.depthOfField.target,z:layer.position.z}}}}));}}} className="h-8 px-3 rounded-lg bg-sky-500/15 text-sky-300 text-[11px] hover:bg-sky-500/25">Snap to subject</button></div>}
                    {key==='atmosphere'&&<details className="rounded-lg border border-border/60 px-2 py-1.5"><summary className="text-[11px] text-foreground/90 cursor-pointer">Depth</summary><div className="grid grid-cols-2 gap-2 pt-2">{['start','reach','mistHeight'].map(field=>renderNumber(key,field,Number(mergedFields[field])))}<label className="flex items-center gap-2 text-[10px] text-foreground/90"><input type="checkbox" checked={Boolean(mergedFields['depthEnabled'])} onChange={e=>setValue(key,'depthEnabled',e.target.checked)}/>Use scene depth</label></div></details>}
                    {key==='gradientMap'&&<div className="space-y-2"><div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">Stops</span><button type="button" aria-label="Add gradient stop" onClick={()=>{const stops=mergedFields['stops'] as GradientStop[];setValue(key,'stops',[...stops,{at:.5,color:'#ffffff',opacity:1}].sort((a,b)=>a.at-b.at).slice(0,8));}} className="w-6 h-6 rounded text-foreground/90 hover:bg-white/10"><Plus className="w-3.5 h-3.5"/></button></div>{(mergedFields['stops'] as GradientStop[]).map((stop,index)=><div key={`${stop.at}-${index}`} className="grid grid-cols-[.8fr_1fr_1fr_24px] gap-1.5 items-center"><ScrubInput label="%" value={stop.at*100} min={0} max={100} step={1} onChange={at=>setValue(key,'stops',(mergedFields['stops'] as GradientStop[]).map((item,i)=>i===index?{...item,at:at/100}:item))}/><ColorPicker label={`Stop ${index+1}`} color={stop.color} onChange={color=>setValue(key,'stops',(mergedFields['stops'] as GradientStop[]).map((item,i)=>i===index?{...item,color}:item))} compact/><ScrubInput label="Opacity" value={(stop.opacity??1)*100} min={0} max={100} step={1} onChange={opacity=>setValue(key,'stops',(mergedFields['stops'] as GradientStop[]).map((item,i)=>i===index?{...item,opacity:opacity/100}:item))}/><button type="button" disabled={(mergedFields['stops'] as GradientStop[]).length<=2} aria-label={`Remove gradient stop ${index+1}`} onClick={()=>setValue(key,'stops',(mergedFields['stops'] as GradientStop[]).filter((_,i)=>i!==index))} className="text-zinc-500 hover:text-rose-400 disabled:opacity-30"><Minus className="w-3 h-3"/></button></div>)}</div>}
                    {settingsKey===key&&<div role="dialog" aria-label={`${EFFECT_NAMES[key]} settings`} className="absolute right-2 top-10 z-[70] w-[min(290px,calc(100vw-56px))] max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-surface-elevated p-3 shadow-2xl space-y-3"><div className="flex items-center justify-between"><h4 className="text-[12px] font-medium text-white">{key==='depthOfField'?'Blur settings':key==='chromaticAberration'?'Fringe settings':key==='filmGrain'?'Grain settings':'Lens settings'}</h4><button type="button" aria-label="Close settings" onClick={()=>setSettingsKey(null)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-white/10 hover:text-white"><X className="w-3.5 h-3.5"/></button></div>
                      {key==='depthOfField'&&<><div className="text-[10px] text-muted-foreground">Scene size</div>{renderNumber(key,'sceneSize',Number(mergedFields['sceneSize']))}<div className="text-[10px] text-muted-foreground">Highlights</div><div className="grid grid-cols-2 gap-2">{renderNumber(key,'highlightIntensity',Number(mergedFields['highlightIntensity']))}{renderNumber(key,'highlightThreshold',Number(mergedFields['highlightThreshold']))}</div></>}
                      {key==='chromaticAberration'&&<><div className="text-[10px] text-muted-foreground">Edges</div>{renderNumber(key,'edgeStrength',Number(mergedFields['edgeStrength']))}<div className="text-[10px] text-muted-foreground">Center</div><div className="grid grid-cols-2 gap-2">{renderNumber(key,'centerX',Number(mergedFields['centerX']))}{renderNumber(key,'centerY',Number(mergedFields['centerY']))}</div><div className="text-[10px] text-muted-foreground">Color</div>{renderNumber(key,'fringeColorAngle',Number(mergedFields['fringeColorAngle']))}<div className="text-[10px] text-muted-foreground">Channels</div><div className="grid grid-cols-3 gap-2">{['channelRed','channelGreen','channelBlue'].map(field=>renderNumber(key,field,Number(mergedFields[field])))}</div></>}
                      {key==='filmGrain'&&<><div className="text-[10px] text-muted-foreground">Texture</div><div className="grid grid-cols-2 gap-2">{['softness','colorAmount','aspect','seed'].map(field=>renderNumber(key,field,Number(mergedFields[field])))}</div><div className="text-[10px] text-muted-foreground">Tone</div><div className="grid grid-cols-3 gap-2">{['shadowStrength','midStrength','highlightStrength'].map(field=>renderNumber(key,field,Number(mergedFields[field])))}</div>{renderNumber(key,'midpoint',Number(mergedFields['midpoint']))}<div className="grid grid-cols-2 gap-2">{renderSelect(key,'blendMode',String(mergedFields['blendMode']))}{renderSelect(key,'motion',String(mergedFields['motion']))}</div><div className="grid grid-cols-2 gap-2">{(['protectBlacks','smooth','perChannel'] as const).map(field=><label key={field} className="flex items-center gap-2 text-[10px] text-foreground/90"><input type="checkbox" checked={Boolean(mergedFields[field])} onChange={event=>setValue(key,field,event.target.checked)}/>{label(field)}</label>)}</div></>}
                      {key==='lensDistortion'&&<><div className="grid grid-cols-2 gap-2">{renderSelect(key,'edgeMode',String(mergedFields['edgeMode']))}{renderSelect(key,'measure',String(mergedFields['measure']))}</div><div className="text-[10px] text-muted-foreground">Center</div><div className="grid grid-cols-2 gap-2">{renderNumber(key,'centerX',Number(mergedFields['centerX']))}{renderNumber(key,'centerY',Number(mergedFields['centerY']))}</div></>}
                    </div>}
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
    </section>
  );
}

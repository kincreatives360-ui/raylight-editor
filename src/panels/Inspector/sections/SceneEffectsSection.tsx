import { FigmaSelect } from '../../../ui/FigmaSelect';
import { useState, useMemo } from 'react';
import type { Shot, EffectKey } from '../../../model/types';
import { DEFAULT_EFFECTS_ORDER } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';
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
} from 'lucide-react';

export const EFFECT_NAMES: Record<EffectKey, string> = {
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
};

export const EFFECT_DEFAULTS: Record<EffectKey, Record<string, number>> = {
  bloom: { intensity: 0.35, threshold: 0.75 },
  vignette: { intensity: 0.42 },
  motionBlur: { shutterAngle: 180, samples: 8 },
  chromaticAberration: { offset: 0.002 },
  filmGrain: { intensity: 0.025, size: 1.2 },
  ghost: { opacity: 0.25, offset: 0.02, blur: 4 },
  colorGrade: { exposure: 1.0, contrast: 1.0, saturation: 1.0, temperature: 0, tint: 0 },
  edgeFade: { top: 0.1, bottom: 0.1, left: 0, right: 0 },
  glitch: { intensity: 0.15 },
  depthOfField: { aperture: 2.8, focusRange: 0.35, bokehScale: 4.5, focalLength: 50 },
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
    default:
      return <Sparkles className={className} />;
  }
}

const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function SceneEffectsSection({ shot }: { shot: Shot }) {
  const updateShot = useProjectStore((s) => s.updateShot);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<EffectKey | null>(null);

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

  const setValue = (key: EffectKey, field: string, value: number | string | boolean) => {
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
          ...(s.effects?.[key] || EFFECT_DEFAULTS[key] || {}),
          enabled: true,
        },
      },
    }));
    setExpandedKey(key);
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
          <button
            type="button"
            title="Add scene effect"
            onClick={() => setAddMenuOpen((v) => !v)}
            className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
              addMenuOpen ? 'bg-white/20 text-white' : 'text-[#8e8e93] hover:text-white hover:bg-white/10'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Add Effect Flyout Menu */}
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#18181b]/85 backdrop-blur-xl saturate-180 border border-white/15 p-1 shadow-[0_16px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] z-30 space-y-0.5 origin-top-right">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
                Add Effect
              </div>
              {order.map((key) => {
                const isAlreadyAdded = appliedKeys.includes(key);
                return (
                  <button
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
                      <span className="text-[10px] text-[#71717a] font-medium">Added</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Applied Effects List (Figma Style) */}
      <div className="space-y-1.5">
        {
          appliedKeys.map((key) => {
            const effect = shot.effects?.[key] || { enabled: false };
            const mergedFields = { ...EFFECT_DEFAULTS[key], ...effect };
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
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isExpanded ? null : key)}
                    className={`flex-1 h-7 px-3 rounded-full border border-white/[0.08] flex items-center justify-between text-[11px] transition cursor-pointer ${
                      isExpanded
                        ? 'bg-[#222226] text-white shadow-xs border-white/20'
                        : 'bg-[#18181b] hover:bg-[#222226] text-white'
                    }`}
                  >
                    <span className="font-medium truncate">{EFFECT_NAMES[key]}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-[#71717a] transition-transform ${
                        isExpanded ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>

                  {/* Visibility Eye Button */}
                  <button
                    type="button"
                    onClick={() => setValue(key, 'enabled', !isEnabled)}
                    title={isEnabled ? 'Mute effect' : 'Enable effect'}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                      isEnabled
                        ? 'text-white hover:bg-white/10'
                        : 'text-[#52525b] hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {isEnabled ? (
                      <Eye className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-[#71717a]" />
                    )}
                  </button>

                  {/* Minus (Remove) Button */}
                  <button
                    type="button"
                    onClick={() => removeEffect(key)}
                    title={`Remove ${EFFECT_NAMES[key]}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#71717a] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expanded Parameter Inputs Card */}
                {isExpanded && (
                  <div className="p-2.5 rounded-xl bg-[#141416] border border-white/[0.06] space-y-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(mergedFields)
                        .filter(([field, value]) => field !== 'enabled' && typeof value === 'number')
                        .map(([field, rawVal]) => {
                          const normalizedPixels =
                            (key === 'chromaticAberration' && field === 'offset') ||
                            (key === 'ghost' && field === 'offset');
                          const scale = normalizedPixels ? 1920 : key === 'ghost' && field === 'blur' ? 2 : 1;
                          const signed = ['exposure', 'temperature', 'tint'].includes(field);
                          const max =
                            field === 'aperture'
                              ? 32
                              : field === 'focalLength'
                              ? 300
                              : field === 'samples'
                              ? 32
                              : field === 'shutterAngle'
                              ? 360
                              : normalizedPixels
                              ? 100
                              : ['contrast', 'saturation', 'exposure', 'intensity', 'bokehScale'].includes(field)
                              ? 4
                              : field === 'focusRange'
                              ? 20
                              : field === 'size'
                              ? 10
                              : 1;

                          return (
                            <ScrubInput
                              key={field}
                              label={label(field)}
                              value={Number(rawVal) * scale}
                              min={signed ? -4 : field === 'aperture' ? 0.1 : 0}
                              max={max}
                              step={
                                normalizedPixels || field === 'samples' || field === 'shutterAngle'
                                  ? 1
                                  : 0.01
                              }
                              unit={scale !== 1 ? ' px' : field === 'aperture' ? ' f' : ''}
                              onChange={(v) => setValue(key, field, v / scale)}
                            />
                          );
                        })}

                      {key === 'depthOfField' && (
                        <>
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
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400 font-medium">Bokeh Shape</label>
                            <FigmaSelect
                              aria-label="Bokeh shape"
                              className="w-full h-8 px-2 rounded-lg bg-[#18181b] border border-white/[0.08] text-[11px] text-white outline-none focus:border-white/20 cursor-pointer"
                              value={shot.effects?.depthOfField?.bokehShape || 'anamorphic'}
                              onChange={(e) => setValue(key, 'bokehShape', e.target.value)}
                            >
                              {['spherical', 'anamorphic', 'vintage', 'portrait'].map((v) => (
                                <option key={v} value={v}>
                                  {v.charAt(0).toUpperCase() + v.slice(1)}
                                </option>
                              ))}
                            </FigmaSelect>
                          </div>
                        </>
                      )}
                    </div>
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

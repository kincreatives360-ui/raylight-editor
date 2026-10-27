import type { Shot, EffectKey } from '../../../model/types';
import { DEFAULT_EFFECTS_ORDER } from '../../../model/defaults';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';

const names: Record<EffectKey, string> = {
  depthOfField: 'Depth of Field',
  bloom: 'Bloom',
  vignette: 'Vignette',
  motionBlur: 'Motion Blur',
  chromaticAberration: 'Chromatic Aberration',
  filmGrain: 'Film Grain',
  ghost: 'Ghost',
  colorGrade: 'Color Grade',
  edgeFade: 'Edge Fade',
  glitch: 'Glitch',
};

const effectDefaults: Record<EffectKey, Record<string, number>> = {
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

const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function SceneEffectsSection({ shot }: { shot: Shot }) {
  const updateShot = useProjectStore((s) => s.updateShot);
  const order = [...new Set([...(shot.effectsOrder || []), ...DEFAULT_EFFECTS_ORDER])];

  const setValue = (key: EffectKey, field: string, value: number | string | boolean) =>
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

  const move = (index: number, delta: number) => {
    const next = [...order];
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
    updateShot(shot.id, (s) => ({ ...s, effectsOrder: next }));
  };

  return (
    <section className="pt-3 border-t border-white/[0.06] space-y-2.5" aria-label="Scene effects">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-white tracking-wide">Scene Effects</h3>
        <span className="text-[11px] text-[#a1a1aa] font-mono tabular-nums">1920×1080 Ref</span>
      </div>
      <p className="text-xs text-zinc-400">
        Shader post-processing passes evaluated in visual order. Use arrows to reorder.
      </p>

      <div className="space-y-1.5">
        {order.map((key, index) => {
          const effect = shot.effects[key] || { enabled: false };
          const mergedFields = { ...effectDefaults[key], ...effect };

          return (
            <details
              key={key}
              className={`rounded-lg border transition-all ${
                effect.enabled
                  ? 'border-indigo-500/30 bg-indigo-950/10'
                  : 'border-white/[0.08] bg-[#141416]/50'
              } p-2.5`}
            >
              <summary className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  aria-label={`Enable ${names[key]}`}
                  checked={Boolean(effect.enabled)}
                  onChange={(e) => setValue(key, 'enabled', e.target.checked)}
                  className="rounded border-zinc-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className={`flex-1 font-medium text-[11px] ${effect.enabled ? 'text-white' : 'text-zinc-400'}`}>
                  {names[key]}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-zinc-400 mr-1">#{index + 1}</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move ${names[key]} earlier`}
                    title="Move earlier in pass order"
                    onClick={(e) => {
                      e.preventDefault();
                      move(index, -1);
                    }}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-zinc-300 disabled:cursor-not-allowed text-[11px] leading-none"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === order.length - 1}
                    aria-label={`Move ${names[key]} later`}
                    title="Move later in pass order"
                    onClick={(e) => {
                      e.preventDefault();
                      move(index, 1);
                    }}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-zinc-300 disabled:cursor-not-allowed text-[11px] leading-none"
                  >
                    ↓
                  </button>
                </div>
              </summary>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/[0.06]">
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
                      <select
                        aria-label="Bokeh shape"
                        className="w-full h-8 px-2 rounded-lg bg-[#18181b] border border-white/[0.08] text-[11px] text-white outline-none focus:border-white/20"
                        value={shot.effects?.depthOfField?.bokehShape || 'anamorphic'}
                        onChange={(e) => setValue(key, 'bokehShape', e.target.value)}
                      >
                        {['spherical', 'anamorphic', 'vintage', 'portrait'].map((v) => (
                          <option key={v} value={v}>
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

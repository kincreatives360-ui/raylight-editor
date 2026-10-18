// src/panels/Inspector/sections/LightingSection.tsx
import React from 'react';
import { Plus, Sun, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { Shot, LightSourceType } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorField } from '../ColorPicker';
import { kelvinToRgb } from '../../../stage/stageUtils';

interface LightingSectionProps {
  activeShot: Shot;
}

export const LightingSection: React.FC<LightingSectionProps> = ({
  activeShot,
}) => {
  const { updateShot } = useProjectStore();
  const { selectedLightBlockId, selectLightBlock, setTimelineView } =
    useSelectionStore();
  const { light } = activeShot;

  const selectedLightBlock = (activeShot.lightBlocks || []).find(
    (b) => b.id === selectedLightBlockId
  );

  const keyEnabled = light?.keyLightEnabled !== false;
  const keyShadow = light?.castShadow !== false;
  const showGizmos = light?.showGizmos ?? false;
  const sources = light?.sources || [];
  const maxLightsReached = sources.length >= 8;

  const kelvinPreview = kelvinToRgb(light.temperature ?? 6100, 1).css;

  return (
    <div className="p-3.5 space-y-4">
      {/* 1. Header with Gizmos toggle & Animate Key Sweep button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold tracking-wide text-white">
            Lighting & Optics
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              updateShot(activeShot.id, (s) => ({
                ...s,
                light: { ...s.light, showGizmos: !showGizmos },
              }))
            }
            title={showGizmos ? 'Hide 3D light helper gizmos' : 'Show 3D light helper gizmos in viewport'}
            className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 cursor-pointer transition ${
              showGizmos
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                : 'bg-white/5 text-[#a1a1aa] hover:bg-white/10 hover:text-white'
            }`}
          >
            {showGizmos ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>Gizmos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newLightId = `light-blk-${Date.now()}`;
              updateShot(activeShot.id, (s) => ({
                ...s,
                lightBlocks: [
                  ...(s.lightBlocks || []),
                  {
                    id: newLightId,
                    label: 'Key Light Sweep',
                    targetLightId: 'key',
                    startMs: 0,
                    durationMs: s.durationMs,
                    fromX: -0.35,
                    fromY: 0.35,
                    toX: 0.35,
                    toY: 0.25,
                    fromIntensity: s.light.keyIntensity ?? s.light.intensity,
                    toIntensity: s.light.keyIntensity ?? s.light.intensity,
                    easing: { kind: 'preset', name: 'ease-in-out' },
                  },
                ],
              }));
              selectLightBlock(newLightId);
              setTimelineView('scene');
            }}
            title="Animate Key Light Sweep on Timeline"
            className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] flex items-center gap-1 cursor-pointer transition"
          >
            <Plus className="w-3 h-3" />
            <span>Animate</span>
          </button>
        </div>
      </div>

      {/* Master Gain (scales additional sources, 0 to 2, step 0.01) */}
      <div className="rounded-lg border border-white/[0.06] bg-[#18181b]/70 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#e4e4e7]">Master Gain</span>
          <span className="text-[9px] text-[#a1a1aa]">Scales all extra light sources</span>
        </div>
        <ScrubInput
          label="Master Gain"
          value={Math.round((light.intensity ?? 1.2) * 100)}
          min={0}
          max={200}
          step={1}
          unit="%"
          onChange={(pct) =>
            updateShot(activeShot.id, (s) => ({
              ...s,
              light: {
                ...s.light,
                keyIntensity: s.light.keyIntensity ?? s.light.intensity,
                intensity: Number((pct / 100).toFixed(2)),
              },
            }))
          }
        />
      </div>

      {/* 2. Scene-Level Ambient (Shadow Floor): sets baseline shadow brightness without direction/falloff */}
      <div className="rounded-lg border border-white/[0.06] bg-[#18181b]/70 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-[#e4e4e7]">
              Ambient (Shadow Floor)
            </span>
            <span className="text-[9px] text-[#a1a1aa]">
              Global baseline fill; prevents unlit areas from going pure black
            </span>
          </div>
          <ColorField
            aria-label="Ambient color"
            value={light.ambientColor || '#f8fafc'}
            onChange={(e) =>
              updateShot(activeShot.id, (s) => ({
                ...s,
                light: { ...s.light, ambientColor: e.target.value },
              }))
            }
          />
        </div>

        <ScrubInput
          label="Shadow Floor"
          value={Math.round((light.ambience ?? 0.45) * 100)}
          min={0}
          max={100}
          step={2}
          unit="%"
          onChange={(pct) =>
            updateShot(activeShot.id, (s) => ({
              ...s,
              light: { ...s.light, ambience: Number((pct / 100).toFixed(2)) },
            }))
          }
        />
      </div>

      {/* 3. Directional Key Light (Sun): produces main shading gradient across tilted layers & glass/metal specular */}
      <div className="rounded-lg border border-white/[0.06] bg-[#18181b]/70 p-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keyEnabled}
              onChange={(e) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  light: { ...s.light, keyLightEnabled: e.target.checked },
                }))
              }
              className="accent-amber-500"
            />
            <span className="text-[11px] font-medium text-white">
              Key Light (Directional)
            </span>
          </label>

          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
              style={{ backgroundColor: kelvinPreview }}
              title={`Color Temperature: ${light.temperature ?? 6100}K`}
            />
            <label className="flex items-center gap-1 text-[10px] text-[#a1a1aa] cursor-pointer">
              <input
                type="checkbox"
                checked={keyShadow}
                onChange={(e) =>
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    light: { ...s.light, castShadow: e.target.checked },
                  }))
                }
                className="accent-amber-500"
              />
              <span>Shadows</span>
            </label>
          </div>
        </div>

        {keyEnabled && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <ScrubInput
                label="Angle X"
                value={Math.round((light?.position?.x ?? -0.28) * 100)}
                min={-100}
                max={100}
                step={2}
                unit="%"
                onChange={(pctX) =>
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    light: {
                      ...s.light,
                      position: {
                        ...(s.light?.position || { x: -0.28, y: 0.36, z: 0.9 }),
                        x: Number((pctX / 100).toFixed(2)),
                      },
                    },
                  }))
                }
              />
              <ScrubInput
                label="Angle Y"
                value={Math.round((light?.position?.y ?? 0.36) * 100)}
                min={-100}
                max={100}
                step={2}
                unit="%"
                onChange={(pctY) =>
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    light: {
                      ...s.light,
                      position: {
                        ...(s.light?.position || { x: -0.28, y: 0.36, z: 0.9 }),
                        y: Number((pctY / 100).toFixed(2)),
                      },
                    },
                  }))
                }
              />
              <ScrubInput
                label="Angle Z"
                value={Math.round((light?.position?.z ?? 0.9) * 100)}
                min={10}
                max={200}
                step={5}
                unit="%"
                onChange={(pctZ) =>
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    light: {
                      ...s.light,
                      position: {
                        ...(s.light?.position || { x: -0.28, y: 0.36, z: 0.9 }),
                        z: Number((pctZ / 100).toFixed(2)),
                      },
                    },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Intensity"
                value={Math.round((light.keyIntensity ?? light.intensity ?? 1.2) * 100)}
                min={0}
                max={300}
                step={5}
                unit="%"
                onChange={(pct) =>
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    light: { ...s.light, keyIntensity: Number((pct / 100).toFixed(2)) },
                  }))
                }
              />
              <ScrubInput
                label="Color Temp"
                value={light.temperature ?? 6100}
                min={2500}
                max={9500}
                step={100}
                unit="K"
                onChange={(temperature) =>
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    light: { ...s.light, temperature },
                  }))
                }
              />
            </div>
          </>
        )}
      </div>

      {/* 4. Multiple 3D Light Sources (Point, Spot, Area, Directional) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[#e4e4e7]">
              3D Light Sources
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.08] text-[#a1a1aa]">
              {sources.length}/8
            </span>
          </div>

          <select
            aria-label="Add light source type"
            disabled={maxLightsReached}
            className="rounded-md bg-[#1c1c1f] border border-white/[0.08] px-2 py-1 text-[10px] text-white outline-none cursor-pointer disabled:opacity-50"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              const type = e.target.value as LightSourceType;
              const newSourceId = `light-src-${Date.now()}`;
              updateShot(activeShot.id, (shot) => ({
                ...shot,
                light: {
                  ...shot.light,
                  sources: [
                    ...(shot.light.sources || []),
                    {
                      id: newSourceId,
                      name: `${type === 'area' ? 'Soft Box' : type[0].toUpperCase() + type.slice(1)} Light`,
                      type,
                      enabled: true,
                      position: {
                        x: type === 'area' ? 0.3 : -0.2,
                        y: type === 'area' ? 0.4 : 0.2,
                        z: type === 'point' ? 0.8 : 1.0,
                      },
                      target: { x: 0, y: 0, z: 0 },
                      intensity: type === 'area' ? 1.5 : 1.0,
                      color: type === 'area' ? '#ffffff' : '#fef08a',
                      temperature: 6100,
                      distance: type === 'point' ? 10 : 12,
                      decay: 2,
                      angle: Math.PI / 5,
                      penumbra: 0.4,
                      width: 3,
                      height: 3,
                      castShadow: type !== 'area',
                    },
                  ],
                },
              }));
              e.currentTarget.value = '';
            }}
          >
            <option value="">+ Add Light...</option>
            <option value="point">Point Light (Omni Glow & Parallax)</option>
            <option value="spot">Spot Light (Cone & Hero Isolate)</option>
            <option value="area">Area Light / Soft Box (Glass Reflection)</option>
            <option value="directional">Directional (Accent Sun)</option>
          </select>
        </div>

        {sources.map((source) => (
          <div
            key={source.id}
            className="rounded-lg border border-white/[0.06] bg-[#18181b]/70 p-2.5 space-y-2.5 transition hover:border-white/10"
          >
            {/* Header: toggle, name, color, animate, delete */}
            <div className="flex items-center justify-between gap-1.5">
              <label className="flex items-center gap-1.5 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={(e) =>
                    updateShot(activeShot.id, (shot) => ({
                      ...shot,
                      light: {
                        ...shot.light,
                        sources: (shot.light?.sources || []).map((l) =>
                          l.id === source.id ? { ...l, enabled: e.target.checked } : l
                        ),
                      },
                    }))
                  }
                  className="accent-amber-500"
                />
                <span className="text-[11px] font-medium text-white truncate">
                  {source.name}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-amber-300 font-mono capitalize">
                  {source.type}
                </span>
              </label>

              <div className="flex items-center gap-1.5 shrink-0">
                <ColorField
                  aria-label={`${source.name} color`}
                  value={source.color}
                  onChange={(e) =>
                    updateShot(activeShot.id, (shot) => ({
                      ...shot,
                      light: {
                        ...shot.light,
                        sources: (shot.light?.sources || []).map((l) =>
                          l.id === source.id ? { ...l, color: e.target.value } : l
                        ),
                      },
                    }))
                  }
                />

                <button
                  type="button"
                  onClick={() => {
                    const blockId = `light-blk-${Date.now()}`;
                    updateShot(activeShot.id, (s) => ({
                      ...s,
                      lightBlocks: [
                        ...(s.lightBlocks || []),
                        {
                          id: blockId,
                          label: `${source.name} Move`,
                          targetLightId: source.id,
                          startMs: 0,
                          durationMs: s.durationMs,
                          fromX: source.position.x - 0.2,
                          fromY: source.position.y + 0.1,
                          fromZ: source.position.z,
                          toX: source.position.x + 0.2,
                          toY: source.position.y - 0.1,
                          toZ: source.position.z,
                          fromIntensity: source.intensity,
                          toIntensity: source.intensity,
                          easing: { kind: 'preset', name: 'ease-in-out' },
                        },
                      ],
                    }));
                    selectLightBlock(blockId);
                    setTimelineView('scene');
                  }}
                  title="Animate this light on Timeline"
                  className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[9px] cursor-pointer"
                >
                  Animate
                </button>

                <button
                  type="button"
                  title="Delete light source"
                  onClick={() =>
                    updateShot(activeShot.id, (shot) => ({
                      ...shot,
                      light: {
                        ...shot.light,
                        sources: (shot.light?.sources || []).filter((l) => l.id !== source.id),
                      },
                    }))
                  }
                  className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {source.enabled && (
              <div className="space-y-2 pt-1">
                {/* 3D Position */}
                <div className="grid grid-cols-3 gap-1.5">
                  <ScrubInput
                    label="Pos X"
                    value={Math.round((source.position?.x ?? 0) * 100)}
                    min={-200}
                    max={200}
                    step={2}
                    unit="%"
                    onChange={(pctX) =>
                      updateShot(activeShot.id, (shot) => ({
                        ...shot,
                        light: {
                          ...shot.light,
                          sources: (shot.light?.sources || []).map((l) =>
                            l.id === source.id
                              ? {
                                  ...l,
                                  position: {
                                    ...(l.position || { x: 0, y: 0, z: 0 }),
                                    x: Number((pctX / 100).toFixed(2)),
                                  },
                                }
                              : l
                          ),
                        },
                      }))
                    }
                  />
                  <ScrubInput
                    label="Pos Y"
                    value={Math.round((source.position?.y ?? 0) * 100)}
                    min={-200}
                    max={200}
                    step={2}
                    unit="%"
                    onChange={(pctY) =>
                      updateShot(activeShot.id, (shot) => ({
                        ...shot,
                        light: {
                          ...shot.light,
                          sources: (shot.light?.sources || []).map((l) =>
                            l.id === source.id
                              ? {
                                  ...l,
                                  position: {
                                    ...(l.position || { x: 0, y: 0, z: 0 }),
                                    y: Number((pctY / 100).toFixed(2)),
                                  },
                                }
                              : l
                          ),
                        },
                      }))
                    }
                  />
                  <ScrubInput
                    label="Pos Z"
                    value={Math.round((source.position?.z ?? 1) * 100)}
                    min={-100}
                    max={300}
                    step={5}
                    unit="%"
                    onChange={(pctZ) =>
                      updateShot(activeShot.id, (shot) => ({
                        ...shot,
                        light: {
                          ...shot.light,
                          sources: (shot.light?.sources || []).map((l) =>
                            l.id === source.id
                              ? {
                                  ...l,
                                  position: {
                                    ...(l.position || { x: 0, y: 0, z: 0 }),
                                    z: Number((pctZ / 100).toFixed(2)),
                                  },
                                }
                              : l
                          ),
                        },
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label="Intensity"
                    value={Math.round((source.intensity ?? 1) * 100)}
                    min={0}
                    max={500}
                    step={5}
                    unit="%"
                    onChange={(pct) =>
                      updateShot(activeShot.id, (shot) => ({
                        ...shot,
                        light: {
                          ...shot.light,
                          sources: (shot.light?.sources || []).map((l) =>
                            l.id === source.id
                              ? { ...l, intensity: Number((pct / 100).toFixed(2)) }
                              : l
                          ),
                        },
                      }))
                    }
                  />

                  {source.type !== 'area' && (
                    <label className="flex items-center gap-1.5 text-[10px] text-[#a1a1aa] px-2 py-1 rounded bg-[#1c1c1f] border border-white/[0.04] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={source.castShadow !== false}
                        onChange={(e) =>
                          updateShot(activeShot.id, (shot) => ({
                            ...shot,
                            light: {
                              ...shot.light,
                              sources: (shot.light?.sources || []).map((l) =>
                                l.id === source.id ? { ...l, castShadow: e.target.checked } : l
                              ),
                            },
                          }))
                        }
                        className="accent-amber-500"
                      />
                      <span>Cast Shadows</span>
                    </label>
                  )}
                </div>

                {/* Point Light specific controls: Distance & Decay */}
                {source.type === 'point' && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <ScrubInput
                      label="Radius"
                      value={source.distance ?? 10}
                      min={1}
                      max={30}
                      step={1}
                      onChange={(distance) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id ? { ...l, distance } : l
                            ),
                          },
                        }))
                      }
                    />
                    <ScrubInput
                      label="Falloff Decay"
                      value={source.decay ?? 2}
                      min={0}
                      max={4}
                      step={0.5}
                      onChange={(decay) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id ? { ...l, decay } : l
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                )}

                {/* Spot Light specific controls: Cone Angle, Penumbra & Falloff */}
                {source.type === 'spot' && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <ScrubInput
                      label="Cone Angle"
                      value={Math.round(((source.angle ?? Math.PI / 5) * 180) / Math.PI)}
                      min={10}
                      max={90}
                      step={2}
                      unit="°"
                      onChange={(deg) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id
                                ? { ...l, angle: Number(((deg * Math.PI) / 180).toFixed(3)) }
                                : l
                            ),
                          },
                        }))
                      }
                    />
                    <ScrubInput
                      label="Softness"
                      value={Math.round((source.penumbra ?? 0.4) * 100)}
                      min={0}
                      max={100}
                      step={5}
                      unit="%"
                      onChange={(pct) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id
                                ? { ...l, penumbra: Number((pct / 100).toFixed(2)) }
                                : l
                            ),
                          },
                        }))
                      }
                    />
                    <ScrubInput
                      label="Distance"
                      value={source.distance ?? 12}
                      min={2}
                      max={35}
                      step={1}
                      onChange={(distance) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id ? { ...l, distance } : l
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                )}

                {/* Area Light (Soft Box) specific controls: Width & Height */}
                {source.type === 'area' && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <ScrubInput
                      label="Emitter Width"
                      value={source.width ?? 3}
                      min={1}
                      max={10}
                      step={0.5}
                      onChange={(width) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id ? { ...l, width } : l
                            ),
                          },
                        }))
                      }
                    />
                    <ScrubInput
                      label="Emitter Height"
                      value={source.height ?? 3}
                      min={1}
                      max={10}
                      step={0.5}
                      onChange={(height) =>
                        updateShot(activeShot.id, (shot) => ({
                          ...shot,
                          light: {
                            ...shot.light,
                            sources: (shot.light?.sources || []).map((l) =>
                              l.id === source.id ? { ...l, height } : l
                            ),
                          },
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 5. Selected Light Animation Block Inspector on the Timeline */}
      {selectedLightBlock && (
        <div className="pt-2 border-t border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-300">
              {selectedLightBlock.label || 'Light Animation Block'}
            </span>
            <button
              type="button"
              onClick={() => {
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).filter(
                    (b) => b.id !== selectedLightBlock.id
                  ),
                }));
                selectLightBlock(null);
              }}
              className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              Delete
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="Start"
              value={selectedLightBlock.startMs}
              min={0}
              max={activeShot.durationMs - 100}
              step={20}
              unit=" ms"
              onChange={(startMs) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id ? { ...b, startMs } : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="Duration"
              value={selectedLightBlock.durationMs}
              min={100}
              max={activeShot.durationMs}
              step={20}
              unit=" ms"
              onChange={(durationMs) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id ? { ...b, durationMs } : b
                  ),
                }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="From X"
              value={Math.round(selectedLightBlock.fromX * 100)}
              min={-150}
              max={150}
              step={2}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, fromX: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="To X"
              value={Math.round(selectedLightBlock.toX * 100)}
              min={-150}
              max={150}
              step={2}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, toX: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="From Y"
              value={Math.round(selectedLightBlock.fromY * 100)}
              min={-150}
              max={150}
              step={2}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, fromY: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="To Y"
              value={Math.round(selectedLightBlock.toY * 100)}
              min={-150}
              max={150}
              step={2}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, toY: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="From Int"
              value={Math.round(selectedLightBlock.fromIntensity * 100)}
              min={0}
              max={300}
              step={5}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, fromIntensity: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="To Int"
              value={Math.round(selectedLightBlock.toIntensity * 100)}
              min={0}
              max={300}
              step={5}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, toIntensity: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
          </div>

          {/* From / To Z Position */}
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="From Z"
              value={Math.round((selectedLightBlock.fromZ ?? 0.9) * 100)}
              min={10}
              max={250}
              step={5}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, fromZ: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="To Z"
              value={Math.round((selectedLightBlock.toZ ?? selectedLightBlock.fromZ ?? 0.9) * 100)}
              min={10}
              max={250}
              step={5}
              unit="%"
              onChange={(val) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, toZ: Number((val / 100).toFixed(2)) }
                      : b
                  ),
                }))
              }
            />
          </div>

          {/* Temperature */}
          {(() => {
            const targetSource = selectedLightBlock.targetLightId && selectedLightBlock.targetLightId !== 'key'
              ? activeShot.light.sources?.find((s) => s.id === selectedLightBlock.targetLightId)
              : undefined;
            const fallbackTemp = targetSource?.temperature ?? activeShot.light.temperature ?? 6100;
            return (
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="From Temp"
                  value={selectedLightBlock.fromTemperature ?? fallbackTemp}
                  min={2500}
                  max={9500}
                  step={100}
                  unit="K"
                  onChange={(fromTemperature) =>
                    updateShot(activeShot.id, (s) => ({
                      ...s,
                      lightBlocks: (s.lightBlocks || []).map((b) =>
                        b.id === selectedLightBlock.id
                          ? { ...b, fromTemperature }
                          : b
                      ),
                    }))
                  }
                />
                <ScrubInput
                  label="To Temp"
                  value={selectedLightBlock.toTemperature ?? selectedLightBlock.fromTemperature ?? fallbackTemp}
                  min={2500}
                  max={9500}
                  step={100}
                  unit="K"
                  onChange={(toTemperature) =>
                    updateShot(activeShot.id, (s) => ({
                      ...s,
                      lightBlocks: (s.lightBlocks || []).map((b) =>
                        b.id === selectedLightBlock.id
                          ? { ...b, toTemperature }
                          : b
                      ),
                    }))
                  }
                />
              </div>
            );
          })()}

          {/* Color for additional light sources */}
          {selectedLightBlock.targetLightId && selectedLightBlock.targetLightId !== 'key' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#a1a1aa]">From Color</span>
                <ColorField
                  value={selectedLightBlock.fromColor ?? '#ffffff'}
                  onChange={(e) => {
                    const fromColor = e.target.value;
                    updateShot(activeShot.id, (s) => ({
                      ...s,
                      lightBlocks: (s.lightBlocks || []).map((b) =>
                        b.id === selectedLightBlock.id
                          ? { ...b, fromColor, toColor: b.toColor ?? fromColor }
                          : b
                      ),
                    }));
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#a1a1aa]">To Color</span>
                <ColorField
                  value={selectedLightBlock.toColor ?? selectedLightBlock.fromColor ?? '#ffffff'}
                  onChange={(e) => {
                    const toColor = e.target.value;
                    updateShot(activeShot.id, (s) => ({
                      ...s,
                      lightBlocks: (s.lightBlocks || []).map((b) =>
                        b.id === selectedLightBlock.id
                          ? { ...b, toColor }
                          : b
                      ),
                    }));
                  }}
                />
              </div>
            </div>
          )}

          {/* Spot Angle and Softness */}
          {(() => {
            const tgtSrc = (light.sources || []).find((s) => s.id === selectedLightBlock.targetLightId);
            if (tgtSrc?.type !== 'spot') return null;
            return (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label="From Angle"
                    value={Math.round((((selectedLightBlock.fromAngle ?? tgtSrc.angle ?? Math.PI / 5) * 180) / Math.PI))}
                    min={10}
                    max={90}
                    step={1}
                    unit="°"
                    onChange={(deg) => {
                      const fromAngle = Number(((deg * Math.PI) / 180).toFixed(3));
                      updateShot(activeShot.id, (s) => ({
                        ...s,
                        lightBlocks: (s.lightBlocks || []).map((b) =>
                          b.id === selectedLightBlock.id
                            ? { ...b, fromAngle }
                            : b
                        ),
                      }));
                    }}
                  />
                  <ScrubInput
                    label="To Angle"
                    value={Math.round((((selectedLightBlock.toAngle ?? selectedLightBlock.fromAngle ?? tgtSrc.angle ?? Math.PI / 5) * 180) / Math.PI))}
                    min={10}
                    max={90}
                    step={1}
                    unit="°"
                    onChange={(deg) => {
                      const toAngle = Number(((deg * Math.PI) / 180).toFixed(3));
                      updateShot(activeShot.id, (s) => ({
                        ...s,
                        lightBlocks: (s.lightBlocks || []).map((b) =>
                          b.id === selectedLightBlock.id
                            ? { ...b, toAngle }
                            : b
                        ),
                      }));
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label="From Soft"
                    value={Math.round((selectedLightBlock.fromPenumbra ?? tgtSrc.penumbra ?? 0.4) * 100)}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(pct) => {
                      const fromPenumbra = Number((pct / 100).toFixed(2));
                      updateShot(activeShot.id, (s) => ({
                        ...s,
                        lightBlocks: (s.lightBlocks || []).map((b) =>
                          b.id === selectedLightBlock.id
                            ? { ...b, fromPenumbra }
                            : b
                        ),
                      }));
                    }}
                  />
                  <ScrubInput
                    label="To Soft"
                    value={Math.round((selectedLightBlock.toPenumbra ?? selectedLightBlock.fromPenumbra ?? tgtSrc.penumbra ?? 0.4) * 100)}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(pct) => {
                      const toPenumbra = Number((pct / 100).toFixed(2));
                      updateShot(activeShot.id, (s) => ({
                        ...s,
                        lightBlocks: (s.lightBlocks || []).map((b) =>
                          b.id === selectedLightBlock.id
                            ? { ...b, toPenumbra }
                            : b
                        ),
                      }));
                    }}
                  />
                </div>
              </>
            );
          })()}

          {/* Hold before start toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-[#a1a1aa]">Hold before start</span>
            <input
              type="checkbox"
              checked={selectedLightBlock.holdBefore !== false}
              onChange={(e) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  lightBlocks: (s.lightBlocks || []).map((b) =>
                    b.id === selectedLightBlock.id
                      ? { ...b, holdBefore: e.target.checked }
                      : b
                  ),
                }))
              }
              className="accent-amber-500 rounded cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
// src/panels/Inspector/sections/LightingSection.tsx
import React from 'react';
import { Plus, Sun } from 'lucide-react';
import type { Shot, LightSourceType } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorField } from '../ColorPicker';

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

  return (
    <div className="p-3.5 space-y-3">
      {/* Header + Animate Light Sweep button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-medium text-[#e4e4e7]">
            Lighting
          </span>
        </div>
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
                  label: 'Light Sweep',
                  startMs: 0,
                  durationMs: s.durationMs,
                  fromX: -0.35,
                  fromY: 0.35,
                  toX: 0.35,
                  toY: 0.25,
                  fromIntensity: s.light.intensity,
                  toIntensity: s.light.intensity,
                  easing: { kind: 'preset', name: 'ease-in-out' },
                },
              ],
            }));
            selectLightBlock(newLightId);
            setTimelineView('scene');
          }}
          title="Animate Light Sweep on Timeline"
          className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] flex items-center gap-1 cursor-pointer transition"
        >
          <Plus className="w-3 h-3" />
          <span>Animate</span>
        </button>
      </div>

      {/* Primary Key Light Rig Controls */}
      <div className="grid grid-cols-2 gap-1.5">
        <ScrubInput
          label="X"
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
          label="Y"
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
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <ScrubInput
          label="Intensity"
          value={Math.round((light.intensity ?? 1.0) * 100)}
          min={0}
          max={300}
          step={5}
          unit="%"
          onChange={(pct) =>
            updateShot(activeShot.id, (s) => ({
              ...s,
              light: { ...s.light, intensity: Number((pct / 100).toFixed(2)) },
            }))
          }
        />
        <ScrubInput
          label="Temp"
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
        <ScrubInput
          label="Fill"
          value={Math.round((light.ambience ?? 0.75) * 100)}
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

      {/* Additional Independently Editable Light Sources */}
      <div className="pt-2 border-t border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#71717a]">Additional Sources</span>
          <select
            aria-label="Add light source type"
            className="rounded-md bg-[#1c1c1f] border border-white/[0.06] px-2 py-1 text-[10px] text-white outline-none cursor-pointer"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              const type = e.target.value as LightSourceType;
              updateShot(activeShot.id, (shot) => ({
                ...shot,
                light: {
                  ...shot.light,
                  sources: [
                    ...(shot.light.sources || []),
                    {
                      id: `light-${Date.now()}`,
                      name: `${type[0].toUpperCase()}${type.slice(1)} Light`,
                      type,
                      enabled: true,
                      position: { ...shot.light.position },
                      intensity: 1,
                      color: '#ffffff',
                      temperature: 6100,
                      distance: 8,
                      angle: Math.PI / 5,
                      penumbra: 0.35,
                      width: 2,
                      height: 2,
                    },
                  ],
                },
              }));
              e.currentTarget.value = '';
            }}
          >
            <option value="">+ Add source...</option>
            <option value="point">Point light</option>
            <option value="directional">Directional light</option>
            <option value="spot">Spot light</option>
            <option value="area">Area light</option>
            <option value="ambient">Ambient light</option>
          </select>
        </div>

        {(activeShot.light?.sources || []).map((source) => (
          <div
            key={source.id}
            className="rounded-lg border border-white/[0.06] bg-[#18181b] p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-white">
              <span className="truncate">
                {source.name}{' '}
                <span className="text-[10px] text-[#71717a]">
                  ({source.type})
                </span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <ColorField
                  aria-label={`${source.name} color`}
                  value={source.color}
                  onChange={(e) =>
                    updateShot(activeShot.id, (shot) => ({
                      ...shot,
                      light: {
                        ...shot.light,
                        sources: (shot.light?.sources || []).map((l) =>
                          l.id === source.id
                            ? { ...l, color: e.target.value }
                            : l
                        ),
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  className="text-[10px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  onClick={() =>
                    updateShot(activeShot.id, (shot) => ({
                      ...shot,
                      light: {
                        ...shot.light,
                        sources: (shot.light?.sources || []).filter(
                          (l) => l.id !== source.id
                        ),
                      },
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            </div>

            <label className="flex items-center gap-1.5 text-[10px] text-[#a1a1aa] cursor-pointer">
              <input
                type="checkbox"
                checked={source.enabled}
                onChange={(e) =>
                  updateShot(activeShot.id, (shot) => ({
                    ...shot,
                    light: {
                      ...shot.light,
                      sources: (shot.light?.sources || []).map((l) =>
                        l.id === source.id
                          ? { ...l, enabled: e.target.checked }
                          : l
                      ),
                    },
                  }))
                }
              />
              <span>Enabled</span>
            </label>

            <div className="grid grid-cols-3 gap-1.5">
              <ScrubInput
                label="X"
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
                label="Y"
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
                label="Z"
                value={Math.round((source.position?.z ?? 0) * 100)}
                min={-200}
                max={200}
                step={2}
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

            <ScrubInput
              label="Source Intensity"
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
          </div>
        ))}
      </div>

      {/* Selected Light Animation Block Inspector */}
      {selectedLightBlock && (
        <div className="pt-2 border-t border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-300">
              {selectedLightBlock.label || 'Light Sweep Block'}
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
              label="Dur"
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
              min={-100}
              max={100}
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
              min={-100}
              max={100}
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
              min={-100}
              max={100}
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
              min={-100}
              max={100}
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
              max={250}
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
              max={250}
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
        </div>
      )}
    </div>
  );
};
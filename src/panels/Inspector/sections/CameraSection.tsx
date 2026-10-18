// src/panels/Inspector/sections/CameraSection.tsx
import React from 'react';
import { Camera, Film, Plus, X } from 'lucide-react';
import type { Shot, CameraKeyframeEndpoint } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSelectionStore } from '../../../store/useSelectionStore';
import { ScrubInput } from '../../../ui/ScrubInput';

interface CameraSectionProps {
  activeShot: Shot;
}

export const CameraSection: React.FC<CameraSectionProps> = ({ activeShot }) => {
  const { updateShot } = useProjectStore();
  const { selectedCameraBlockId, selectCameraBlock, setTimelineView } =
    useSelectionStore();

  const selectedBlock = activeShot.cameraBlocks?.find(
    (cb) => cb.id === selectedCameraBlockId
  );

  const defaultEndpoint: CameraKeyframeEndpoint = {
    anchorX: 0,
    anchorY: 0,
    zoom: 1,
    roll: 0,
    orbit: 0,
    tilt: 0,
  };

  const handleAddCameraMove = () => {
    const camId = `cam-blk-${Date.now()}`;
    updateShot(activeShot.id, (s) => ({
      ...s,
      cameraBlocks: [
        ...(s.cameraBlocks || []),
        {
          id: camId,
          label: 'Camera Move',
          startMs: 0,
          durationMs: s.durationMs,
          fromFramingId: s.framings[0]?.id || 'f1',
          toFramingId: s.framings[1]?.id || 'f2',
          mode: 'dolly',
          easing: { kind: 'preset', name: 'ease-in-out' },
          from: {
            anchorX: 0,
            anchorY: 0,
            zoom: 1,
            roll: 0,
            orbit: 0,
            tilt: 0,
          },
          to: {
            anchorX: -0.05,
            anchorY: 0.02,
            zoom: 1.15,
            roll: 0,
            orbit: 0,
            tilt: 0,
          },
          shake: { from: 0, to: 0 },
        },
      ],
    }));
    selectCameraBlock(camId);
    setTimelineView('scene');
  };

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#e4e4e7]">
          <Camera className="w-3.5 h-3.5 text-[#0088ff]" />
          Camera Rig
        </span>
        <button
          type="button"
          onClick={handleAddCameraMove}
          className="px-2 py-0.5 rounded bg-[#0088ff]/15 hover:bg-[#0088ff]/25 text-[#0088ff] text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
        >
          <Plus className="w-3 h-3" />
          <span>Add Move</span>
        </button>
      </div>

      {/* List Existing Camera Moves */}
      {activeShot.cameraBlocks && activeShot.cameraBlocks.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] text-[#a1a1aa] block">
            Camera Motion Blocks
          </span>
          {activeShot.cameraBlocks.map((cb, idx) => (
            <div
              key={cb.id}
              onClick={() => selectCameraBlock(cb.id)}
              className={`p-2 rounded-lg bg-[#18181b] border transition flex items-center justify-between cursor-pointer ${
                selectedCameraBlockId === cb.id
                  ? 'border-[#0088ff]/60 bg-[#0088ff]/10'
                  : 'border-white/[0.06] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="text-[11px] font-medium text-white truncate">
                    {cb.label || `Move #${idx + 1}`}
                  </div>
                  <div className="text-[9px] text-[#a1a1aa]">
                    {cb.startMs}ms – {cb.startMs + cb.durationMs}ms ({cb.mode})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateShot(activeShot.id, (s) => ({
                    ...s,
                    cameraBlocks: (s.cameraBlocks || []).filter(
                      (b) => b.id !== cb.id
                    ),
                  }));
                  if (selectedCameraBlockId === cb.id) {
                    selectCameraBlock(null);
                  }
                }}
                className="p-1 text-[#a1a1aa] hover:text-rose-400 cursor-pointer shrink-0"
                title="Delete Move"
                aria-label={`Delete ${cb.label || 'Camera Move'} #${idx + 1} (${(cb.startMs / 1000).toFixed(1)}s - {((cb.startMs + cb.durationMs) / 1000).toFixed(1)}s)`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[#a1a1aa] leading-relaxed">
          Add a Camera Move to enable 3D Dolly, Zoom, Pan, Orbit, and Handheld moves on this shot.
        </p>
      )}

      {/* Selected Camera Block Controls */}
      {selectedBlock && (
        <div className="p-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#0088ff]">
              Active Move Settings
            </span>
            <span className="text-[9px] text-[#a1a1aa] capitalize">
              {selectedBlock.mode}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="Start"
              value={selectedBlock.startMs}
              min={0}
              max={activeShot.durationMs - 100}
              step={20}
              unit=" ms"
              onChange={(startMs) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  cameraBlocks: (s.cameraBlocks || []).map((b) =>
                    b.id === selectedBlock.id ? { ...b, startMs } : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="Dur"
              value={selectedBlock.durationMs}
              min={100}
              max={activeShot.durationMs}
              step={20}
              unit=" ms"
              onChange={(durationMs) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  cameraBlocks: (s.cameraBlocks || []).map((b) =>
                    b.id === selectedBlock.id ? { ...b, durationMs } : b
                  ),
                }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="From Zoom"
              value={Math.round(((selectedBlock.from?.zoom) ?? 1) * 100)}
              min={25}
              max={300}
              step={5}
              unit="%"
              onChange={(pct) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  cameraBlocks: (s.cameraBlocks || []).map((b) =>
                    b.id === selectedBlock.id
                      ? {
                          ...b,
                          from: {
                            ...(b.from || defaultEndpoint),
                            zoom: Number((pct / 100).toFixed(2)),
                          },
                        }
                      : b
                  ),
                }))
              }
            />
            <ScrubInput
              label="To Zoom"
              value={Math.round(((selectedBlock.to?.zoom) ?? 1.15) * 100)}
              min={25}
              max={300}
              step={5}
              unit="%"
              onChange={(pct) =>
                updateShot(activeShot.id, (s) => ({
                  ...s,
                  cameraBlocks: (s.cameraBlocks || []).map((b) =>
                    b.id === selectedBlock.id
                      ? {
                          ...b,
                          to: {
                            ...(b.to || defaultEndpoint),
                            zoom: Number((pct / 100).toFixed(2)),
                          },
                        }
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

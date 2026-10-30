import React from 'react';
import { Activity, ChevronDown, ChevronRight, Music, Plus, Sun, Video, Volume2, VolumeX } from 'lucide-react';
import { IconButton } from '../../ui/primitives';
import type { Project, Shot } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { LayerIcon } from './LayerIcon';

type ProjectState = ReturnType<typeof useProjectStore.getState>;
type SelectionState = ReturnType<typeof useSelectionStore.getState>;

type LeftTimelineRackProps = {
    activeShot: Shot;
    project: Project;
    timelineView: SelectionState['timelineView'];
    timelineHeightPx: number;
    timelineScrollTop: number;
    selectedLayerSet: Set<string>;
    expandedTimelineLayerSet: Set<string>;
    selectedCameraBlockId: string | null;
    selectedPresetType: SelectionState['selectedPresetType'];
    selectedBlockId: string | null;
    hasLightBlocks: boolean;
    toggleProjectAudioMuted: ProjectState['toggleProjectAudioMuted'];
    addLayerToShot: ProjectState['addLayerToShot'];
    addCameraBlockToShot: ProjectState['addCameraBlockToShot'];
    setTimelineScrollTop: SelectionState['setTimelineScrollTop'];
    setInspectorTab: SelectionState['setInspectorTab'];
    selectLayer: SelectionState['selectLayer'];
    selectCameraBlock: SelectionState['selectCameraBlock'];
    toggleTimelineLayerExpanded: SelectionState['toggleTimelineLayerExpanded'];
    selectPreset: SelectionState['selectPreset'];
    selectBlock: SelectionState['selectBlock'];
};

export const LeftTimelineRack: React.FC<LeftTimelineRackProps> = ({
    activeShot,
    project,
    timelineView,
    timelineHeightPx,
    timelineScrollTop,
    selectedLayerSet,
    expandedTimelineLayerSet,
    selectedCameraBlockId,
    selectedPresetType,
    selectedBlockId,
    hasLightBlocks,
    toggleProjectAudioMuted,
    addLayerToShot,
    addCameraBlockToShot,
    setTimelineScrollTop,
    setInspectorTab,
    selectLayer,
    selectCameraBlock,
    toggleTimelineLayerExpanded,
    selectPreset,
    selectBlock,
}) => {
    const hasCameraBlocks = (activeShot.cameraBlocks?.length || 0) > 0;

    return (
        <>                    {timelineView === 'scene' && (
                        <div
                            style={{ height: `${timelineHeightPx}px` }}
                            className="border-t border-subtle bg-app flex flex-col shrink-0"
                        >
                            {/* Header Spacer matching Timeline Transport (h-8) + Ruler (h-6) = 56px (h-14) */}
                            <div className="h-14 border-b border-subtle px-3 flex items-center text-[10px] font-mono text-muted-foreground shrink-0">
                                <span className="truncate">{activeShot.name} TRACKS</span>
                            </div>

                            {/* Track labels move with the main timeline scroll; only the timeline owns a scrollbar. */}
                            <div
                                className="flex-1 overflow-hidden"
                                onWheel={(event) => {
                                    event.preventDefault();
                                    const timelineScroller = document.getElementById('timeline-tracks-scroll');
                                    if (timelineScroller) {
                                        timelineScroller.scrollTop += event.deltaY;
                                    } else {
                                        setTimelineScrollTop(Math.max(0, timelineScrollTop + event.deltaY));
                                    }
                                }}
                            >
                                <div
                                    style={{ transform: `translate3d(0, -${timelineScrollTop}px, 0)` }}
                                    className="px-1.5 py-2 flex flex-col gap-0.5"
                                >
                                {/* 0. Media Track Row (Matching Timeline Media row when audio/video clips exist!) */}
                                {(project.audio?.clips?.length || 0) > 0 && (
                                    <div
                                        className="h-7 mb-2 px-2 rounded-md bg-white/[0.025] border border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400"
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Music className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                                            <span className="truncate">Media</span>
                                        </div>
                                        <IconButton
                                            unstyled
                                            tooltip={false}
                                            label={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                            icon={<>
                                                {project.audio?.muted ? (
                                                    <VolumeX className="w-3 h-3 text-rose-400" />
                                                ) : (
                                                    <Volume2 className="w-3 h-3 text-slate-300" />
                                                )}
                                            </>}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleProjectAudioMuted();
                                            }}
                                            title={project.audio?.muted ? "Unmute audio" : "Mute audio"}
                                            className="p-1 hover:text-white cursor-pointer"
                                        />
                                    </div>
                                )}

                                {/* Add-layer lane is first in the scene timeline. */}
                                <button
                                    onClick={() => {
                                        const layer = addLayerToShot(activeShot.id, 'shape');
                                        selectLayer(layer.id);
                                        setInspectorTab('layer');
                                    }}
                                    className="order-0 h-10 rounded-lg border border-[#087fad] px-2 flex items-center gap-1.5 text-[10px] text-[#91a9b5] hover:border-[#12b8f5] hover:bg-sky-500/[0.07] hover:text-sky-100 cursor-pointer transition"
                                >
                                    <Plus className="w-3 h-3 text-sky-400" />
                                    <span>Add layer</span>
                                </button>

                                {/* Camera track stays visible even before its first move is added. */}
                                <div
                                    onClick={() => {
                                        if (activeShot.cameraBlocks && activeShot.cameraBlocks.length > 0) {
                                            selectCameraBlock(activeShot.cameraBlocks[0].id);
                                        } else {
                                            const block = addCameraBlockToShot(activeShot.id);
                                            if (block) selectCameraBlock(block.id);
                                        }
                                    }}
                                    style={{ order: 30 }}
                                    className={`h-10 px-2 rounded-md flex items-center gap-1.5 text-[11px] cursor-pointer transition ${selectedCameraBlockId
                                        ? 'bg-emerald-600/30 text-emerald-200 font-semibold border border-emerald-500/40'
                                        : hasCameraBlocks
                                            ? 'text-emerald-400 hover:bg-white/[0.04]'
                                            : 'text-muted-foreground hover:text-emerald-300 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <Video className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">Camera</span>
                                </div>

                                {/* 2. Light Track Row (ONLY shown when Light animation is added) */}
                                {hasLightBlocks && (
                                    <div style={{ order: 20 }} className="h-10 px-2 rounded-md flex items-center gap-1.5 text-[11px] text-red-300 hover:bg-white/[0.04] cursor-pointer">
                                        <Sun className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                        <span className="truncate">Lighting Rig</span>
                                    </div>
                                )}

                                {/* 3. Layer Track Rows + Indented ♦ Presets & ♦ Property Sub-rows */}
                                {activeShot.layers
                                    .slice()
                                    .sort((a, b) => b.order - a.order)
                                    .map((layer) => {
                                        const isSelected = selectedLayerSet.has(layer.id);
                                        const hasAnimItems =
                                            layer.entrance.type !== 'none' ||
                                            layer.exit.type !== 'none' ||
                                            layer.blocks.length > 0;
                                        const isExpanded =
                                            expandedTimelineLayerSet.has(layer.id) ||
                                            (isSelected && hasAnimItems);

                                        return (
                                            <div key={`mirror-${layer.id}`} style={{ order: 10 }} className="space-y-0.5">
                                                {/* Main Layer Row (h-7 = 28px) */}
                                                <div
                                                    onClick={() => {
                                                        setInspectorTab('layer');
                                                        selectLayer(layer.id, false);
                                                    }}
                                                    className={`h-10 px-2 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition ${isSelected
                                                        ? 'bg-brand-blue text-white font-semibold'
                                                        : 'text-muted-foreground hover:bg-white/[0.04]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        <IconButton
                                                            unstyled
                                                            tooltip={false}
                                                            label="Open options"
                                                            icon={<>
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-3 h-3" />
                                                                ) : (
                                                                    <ChevronRight className="w-3 h-3" />
                                                                )}
                                                            </>}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTimelineLayerExpanded(layer.id);
                                                            }}
                                                            className="p-0.5 cursor-pointer"
                                                        />
                                                        <LayerIcon layer={layer} isSelected={isSelected} />
                                                        <span className="truncate">{layer.name}</span>
                                                    </div>

                                                    {hasAnimItems && (
                                                        <IconButton
                                                            unstyled
                                                            tooltip={false}
                                                            label={`Toggle ${layer.name} animations`}
                                                            icon={<>
                                                                <Activity className="w-3 h-3" />
                                                            </>}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleTimelineLayerExpanded(layer.id);
                                                            }}
                                                            className={`p-0.5 rounded ${isSelected
                                                            ? 'text-white'
                                                            : 'text-[#8b5cf6] bg-[#8b5cf6]/15'
                                                            }`}
                                                        />
                                                    )}
                                                </div>

                                                {/* Sub-rows UNDER the layer name (h-6 = 24px each, matching Timeline sub-rows!) */}
                                                {isExpanded && (
                                                    <div className="space-y-0.5">
                                                        {/* ♦ Presets sub-row (In / Out transitions) */}
                                                        <div
                                                            onClick={() =>
                                                                selectPreset('entrance', layer.id)
                                                            }
                                                            className={`h-9 pl-7 pr-2 rounded flex items-center justify-between text-[10px] cursor-pointer ${isSelected && selectedPresetType
                                                                ? 'bg-purple-500/20 text-purple-200 font-medium'
                                                                : 'text-muted-foreground hover:text-white'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="w-1.5 h-1.5 rotate-45 bg-[#8b5cf6] shrink-0" />
                                                                <span>Presets</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono tracking-tight opacity-60">
                                                                In/Out
                                                            </span>
                                                        </div>

                                                        {/* ♦ Property Block sub-rows (Position, Tilt, Scale, etc.) */}
                                                        {layer.blocks.map((blk) => (
                                                            <div
                                                                key={blk.id}
                                                                onClick={() => selectBlock(blk.id, layer.id)}
                                                                className={`h-9 pl-7 pr-2 rounded flex items-center justify-between text-[10px] cursor-pointer capitalize ${selectedBlockId === blk.id
                                                                    ? 'bg-purple-500/25 text-white font-medium'
                                                                    : 'text-muted-foreground hover:text-white'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <span className="w-1.5 h-1.5 rotate-45 bg-[#a855f7] shrink-0" />
                                                                    <span className="truncate">
                                                                        {blk.property}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                </div>
                            </div>
                        </div>
                    )}
        </>
    );
};

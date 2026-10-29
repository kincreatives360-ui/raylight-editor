import React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { IconButton } from '../../ui/primitives';
import type { AnimationBlock, CameraBlock, Easing, Layer, LightAnimationBlock, Shot } from '../../model/types';
import { copyTimelineBlock } from '../../utils/editorClipboard';
import { TimelineDragPreview } from './TimelineDragPreview';
import { TimelineEasingCurve } from './TimelineEasingCurve';
import { TimelineRangeBar, TrimHandle } from './TimelineRangeBar';
import { TransitionPill } from './TransitionPill';
import { getTimelineTransition, updateTimelineTransition } from './transitionSync';
import type { TimelineContextMenuState, TimelineEasingPopoverTarget, TimelineGhostDragPreview } from './timelineTypes';

interface TimelineSceneTracksProps {
    activeShot: Shot;
    pxPerMs: number;
    addLayerLaneWidth: number;
    addLayerGhostWidth: number;
    addLayerGhostLeft: number;
    addLayerHoverX: number | null;
    setAddLayerHoverX: (x: number | null) => void;
    onAddLayer: () => void;
    setInspectorTab: (tab: 'shot' | 'layer') => void;
    hoverCameraTimeMs: number | null;
    setHoverCameraTimeMs: (timeMs: number | null) => void;
    clientXToLocalMs: (clientX: number) => number;
    addCameraBlockAtTime: (timeMs: number) => void;
    selectedCameraBlockId: string | null;
    selectCameraBlock: (id: string | null) => void;
    updateShot: (shotId: string, updater: (shot: Shot) => Shot) => void;
    setContextMenu: (menu: TimelineContextMenuState | null) => void;
    setEasingPopoverTarget: (target: TimelineEasingPopoverTarget | null) => void;
    startCameraBlockDrag: (event: React.PointerEvent, shot: Shot, block: CameraBlock, mode: 'move' | 'left' | 'right') => void;
    ghostDragPreview: TimelineGhostDragPreview | null;
    hasLightBlocks: boolean;
    selectedLightBlockId: string | null;
    selectLightBlock: (id: string | null) => void;
    startLightBlockDrag: (event: React.PointerEvent, shot: Shot, block: LightAnimationBlock, mode: 'move' | 'left' | 'right') => void;
    selectedLayerSet: ReadonlySet<string>;
    expandedTimelineLayerSet: ReadonlySet<string>;
    startLayerBarDrag: (event: React.PointerEvent, shot: Shot, layer: Layer, mode: 'move' | 'in' | 'out') => void;
    updateLayer: (shotId: string, layerId: string, updater: (layer: Layer) => Layer) => void;
    selectPreset: (type: 'entrance' | 'exit', layerId?: string) => void;
    selectedPresetType: string | null;
    suppressPillClickRef: React.MutableRefObject<string | null>;
    startPresetDrag: (event: React.PointerEvent, shot: Shot, layer: Layer, side: 'entrance' | 'exit', mode: 'move' | 'left' | 'right') => void;
    selectedBlockId: string | null;
    selectBlock: (id: string | null, layerId?: string) => void;
    startBlockDrag: (event: React.PointerEvent, shot: Shot, layer: Layer, block: AnimationBlock, mode: 'move' | 'left' | 'right') => void;
    setTimelineView: (view: 'video' | 'scene') => void;
}

export function TimelineSceneTracks(props: TimelineSceneTracksProps) {
    const {
        activeShot, pxPerMs, addLayerLaneWidth, addLayerGhostWidth, addLayerGhostLeft,
        addLayerHoverX, setAddLayerHoverX, onAddLayer, setInspectorTab, hoverCameraTimeMs, setHoverCameraTimeMs,
        clientXToLocalMs, addCameraBlockAtTime, selectedCameraBlockId, selectCameraBlock,
        updateShot, setContextMenu, setEasingPopoverTarget, startCameraBlockDrag,
        ghostDragPreview, hasLightBlocks, selectedLightBlockId, selectLightBlock,
        startLightBlockDrag, selectedLayerSet, expandedTimelineLayerSet,
        startLayerBarDrag, updateLayer, selectPreset,
        selectedPresetType, suppressPillClickRef, startPresetDrag,
        selectedBlockId, selectBlock, startBlockDrag, setTimelineView,
    } = props;

    return (
        <div className="relative flex flex-col gap-0.5">
            {/* Raylight exposes the add-layer lane before the layer rows. */}
            <button
                type="button"
                aria-label="Add layer to the open shot"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    setAddLayerHoverX(Math.max(0, Math.min(addLayerLaneWidth, event.clientX - bounds.left)));
                }}
                onPointerLeave={() => setAddLayerHoverX(null)}
                onClick={(e) => {
                    e.stopPropagation();
                    onAddLayer();
                }}
                title="Add a layer to this shot"
                style={{ order: 0, width: `${addLayerLaneWidth}px` }}
                className="h-10 shrink-0 relative overflow-hidden flex items-center justify-center rounded-lg border border-transparent bg-transparent text-[10px] text-[#8495a8] hover:text-sky-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-700 cursor-pointer"
            >
                {addLayerHoverX === null ? (
                    <span>+ Add layer</span>
                ) : (
                    <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-8 rounded-md border border-dotted border-sky-400/80 bg-sky-400/[0.06] text-sky-100 flex items-center justify-center pointer-events-none"
                        style={{
                            width: `${addLayerGhostWidth}px`,
                            transform: `translate3d(${addLayerGhostLeft}px, -50%, 0)`,
                        }}
                    >
                        + Add layer
                    </span>
                )}
            </button>

            {/* Camera track: always present, with a hover preview in empty space. */}
            <div
                onPointerDown={(e) => e.stopPropagation()}
                onMouseMove={(e) => {
                    e.stopPropagation();
                    setHoverCameraTimeMs(clientXToLocalMs(e.clientX));
                }}
                onMouseLeave={() => setHoverCameraTimeMs(null)}
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-cam-pill]')) return;
                    addCameraBlockAtTime(clientXToLocalMs(e.clientX));
                }}
                title="Hover to preview a camera move; click to add it"
                aria-label="Camera track"
                style={{ order: 30 }}
                className="h-10 relative flex items-center cursor-pointer"
            >
                    {hoverCameraTimeMs !== null && !activeShot.cameraBlocks.some((block) =>
                        hoverCameraTimeMs >= block.startMs &&
                        hoverCameraTimeMs <= block.startMs + block.durationMs
                    ) && (
                        <div
                            aria-hidden="true"
                            className="absolute top-1 bottom-1 rounded-md border border-dashed border-emerald-400/80 bg-emerald-400/10 pointer-events-none"
                            style={{
                                left: `${hoverCameraTimeMs * pxPerMs}px`,
                                width: `${Math.max(24, Math.min(1000, activeShot.durationMs - hoverCameraTimeMs) * pxPerMs)}px`,
                            }}
                        />
                    )}
                    {activeShot.cameraBlocks.map((cb) => {
                        const isCamSelected = selectedCameraBlockId === cb.id;
                        const left = cb.startMs * pxPerMs;
                        const width = Math.max(36, cb.durationMs * pxPerMs);
                        const modeLabel =
                            cb.mode === 'dollyzoom'
                                ? 'WARP'
                                : cb.mode.toUpperCase();
                        return (
                            <React.Fragment key={cb.id}>
                                <TimelineRangeBar
                                    data-cam-pill="true"
                                    tone="camera"
                                    selected={isCamSelected}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selectCameraBlock(cb.id);
                                        const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            items: [
                                                { type: 'header', label: `${modeLabel} Camera Move` },
                                                {
                                                    id: 'edit-easing',
                                                    label: 'Edit easing',
                                                    shortcut: '↵',
                                                    onClick: () => {
                                                        selectCameraBlock(cb.id);
                                                        setEasingPopoverTarget({
                                                            easing: cb.easing,
                                                            onChange: (easing) => {
                                                                updateShot(activeShot.id, (s) => ({
                                                                    ...s,
                                                                    cameraBlocks: s.cameraBlocks.map((b) =>
                                                                        b.id === cb.id ? { ...b, easing } : b
                                                                    ),
                                                                }));
                                                            },
                                                            anchorRect: targetRect,
                                                        });
                                                    },
                                                },
                                                {
                                                    id: 'copy',
                                                    label: 'Copy',
                                                    icon: Copy,
                                                    shortcut: '⌘C',
                                                    onClick: () => copyTimelineBlock({ type: 'camera', block: cb }),
                                                },
                                                {
                                                    id: 'dup',
                                                    label: 'Duplicate',
                                                    shortcut: '⌘D',
                                                    onClick: () => {
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            cameraBlocks: [
                                                                ...s.cameraBlocks,
                                                                {
                                                                    ...cb,
                                                                    id: `cam-blk-${Date.now()}`,
                                                                    startMs: Math.min(s.durationMs - cb.durationMs, cb.startMs + 50),
                                                                },
                                                            ],
                                                        }));
                                                    },
                                                },
                                                { type: 'divider' },
                                                {
                                                    id: 'del',
                                                    label: 'Remove',
                                                    icon: Trash2,
                                                    shortcut: '⌫',
                                                    danger: true,
                                                    onClick: () => {
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            cameraBlocks: s.cameraBlocks.filter((b) => b.id !== cb.id),
                                                        }));
                                                        if (selectedCameraBlockId === cb.id) selectCameraBlock(null);
                                                    },
                                                },
                                            ],
                                        });
                                    }}
                                    onPointerDown={(e) =>
                                        startCameraBlockDrag(e, activeShot, cb, 'move')
                                    }
                                    left={left} width={width}
                                    title={`${modeLabel} · ${(cb.durationMs / 1000).toFixed(2)}s`}
                                    className={`absolute top-0.5 bottom-0.5 px-2.5 flex items-center justify-between text-[10px] font-medium cursor-grab active:cursor-grabbing ${
                                        ghostDragPreview?.id === cb.id ? 'opacity-40' : ''
                                    }`}
                                >
                                    <TimelineEasingCurve easing={cb.easing} tone="camera" selected={isCamSelected} />
                                    <span className="relative z-10 pointer-events-none drop-shadow-sm">{modeLabel}</span>
                                    <TrimHandle side="left"
                                        onPointerDown={(e) =>
                                            startCameraBlockDrag(e, activeShot, cb, 'left')
                                        }
                                        className="w-2.5 bg-white/20 hover:bg-emerald-300 rounded-l-full z-10" />
                                    <TrimHandle side="right"
                                        onPointerDown={(e) =>
                                            startCameraBlockDrag(e, activeShot, cb, 'right')
                                        }
                                        className="w-2.5 bg-white/20 hover:bg-emerald-300 rounded-r-full z-10" />
                                </TimelineRangeBar>
                                {ghostDragPreview && ghostDragPreview.id === cb.id && (
                                    <TimelineDragPreview
                                        startMs={ghostDragPreview.startMs}
                                        durationMs={ghostDragPreview.durationMs}
                                        snapped={ghostDragPreview.snapped}
                                        pxPerMs={pxPerMs}
                                        minWidth={36}
                                        variant="pill"
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
            </div>

            {/* 2. Light Track Row (h-7 = 28px, ONLY rendered when Light blocks exist) */}
            {hasLightBlocks && (
                <div style={{ order: 20 }} className="h-10 relative flex items-center">
                    {(activeShot.lightBlocks || []).map((lb) => {
                        const isLightSelected = selectedLightBlockId === lb.id;
                        const left = lb.startMs * pxPerMs;
                        const width = Math.max(36, lb.durationMs * pxPerMs);
                        return (
                            <React.Fragment key={lb.id}>
                                <TimelineRangeBar
                                    data-light-pill="true"
                                    tone="light"
                                    selected={isLightSelected}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        selectLightBlock(lb.id);
                                        const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            items: [
                                                { type: 'header', label: lb.label || 'Light Key' },
                                                {
                                                    id: 'edit-easing',
                                                    label: 'Edit easing',
                                                    shortcut: '↵',
                                                    onClick: () => {
                                                        selectLightBlock(lb.id);
                                                        setEasingPopoverTarget({
                                                            easing: lb.easing,
                                                            onChange: (easing) => {
                                                                updateShot(activeShot.id, (s) => ({
                                                                    ...s,
                                                                    lightBlocks: (s.lightBlocks || []).map((b) =>
                                                                        b.id === lb.id ? { ...b, easing } : b
                                                                    ),
                                                                }));
                                                            },
                                                            anchorRect: targetRect,
                                                        });
                                                    },
                                                },
                                                {
                                                    id: 'copy',
                                                    label: 'Copy',
                                                    icon: Copy,
                                                    shortcut: '⌘C',
                                                    onClick: () => copyTimelineBlock({ type: 'light', block: lb }),
                                                },
                                                {
                                                    id: 'dup',
                                                    label: 'Duplicate',
                                                    shortcut: '⌘D',
                                                    onClick: () => {
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            lightBlocks: [
                                                                ...(s.lightBlocks || []),
                                                                {
                                                                    ...lb,
                                                                    id: `light-blk-${Date.now()}`,
                                                                    startMs: Math.min(s.durationMs - lb.durationMs, lb.startMs + 50),
                                                                },
                                                            ],
                                                        }));
                                                    },
                                                },
                                                { type: 'divider' },
                                                {
                                                    id: 'del',
                                                    label: 'Remove',
                                                    icon: Trash2,
                                                    shortcut: '⌫',
                                                    danger: true,
                                                    onClick: () => {
                                                        updateShot(activeShot.id, (s) => ({
                                                            ...s,
                                                            lightBlocks: (s.lightBlocks || []).filter((b) => b.id !== lb.id),
                                                        }));
                                                        if (selectedLightBlockId === lb.id) selectLightBlock(null);
                                                    },
                                                },
                                            ],
                                        });
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectLightBlock(lb.id);
                                        setInspectorTab('shot');
                                    }}
                                    onPointerDown={(e) =>
                                        startLightBlockDrag(e, activeShot, lb, 'move')
                                    }
                                    left={left} width={width}
                                    title={`${lb.label || 'Light animation'} · ${(lb.durationMs / 1000).toFixed(2)}s`}
                                    className={`group/light absolute top-0.5 bottom-0.5 px-2.5 flex items-center justify-between text-[10px] font-medium cursor-grab active:cursor-grabbing ${
                                        ghostDragPreview?.id === lb.id ? 'opacity-40' : ''
                                    }`}
                                >
                                    <TimelineEasingCurve easing={lb.easing} tone="light" selected={isLightSelected} />
                                    <span className="relative z-10 pointer-events-none drop-shadow-sm truncate max-w-[calc(100%-30px)]">{lb.label || 'Light'}</span>
                                    <IconButton
                                        unstyled
                                        tooltip={false}
                                        label="Delete light block"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateShot(activeShot.id, (s) => ({
                                                ...s,
                                                lightBlocks: (s.lightBlocks || []).filter(
                                                    (b) => b.id !== lb.id
                                                ),
                                            }));
                                            if (selectedLightBlockId === lb.id) {
                                                selectLightBlock(null);
                                            }
                                        }}
                                        title="Delete light block"
                                        className="w-3.5 h-3.5 rounded-full hover:bg-rose-500/80 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover/light:opacity-100 transition cursor-pointer ml-1 z-10"
                                        icon={<>&times;</>}
                                    />
                                    <TrimHandle side="left"
                                        onPointerDown={(e) =>
                                            startLightBlockDrag(e, activeShot, lb, 'left')
                                        }
                                        className="w-2.5 bg-white/20 hover:bg-amber-300 rounded-l-full z-10" />
                                    <TrimHandle side="right"
                                        onPointerDown={(e) =>
                                            startLightBlockDrag(e, activeShot, lb, 'right')
                                        }
                                        className="w-2.5 bg-white/20 hover:bg-amber-300 rounded-r-full z-10" />
                                </TimelineRangeBar>
                                {ghostDragPreview && ghostDragPreview.id === lb.id && (
                                    <TimelineDragPreview
                                        startMs={ghostDragPreview.startMs}
                                        durationMs={ghostDragPreview.durationMs}
                                        snapped={ghostDragPreview.snapped}
                                        pxPerMs={pxPerMs}
                                        minWidth={36}
                                        variant="pill"
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* 3. Layer Track Rows (h-7 = 28px) + Indented Sub-rows (h-6 = 24px) */}
                {activeShot.layers
                .slice()
                .sort((a, b) => b.order - a.order)
                .map((layer) => {
                    const isSelected = selectedLayerSet.has(layer.id);
                    const hasAnimations =
                        layer.blocks.length > 0 ||
                        getTimelineTransition(layer, 'entrance').type !== 'none' ||
                        getTimelineTransition(layer, 'exit').type !== 'none';
                    const isExpanded =
                        expandedTimelineLayerSet.has(layer.id) ||
                        (isSelected && hasAnimations);

                    const left = layer.inMs * pxPerMs;
                    const width = Math.max(
                        32,
                        (layer.outMs - layer.inMs) * pxPerMs
                    );

                    const barStyle = layer.kind === 'shape'
                        ? isSelected
                            ? 'border-[#7773ff] bg-gradient-to-b from-[#1b1b3c]/95 to-[#0c1023]/95 shadow-[inset_0_0_20px_rgba(99,102,241,0.12)]'
                            : 'border-[#4b4bc3] bg-gradient-to-b from-[#17172e]/90 to-[#0b1020]/95 hover:border-[#7773ff]'
                        : isSelected
                            ? 'border-[#16b8f4] bg-gradient-to-b from-[#0b2938]/95 to-[#08151e]/95 shadow-[inset_0_0_20px_rgba(14,165,233,0.12)]'
                            : 'border-[#087fad] bg-gradient-to-b from-[#0a222e]/90 to-[#07141d]/95 hover:border-[#16b8f4]';

                    const entStartMs =
                        layer.inMs + (getTimelineTransition(layer, 'entrance').delayMs || 0);
                    const entDurMs = Math.max(80, getTimelineTransition(layer, 'entrance').durationMs || 500);

                    const extDurMs = Math.max(80, getTimelineTransition(layer, 'exit').durationMs || 500);
                    const extEndMs = layer.outMs - (getTimelineTransition(layer, 'exit').delayMs || 0);
                    const extStartMs = Math.max(layer.inMs, extEndMs - extDurMs);

                    return (
                        <div key={layer.id} style={{ order: 10 }} className="space-y-0.5">
                            {/* Main layer bars use the same 40px track height as the reference. */}
                            <div className="h-10 relative flex items-center">
                                <TimelineRangeBar
                                    onPointerDown={(e) =>
                                        startLayerBarDrag(e, activeShot, layer, 'move')
                                    }
                                    left={left} width={width}
                                    aria-label={`${layer.name} layer bar`}
                                    title={`${layer.name} · ${(layer.outMs - layer.inMs) / 1000}s`}
                                    className={`absolute top-0.5 bottom-0.5 overflow-hidden rounded-lg border cursor-grab active:cursor-grabbing transition ${barStyle} ${
                                        ghostDragPreview?.id === layer.id ? 'opacity-40' : ''
                                    }`}
                                >
                                    <TrimHandle side="left"
                                        onPointerDown={(e) =>
                                            startLayerBarDrag(e, activeShot, layer, 'in')
                                        }
                                        title="Drag left edge to trim layer In point"
                                        className="w-2.5 hover:bg-white/30 rounded-l-lg" />
                                    <TrimHandle side="right"
                                        onPointerDown={(e) =>
                                            startLayerBarDrag(e, activeShot, layer, 'out')
                                        }
                                        title="Drag right edge to trim layer Out point"
                                        className="w-2.5 hover:bg-white/30 rounded-r-lg" />
                                </TimelineRangeBar>

                                {/* Dashed Ghost Outline during Layer Drag */}
                                {ghostDragPreview && ghostDragPreview.id === layer.id && (
                                    <TimelineDragPreview startMs={ghostDragPreview.startMs} durationMs={ghostDragPreview.durationMs} snapped={ghostDragPreview.snapped} pxPerMs={pxPerMs} minWidth={32} variant="layer" />
                                )}
                            </div>

                            {/* Expanded Sub-rows (h-6 = 24px each, aligned 1-to-1 with LeftPanel!) */}
                            {isExpanded && (
                                <div className="space-y-0.5">
                                    {/* ♦ Presets Row: Movable & Resizable In / Out Pills! */}
                                    <div
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            if (
                                                (e.target as HTMLElement).closest(
                                                    '[data-preset-pill]'
                                                )
                                            )
                                                return;
                                            const clickMs = clientXToLocalMs(e.clientX);
                                            const midMs = (layer.inMs + layer.outMs) / 2;
                                            if (clickMs <= midMs) {
                                                updateLayer(activeShot.id, layer.id, (l) => updateTimelineTransition(l, 'entrance', {
                                                        type:
                                                            getTimelineTransition(l, 'entrance').type === 'none'
                                                                ? 'fade'
                                                                : getTimelineTransition(l, 'entrance').type,
                                                        delayMs: Math.max(0, clickMs - l.inMs),
                                                        durationMs: 600,
                                                    }));
                                                selectPreset('entrance', layer.id);
                                            } else {
                                                updateLayer(activeShot.id, layer.id, (l) => updateTimelineTransition(l, 'exit', {
                                                        type:
                                                            getTimelineTransition(l, 'exit').type === 'none'
                                                                ? 'fade'
                                                                : getTimelineTransition(l, 'exit').type,
                                                        delayMs: Math.max(0, l.outMs - clickMs),
                                                        durationMs: 550,
                                                    }));
                                                selectPreset('exit', layer.id);
                                            }
                                        }}
                                        title="Click anywhere on this row to place an In or Out transition"
                                        className="h-9 relative flex items-center group"
                                    >
                                        {/* Movable & resizable entrance / exit pills */}
                                        {(['entrance', 'exit'] as const).map(side => {
                                            const transition = getTimelineTransition(layer, side);
                                            if (transition.type === 'none') return null;
                                            const easing: Easing = transition.easing || { kind: 'preset', name: side === 'entrance' ? 'ease-out' : 'ease-in' };
                                            return <TransitionPill key={side} side={side}
                                                left={(side === 'entrance' ? entStartMs : extStartMs) * pxPerMs}
                                                width={Math.max(28, (side === 'entrance' ? entDurMs : extDurMs) * pxPerMs)}
                                                selected={isSelected && selectedPresetType === side}
                                                ghosted={ghostDragPreview?.id === `${layer.id}-${side}`}
                                                easing={easing}
                                                onDrag={(event, edge) => startPresetDrag(event, activeShot, layer, side, edge)}
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    if (suppressPillClickRef.current === `${layer.id}-${side}`) {
                                                        suppressPillClickRef.current = null;
                                                        return;
                                                    }
                                                    selectPreset(side, layer.id);
                                                    setEasingPopoverTarget({
                                                        easing,
                                                        onChange: next => updateLayer(activeShot.id, layer.id, l => updateTimelineTransition(l, side, { easing: next })),
                                                        anchorRect: event.currentTarget.getBoundingClientRect(),
                                                    });
                                                }} />;
                                        })}

                                        {/* Dashed Ghost Outline during Preset Drag */}
                                        {ghostDragPreview && (ghostDragPreview.id === `${layer.id}-entrance` || ghostDragPreview.id === `${layer.id}-exit`) && (
                                            <TimelineDragPreview startMs={ghostDragPreview.startMs} durationMs={ghostDragPreview.durationMs} snapped={ghostDragPreview.snapped} pxPerMs={pxPerMs} minWidth={28} variant="pill" showStart={false} />
                                        )}
                                    </div>

                                    {/* ♦ Property blocks use 36px rows; bars are 90% of the main layer bar. */}
                                    {layer.blocks.map((blk) => (
                                        <div
                                            key={blk.id}
                                            className="h-9 relative flex items-center"
                                        >
                                            <TimelineRangeBar
                                                tone="animation"
                                                selected={selectedBlockId === blk.id}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    selectBlock(blk.id, layer.id);
                                                    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setContextMenu({
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        items: [
                                                            { type: 'header', label: blk.label },
                                                            {
                                                                id: 'edit-easing',
                                                                label: 'Edit easing',
                                                                shortcut: '↵',
                                                                onClick: () => {
                                                                    setEasingPopoverTarget({
                                                                        easing: blk.easing,
                                                                        onChange: (easing) => {
                                                                            updateLayer(activeShot.id, layer.id, (l) => ({
                                                                                ...l,
                                                                                blocks: l.blocks.map((b) =>
                                                                                    b.id === blk.id ? { ...b, easing } : b
                                                                                ),
                                                                            }));
                                                                        },
                                                                        anchorRect: targetRect,
                                                                    });
                                                                },
                                                            },
                                                            {
                                                                id: 'copy',
                                                                label: 'Copy',
                                                                icon: Copy,
                                                                shortcut: '⌘C',
                                                                onClick: () => copyTimelineBlock({ type: 'animation', block: blk, layerId: layer.id }),
                                                            },
                                                            {
                                                                id: 'dup',
                                                                label: 'Duplicate',
                                                                shortcut: '⌘D',
                                                                onClick: () => {
                                                                    updateLayer(activeShot.id, layer.id, (l) => ({
                                                                        ...l,
                                                                        blocks: [
                                                                            ...l.blocks,
                                                                            {
                                                                                ...blk,
                                                                                id: `blk-${Date.now()}`,
                                                                                startMs: Math.min(activeShot.durationMs - blk.durationMs, blk.startMs + 50),
                                                                            },
                                                                        ],
                                                                    }));
                                                                },
                                                            },
                                                            { type: 'divider' },
                                                            {
                                                                id: 'del',
                                                                label: 'Remove',
                                                                icon: Trash2,
                                                                shortcut: '⌫',
                                                                danger: true,
                                                                onClick: () => {
                                                                    updateLayer(activeShot.id, layer.id, (l) => ({
                                                                        ...l,
                                                                        blocks: l.blocks.filter((b) => b.id !== blk.id),
                                                                    }));
                                                                },
                                                            },
                                                        ],
                                                    });
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (suppressPillClickRef.current === blk.id) {
                                                        suppressPillClickRef.current = null;
                                                        return;
                                                    }
                                                    selectBlock(blk.id, layer.id);
                                                    setEasingPopoverTarget({
                                                        easing: blk.easing,
                                                        onChange: (easing) => {
                                                            updateLayer(activeShot.id, layer.id, (l) => ({
                                                                ...l,
                                                                blocks: l.blocks.map((b) =>
                                                                    b.id === blk.id ? { ...b, easing } : b
                                                                ),
                                                            }));
                                                        },
                                                        anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                                                    });
                                                }}
                                                onPointerDown={(e) =>
                                                    startBlockDrag(
                                                        e,
                                                        activeShot,
                                                        layer,
                                                        blk,
                                                        'move'
                                                    )
                                                }
                                                left={blk.startMs * pxPerMs} width={Math.max(36, blk.durationMs * pxPerMs)}
                                                title={`${blk.label} · ${(blk.durationMs / 1000).toFixed(2)}s · Click to edit easing`}
                                                aria-label={`${blk.label} animation bar`}
                                                className={`absolute top-1/2 h-[90%] -translate-y-1/2 px-2 flex items-center justify-between text-[10px] font-medium tracking-tight cursor-grab active:cursor-grabbing ${
                                                    ghostDragPreview?.id === blk.id ? 'opacity-40' : ''
                                                }`}
                                            >
                                                <TimelineEasingCurve easing={blk.easing} tone="animation" selected={selectedBlockId === blk.id} />
                                                <span className="relative z-10 pointer-events-none drop-shadow-sm truncate">{blk.label}</span>
                                                <TrimHandle side="left"
                                                    onPointerDown={(e) =>
                                                        startBlockDrag(
                                                            e,
                                                            activeShot,
                                                            layer,
                                                            blk,
                                                            'left'
                                                        )
                                                    }
                                                    className="w-2 bg-white/25 hover:bg-purple-300 rounded-l-full z-10" />
                                                <TrimHandle side="right"
                                                    onPointerDown={(e) =>
                                                        startBlockDrag(
                                                            e,
                                                            activeShot,
                                                            layer,
                                                            blk,
                                                            'right'
                                                        )
                                                    }
                                                    className="w-2 bg-white/25 hover:bg-purple-300 rounded-r-full z-10" />
                                            </TimelineRangeBar>

                                            {/* Dashed Ghost Outline during Block Drag */}
                                            {ghostDragPreview && ghostDragPreview.id === blk.id && (
                                                <TimelineDragPreview startMs={ghostDragPreview.startMs} durationMs={ghostDragPreview.durationMs} snapped={ghostDragPreview.snapped} pxPerMs={pxPerMs} minWidth={36} variant="pill" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

            {/* Dimmed Right-Hand Step-Out Curtain */}
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setTimelineView('video');
                }}
                title="Click dimmed area to step back out to Whole Video view"
                style={{ left: `${activeShot.durationMs * pxPerMs + 8}px` }}
                className="absolute top-0 bottom-0 right-0 rounded-l-2xl bg-[#16202a]/80 hover:bg-[#1e2c3a]/85 border-l border-white/10 cursor-pointer transition z-10"
            />
        </div>
    );
}

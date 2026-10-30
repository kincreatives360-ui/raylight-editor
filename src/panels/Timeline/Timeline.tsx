// src/panels/Timeline/Timeline.tsx
import React, { useMemo, useRef, useState } from 'react';
import { useTimelineLayerInteractions } from './useTimelineLayerInteractions';
import { useTimelineCameraLightInteractions } from './useTimelineCameraLightInteractions';
import { useTimelineShotInteractions } from './useTimelineShotInteractions';
import { useTimelineAudioInteractions } from './useTimelineAudioInteractions';
import { useTimelineViewport } from './useTimelineViewport';
import { useTimelinePlayback } from './useTimelinePlayback';
import type { TimelineEasingPopoverTarget, TimelineGhostDragPreview } from './timelineTypes';
import { ContextMenu } from '../../ui/ContextMenu';
import { isBlankProjectState } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineShotOverview } from './TimelineShotOverview';
import { TimelineMediaTrack } from './TimelineMediaTrack';
import { TimelineSceneTracks } from './TimelineSceneTracks';
import { PlayheadOverlay } from './PlayheadOverlay';
import { EasingPopover } from './EasingPopover';
import { getShotTimelineWidth } from './timelineBarGeometry';

interface TimelineProps {
    totalDurationMs: number;
    hoverTimeMs?: number | null;
    onHoverTimeChange?: (timeMs: number | null) => void;
}

export const Timeline: React.FC<TimelineProps> = React.memo(({
    totalDurationMs,
    hoverTimeMs: propHoverTimeMs,
    onHoverTimeChange: propOnHoverTimeChange,
}) => {
    const {
        project,
        updateShot,
        updateProject,
        updateLayer,
        addShot,
        deleteShot,
        addLayerToShot,
        addCameraBlockToShot,
        toggleProjectAudioMuted,
        splitAtPlayhead,

        splitAudioClipAtPlayhead,
        beginDragTransaction,
        commitDragTransaction,
    } = useProjectStore();

    const isPlaying = usePlayheadStore((s) => s.isPlaying);
    const storeHoverTimeMs = usePlayheadStore((s) => s.hoverTimeMs);
    const setHoverTimeMs = usePlayheadStore((s) => s.setHoverTimeMs);
    const setIsPlaying = usePlayheadStore((s) => s.setIsPlaying);
    const setCurrentTimeMs = usePlayheadStore((s) => s.setCurrentTimeMs);
    const togglePlay = usePlayheadStore((s) => s.togglePlay);

    const hoverTimeMs = propHoverTimeMs !== undefined ? propHoverTimeMs : storeHoverTimeMs;
    const onHoverTimeChange = propOnHoverTimeChange ?? setHoverTimeMs;

    const {
        selectedShotId,
        selectedLayerIds,
        selectedBlockId,
        selectedCameraBlockId,
        selectedLightBlockId,
        selectedPresetType,
        inspectorTab,
        clearLayerSelection,
        timelineView,
        timelineZoom,
        timelineHeightPx,
        timelineScrollTop,
        expandedTimelineLayerIds,
        selectShot,
        selectLayer,
        selectBlock,
        selectCameraBlock,
        selectLightBlock,
        selectPreset,
        setInspectorTab,
        setTimelineView,
        setTimelineZoom,
        setTimelineHeightPx,
        setTimelineScrollTop,
    } = useSelectionStore();

    const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
    const expandedTimelineLayerSet = useMemo(
        () => new Set(expandedTimelineLayerIds),
        [expandedTimelineLayerIds]
    );

    const { trackRef, timelineViewportWidth, handleStartResizeTimelineHeight } = useTimelineViewport({
        timelineZoom,
        setTimelineZoom,
        timelineHeightPx,
        setTimelineHeightPx,
        timelineScrollTop,
    });
    const shotDragRef = useRef<{
        shotId: string;
        index: number;
        startX: number;
        dragging: boolean;
    } | null>(null);
    const suppressShotClickRef = useRef<string | null>(null);
    const suppressPillClickRef = useRef<string | null>(null);

    const [addShotHoverX, setAddShotHoverX] = useState<number | null>(null);
    const [addLayerHoverX, setAddLayerHoverX] = useState<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const [hoverCameraTimeMs, setHoverCameraTimeMs] = useState<number | null>(null);
    const [easingPopoverTarget, setEasingPopoverTarget] = useState<TimelineEasingPopoverTarget | null>(null);
    const [ghostDragPreview, setGhostDragPreview] = useState<TimelineGhostDragPreview | null>(null);

    const activeShot =
        project.shots.find((shot) => shot.id === selectedShotId) ??
        project.shots[0];
    const isBlankState = isBlankProjectState(project);

    const visibleDurationMs = isBlankState
        ? 0
        : Math.max(
            1000,
            timelineView === 'scene' && activeShot
                ? activeShot.durationMs
                : totalDurationMs
        );
    // Fixed base scale so resizing an element's duration physically expands/contracts its bar,
    // while keeping the timeline ruler rock solid!
    const BASE_PX_PER_SECOND = 140;
    const pxPerSecond = BASE_PX_PER_SECOND * timelineZoom;
    const pxPerMs = pxPerSecond / 1000;
    const {
        isDraggingPlayhead,
        clientXToLocalMs,
        handleTimelinePointerMove,
        handleTimelinePointerLeave,
        handleTimelineClick,
        handleRulerPointerDown,
    } = useTimelinePlayback({
        trackRef,
        pxPerMs,
        visibleDurationMs,
        totalDurationMs,
        timelineView,
        activeShot,
        isBlankState,
        hoverTimeMs,
        onHoverTimeChange,
        isPlaying,
        setIsPlaying,
        setCurrentTimeMs,
        dragging,
        clearLayerSelection,
        selectedCameraBlockId,
        selectedLightBlockId,
        selectedBlockId,
        updateShot,
        updateLayer,
    });
    const addLayerLaneWidth = activeShot
        ? getShotTimelineWidth(activeShot.durationMs, pxPerMs)
        : 0;
    const addLayerGhostWidth = Math.min(132, addLayerLaneWidth);
    const addLayerGhostLeft = Math.max(
        0,
        Math.min(addLayerLaneWidth - addLayerGhostWidth, (addLayerHoverX ?? 0) - addLayerGhostWidth / 2)
    );
    const timelineWidth = Math.max(
        1,
        timelineViewportWidth - 32,
        visibleDurationMs * pxPerMs + 160
    );

    const rulerStepMs = useMemo(() => {
        if (pxPerSecond >= 240) return 1000;
        if (pxPerSecond >= 80) return 2000;
        if (pxPerSecond >= 40) return 4000;
        return 5000;
    }, [pxPerSecond]);

    const rulerMarks = useMemo(() => {
        const marks: { timeMs: number; isHalf?: boolean }[] = [];
        const maxTimeMs = Math.max(visibleDurationMs, totalDurationMs);
        const minorStep = rulerStepMs / 2;
        for (let t = 0; t <= maxTimeMs + rulerStepMs * 2; t += minorStep) {
            marks.push({ timeMs: t, isHalf: t % rulerStepMs !== 0 });
        }
        return marks;
    }, [visibleDurationMs, totalDurationMs, rulerStepMs]);

    // Magnetic Snapping calculation (12px visual threshold converted into milliseconds)
    const snapThresholdMs = Math.max(15, Math.round(12 / pxPerMs));

    const { startLayerBarDrag, startPresetDrag, startBlockDrag } = useTimelineLayerInteractions({
        pxPerMs,
        snapThresholdMs,
        setGhostDragPreview,
        setDragging,
        suppressPillClickRef,
        beginDragTransaction,
        commitDragTransaction,
        updateLayer,
        setInspectorTab,
        selectLayer,
        selectPreset,
        selectBlock,
    });
    const { startCameraBlockDrag, startLightBlockDrag } = useTimelineCameraLightInteractions({
        pxPerMs,
        setGhostDragPreview,
        setDragging,
        beginDragTransaction,
        commitDragTransaction,
        updateShot,
        selectCameraBlock,
        selectLightBlock,
    });
    const { startShotTrim, startShotReorder } = useTimelineShotInteractions({
        pxPerMs,
        updateProject,
        beginDragTransaction,
        commitDragTransaction,
        setDragging,
        selectShot,
        setInspectorTab,
        shotDragRef,
        suppressShotClickRef,
    });
    const {
        contextMenu,
        setContextMenu,
        startAudioClipDrag,
        deleteAudioClip,
        openAudioContextMenu,
    } = useTimelineAudioInteractions({
        project,
        pxPerMs,
        updateProject,
        beginDragTransaction,
        commitDragTransaction,
        setDragging,
        splitAudioClipAtPlayhead,
        toggleProjectAudioMuted,
    });
    const hoverDisplayTimeMs = hoverTimeMs === null
        ? null
        : timelineView === 'scene' && activeShot
            ? Math.max(0, hoverTimeMs - activeShot.startMs)
            : hoverTimeMs;

    const hasLightBlocks = (activeShot?.lightBlocks?.length || 0) > 0;

    const addCameraBlockAtTime = (timeMs: number) => {
        if (!activeShot) return;
        const startMs = Math.max(
            0,
            Math.min(Math.max(0, activeShot.durationMs - 100), timeMs)
        );
        const durationMs = Math.max(
            100,
            Math.min(1000, activeShot.durationMs - startMs)
        );
        const block = addCameraBlockToShot(activeShot.id, { startMs, durationMs });
        if (block) selectCameraBlock(block.id);
    };

    return (
        <section
            id="raylight-timeline"
            style={{ height: `${timelineHeightPx}px` }}
            className="raylight-timeline border-t border-subtle bg-app flex flex-col shrink-0 select-none relative"
        >
            {/* TOP VERTICAL RESIZE SPLITTER HANDLE (Drag up for more layer room, down to compact) */}
            <div
                onPointerDown={handleStartResizeTimelineHeight}
                title="Drag up or down to resize timeline height"
                style={{ touchAction: 'none' }}
                className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-40 group flex items-center justify-center"
            >
                <div className="w-12 h-0.5 rounded-full bg-white/15 group-hover:bg-brand-blue transition" />
            </div>

            <TimelineToolbar
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onSplitAtPlayhead={() => splitAtPlayhead(usePlayheadStore.getState().currentTimeMs)}
                activeShot={activeShot}
                hasActiveShot={project.shots.some((shot) => shot.id === activeShot?.id)}
                onDeleteShot={deleteShot}
                totalDurationMs={totalDurationMs}
                timelineZoom={timelineZoom}
                onTimelineZoomChange={setTimelineZoom}
            />

            {/* 2. SCROLL-SYNCED TRACKS BODY (Includes Ruler + Tracks + Playhead + Skimmer) */}
            <div
                id="timeline-tracks-scroll"
                ref={trackRef}
                onScroll={(e) => {
                    setTimelineScrollTop(e.currentTarget.scrollTop);
                }}
                onPointerMove={handleTimelinePointerMove}
                onPointerLeave={handleTimelinePointerLeave}
                onClick={handleTimelineClick}
                className={`flex-1 overflow-auto relative px-4 ${
                    isDraggingPlayhead ? 'cursor-ew-resize' : dragging ? 'cursor-grabbing' : 'cursor-pointer'
                }`}
            >
                {isBlankState && (
                    <button
                        type="button"
                        aria-label="Add shot"
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerMove={(event) => {
                            const bounds = event.currentTarget.getBoundingClientRect();
                            setAddShotHoverX(event.clientX - bounds.left);
                        }}
                        onPointerLeave={() => setAddShotHoverX(null)}
                        onClick={(event) => {
                            event.stopPropagation();
                            const created = addShot();
                            selectShot(created.id);
                            setInspectorTab('shot');
                        }}
                        className="absolute left-2 right-2 top-[38px] z-10 h-9 overflow-hidden rounded-lg border border-dashed border-[#263946] bg-[#0e191e] text-[11px] text-[#9aaaba] hover:border-[#0088ff]/50 hover:bg-[#11212a] transition"
                    >
                        {addShotHoverX !== null && (
                            <span
                                aria-hidden="true"
                                className="absolute inset-y-0 pointer-events-none"
                                style={{ left: `${addShotHoverX}px`, transform: 'translateX(-50%)' }}
                            >
                                <span
                                    className="absolute h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded border border-dashed border-sky-400/35 bg-sky-400/[0.03]"
                                    style={{ left: -58, top: '50%' }}
                                />
                                <span
                                    className="absolute h-6 w-14 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-sky-300/75 bg-sky-400/[0.08]"
                                    style={{ left: 0, top: '50%' }}
                                />
                                <span
                                    className="absolute h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded border border-dashed border-sky-400/35 bg-sky-400/[0.03]"
                                    style={{ left: 58, top: '50%' }}
                                />
                            </span>
                        )}
                        <span className={addShotHoverX === null ? '' : 'opacity-50'}>Add shot</span>
                    </button>
                )}
                <div
                    style={{ width: `${timelineWidth}px`, minWidth: '100%' }}
                    className="relative min-h-full flex flex-col"
                >
                    {/* TIME RULER (h-6 = 24px) */}
                    <div
                        onPointerDown={handleRulerPointerDown}
                        style={{ touchAction: 'none' }}
                        className="sticky top-0 z-10 h-6 border-b border-subtle bg-app relative cursor-ew-resize select-none shrink-0"
                    >
                        {rulerMarks.map((m) => (
                            <div
                                key={m.timeMs}
                                className="absolute top-1 pointer-events-none -translate-x-1/2 flex items-center justify-center"
                                style={{ left: `${m.timeMs * pxPerMs}px` }}
                            >
                                {m.isHalf ? (
                                    <span className="w-1 h-1 rounded-full bg-disabled/70 mt-1.5" />
                                ) : (
                                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground font-medium tracking-tight">
                                        {m.timeMs === 0 ? '0.00' : `${Math.round(m.timeMs / 1000)}s`}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* TRACKS CONTENT */}
                    <div className="py-2 flex-1 relative flex flex-col">
                    <TimelineMediaTrack
                        clips={project.audio?.clips ?? []}
                        muted={project.audio?.muted ?? false}
                        timelineWidth={timelineWidth}
                        totalDurationMs={totalDurationMs}
                        pxPerMs={pxPerMs}
                        timelineView={timelineView}
                        activeShot={activeShot}
                        onToggleMute={toggleProjectAudioMuted}
                        onClipDrag={(event, clip, edge) => startAudioClipDrag(event, clip, edge)}
                        onClipSeek={setCurrentTimeMs}
                        onClipDelete={deleteAudioClip}
                        onClipContextMenu={openAudioContextMenu}
                    />                    {/* =============================================================== */}
                    {/* STATE 1: ZOOMED-OUT WHOLE VIDEO VIEW                            */}
                    {/* =============================================================== */}
                    {!isBlankState && timelineView === 'video' && (
                        <TimelineShotOverview
                            shots={project.shots}
                            activeShot={activeShot}
                            inspectorTab={inspectorTab}
                            pxPerMs={pxPerMs}
                            onShotPointerDown={startShotReorder}
                            onShotClick={(event, shot) => {
                                event.stopPropagation();
                                if (suppressShotClickRef.current === shot.id) {
                                    suppressShotClickRef.current = null;
                                    return;
                                }
                                selectShot(shot.id);
                                setInspectorTab('shot');
                                setCurrentTimeMs(Math.min(totalDurationMs, clientXToLocalMs(event.clientX)));
                            }}
                            onShotDoubleClick={(event, shot) => {
                                event.stopPropagation();
                                const hasSelectedLayer = shot.layers.some((layer) => selectedLayerSet.has(layer.id));
                                selectShot(shot.id);
                                setTimelineView('scene');
                                setInspectorTab(hasSelectedLayer ? 'layer' : 'shot');
                            }}
                            onShotDelete={(event, shot) => {
                                event.stopPropagation();
                                deleteShot(shot.id);
                            }}
                            onShotTrimPointerDown={startShotTrim}
                        />
                    )}

                    {/* =============================================================== */}
                    {/* STATE 2: ZOOMED-IN SCENE LAYER VIEW (1-to-1 Aligned with LeftPanel!) */}
                    {/* =============================================================== */}
                    {timelineView === 'scene' && activeShot && (
                        <TimelineSceneTracks
                            activeShot={activeShot}
                            pxPerMs={pxPerMs}
                            addLayerLaneWidth={addLayerLaneWidth}
                            addLayerGhostWidth={addLayerGhostWidth}
                            addLayerGhostLeft={addLayerGhostLeft}
                            addLayerHoverX={addLayerHoverX}
                            setAddLayerHoverX={setAddLayerHoverX}
                            setInspectorTab={setInspectorTab}
                            onAddLayer={() => {
                                const created = addLayerToShot(activeShot.id, 'shape', {
                                    inMs: 0,
                                    outMs: activeShot.durationMs,
                                });
                                setInspectorTab('layer');
                                selectLayer(created.id, false);
                            }}
                            hoverCameraTimeMs={hoverCameraTimeMs}
                            setHoverCameraTimeMs={setHoverCameraTimeMs}
                            clientXToLocalMs={clientXToLocalMs}
                            addCameraBlockAtTime={addCameraBlockAtTime}
                            selectedCameraBlockId={selectedCameraBlockId}
                            selectCameraBlock={selectCameraBlock}
                            updateShot={updateShot}
                            setContextMenu={setContextMenu}
                            setEasingPopoverTarget={setEasingPopoverTarget}
                            startCameraBlockDrag={startCameraBlockDrag}
                            ghostDragPreview={ghostDragPreview}
                            hasLightBlocks={hasLightBlocks}
                            selectedLightBlockId={selectedLightBlockId}
                            selectLightBlock={selectLightBlock}
                            startLightBlockDrag={startLightBlockDrag}
                            selectedLayerSet={selectedLayerSet}
                            expandedTimelineLayerSet={expandedTimelineLayerSet}
                            startLayerBarDrag={startLayerBarDrag}
                            updateLayer={updateLayer}
                            selectPreset={selectPreset}
                            selectedPresetType={selectedPresetType}
                            suppressPillClickRef={suppressPillClickRef}
                            startPresetDrag={startPresetDrag}
                            selectedBlockId={selectedBlockId}
                            selectBlock={selectBlock}
                            startBlockDrag={startBlockDrag}
                            setTimelineView={setTimelineView}
                        />
                    )}
                    </div>

                    {/* ======================================================= */}
                    {/* SKIMMER (GREY)                                          */}
                    {/* ======================================================= */}
                    {hoverDisplayTimeMs !== null && !isDraggingPlayhead && (
                        <div
                            aria-hidden="true"
                            className="absolute top-0 bottom-0 pointer-events-none z-20 flex flex-col items-center"
                            style={{
                                left: `${hoverDisplayTimeMs * pxPerMs}px`,
                                transform: 'translateX(-50%)',
                            }}
                        >
                            {/* 1px vertical line in muted grey (~#3a3a3a to #4a4a4a) spanning with same height */}
                            <div
                                className="absolute inset-y-0 w-px"
                                style={{
                                    background: 'linear-gradient(to bottom, #44444c 0%, #44444c 82%, rgba(68, 68, 76, 0) 100%)',
                                }}
                            />

                            {/* Small dark pill label with grey monospace text sitting on ruler at top */}
                            <div className="relative px-2 py-0.5 rounded-full bg-surface border border-subtle text-muted-foreground text-[11px] font-mono tabular-nums font-medium shadow-xs whitespace-nowrap leading-none select-none mt-1 z-10">
                                {(hoverDisplayTimeMs / 1000).toFixed(2)}
                            </div>
                        </div>
                    )}

                    {/* ======================================================= */}
                    {/* MAIN PLAYHEAD (BLUE)                                    */}
                    {/* ======================================================= */}
                    <PlayheadOverlay
                        pxPerMs={pxPerMs}
                        timelineView={timelineView}
                        activeShotStartMs={activeShot?.startMs ?? 0}
                        scrollContainerRef={trackRef}
                    />
                    {/* Floating Visual Bezier Curve Popover */}
                    {easingPopoverTarget && (
                        <EasingPopover
                            easing={easingPopoverTarget.easing}
                            onChange={(nextEasing) => {
                                easingPopoverTarget.onChange(nextEasing);
                                setEasingPopoverTarget((prev) =>
                                    prev ? { ...prev, easing: nextEasing } : null
                                );
                            }}
                            onClose={() => setEasingPopoverTarget(null)}
                            anchorRect={easingPopoverTarget.anchorRect}
                        />
                    )}
                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            items={contextMenu.items}
                            onClose={() => setContextMenu(null)}
                        />
                    )}
                </div>
            </div>
        </section>
    );
});

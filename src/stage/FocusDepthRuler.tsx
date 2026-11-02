import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { FocusBlock } from '../model/types';
import { createPointerDragLifecycle } from './selectionDragLifecycle';

export interface FocusDepthTick {
    id: string;
    name: string;
    depth: number;
}

interface FocusDepthRulerProps {
    minDepth: number;
    maxDepth: number;
    focusDepth: number;
    focusRange: number;
    focusBlocks: FocusBlock[];
    cameraDepth: number;
    layerTicks: FocusDepthTick[];
    hoveredDepth: number | null;
    faded: boolean;
    onHoverDepth: (depth: number | null) => void;
    onBeginDrag: () => void;
    onEndDrag: (cancelled: boolean) => void;
    onAdjustFocusDepth: (delta: number, skipHistory?: boolean) => void;
    onAdjustFocusRange: (delta: number, skipHistory?: boolean) => void;
}

function formatDepth(depth: number): string {
    return Number(depth.toFixed(3)).toString();
}

export function FocusDepthRuler({
    minDepth,
    maxDepth,
    focusDepth,
    focusRange,
    focusBlocks,
    cameraDepth,
    layerTicks,
    hoveredDepth,
    faded,
    onHoverDepth,
    onBeginDrag,
    onEndDrag,
    onAdjustFocusDepth,
    onAdjustFocusRange,
}: FocusDepthRulerProps) {
    const span = Math.max(0.001, maxDepth - minDepth);
    const positionValue = (depth: number) => Math.max(0, Math.min(100, ((depth - minDepth) / span) * 100));
    const position = (depth: number) => `${positionValue(depth)}%`;
    const nearDepth = focusDepth - focusRange / 2;
    const farDepth = focusDepth + focusRange / 2;
    const activeDragCleanupRef = useRef<(() => void) | null>(null);
    useEffect(() => () => activeDragCleanupRef.current?.(), []);

    const handleHover = (depth: number) => () => onHoverDepth(depth);
    const handleRangeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight'
            ? 1
            : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
                ? -1
                : 0;
        if (!direction) return;
        event.preventDefault();
        event.stopPropagation();
        onAdjustFocusRange(direction * (event.shiftKey ? 0.01 : 0.05));
    };
    const stopMouseDown = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation();
    const handleFocusKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const direction = event.key === 'ArrowUp'
            ? 1
            : event.key === 'ArrowDown'
                ? -1
                : 0;
        if (!direction) return;
        event.preventDefault();
        event.stopPropagation();
        onAdjustFocusDepth(direction * (event.shiftKey ? 0.01 : 0.05));
    };
    const handleFocusPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        activeDragCleanupRef.current?.();
        let previousY = event.clientY;
        activeDragCleanupRef.current = createPointerDragLifecycle({
            pointerId: event.pointerId,
            target: event.currentTarget,
            begin: onBeginDrag,
            commit: () => onEndDrag(false),
            cancel: () => onEndDrag(true),
            onMove: moveEvent => {
                const deltaY = previousY - moveEvent.clientY;
                previousY = moveEvent.clientY;
                onAdjustFocusDepth(deltaY * 0.005, true);
            },
            onEnd: () => {
                activeDragCleanupRef.current = null;
            },
        });
    };
    const handleRangePointerDown = (event: PointerEvent<HTMLButtonElement>, edge: 'near' | 'far') => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        activeDragCleanupRef.current?.();
        let previousX = event.clientX;
        const direction = edge === 'near' ? -1 : 1;
        activeDragCleanupRef.current = createPointerDragLifecycle({
            pointerId: event.pointerId,
            target: event.currentTarget,
            begin: onBeginDrag,
            commit: () => onEndDrag(false),
            cancel: () => onEndDrag(true),
            onMove: moveEvent => {
                const deltaX = moveEvent.clientX - previousX;
                previousX = moveEvent.clientX;
                onAdjustFocusRange(deltaX * direction * 0.005, true);
            },
            onEnd: () => {
                activeDragCleanupRef.current = null;
            },
        });
    };

    return (
        <div
            data-focus-depth-ruler=""
            data-ruler-focus-depth={formatDepth(focusDepth)}
            data-hovered-depth={hoveredDepth === null ? undefined : formatDepth(hoveredDepth)}
            data-faded={String(faded)}
            className={`absolute z-40 select-none transition-opacity duration-500 ${faded ? 'opacity-30' : 'opacity-100'}`}
            style={{ left: '10%', right: '10%', bottom: '64px', height: '42px', pointerEvents: 'none' }}
            onMouseLeave={() => onHoverDepth(null)}
        >
            <svg
                aria-hidden="true"
                className="absolute inset-0 h-full w-full overflow-visible pointer-events-none"
                viewBox="0 0 100 42"
                preserveAspectRatio="none"
            >
                <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(226,232,240,.72)" strokeWidth="1" />
                {focusBlocks.map(block => {
                    const fromX = positionValue(block.fromZ);
                    const toX = positionValue(block.toZ);
                    const controlX = (fromX + toX) / 2;
                    return (
                        <path
                            key={block.id}
                            data-rack-focus-path={block.id}
                            data-from-depth={formatDepth(block.fromZ)}
                            data-to-depth={formatDepth(block.toZ)}
                            d={`M ${fromX.toFixed(2)},8 Q ${controlX.toFixed(2)},1 ${toX.toFixed(2)},8`}
                            fill="none"
                            stroke="#c4b5fd"
                            strokeWidth="1.5"
                            strokeDasharray="3 2"
                        />
                    );
                })}
                <line
                    x1={((nearDepth - minDepth) / span) * 100}
                    y1="20"
                    x2={((farDepth - minDepth) / span) * 100}
                    y2="20"
                    stroke="#7dd3fc"
                    strokeWidth="2"
                />
            </svg>

            <div
                data-depth-tick="camera"
                data-depth={formatDepth(cameraDepth)}
                className="absolute top-[20px] -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                style={{ left: position(cameraDepth) }}
                onMouseEnter={handleHover(cameraDepth)}
            >
                <span className="block h-2.5 w-2.5 rotate-45 border border-amber-200 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.5)]" />
                <span className="absolute left-1/2 top-[-16px] -translate-x-1/2 text-[9px] font-medium text-amber-100">Camera</span>
            </div>

            {layerTicks.map(tick => (
                <div
                    key={tick.id}
                    data-depth-tick="layer"
                    data-depth={formatDepth(tick.depth)}
                    data-layer-id={tick.id}
                    className="absolute top-[25px] -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                    style={{ left: position(tick.depth) }}
                    onMouseEnter={handleHover(tick.depth)}
                >
                    <span className="block h-2 w-px bg-slate-100 shadow-[0_0_5px_rgba(255,255,255,.7)]" />
                    <span className="absolute left-1/2 top-[8px] max-w-16 -translate-x-1/2 truncate text-[8px] text-slate-300">{tick.name}</span>
                </div>
            ))}

            <button
                type="button"
                role="spinbutton"
                aria-label="Focus depth; use arrow keys to adjust"
                title="Use the up and down arrow keys or drag vertically to adjust focus depth"
                tabIndex={0}
                aria-valuenow={focusDepth}
                aria-valuetext={`Focus depth ${formatDepth(focusDepth)}`}
                data-depth-tick="focus"
                data-depth={formatDepth(focusDepth)}
                className="absolute top-[25px] z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                style={{ left: position(focusDepth) }}
                onMouseEnter={handleHover(focusDepth)}
                onFocus={() => onHoverDepth(focusDepth)}
                onBlur={() => onHoverDepth(null)}
                onMouseDown={stopMouseDown}
                onPointerDown={handleFocusPointerDown}
                onClick={event => event.stopPropagation()}
                onKeyDown={handleFocusKeyDown}
            >
                <span aria-hidden="true" className="block h-3 w-3 rounded-full border border-white bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,.8)]" />
            </button>

            {([
                ['near', nearDepth],
                ['far', farDepth],
            ] as const).map(([edge, depth]) => {
                const ariaLabel = edge === 'near'
                    ? 'Near focus boundary; use arrow keys to adjust range'
                    : 'Far focus boundary; use arrow keys to adjust range';
                return (
                    <button
                        key={edge}
                        type="button"
                        aria-label={ariaLabel}
                        title={ariaLabel}
                        tabIndex={0}
                        data-depth-handle={edge}
                        data-depth={formatDepth(depth)}
                        className="absolute top-[20px] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-sky-200 bg-sky-500/80 shadow-[0_0_9px_rgba(56,189,248,.55)] pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        style={{ left: position(depth) }}
                        onMouseDown={stopMouseDown}
                        onPointerDown={event => handleRangePointerDown(event, edge)}
                        onClick={event => event.stopPropagation()}
                        onKeyDown={handleRangeKeyDown}
                        onMouseEnter={handleHover(depth)}
                        onFocus={handleHover(depth)}
                        onBlur={() => onHoverDepth(null)}
                    />
                );
            })}
        </div>
    );
}

import { Trash2 } from 'lucide-react';
import { IconButton } from '../../ui/primitives';
import type { Shot } from '../../model/types';

interface TimelineShotOverviewProps {
    shots: Shot[];
    activeShot?: Shot;
    inspectorTab: string;
    pxPerMs: number;
    onShotPointerDown: (event: React.PointerEvent<HTMLDivElement>, shot: Shot, index: number) => void;
    onShotClick: (event: React.MouseEvent<HTMLDivElement>, shot: Shot) => void;
    onShotDoubleClick: (event: React.MouseEvent<HTMLDivElement>, shot: Shot) => void;
    onShotDelete: (event: React.MouseEvent<HTMLButtonElement>, shot: Shot) => void;
    onShotTrimPointerDown: (event: React.PointerEvent<HTMLSpanElement>, shot: Shot) => void;
}

export function TimelineShotOverview({
    shots,
    activeShot,
    inspectorTab,
    pxPerMs,
    onShotPointerDown,
    onShotClick,
    onShotDoubleClick,
    onShotDelete,
    onShotTrimPointerDown,
}: TimelineShotOverviewProps) {
    return (
        <div className="space-y-2 pt-2">
            <div className="h-8 relative flex items-center gap-1">
                {shots.map((shot, shotIndex) => {
                    const isSelected = inspectorTab === 'shot' && shot.id === activeShot?.id;
                    const width = Math.max(16, shot.durationMs * pxPerMs - 2);

                    return (
                        <div
                            key={shot.id}
                            onPointerDown={(event) => onShotPointerDown(event, shot, shotIndex)}
                            onClick={(event) => onShotClick(event, shot)}
                            onDoubleClick={(event) => onShotDoubleClick(event, shot)}
                            title={`${shot.name} · ${(shot.durationMs / 1000).toFixed(2)}s · Drag to reorder, drag the right edge to trim, double-click to open layer tracks`}
                            style={{ width: `${width}px` }}
                            className={`h-8 rounded-xl border-[1.5px] px-3 flex items-center justify-between text-[11px] font-medium transition cursor-grab active:cursor-grabbing relative group ${isSelected
                                    ? 'border-[#8176d9] bg-gradient-to-b from-[#28204f]/95 to-[#17152d]/95 text-white shadow-sm'
                                    : 'border-[#3e3870]/80 bg-gradient-to-b from-[#181628]/90 to-[#100e1c]/90 text-slate-300 hover:border-[#8176d9]/60'
                                }`}
                        >
                            <span className="truncate">{shot.name}</span>
                            <IconButton
                                unstyled
                                tooltip={false}
                                label={`Delete shot ${shot.name}`}
                                icon={<Trash2 className="w-3 h-3" />}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => onShotDelete(event, shot)}
                                title="Delete shot"
                                className="z-10 rounded p-1 text-slate-400 opacity-0 transition hover:bg-rose-500/30 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                            />
                            <span
                                data-shot-trim="right"
                                onPointerDown={(event) => onShotTrimPointerDown(event, shot)}
                                title="Drag to trim shot duration"
                                className="absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center rounded-r-xl opacity-0 group-hover:opacity-100 hover:bg-white/15 cursor-ew-resize transition"
                            >
                                <span className="h-4 w-0.5 rounded-full bg-white/80" />
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

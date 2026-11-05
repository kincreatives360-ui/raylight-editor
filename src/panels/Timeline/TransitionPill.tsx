import { TimelineRangeBar, TrimHandle } from './TimelineRangeBar';
import type { MouseEventHandler, PointerEvent } from 'react';
import type { Easing } from '../../model/types';
import { TimelineEasingCurve } from './TimelineEasingCurve';

interface TransitionPillProps {
    side: 'entrance' | 'exit';
    left: number;
    width: number;
    selected: boolean;
    ghosted: boolean;
    easing: Easing;
    onClick: MouseEventHandler<HTMLDivElement>;
    onDrag: (event: PointerEvent<HTMLElement>, edge: 'move' | 'left' | 'right') => void;
}

export function TransitionPill({ side, left, width, selected, ghosted, easing, onClick, onDrag }: TransitionPillProps) {
    const entrance = side === 'entrance';
    return <TimelineRangeBar
        data-preset-pill={entrance ? 'in' : 'out'}
        onClick={onClick}
        onPointerDown={event => onDrag(event, 'move')}
        left={left} width={width}
        className={`absolute top-1/2 h-[90%] -translate-y-1/2 overflow-hidden rounded-lg border px-2 flex items-center justify-between text-[10px] font-medium tracking-tight cursor-grab active:cursor-grabbing transition ${selected
            ? 'border-[#c084fc] bg-gradient-to-b from-[#351b53]/95 to-[#1a0f2b]/95 text-white shadow-[inset_0_0_18px_rgba(168,85,247,0.12)]'
            : 'border-[#8c45cc] bg-gradient-to-b from-[#291442]/95 to-[#150b22]/95 text-purple-200 hover:border-[#bc70ff]'
        } ${ghosted ? 'opacity-40' : ''}`}
    >
        <TimelineEasingCurve easing={easing} color="#bd70ff" />
        <TrimHandle side="left"
            onPointerDown={event => onDrag(event, 'left')}
            title={entrance ? 'Drag left edge to adjust In delay & length' : 'Drag left edge to resize Out duration'}
            className="w-2 bg-white/25 hover:bg-amber-300 rounded-l-full" />
        <TrimHandle side="right"
            onPointerDown={event => onDrag(event, 'right')}
            title={entrance ? 'Drag right edge to resize In duration' : 'Drag right edge to adjust Out end point'}
            className="w-2 bg-white/25 hover:bg-amber-300 rounded-r-full" />
    </TimelineRangeBar>;
}

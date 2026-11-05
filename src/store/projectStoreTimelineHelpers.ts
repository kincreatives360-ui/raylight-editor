import type { Shot } from '../model/types';
import { generateId } from '../model/id';

export function recalculateShotStartTimes(shots: Shot[]): Shot[] {
    let runningMs = 0;
    return shots.map((shot, idx) => {
        const updated = {
            ...shot,
            startMs: runningMs,
            lane: shot.lane ?? idx % 8,
        };
        runningMs += shot.durationMs;
        return updated;
    });
}

export function trimBlocksForFirstHalf<T extends { startMs: number; durationMs: number }>(
    blocks: T[] | undefined,
    splitMs: number
): T[] {
    if (!blocks) return [];
    return blocks
        .filter((b) => b.startMs < splitMs)
        .map((b) => ({
            ...b,
            durationMs: Math.min(b.durationMs, splitMs - b.startMs),
        }));
}

export function shiftBlocksForSecondHalf<T extends { id?: string; startMs: number; durationMs: number }>(
    blocks: T[] | undefined,
    splitMs: number,
    prefix = 'blk'
): T[] {
    if (!blocks) return [];
    return blocks
        .filter((b) => b.startMs + b.durationMs > splitMs)
        .map((b) => {
            const wasSplit = b.startMs < splitMs;
            const newStart = Math.max(0, b.startMs - splitMs);
            const remaining = b.startMs + b.durationMs - splitMs;
            return {
                ...b,
                id: wasSplit ? generateId(prefix) : (b.id ?? generateId(prefix)),
                startMs: newStart,
                durationMs: Math.min(b.durationMs, remaining),
            };
        });
}

// Keep curve bounds separate from the visible clip bounds. Completed blocks still
// contribute their held values; future light blocks may hold their first value.
export function sliceSceneBlocks<T extends {id?: string; startMs:number; durationMs:number; sourceStartMs?:number; sourceDurationMs?:number}>(blocks:T[]|undefined, offset:number, duration:number, prefix='blk'):T[] {
 return (blocks || [])
   .filter(b => b.startMs < offset + duration && b.startMs + b.durationMs > offset)
   .map(b => ({...b,
     id: (offset > 0 && b.startMs < offset) ? generateId(prefix) : (b.id ?? generateId(prefix)),
     sourceStartMs:(b.sourceStartMs ?? b.startMs)-offset,
     sourceDurationMs:b.sourceDurationMs ?? b.durationMs,
     startMs:Math.max(0,b.startMs-offset),
     durationMs:Math.min(b.durationMs, b.startMs+b.durationMs-offset, duration-Math.max(0,b.startMs-offset))
   }));
}


import type { Shot } from '../../model/types';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { getTimelineTransition } from './transitionSync';

export function getSnapTargets(shot: Shot, excludeId?: string): number[] {
    const targets = new Set<number>();
    targets.add(0);
    targets.add(shot.durationMs);

    const playheadTimeMs = usePlayheadStore.getState().currentTimeMs;
    const playheadLocalMs = playheadTimeMs - shot.startMs;
    if (playheadLocalMs >= 0 && playheadLocalMs <= shot.durationMs) {
        targets.add(playheadLocalMs);
    }

    for (const layer of shot.layers) {
        if (layer.id !== excludeId) {
            targets.add(layer.inMs);
            targets.add(layer.outMs);
        }
        if (
            getTimelineTransition(layer, 'entrance').type !== 'none' &&
            `${layer.id}-entrance` !== excludeId &&
            layer.id !== excludeId
        ) {
            const entrance = getTimelineTransition(layer, 'entrance');
            const entranceStart = layer.inMs + (entrance.delayMs || 0);
            const entranceDuration = Math.max(80, entrance.durationMs || 500);
            targets.add(entranceStart);
            targets.add(entranceStart + entranceDuration);
        }
        if (
            getTimelineTransition(layer, 'exit').type !== 'none' &&
            `${layer.id}-exit` !== excludeId &&
            layer.id !== excludeId
        ) {
            const exit = getTimelineTransition(layer, 'exit');
            const exitDuration = Math.max(80, exit.durationMs || 500);
            const exitEnd = layer.outMs - (exit.delayMs || 0);
            targets.add(Math.max(layer.inMs, exitEnd - exitDuration));
            targets.add(exitEnd);
        }
        for (const block of layer.blocks) {
            if (block.id !== excludeId) {
                targets.add(block.startMs);
                targets.add(block.startMs + block.durationMs);
            }
        }
    }

    // Camera move blocks
    for (const block of shot.cameraBlocks || []) {
        if (block.id !== excludeId) {
            targets.add(block.startMs);
            targets.add(block.startMs + block.durationMs);
        }
    }

    // Light animation blocks
    for (const block of shot.lightBlocks || []) {
        if (block.id !== excludeId) {
            targets.add(block.startMs);
            targets.add(block.startMs + block.durationMs);
        }
    }

    // Scene effect & rack focus blocks
    for (const block of shot.effectBlocks || []) {
        if (block.id !== excludeId) {
            targets.add(block.startMs);
            targets.add(block.startMs + block.durationMs);
        }
    }

    return Array.from(targets);
}

export function snapTime(
    value: number,
    targets: number[],
    threshold: number
): { time: number; snapped: boolean } {
    let closest = value;
    let minDifference = threshold;
    let snapped = false;
    for (const target of targets) {
        const difference = Math.abs(value - target);
        if (difference < minDifference) {
            minDifference = difference;
            closest = target;
            snapped = true;
        }
    }
    return { time: closest, snapped };
}

export type BeatDivision = 'bar' | 'beat' | 'half' | 'quarter';

export const BEAT_DIVISION_MULTIPLIERS: Record<BeatDivision, number> = {
    bar: 4,
    beat: 1,
    half: 0.5,
    quarter: 0.25,
};

export const BEAT_DIVISION_LABELS: Record<BeatDivision, string> = {
    bar: 'Bar',
    beat: '1/1',
    half: '1/2',
    quarter: '1/4',
};

/**
 * Returns grid step in milliseconds for a given BPM and division.
 * 60,000 / BPM * divisionMultiplier (matches Raylight xw(bpm) * IGt[division])
 */
export function getBeatGridIntervalMs(bpm: number, division: BeatDivision = 'beat'): number {
    if (!bpm || bpm <= 0) return 500;
    const beatMs = 60000 / bpm;
    return beatMs * (BEAT_DIVISION_MULTIPLIERS[division] ?? 1);
}

/**
 * Snaps timeMs to the nearest rhythmic beat grid line if within visual threshold.
 * Matches Raylight `lC = (timeMs, bpm, pxPerMs, division = 'beat', thresholdPx = 8)`
 */
export function snapToBeatGrid(
    timeMs: number,
    bpm: number,
    pxPerMs: number,
    division: BeatDivision = 'beat',
    thresholdPx = 8
): { time: number; snapped: boolean } {
    if (!bpm || bpm <= 0 || pxPerMs <= 0) {
        return { time: timeMs, snapped: false };
    }
    const gridMs = getBeatGridIntervalMs(bpm, division);
    if (gridMs <= 0) return { time: timeMs, snapped: false };

    const snappedTime = Math.max(0, Math.round(timeMs / gridMs) * gridMs);
    const diffPx = Math.abs(snappedTime - timeMs) * pxPerMs;
    if (diffPx <= thresholdPx) {
        return { time: snappedTime, snapped: true };
    }
    return { time: timeMs, snapped: false };
}


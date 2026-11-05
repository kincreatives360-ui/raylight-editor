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

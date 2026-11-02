type DragEvent = PointerEvent | MouseEvent;

interface PointerDragLifecycleOptions {
    pointerId: number | null;
    target: EventTarget;
    begin: () => void;
    commit: () => void;
    cancel: () => void;
    onMove: (event: DragEvent) => void;
    onEnd?: () => void;
}

function isOwnedPointerEvent(event: Event, pointerId: number): boolean {
    return 'pointerId' in event && event.pointerId === pointerId;
}

export function createPointerDragLifecycle({
    pointerId,
    target,
    begin,
    commit,
    cancel,
    onMove,
    onEnd,
}: PointerDragLifecycleOptions): () => void {
    let finished = false;

    const cleanup = () => {
        if (pointerId === null) {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        } else {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleCancel);
            target.removeEventListener('lostpointercapture', handleCancel);
        }
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('blur', handleCancel);
    };

    const finish = (cancelled: boolean) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (pointerId !== null && 'hasPointerCapture' in target) {
            try {
                const element = target as Element;
                if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
            } catch {
                // Ignore synthetic or non-capturable pointer events.
            }
        }

        if (cancelled) cancel();
        else commit();
        onEnd?.();
    };

    const handleMove = (event: DragEvent) => {
        if (pointerId !== null && !isOwnedPointerEvent(event, pointerId)) return;
        onMove(event);
    };
    const handleUp = (event: Event) => {
        if (pointerId !== null && !isOwnedPointerEvent(event, pointerId)) return;
        finish(false);
    };
    const handleCancel = (event: Event) => {
        if (pointerId !== null && 'pointerId' in event && !isOwnedPointerEvent(event, pointerId)) return;
        finish(true);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') finish(true);
    };

    begin();
    if (pointerId === null) {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    } else {
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleCancel);
        target.addEventListener('lostpointercapture', handleCancel);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleCancel);

    if (pointerId !== null && 'setPointerCapture' in target) {
        try {
            (target as Element).setPointerCapture(pointerId);
        } catch {
            // Ignore synthetic or non-capturable pointer events.
        }
    }

    return () => finish(true);
}

export function registerGradientDragCancellation(target: EventTarget, cancel: () => void): () => void {
    const onKeyDown = (event: Event) => {
        if ('key' in event && event.key === 'Escape') cancel();
    };
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('blur', cancel);
    return () => {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('blur', cancel);
    };
}

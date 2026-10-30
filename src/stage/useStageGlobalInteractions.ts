import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction, type RefObject } from 'react';
import { isInteractiveElement } from '../utils/shortcuts';

interface ViewportSize {
    width: number;
    height: number;
}

interface UseStageGlobalInteractionsOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    contextMenuOpen: boolean;
    dismissContextMenu: () => void;
    setViewportSize: Dispatch<SetStateAction<ViewportSize>>;
    setIsSpaceHeld: Dispatch<SetStateAction<boolean>>;
    frameSelectedLayersRef: MutableRefObject<() => void>;
}

export function useStageGlobalInteractions({
    containerRef,
    contextMenuOpen,
    dismissContextMenu,
    setViewportSize,
    setIsSpaceHeld,
    frameSelectedLayersRef,
}: UseStageGlobalInteractionsOptions): void {
    useEffect(() => {
        if (!contextMenuOpen) return;
        const handleDismiss = () => dismissContextMenu();
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
                event.preventDefault();
                dismissContextMenu();
            }
        };
        window.addEventListener('click', handleDismiss);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('click', handleDismiss);
            window.removeEventListener('keydown', handleKey);
        };
    }, [contextMenuOpen, dismissContextMenu]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            setViewportSize({
                width: Math.max(240, entry.contentRect.width - 16),
                height: Math.max(200, entry.contentRect.height - 74),
            });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [containerRef, setViewportSize]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const activeElement = document.activeElement as HTMLElement | null;
            if (isInteractiveElement(activeElement)) return;

            if (event.code === 'Space') setIsSpaceHeld(true);
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
                event.preventDefault();
                frameSelectedLayersRef.current();
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') setIsSpaceHeld(false);
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [frameSelectedLayersRef, setIsSpaceHeld]);
}

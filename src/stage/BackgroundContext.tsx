import { createContext, useContext, useMemo } from 'react';
import { resolveShotBackground } from '../model/types';
import type { Project, Shot, Background } from '../model/types';

interface BackgroundContextValue {
    effectiveBackground: Background;
    outgoingBackground: Background | null;
    isTransitioning: boolean;
    transitionProgress: number;
    transitionType: string;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

export function BackgroundProvider({
    children,
    project,
    frame,
}: {
    children: React.ReactNode;
    project: Project;
    frame: { activeShot: any; shotTransition?: { isTransitioning: boolean; progress: number; type: string; outgoingFrame?: { activeShot: any } } | null };
}) {
    const effectiveBackground = useMemo(() => {
        if (frame.activeShot) {
            return resolveShotBackground(project, frame.activeShot);
        }
        return project?.background ?? ({ kind: 'solid', color: '#0c0e17' } satisfies Background);
    }, [project, frame.activeShot]);

    const isTransitioning = useMemo(() => {
        return Boolean(
            frame.shotTransition?.isTransitioning &&
            frame.shotTransition.progress !== undefined &&
            frame.shotTransition.progress < 1 &&
            frame.shotTransition.outgoingFrame
        );
    }, [frame.shotTransition]);

    const outgoingBackground = useMemo(() => {
        if (isTransitioning && frame.shotTransition?.outgoingFrame?.activeShot) {
            return resolveShotBackground(project, frame.shotTransition.outgoingFrame.activeShot);
        }
        return null;
    }, [project, isTransitioning, frame.shotTransition]);

    const transitionProgress = frame.shotTransition?.progress ?? 0;
    const transitionType = frame.shotTransition?.type ?? 'crossfade';

    const value = useMemo(() => ({
        effectiveBackground,
        outgoingBackground,
        isTransitioning,
        transitionProgress,
        transitionType,
    }), [effectiveBackground, outgoingBackground, isTransitioning, transitionProgress, transitionType]);

    return (
        <BackgroundContext.Provider value={value}>
            {children}
        </BackgroundContext.Provider>
    );
}

export function useBackground() {
    const context = useContext(BackgroundContext);
    if (!context) {
        throw new Error('useBackground must be used within a BackgroundProvider');
    }
    return context;
}
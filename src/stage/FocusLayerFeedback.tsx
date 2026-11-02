import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { getLayerProjectedCorners } from './webgl/cameraMath';
import type { EvaluatedCameraPose } from './webgl/cameraMath';

interface FocusLayerFeedbackProps {
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    targetAspect: number;
    cameraPose: EvaluatedCameraPose;
    cameraZ: number;
    focalLength: number;
    hoveredDepth: number | null;
    faded: boolean;
}

export function FocusLayerFeedback({
    frame,
    frameWidth,
    frameHeight,
    targetAspect,
    cameraPose,
    cameraZ,
    focalLength,
    hoveredDepth,
    faded,
}: FocusLayerFeedbackProps) {
    const layers = frame.layers.filter(layer => layer.visible !== false && (layer.opacity ?? 1) > 0);

    return (
        <svg
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full overflow-visible pointer-events-none transition-opacity duration-500 ${faded ? 'opacity-35' : 'opacity-100'}`}
            viewBox={`0 0 ${frameWidth} ${frameHeight}`}
            preserveAspectRatio="none"
        >
            {layers.map(layer => {
                const { corners } = getLayerProjectedCorners(
                    layer,
                    frameWidth,
                    frameHeight,
                    targetAspect,
                    cameraPose,
                    cameraZ,
                    focalLength
                );
                const sharp = layer.dofBlurPx === 0;
                const totalBlur = Math.max(0, layer.totalBlurPx);
                const linked = hoveredDepth !== null && Math.abs(hoveredDepth - layer.position.z) < 0.001;
                const points = corners.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

                return (
                    <polygon
                        key={layer.id}
                        points={points}
                        fill="none"
                        stroke={linked ? '#fef08a' : sharp ? '#67e8f9' : '#fda4af'}
                        strokeWidth={linked ? 3 : sharp ? 1.5 : Math.min(4, 1 + totalBlur / 3)}
                        strokeOpacity={linked ? 1 : sharp ? 0.9 : Math.min(0.85, 0.25 + totalBlur / 20)}
                        pointerEvents="none"
                        data-focus-layer={layer.id}
                        data-focus-state={sharp ? 'sharp' : 'blurred'}
                        data-hover-linked={String(linked)}
                        data-dof-blur-px={layer.dofBlurPx}
                        data-total-blur-px={layer.totalBlurPx}
                    >
                        <title>{`${layer.name}: ${totalBlur}px total blur`}</title>
                    </polygon>
                );
            })}
        </svg>
    );
}

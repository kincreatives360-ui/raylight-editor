import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { projectFocusPlane } from './focusPlaneGeometry';
import { resolveVisibleDepthOfFieldSubjectPosition } from './webgl/depthOfFieldTarget';
import type { EvaluatedCameraPose } from './webgl/cameraMath';

interface DepthOfFieldFocusOverlayProps {
    frame: EvaluatedProjectFrame;
    frameWidth: number;
    frameHeight: number;
    targetAspect: number;
    cameraPose: EvaluatedCameraPose;
}

export function DepthOfFieldFocusOverlay({
    frame,
    frameWidth,
    frameHeight,
    targetAspect,
    cameraPose,
}: DepthOfFieldFocusOverlayProps) {
    const dof = frame.effects.state.depthOfField;
    if (!dof.enabled) return null;

    const focusDepth = resolveVisibleDepthOfFieldSubjectPosition(
        dof.focusMode,
        dof.focusTargetId,
        frame.layers,
    )?.z ?? dof.target.z;
    const points = projectFocusPlane(
        focusDepth,
        cameraPose,
        frameWidth,
        frameHeight,
        targetAspect,
    );
    if (points.length !== 4) return null;

    const polygonPoints = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    return (
        <div
            className="absolute inset-0 z-30 overflow-visible pointer-events-none"
            data-focus-plane-overlay=""
        >
            <svg
                aria-hidden="true"
                className="absolute inset-0 h-full w-full overflow-visible pointer-events-none"
                viewBox={`0 0 ${frameWidth} ${frameHeight}`}
                preserveAspectRatio="none"
            >
                <polygon
                    points={polygonPoints}
                    fill="none"
                    stroke="var(--accent-primary, #0088ff)"
                    strokeWidth={1.5}
                    pointerEvents="none"
                    data-focus-plane=""
                    data-focus-depth={focusDepth.toFixed(3)}
                />
            </svg>
        </div>
    );
}

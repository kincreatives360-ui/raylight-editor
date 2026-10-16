// src/stage/webgl/ViewportCanvas.tsx
import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Project } from '../../model/types';
import { resolveShotBackground } from '../../model/types';
import type {
    EvaluatedProjectFrame,
    EvaluatedLayerWithEffects,
} from '../../engine/evaluateShot';
import { SceneBackground } from './SceneBackground';
import { SceneLighting } from './SceneLighting';
import { ViewportCamera } from './ViewportCamera';
import { ThreeLayerObject } from './ThreeLayerObject';

interface ViewportCanvasProps {
    project: Project;
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    onPointerMissed?: () => void;
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

const ViewportRenderBridge: React.FC<{
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
}> = ({ frame, selectedLayerIds }) => {
    const { invalidate } = useThree();

    useEffect(() => {
        invalidate();
    }, [frame, selectedLayerIds, invalidate]);

    return null;
};

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
    project,
    frame,
    selectedLayerIds,
    onSelectLayer,
    onPointerMissed,
    cameraRef,
}) => {
    const activeShot = frame.activeShot;
    const layers: EvaluatedLayerWithEffects[] = frame.layers;
    const activeBackground = resolveShotBackground(project, activeShot);

    return (
        <div className="w-full h-full relative overflow-hidden select-none">
            <Canvas
                shadows
                flat
                frameloop="demand"
                dpr={[1, 2]}
                gl={{
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: true,
                    toneMapping: THREE.NoToneMapping,
                    outputColorSpace: THREE.SRGBColorSpace,
                    powerPreference: 'high-performance',
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
                onPointerMissed={onPointerMissed}
            >
                <ViewportRenderBridge
                    frame={frame}
                    selectedLayerIds={selectedLayerIds}
                />

                {/* 1. Time-Evaluated 3D Camera (Supports Dolly, Zoom & Dolly-Zoom!) */}
                <ViewportCamera
                    evaluatedCamera={frame.camera}
                    defaultCamera={{
                        position: project.defaultCamera?.position ?? {
                            x: 0,
                            y: 0,
                            z: 2.65,
                        },
                        rotation: project.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
                        focalLength: project.defaultCamera?.focalLength ?? 50,
                    }}
                    cameraRef={cameraRef}
                />

                {/* 2. Physical Scene Lighting with shadows and Kelvin temperature */}
                <SceneLighting light={activeShot?.light} />

                {/* 3. Shot-Aware Background Plane */}
                <SceneBackground background={activeBackground} />

                {/* 4. 3D Scene Objects / Layers with Depth Awareness */}
                <group name="raylight_layers_root">
                    {layers.map((evalLayer) => (
                        <ThreeLayerObject
                            key={evalLayer.id}
                            evalLayer={evalLayer}
                            project={project}
                            isSelected={selectedLayerIds.includes(evalLayer.id)}
                            onSelect={onSelectLayer}
                        />
                    ))}
                </group>
            </Canvas>
        </div>
    );
};
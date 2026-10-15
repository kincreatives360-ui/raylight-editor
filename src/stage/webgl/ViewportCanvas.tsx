import React from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { Project } from '../../model/types';
import type { EvaluatedProjectFrame, EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
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
                    toneMapping: THREE.NoToneMapping,
                    outputColorSpace: THREE.SRGBColorSpace,
                    powerPreference: 'high-performance',
                }}
                style={{ width: '100%', height: '100%', display: 'block' }}
                onPointerMissed={onPointerMissed}
            >
                {/* 1. Camera System */}
                <ViewportCamera
                    framing={activeShot?.framings?.[0]}
                    defaultCamera={{
                        position: { x: 0, y: 0, z: 2.65 },
                        rotation: { x: 0, y: 0, z: 0 },
                        focalLength: (activeShot as any)?.camera?.focalLength ?? 50,
                    }}
                    cameraRef={cameraRef}
                />

                {/* 2. Physical Scene Lighting */}
                <SceneLighting light={activeShot?.light} />

                {/* 3. Infinite Background Plane */}
                <SceneBackground background={project.background} />

                {/* 4. 3D Scene Objects / Layers */}
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

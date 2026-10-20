import React, { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Project, Background } from '../../model/types';
import { resolveShotBackground } from '../../model/types';
import type {
    EvaluatedProjectFrame,
    EvaluatedLayerWithEffects,
} from '../../engine/evaluateShot';
import { SceneBackground } from './SceneBackground';
import { SceneLighting } from './SceneLighting';
import { ViewportCamera } from './ViewportCamera';
import { ThreeLayerObject } from './ThreeLayerObject';
import { SceneEffectsPipeline } from './SceneEffectsPipeline';
import { usePlayheadStore } from '../../store/usePlayheadStore';

interface ViewportCanvasProps {
    project: Project;
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    onPointerMissed?: () => void;
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

const StudioEnvironment: React.FC = () => {
    const { gl } = useThree();

    const envTexture = useMemo(() => {
        const pmrem = new THREE.PMREMGenerator(gl);
        pmrem.compileEquirectangularShader();
        const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
        return texture;
    }, [gl]);

    useEffect(() => {
        return () => {
            envTexture.dispose();
        };
    }, [envTexture]);

    return <primitive object={envTexture} attach="environment" />;
};

const ViewportRenderBridge: React.FC<{
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    background?: Background;
}> = ({ frame, selectedLayerIds, background }) => {
    const { invalidate } = useThree();

    useEffect(() => {
        invalidate();
    }, [frame, selectedLayerIds, background, invalidate]);

    return null;
};

const WebGLContextGuard: React.FC = () => {
    const { gl, invalidate, scene, size } = useThree();

    useEffect(() => {
        const canvas = gl.domElement;
        const handleContextLost = (e: Event) => {
            e.preventDefault();
            console.warn('[Raylight Stage] WebGL context lost (e.g. OS sleep/tab backgrounding). Retaining scene state...');
        };
        const handleContextRestored = () => {
            console.info('[Raylight Stage] WebGL context restored. Re-initializing render state...');
            try {
                if (typeof gl.resetState === 'function') {
                    gl.resetState();
                }
                gl.setSize(size.width, size.height, false);
                // Mark scene materials for program recompilation on the restored context
                scene.traverse((obj) => {
                    const mesh = obj as THREE.Mesh;
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach((m) => (m.needsUpdate = true));
                        } else {
                            mesh.material.needsUpdate = true;
                        }
                    }
                });
            } catch (err) {
                console.warn('[Raylight Stage] Error resetting WebGL state on restore:', err);
            }
            invalidate();
        };

        canvas.addEventListener('webglcontextlost', handleContextLost, false);
        canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [gl, invalidate, scene, size]);

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
    const { isPlaying } = usePlayheadStore();
    const isAnimatedBg = activeBackground.kind === 'shader' || activeBackground.kind === 'noise';

    return (
        <div className="w-full h-full relative overflow-hidden select-none">
            <Canvas
                id="raylight-stage-webgl-canvas"
                shadows
                flat
                frameloop={isPlaying || isAnimatedBg ? 'always' : 'demand'}
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
                    background={activeBackground}
                />
                <WebGLContextGuard />

                {/* Studio PBR Reflection Environment Map */}
                <StudioEnvironment />

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

                {/* 3. Screen-Space Shot-Aware Background with Transition Support */}
                <SceneBackground project={project} frame={frame} background={activeBackground} assets={project.assets} />

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

                {/* 5. Realtime Cinematic Scene Effects (Bloom, Vignette, Chromatic Aberration, Grain, Glitch) */}
                <SceneEffectsPipeline effects={frame.effects} />
            </Canvas>
        </div>
    );
};
import React, { useEffect, useMemo, useState } from 'react';
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
import { getViewportPixelRatio } from './viewportResolution';
import { registerStageCapture } from '../../engine/stageCapture';


interface ViewportCanvasProps {
    project: Project;
    canvasZoom: number;
    frameWidth: number;
    frameHeight: number;
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    onPointerMissed?: () => void;
    cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

function useDevicePixelRatio() {
    const [deviceDpr, setDeviceDpr] = useState(() => window.devicePixelRatio || 1);

    useEffect(() => {
        const query = window.matchMedia(`(resolution: ${deviceDpr}dppx)`);
        const update = () => setDeviceDpr(window.devicePixelRatio || 1);
        query.addEventListener('change', update);
        window.addEventListener('resize', update);
        return () => {
            query.removeEventListener('change', update);
            window.removeEventListener('resize', update);
        };
    }, [deviceDpr]);

    return deviceDpr;
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


const StageCaptureBridge: React.FC = () => {
    const { gl, invalidate } = useThree();

    useEffect(() => {
        const unregister = registerStageCapture(async (_timeMs: number, _width: number, _height: number) => {
            invalidate();
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            return gl.domElement;
        });
        return unregister;
    }, [gl, invalidate]);

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

interface WebGLErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class WebGLErrorBoundary extends React.Component<{ children: React.ReactNode }, WebGLErrorBoundaryState> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[Raylight Viewport ErrorBoundary]', error, errorInfo);
    }

    override render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#0b0b0d] text-center select-none">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">WebGL Viewport Fallback</h3>
                    <p className="text-[11px] text-gray-400 max-w-sm mb-4">
                        {this.state.error?.message || 'A GPU shader or mesh initialization error occurred.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium transition cursor-pointer shadow-md"
                    >
                        Reset Canvas
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
    project,
    canvasZoom,
    frameWidth,
    frameHeight,
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
    const deviceDpr = useDevicePixelRatio();
    const [maxTextureSize, setMaxTextureSize] = useState(8192);
    const dpr = getViewportPixelRatio(frameWidth, frameHeight, canvasZoom, deviceDpr, maxTextureSize);

    return (
        <div className="w-full h-full relative overflow-hidden select-none">
            <WebGLErrorBoundary>
                <Canvas
                    id="raylight-stage-webgl-canvas"
                    shadows="soft"
                    flat
                    frameloop={isPlaying || isAnimatedBg ? 'always' : 'demand'}
                    dpr={dpr}
                    resize={{ offsetSize: true }}
                    gl={{
                        antialias: true,
                        alpha: true,
                        preserveDrawingBuffer: true,
                        toneMapping: THREE.NoToneMapping,
                        outputColorSpace: THREE.SRGBColorSpace,
                        powerPreference: 'high-performance',
                    }}
                    onCreated={({ gl }) => {
                        setMaxTextureSize(gl.capabilities.maxTextureSize);
                        gl.shadowMap.enabled = true;
                        gl.shadowMap.type = THREE.PCFSoftShadowMap;
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
                <StageCaptureBridge />

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
                            evaluatedCamera={frame.camera}
                            onSelect={onSelectLayer}
                        />
                    ))}
                </group>

                {/* 5. Realtime Cinematic Scene Effects (Bloom, Vignette, Chromatic Aberration, Grain, Glitch) */}
                <SceneEffectsPipeline effects={frame.effects} />
            </Canvas>
        </WebGLErrorBoundary>
    </div>
);
};

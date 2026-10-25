// src/stage/webgl/SceneLighting.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { kelvinToRgb } from '../stageUtils';
import type { Shot, SceneLight, LightRig } from '../../model/types';
import {
    KEY_LIGHT_MIN_Z,
    resolveKeyIntensity,
    resolveSourceIntensity,
    resolveFill,
    planShadowCasters,
} from '../../engine/lightMath';

interface SceneLightingProps {
    light?: Shot['light'];
}

let uniformsLibInitialized = false;
function initRectAreaLightUniforms() {
    if (!uniformsLibInitialized && typeof window !== 'undefined') {
        RectAreaLightUniformsLib.init();
        uniformsLibInitialized = true;
    }
}

const AreaLightItem: React.FC<{
    position: [number, number, number];
    intensity: number;
    color: THREE.Color;
    width: number;
    height: number;
}> = ({ position, intensity, color, width, height }) => {
    const lightRef = useRef<THREE.RectAreaLight>(null);
    const [posX, posY, posZ] = position;

    useLayoutEffect(() => {
        if (lightRef.current) {
            lightRef.current.lookAt(0, 0, 0);
        }
    }, [posX, posY, posZ]);

    return (
        <rectAreaLight
            ref={lightRef}
            position={position}
            intensity={intensity}
            color={color}
            width={width}
            height={height}
        />
    );
};

const SpotLightItem: React.FC<{
    position: [number, number, number];
    targetPos: [number, number, number];
    intensity: number;
    color: THREE.Color;
    distance: number;
    decay: number;
    angle: number;
    penumbra: number;
    castShadow: boolean;
}> = ({ position, targetPos, intensity, color, distance, decay, angle, penumbra, castShadow }) => {
    const spotRef = useRef<THREE.SpotLight>(null);
    const targetRef = useRef<THREE.Object3D>(null);

    useLayoutEffect(() => {
        if (spotRef.current && targetRef.current) {
            spotRef.current.target = targetRef.current;
        }
    }, [targetPos]);

    return (
        <group>
            <object3D ref={targetRef} position={targetPos} />
            <spotLight
                ref={spotRef}
                position={position}
                intensity={intensity}
                color={color}
                distance={distance}
                decay={decay}
                angle={angle}
                penumbra={penumbra}
                castShadow={castShadow}
                shadow-bias={-0.0001}
                shadow-normalBias={0.02}
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={0.1}
                shadow-camera-far={Math.max(12, distance)}
            />
        </group>
    );
};

const SpotGizmoLine: React.FC<{
    position: [number, number, number];
    targetPos: [number, number, number];
    colorHex: string;
}> = ({ position, targetPos, colorHex }) => {
    const [p0, p1, p2] = position;
    const [t0, t1, t2] = targetPos;
    const linePositions = useMemo(
        () => new Float32Array([p0, p1, p2, t0, t1, t2]),
        [p0, p1, p2, t0, t1, t2]
    );

    return (
        <line>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[linePositions, 3]}
                />
            </bufferGeometry>
            <lineDashedMaterial color={colorHex} dashSize={0.2} gapSize={0.1} />
        </line>
    );
};

/** Lightweight 3D wireframe helper gizmo showing light positions and orientations */
const LightGizmo: React.FC<{
    source: SceneLight;
    position: [number, number, number];
    color: THREE.Color;
}> = ({ source, position, color }) => {
    const colorHex = '#' + color.getHexString();

    if (source.type === 'point') {
        return (
            <group position={position}>
                <mesh>
                    <sphereGeometry args={[0.12, 12, 12]} />
                    <meshBasicMaterial color={colorHex} wireframe />
                </mesh>
                <mesh>
                    <ringGeometry args={[0.22, 0.25, 16]} />
                    <meshBasicMaterial color={colorHex} side={THREE.DoubleSide} />
                </mesh>
            </group>
        );
    }

    if (source.type === 'spot') {
        const targetPos: [number, number, number] = [
            (source.target?.x ?? 0) * 6,
            (source.target?.y ?? 0) * 6,
            (source.target?.z ?? 0) * 5,
        ];
        return (
            <group>
                <group position={position}>
                    <mesh>
                        <coneGeometry args={[0.2, 0.35, 8]} />
                        <meshBasicMaterial color={colorHex} wireframe />
                    </mesh>
                </group>
                <SpotGizmoLine position={position} targetPos={targetPos} colorHex={colorHex} />
            </group>
        );
    }

    if (source.type === 'area') {
        const w = source.width ?? 3;
        const h = source.height ?? 3;
        return (
            <group position={position}>
                <lineSegments>
                    <edgesGeometry args={[new THREE.PlaneGeometry(w, h)]} />
                    <lineBasicMaterial color={colorHex} />
                </lineSegments>
            </group>
        );
    }

    // Directional
    return (
        <group position={position}>
            <mesh>
                <octahedronGeometry args={[0.16]} />
                <meshBasicMaterial color={colorHex} wireframe />
            </mesh>
        </group>
    );
};

export const SceneLighting: React.FC<SceneLightingProps> = ({ light }) => {
    useEffect(() => {
        initRectAreaLightUniforms();
    }, []);

    const temp = light?.temperature;
    const posX = light?.position?.x ?? -0.28;
    const posY = light?.position?.y ?? 0.36;
    const posZ = light?.position?.z ?? 0.9;

    const lightColor = useMemo(() => {
        if (!temp) return new THREE.Color(0xffffff);
        const { r, g, b } = kelvinToRgb(temp);
        return new THREE.Color(r / 255, g / 255, b / 255);
    }, [temp]);

    const rig: LightRig = useMemo(() => {
        return light ?? {
            position: { x: posX, y: posY, z: posZ },
            intensity: 1.2,
            temperature: temp ?? 6100,
            ambience: 0.45,
        };
    }, [light, posX, posY, posZ, temp]);

    const lightPos: [number, number, number] = useMemo(() => {
        return [posX * 6, posY * 6, Math.max(KEY_LIGHT_MIN_Z, posZ * 5)];
    }, [posX, posY, posZ]);

    const keyIntensity = resolveKeyIntensity(rig);
    const fillState = resolveFill(rig);
    const shadowPlan = planShadowCasters(rig);

    const ambience = rig.ambience ?? 0.45;
    const ambientColor = rig.ambientColor || '#f8fafc';
    const keyEnabled = rig.keyLightEnabled !== false;
    const keyShadow = rig.castShadow !== false && shadowPlan.key;
    const showGizmos = rig.showGizmos ?? false;

    // Cap at maximum 8 active lights for peak real-time shader performance
    const sources = (rig.sources?.filter((source) => source.enabled) || []).slice(0, 8);

    const computedSources = useMemo(() => {
        return sources.map((source) => {
            const position: [number, number, number] = [
                (source.position?.x ?? 0) * 6,
                (source.position?.y ?? 0) * 6,
                (source.position?.z ?? 1) * 5,
            ];
            const baseColor = new THREE.Color(source.color || '#ffffff');
            const srcTemp = source.temperature ?? temp;
            const srcTempColor = srcTemp
                ? (() => {
                    const { r, g, b } = kelvinToRgb(srcTemp);
                    return new THREE.Color(r / 255, g / 255, b / 255);
                })()
                : lightColor;
            const color = baseColor.multiply(srcTempColor);
            const sourceIntensity = resolveSourceIntensity(rig, source);
            const castShadow = shadowPlan.sourceIds.has(source.id);
            const targetPos: [number, number, number] = [
                (source.target?.x ?? 0) * 6,
                (source.target?.y ?? 0) * 6,
                (source.target?.z ?? 0) * 5,
            ];

            return {
                source,
                position,
                targetPos,
                color,
                sourceIntensity,
                castShadow,
            };
        });
    }, [sources, temp, lightColor, rig, shadowPlan]);

    return (
        <group name="raylight_scene_lighting">
            {/* 1. SCENE AMBIENT (Shadow Floor): lights all surfaces equally, no direction or falloff */}
            <ambientLight intensity={0.15 + ambience * 1.2} color={ambientColor} />

            {/* 2. DIRECTIONAL KEY LIGHT (Sun): produces main shading gradient, specular streak, cast shadows */}
            {keyEnabled && (
                <directionalLight
                    position={lightPos}
                    intensity={keyIntensity * 2.2}
                    color={lightColor}
                    castShadow={keyShadow}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-camera-near={0.1}
                    shadow-camera-far={40}
                    shadow-camera-left={-4}
                    shadow-camera-right={4}
                    shadow-camera-top={4}
                    shadow-camera-bottom={-4}
                    shadow-bias={-0.0001}
                    shadow-normalBias={0.02}
                />
            )}

            {/* 2b. Secondary soft bounce fill opposite key light (independent fill control) */}
            {fillState.enabled && (
                <directionalLight
                    position={[-lightPos[0] * 0.7, -lightPos[1] * 0.5, lightPos[2] * 0.5]}
                    intensity={keyIntensity * fillState.intensity}
                    color="#e0e7ff"
                />
            )}

            {/* Gizmo for Key Light if gizmos enabled */}
            {showGizmos && keyEnabled && (
                <group position={lightPos}>
                    <mesh>
                        <sphereGeometry args={[0.22, 16, 16]} />
                        <meshBasicMaterial color="#fbbf24" wireframe />
                    </mesh>
                </group>
            )}

            {/* 3. MULTIPLE INDEPENDENT LIGHT SOURCES (Point, Spot, Area, Directional) */}
            {computedSources.map(({ source, position, targetPos, color, sourceIntensity, castShadow }) => {
                if (source.type === 'ambient') {
                    return <ambientLight key={source.id} intensity={sourceIntensity * 0.5} color={color} />;
                }

                if (source.type === 'point') {
                    return (
                        <React.Fragment key={source.id}>
                            <pointLight
                                position={position}
                                intensity={sourceIntensity}
                                color={color}
                                distance={source.distance ?? 10}
                                decay={source.decay ?? 2}
                                castShadow={castShadow}
                                shadow-bias={-0.0001}
                                shadow-normalBias={0.02}
                                shadow-mapSize-width={2048}
                                shadow-mapSize-height={2048}
                                shadow-camera-near={0.1}
                                shadow-camera-far={Math.max(10, source.distance ?? 10)}
                            />
                            {showGizmos && <LightGizmo source={source} position={position} color={color} />}
                        </React.Fragment>
                    );
                }

                if (source.type === 'spot') {
                    return (
                        <React.Fragment key={source.id}>
                            <SpotLightItem
                                position={position}
                                targetPos={targetPos}
                                intensity={sourceIntensity}
                                color={color}
                                distance={source.distance ?? 12}
                                decay={source.decay ?? 2}
                                angle={source.angle ?? Math.PI / 5}
                                penumbra={source.penumbra ?? 0.4}
                                castShadow={castShadow}
                            />
                            {showGizmos && <LightGizmo source={source} position={position} color={color} />}
                        </React.Fragment>
                    );
                }

                if (source.type === 'area') {
                    return (
                        <React.Fragment key={source.id}>
                            <AreaLightItem
                                position={position}
                                intensity={sourceIntensity}
                                color={color}
                                width={source.width ?? 3}
                                height={source.height ?? 3}
                            />
                            {showGizmos && <LightGizmo source={source} position={position} color={color} />}
                        </React.Fragment>
                    );
                }

                // Default: directional light
                return (
                    <React.Fragment key={source.id}>
                        <directionalLight
                            position={position}
                            intensity={sourceIntensity}
                            color={color}
                            castShadow={castShadow}
                            shadow-bias={-0.0001}
                            shadow-normalBias={0.02}
                            shadow-mapSize-width={2048}
                            shadow-mapSize-height={2048}
                            shadow-camera-near={0.1}
                            shadow-camera-far={40}
                            shadow-camera-left={-4}
                            shadow-camera-right={4}
                            shadow-camera-top={4}
                            shadow-camera-bottom={-4}
                        />
                        {showGizmos && <LightGizmo source={source} position={position} color={color} />}
                    </React.Fragment>
                );
            })}
        </group>
    );
};

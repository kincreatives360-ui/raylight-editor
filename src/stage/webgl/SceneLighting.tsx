// src/stage/webgl/SceneLighting.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { kelvinToRgb } from '../Stage';
import type { Shot } from '../../model/types';

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

    useLayoutEffect(() => {
        if (lightRef.current) {
            lightRef.current.lookAt(0, 0, 0);
        }
    }, [position[0], position[1], position[2]]);

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

export const SceneLighting: React.FC<SceneLightingProps> = ({ light }) => {
    useEffect(() => {
        initRectAreaLightUniforms();
    }, []);

    const temp = light?.temperature;
    const posX = light?.position?.x;
    const posY = light?.position?.y;
    const posZ = light?.position?.z;

    const lightColor = useMemo(() => {
        if (!temp) return new THREE.Color(0xffffff);
        const { r, g, b } = kelvinToRgb(temp);
        return new THREE.Color(r / 255, g / 255, b / 255);
    }, [temp]);

    const lightPos: [number, number, number] = useMemo(() => {
        if (posX === undefined || posY === undefined || posZ === undefined) return [3.5, 6.0, 4.5];
        return [posX * 6, posY * 6, Math.max(2.5, (posZ ?? 1) * 5)];
    }, [posX, posY, posZ]);

    const intensity = light?.intensity ?? 2.5;

    const sources = light?.sources?.filter((source) => source.enabled) || [];

    return (
        <group name="raylight_scene_lighting">
            {sources.length === 0 ? (
                <>
                    <ambientLight intensity={0.25 + (light?.ambience ?? 0.38)} color="#f8fafc" />
                    <directionalLight position={lightPos} intensity={intensity} color={lightColor} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-near={0.1} shadow-camera-far={40} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0002} />
                    <directionalLight position={[-lightPos[0] * 0.7, -lightPos[1] * 0.5, lightPos[2] * 0.5]} intensity={intensity * 0.35} color="#e0e7ff" />
                </>
            ) : sources.map((source) => {
                const position: [number, number, number] = [
                    (source.position.x + (posX ?? 0)) * 6,
                    (source.position.y + (posY ?? 0)) * 6,
                    Math.max(0.1, (source.position.z + (posZ ?? 0)) * 5),
                ];
                const baseColor = new THREE.Color(source.color || '#ffffff');
                const color = temp ? baseColor.clone().multiply(lightColor) : baseColor;
                const sourceIntensity = source.intensity * (light?.intensity ?? 1);
                if (source.type === 'ambient') return <ambientLight key={source.id} intensity={sourceIntensity} color={color} />;
                if (source.type === 'point') return <pointLight key={source.id} position={position} intensity={sourceIntensity} color={color} distance={source.distance ?? 8} castShadow />;
                if (source.type === 'spot') return <spotLight key={source.id} position={position} intensity={sourceIntensity} color={color} distance={source.distance ?? 8} angle={source.angle ?? Math.PI / 5} penumbra={source.penumbra ?? 0.35} castShadow />;
                if (source.type === 'area') {
                    return (
                        <AreaLightItem
                            key={source.id}
                            position={position}
                            intensity={sourceIntensity}
                            color={color}
                            width={source.width ?? 2}
                            height={source.height ?? 2}
                        />
                    );
                }
                return <directionalLight key={source.id} position={position} intensity={sourceIntensity} color={color} castShadow />;
            })}
        </group>
    );
};

// src/stage/webgl/SceneLighting.tsx
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { kelvinToRgb } from '../Stage';
import type { Shot } from '../../model/types';

interface SceneLightingProps {
    light?: Shot['light'];
}

export const SceneLighting: React.FC<SceneLightingProps> = ({ light }) => {
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
        if (posX === undefined || posY === undefined || posZ === undefined) return [5.3, 12.0, 4.7];
        return [posX, posY, posZ];
    }, [posX, posY, posZ]);

    const intensity = light?.intensity ?? 2.5;

    return (
        <group name="raylight_scene_lighting">
            {/* Ambient Base Light */}
            <ambientLight intensity={0.85} color="#f8fafc" />

            {/* Main Key Sun Directional Light with Kelvin Color */}
            <directionalLight
                position={lightPos}
                intensity={intensity}
                color={lightColor}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={0.1}
                shadow-camera-far={50}
                shadow-camera-left={-5}
                shadow-camera-right={5}
                shadow-camera-top={5}
                shadow-camera-bottom={-5}
                shadow-bias={-0.0001}
            />

            {/* Secondary Soft Fill Light to avoid pitch-black unlit phone edges */}
            <directionalLight
                position={[-lightPos[0] * 0.7, -lightPos[1] * 0.5, lightPos[2] * 0.5]}
                intensity={intensity * 0.3}
                color="#e0e7ff"
            />
        </group>
    );
};

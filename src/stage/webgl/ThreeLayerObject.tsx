// src/stage/webgl/ThreeLayerObject.tsx
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type { Project, TextLayer, ShapeLayer } from '../../model/types';

interface ThreeLayerObjectProps {
    evalLayer: EvaluatedLayerWithEffects;
    project: Project;
    isSelected: boolean;
    onSelect: (layerId: string, multiSelect?: boolean) => void;
}

/**
 * Creates a rounded rectangle Shape in Three.js
 */
function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const r = Math.min(radius, width / 2, height / 2);

    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    return shape;
}

export const ThreeLayerObject: React.FC<ThreeLayerObjectProps> = ({
    evalLayer,
    isSelected,
    onSelect,
}) => {
    const meshRef = useRef<THREE.Group>(null);
    const { layer } = evalLayer;

    // 3D Transforms
    const pos = evalLayer.position;
    const rot = evalLayer.rotation;
    const scale = evalLayer.scale;

    // Convert positions to 3D world units (pos.x and pos.y are centered around 0)
    const worldX = pos.x * 3.5;
    const worldY = -pos.y * 2.0;
    const worldZ = (pos.z ?? 0);

    // Determine device frame
    const device = layer.kind === 'image' ? layer.device : undefined;
    const isPhone = device?.type === 'iphone';

    // Physical dimensions
    const baseW = 1.0 * (scale.x || 1);
    const baseH = (isPhone ? 2.15 : 1.4) * (scale.y || 1);

    // Create texture for the layer
    const texture = useMemo(() => {
        if (layer.kind === 'image') {
            const assetUrl = layer.assetId;
            if (!assetUrl) return null;
            const loader = new THREE.TextureLoader();
            const tex = loader.load(assetUrl);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            return tex;
        }

        // Procedural texture for text / shape
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        if (layer.kind === 'text') {
            const textL = layer as TextLayer;
            ctx.fillStyle = textL.font.color || '#ffffff';
            ctx.font = `${Math.round(textL.font.size * 1024)}px sans-serif`;
            ctx.textAlign = textL.font.align || 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(textL.content || 'Text', 512, 512);
        } else if (layer.kind === 'shape') {
            const shapeL = layer as ShapeLayer;
            ctx.fillStyle = shapeL.fill.kind === 'solid' ? shapeL.fill.color : '#6366f1';
            if (shapeL.shape === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(512, 512, 450, 450, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(64, 64, 896, 896);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, [layer]);

    // Rounded rectangle geometry for screen and device body
    const roundedShape = useMemo(() => {
        return createRoundedRectShape(baseW, baseH, isPhone ? 0.12 : 0.04);
    }, [baseW, baseH, isPhone]);

    // Extrude geometry for 3D Phone Chassis
    const extrudeSettings = useMemo(() => ({
        depth: 0.06,
        bevelEnabled: true,
        bevelSegments: 6,
        steps: 1,
        bevelSize: 0.02,
        bevelThickness: 0.02,
    }), []);

    const opacity = evalLayer.opacity ?? 1;

    return (
        <group
            ref={meshRef}
            position={[worldX, worldY, worldZ]}
            rotation={[rot.x, rot.y, rot.z]}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(layer.id, e.shiftKey || e.metaKey);
            }}
        >
            {/* 1. If 3D Device Frame (iPhone): Render Titanium Chassis */}
            {isPhone && (
                <group position={[0, 0, -0.04]}>
                    {/* Metal Body / Bezel */}
                    <mesh castShadow receiveShadow>
                        <extrudeGeometry args={[roundedShape, extrudeSettings]} />
                        <meshStandardMaterial
                            color={device?.color === 'black' ? '#1c1c1f' : '#2d2f36'}
                            metalness={0.92}
                            roughness={0.28}
                            envMapIntensity={1.2}
                        />
                    </mesh>

                    {/* Camera Island Bump on Back */}
                    <mesh position={[baseW * 0.22, baseH * 0.32, -0.01]}>
                        <boxGeometry args={[baseW * 0.42, baseW * 0.42, 0.03]} />
                        <meshStandardMaterial
                            color="#18181b"
                            metalness={0.8}
                            roughness={0.3}
                        />
                    </mesh>

                    {/* Camera Lenses */}
                    <mesh position={[baseW * 0.14, baseH * 0.38, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.07, 0.07, 0.02, 24]} />
                        <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh position={[baseW * 0.30, baseH * 0.38, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.07, 0.07, 0.02, 24]} />
                        <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh position={[baseW * 0.22, baseH * 0.26, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.07, 0.07, 0.02, 24]} />
                        <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.1} />
                    </mesh>
                </group>
            )}

            {/* 2. Screen Surface Quad with Texture */}
            <mesh position={[0, 0, 0.015]} castShadow receiveShadow>
                <shapeGeometry args={[roundedShape]} />
                <meshBasicMaterial
                    map={texture || undefined}
                    color={texture ? '#ffffff' : '#3b82f6'}
                    transparent={opacity < 1}
                    opacity={opacity}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 3. Dynamic Island Notch for iPhone */}
            {isPhone && (
                <mesh position={[0, baseH * 0.42, 0.018]} rotation={[0, 0, Math.PI / 2]}>
                    <capsuleGeometry args={[0.03, 0.12, 8, 16]} />
                    <meshBasicMaterial color="#000000" />
                </mesh>
            )}

            {/* 4. Selection Bounding Highlight (Only when selected) */}
            {isSelected && (
                <lineSegments position={[0, 0, 0.02]}>
                    <edgesGeometry args={[new THREE.PlaneGeometry(baseW * 1.04, baseH * 1.04)]} />
                    <lineBasicMaterial color="#3b82f6" linewidth={2} />
                </lineSegments>
            )}
        </group>
    );
};

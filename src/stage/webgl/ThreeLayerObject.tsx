import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createNormalizedRoundedGeometry, getLayerBlurBleedLayout } from './threeLayerObjectHelpers';
import { useThree } from '@react-three/fiber';
import { DeviceOpacityGroup } from './DeviceOpacityGroup';
import { getMediaTextureSize, getLayerSurfaceState } from './mediaSurface';
import type { EvaluatedLayerWithEffects } from '../../engine/evaluateShot';
import type { EvaluatedCamera } from '../../engine/evaluateCamera';
import type { Project } from '../../model/types';
import { evaluateCameraPose, getLayerProjectedCorners, getLayerRenderLayout, getAspectRatio } from './cameraMath';
import { SCREEN_PLANE_Z, getDeviceSpec } from '../../model/deviceFrame';
import { PhoneDeviceFrame } from './PhoneDeviceFrame';
import { MacBookProFrame } from './MacBookProFrame';
import { useLayerTexture } from './useLayerTexture';
import { useLayerWarpGeometry } from './useLayerWarpGeometry';
import { useLayerBackdropCapture } from './useLayerBackdropCapture';

interface ThreeLayerObjectProps {
    evalLayer: EvaluatedLayerWithEffects;
    project: Project;
    evaluatedCamera: EvaluatedCamera;
    onSelect: (layerId: string, multiSelect?: boolean) => void;
    shotStartMs?: number;
    currentTimeMs?: number;
}

export const ThreeLayerObject: React.FC<ThreeLayerObjectProps> = ({
    evalLayer,
    project,
    evaluatedCamera,
    onSelect,
    shotStartMs = 0,
    currentTimeMs = 0,
}) => {
    const { layer } = evalLayer;
    const { invalidate, gl, size } = useThree();
    const dpr = useThree((state) => state.viewport.dpr);

    const aspect = getAspectRatio(project.aspectRatio);
    const cameraZ = project.defaultCamera?.position?.z ?? 2.65;
    const focalLength = project.defaultCamera?.focalLength ?? 50;

    const {
        worldX,
        worldY,
        worldZ,
        meshW,
        meshH,
        deviceSettings: deviceFrameSettings,
        frameMetrics: deviceFrameMetrics,
        scale,
    } = useMemo(
        () => getLayerRenderLayout(evalLayer, aspect, cameraZ, focalLength),
        [evalLayer, aspect, cameraZ, focalLength]
    );

    const screenFit = deviceFrameSettings?.screenFit ?? 'stretch';
    const screenFill = deviceFrameSettings?.screenFillColor;
    const screenPan = deviceFrameSettings?.screenPan;
    const screenZoom = deviceFrameSettings?.screenZoom;
    const rot = evalLayer.rotation;
    const opacity = evalLayer.opacity ?? 1;

    // Authored layer blur is sampled by the material; retain animation blur here.
    const totalBlurPx = Math.max(
        0,
        Math.round(((evalLayer.totalBlurPx ?? 0) - (layer.effects.layerBlur ?? 0) * 100) * 2) / 2
    );
    const authoredW = Math.max(1, evalLayer.size.width * 1920);
    const authoredH = Math.max(1, evalLayer.size.height * 1080);
    const surface = getLayerSurfaceState(layer, Boolean(deviceFrameSettings), opacity, evalLayer.visible);

    const cameraPose = evaluateCameraPose(
        evaluatedCamera,
        {
            position: project.defaultCamera?.position ?? { x: 0, y: 0, z: cameraZ },
            rotation: project.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
            focalLength,
        },
        aspect
    );

    const corners = getLayerProjectedCorners(
        evalLayer,
        size.width * dpr,
        size.height * dpr,
        aspect,
        cameraPose,
        cameraZ,
        focalLength,
        'screen'
    );
    const edgeLength = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const { width: canvasW, height: canvasH } = getMediaTextureSize(meshW, meshH);

    const { blurPadding, paddedCanvasW, paddedCanvasH, widthScale, heightScale } = getLayerBlurBleedLayout(
        canvasW,
        canvasH,
        totalBlurPx,
        evalLayer.motionBlur,
        Boolean(deviceFrameSettings),
        0
    );

    const maxTexSize = gl.capabilities.maxTextureSize || 4096;
    const { width: targetPaddedTextureW, height: targetPaddedTextureH } = getMediaTextureSize(
        meshW * widthScale,
        meshH * heightScale,
        {
            pixelWidth: Math.max(edgeLength(corners.pNW, corners.pNE), edgeLength(corners.pSW, corners.pSE)) * widthScale,
            pixelHeight: Math.max(edgeLength(corners.pNW, corners.pSW), edgeLength(corners.pNE, corners.pSE)) * heightScale,
            maxTextureSize: maxTexSize,
        }
    );
    const paddedTextureW = Math.min(maxTexSize, Math.max(1, Math.round(targetPaddedTextureW)));
    const paddedTextureH = Math.min(maxTexSize, Math.max(1, Math.round(targetPaddedTextureH)));
    const texturePixelRatio = paddedTextureW / paddedCanvasW;

    const surfaceMesh = useRef<THREE.Mesh>(null);

    // 1. Hook: Backdrop capture & shader uniforms for glass / blur / CRT / blend modes
    const { compileEffects, captureBackdrop } = useLayerBackdropCapture({
        layer,
        shotStartMs,
        currentTimeMs,
        authoredW,
        authoredH,
        widthScale,
        heightScale,
        surfaceMeshRef: surfaceMesh,
    });

    // 2. Hook: Canvas texture, drawing, video playback sync & halo
    const { texture, halo } = useLayerTexture({
        layer,
        evalLayer,
        project,
        surfaceVisible: surface.visible,
        screenFit,
        screenFill,
        screenPan,
        screenZoom,
        totalBlurPx,
        authoredW,
        authoredH,
        canvasW,
        canvasH,
        widthScale,
        heightScale,
        blurPadding,
        paddedCanvasW,
        paddedCanvasH,
        paddedTextureW,
        paddedTextureH,
        texturePixelRatio,
        shotStartMs,
        gl,
        invalidate,
    });

    // 3. Hook: Warp geometry & turbulent animation
    const { warpedGeometry, warpedHaloGeometry } = useLayerWarpGeometry({
        warp: layer.effects.warp,
        meshW,
        meshH,
        widthScale,
        heightScale,
        authoredW,
        authoredH,
        halo,
        currentTimeMs,
        shotStartMs,
    });

    const cornerRadiusWorld = useMemo(() => {
        if (deviceFrameMetrics) return deviceFrameMetrics.cornerRadius;
        if (layer.kind !== 'text') {
            return (layer.cornerRadius ?? 0.03) * Math.min(meshW, meshH) * 0.5;
        }
        return 0.005;
    }, [layer, meshW, meshH, deviceFrameMetrics]);

    // Rounded geometry is used for ordinary image and video layer corners.
    const normalizedScreenGeometry = useMemo(
        () => createNormalizedRoundedGeometry(meshW, meshH, cornerRadiusWorld),
        [meshW, meshH, cornerRadiusWorld]
    );

    useEffect(() => {
        return () => {
            normalizedScreenGeometry?.dispose();
        };
    }, [normalizedScreenGeometry]);

    if (!surface.visible) return null;
    const renderOpacity = surface.surfaceOpacity;
    const receivesLight = surface.receivesLight;

    const surfaceRoughness = layer.material?.roughness ?? 0.24;
    const surfaceMetalness = layer.material?.metalness ?? 0.06;

    const haloZ = deviceFrameMetrics
        ? SCREEN_PLANE_Z - deviceFrameMetrics.bodyDepth * 1.1 - 0.001
        : SCREEN_PLANE_Z - 0.001;

    const contents = (
        <>
            {halo && (
                <mesh
                    geometry={warpedHaloGeometry ?? undefined}
                    position={[0, 0, haloZ]}
                    renderOrder={layer.order * 2}
                >
                    {!warpedHaloGeometry && (
                        <planeGeometry
                            args={[meshW * widthScale * halo.widthScale, meshH * heightScale * halo.heightScale]}
                        />
                    )}
                    <meshBasicMaterial
                        map={halo.texture}
                        transparent
                        opacity={renderOpacity}
                        toneMapped={false}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
            <mesh
                ref={surfaceMesh}
                onBeforeRender={captureBackdrop}
                renderOrder={layer.order * 2 + 1}
                position={[0, 0, SCREEN_PLANE_Z]}
                geometry={
                    warpedGeometry ??
                    (blurPadding <= 0 && (layer.kind === 'image' || layer.kind === 'video') && !deviceFrameSettings
                        ? normalizedScreenGeometry ?? undefined
                        : undefined)
                }
                castShadow={receivesLight && (layer.kind === 'image' || layer.kind === 'video')}
                receiveShadow={receivesLight}
            >
                {!warpedGeometry &&
                    (blurPadding > 0 || (layer.kind !== 'image' && layer.kind !== 'video') || Boolean(deviceFrameSettings)) && (
                        <planeGeometry args={[meshW * widthScale, meshH * heightScale]} />
                    )}
                {receivesLight ? (
                    <meshStandardMaterial
                        key={layer.id + JSON.stringify(layer.effects) + layer.blendMode}
                        map={texture ?? undefined}
                        onBeforeCompile={compileEffects}
                        customProgramCacheKey={() => `layer-effects-${layer.id}-${layer.blendMode}`}
                        color="#ffffff"
                        transparent
                        opacity={renderOpacity}
                        metalness={surfaceMetalness}
                        roughness={surfaceRoughness}
                        side={THREE.DoubleSide}
                    />
                ) : (
                    <meshBasicMaterial
                        key={layer.id + JSON.stringify(layer.effects) + layer.blendMode}
                        map={texture ?? undefined}
                        onBeforeCompile={compileEffects}
                        customProgramCacheKey={() => `layer-effects-${layer.id}-${layer.blendMode}`}
                        color="#ffffff"
                        transparent
                        opacity={renderOpacity}
                        side={THREE.DoubleSide}
                    />
                )}
            </mesh>
            {deviceFrameSettings && deviceFrameMetrics && (
                getDeviceSpec(deviceFrameSettings.deviceId).family === 'laptop' ? (
                    <MacBookProFrame
                        metrics={deviceFrameMetrics}
                        settings={deviceFrameSettings}
                        rotation={rot}
                    />
                ) : (
                    <PhoneDeviceFrame
                        metrics={deviceFrameMetrics}
                        settings={deviceFrameSettings}
                        rotation={rot}
                    />
                )
            )}
        </>
    );

    return (
        <group
            position={[worldX, worldY, worldZ]}
            rotation={[-rot.x, rot.y, -rot.z]}
            scale={[scale.x, scale.y, scale.z || 1]}
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey);
            }}
        >
            {deviceFrameSettings ? (
                <DeviceOpacityGroup opacity={surface.assemblyOpacity}>{contents}</DeviceOpacityGroup>
            ) : (
                contents
            )}
        </group>
    );
};

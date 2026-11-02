import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Layer } from '../../model/types';
import { getBlurSettings } from '../../model/layerEffects';
import { getLayerEffectUniforms, installLayerEffects } from './layerEffects';

interface UseLayerBackdropCaptureParams {
    layer: Layer;
    shotStartMs: number;
    currentTimeMs: number;
    authoredW: number;
    authoredH: number;
    widthScale: number;
    heightScale: number;
    surfaceMeshRef: React.RefObject<THREE.Mesh | null>;
}

export function useLayerBackdropCapture({
    layer,
    shotStartMs,
    currentTimeMs,
    authoredW,
    authoredH,
    widthScale,
    heightScale,
    surfaceMeshRef,
}: UseLayerBackdropCaptureParams) {
    const effectUniforms = useMemo(
        () => getLayerEffectUniforms(layer.effects, layer.blendMode),
        [layer.effects, layer.blendMode]
    );

    const effectUniformsRef = useRef(effectUniforms);
    useLayoutEffect(() => {
        effectUniformsRef.current = effectUniforms;
    }, [effectUniforms]);

    const sceneCopy = useRef<THREE.FramebufferTexture | null>(null);
    const viewVectors = useMemo(
        () => ({ normal: new THREE.Vector3(), direction: new THREE.Vector3() }),
        []
    );

    useEffect(() => {
        return () => {
            sceneCopy.current?.dispose();
            sceneCopy.current = null;
        };
    }, []);

    const captureBackdrop = (
        renderer: THREE.WebGLRenderer,
        _scene: THREE.Scene,
        camera: THREE.Camera
    ) => {
        const uniforms = effectUniformsRef.current;
        const timeMs = currentTimeMs ?? 0;
        uniforms.layerTime.value = Math.max(0, timeMs - shotStartMs) / 1000;

        if (surfaceMeshRef.current && uniforms.layerScreen.value.x > 0) {
            viewVectors.normal.set(0, 0, 1).transformDirection(surfaceMeshRef.current.matrixWorld);
            camera.getWorldDirection(viewVectors.direction);
            uniforms.layerViewAngle.value = 1 - Math.abs(viewVectors.normal.dot(viewVectors.direction));
        }

        uniforms.layerAuthorSize.value.set(authoredW * widthScale, authoredH * heightScale);
        uniforms.layerContentScale.value.set(widthScale, heightScale);

        const profile = getBlurSettings(layer.effects, 'backdropBlur');
        uniforms.layerBackdrop.value = Math.max(profile.start, profile.end);

        const glass = layer.effects.liquidGlass?.enabled ? layer.effects.liquidGlass : undefined;
        uniforms.layerGlass.value = glass ? 1 : 0;
        if (glass) {
            uniforms.layerGlassParams.value.set(
                glass.refraction ?? 0.6,
                glass.ior ?? 1.52,
                glass.bevelWidth ?? 24,
                glass.dispersion ?? 0.45
            );
            uniforms.layerGlassLighting.value.set(
                glass.roughness ?? 0.05,
                glass.shine ?? 0.7,
                glass.fresnel ?? 0.6,
                ((glass.lightAngle ?? 45) * Math.PI) / 180
            );
            uniforms.layerGlassOptics.value.set(
                glass.doubleBevel ?? 0.4,
                glass.chromaBoost ?? 0.8,
                0,
                0
            );
            uniforms.layerRimColor.value.set(glass.rimColor ?? '#cce4ff');
            uniforms.layerTint.value.set(glass.tint ?? '#ffffff');
        }

        if (!uniforms.layerBlend.value && !uniforms.layerBackdrop.value && !uniforms.layerGlass.value) {
            return;
        }

        const target = renderer.getRenderTarget();
        const dimensions = target
            ? new THREE.Vector2(target.width, target.height)
            : renderer.getDrawingBufferSize(new THREE.Vector2());

        if (
            !sceneCopy.current ||
            sceneCopy.current.image.width !== dimensions.x ||
            sceneCopy.current.image.height !== dimensions.y
        ) {
            sceneCopy.current?.dispose();
            sceneCopy.current = new THREE.FramebufferTexture(dimensions.x, dimensions.y);
            sceneCopy.current.type = target?.texture.type ?? THREE.UnsignedByteType;
            sceneCopy.current.minFilter = THREE.LinearFilter;
            sceneCopy.current.magFilter = THREE.LinearFilter;
        }

        try {
            renderer.copyFramebufferToTexture(sceneCopy.current);
            uniforms.layerScene.value = sceneCopy.current;
            uniforms.layerResolution.value.copy(dimensions);
            uniforms.layerPixelRatio.value = dimensions.x / 1920;
        } catch {
            // Guard against driver-level framebuffer read errors
        }
    };

    const compileEffects = (shader: THREE.WebGLProgramParametersWithUniforms) => {
        installLayerEffects(shader, effectUniformsRef.current);
    };

    return {
        effectUniformsRef,
        compileEffects,
        captureBackdrop,
    };
}

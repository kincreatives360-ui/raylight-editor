// src/stage/webgl/SceneEffectsPipeline.tsx
import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { renderSceneFrame } from './sceneRenderLoop';
import type { EffectKey } from '../../model/types';
import type { EvaluatedEffects } from '../../engine/evaluateEffects';
import {
    createSceneEffectPass,
    configureSceneEffectPass,
    createOutputEncodingPass,
} from './sceneEffectPasses';

interface SceneEffectsPipelineProps {
    effects: EvaluatedEffects;
    outgoingEffects?: EvaluatedEffects;
    transitionProgress?: number;
}

function blendEvaluatedEffects(
    outgoing: EvaluatedEffects,
    incoming: EvaluatedEffects,
    progress: number
): EvaluatedEffects {
    const t = Math.max(0, Math.min(1, progress));
    const outState = outgoing.state;
    const inState = incoming.state;

    const activeKeys = new Set([
        ...outgoing.orderedEnabledPasses.map(p => p.key),
        ...incoming.orderedEnabledPasses.map(p => p.key),
    ]);

    const blendedState = structuredClone(inState);

    if (activeKeys.has('bloom')) {
        const outIntensity = outState.bloom.enabled ? outState.bloom.intensity : 0;
        const inIntensity = inState.bloom.enabled ? inState.bloom.intensity : 0;
        blendedState.bloom.enabled = true;
        blendedState.bloom.intensity = outIntensity * (1 - t) + inIntensity * t;
    }
    if (activeKeys.has('vignette')) {
        const outV = outState.vignette.enabled ? outState.vignette.intensity : 0;
        const inV = inState.vignette.enabled ? inState.vignette.intensity : 0;
        blendedState.vignette.enabled = true;
        blendedState.vignette.intensity = outV * (1 - t) + inV * t;
    }
    if (activeKeys.has('filmGrain')) {
        const outG = outState.filmGrain.enabled ? outState.filmGrain.intensity : 0;
        const inG = inState.filmGrain.enabled ? inState.filmGrain.intensity : 0;
        blendedState.filmGrain.enabled = true;
        blendedState.filmGrain.intensity = outG * (1 - t) + inG * t;
    }
    if (activeKeys.has('chromaticAberration')) {
        const outC = outState.chromaticAberration.enabled ? outState.chromaticAberration.offset : 0;
        const inC = inState.chromaticAberration.enabled ? inState.chromaticAberration.offset : 0;
        blendedState.chromaticAberration.enabled = true;
        blendedState.chromaticAberration.offset = outC * (1 - t) + inC * t;
    }
    if (activeKeys.has('glitch')) {
        const outGl = outState.glitch.enabled ? outState.glitch.intensity : 0;
        const inGl = inState.glitch.enabled ? inState.glitch.intensity : 0;
        blendedState.glitch.enabled = true;
        blendedState.glitch.intensity = outGl * (1 - t) + inGl * t;
    }

    const transitionAmount = (state: typeof outState, key: 'atmosphere' | 'gradientMap' | 'fishEye' | 'lensDistortion') => {
        if (key === 'atmosphere') return state.atmosphere.fog + state.atmosphere.mist + state.atmosphere.haze;
        if (key === 'gradientMap') return state.gradientMap.blend;
        if (key === 'fishEye') return state.fishEye.amount;
        return state.lensDistortion.strength;
    };
    for (const key of ['atmosphere', 'gradientMap', 'fishEye', 'lensDistortion'] as const) {
        if (!activeKeys.has(key)) continue;
        const outEffect = outState[key];
        const inEffect = inState[key];
        const outAmount = outEffect.enabled ? transitionAmount(outState, key) : 0;
        const inAmount = inEffect.enabled ? transitionAmount(inState, key) : 0;
        blendedState[key].enabled = true;
        if (key === 'atmosphere') blendedState.atmosphere.fog = outAmount * (1 - t) + inAmount * t;
        else if (key === 'gradientMap') blendedState.gradientMap.blend = outAmount * (1 - t) + inAmount * t;
        else if (key === 'fishEye') blendedState.fishEye.amount = outAmount * (1 - t) + inAmount * t;
        else blendedState.lensDistortion.strength = outAmount * (1 - t) + inAmount * t;
    }

    const orderedEnabledPasses = [...activeKeys].map((key, i) => ({
        key,
        orderIndex: i,
        summary: `Transition Blend (${Math.round(t * 100)}%)`,
    }));

    return {
        state: blendedState,
        orderedEnabledPasses,
        deterministicSeed: incoming.deterministicSeed,
        motionVector: incoming.motionVector,
    };
}

/**
 * Calculates a safe MSAA sample count based on viewport pixel dimensions and GPU limits.
 * Reduces or disables samples for oversized buffers (e.g. 4K / high-DPI displays)
 * to respect GPU memory budgets, while relying on the downstream FXAA pass for anti-aliasing.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getSafeMsaaSampleCount(pixelWidth: number, pixelHeight: number, maxSamples = 4): number {
    const hwCap = Math.max(0, Math.min(4, Number.isFinite(maxSamples) ? maxSamples : 4));
    if (hwCap === 0) return 0;
    const totalPixels = Math.max(0, pixelWidth * pixelHeight);
    // Over 8 million pixels (e.g. 4K canvas): disable MSAA to prevent VRAM exhaustion
    if (totalPixels > 8_000_000) return 0;
    // Over 3.5 million pixels (e.g. 1440p / Retina viewport): reduce to 2 samples
    if (totalPixels > 3_500_000) return Math.min(2, hwCap);
    return hwCap;
}

export function shouldRebuildPassList(activePassKey: string | null, currentPassKey: string, passCount = 1): boolean {
    return passCount === 0 || activePassKey !== currentPassKey;
}

export const SceneEffectsPipeline: React.FC<SceneEffectsPipelineProps> = ({ effects, outgoingEffects, transitionProgress }) => {
    const effectiveEffects = (outgoingEffects && transitionProgress !== undefined && transitionProgress < 1)
        ? blendEvaluatedEffects(outgoingEffects, effects, transitionProgress)
        : effects;
    const { gl, scene, camera, size } = useThree();
    const dpr = useThree((state) => state.viewport.dpr);
    const composerRef = useRef<EffectComposer | null>(null);
    const renderPassRef = useRef<RenderPass | null>(null);
    const passMapRef = useRef<Map<EffectKey, ShaderPass>>(new Map());
    const encodingPassRef = useRef<ShaderPass | null>(null);
    const fxaaPassRef = useRef<FXAAPass | null>(null);

    // Initialize or resize EffectComposer
    useLayoutEffect(() => {
        const composer = new EffectComposer(gl);
        composer.setPixelRatio(dpr);
        const pixelW = Math.round(size.width * dpr);
        const pixelH = Math.round(size.height * dpr);
        // Beauty targets are single-sampled (samples = 0) so gl.copyTexSubImage2D works for backdrop blur.
        // Anti-aliasing is provided by the downstream FXAAPass. Setting beauty samples to 0
        // allows WebGL2 gl.copyTexSubImage2D to capture the framebuffer for backdrop blur & glass.
        composer.renderTarget1.samples = composer.renderTarget2.samples = 0;
        
        // Depth-buffer texture attachment for screen-space depth-of-field
        const depthTexture = new THREE.DepthTexture(pixelW, pixelH);
        depthTexture.format = THREE.DepthFormat;
        depthTexture.type = THREE.UnsignedShortType;
        composer.renderTarget1.depthTexture = depthTexture;

        composer.setSize(size.width, size.height);

        const renderPass = new RenderPass(scene, camera);
        const encodingPass = createOutputEncodingPass();
        const fxaaPass = new FXAAPass();
        fxaaPass.setSize(pixelW, pixelH);
        fxaaPass.renderToScreen = true;

        composerRef.current = composer;
        renderPassRef.current = renderPass;
        encodingPassRef.current = encodingPass;
        fxaaPassRef.current = fxaaPass;

        const passMap = passMapRef.current;
        return () => {
            depthTexture.dispose();
            fxaaPass.material.dispose();
            encodingPass.material.dispose();
            passMap.forEach((p) => p.material.dispose());
            passMap.clear();
            composer.dispose();
            composerRef.current = null;
            renderPassRef.current = null;
            encodingPassRef.current = null;
            fxaaPassRef.current = null;
        };
    }, [gl, scene, camera, size.width, size.height, dpr]);

    const prevCameraPosRef = useRef<{ x: number; y: number } | null>(null);
    const activePassKeyRef = useRef<string | null>(null);

    // Update passes and uniforms from evaluated effects state
    useLayoutEffect(() => {
        const composer = composerRef.current;
        const renderPass = renderPassRef.current;
        const encodingPass = encodingPassRef.current;
        const fxaaPass = fxaaPassRef.current;
        if (!composer || !renderPass || !encodingPass || !fxaaPass) return;

        const pixelW = Math.round(size.width * dpr);
        const pixelH = Math.round(size.height * dpr);
        fxaaPass.setSize(pixelW, pixelH);

        const deltaX = prevCameraPosRef.current ? camera.position.x - prevCameraPosRef.current.x : 0;
        const deltaY = prevCameraPosRef.current ? camera.position.y - prevCameraPosRef.current.y : 0;
        prevCameraPosRef.current = { x: camera.position.x, y: camera.position.y };
        const cameraMotion = { x: deltaX * 0.15, y: deltaY * 0.15 };

        const currentPassKey = effectiveEffects.orderedEnabledPasses
            .map((p) => p.key)
            .join(',');
        const passListChanged = shouldRebuildPassList(activePassKeyRef.current, currentPassKey, composer.passes.length);

        if (passListChanged) {
            activePassKeyRef.current = currentPassKey;
            // Reconstruct active passes in evaluated order
            composer.passes = [renderPass];
            renderPass.renderToScreen = false;

            for (const { key } of effectiveEffects.orderedEnabledPasses) {
                let pass = passMapRef.current.get(key);
                if (!pass) {
                    pass = createSceneEffectPass(key);
                    passMapRef.current.set(key, pass);
                }
                pass.renderToScreen = false;
                if (pass.uniforms.tDepth) {
                    pass.uniforms.tDepth.value = composer.renderTarget1.depthTexture;
                }
                configureSceneEffectPass(pass, key, effectiveEffects, pixelW, pixelH, cameraMotion);
                composer.addPass(pass);
            }

            // Convert linear RGB to display sRGB
            encodingPass.renderToScreen = false;
            composer.addPass(encodingPass);

            // Run FXAA on sRGB perceptual samples and output to canvas
            fxaaPass.renderToScreen = true;
            composer.addPass(fxaaPass);
        } else {
            // Uniform-only fast path: update in place without rebuilding passes graph
            for (const { key } of effectiveEffects.orderedEnabledPasses) {
                const pass = passMapRef.current.get(key);
                if (pass) {
                    if (pass.uniforms.tDepth) {
                        pass.uniforms.tDepth.value = composer.renderTarget1.depthTexture;
                    }
                    configureSceneEffectPass(pass, key, effectiveEffects, pixelW, pixelH, cameraMotion);
                }
            }
        }
    }, [effectiveEffects, gl, scene, camera, size.width, size.height, dpr, camera.position.x, camera.position.y]);

    // Deterministic frame render
    useFrame(() => {
        renderSceneFrame(gl, scene, camera, composerRef.current);
    }, 1);

    return null;
};

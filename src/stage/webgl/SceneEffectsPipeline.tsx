// src/stage/webgl/SceneEffectsPipeline.tsx
import React, { useLayoutEffect, useRef } from 'react';
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
}

/**
 * Calculates a safe MSAA sample count based on viewport pixel dimensions and GPU limits.
 * Reduces or disables samples for oversized buffers (e.g. 4K / high-DPI displays)
 * to respect GPU memory budgets, while relying on the downstream FXAA pass for anti-aliasing.
 */
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

export const SceneEffectsPipeline: React.FC<SceneEffectsPipelineProps> = ({ effects }) => {
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
        const sampleCount = getSafeMsaaSampleCount(pixelW, pixelH, gl.capabilities?.maxSamples ?? 4);
        composer.renderTarget1.samples = composer.renderTarget2.samples = sampleCount;
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

        return () => {
            fxaaPass.material.dispose();
            encodingPass.material.dispose();
            passMapRef.current.forEach((p) => p.material.dispose());
            passMapRef.current.clear();
            composer.dispose();
            composerRef.current = null;
            renderPassRef.current = null;
            encodingPassRef.current = null;
            fxaaPassRef.current = null;
        };
    }, [gl, scene, camera, size.width, size.height, dpr]);

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

        // Reconstruct active passes in evaluated order
        composer.passes = [renderPass];
        renderPass.renderToScreen = false;

        for (const { key } of effects.orderedEnabledPasses) {
            if (key === 'depthOfField') continue; // Handled in 3D layer evaluation / bokeh blur
            let pass = passMapRef.current.get(key);
            if (!pass) {
                pass = createSceneEffectPass(key);
                passMapRef.current.set(key, pass);
            }
            pass.renderToScreen = false;
            configureSceneEffectPass(pass, key, effects, pixelW, pixelH);
            composer.addPass(pass);
        }

        // Convert linear RGB to display sRGB
        encodingPass.renderToScreen = false;
        composer.addPass(encodingPass);

        // Run FXAA on sRGB perceptual samples and output to canvas
        fxaaPass.renderToScreen = true;
        composer.addPass(fxaaPass);
    }, [effects, size.width, size.height, dpr]);

    // Deterministic frame render
    useFrame(() => {
        renderSceneFrame(gl, scene, camera, composerRef.current);
    }, 1);

    return null;
};

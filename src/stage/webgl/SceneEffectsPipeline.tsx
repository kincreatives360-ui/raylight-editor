// src/stage/webgl/SceneEffectsPipeline.tsx
import React, { useLayoutEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { renderSceneFrame } from './sceneRenderLoop';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { EvaluatedEffects } from '../../engine/evaluateEffects';

interface SceneEffectsPipelineProps {
    effects: EvaluatedEffects;
}

const CinematicEffectsShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        // Vignette
        uVignetteEnabled: { value: 0 },
        uVignetteIntensity: { value: 0 },
        // Film Grain
        uGrainEnabled: { value: 0 },
        uGrainIntensity: { value: 0 },
        uGrainSeed: { value: 0 },
        // Chromatic Aberration
        uChromaticEnabled: { value: 0 },
        uChromaticOffset: { value: 0 },
        // Glitch
        uGlitchEnabled: { value: 0 },
        uGlitchIntensity: { value: 0 },
        // Color Grade
        uColorGradeEnabled: { value: 0 },
        uExposure: { value: 0.0 },
        uContrast: { value: 1.0 },
        uSaturation: { value: 1.0 },
        // Bloom Glow emulation
        uBloomEnabled: { value: 0 },
        uBloomIntensity: { value: 0 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec2 uResolution;

        uniform float uVignetteEnabled;
        uniform float uVignetteIntensity;

        uniform float uGrainEnabled;
        uniform float uGrainIntensity;
        uniform float uGrainSeed;

        uniform float uChromaticEnabled;
        uniform float uChromaticOffset;

        uniform float uGlitchEnabled;
        uniform float uGlitchIntensity;

        uniform float uColorGradeEnabled;
        uniform float uExposure;
        uniform float uContrast;
        uniform float uSaturation;

        uniform float uBloomEnabled;
        uniform float uBloomIntensity;

        varying vec2 vUv;

        // High quality deterministic pseudo-random generator
        float random(vec2 st) {
            return fract(sin(dot(st.xy + vec2(uGrainSeed, uTime * 0.05), vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec2 uv = vUv;

            // 1. Glitch horizontal slice displacement
            if (uGlitchEnabled > 0.5 && uGlitchIntensity > 0.001) {
                float slice = floor(uv.y * 32.0);
                float noise = sin(slice * 13.0 + uTime * 15.0);
                if (abs(noise) > 0.65) {
                    uv.x += noise * uGlitchIntensity * 0.04;
                }
            }

            // 2. Chromatic Aberration (R/B channel offset)
            vec4 col;
            if (uChromaticEnabled > 0.5 && uChromaticOffset > 0.001) {
                vec2 dir = uv - vec2(0.5);
                float dist = length(dir);
                vec2 shift = normalize(dir) * (uChromaticOffset * 0.025 * dist);
                float r = texture2D(tDiffuse, uv + shift).r;
                float g = texture2D(tDiffuse, uv).g;
                float b = texture2D(tDiffuse, uv - shift).b;
                float a = texture2D(tDiffuse, uv).a;
                col = vec4(r, g, b, a);
            } else {
                col = texture2D(tDiffuse, uv);
            }

            // 3. Bloom glow approximation
            if (uBloomEnabled > 0.5 && uBloomIntensity > 0.01) {
                vec3 glow = max(col.rgb - vec3(0.55), vec3(0.0)) * uBloomIntensity * 1.35;
                col.rgb += glow;
            }

            // 4. Color Grade (Contrast, Saturation, Temperature)
            if (uColorGradeEnabled > 0.5) {
                // Exposure
                col.rgb *= exp2(uExposure);
                // Contrast
                col.rgb = (col.rgb - 0.5) * uContrast + 0.5;
                // Saturation
                float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
                col.rgb = mix(vec3(luma), col.rgb, uSaturation);
            }

            // 5. Vignette radial falloff
            if (uVignetteEnabled > 0.5 && uVignetteIntensity > 0.001) {
                vec2 coord = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
                float dist = length(coord);
                float vig = smoothstep(0.85, 0.25, dist * (uVignetteIntensity * 1.5 + 0.45));
                col.rgb *= clamp(vig, 0.0, 1.0);
            }

            // 6. Film Grain
            if (uGrainEnabled > 0.5 && uGrainIntensity > 0.001) {
                float grain = (random(uv * uResolution * 0.5) - 0.5) * uGrainIntensity * 0.5;
                col.rgb += vec3(grain);
            }

            // Composer stores premultiplied linear RGB, including transparent edges.
            gl_FragColor = vec4(col.a > 0.00001 ? col.rgb / col.a : vec3(0.0), col.a);
            #include <colorspace_fragment>
            gl_FragColor.rgb *= gl_FragColor.a;
        }
    `,
};

export const SceneEffectsPipeline: React.FC<SceneEffectsPipelineProps> = ({ effects }) => {
    const { gl, scene, camera, size } = useThree();
    const dpr = useThree(state => state.viewport.dpr);
    const composerRef = useRef<EffectComposer | null>(null);
    const shaderPassRef = useRef<ShaderPass | null>(null);
    // Initialize or resize EffectComposer
    useLayoutEffect(() => {
        const composer = new EffectComposer(gl);
        composer.setPixelRatio(dpr);
        composer.renderTarget1.samples = composer.renderTarget2.samples = Math.min(4, gl.capabilities.maxSamples);
        composer.setPixelRatio(gl.getPixelRatio());
        composer.renderTarget1.samples = composer.renderTarget2.samples = Math.min(8, gl.capabilities.maxSamples);
        composer.setSize(size.width, size.height);

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const shaderPass = new ShaderPass(CinematicEffectsShader);
        shaderPass.renderToScreen = true;
        composer.addPass(shaderPass);

        composerRef.current = composer;
        shaderPassRef.current = shaderPass;

        return () => {
            shaderPass.material.dispose();
            composer.dispose();
            composerRef.current = null;
            shaderPassRef.current = null;
        };
    }, [gl, scene, camera, size.width, size.height, dpr]);

    // Update uniforms from evaluated effects state
    useLayoutEffect(() => {
        const pass = shaderPassRef.current;
        if (!pass) return;

        const s = effects.state;
        const u = pass.uniforms;
        const dpr = gl.getPixelRatio();

        u.uResolution.value.set(size.width * dpr, size.height * dpr);

        // Vignette
        u.uVignetteEnabled.value = s.vignette?.enabled ? 1 : 0;
        u.uVignetteIntensity.value = s.vignette?.intensity ?? 0;

        // Film Grain
        u.uGrainEnabled.value = s.filmGrain?.enabled ? 1 : 0;
        u.uGrainIntensity.value = s.filmGrain?.intensity ?? 0;
        u.uGrainSeed.value = effects.deterministicSeed ?? 0;

        // Chromatic Aberration
        u.uChromaticEnabled.value = s.chromaticAberration?.enabled ? 1 : 0;
        u.uChromaticOffset.value = s.chromaticAberration?.offset ?? 0;

        // Glitch
        u.uGlitchEnabled.value = s.glitch?.enabled ? 1 : 0;
        u.uGlitchIntensity.value = s.glitch?.intensity ?? 0;

        // Bloom
        u.uBloomEnabled.value = s.bloom?.enabled ? 1 : 0;
        u.uBloomIntensity.value = s.bloom?.intensity ?? 0;

        // Color Grade
        u.uColorGradeEnabled.value = s.colorGrade?.enabled ? 1 : 0;
        u.uExposure.value = s.colorGrade?.exposure ?? 0.0;
        u.uContrast.value = s.colorGrade?.contrast ?? 1.0;
        u.uSaturation.value = s.colorGrade?.saturation ?? 1.0;
    }, [effects, size.width, size.height, dpr]);
    }, [effects, size.width, size.height, gl]);

    // Keep glass blending in the same linear space at every device opacity.
    useFrame((_state, delta) => {
        const pass = shaderPassRef.current;
        if (pass) pass.uniforms.uTime.value += delta;
        renderSceneFrame(gl, scene, camera, composerRef.current);
    }, 1);

    return null;
};

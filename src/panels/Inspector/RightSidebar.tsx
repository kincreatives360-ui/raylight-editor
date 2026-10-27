import { PanelRightClose, SlidersHorizontal, Sparkles, Trash2, Upload } from 'lucide-react';
import React,{ useEffect,useRef,useState } from 'react';
import {
DEFAULT_SHADER_CONFIGS,
SHADER_PRESETS,
SHADER_PRESET_METADATA,
isPaletteShader,
type ShaderPreset,
} from '../../model/backgroundPresets';
import type {
AnimationBlockProperty,
AspectRatio,
Background,
CameraBlock,
Layer,
LightAnimationBlock,
Shot,
} from '../../model/types';
import { RAYLIGHT_COLOR_PALETTE,isBlankProjectState } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { FigmaSelect } from '../../ui/FigmaSelect';
import { ScrubInput } from '../../ui/ScrubInput';
import { ColorPicker } from './ColorPicker';
import { saveImageAsset } from './imageAssetHelper';
import { CameraBlockSection } from './sections/CameraBlockSection';
import { LayerDesignInspector } from './sections/LayerDesignInspector';
import { LayerAnimateInspector, addLayerAnimation } from './sections/LayerAnimateInspector';
import { LightBlockInspector } from './sections/LightBlockInspector';
import { LightInspector } from './sections/LightInspector';
import { SceneEffectsSection } from './sections/SceneEffectsSection';





const DEFAULT_AVATAR_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath fill-rule='evenodd' d='M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' clip-rule='evenodd' /%3E%3C/svg%3E";

interface ShaderPreviewCanvasProps {
    preset: ShaderPreset;
    color1: string;
    color2: string;
    color3: string;
    colors?: string[];
    speed?: number;
    waves?: number;
    focus?: number;
    glow?: number;
    shine?: number;
}

const EMPTY_SHADER_COLORS: string[] = [];

const ShaderPreviewCanvas: React.FC<ShaderPreviewCanvasProps> = ({
    preset,
    color1,
    color2,
    color3,
    colors = EMPTY_SHADER_COLORS,
    speed = 1,
    waves = 1,
    focus = 1,
    glow = 1,
    shine = 1,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let time = 0;
        let last = performance.now();

        const render = (now: number) => {
            const dt = (now - last) / 1000;
            last = now;
            time += Math.min(dt, 0.1) * (speed || 1);

            const w = canvas.clientWidth || 280;
            const h = canvas.clientHeight || 80;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }

            ctx.clearRect(0, 0, w, h);

            const c1 = color1 || '#3b82f6';
            const c2 = color2 || '#1e293b';
            const c3 = color3 || '#a855f7';
            const cList = colors.length > 0 ? colors : [c1, c2, c3];

            switch (preset) {
                case 'liquidMetal': {
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, c2);
                    grad.addColorStop(0.5, c1);
                    grad.addColorStop(1, '#05070d');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    for (let i = 0; i < 4; i++) {
                        const phase = time * 1.5 + i * 1.2;
                        const yMid = (h * 0.25) + (i * h * 0.22) + Math.sin(phase) * 8;
                        const waveGrad = ctx.createLinearGradient(0, yMid - 15, w, yMid + 15);
                        waveGrad.addColorStop(0, 'rgba(255,255,255,0)');
                        waveGrad.addColorStop(0.35, c1);
                        waveGrad.addColorStop(0.5, '#ffffff');
                        waveGrad.addColorStop(0.7, c3);
                        waveGrad.addColorStop(1, 'rgba(0,0,0,0)');

                        ctx.beginPath();
                        ctx.moveTo(0, yMid);
                        for (let x = 0; x <= w; x += 10) {
                            const y = yMid + Math.sin(x * 0.025 * waves + phase) * (10 + i * 2)
                                          + Math.cos(x * 0.04 - phase * 0.8) * 5;
                            ctx.lineTo(x, y);
                        }
                        ctx.lineTo(w, h);
                        ctx.lineTo(0, h);
                        ctx.closePath();
                        ctx.fillStyle = waveGrad;
                        ctx.globalAlpha = 0.55 * glow;
                        ctx.fill();
                    }

                    const glintX = ((time * 60) % (w + 100)) - 50;
                    const glintGrad = ctx.createLinearGradient(glintX - 30, 0, glintX + 30, h);
                    glintGrad.addColorStop(0, 'rgba(255,255,255,0)');
                    glintGrad.addColorStop(0.5, `rgba(255,255,255,${0.45 * shine})`);
                    glintGrad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = glintGrad;
                    ctx.globalAlpha = 1;
                    ctx.fillRect(0, 0, w, h);
                    break;
                }

                case 'waterPlane': {
                    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
                    baseGrad.addColorStop(0, c1);
                    baseGrad.addColorStop(1, c2);
                    ctx.fillStyle = baseGrad;
                    ctx.fillRect(0, 0, w, h);

                    ctx.lineWidth = 1.2;
                    ctx.strokeStyle = c3;
                    ctx.globalAlpha = 0.45 * glow;
                    for (let x = 0; x < w; x += 18) {
                        ctx.beginPath();
                        for (let y = 0; y <= h; y += 6) {
                            const dx = Math.sin(y * 0.06 + time * 1.8) * 8 * waves
                                     + Math.cos(x * 0.05 + time) * 4;
                            if (y === 0) ctx.moveTo(x + dx, y);
                            else ctx.lineTo(x + dx, y);
                        }
                        ctx.stroke();
                    }
                    for (let y = 0; y < h; y += 14) {
                        ctx.beginPath();
                        for (let x = 0; x <= w; x += 8) {
                            const dy = Math.cos(x * 0.06 - time * 1.5) * 6 * waves
                                     + Math.sin(y * 0.05 + time * 0.7) * 4;
                            if (x === 0) ctx.moveTo(x, y + dy);
                            else ctx.lineTo(x, y + dy);
                        }
                        ctx.stroke();
                    }
                    break;
                }

                case 'meshAurora': {
                    ctx.fillStyle = c2 || '#050814';
                    ctx.fillRect(0, 0, w, h);

                    for (let k = 0; k < 3; k++) {
                        const phase = time * 1.2 + k * 1.8;
                        const rGrad = ctx.createLinearGradient(0, 0, 0, h);
                        rGrad.addColorStop(0, 'rgba(0,0,0,0)');
                        rGrad.addColorStop(0.3, k === 0 ? c1 : k === 1 ? c3 : '#60a5fa');
                        rGrad.addColorStop(0.8, c2);
                        rGrad.addColorStop(1, '#000000');

                        ctx.beginPath();
                        ctx.moveTo(0, h);
                        for (let x = 0; x <= w; x += 6) {
                            const yTop = (h * 0.15) + Math.sin(x * 0.02 * waves + phase) * 14
                                         + Math.cos(x * 0.045 - phase * 0.7) * 8;
                            ctx.lineTo(x, yTop);
                        }
                        ctx.lineTo(w, h);
                        ctx.closePath();
                        ctx.fillStyle = rGrad;
                        ctx.globalAlpha = 0.6 * glow;
                        ctx.fill();
                    }
                    break;
                }

                case 'sphereGradient': {
                    ctx.fillStyle = c2 || '#090d16';
                    ctx.fillRect(0, 0, w, h);

                    const cx = w * 0.5 + Math.sin(time * 0.8) * 20;
                    const cy = h * 0.5 + Math.cos(time * 0.6) * 6;
                    const r = (h * 0.38) * (1 + Math.sin(time * 1.5) * 0.08);

                    const corona = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
                    corona.addColorStop(0, c3);
                    corona.addColorStop(0.4, c1);
                    corona.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = corona;
                    ctx.globalAlpha = 0.5 * glow;
                    ctx.fillRect(0, 0, w, h);

                    const orb = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
                    orb.addColorStop(0, '#ffffff');
                    orb.addColorStop(0.3, c1);
                    orb.addColorStop(0.8, c3);
                    orb.addColorStop(1, c2);
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = orb;
                    ctx.globalAlpha = 0.95;
                    ctx.fill();
                    break;
                }

                case 'topography': {
                    ctx.fillStyle = '#050709';
                    ctx.fillRect(0, 0, w, h);

                    ctx.lineWidth = 1.3;
                    for (let c = 0; c < 7; c++) {
                        const yBase = (c / 6) * h;
                        const phase = time * 0.8 + c * 0.6;
                        ctx.strokeStyle = c % 2 === 0 ? c1 : c3;
                        ctx.globalAlpha = 0.7 * glow;
                        ctx.beginPath();
                        for (let x = 0; x <= w; x += 6) {
                            const y = yBase + Math.sin(x * 0.03 * waves + phase) * 9
                                          + Math.cos(x * 0.06 - phase * 0.5) * 4;
                            if (x === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        }
                        ctx.stroke();
                    }
                    break;
                }

                case 'hyperspeed': {
                    ctx.fillStyle = '#030712';
                    ctx.fillRect(0, 0, w, h);

                    const cx = w * 0.5;
                    const cy = h * 0.5;
                    ctx.lineWidth = 1.5;

                    for (let i = 0; i < 28; i++) {
                        const angle = (i / 28) * Math.PI * 2 + 0.1;
                        const distPhase = ((time * 1.5 + (i * 0.23)) % 1);
                        const r1 = distPhase * (w * 0.1);
                        const r2 = r1 + distPhase * (w * 0.35);

                        const x1 = cx + Math.cos(angle) * r1;
                        const y1 = cy + Math.sin(angle) * r1 * 0.6;
                        const x2 = cx + Math.cos(angle) * r2;
                        const y2 = cy + Math.sin(angle) * r2 * 0.6;

                        ctx.strokeStyle = i % 2 === 0 ? c1 : c3;
                        ctx.globalAlpha = distPhase * 0.85 * glow;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                    break;
                }

                case 'plasma': {
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, c2);
                    grad.addColorStop(0.5, c1);
                    grad.addColorStop(1, c3);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    for (let j = 0; j < 3; j++) {
                        const px = w * 0.5 + Math.sin(time * 1.2 + j * 2.1) * (w * 0.3);
                        const py = h * 0.5 + Math.cos(time * 0.9 + j * 1.7) * (h * 0.3);
                        const rad = ctx.createRadialGradient(px, py, 4, px, py, h * 0.6);
                        rad.addColorStop(0, j === 0 ? '#ffffff' : c1);
                        rad.addColorStop(0.5, c3);
                        rad.addColorStop(1, 'rgba(0,0,0,0)');
                        ctx.fillStyle = rad;
                        ctx.globalAlpha = 0.5 * glow;
                        ctx.fillRect(0, 0, w, h);
                    }
                    break;
                }

                case 'dither': {
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, c1);
                    grad.addColorStop(0.5, c2);
                    grad.addColorStop(1, c3);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.18 * shine;
                    const shift = Math.floor(time * 4) % 4;
                    for (let x = 0; x < w; x += 4) {
                        for (let y = 0; y < h; y += 4) {
                            if ((x + y + shift) % 8 === 0) {
                                ctx.fillRect(x, y, 2, 2);
                            }
                        }
                    }
                    break;
                }

                case 'threads': {
                    ctx.fillStyle = '#050811';
                    ctx.fillRect(0, 0, w, h);

                    ctx.lineWidth = 1.4;
                    for (let t = 0; t < 6; t++) {
                        const phase = time * 1.4 + t * 1.1;
                        ctx.strokeStyle = t % 2 === 0 ? c1 : c3;
                        ctx.globalAlpha = 0.8 * glow;
                        ctx.beginPath();
                        ctx.moveTo(0, (t / 5) * h);
                        ctx.bezierCurveTo(
                            w * 0.33, (h * 0.8) * Math.sin(phase),
                            w * 0.66, h - (h * 0.8) * Math.cos(phase),
                            w, ((5 - t) / 5) * h
                        );
                        ctx.stroke();
                    }
                    break;
                }

                case 'chromaticWaves': {
                    ctx.fillStyle = c2 || '#0b0f19';
                    ctx.fillRect(0, 0, w, h);

                    const offsets = [
                        { color: c1, dx: Math.sin(time * 1.6) * 6, alpha: 0.65 },
                        { color: c3, dx: -Math.cos(time * 1.4) * 6, alpha: 0.65 },
                        { color: '#ffffff', dx: 0, alpha: 0.3 },
                    ];

                    for (const o of offsets) {
                        ctx.fillStyle = o.color;
                        ctx.globalAlpha = o.alpha * glow;
                        ctx.beginPath();
                        ctx.moveTo(0, h);
                        for (let x = 0; x <= w; x += 8) {
                            const y = h * 0.5 + Math.sin((x + o.dx) * 0.03 * waves + time * 1.8) * 16;
                            ctx.lineTo(x, y);
                        }
                        ctx.lineTo(w, h);
                        ctx.closePath();
                        ctx.fill();
                    }
                    break;
                }

                case 'prism': {
                    ctx.fillStyle = c2 || '#07090e';
                    ctx.fillRect(0, 0, w, h);

                    const sx = 0;
                    const sy = 0;
                    const fanColors = cList.length >= 3 ? cList : ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
                    for (let f = 0; f < fanColors.length; f++) {
                        const angle = 0.2 + (f / fanColors.length) * 0.9 + Math.sin(time * 0.8) * 0.05;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(w, Math.tan(angle) * w);
                        ctx.lineTo(w, Math.tan(angle + 0.15) * w);
                        ctx.closePath();
                        ctx.fillStyle = fanColors[f];
                        ctx.globalAlpha = 0.45 * glow;
                        ctx.fill();
                    }
                    break;
                }

                case 'halo': {
                    ctx.fillStyle = c2 || '#090a0f';
                    ctx.fillRect(0, 0, w, h);

                    const cx = w * 0.5 + Math.sin(time) * 10;
                    const cy = h * 0.55;
                    const rx = w * 0.4;
                    const ry = h * 0.32;

                    ctx.lineWidth = 3.5 * shine;
                    ctx.strokeStyle = c1;
                    ctx.globalAlpha = 0.85 * glow;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = c3;
                    ctx.stroke();
                    break;
                }

                default: {
                    const grad = ctx.createLinearGradient(0, 0, w, h);
                    grad.addColorStop(0, c1);
                    grad.addColorStop(0.5, c2);
                    grad.addColorStop(1, c3);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);

                    for (let s = 0; s < 2; s++) {
                        const phase = time * 1.2 + s * Math.PI;
                        ctx.beginPath();
                        ctx.moveTo(0, h * 0.5);
                        for (let x = 0; x <= w; x += 10) {
                            const y = h * 0.5 + Math.sin(x * 0.02 * waves + phase) * 14;
                            ctx.lineTo(x, y);
                        }
                        ctx.lineTo(w, h);
                        ctx.lineTo(0, h);
                        ctx.closePath();
                        ctx.fillStyle = 'rgba(255,255,255,0.15)';
                        ctx.globalAlpha = 0.5 * shine;
                        ctx.fill();
                    }
                    break;
                }
            }

            ctx.globalAlpha = 1;
            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animId);
    }, [preset, color1, color2, color3, colors, speed, waves, focus, glow, shine]);

    return (
        <div className="w-full h-full relative overflow-hidden transition-transform duration-500 group-hover:scale-105">
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute inset-0 bg-black/15 pointer-events-none" />
        </div>
    );
};

interface ProjectSettingsPanelProps {
    backgroundOnly?: boolean;
    background?: Background;
    onBackgroundChange?: (background: Background) => void;
    onSwapImageClick?: () => void;
    onOpenShortcuts?: () => void;
    onOpenExportModal?: () => void;
}

const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
    backgroundOnly = false,
    background,
    onBackgroundChange,
    onSwapImageClick: _onSwapImageClick,
    onOpenShortcuts: _onOpenShortcuts,
    onOpenExportModal: _onOpenExportModal,
}) => {
    const { project, updateProject } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const bg = background ?? project.background;
    const bgMode: 'color' | 'image' | 'shader' =
        bg.kind === 'shader' ? 'shader' : bg.kind === 'image' ? 'image' : 'color';

    // Synchronize project background changes to all shots that inherit project background
    const setProjectBackground = (newBg: Background) => {
        if (onBackgroundChange) { onBackgroundChange(newBg); return; }
        updateProject((p) => ({
            ...p,
            background: newBg,
        }));
    };

    const handleModeChange = (mode: 'color' | 'image' | 'shader') => {
        if (mode === bgMode) return;
        if (mode === 'shader') {
            const currentPreset: ShaderPreset = bg.kind === 'shader' ? bg.preset : 'silkFlow';
            const cfg = DEFAULT_SHADER_CONFIGS[currentPreset] || DEFAULT_SHADER_CONFIGS.silkFlow;
            let c1 = cfg.colors?.[0] || cfg.color || '#4f46e5';
            let c2 = cfg.colors?.[1] || cfg.backgroundColor || '#ec4899';
            let c3 = cfg.colors?.[2] || '#06b6d4';

            if (bg.kind === 'solid') {
                c1 = bg.color;
            } else if (bg.kind === 'gradient' && bg.stops.length >= 2) {
                c1 = bg.stops[0].color;
                c2 = bg.stops[1].color;
                if (bg.stops[2]) c3 = bg.stops[2].color;
            }

            setProjectBackground({
                kind: 'shader',
                preset: currentPreset,
                color: c1,
                colors: [c1, c2, c3],
                color1: c1,
                color2: c2,
                color3: c3,
                backgroundColor: c2,
                speed: cfg.speed ?? 0.8,
                waves: cfg.waves ?? 1.2,
                noiseScale: cfg.waves ?? 1.2,
                focus: cfg.focus ?? 1,
                glow: cfg.glow ?? 0.85,
                shine: cfg.shine ?? 0.6,
                angle: cfg.angle ?? 28,
            });
        } else if (mode === 'image') {
            const prevImageBg = bg.kind === 'image' ? bg : undefined;
            const existingAsset = Object.values(project.assets || {}).find((a) => a.mimeType?.startsWith('image/'));
            const letterboxColor = prevImageBg?.color || (bg.kind === 'shader' ? (bg.backgroundColor || '#000000') : '#000000');
            setProjectBackground({
                kind: 'image',
                src: prevImageBg?.src || existingAsset?.dataUrl,
                assetId: prevImageBg?.assetId || existingAsset?.id,
                color: letterboxColor,
                fit: prevImageBg?.fit || 'cover',
                opacity: prevImageBg?.opacity ?? 1,
                dim: prevImageBg?.dim ?? 0,
                blur: prevImageBg?.blur ?? 0,
            });
        } else {
            // mode === 'color' - Default to solid color, never reset existing color or force gradient
            if (bg.kind === 'solid' || bg.kind === 'gradient') return;
            let baseColor = '#0c0e17';
            if (bg.kind === 'shader') {
                baseColor = bg.color1 || bg.colors?.[0] || bg.color || '#0c0e17';
            } else if (bg.kind === 'image' && bg.color) {
                baseColor = bg.color;
            }
            setProjectBackground({
                kind: 'solid',
                color: baseColor,
            });
        }
    };

    const shaderBg = bg.kind === 'shader' ? bg : null;
    const currentPreset = shaderBg?.preset || 'silkFlow';
    const currentMeta = SHADER_PRESET_METADATA[currentPreset];
    const isPalette = isPaletteShader(currentPreset);

    const shaderColor1 = shaderBg?.color1 || shaderBg?.colors?.[0] || shaderBg?.color || '#4f46e5';
    const shaderColor2 = shaderBg?.color2 || shaderBg?.colors?.[1] || shaderBg?.backgroundColor || '#ec4899';
    const shaderColor3 = shaderBg?.color3 || shaderBg?.colors?.[2] || '#06b6d4';

    const updateShaderKnob = (
        knob: 'speed' | 'waves' | 'noiseScale' | 'focus' | 'glow' | 'shine',
        val: number
    ) => {
        if (!shaderBg) return;
        setProjectBackground({
            ...shaderBg,
            [knob]: val,
            ...(knob === 'waves' ? { noiseScale: val } : {}),
        });
    };

    const updateShaderColors = (c1?: string, c2?: string, c3?: string) => {
        if (!shaderBg) return;
        const col1 = c1 ?? shaderColor1;
        const col2 = c2 ?? shaderColor2;
        const col3 = c3 ?? shaderColor3;
        setProjectBackground({
            ...shaderBg,
            color: col1,
            backgroundColor: col2,
            color1: col1,
            color2: col2,
            color3: col3,
            colors: [col1, col2, col3],
        });
    };

    const selectShaderPreset = (p: ShaderPreset) => {
        const cfg = DEFAULT_SHADER_CONFIGS[p] || DEFAULT_SHADER_CONFIGS.silk;
        const pColors = cfg.colors?.length ? [...cfg.colors] : [cfg.color, cfg.backgroundColor || '#05050a'];
        const c1 = pColors[0] || cfg.color || '#4f46e5';
        const c2 = pColors[1] || cfg.backgroundColor || '#ec4899';
        const c3 = pColors[2] || (pColors.length > 2 ? pColors[2] : '#06b6d4');

        setProjectBackground({
            kind: 'shader',
            preset: p,
            color: cfg.color || c1,
            backgroundColor: cfg.backgroundColor || c2,
            color1: c1,
            color2: c2,
            color3: c3,
            colors: pColors,
            speed: cfg.speed ?? 1,
            waves: cfg.waves ?? 1,
            noiseScale: cfg.waves ?? 1,
            focus: cfg.focus ?? 1,
            glow: cfg.glow ?? 1,
            shine: cfg.shine ?? 1,
            angle: cfg.angle ?? 28,
        });
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        saveImageAsset({
            file,
            updateProject,
            onSave: (assetId, dataUrl) => {
                setProjectBackground({
                    kind: 'image',
                    assetId,
                    src: dataUrl,
                    color: bg.kind === 'image' ? bg.color || '#000000' : '#000000',
                    fit: bg.kind === 'image' ? bg.fit || 'cover' : 'cover',
                    dim: bg.kind === 'image' ? bg.dim ?? 0 : 0,
                    blur: bg.kind === 'image' ? bg.blur ?? 0 : 0,
                    opacity: 1,
                });
            },
        });
        if (e.target) e.target.value = '';
    };

    return (
        <div className={backgroundOnly ? "min-w-0" : "flex-1 overflow-y-auto px-4 py-3.5 flex flex-col select-none"} data-testid={backgroundOnly ? "shot-background-editor" : "project-settings-section"}>
            <div className="space-y-4">
                {!backgroundOnly && <>
                {/* 1. PROJECT SETTINGS HEADER */}
                <h2 className="text-[13px] font-semibold text-white tracking-wide">Project Settings</h2>

                {/* Name */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-[#8e8e93] block font-normal">Name</label>
                    <input
                        type="text"
                        value={project.name}
                        onChange={(e) => updateProject((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Untitled project"
                        className="w-full h-8 px-3 rounded-lg bg-[#18181b] border border-white/[0.08] text-[12px] text-white outline-none focus:border-white/20 transition placeholder:text-[#52525b]"
                    />
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-[#8e8e93] block font-normal">Aspect Ratio</label>
                    <div className="relative">
                        <FigmaSelect
                            value={project.aspectRatio}
                            onChange={(e) => updateProject((p) => ({ ...p, aspectRatio: e.target.value as AspectRatio }))}
                            className="w-full h-8 px-3 pr-8 rounded-lg bg-[#18181b] border border-white/[0.08] text-[12px] text-white outline-none appearance-none cursor-pointer focus:border-white/20 transition"
                        >
                            <option value="16:9">Landscape 16:9</option>
                            <option value="9:16">Portrait 9:16</option>
                            <option value="1:1">Square 1:1</option>
                            <option value="4:3">Standard 4:3</option>
                            <option value="3:2">Photo 3:2</option>
                            <option value="21:9">Cinema 21:9</option>
                            <option value="4:5">Social 4:5</option>
                        </FigmaSelect>
                    </div>
                </div>

                {/* Lens */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-[#8e8e93] block font-normal">Lens</label>
                    <ScrubInput
                        label={<span className="text-[#71717a] font-medium mr-1.5">F</span>}
                        value={project.defaultCamera?.focalLength ?? 50}
                        min={14}
                        max={200}
                        step={1}
                        unit=" mm"
                        onChange={(val) => {
                            updateProject((p) => ({
                                ...p,
                                defaultCamera: {
                                    position: p.defaultCamera?.position ?? { x: 0, y: 0, z: 2.65 },
                                    rotation: p.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
                                    focalLength: Math.max(14, Math.min(200, val)),
                                },
                            }));
                        }}
                        className="h-8 px-3 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[12px] text-white hover:border-white/20 transition cursor-ew-resize"
                    />
                </div>

                </>}
                {/* Background Section */}
                <div className="space-y-2.5">
                    {!backgroundOnly && <label className="text-[11px] text-[#8e8e93] block font-normal">Background</label>}
                    {/* 3-segmented button */}
                    <div className="h-8 p-0.5 rounded-lg bg-[#141416] border border-white/[0.06] grid grid-cols-3 gap-0.5">
                        <button
                            type="button"
                            onClick={() => handleModeChange('color')}
                            className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${
                                bgMode === 'color'
                                    ? 'border border-white/30 bg-[#222226] text-white shadow-sm'
                                    : 'text-[#8e8e93] hover:text-white'
                            }`}
                        >
                            Color
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('image')}
                            className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${
                                bgMode === 'image'
                                    ? 'border border-white/30 bg-[#222226] text-white shadow-sm'
                                    : 'text-[#8e8e93] hover:text-white'
                            }`}
                        >
                            Image
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('shader')}
                            className={`rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${
                                bgMode === 'shader'
                                    ? 'border border-white/30 bg-[#222226] text-white shadow-sm'
                                    : 'text-[#8e8e93] hover:text-white'
                            }`}
                        >
                            Shader
                        </button>
                    </div>

                    {/* Mode == 'color' */}
                    {bgMode === 'color' && (
                        <div className="space-y-2.5 pt-0.5">
                            <label className="text-[11px] text-[#8e8e93] block font-normal">Color & Gradient</label>
                            <ColorPicker
                                color={bg.kind === 'solid' ? bg.color : (bg.kind === 'gradient' ? bg.stops[0]?.color || '#090a12' : '#000000')}
                                gradientValue={bg.kind === 'gradient' ? {
                                    angle: bg.angle || 135,
                                    gradientType: (bg.gradientType === 'angular' ? 'linear' : bg.gradientType) || 'linear',
                                    stops: bg.stops,
                                } : undefined}
                                showGradientMode={true}
                                onChange={(c) => {
                                    setProjectBackground({ kind: 'solid', color: c });
                                }}
                                onGradientChange={(g) => {
                                    setProjectBackground({
                                        kind: 'gradient',
                                        angle: g.angle,
                                        gradientType: g.gradientType || 'linear',
                                        stops: g.stops,
                                    });
                                }}
                                className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-2.5 text-[12px] text-white cursor-pointer transition"
                            />

                            {/* Quick swatches */}
                            <div className="flex items-center gap-1.5 pt-1">
                                {RAYLIGHT_COLOR_PALETTE.map((swatch) => (
                                    <button
                                        key={swatch}
                                        type="button"
                                        onClick={() => setProjectBackground({ kind: 'solid', color: swatch })}
                                        className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition cursor-pointer shrink-0"
                                        style={{ backgroundColor: swatch }}
                                        title={swatch}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mode == 'image' */}
                    {bgMode === 'image' && (
                        <div className="space-y-3 pt-0.5">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileInput}
                            />

                            {/* Image Header & Preview Card */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-[#8e8e93] block font-normal">Image</label>
                                {bg.kind === 'image' && (bg.src || (bg.assetId && project.assets[bg.assetId]?.dataUrl)) ? (
                                    <div
                                        className="relative group rounded-xl overflow-hidden border border-white/[0.08] bg-[#141416] aspect-[16/9] max-h-36 cursor-pointer shadow-inner"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <img
                                            src={bg.src || (bg.assetId ? project.assets[bg.assetId]?.dataUrl : '')}
                                            alt="Background preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fileInputRef.current?.click();
                                                }}
                                                className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-[11px] font-medium text-white shadow-xs transition"
                                            >
                                                Replace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setProjectBackground({
                                                        kind: 'image',
                                                        src: undefined,
                                                        assetId: undefined,
                                                        color: bg.color || '#000000',
                                                        fit: bg.fit || 'cover',
                                                        dim: bg.dim ?? 0,
                                                        blur: bg.blur ?? 0,
                                                        opacity: 1,
                                                    });
                                                }}
                                                className="p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition"
                                                title="Remove image"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-6 px-3 rounded-xl border border-dashed border-white/15 hover:border-white/30 bg-[#141416]/50 hover:bg-[#141416] flex flex-col items-center justify-center gap-1.5 text-[11px] text-[#a1a1aa] hover:text-white cursor-pointer transition group"
                                        >
                                            <Upload className="w-4 h-4 text-[#8e8e93] group-hover:text-white transition" />
                                            <span className="font-medium">Upload Image</span>
                                            <span className="text-[10px] text-[#71717a]">PNG, JPG, WebP</span>
                                        </button>
                                        {Object.values(project.assets || {}).filter((a) => a.mimeType?.startsWith('image/')).length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                <span className="text-[10px] text-[#71717a] block">From Project Assets:</span>
                                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                                    {Object.values(project.assets || {})
                                                        .filter((a) => a.mimeType?.startsWith('image/'))
                                                        .map((asset) => (
                                                            <button
                                                                key={asset.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setProjectBackground({
                                                                        kind: 'image',
                                                                        assetId: asset.id,
                                                                        src: asset.dataUrl,
                                                                        color: bg.kind === 'image' ? bg.color || '#000000' : '#000000',
                                                                        fit: bg.kind === 'image' ? bg.fit || 'cover' : 'cover',
                                                                        dim: bg.kind === 'image' ? bg.dim ?? 0 : 0,
                                                                        blur: bg.kind === 'image' ? bg.blur ?? 0 : 0,
                                                                        opacity: 1,
                                                                    });
                                                                }}
                                                                className="w-10 h-10 rounded-lg border border-white/15 hover:border-[#0088ff] overflow-hidden shrink-0 transition relative group cursor-pointer"
                                                                title={asset.name}
                                                            >
                                                                <img
                                                                    src={asset.thumbUrl || asset.dataUrl}
                                                                    alt={asset.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {bg.kind === 'image' && (
                                <>
                                    {/* Fit: Fill (cover) / Fit (contain) */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-[#8e8e93] block font-normal">Fit</label>
                                        <div className="relative">
                                            <FigmaSelect
                                                value={(bg.fit ?? 'cover') === 'contain' ? 'contain' : 'cover'}
                                                onChange={(e) => setProjectBackground({ ...bg, fit: e.target.value as 'cover' | 'contain' })}
                                                className="w-full h-8 pl-3 pr-8 rounded-lg bg-[#141416] border border-white/[0.08] hover:border-white/20 text-[11px] text-white appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] transition"
                                            >
                                                <option value="cover">Fill</option>
                                                <option value="contain">Fit</option>
                                            </FigmaSelect>
                                        </div>
                                    </div>

                                    {/* Dim & Blur */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <ScrubInput
                                            label="Dim"
                                            value={Math.round((bg.dim ?? 0) * 100)}
                                            min={0}
                                            max={100}
                                            step={5}
                                            unit="%"
                                            onChange={(v) => setProjectBackground({ ...bg, dim: v / 100 })}
                                            className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                        />
                                        <ScrubInput
                                            label="Blur"
                                            value={Math.round(bg.blur ?? 0)}
                                            min={0}
                                            max={100}
                                            step={1}
                                            unit="%"
                                            onChange={(v) => setProjectBackground({ ...bg, blur: v })}
                                            className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                        />
                                    </div>

                                    {/* Backdrop Color */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-[#8e8e93] block font-normal">Backdrop</label>
                                        <ColorPicker
                                            color={bg.color || '#000000'}
                                            showGradientMode={false}
                                            onChange={(c) => setProjectBackground({ ...bg, color: c })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Mode == 'shader' */}
                    {bgMode === 'shader' && shaderBg && (
                        <div className="space-y-3 pt-0.5">
                            {/* Preset Visual Card */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-[#8e8e93] font-normal">Preset</span>
                                    <span className="text-[#0088ff] font-medium">{currentMeta?.label || currentPreset}</span>
                                </div>
                                <div
                                    className="h-20 rounded-xl border border-white/10 hover:border-white/25 overflow-hidden relative cursor-pointer group bg-[#060a14] transition shadow-inner"
                                >
                                    {/* Dynamic Shader Swatch Representation */}
                                    <ShaderPreviewCanvas
                                        preset={currentPreset}
                                        color1={shaderColor1}
                                        color2={shaderColor2}
                                        color3={shaderColor3}
                                        colors={shaderBg?.colors}
                                        speed={shaderBg?.speed ?? 1}
                                        waves={shaderBg?.waves ?? 1}
                                        focus={shaderBg?.focus ?? 1}
                                        glow={shaderBg?.glow ?? 1}
                                        shine={shaderBg?.shine ?? 1}
                                    />
                                    <FigmaSelect
                                        aria-label="Shader preset"
                                        value={currentPreset}
                                        onChange={(event) => selectShaderPreset(event.target.value as ShaderPreset)}
                                        className="absolute bottom-2 left-2 h-6 max-w-[calc(100%-16px)] px-2 rounded-md bg-black/70 border border-white/10 text-[11px] text-white"
                                    >
                                        {SHADER_PRESETS.map((preset) => <option key={preset} value={preset}>{SHADER_PRESET_METADATA[preset]?.label || preset}</option>)}
                                    </FigmaSelect>
                                </div>


                            </div>

                            {/* Shader Colors matching Raylight: Color & Accent */}
                            <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-[#8e8e93] block font-normal">Color</label>
                                    <ColorPicker
                                        label="Color"
                                        color={shaderColor1.startsWith('#') ? shaderColor1 : `#${shaderColor1}`}
                                        showGradientMode={false}
                                        onChange={(c) => updateShaderColors(c, undefined, undefined)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-2 text-[12px] text-white transition w-full"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-[#8e8e93] block font-normal">Accent</label>
                                    <ColorPicker
                                        label="Accent"
                                        color={shaderColor2.startsWith('#') ? shaderColor2 : `#${shaderColor2}`}
                                        showGradientMode={false}
                                        onChange={(c) => updateShaderColors(undefined, c, undefined)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-2 text-[12px] text-white transition w-full"
                                    />
                                </div>

                                {isPalette && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-[#8e8e93] block font-normal">Color 3</label>
                                        <ColorPicker
                                            label="Color 3"
                                            color={shaderColor3.startsWith('#') ? shaderColor3 : `#${shaderColor3}`}
                                            showGradientMode={false}
                                            onChange={(c) => updateShaderColors(undefined, undefined, c)}
                                            className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-2 text-[12px] text-white transition w-full"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Shader Parameters Grid */}
                            <div className="space-y-2 pt-1 border-t border-white/[0.06]">

                                {/* Row 1: Speed & Waves */}
                                <div className="grid grid-cols-2 gap-2">
                                    <ScrubInput
                                        label="Speed"
                                        value={shaderBg.speed ?? 1}
                                        min={0}
                                        max={5}
                                        step={0.1}
                                        decimals={1}
                                        unit=" x"
                                        onChange={(v) => updateShaderKnob('speed', v)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                    />
                                    <ScrubInput
                                        label={currentMeta?.knobs?.waves?.label || 'Waves'}
                                        value={Math.round((shaderBg.waves ?? 1) * 100)}
                                        min={10}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('waves', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                    />
                                </div>

                                {/* Row 2: Focus & Glow */}
                                <div className="grid grid-cols-2 gap-2">
                                    <ScrubInput
                                        label={currentMeta?.knobs?.focus?.label || 'Focus'}
                                        value={Math.round((shaderBg.focus ?? 1) * 100)}
                                        min={10}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('focus', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                    />
                                    <ScrubInput
                                        label={currentMeta?.knobs?.glow?.label || 'Glow'}
                                        value={Math.round((shaderBg.glow ?? 1) * 100)}
                                        min={0}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('glow', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                    />
                                </div>

                                {/* Row 3: Shine */}
                                <div>
                                    <ScrubInput
                                        label={currentMeta?.knobs?.shine?.label || 'Shine'}
                                        value={Math.round((shaderBg.shine ?? 1) * 100)}
                                        min={0}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('shine', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-[#18181b] border border-white/[0.08] flex items-center justify-between text-[11px] hover:border-white/20 transition cursor-ew-resize"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ShotSettingsPanelProps {
    activeShot: Shot;
    onOpenExportModal?: () => void;
}

const ShotSettingsPanel: React.FC<ShotSettingsPanelProps> = ({
    activeShot,
    onOpenExportModal,
}) => {
    const { project, updateShot, addCameraBlockToShot } = useProjectStore();
    const [shotTab, setShotTab] = useState<'design' | 'animate'>('design');

    const isUsingProjectBg = activeShot.useProjectBackground !== false;

    return (
        <div className="shot-settings-panel flex-1 min-h-0 overflow-y-auto select-none" data-testid="shot-settings-section">
            <div className="space-y-4">
                {/* Header: Design / Animate tabs matching mockup */}
                <div className="shot-settings-tabs flex items-center gap-2 px-3 py-2 border-b border-white/[0.08]" role="tablist" aria-label="Shot settings">
                    <button
                        type="button"
                        role="tab" aria-selected={shotTab === 'design'} onClick={() => setShotTab('design')}
                        className={`flex-1 py-1 px-2.5 rounded-md text-[11px] font-medium transition cursor-pointer text-center ${
                            shotTab === 'design'
                                ? 'bg-[#222226] text-white shadow-xs border border-white/20'
                                : 'text-[#8e8e93] hover:text-white'
                        }`}
                    >
                        Design
                    </button>
                    <button
                        type="button"
                        role="tab" aria-selected={shotTab === 'animate'} onClick={() => setShotTab('animate')}
                        className={`flex-1 py-1 px-2.5 rounded-md text-[11px] font-medium transition cursor-pointer text-center ${
                            shotTab === 'animate'
                                ? 'bg-[#222226] text-white shadow-xs border border-white/20'
                                : 'text-[#8e8e93] hover:text-white'
                        }`}
                    >
                        Animate
                    </button>
                </div>

                {/* Shot Title & Duration */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] text-[#8e8e93] block font-normal">Shot Name</label>
                        <span className="text-[11px] font-mono text-[#71717a]">
                            {(activeShot.durationMs / 1000).toFixed(1)}s
                        </span>
                    </div>
                    <input
                        type="text"
                        value={activeShot.name || ''}
                        onChange={(e) => updateShot(activeShot.id, (s) => ({ ...s, name: e.target.value }))}
                        placeholder="Shot name"
                        className="w-full h-8 px-3 rounded-lg bg-[#18181b] border border-white/[0.08] text-[12px] text-white outline-none focus:border-white/20 transition placeholder:text-[#52525b]"
                    />
                </div>

                {shotTab === 'design' ? (
                    <>
                        {/* Background Section */}
                        <div className="space-y-2.5">
                            <h3 className="text-[12px] font-semibold text-white tracking-wide">Background</h3>

                            {/* Use project toggle switch */}
                            <div className="flex items-center justify-between py-2">
                                <span className="text-[11px] font-medium text-white">Use project</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Use project background"
                                    aria-checked={isUsingProjectBg}
                                    onClick={() => {
                                        const next = !isUsingProjectBg;
                                        updateShot(activeShot.id, (s) => ({
                                            ...s,
                                            useProjectBackground: next,
                                            background: s.background ?? structuredClone(project.background),
                                        }));
                                    }}
                                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                                        isUsingProjectBg ? 'bg-[#0088ff]' : 'bg-[#27272a]'
                                    }`}
                                >
                                    <span
                                        className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${
                                            isUsingProjectBg ? 'right-1' : 'left-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Inherited or override */}
                            {isUsingProjectBg ? (
                                <div className="sr-only">
                                    <span>Inheriting project background</span>
                                    <span
                                        className="w-2.5 h-2.5 rounded-full border border-white/20"
                                        style={{
                                            backgroundColor:
                                                project.background.kind === 'solid'
                                                    ? project.background.color
                                                    : '#0088ff',
                                        }}
                                    />
                                </div>
                            ) : (
                                <ProjectSettingsPanel
                                    backgroundOnly
                                    background={activeShot.background ?? project.background}
                                    onBackgroundChange={(background) => updateShot(activeShot.id, (shot) => ({ ...shot, background, useProjectBackground: false }))}
                                />
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-white/[0.08]" />

                        {/* Scene Effects in Figma Style (+) and (-) */}
                        <SceneEffectsSection shot={activeShot} />

                        {/* Divider */}
                        <div className="border-t border-white/[0.08]" />

                        {/* Export Section */}
                        <div className="space-y-2">
                            <span className="text-[11px] text-[#8e8e93] block font-normal">Export</span>
                            {onOpenExportModal && (
                                <button
                                    type="button"
                                    onClick={onOpenExportModal}
                                    className="w-full py-2 px-3 rounded-xl bg-[#222226] hover:bg-[#2a2a30] border border-white/10 text-white font-medium text-[12px] transition cursor-pointer text-center"
                                >
                                    Export shot
                                </button>
                            )}
                        </div>


                    </>
                ) : (
                    /* Animate Tab for Shot: Camera Animation / Controls */
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[12px] font-semibold text-white tracking-wide">Camera Motion</h3>
                            <span className="text-[10px] text-[#71717a]">
                                {activeShot.cameraBlocks?.length || 0} moves
                            </span>
                        </div>
                        {activeShot.cameraBlocks && activeShot.cameraBlocks.length > 0 ? (
                            <CameraBlockSection
                                activeShotId={activeShot.id}
                                activeCameraBlock={activeShot.cameraBlocks[0]}
                                onDone={() => {}}
                            />
                        ) : (
                            <div className="py-6 px-3 rounded-xl border border-dashed border-white/10 bg-[#141416]/40 text-center space-y-2">
                                <span className="text-[11px] text-[#71717a] block">No camera animation in this shot</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        addCameraBlockToShot(activeShot.id);
                                    }}
                                    className="py-1 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition cursor-pointer"
                                >
                                    + Add Camera Move
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

interface RightSidebarProps {
    activeShot: Shot;
    selectedLayer: Layer | undefined;
    selectedLayerIds: string[];
    onSwapImageClick: () => void;
    onOpenExportModal: () => void;
    onOpenShortcuts?: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = React.memo(({
    activeShot,
    selectedLayer,
    selectedLayerIds,
    onSwapImageClick,
    onOpenExportModal,
    onOpenShortcuts,
}) => {
    const {
        project,
        updateLayer,
    } = useProjectStore();
    const {
        selectedCameraBlockId,
        selectedLightBlockId,
        selectedLightId,
        selectLight,
        selectLightBlock,
        selectCameraBlock,
        clearLayerSelection,
        toggleRightSidebar,
        rightSidebarWidth,
        inspectorTab,
    } = useSelectionStore();

    const [mainTab, setMainTab] = useState<'design' | 'animate'>('design');
    const [shareToast, setShareToast] = useState(false);
    const [customFonts, setCustomFonts] = useState<string[]>([]);
    const fontInputRef = useRef<HTMLInputElement>(null);

    const isSelectedLightValid = Boolean(
        selectedLightId && (
            selectedLightId === 'sun-key' ||
            selectedLightId === 'key' ||
            selectedLightId === 'sun' ||
            selectedLightId === 'room' ||
            activeShot?.light?.sources?.some((s) => s.id === selectedLightId)
        )
    );
    const effectiveInspectorTab = (selectedLightId && !isSelectedLightValid) ? 'project' : inspectorTab;

    useEffect(() => {
        if (selectedLightId && !isSelectedLightValid) {
            selectLight(null);
        }
    }, [selectedLightId, isSelectedLightValid, selectLight]);

    const isBlankState = isBlankProjectState(project);
    const effectiveMainTab = isBlankState ? 'design' : mainTab;

    const activeCameraBlock: CameraBlock | undefined =
        activeShot.cameraBlocks?.find((cb) => cb.id === selectedCameraBlockId);

    const activeLightBlock: LightAnimationBlock | undefined =
        activeShot.lightBlocks?.find((lb) => lb.id === selectedLightBlockId);

    const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLayer || selectedLayer.kind !== 'text') return;
        const fontName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
        try {
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, buffer);
            const loaded = await fontFace.load();
            (document.fonts as unknown as Set<FontFace>).add(loaded);
            setCustomFonts((prev) =>
                prev.includes(fontName) ? prev : [...prev, fontName]
            );
            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                l.kind === 'text' ? { ...l, font: { ...l.font, family: fontName } } : l
            );
        } catch (err) {
            console.error('Failed to load custom font:', err);
        }
    };

    const handleAddAnimationBlock = (property: AnimationBlockProperty) => {
        addLayerAnimation(activeShot, selectedLayerIds, property);
        setMainTab('animate');
    };

    return (
        <aside
            style={{ width: `${rightSidebarWidth}px` }}
            className="border-l border-white/[0.07] bg-[#0b0b0d] flex flex-col shrink-0 text-xs select-none h-full relative"
        >
            <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFontFileUpload}
                className="hidden"
            />

            {/* 1. TOP HEADER BAR */}
            <div className="h-12 px-3 flex items-center justify-between shrink-0 border-b border-white/[0.06]">
                <div className="flex items-center">
                    <button
                        type="button"
                        onClick={toggleRightSidebar}
                        aria-label="Collapse Inspector sidebar ( ] )"
                        title="Collapse Inspector sidebar ( ] )"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-[#a1a1aa] hover:text-white cursor-pointer transition opacity-0 hover:opacity-100"
                    >
                        <PanelRightClose className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* User Profile Avatar with Teal Ring */}
                    <div className="w-7 h-7 rounded-full ring-2 ring-[#00e5ff] overflow-hidden bg-[#1f2937] flex items-center justify-center shrink-0 shadow-sm cursor-pointer hover:opacity-90 transition">
                        <img
                            src={DEFAULT_AVATAR_PLACEHOLDER}
                            alt="User Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <button
                        onClick={() => clearLayerSelection()}
                        title="Project Settings"
                        className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer transition"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onOpenExportModal}
                        title="Export MP4 Video or GIF"
                        className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer transition"
                    >
                        <Upload className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => {
                            setShareToast(true);
                            setTimeout(() => setShareToast(false), 2000);
                            onOpenExportModal();
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0070e0] hover:bg-[#005bb5] text-white font-medium text-[11px] cursor-pointer transition shadow-sm"
                    >
                        {shareToast ? 'Copied!' : 'Share'}
                    </button>
                </div>
            </div>

            {/* =================================================================== */}
            {/* CAMERA BLOCK INSPECTOR (When Camera Move is Selected)               */}
            {/* =================================================================== */}
            {activeCameraBlock ? (
                <CameraBlockSection
                    activeShotId={activeShot.id}
                    activeCameraBlock={activeCameraBlock}
                    onDone={() => selectCameraBlock(null)}
                />
            ) : activeLightBlock ? (
                <LightBlockInspector
                    activeShotId={activeShot.id}
                    activeLightBlock={activeLightBlock}
                    onDone={() => selectLightBlock(null)}
                />
            ) : selectedLayer ? (
                <>
                    {/* 2. SUB-HEADER: Context navigation (Only when layer is selected) */}
                    <div className="h-10 border-b border-white/[0.07] px-3.5 flex items-center shrink-0 bg-[#111111]">
                        <div className="flex items-center gap-1.5" role="tablist" aria-label="Object properties">
                            <button
                                role="tab" aria-selected={effectiveMainTab === 'design'}
                                onClick={() => setMainTab('design')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${effectiveMainTab === 'design'
                                    ? 'bg-[#1f1f23] text-white'
                                    : 'text-[#a1a1aa] hover:text-[#d4d4d8]'
                                    }`}
                            >
                                Design
                            </button>
                            <button
                                role="tab" aria-selected={effectiveMainTab === 'animate'}
                                onClick={() => setMainTab('animate')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${effectiveMainTab === 'animate'
                                    ? 'bg-[#1f1f23] text-white'
                                    : 'text-[#a1a1aa] hover:text-[#d4d4d8]'
                                    }`}
                            >
                                Animate
                            </button>
                        </div>


                    </div>

                    {/* =============================================================== */}
                    {/* TAB 1: DESIGN (WHEN A LAYER IS SELECTED)                        */}
                    {/* =============================================================== */}
                    {effectiveMainTab === 'design' && selectedLayer && <LayerDesignInspector key={selectedLayer.id}
                        activeShot={activeShot} selectedLayer={selectedLayer} selectedLayerIds={selectedLayerIds}
                        onSwapImageClick={onSwapImageClick} customFonts={customFonts} onUploadFontClick={()=>fontInputRef.current?.click()}
                        onAddAnimationBlock={handleAddAnimationBlock}
                    />}

                    {/* =============================================================== */}
                    {/* TAB 2: ANIMATE (WHEN A LAYER IS SELECTED)                       */}
                    {/* =============================================================== */}
                    {effectiveMainTab === 'animate' && selectedLayer && <LayerAnimateInspector key={selectedLayerIds.join(',')}
                        activeShot={activeShot} selectedLayer={selectedLayer} selectedLayerIds={selectedLayerIds}
                    />}
                </>
            ) : selectedLightId && isSelectedLightValid ? (
                <LightInspector
                    activeShot={activeShot}
                    selectedLightId={selectedLightId}
                    onClose={() => selectLight(null)}
                />
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {effectiveInspectorTab === 'shot' ? (
                        <ShotSettingsPanel
                            activeShot={activeShot}
                            onOpenExportModal={onOpenExportModal}
                        />
                    ) : (
                        <ProjectSettingsPanel
                            onSwapImageClick={onSwapImageClick}
                            onOpenShortcuts={onOpenShortcuts}
                            onOpenExportModal={onOpenExportModal}
                        />
                    )}
                </div>
            )}

            {/* Persistent Inspector Footer: Ask Raylight & Help */}
            <div className="p-3 border-t border-white/[0.06] flex items-center justify-end gap-2 shrink-0 bg-[#0b0b0d]">
                <button
                    type="button"
                    onClick={onOpenShortcuts}
                    title="Ask Raylight AI Assistant & Shortcuts"
                    className="h-7 px-3 rounded-full bg-[#18181b] hover:bg-[#222226] border border-white/10 text-white text-[11px] font-medium flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                    <Sparkles className="w-3.5 h-3.5 text-[#0088ff]" />
                    <span>Ask Raylight</span>
                </button>
                <button
                    type="button"
                    onClick={onOpenShortcuts}
                    title="Help & Shortcuts (?)"
                    className="w-7 h-7 rounded-full bg-[#18181b] hover:bg-[#222226] border border-white/10 text-[#a1a1aa] hover:text-white flex items-center justify-center text-[11px] font-medium shadow-sm transition cursor-pointer"
                >
                    ?
                </button>
            </div>

        </aside>
    );
});

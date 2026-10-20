import { ColorField, ColorPicker } from './ColorPicker';
import {
    SHADER_PRESETS,
    SHADER_PRESET_METADATA,
    DEFAULT_SHADER_CONFIGS,
    isPaletteShader,
    type ShaderPreset,
} from '../../model/backgroundPresets';
import { saveImageAsset } from './imageAssetHelper';
import { RAYLIGHT_COLOR_PALETTE } from '../../model/types';
import React, { useState, useRef, useEffect } from 'react';
import {
    AlignLeft,
    AlignCenterHorizontal,
    AlignRight,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
    RotateCcw,
    FlipHorizontal,
    FlipVertical,
    Lock,
    Unlock,
    Crosshair,
    ChevronDown,
    Plus,
    X,
    Eye,
    EyeOff,
    Minus,
    ArrowLeft,
    ArrowRight,
    SlidersHorizontal,
    Upload,
    Sparkles,
    Image as ImageIcon,
    Square,
    Film,
    Trash2,
    Laptop,
    PanelRightClose,
} from 'lucide-react';
import type {
    Shot,
    Layer,
    DeviceFrame as DeviceFrameType,
    TransitionType,
    AnimationBlock,
    AnimationBlockProperty,
    Easing,
    AspectRatio,
    CameraBlock,
    BlendMode,
    Vec3,
    PresetEasingName,
    SpringEasingName,
    Background,
} from '../../model/types';
import { isBlankProjectState } from '../../model/types';
import { degToRad, radToDeg } from '../../model/defaults';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { usePlayheadStore } from '../../store/usePlayheadStore';
import { ScrubInput } from '../../ui/ScrubInput';
import { TypographySection } from './sections/TypographySection';
import { ShapeSection } from './sections/ShapeSection';
import { CameraBlockSection } from './sections/CameraBlockSection';

const ALL_BLEND_MODES: BlendMode[] = [
    'normal',
    'darken',
    'multiply',
    'lighten',
    'screen',
    'add',
    'difference',
];

const SHADER_STUDIO_PALETTES = [
    { name: 'Electric', colors: ['#4f46e5', '#ec4899', '#06b6d4'] },
    { name: 'Aurora', colors: ['#0f172a', '#10b981', '#6366f1'] },
    { name: 'Chrome', colors: ['#1e293b', '#94a3b8', '#f8fafc'] },
    { name: 'Sunset', colors: ['#450a0a', '#ea580c', '#facc15'] },
    { name: 'Royal', colors: ['#030712', '#3b82f6', '#a855f7'] },
];

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
    onSwapImageClick?: () => void;
}

const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
    onSwapImageClick: _onSwapImageClick,
}) => {
    const { project, updateProject } = useProjectStore();
    const [presetMenuOpen, setPresetMenuOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const bg = project.background;
    const bgMode: 'color' | 'image' | 'shader' =
        bg.kind === 'shader' ? 'shader' : bg.kind === 'image' ? 'image' : 'color';

    // Synchronize project background changes to all shots that inherit project background
    const setProjectBackground = (newBg: Background) => {
        updateProject((p) => ({
            ...p,
            background: newBg,
            shots: p.shots.map((s) => ({
                ...s,
                useProjectBackground: true,
            })),
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
        setPresetMenuOpen(false);
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
        <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col justify-between select-none">
            <div className="space-y-4">
                {/* Title */}
                <h2 className="text-[13px] font-semibold text-white tracking-wide">Project</h2>

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
                        <select
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
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#8e8e93] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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

                {/* Background Section */}
                <div className="space-y-2.5">
                    <label className="text-[11px] text-[#8e8e93] block font-normal">Background</label>
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
                                            <select
                                                value={(bg.fit ?? 'cover') === 'contain' ? 'contain' : 'cover'}
                                                onChange={(e) => setProjectBackground({ ...bg, fit: e.target.value as 'cover' | 'contain' })}
                                                className="w-full h-8 pl-3 pr-8 rounded-lg bg-[#141416] border border-white/[0.08] hover:border-white/20 text-[11px] text-white appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] transition"
                                            >
                                                <option value="cover">Fill</option>
                                                <option value="contain">Fit</option>
                                            </select>
                                            <ChevronDown className="w-3.5 h-3.5 text-[#8e8e93] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                                    onClick={() => setPresetMenuOpen((v) => !v)}
                                    className="h-20 rounded-xl border border-white/10 hover:border-white/25 overflow-hidden relative cursor-pointer group bg-[#060a14] transition shadow-inner"
                                >
                                    {/* Dynamic Shader Swatch Representation */}
                                    <ShaderPreviewCanvas
                                        preset={currentPreset}
                                        color1={shaderColor1}
                                        color2={shaderColor2}
                                        color3={shaderColor3}
                                        colors={shaderBg?.colors || [shaderColor1, shaderColor2, shaderColor3]}
                                        speed={shaderBg?.speed ?? 1}
                                        waves={shaderBg?.waves ?? 1}
                                        focus={shaderBg?.focus ?? 1}
                                        glow={shaderBg?.glow ?? 1}
                                        shine={shaderBg?.shine ?? 1}
                                    />
                                    <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white shadow-sm flex items-center gap-1.5">
                                        <span>{currentMeta?.label || currentPreset}</span>
                                        <ChevronDown className="w-3 h-3 text-[#a1a1aa]" />
                                    </div>
                                </div>

                                {/* Preset Selector Dropdown Grid */}
                                {presetMenuOpen && (
                                    <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-[#18181b] border border-white/15 mt-1 max-h-56 overflow-y-auto shadow-2xl z-30">
                                        {SHADER_PRESETS.map((p) => {
                                            const meta = SHADER_PRESET_METADATA[p];
                                            const cfg = DEFAULT_SHADER_CONFIGS[p];
                                            const isSelected = currentPreset === p;
                                            const pColors = cfg?.colors?.length ? cfg.colors : [cfg?.color || '#3b82f6', cfg?.backgroundColor || '#05050a'];
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => selectShaderPreset(p)}
                                                    className={`p-2 rounded-lg text-left transition cursor-pointer border flex flex-col gap-1 ${
                                                        isSelected
                                                            ? 'bg-[#0088ff]/15 border-[#0088ff] text-white shadow-xs'
                                                            : 'bg-white/[0.03] border-white/[0.06] text-[#d4d4d8] hover:bg-white/[0.08] hover:border-white/15'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <div
                                                            className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-xs"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${pColors[0]} 0%, ${pColors[1] || pColors[0]} 100%)`,
                                                            }}
                                                        />
                                                        <span className="text-[11px] font-medium truncate flex-1">{meta?.label || p}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Color Stops Studio */}
                            <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-[#8e8e93] font-normal">Color Stops</span>
                                    <span className="text-[10px] text-[#71717a] font-mono">
                                        {isPalette ? '3 Stops' : 'Accent & Base'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-1.5">
                                    {/* Color Stop 1 */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#71717a] block">Color 1</span>
                                        <ColorPicker
                                            label="Color 1"
                                            color={shaderColor1.startsWith('#') ? shaderColor1 : `#${shaderColor1}`}
                                            showGradientMode={false}
                                            onChange={(c) => updateShaderColors(c, undefined, undefined)}
                                            className="h-8 px-2 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-1.5 transition w-full"
                                        />
                                    </div>

                                    {/* Color Stop 2 */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#71717a] block">Color 2</span>
                                        <ColorPicker
                                            label="Color 2"
                                            color={shaderColor2.startsWith('#') ? shaderColor2 : `#${shaderColor2}`}
                                            showGradientMode={false}
                                            onChange={(c) => updateShaderColors(undefined, c, undefined)}
                                            className="h-8 px-2 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-1.5 transition w-full"
                                        />
                                    </div>

                                    {/* Color Stop 3 */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#71717a] block">Color 3</span>
                                        <ColorPicker
                                            label="Color 3"
                                            color={shaderColor3.startsWith('#') ? shaderColor3 : `#${shaderColor3}`}
                                            showGradientMode={false}
                                            onChange={(c) => updateShaderColors(undefined, undefined, c)}
                                            className="h-8 px-2 rounded-lg bg-[#18181b] border border-white/[0.08] hover:border-white/20 flex items-center gap-1.5 transition w-full"
                                        />
                                    </div>
                                </div>

                                {/* Curated Palette Swatches */}
                                <div className="flex items-center gap-1.5 pt-1">
                                    <span className="text-[10px] text-[#71717a] mr-1">Palettes:</span>
                                    {SHADER_STUDIO_PALETTES.map((pal) => (
                                        <button
                                            key={pal.name}
                                            type="button"
                                            onClick={() => updateShaderColors(pal.colors[0], pal.colors[1], pal.colors[2])}
                                            className="h-5 px-1.5 rounded border border-white/10 hover:border-white/30 flex items-center gap-1 bg-[#141416] transition cursor-pointer"
                                            title={pal.name}
                                        >
                                            <div className="flex -space-x-1">
                                                {pal.colors.map((c, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-2.5 h-2.5 rounded-full border border-black/40"
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mini Studio Scrubbers */}
                            <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                                <span className="text-[11px] text-[#8e8e93] block font-normal">Parameters Studio</span>

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

            {/* Bottom Footer: Ask Raylight & Help */}
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-[#8e8e93]">
                <button
                    type="button"
                    onClick={() => {}}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 hover:text-white text-[11px] font-medium transition cursor-pointer"
                >
                    <Sparkles className="w-3.5 h-3.5 text-white/70" />
                    <span>Ask Raylight</span>
                </button>
                <button
                    type="button"
                    onClick={() => {}}
                    title="Help & documentation"
                    className="w-6 h-6 rounded-lg hover:bg-white/5 hover:text-white flex items-center justify-center text-[12px] font-semibold transition cursor-pointer"
                >
                    ?
                </button>
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
}

export const RightSidebar: React.FC<RightSidebarProps> = React.memo(({
    activeShot,
    selectedLayer,
    selectedLayerIds,
    onSwapImageClick,
    onOpenExportModal,
}) => {
    const {
        project,
        updateShot,
        updateLayer,
        deleteLayerFromShot,
    } = useProjectStore();
    const {
        selectedBlockId,
        selectedCameraBlockId,
        setTimelineLayerExpanded,
        selectBlock,
        selectCameraBlock,
        clearLayerSelection,
        toggleRightSidebar,
        rightSidebarWidth,
    } = useSelectionStore();

    const [mainTab, setMainTab] = useState<'design' | 'animate'>('design');
    const [aspectLocked, setAspectLocked] = useState(true);
    const [addAnimMenuOpen, setAddAnimMenuOpen] = useState(false);
    const [swapMenuOpen, setSwapMenuOpen] = useState(false);
    const [shareToast, setShareToast] = useState(false);
    const [customFonts, setCustomFonts] = useState<string[]>([]);

    const fontInputRef = useRef<HTMLInputElement>(null);

    const refStageW = 1920;
    const refStageH = 1080;

    const isBlankState = isBlankProjectState(project);
    const effectiveMainTab = isBlankState ? 'design' : mainTab;

    const activeCameraBlock: CameraBlock | undefined =
        activeShot.cameraBlocks?.find((cb) => cb.id === selectedCameraBlockId);

    const handleQuickAlign = (axis: 'x' | 'y', targetVal: number) => {
        updateShot(activeShot.id, (s) => ({
            ...s,
            layers: s.layers.map((l) =>
                selectedLayerIds.includes(l.id) && !l.locked
                    ? { ...l, position: { ...l.position, [axis]: targetVal } }
                    : l
            ),
        }));
    };

    const handleSetDeviceType = (type: 'none' | DeviceFrameType['type']) => {
        if (!selectedLayer || (selectedLayer.kind !== 'image' && selectedLayer.kind !== 'video')) return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => {
            if (l.kind !== 'image' && l.kind !== 'video') return l;
            if (type === 'none') return { ...l, device: undefined };
            const defaultSize =
                type === 'iphone' || type === 'samsung-galaxy'
                    ? { width: 0.28, height: 0.58 }
                    : type === 'ipad'
                        ? { width: 0.48, height: 0.56 }
                        : type === 'display'
                            ? { width: 0.72, height: 0.48 }
                            : { width: 0.64, height: 0.56 };
            return {
                ...l,
                size: defaultSize,
                device: {
                    type,
                    color: l.device?.color || 'silver',
                    gloss: l.device?.gloss ?? 0.78,
                    glare: l.device?.glare ?? 0.35,
                    lidAngle: l.device?.lidAngle ?? 100,
                    screenGlow: l.device?.screenGlow ?? 0.4,
                },
            };
        });
    };

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
        if (!selectedLayer) return;
        const currentTimeMs = usePlayheadStore.getState().currentTimeMs;
        const shotLocalMs = Math.max(
            0,
            Math.min(activeShot.durationMs - 800, currentTimeMs - activeShot.startMs)
        );
        const id = `blk-${crypto.randomUUID()}`;
        const defaultAmount =
            property === 'opacity'
                ? -0.5
                : property === 'scale'
                    ? 0.25
                    : property === 'size'
                        ? { x: 0.1, y: 0.1, z: 0 }
                        : property === 'cornerRadius'
                            ? 0.1
                            : property === 'layerBlur'
                                ? 0.15
                                : property === 'maskSweep' || property === 'shimmer'
                                    ? 1
                                    : property === 'tilt' || property === 'rotation'
                                        ? { x: degToRad(15), y: degToRad(-20), z: 0 }
                                        : { x: -0.55, y: 0, z: 0 };

        const newBlock: AnimationBlock = {
            id,
            label: `${property.charAt(0).toUpperCase() + property.slice(1)} animation`,
            property,
            startMs: Math.round(shotLocalMs),
            durationMs: 1200,
            easing: { kind: 'preset', name: 'ease-in-out' },
            amount: defaultAmount,
        };

        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
            ...l,
            blocks: [...l.blocks, newBlock],
        }));
        setTimelineLayerExpanded(selectedLayer.id, true);
        selectBlock(id, selectedLayer.id);
        setAddAnimMenuOpen(false);
    };

    const handleUpdateBlock = (
        blockId: string,
        patch: Partial<AnimationBlock>
    ) => {
        if (!selectedLayer) return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
            ...l,
            blocks: l.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
        }));
    };

    const handleDeleteBlock = (blockId: string) => {
        if (!selectedLayer) return;
        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
            ...l,
            blocks: l.blocks.filter((b) => b.id !== blockId),
        }));
        if (selectedBlockId === blockId) {
            selectBlock(null);
        }
    };

    const handleDeleteSelectedLayer = () => {
        if (!selectedLayer) return;
        deleteLayerFromShot(activeShot.id, selectedLayer.id);
        clearLayerSelection();
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
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
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
                        className="px-3.5 py-1.5 rounded-lg bg-[#0088ff] hover:bg-[#0077e6] text-white font-medium text-[11px] cursor-pointer transition shadow-sm"
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
            ) : selectedLayer ? (
                <>
                    {/* 2. SUB-HEADER: Context navigation (Only when layer is selected) */}
                    <div className="h-9 border-b border-white/[0.07] px-3.5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setMainTab('design')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${effectiveMainTab === 'design'
                                    ? 'bg-[#1f1f23] text-white'
                                    : 'text-[#a1a1aa] hover:text-[#d4d4d8]'
                                    }`}
                            >
                                Design
                            </button>
                            <button
                                onClick={() => setMainTab('animate')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${effectiveMainTab === 'animate'
                                    ? 'bg-[#1f1f23] text-white'
                                    : 'text-[#a1a1aa] hover:text-[#d4d4d8]'
                                    }`}
                            >
                                Animate
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                clearLayerSelection();
                            }}
                            title="Click to view Project settings"
                            className="px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[10px] text-[#a1a1aa] hover:text-white flex items-center gap-1 cursor-pointer transition"
                        >
                            <Film className="w-3 h-3 text-[#0088ff]" />
                            <span>{activeShot.name || 'Shot'}</span>
                        </button>
                    </div>

                    {/* =============================================================== */}
                    {/* TAB 1: DESIGN (WHEN A LAYER IS SELECTED)                        */}
                    {/* =============================================================== */}
                    {effectiveMainTab === 'design' && selectedLayer && (
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                            {/* LAYER HEADER: Name, Lock, Hide, Delete (Non-shape layers) */}
                            {selectedLayer.kind !== 'shape' && (
                                <div className="p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-white/[0.07] text-[10px] font-semibold uppercase tracking-wider text-[#0088ff]">
                                                {selectedLayer.kind}
                                            </span>
                                            <span className="text-[10px] text-[#a1a1aa] font-mono">
                                                #{selectedLayer.order}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        hidden: !l.hidden,
                                                    }))
                                                }
                                                title={selectedLayer.hidden ? 'Show Layer' : 'Hide Layer'}
                                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white"
                                            >
                                                {selectedLayer.hidden ? (
                                                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        locked: !l.locked,
                                                    }))
                                                }
                                                title={selectedLayer.locked ? 'Unlock Layer' : 'Lock Layer'}
                                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white"
                                            >
                                                {selectedLayer.locked ? (
                                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                ) : (
                                                    <Unlock className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDeleteSelectedLayer}
                                                title="Delete Layer"
                                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-rose-400"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={selectedLayer.name}
                                        onChange={(e) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                name: e.target.value,
                                            }))
                                        }
                                        className="w-full h-7 px-2 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white font-medium outline-none focus:border-[#0088ff]"
                                        placeholder="Layer name"
                                    />
                                </div>
                            )}

                            {/* 1. LAYER KIND SPECIFIC SECTIONS */}

                            {/* TEXT LAYER: Typography Controls */}
                            {selectedLayer.kind === 'text' && (
                                <TypographySection
                                    activeShotId={activeShot.id}
                                    layer={selectedLayer}
                                    customFonts={customFonts}
                                    onUploadFontClick={() => fontInputRef.current?.click()}
                                />
                            )}

                            {/* SHAPE LAYER: Geometry, Fill & Stroke */}
                            {selectedLayer.kind === 'shape' && (
                                <ShapeSection
                                    activeShotId={activeShot.id}
                                    layer={selectedLayer}
                                    onAddAnimationBlock={handleAddAnimationBlock}
                                />
                            )}

                            {/* IMAGE / VIDEO LAYER: Source, Device Frame & Crop */}
                            {(selectedLayer.kind === 'image' || selectedLayer.kind === 'video') && (
                                <div className="p-3.5 space-y-3 relative">
                                    <div className="text-[11px] font-medium text-[#e4e4e7] flex items-center justify-between">
                                        <span>Image &amp; Frame</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={onSwapImageClick}
                                                className="h-6 px-2 rounded-l-md bg-[#1c1c1f] hover:bg-[#252529] text-[10px] text-[#e4e4e7] flex items-center gap-1 cursor-pointer transition"
                                            >
                                                <ImageIcon className="w-3 h-3 text-[#0088ff]" />
                                                <span>Swap</span>
                                            </button>
                                            <button
                                                onClick={() => setSwapMenuOpen((v) => !v)}
                                                className="h-6 px-1 rounded-r-md bg-[#1c1c1f] hover:bg-[#252529] text-[#a1a1aa] cursor-pointer transition border-l border-black/40"
                                            >
                                                <ChevronDown className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-12 rounded-lg bg-[#18181b] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                            {project.assets[selectedLayer.assetId]?.dataUrl ? (
                                                project.assets[selectedLayer.assetId].mimeType?.startsWith('video/') ? (
                                                    <video
                                                        src={project.assets[selectedLayer.assetId].dataUrl}
                                                        className="w-full h-full object-cover"
                                                        muted
                                                    />
                                                ) : (
                                                    <img
                                                        src={project.assets[selectedLayer.assetId].dataUrl}
                                                        alt={selectedLayer.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )
                                            ) : (
                                                <ImageIcon className="w-4 h-4 text-[#0088ff]" />
                                            )}
                                        </div>
                                        <div className="flex-1 text-[11px] text-[#a1a1aa]">
                                            <div className="text-white font-medium capitalize">
                                                {selectedLayer.device?.type
                                                    ? `${selectedLayer.device.type} Frame`
                                                    : 'Bare Screenshot'}
                                            </div>
                                            <div className="text-[10px] text-[#a1a1aa]">
                                                {project.assets[selectedLayer.assetId]?.name ||
                                                    'Active asset'}
                                            </div>
                                        </div>
                                    </div>

                                    {swapMenuOpen && (
                                        <div className="p-1 rounded-xl bg-[#18181b] border border-white/10 space-y-0.5 text-[11px] shadow-2xl z-20">
                                            {(
                                                [
                                                    'none',
                                                    'iphone',
                                                    'ipad',
                                                    'macbook',
                                                    'samsung-galaxy',
                                                    'display',
                                                    'browser',
                                                ] as const
                                            ).map((dev) => (
                                                <button
                                                    key={dev}
                                                    onClick={() => {
                                                        handleSetDeviceType(dev);
                                                        setSwapMenuOpen(false);
                                                    }}
                                                    className={`w-full px-2 py-1.5 rounded-lg text-left capitalize cursor-pointer transition ${(!selectedLayer.device && dev === 'none') ||
                                                        selectedLayer.device?.type === dev
                                                        ? 'bg-[#0088ff] text-white font-medium'
                                                        : 'text-[#d4d4d8] hover:bg-white/5'
                                                        }`}
                                                >
                                                    {dev === 'none'
                                                        ? 'Bare Screenshot'
                                                        : dev === 'samsung-galaxy'
                                                            ? 'Samsung Galaxy Ultra'
                                                            : dev === 'display'
                                                                ? 'Pro Display XDR'
                                                                : `${dev} 3D Frame`}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* 3D Device Frame Settings */}
                                    {selectedLayer.device && (
                                        <div className="p-2.5 rounded-xl bg-[#161619] border border-white/[0.06] space-y-2 pt-2">
                                            <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                                                <span className="flex items-center gap-1 text-[#e4e4e7]">
                                                    <Laptop className="w-3 h-3 text-[#0088ff]" />
                                                    Frame Details
                                                </span>
                                                <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded flex-wrap justify-end">
                                                    {(['silver', 'black', 'space-black', 'titanium', 'midnight'] as const).map((clr) => (
                                                        <button
                                                            key={clr}
                                                            type="button"
                                                            onClick={() =>
                                                                updateLayer(
                                                                    activeShot.id,
                                                                    selectedLayer.id,
                                                                    (l) =>
                                                                        (l.kind === 'image' || l.kind === 'video') && l.device
                                                                            ? {
                                                                                ...l,
                                                                                device: { ...l.device, color: clr },
                                                                            }
                                                                            : l
                                                                )
                                                            }
                                                            className={`px-2 py-0.5 rounded text-[10px] capitalize cursor-pointer transition ${selectedLayer.device?.color === clr
                                                                ? 'bg-[#2a2a30] text-white font-medium'
                                                                : 'text-[#a1a1aa] hover:text-white'
                                                                }`}
                                                        >
                                                            {clr.replace('-', ' ')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-1">
                                                <ScrubInput
                                                    label="Gloss"
                                                    value={selectedLayer.device.gloss}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(gloss) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            (l.kind === 'image' || l.kind === 'video') && l.device
                                                                ? { ...l, device: { ...l.device, gloss } }
                                                                : l
                                                        )
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Glare"
                                                    value={selectedLayer.device.glare ?? 0.35}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(glare) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            (l.kind === 'image' || l.kind === 'video') && l.device
                                                                ? { ...l, device: { ...l.device, glare } }
                                                                : l
                                                        )
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Glow"
                                                    value={selectedLayer.device.screenGlow ?? 0.4}
                                                    min={0}
                                                    max={1}
                                                    step={0.02}
                                                    decimals={2}
                                                    onChange={(screenGlow) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            (l.kind === 'image' || l.kind === 'video') && l.device
                                                                ? { ...l, device: { ...l.device, screenGlow } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            </div>

                                            {selectedLayer.device.type === 'macbook' && (
                                                <ScrubInput
                                                    label="Lid"
                                                    value={selectedLayer.device.lidAngle ?? 100}
                                                    min={35}
                                                    max={125}
                                                    step={1}
                                                    unit="°"
                                                    onChange={(lidAngle) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            (l.kind === 'image' || l.kind === 'video') && l.device
                                                                ? { ...l, device: { ...l.device, lidAngle } }
                                                                : l
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Image Border & Stroke */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[#a1a1aa]">Border &amp; Stroke</span>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selectedLayer.stroke)}
                                                onChange={(e) => {
                                                    const enabled = e.target.checked;
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                        l.kind === 'image'
                                                            ? {
                                                                ...l,
                                                                stroke: enabled
                                                                    ? {
                                                                        color: l.stroke?.color || '#0088ff',
                                                                        width: l.stroke?.width ?? 0.002,
                                                                        opacity: l.stroke?.opacity ?? 0.8,
                                                                    }
                                                                    : undefined,
                                                            }
                                                            : l
                                                    );
                                                }}
                                                className="w-3.5 h-3.5 rounded accent-[#0088ff] cursor-pointer"
                                            />
                                        </div>

                                        {selectedLayer.stroke && (
                                            <div className="flex items-center gap-1.5">
                                                <ColorField

                                                    value={selectedLayer.stroke.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind === 'image' && l.stroke
                                                                ? { ...l, stroke: { ...l.stroke, color } }
                                                                : l
                                                        );
                                                    }}
                                                    className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <ScrubInput
                                                        label="W"
                                                        value={Math.round(selectedLayer.stroke.width * 1000)}
                                                        min={1}
                                                        max={20}
                                                        step={1}
                                                        unit="px"
                                                        onChange={(w) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                                l.kind === 'image' && l.stroke
                                                                    ? {
                                                                        ...l,
                                                                        stroke: {
                                                                            ...l.stroke,
                                                                            width: Number((w / 1000).toFixed(4)),
                                                                        },
                                                                    }
                                                                    : l
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* GENERAL INSPECTOR SECTIONS (FOR NON-SHAPE LAYERS) */}
                            {selectedLayer.kind !== 'shape' && (
                                <>
                                    {/* POSITION */}
                                    <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    Position
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] block">
                                        Alignment
                                    </span>
                                    <div className="grid grid-cols-6 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                        <button
                                            onClick={() => handleQuickAlign('x', -0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Align Left"
                                        >
                                            <AlignLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('x', 0)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Center X"
                                        >
                                            <AlignCenterHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('x', 0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Align Right"
                                        >
                                            <AlignRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('y', -0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Align Top"
                                        >
                                            <AlignStartVertical className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('y', 0)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Center Y"
                                        >
                                            <AlignCenterVertical className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleQuickAlign('y', 0.32)}
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                            title="Align Bottom"
                                        >
                                            <AlignEndVertical className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] block">
                                        Coordinates
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="grid grid-cols-2 gap-1.5 flex-1">
                                            <ScrubInput
                                                label="X"
                                                value={Math.round(selectedLayer.position.x * refStageW)}
                                                min={-3000}
                                                max={3000}
                                                step={10}
                                                onChange={(pxX) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        position: {
                                                            ...l.position,
                                                            x: Number((pxX / refStageW).toFixed(4)),
                                                        },
                                                    }))
                                                }
                                            />
                                            <ScrubInput
                                                label="Y"
                                                value={Math.round(selectedLayer.position.y * refStageH)}
                                                min={-3000}
                                                max={3000}
                                                step={10}
                                                onChange={(pxY) =>
                                                    updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                        ...l,
                                                        position: {
                                                            ...l.position,
                                                            y: Number((pxY / refStageH).toFixed(4)),
                                                        },
                                                    }))
                                                }
                                            />
                                        </div>
                                        <button
                                            onClick={() =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    position: { ...l.position, x: 0, y: 0 },
                                                }))
                                            }
                                            title="Center Position (0, 0)"
                                            className="p-1.5 text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <Crosshair className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] block">
                                        Depth &amp; Roll
                                    </span>
                                    <div className="grid grid-cols-2 gap-1.5 pr-6">
                                        <ScrubInput
                                            label="Z"
                                            value={Math.round(selectedLayer.position.z * 500)}
                                            min={-1500}
                                            max={1500}
                                            step={10}
                                            onChange={(zScaled) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    position: {
                                                        ...l.position,
                                                        z: Number((zScaled / 500).toFixed(4)),
                                                    },
                                                }))
                                            }
                                        />
                                        <ScrubInput
                                            label="∟"
                                            value={radToDeg(selectedLayer.rotation.z)}
                                            min={-180}
                                            max={180}
                                            step={1}
                                            unit="°"
                                            onChange={(deg) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    rotation: { ...l.rotation, z: degToRad(deg) },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] block">
                                        Transform
                                    </span>
                                    <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                        <button
                                            onClick={() =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    rotation: {
                                                        ...l.rotation,
                                                        z: degToRad((radToDeg(l.rotation.z) + 90) % 360),
                                                    },
                                                }))
                                            }
                                            title="Rotate 90° Clockwise"
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: { ...l.scale, x: l.scale.x * -1 },
                                                }))
                                            }
                                            title="Flip Horizontally"
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <FlipHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: { ...l.scale, y: l.scale.y * -1 },
                                                }))
                                            }
                                            title="Flip Vertically"
                                            className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                        >
                                            <FlipVertical className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* TILT */}
                            <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    3D Tilt &amp; Swivel
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <ScrubInput
                                        label="X"
                                        value={radToDeg(selectedLayer.rotation.x)}
                                        min={-85}
                                        max={85}
                                        step={1}
                                        unit="°"
                                        onChange={(deg) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { ...l.rotation, x: degToRad(deg) },
                                            }))
                                        }
                                    />
                                    <ScrubInput
                                        label="Y"
                                        value={radToDeg(selectedLayer.rotation.y)}
                                        min={-85}
                                        max={85}
                                        step={1}
                                        unit="°"
                                        onChange={(deg) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { ...l.rotation, y: degToRad(deg) },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg">
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: { x: 0, y: 0, z: 0 },
                                            }))
                                        }
                                        title="Reset Tilt (0°)"
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: {
                                                    ...l.rotation,
                                                    y: degToRad(-radToDeg(l.rotation.y)),
                                                },
                                            }))
                                        }
                                        title="Invert Yaw Angle"
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <FlipHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                rotation: {
                                                    x: degToRad(-35),
                                                    y: degToRad(20),
                                                    z: degToRad(15),
                                                },
                                            }))
                                        }
                                        title="Isometric 3D Preset"
                                        className="h-6 rounded hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <Square className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* LAYOUT (Size W/H + Scale %) */}
                            <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    Layout
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] block">Size</span>
                                    {selectedLayer.kind !== 'text' ? (
                                        <div className="flex items-center gap-1.5">
                                            <div className="grid grid-cols-2 gap-1.5 flex-1">
                                                <ScrubInput
                                                    label="W"
                                                    value={Math.round(
                                                        selectedLayer.size.width * refStageW
                                                    )}
                                                    min={40}
                                                    max={4000}
                                                    step={10}
                                                    onChange={(pxW) => {
                                                        const nextW = Number((pxW / refStageW).toFixed(4));
                                                        const ratio =
                                                            selectedLayer.size.height /
                                                            Math.max(0.01, selectedLayer.size.width);
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind !== 'text'
                                                                ? {
                                                                    ...l,
                                                                    size: {
                                                                        width: nextW,
                                                                        height: aspectLocked
                                                                            ? Number((nextW * ratio).toFixed(4))
                                                                            : l.size.height,
                                                                    },
                                                                }
                                                                : l
                                                        );
                                                    }}
                                                />
                                                <ScrubInput
                                                    label="H"
                                                    value={Math.round(
                                                        selectedLayer.size.height * refStageH
                                                    )}
                                                    min={40}
                                                    max={4000}
                                                    step={10}
                                                    onChange={(pxH) => {
                                                        const nextH = Number((pxH / refStageH).toFixed(4));
                                                        const ratio =
                                                            selectedLayer.size.width /
                                                            Math.max(0.01, selectedLayer.size.height);
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                            l.kind !== 'text'
                                                                ? {
                                                                    ...l,
                                                                    size: {
                                                                        width: aspectLocked
                                                                            ? Number((nextH * ratio).toFixed(4))
                                                                            : l.size.width,
                                                                        height: nextH,
                                                                    },
                                                                }
                                                                : l
                                                        );
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => setAspectLocked((v) => !v)}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition ${aspectLocked
                                                    ? 'bg-[#1c1c1f] text-white border border-white/10'
                                                    : 'text-[#a1a1aa] hover:text-white'
                                                    }`}
                                                title={aspectLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
                                            >
                                                {aspectLocked ? (
                                                    <Lock className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Unlock className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <ScrubInput
                                            label="Max W"
                                            value={Math.round(selectedLayer.maxWidth * refStageW)}
                                            min={200}
                                            max={1920}
                                            step={20}
                                            unit="px"
                                            onChange={(pxW) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind === 'text'
                                                        ? {
                                                            ...l,
                                                            maxWidth: Number((pxW / refStageW).toFixed(3)),
                                                        }
                                                        : l
                                                )
                                            }
                                        />
                                    )}
                                </div>

                                {/* Scale X / Y % */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-[#a1a1aa] block">
                                        Scale
                                    </span>
                                    <div className="grid grid-cols-2 gap-1.5 pr-6">
                                        <ScrubInput
                                            label="SX"
                                            value={Math.round(Math.abs(selectedLayer.scale.x) * 100)}
                                            min={10}
                                            max={400}
                                            step={2}
                                            unit="%"
                                            onChange={(pct) => {
                                                const signX = Math.sign(selectedLayer.scale.x) || 1;
                                                const signY = Math.sign(selectedLayer.scale.y) || 1;
                                                const newVal = Number((pct / 100).toFixed(2));
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: {
                                                        ...l.scale,
                                                        x: signX * newVal,
                                                        y: aspectLocked ? signY * newVal : l.scale.y,
                                                    },
                                                }));
                                            }}
                                        />
                                        <ScrubInput
                                            label="SY"
                                            value={Math.round(Math.abs(selectedLayer.scale.y) * 100)}
                                            min={10}
                                            max={400}
                                            step={2}
                                            unit="%"
                                            onChange={(pct) => {
                                                const signX = Math.sign(selectedLayer.scale.x) || 1;
                                                const signY = Math.sign(selectedLayer.scale.y) || 1;
                                                const newVal = Number((pct / 100).toFixed(2));
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    scale: {
                                                        ...l.scale,
                                                        x: aspectLocked ? signX * newVal : l.scale.x,
                                                        y: signY * newVal,
                                                    },
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* APPEARANCE */}
                            <div className="p-3.5 space-y-3">
                                <div className="text-[11px] font-medium text-[#e4e4e7]">
                                    Appearance
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 pr-6">
                                    <ScrubInput
                                        label="[]"
                                        value={Math.round(selectedLayer.opacity * 100)}
                                        min={0}
                                        max={100}
                                        step={1}
                                        unit="%"
                                        onChange={(pct) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                opacity: Number((pct / 100).toFixed(2)),
                                            }))
                                        }
                                    />
                                    {selectedLayer.kind !== 'text' && (
                                        <ScrubInput
                                            label="╭"
                                            value={selectedLayer.cornerRadius}
                                            min={0}
                                            max={0.5}
                                            step={0.01}
                                            decimals={2}
                                            onChange={(cornerRadius) =>
                                                updateLayer(activeShot.id, selectedLayer.id, (l) =>
                                                    l.kind !== 'text' ? { ...l, cornerRadius } : l
                                                )
                                            }
                                        />
                                    )}
                                </div>

                                {/* Blend Mode */}
                                <div className="space-y-1">
                                    <span className="text-[10px] text-[#a1a1aa]">Blend Mode</span>
                                    <select
                                        value={selectedLayer.blendMode}
                                        onChange={(e) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                blendMode: e.target.value as BlendMode,
                                            }))
                                        }
                                        className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white capitalize outline-none cursor-pointer"
                                    >
                                        {ALL_BLEND_MODES.map((bm) => (
                                            <option key={bm} value={bm}>
                                                {bm}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 3D Lighting & Material Response */}
                                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-medium text-white">Receives 3D Light</span>
                                            <span className="text-[10px] text-[#a1a1aa] tracking-tight">
                                                {selectedLayer.kind === 'text' ? 'Unlit preserves flat, crisp typography' : 'Shades surface with scene lighting'}
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectedLayer.receivesLight !== undefined
                                                    ? selectedLayer.receivesLight
                                                    : selectedLayer.kind !== 'text'
                                            }
                                            onChange={(e) => {
                                                const receivesLight = e.target.checked;
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    receivesLight,
                                                }));
                                            }}
                                            className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                                        />
                                    </div>

                                    {(selectedLayer.receivesLight ?? (selectedLayer.kind !== 'text')) && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex items-center justify-between gap-1 text-[10px] text-[#a1a1aa] tracking-tight">
                                                <span>Material Presets:</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                                ...l,
                                                                material: { roughness: 0.08, metalness: 0.12 },
                                                            }))
                                                        }
                                                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                                                    >
                                                        Glass
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                                ...l,
                                                                material: { roughness: 0.5, metalness: 0.02 },
                                                            }))
                                                        }
                                                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                                                    >
                                                        Matte
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                                ...l,
                                                                material: { roughness: 0.22, metalness: 0.92 },
                                                            }))
                                                        }
                                                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                                                    >
                                                        Metal
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <ScrubInput
                                                    label="Roughness"
                                                    value={Math.round((selectedLayer.material?.roughness ?? (selectedLayer.kind === 'text' ? 0.45 : 0.24)) * 100)}
                                                    min={0}
                                                    max={100}
                                                    step={2}
                                                    unit="%"
                                                    onChange={(pct) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            material: {
                                                                ...l.material,
                                                                roughness: Number((pct / 100).toFixed(2)),
                                                            },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Metalness"
                                                    value={Math.round((selectedLayer.material?.metalness ?? 0.06) * 100)}
                                                    min={0}
                                                    max={100}
                                                    step={2}
                                                    unit="%"
                                                    onChange={(pct) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            material: {
                                                                ...l.material,
                                                                metalness: Number((pct / 100).toFixed(2)),
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Drop Shadow */}
                                <div className="space-y-2 pt-1 border-t border-white/[0.06]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-[#a1a1aa]">Drop Shadow</span>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(selectedLayer.effects?.dropShadow?.enabled)}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                    ...l,
                                                    effects: {
                                                        ...l.effects,
                                                        dropShadow: {
                                                            enabled,
                                                            color: l.effects?.dropShadow?.color || '#000000',
                                                            opacity: l.effects?.dropShadow?.opacity ?? 0.6,
                                                            blur: l.effects?.dropShadow?.blur ?? 0.04,
                                                            offsetX: l.effects?.dropShadow?.offsetX ?? 0,
                                                            offsetY: l.effects?.dropShadow?.offsetY ?? 0.02,
                                                        },
                                                    },
                                                }));
                                            }}
                                            className="w-3.5 h-3.5 rounded accent-[#0088ff] cursor-pointer"
                                        />
                                    </div>

                                    {selectedLayer.effects?.dropShadow?.enabled && (
                                        <div className="space-y-1.5 p-2 rounded-lg bg-[#161619] border border-white/[0.05]">
                                            <div className="flex items-center gap-2">
                                                <ColorField

                                                    value={selectedLayer.effects.dropShadow.color}
                                                    onChange={(e) => {
                                                        const color = e.target.value;
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    color,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="w-6 h-6 rounded border border-white/10 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <ScrubInput
                                                        label="Opacity"
                                                        value={Math.round(
                                                            selectedLayer.effects.dropShadow.opacity * 100
                                                        )}
                                                        min={0}
                                                        max={100}
                                                        step={2}
                                                        unit="%"
                                                        onChange={(pct) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                                ...l,
                                                                effects: {
                                                                    ...l.effects,
                                                                    dropShadow: {
                                                                        ...l.effects.dropShadow!,
                                                                        opacity: Number((pct / 100).toFixed(2)),
                                                                    },
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                <ScrubInput
                                                    label="Blur"
                                                    value={Math.round(selectedLayer.effects.dropShadow.blur * 500)}
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    onChange={(b) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    blur: Number((b / 500).toFixed(3)),
                                                                },
                                                            },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="X"
                                                    value={Math.round(selectedLayer.effects.dropShadow.offsetX * 500)}
                                                    min={-100}
                                                    max={100}
                                                    step={1}
                                                    onChange={(x) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    offsetX: Number((x / 500).toFixed(3)),
                                                                },
                                                            },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Y"
                                                    value={Math.round(selectedLayer.effects.dropShadow.offsetY * 500)}
                                                    min={-100}
                                                    max={100}
                                                    step={1}
                                                    onChange={(y) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            effects: {
                                                                ...l.effects,
                                                                dropShadow: {
                                                                    ...l.effects.dropShadow!,
                                                                    offsetY: Number((y / 500).toFixed(3)),
                                                                },
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Layer Masking */}
                                <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                                    <span className="text-[10px] text-[#a1a1aa]">Alpha Mask</span>
                                    <select
                                        value={selectedLayer.maskLayerId || ''}
                                        onChange={(e) =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                ...l,
                                                maskLayerId: e.target.value || undefined,
                                            }))
                                        }
                                        className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white outline-none cursor-pointer"
                                    >
                                        <option value="">No Mask (Standard)</option>
                                        {activeShot.layers
                                            .filter(
                                                (l) =>
                                                    l.id !== selectedLayer.id &&
                                                    (l.kind === 'shape' || l.id === selectedLayer.maskLayerId)
                                            )
                                            .map((l) => (
                                                <option key={l.id} value={l.id}>
                                                    Mask with: {l.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                    </div>
                )}

                    {/* =============================================================== */}
                    {/* TAB 2: ANIMATE (WHEN A LAYER IS SELECTED)                       */}
                    {/* =============================================================== */}
                    {effectiveMainTab === 'animate' && (
                        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                            <div className="p-3.5 relative">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        Keyframe Blocks
                                    </span>
                                    <button
                                        onClick={() => setAddAnimMenuOpen((v) => !v)}
                                        className="px-2 py-1 rounded-md bg-[#0088ff]/15 hover:bg-[#0088ff]/25 text-[#0088ff] hover:text-white flex items-center gap-1 text-[10px] font-medium cursor-pointer transition"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>Add</span>
                                    </button>
                                </div>

                                {addAnimMenuOpen && (
                                    <div className="mt-2 p-1 rounded-xl bg-[#18181b] border border-white/10 shadow-2xl space-y-0.5 text-[11px] z-20">
                                        {(
                                            [
                                                { id: 'position', label: 'Position & Depth (X, Y, Z)' },
                                                { id: 'tilt', label: '3D Tilt (Pitch & Yaw)' },
                                                { id: 'rotation', label: '2D Roll Rotation' },
                                                { id: 'scale', label: 'Scale Multiplier' },
                                                { id: 'size', label: 'Width & Height Size' },
                                                { id: 'opacity', label: 'Opacity Fade' },
                                                { id: 'cornerRadius', label: 'Corner Radius' },
                                                { id: 'layerBlur', label: 'Layer Blur' },
                                                { id: 'shimmer', label: 'Light Shimmer Sweep' },
                                                { id: 'maskSweep', label: 'Mask Reveal Sweep' },
                                            ] as { id: AnimationBlockProperty; label: string }[]
                                        ).map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleAddAnimationBlock(item.id)}
                                                className="w-full px-2.5 py-1.5 rounded-lg text-left text-[#e4e4e7] hover:bg-[#0088ff] hover:text-white cursor-pointer transition"
                                            >
                                                + {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ANIMATION BLOCKS LIST */}
                            {selectedLayer.blocks.map((blk) => {
                                const isVec = typeof blk.amount === 'object';
                                const isAngle =
                                    blk.property === 'tilt' || blk.property === 'rotation';
                                const isSize = blk.property === 'size';
                                const scaleFactor = isAngle ? 1 : refStageW;
                                const isSelectedBlock = selectedBlockId === blk.id;

                                return (
                                    <div
                                        key={blk.id}
                                        onClick={() => selectBlock(blk.id, selectedLayer.id)}
                                        className={`p-3.5 space-y-3 transition cursor-pointer ${isSelectedBlock
                                            ? 'bg-[#0088ff]/5 border-l-2 border-l-[#0088ff]'
                                            : 'hover:bg-white/[0.01]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-[#e4e4e7] capitalize flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isSelectedBlock ? 'bg-[#0088ff]' : 'bg-[#a1a1aa]'}`} />
                                                {blk.label || `${blk.property} animation`}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteBlock(blk.id);
                                                }}
                                                className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-rose-400 cursor-pointer"
                                                title="Delete Animation Block"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-[#a1a1aa] block capitalize">
                                                Delta Amount
                                            </span>
                                            {isVec ? (
                                                <div className={`grid gap-1.5 ${isSize ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                    <ScrubInput
                                                        label={isSize ? 'ΔW' : 'X'}
                                                        value={
                                                            isAngle
                                                                ? radToDeg((blk.amount as Vec3).x)
                                                                : Math.round((blk.amount as Vec3).x * scaleFactor)
                                                        }
                                                        min={-3000}
                                                        max={3000}
                                                        step={isAngle ? 1 : 10}
                                                        unit={isAngle ? '°' : isSize ? 'px' : ''}
                                                        onChange={(v) =>
                                                            handleUpdateBlock(blk.id, {
                                                                amount: {
                                                                    ...(blk.amount as Vec3),
                                                                    x: isAngle
                                                                        ? degToRad(v)
                                                                        : Number((v / scaleFactor).toFixed(4)),
                                                                },
                                                            })
                                                        }
                                                    />
                                                    <ScrubInput
                                                        label={isSize ? 'ΔH' : 'Y'}
                                                        value={
                                                            isAngle
                                                                ? radToDeg((blk.amount as Vec3).y)
                                                                : Math.round((blk.amount as Vec3).y * refStageH)
                                                        }
                                                        min={-3000}
                                                        max={3000}
                                                        step={isAngle ? 1 : 10}
                                                        unit={isAngle ? '°' : isSize ? 'px' : ''}
                                                        onChange={(v) =>
                                                            handleUpdateBlock(blk.id, {
                                                                amount: {
                                                                    ...(blk.amount as Vec3),
                                                                    y: isAngle
                                                                        ? degToRad(v)
                                                                        : Number((v / refStageH).toFixed(4)),
                                                                },
                                                            })
                                                        }
                                                    />
                                                    {!isSize && (
                                                        <ScrubInput
                                                            label="Z"
                                                            value={
                                                                isAngle
                                                                    ? radToDeg((blk.amount as Vec3).z)
                                                                    : Math.round((blk.amount as Vec3).z * 500)
                                                            }
                                                            min={-1500}
                                                            max={1500}
                                                            step={isAngle ? 1 : 10}
                                                            unit={isAngle ? '°' : ''}
                                                            onChange={(v) =>
                                                                handleUpdateBlock(blk.id, {
                                                                    amount: {
                                                                        ...(blk.amount as Vec3),
                                                                        z: isAngle
                                                                            ? degToRad(v)
                                                                            : Number((v / 500).toFixed(4)),
                                                                    },
                                                                })
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                                <ScrubInput
                                                    label="Δ"
                                                    value={blk.amount as number}
                                                    min={blk.property === 'opacity' ? -1 : -2}
                                                    max={blk.property === 'opacity' ? 1 : 30}
                                                    step={0.05}
                                                    decimals={2}
                                                    onChange={(amount) =>
                                                        handleUpdateBlock(blk.id, { amount })
                                                    }
                                                />
                                            )}
                                        </div>

                                        {/* DIRECTION BUTTONS (ONLY FOR POSITION) */}
                                        {isVec && blk.property === 'position' && (
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] text-[#a1a1aa] block">
                                                    Direction
                                                </span>
                                                <div className="grid grid-cols-2 gap-1 bg-[#161619] p-0.5 rounded-lg border border-white/[0.05]">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateBlock(blk.id, {
                                                                amount: {
                                                                    ...(blk.amount as Vec3),
                                                                    x: -Math.abs((blk.amount as Vec3).x || 0.35),
                                                                },
                                                            });
                                                        }}
                                                        className={`h-6 rounded-md flex items-center justify-center cursor-pointer transition ${(blk.amount as Vec3).x <= 0
                                                            ? 'bg-[#27272c] text-white'
                                                            : 'text-[#a1a1aa] hover:text-white'
                                                            }`}
                                                        title="Left Direction"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUpdateBlock(blk.id, {
                                                                amount: {
                                                                    ...(blk.amount as Vec3),
                                                                    x: Math.abs((blk.amount as Vec3).x || 0.35),
                                                                },
                                                            });
                                                        }}
                                                        className={`h-6 rounded-md flex items-center justify-center cursor-pointer transition ${(blk.amount as Vec3).x > 0
                                                            ? 'bg-[#27272c] text-white'
                                                            : 'text-[#a1a1aa] hover:text-white'
                                                            }`}
                                                        title="Right Direction"
                                                    >
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Timing (Start & Length) + Easing */}
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <ScrubInput
                                                label="🕒"
                                                value={blk.startMs}
                                                min={0}
                                                max={Math.max(0, activeShot.durationMs - 80)}
                                                step={20}
                                                unit=" ms"
                                                onChange={(startMs) =>
                                                    handleUpdateBlock(blk.id, { startMs })
                                                }
                                            />
                                            <ScrubInput
                                                label="⏱"
                                                value={blk.durationMs}
                                                min={80}
                                                max={activeShot.durationMs}
                                                step={20}
                                                unit=" ms"
                                                onChange={(durationMs) =>
                                                    handleUpdateBlock(blk.id, { durationMs })
                                                }
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-[#a1a1aa] block">
                                                Easing
                                            </span>
                                            <select
                                                value={
                                                    blk.easing.kind === 'bezier'
                                                        ? 'bezier'
                                                        : `${blk.easing.kind}:${blk.easing.name}`
                                                }
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const easing: Easing =
                                                        val === 'bezier'
                                                            ? {
                                                                kind: 'bezier',
                                                                x1: 0.16,
                                                                y1: 1,
                                                                x2: 0.3,
                                                                y2: 1,
                                                            }
                                                            : val.startsWith('spring:')
                                                                ? {
                                                                    kind: 'spring',
                                                                    name: val.split(':')[1] as SpringEasingName,
                                                                }
                                                                : {
                                                                    kind: 'preset',
                                                                    name: val.split(':')[1] as PresetEasingName,
                                                                };
                                                    handleUpdateBlock(blk.id, { easing });
                                                }}
                                                className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 text-[11px] text-white outline-none cursor-pointer"
                                            >
                                                <option value="preset:ease-in-out">
                                                    Ease in and out
                                                </option>
                                                <option value="preset:ease-out">Ease out</option>
                                                <option value="preset:ease-out-expo">
                                                    Ease out expo
                                                </option>
                                                <option value="preset:ease-out-back">
                                                    Ease out back
                                                </option>
                                                <option value="spring:gentle">Spring: Gentle</option>
                                                <option value="spring:quick">Spring: Quick</option>
                                                <option value="spring:bouncy">Spring: Bouncy</option>
                                                <option value="preset:linear">Linear</option>
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* IN SECTION (Entrance Transitions — supports stacked presets) */}
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        In (Entrance){(selectedLayer.entrances?.length || 0) > 1 ? ` (${selectedLayer.entrances?.length})` : ''}
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                if (l.entrances && l.entrances.length > 0) {
                                                    const nextEnt = {
                                                        id: `ent-${Date.now()}`,
                                                        type: 'scale-out' as TransitionType,
                                                        durationMs: 650,
                                                        delayMs: 0,
                                                        distance: 0.18,
                                                        easing: { kind: 'preset' as const, name: 'ease-out' as const },
                                                    };
                                                    const next = [...l.entrances, nextEnt];
                                                    return { ...l, entrances: next, entrance: next[0] };
                                                }
                                                if (l.entrance && l.entrance.type !== 'none') {
                                                    const first = { ...l.entrance, id: `ent-${Date.now()}-1` };
                                                    const second = {
                                                        id: `ent-${Date.now()}-2`,
                                                        type: 'scale-out' as TransitionType,
                                                        durationMs: 650,
                                                        delayMs: 0,
                                                        distance: 0.18,
                                                        easing: { kind: 'preset' as const, name: 'ease-out' as const },
                                                    };
                                                    return { ...l, entrances: [first, second], entrance: first };
                                                }
                                                return {
                                                    ...l,
                                                    entrance: {
                                                        ...l.entrance,
                                                        type: 'fade',
                                                        durationMs: l.entrance.durationMs || 650,
                                                    },
                                                };
                                            })
                                        }
                                        title="Add / Stack Entrance"
                                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {selectedLayer.entrances && selectedLayer.entrances.length > 0 ? (
                                    <div className="space-y-2.5">
                                        {selectedLayer.entrances.map((ent, idx) => (
                                            <div key={ent.id || `ent-${ent.type}-${idx}`} className="space-y-2 p-2.5 rounded-xl bg-[#161619] border border-white/[0.06]">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3 text-[#0088ff]" />
                                                        <select
                                                            value={ent.type}
                                                            onChange={(e) =>
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                    const next = [...(l.entrances || [])];
                                                                    next[idx] = { ...next[idx], type: e.target.value as TransitionType };
                                                                    return { ...l, entrances: next, entrance: next[0] };
                                                                })
                                                            }
                                                            className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer capitalize"
                                                        >
                                                            <option value="fade" className="bg-[#18181b]">Fade</option>
                                                            <option value="slide-up" className="bg-[#18181b]">Slide Up</option>
                                                            <option value="slide-down" className="bg-[#18181b]">Slide Down</option>
                                                            <option value="slide-left" className="bg-[#18181b]">Slide Left</option>
                                                            <option value="slide-right" className="bg-[#18181b]">Slide Right</option>
                                                            <option value="scale-out" className="bg-[#18181b]">Scale In</option>
                                                            <option value="float-out" className="bg-[#18181b]">Float Out</option>
                                                            <option value="mask-sweep" className="bg-[#18181b]">Mask Sweep</option>
                                                        </select>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                const next = (l.entrances || []).filter((_, i) => i !== idx);
                                                                return {
                                                                    ...l,
                                                                    entrances: next.length > 0 ? next : undefined,
                                                                    entrance: next[0] || { ...l.entrance, type: 'none' },
                                                                };
                                                            })
                                                        }
                                                        title="Remove this entrance"
                                                        className="p-1 text-[#a1a1aa] hover:text-rose-400 cursor-pointer"
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <ScrubInput
                                                        label="Delay"
                                                        value={ent.delayMs || 0}
                                                        min={0}
                                                        max={Math.max(0, activeShot.durationMs - 100)}
                                                        step={20}
                                                        unit=" ms"
                                                        onChange={(delayMs) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                const next = [...(l.entrances || [])];
                                                                next[idx] = { ...next[idx], delayMs };
                                                                return { ...l, entrances: next, entrance: next[0] };
                                                            })
                                                        }
                                                    />
                                                    <ScrubInput
                                                        label="Length"
                                                        value={ent.durationMs}
                                                        min={0}
                                                        max={activeShot.durationMs}
                                                        step={20}
                                                        unit=" ms"
                                                        onChange={(durationMs) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                const next = [...(l.entrances || [])];
                                                                next[idx] = { ...next[idx], durationMs };
                                                                return { ...l, entrances: next, entrance: next[0] };
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    selectedLayer.entrance.type !== 'none' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                                    <Sparkles className="w-3 h-3 text-[#a1a1aa]" />
                                                    <select
                                                        value={selectedLayer.entrance.type}
                                                        onChange={(e) =>
                                                            updateLayer(
                                                                activeShot.id,
                                                                selectedLayer.id,
                                                                (l) => ({
                                                                    ...l,
                                                                    entrance: {
                                                                        ...l.entrance,
                                                                        type: e.target.value as TransitionType,
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer capitalize"
                                                    >
                                                        <option value="fade" className="bg-[#18181b]">Fade</option>
                                                        <option value="slide-up" className="bg-[#18181b]">Slide Up</option>
                                                        <option value="slide-down" className="bg-[#18181b]">Slide Down</option>
                                                        <option value="slide-left" className="bg-[#18181b]">Slide Left</option>
                                                        <option value="slide-right" className="bg-[#18181b]">Slide Right</option>
                                                        <option value="scale-out" className="bg-[#18181b]">Scale In</option>
                                                        <option value="mask-sweep" className="bg-[#18181b]">Mask Sweep</option>
                                                    </select>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            entrance: {
                                                                ...l.entrance,
                                                                durationMs:
                                                                    l.entrance.durationMs === 0 ? 650 : 0,
                                                            },
                                                        }))
                                                    }
                                                    title={selectedLayer.entrance.durationMs === 0 ? 'Enable' : 'Disable'}
                                                    className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer"
                                                >
                                                    {selectedLayer.entrance.durationMs === 0 ? (
                                                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                                    ) : (
                                                        <Eye className="w-3.5 h-3.5" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            entrance: { ...l.entrance, type: 'none' },
                                                        }))
                                                    }
                                                    title="Remove Entrance"
                                                    className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer"
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                                <ScrubInput
                                                    label="Delay"
                                                    value={selectedLayer.entrance.delayMs || 0}
                                                    min={0}
                                                    max={Math.max(0, activeShot.durationMs - 100)}
                                                    step={20}
                                                    unit=" ms"
                                                    onChange={(delayMs) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            entrance: { ...l.entrance, delayMs },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Length"
                                                    value={selectedLayer.entrance.durationMs}
                                                    min={0}
                                                    max={activeShot.durationMs}
                                                    step={20}
                                                    unit=" ms"
                                                    onChange={(durationMs) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            entrance: { ...l.entrance, durationMs },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* OUT SECTION (Exit Transitions — supports stacked presets) */}
                            <div className="p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                                        Out (Exit){(selectedLayer.exits?.length || 0) > 1 ? ` (${selectedLayer.exits?.length})` : ''}
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                if (l.exits && l.exits.length > 0) {
                                                    const nextExt = {
                                                        id: `ext-${Date.now()}`,
                                                        type: 'scale-out' as TransitionType,
                                                        durationMs: 550,
                                                        delayMs: 0,
                                                        distance: 0.16,
                                                        easing: { kind: 'preset' as const, name: 'ease-out' as const },
                                                    };
                                                    const next = [...l.exits, nextExt];
                                                    return { ...l, exits: next, exit: next[0] };
                                                }
                                                if (l.exit && l.exit.type !== 'none') {
                                                    const first = { ...l.exit, id: `ext-${Date.now()}-1` };
                                                    const second = {
                                                        id: `ext-${Date.now()}-2`,
                                                        type: 'scale-out' as TransitionType,
                                                        durationMs: 550,
                                                        delayMs: 0,
                                                        distance: 0.16,
                                                        easing: { kind: 'preset' as const, name: 'ease-out' as const },
                                                    };
                                                    return { ...l, exits: [first, second], exit: first };
                                                }
                                                return {
                                                    ...l,
                                                    exit: {
                                                        ...l.exit,
                                                        type: 'fade',
                                                        durationMs: l.exit.durationMs || 550,
                                                    },
                                                };
                                            })
                                        }
                                        title="Add / Stack Exit"
                                        className="p-1 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {selectedLayer.exits && selectedLayer.exits.length > 0 ? (
                                    <div className="space-y-2.5">
                                        {selectedLayer.exits.map((ext, idx) => (
                                            <div key={ext.id || `ext-${ext.type}-${idx}`} className="space-y-2 p-2.5 rounded-xl bg-[#161619] border border-white/[0.06]">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3 text-rose-400" />
                                                        <select
                                                            value={ext.type}
                                                            onChange={(e) =>
                                                                updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                    const next = [...(l.exits || [])];
                                                                    next[idx] = { ...next[idx], type: e.target.value as TransitionType };
                                                                    return { ...l, exits: next, exit: next[0] };
                                                                })
                                                            }
                                                            className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer capitalize"
                                                        >
                                                            <option value="fade" className="bg-[#18181b]">Fade</option>
                                                            <option value="slide-up" className="bg-[#18181b]">Slide Up</option>
                                                            <option value="slide-down" className="bg-[#18181b]">Slide Down</option>
                                                            <option value="slide-left" className="bg-[#18181b]">Slide Left</option>
                                                            <option value="slide-right" className="bg-[#18181b]">Slide Right</option>
                                                            <option value="scale-out" className="bg-[#18181b]">Scale Out</option>
                                                            <option value="float-out" className="bg-[#18181b]">Float Out</option>
                                                            <option value="mask-sweep" className="bg-[#18181b]">Mask Sweep</option>
                                                        </select>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                const next = (l.exits || []).filter((_, i) => i !== idx);
                                                                return {
                                                                    ...l,
                                                                    exits: next.length > 0 ? next : undefined,
                                                                    exit: next[0] || { ...l.exit, type: 'none' },
                                                                };
                                                            })
                                                        }
                                                        title="Remove this exit"
                                                        className="p-1 text-[#a1a1aa] hover:text-rose-400 cursor-pointer"
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <ScrubInput
                                                        label="Offset"
                                                        value={ext.delayMs || 0}
                                                        min={0}
                                                        max={Math.max(0, activeShot.durationMs - 100)}
                                                        step={20}
                                                        unit=" ms"
                                                        onChange={(delayMs) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                const next = [...(l.exits || [])];
                                                                next[idx] = { ...next[idx], delayMs };
                                                                return { ...l, exits: next, exit: next[0] };
                                                            })
                                                        }
                                                    />
                                                    <ScrubInput
                                                        label="Length"
                                                        value={ext.durationMs}
                                                        min={0}
                                                        max={activeShot.durationMs}
                                                        step={20}
                                                        unit=" ms"
                                                        onChange={(durationMs) =>
                                                            updateLayer(activeShot.id, selectedLayer.id, (l) => {
                                                                const next = [...(l.exits || [])];
                                                                next[idx] = { ...next[idx], durationMs };
                                                                return { ...l, exits: next, exit: next[0] };
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    selectedLayer.exit.type !== 'none' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-7 rounded-lg bg-[#1c1c1f] border border-white/[0.06] px-2.5 flex items-center gap-2">
                                                    <Sparkles className="w-3 h-3 text-[#a1a1aa]" />
                                                    <select
                                                        value={selectedLayer.exit.type}
                                                        onChange={(e) =>
                                                            updateLayer(
                                                                activeShot.id,
                                                                selectedLayer.id,
                                                                (l) => ({
                                                                    ...l,
                                                                    exit: {
                                                                        ...l.exit,
                                                                        type: e.target.value as TransitionType,
                                                                    },
                                                                })
                                                            )
                                                        }
                                                        className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer capitalize"
                                                    >
                                                        <option value="fade" className="bg-[#18181b]">Fade</option>
                                                        <option value="slide-up" className="bg-[#18181b]">Slide Up</option>
                                                        <option value="slide-down" className="bg-[#18181b]">Slide Down</option>
                                                        <option value="slide-left" className="bg-[#18181b]">Slide Left</option>
                                                        <option value="slide-right" className="bg-[#18181b]">Slide Right</option>
                                                        <option value="float-out" className="bg-[#18181b]">Float Out</option>
                                                        <option value="scale-out" className="bg-[#18181b]">Scale Out</option>
                                                        <option value="mask-sweep" className="bg-[#18181b]">Mask Sweep</option>
                                                    </select>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            exit: {
                                                                ...l.exit,
                                                                durationMs:
                                                                    l.exit.durationMs === 0 ? 550 : 0,
                                                            },
                                                        }))
                                                    }
                                                    title={selectedLayer.exit.durationMs === 0 ? 'Enable' : 'Disable'}
                                                    className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer"
                                                >
                                                    {selectedLayer.exit.durationMs === 0 ? (
                                                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                                    ) : (
                                                        <Eye className="w-3.5 h-3.5" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            exit: { ...l.exit, type: 'none' },
                                                        }))
                                                    }
                                                    title="Remove Exit"
                                                    className="p-1 text-[#a1a1aa] hover:text-white cursor-pointer"
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                                <ScrubInput
                                                    label="Offset"
                                                    value={selectedLayer.exit.delayMs || 0}
                                                    min={0}
                                                    max={Math.max(0, activeShot.durationMs - 100)}
                                                    step={20}
                                                    unit=" ms"
                                                    onChange={(delayMs) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            exit: { ...l.exit, delayMs },
                                                        }))
                                                    }
                                                />
                                                <ScrubInput
                                                    label="Length"
                                                    value={selectedLayer.exit.durationMs}
                                                    min={0}
                                                    max={activeShot.durationMs}
                                                    step={20}
                                                    unit=" ms"
                                                    onChange={(durationMs) =>
                                                        updateLayer(activeShot.id, selectedLayer.id, (l) => ({
                                                            ...l,
                                                            exit: { ...l.exit, durationMs },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <ProjectSettingsPanel onSwapImageClick={onSwapImageClick} />
            )}
        </aside>
    );
});

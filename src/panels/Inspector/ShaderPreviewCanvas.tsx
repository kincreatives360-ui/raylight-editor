import React, { useEffect, useRef } from 'react';
import type { ShaderPreset } from '../../model/backgroundPresets';
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

export const ShaderPreviewCanvas: React.FC<ShaderPreviewCanvasProps> = ({
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


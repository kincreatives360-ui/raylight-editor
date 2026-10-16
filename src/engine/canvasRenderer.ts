// src/engine/canvasRenderer.ts
import type {
    Project,
    Shot,
    ImageLayer,
    ShapeLayer,
    TextLayer,
    Fill,
    LayerBase,
} from '../model/types';
import { resolveShotBackground } from '../model/types';
import { radToDeg } from '../model/defaults';
import type {
    EvaluatedProjectFrame,
    EvaluatedLayerWithEffects,
} from './evaluateShot';
import type { EvaluatedCamera } from './evaluateCamera';
import type { EvaluatedEffects } from './evaluateEffects';
import { kelvinToRgb } from '../stage/Stage';

const imageElementCache = new Map<string, HTMLImageElement>();

export async function preloadProjectImages(project: Project): Promise<void> {
    const urls = new Set<string>();

    for (const a of Object.values(project.assets || {})) {
        if (a?.dataUrl) urls.add(a.dataUrl);
    }

    if (project.background?.kind === 'image' && project.background.assetId) {
        const bgAsset = project.assets?.[project.background.assetId];
        if (bgAsset?.dataUrl) urls.add(bgAsset.dataUrl);
    }

    if (project.shots) {
        for (const shot of project.shots) {
            if (shot.background?.kind === 'image' && shot.background.assetId) {
                const shotBgAsset = project.assets?.[shot.background.assetId];
                if (shotBgAsset?.dataUrl) urls.add(shotBgAsset.dataUrl);
            }
        }
    }

    await Promise.all(
        Array.from(urls).map(
            (url) =>
                new Promise<void>((resolve) => {
                    if (imageElementCache.has(url)) {
                        resolve();
                        return;
                    }
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        imageElementCache.set(url, img);
                        resolve();
                    };
                    img.onerror = () => resolve();
                    img.src = url;
                })
        )
    );
}

function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const full =
        clean.length === 3
            ? clean
                .split('')
                .map((c) => c + c)
                .join('')
            : clean.padEnd(6, '0');
    const num = parseInt(full.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.closePath();
}

function createCanvasFillStyle(
    ctx: CanvasRenderingContext2D,
    fill: Fill,
    w: number,
    h: number,
    opacityMultiplier = 1
): string | CanvasGradient {
    if (fill.kind === 'solid') {
        return hexToRgba(fill.color, fill.opacity * opacityMultiplier);
    }
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const len = Math.hypot(w, h) / 2;
    const grad = ctx.createLinearGradient(
        cx - Math.cos(rad) * len,
        cy - Math.sin(rad) * len,
        cx + Math.cos(rad) * len,
        cy + Math.sin(rad) * len
    );
    for (const stop of fill.stops) {
        grad.addColorStop(
            Math.max(0, Math.min(1, stop.at)),
            hexToRgba(stop.color, opacityMultiplier)
        );
    }
    return grad;
}

function applyLayerShadowOrGlow(
    ctx: CanvasRenderingContext2D,
    effects: LayerBase['effects'],
    canvasW: number,
    canvasH: number,
    bloomMultiplier: number
): void {
    if (effects.glow?.enabled && effects.glow.intensity > 0) {
        const gl = effects.glow;
        ctx.shadowColor = hexToRgba(
            gl.color,
            Math.min(1, gl.intensity * 0.8 * bloomMultiplier)
        );
        ctx.shadowBlur = Math.max(
            10,
            gl.radius * Math.max(canvasW, canvasH) * bloomMultiplier
        );
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    } else if (effects.dropShadow?.enabled) {
        const ds = effects.dropShadow;
        ctx.shadowColor = hexToRgba(ds.color, ds.opacity);
        ctx.shadowBlur = ds.blur * Math.max(canvasW, canvasH);
        ctx.shadowOffsetX = ds.offsetX * canvasW;
        ctx.shadowOffsetY = ds.offsetY * canvasH;
    } else {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = canvasH * 0.035;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = canvasH * 0.018;
    }
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

// Draws a clean, neutral, modern placeholder when an ImageLayer has no uploaded image asset
function drawDefaultImagePlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    layerName: string
): void {
    // 1. Dark neutral studio card surface
    const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    bgGrad.addColorStop(0, '#0c0e17');
    bgGrad.addColorStop(1, '#151928');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // 2. Subtle dashed inner outline
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.005));
    ctx.setLineDash([6, 6]);
    const inset = Math.max(8, Math.min(w, h) * 0.05);
    drawRoundedRectPath(
        ctx,
        x + inset,
        y + inset,
        w - inset * 2,
        h - inset * 2,
        Math.max(4, inset * 0.5)
    );
    ctx.stroke();
    ctx.restore();

    // 3. Elegant centered photo placeholder icon
    const cx = x + w / 2;
    const cy = y + h / 2;
    const iconSize = Math.max(16, Math.min(48, Math.min(w, h) * 0.16));

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = Math.max(1.5, iconSize * 0.07);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Outer photo frame
    const fx = cx - iconSize;
    const fy = cy - iconSize * 0.85;
    const fw = iconSize * 2;
    const fh = iconSize * 1.5;
    drawRoundedRectPath(ctx, fx, fy, fw, fh, iconSize * 0.2);
    ctx.fill();
    ctx.stroke();

    // Mountain peak path
    ctx.beginPath();
    ctx.moveTo(fx + fw * 0.15, fy + fh * 0.82);
    ctx.lineTo(fx + fw * 0.45, fy + fh * 0.42);
    ctx.lineTo(fx + fw * 0.65, fy + fh * 0.62);
    ctx.lineTo(fx + fw * 0.85, fy + fh * 0.35);
    ctx.lineTo(fx + fw * 0.95, fy + fh * 0.82);
    ctx.stroke();

    // Sun circle
    ctx.beginPath();
    ctx.arc(fx + fw * 0.3, fy + fh * 0.32, iconSize * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Clean layer title and neutral hint
    const fontSize = Math.max(10, Math.min(18, Math.round(h * 0.045)));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
        layerName.length > 28 ? layerName.slice(0, 26) + '...' : layerName,
        cx,
        cy + iconSize * 0.85
    );

    const subFontSize = Math.max(8, Math.min(12, Math.round(fontSize * 0.75)));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `400 ${subFontSize}px Inter, sans-serif`;
    ctx.fillText('Drop image or choose asset', cx, cy + iconSize * 0.85 + fontSize + 4);
}

// Draws a single evaluated layer with 3D perspective parallax, 3D tilt matrix, and device frames
function drawLayerOnCanvas(
    ctx: CanvasRenderingContext2D,
    evalLayer: EvaluatedLayerWithEffects,
    project: Project,
    frame: {
        camera: EvaluatedCamera;
        effects: EvaluatedEffects;
        activeShot?: Shot;
        shot?: Shot;
    },
    canvasW: number,
    canvasH: number
): void {
    if (!evalLayer.visible || evalLayer.opacity <= 0.001) return;

    const { layer } = evalLayer;
    const light = frame.activeShot?.light || frame.shot?.light || {
        position: { x: -0.2, y: -0.3, z: 0.8 },
        color: '#ffffff',
        intensity: 1,
        temperature: 5500,
    };
    const eff = frame.effects.state;

    // 1. Compute 3D Perspective Depth & True Camera Parallax
    const fovRad = (frame.camera.fovDegrees * Math.PI) / 180;
    const perspectivePx = Math.max(
        300,
        (canvasH / 2) / Math.tan(Math.max(0.1, fovRad / 2))
    );

    const zPx = evalLayer.position.z * (canvasW * 0.28);
    const depthScale = perspectivePx / Math.max(120, perspectivePx - zPx);
    const cameraZoom = frame.camera.zoom;
    const totalScale = depthScale * cameraZoom;

    // Foreground layers shift more than background layers when camera dollies
    const relX = (evalLayer.position.x - frame.camera.target.x) * canvasW;
    const relY = (evalLayer.position.y - frame.camera.target.y) * canvasH;

    const screenCenterX = canvasW / 2 + relX * totalScale;
    const screenCenterY = canvasH / 2 + relY * totalScale;

    const baseW = Math.max(16, evalLayer.size.width * canvasW);
    const baseH = Math.max(16, evalLayer.size.height * canvasH);

    const rx = evalLayer.rotation.x;
    const ry = evalLayer.rotation.y;
    const rz = evalLayer.rotation.z;
    const rotXDeg = radToDeg(rx);
    const rotYDeg = radToDeg(ry);

    ctx.save();
    ctx.globalAlpha = evalLayer.opacity;

    if (layer.blendMode !== 'normal') {
        ctx.globalCompositeOperation =
            layer.blendMode === 'add'
                ? 'lighter'
                : (layer.blendMode as GlobalCompositeOperation);
    }

    // Apply Depth of Field + Layer Blur + Motion Blur
    const motionBlurAdd = eff.motionBlur.enabled
        ? (eff.motionBlur.shutterAngle / 360) * 1.5
        : 0;
    const totalBlur =
        (evalLayer.totalBlurPx + motionBlurAdd) * (canvasW / 960);
    if (totalBlur > 0.35) {
        ctx.filter = `blur(${totalBlur.toFixed(1)}px)`;
    }

    // Move origin to layer's 3D-projected center
    ctx.translate(screenCenterX, screenCenterY);
    ctx.scale(
        evalLayer.scale.x * totalScale,
        evalLayer.scale.y * totalScale
    );

    // Apply 2D Roll (Rotate Z) + 3D Pitch/Yaw Foreshortening Matrix
    ctx.rotate(rz);
    const cosY = Math.cos(ry);
    const cosX = Math.cos(rx);
    const shearXY = Math.sin(rx) * Math.sin(ry) * 0.55;
    const shearYX = -Math.sin(ry) * Math.sin(rx) * 0.25;
    ctx.transform(
        Math.max(0.22, cosY),
        shearYX,
        shearXY,
        Math.max(0.22, cosX),
        0,
        0
    );

    // Mask Sweep Clipping
    if (evalLayer.maskSweepProgress < 1) {
        ctx.beginPath();
        ctx.rect(
            -baseW / 2,
            -baseH / 2,
            baseW * evalLayer.maskSweepProgress,
            baseH
        );
        ctx.clip();
    }

    const bloomMultiplier = eff.bloom.enabled
        ? 1 + eff.bloom.intensity * 1.4
        : 1;

    // ==========================================================================
    // A. IMAGE LAYER & 3D DEVICE FRAMES
    // ==========================================================================
    if (layer.kind === 'image') {
        const imgLayer = layer as ImageLayer;
        const device = imgLayer.device;
        const isSilver = device?.color === 'silver';
        const sideColor = isSilver ? '#94a3b8' : '#1e293b';
        const rimColor = isSilver ? '#e2e8f0' : '#334155';

        const radiusPx = device
            ? device.type === 'iphone'
                ? Math.min(baseW, baseH) * 0.14
                : device.type === 'ipad'
                    ? Math.min(baseW, baseH) * 0.07
                    : Math.min(baseW, baseH) * 0.045
            : imgLayer.cornerRadius * Math.min(baseW, baseH) * 0.5;

        // 1. Draw 3D Extrusion Slab Depth Behind Device/Card
        const extrudeSteps = device ? 8 : 4;
        const stepX = (-rotYDeg / 30) * 1.2;
        const stepY = (rotXDeg / 30) * 1.2;

        for (let s = extrudeSteps; s >= 1; s--) {
            ctx.fillStyle = sideColor;
            drawRoundedRectPath(
                ctx,
                -baseW / 2 + stepX * s,
                -baseH / 2 + stepY * s,
                baseW,
                baseH,
                radiusPx
            );
            ctx.fill();
        }

        // 2. Draw Drop Shadow & Outer Chassis
        applyLayerShadowOrGlow(
            ctx,
            imgLayer.effects,
            canvasW,
            canvasH,
            bloomMultiplier
        );
        ctx.fillStyle = '#05070d';
        drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, radiusPx);
        ctx.fill();
        clearShadow(ctx);

        if (device) {
            ctx.strokeStyle = rimColor;
            ctx.lineWidth = Math.max(2, canvasW * 0.0025);
            ctx.stroke();
        }

        // 3. Draw Inner Screen Content (with Fractional Crop)
        const bezel = device ? Math.max(6, baseW * 0.026) : 0;
        const topChrome = device?.type === 'browser' ? baseH * 0.07 : 0;
        const screenX = -baseW / 2 + bezel;
        const screenY = -baseH / 2 + bezel + topChrome;
        const screenW = Math.max(10, baseW - bezel * 2);
        const screenH = Math.max(10, baseH - bezel * 2 - topChrome);

        // Browser Top Header Bar
        if (device?.type === 'browser') {
            ctx.fillStyle = isSilver ? '#f1f5f9' : '#0f172a';
            drawRoundedRectPath(
                ctx,
                -baseW / 2,
                -baseH / 2,
                baseW,
                topChrome + radiusPx,
                radiusPx
            );
            ctx.fill();
            ['#f43f5e', '#fbbf24', '#34d399'].forEach((dotColor, idx) => {
                ctx.fillStyle = dotColor;
                ctx.beginPath();
                ctx.arc(
                    -baseW / 2 + baseW * 0.04 + idx * (baseW * 0.028),
                    -baseH / 2 + topChrome * 0.55,
                    Math.max(3, baseH * 0.012),
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            });
        }

        ctx.save();
        drawRoundedRectPath(
            ctx,
            screenX,
            screenY,
            screenW,
            screenH,
            Math.max(2, radiusPx - bezel)
        );
        ctx.clip();

        const asset = project.assets[imgLayer.assetId];
        const cachedImg = asset?.dataUrl
            ? imageElementCache.get(asset.dataUrl)
            : undefined;
        const crop = imgLayer.crop || { x: 0, y: 0, width: 1, height: 1 };

        if (cachedImg) {
            const sx = crop.x * cachedImg.naturalWidth;
            const sy = crop.y * cachedImg.naturalHeight;
            const sw = Math.max(1, crop.width * cachedImg.naturalWidth);
            const sh = Math.max(1, crop.height * cachedImg.naturalHeight);
            ctx.drawImage(
                cachedImg,
                sx,
                sy,
                sw,
                sh,
                screenX,
                screenY,
                screenW,
                screenH
            );
        } else {
            drawDefaultImagePlaceholder(
                ctx,
                screenX,
                screenY,
                screenW,
                screenH,
                imgLayer.name
            );
        }

        // iPhone Dynamic Island & Home Bar
        if (device?.type === 'iphone') {
            ctx.fillStyle = '#000000';
            drawRoundedRectPath(
                ctx,
                -baseW * 0.14,
                screenY + screenH * 0.025,
                baseW * 0.28,
                screenH * 0.038,
                999
            );
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            drawRoundedRectPath(
                ctx,
                -baseW * 0.18,
                screenY + screenH * 0.96,
                baseW * 0.36,
                3,
                999
            );
            ctx.fill();
        }

        // MacBook Camera Notch & 3D Hinged Base Deck
        if (device?.type === 'macbook') {
            ctx.fillStyle = '#000000';
            drawRoundedRectPath(
                ctx,
                -baseW * 0.08,
                screenY,
                baseW * 0.16,
                screenH * 0.04,
                4
            );
            ctx.fill();
        }

        // Specular Light Reflection Sweep
        const glossAmount = device ? device.gloss : 0.55;
        if (glossAmount > 0) {
            const sweepOffset =
                (rotYDeg - light.position.x * 45) * 0.01 +
                evalLayer.shimmerProgress * 0.6;
            const glossGrad = ctx.createLinearGradient(
                -baseW / 2,
                -baseH / 2,
                baseW / 2,
                baseH / 2
            );
            const mid = Math.max(0.15, Math.min(0.85, 0.5 + sweepOffset));
            glossGrad.addColorStop(Math.max(0, mid - 0.2), 'rgba(255,255,255,0)');
            glossGrad.addColorStop(
                mid,
                kelvinToRgb(light.temperature, 0.22 * glossAmount * light.intensity).css
            );
            glossGrad.addColorStop(Math.min(1, mid + 0.2), 'rgba(255,255,255,0)');
            ctx.fillStyle = glossGrad;
            ctx.fillRect(screenX, screenY, screenW, screenH);
        }

        ctx.restore();

        // MacBook Protruding Aluminum Keyboard Base Deck
        if (device?.type === 'macbook') {
            const deckW = baseW * 1.12;
            const deckH = Math.max(8, baseH * 0.045);
            ctx.fillStyle = isSilver ? '#cbd5e1' : '#334155';
            drawRoundedRectPath(
                ctx,
                -deckW / 2,
                baseH / 2 - 2,
                deckW,
                deckH,
                6
            );
            ctx.fill();
        }
    }

    // ==========================================================================
    // B. SHAPE LAYER (Rectangle, Ellipse, Line, Arrow)
    // ==========================================================================
    else if (layer.kind === 'shape') {
        const shpLayer = layer as ShapeLayer;
        applyLayerShadowOrGlow(
            ctx,
            shpLayer.effects,
            canvasW,
            canvasH,
            bloomMultiplier
        );

        if (shpLayer.shape === 'line' || shpLayer.shape === 'arrow') {
            const strokeColor = shpLayer.stroke?.color || '#a855f7';
            const strokeW = Math.max(
                2,
                (shpLayer.stroke?.width || 0.003) * canvasW
            );
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-baseW / 2 + 8, 0);
            ctx.lineTo(baseW / 2 - 12, 0);
            ctx.stroke();

            if (shpLayer.shape === 'arrow') {
                ctx.fillStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(baseW / 2, 0);
                ctx.lineTo(baseW / 2 - strokeW * 3.2, -strokeW * 1.8);
                ctx.lineTo(baseW / 2 - strokeW * 3.2, strokeW * 1.8);
                ctx.closePath();
                ctx.fill();
            }
        } else {
            const radiusPx =
                shpLayer.shape === 'ellipse'
                    ? Math.min(baseW, baseH) / 2
                    : shpLayer.cornerRadius * Math.min(baseW, baseH) * 0.5;

            ctx.fillStyle = createCanvasFillStyle(
                ctx,
                shpLayer.fill,
                baseW,
                baseH,
                1
            );
            if (shpLayer.shape === 'polygon') {
                const points = shpLayer.points?.length ? shpLayer.points : [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }];
                ctx.beginPath(); points.forEach((pt, i) => { const x = (pt.x - 0.5) * baseW; const y = (pt.y - 0.5) * baseH; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath();
            } else if (shpLayer.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(0, 0, baseW / 2, baseH / 2, 0, 0, Math.PI * 2); }
            else drawRoundedRectPath(ctx, -baseW / 2, -baseH / 2, baseW, baseH, radiusPx);
            ctx.fill();

            if (shpLayer.stroke && shpLayer.stroke.width > 0) {
                clearShadow(ctx);
                ctx.strokeStyle = hexToRgba(
                    shpLayer.stroke.color,
                    shpLayer.stroke.opacity
                );
                ctx.lineWidth = Math.max(1.5, shpLayer.stroke.width * canvasW);
                ctx.stroke();
            }
        }
        clearShadow(ctx);
    }

    // ==========================================================================
    // C. 3D TEXT LAYER
    // ==========================================================================
    else if (layer.kind === 'text') {
        const txtLayer = layer as TextLayer;
        const fontSizePx = Math.max(12, txtLayer.font.size * canvasH);

        applyLayerShadowOrGlow(
            ctx,
            txtLayer.effects,
            canvasW,
            canvasH,
            bloomMultiplier
        );
        ctx.font = `${txtLayer.font.weight} ${Math.round(fontSizePx)}px ${txtLayer.font.family
            }, Inter, sans-serif`;
        ctx.fillStyle = txtLayer.font.color;
        ctx.textAlign = txtLayer.font.align;
        ctx.textBaseline = 'middle';

        const alignX =
            txtLayer.font.align === 'left'
                ? -baseW / 2
                : txtLayer.font.align === 'right'
                    ? baseW / 2
                    : 0;

        ctx.fillText(txtLayer.content, alignX, 0);
        clearShadow(ctx);
    }

    ctx.restore();
}

// Master Canvas Frame Renderer: Draws Background, Light, 3D Layers, and All 10 Scene Effects
export function renderProjectFrameToCanvas(
    ctx: CanvasRenderingContext2D,
    project: Project,
    frame: EvaluatedProjectFrame,
    canvasW: number,
    canvasH: number
): void {
    ctx.save();
    ctx.clearRect(0, 0, canvasW, canvasH);

    // 1. Background (project or per-shot override via useProjectBackground)
    const bg = resolveShotBackground(project, frame.activeShot);
    if (bg.kind === 'solid') {
        ctx.fillStyle = bg.color;
        ctx.fillRect(0, 0, canvasW, canvasH);
    } else if (bg.kind === 'gradient') {
        ctx.fillStyle = createCanvasFillStyle(
            ctx,
            {
                kind: 'gradient',
                angle: bg.angle,
                stops: bg.stops,
            },
            canvasW,
            canvasH,
            1
        );
        ctx.fillRect(0, 0, canvasW, canvasH);
    } else if (bg.kind === 'image') {
        const asset = project.assets[bg.assetId];
        if (asset?.dataUrl) {
            const img = imageElementCache.get(asset.dataUrl);
            if (img && img.complete) {
                const imgW = img.naturalWidth || img.width;
                const imgH = img.naturalHeight || img.height;
                if (imgW > 0 && imgH > 0) {
                    const canvasAspect = canvasW / canvasH;
                    const imgAspect = imgW / imgH;
                    let sx = 0;
                    let sy = 0;
                    let sw = imgW;
                    let sh = imgH;
                    if (imgAspect > canvasAspect) {
                        sw = imgH * canvasAspect;
                        sx = (imgW - sw) / 2;
                    } else {
                        sh = imgW / canvasAspect;
                        sy = (imgH - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
                } else {
                    ctx.drawImage(img, 0, 0, canvasW, canvasH);
                }
            } else {
                ctx.fillStyle = '#0a0a0c';
                ctx.fillRect(0, 0, canvasW, canvasH);
            }
        } else {
            ctx.fillStyle = '#0a0a0c';
            ctx.fillRect(0, 0, canvasW, canvasH);
        }
    } else {
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 2. Scene Key Light & Ambient Fill
    const { light } = frame.activeShot;
    const lx = (0.5 + light.position.x) * canvasW;
    const ly = (0.5 - light.position.y) * canvasH;
    const lightGrad = ctx.createRadialGradient(
        lx,
        ly,
        10,
        lx,
        ly,
        Math.max(canvasW, canvasH) * 0.72
    );
    lightGrad.addColorStop(
        0,
        kelvinToRgb(light.temperature, Math.min(0.8, 0.28 * light.intensity)).css
    );
    lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 3. Shot Transition Compositing (Crossfade / Slide / Push)
    const transType = frame.shotTransition.type;
    const transProgress = frame.shotTransition.progress;
    const outgoing = frame.shotTransition.outgoingFrame;

    let outgoingOpacity = 1;
    let outgoingSlideX = 0;
    let incomingOpacity = 1;
    let incomingSlideX = 0;

    if (outgoing && transProgress < 1) {
        if (transType === 'crossfade') {
            outgoingOpacity = 1 - transProgress;
            incomingOpacity = transProgress;
        } else if (transType === 'push') {
            outgoingSlideX = -transProgress * canvasW;
            incomingSlideX = (1 - transProgress) * canvasW;
        } else if (transType === 'slide') {
            outgoingSlideX = -transProgress * canvasW * 0.25;
            incomingSlideX = (1 - transProgress) * canvasW;
        }

        // Draw Outgoing Scene Frame underneath
        ctx.save();
        ctx.globalAlpha = outgoingOpacity;
        if (outgoingSlideX !== 0) ctx.translate(outgoingSlideX, 0);
        for (const outLayer of outgoing.layers) {
            drawLayerOnCanvas(ctx, outLayer, project, outgoing, canvasW, canvasH);
        }
        ctx.restore();
    } else {
        incomingOpacity = transType === 'crossfade' ? transProgress : 1;
        incomingSlideX =
            transType === 'slide' || transType === 'push'
                ? (1 - transProgress) * canvasW * 0.25
                : 0;
    }

    ctx.save();
    ctx.globalAlpha = incomingOpacity;
    if (incomingSlideX !== 0) ctx.translate(incomingSlideX, 0);

    // 4. Ghost Echo Pass (if Ghost Effect is enabled)
    const eff = frame.effects.state;
    if (eff.ghost.enabled && eff.ghost.opacity > 0) {
        ctx.save();
        ctx.translate(eff.ghost.offset * canvasW, -eff.ghost.offset * canvasH * 0.5);
        for (const evalLayer of frame.layers) {
            drawLayerOnCanvas(
                ctx,
                {
                    ...evalLayer,
                    opacity: evalLayer.opacity * eff.ghost.opacity,
                    totalBlurPx: evalLayer.totalBlurPx + eff.ghost.blur,
                },
                project,
                frame,
                canvasW,
                canvasH
            );
        }
        ctx.restore();
    }

    // 5. Render All 3D Layers (Sorted Back-to-Front)
    for (const evalLayer of frame.layers) {
        drawLayerOnCanvas(ctx, evalLayer, project, frame, canvasW, canvasH);
    }
    ctx.restore();

    // 6. Vignette Pass
    if (eff.vignette.enabled && eff.vignette.intensity > 0) {
        const vigGrad = ctx.createRadialGradient(
            canvasW / 2,
            canvasH / 2,
            Math.min(canvasW, canvasH) * 0.28,
            canvasW / 2,
            canvasH / 2,
            Math.hypot(canvasW, canvasH) * 0.55
        );
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(
            1,
            `rgba(0,0,0,${Math.min(0.92, eff.vignette.intensity * 0.9)})`
        );
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 7. Deterministic Film Grain Pass (Driven by frame.effects.deterministicSeed)
    if (eff.filmGrain.enabled && eff.filmGrain.intensity > 0) {
        const grainAlpha = Math.min(0.25, eff.filmGrain.intensity * 1.4);
        ctx.fillStyle = `rgba(255,255,255,${grainAlpha.toFixed(3)})`;
        let seed = Math.floor(frame.effects.deterministicSeed * 100000) + 1;
        const dotsCount = Math.min(1800, Math.round((canvasW * canvasH) / 700));
        const dotSize = Math.max(1, eff.filmGrain.size);
        for (let i = 0; i < dotsCount; i++) {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            const gx = (seed / 4294967296) * canvasW;
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            const gy = (seed / 4294967296) * canvasH;
            ctx.fillRect(gx, gy, dotSize, dotSize);
        }
    }

    // 8. Glitch Scanline Pass
    if (eff.glitch.enabled && eff.glitch.intensity > 0) {
        const slices = Math.max(2, Math.round(eff.glitch.intensity * 10));
        for (let i = 0; i < slices; i++) {
            const sy = ((i * 97 + frame.frameNumber * 31) % 100) * 0.01 * canvasH;
            const sh = Math.max(4, canvasH * 0.02);
            const shiftX =
                ((i % 2 === 0 ? 1 : -1) * eff.glitch.intensity * canvasW) * 0.03;
            ctx.fillStyle =
                i % 2 === 0 ? 'rgba(244,63,94,0.18)' : 'rgba(56,189,248,0.18)';
            ctx.fillRect(shiftX, sy, canvasW, sh);
        }
    }

    ctx.restore();
}
import * as THREE from 'three';

/**
 * Creates a rounded rectangle Shape in Three.js centered at (0, 0)
 */
function createRoundedRectShape(
    width: number,
    height: number,
    radius: number
): THREE.Shape {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const r = Math.max(0.001, Math.min(radius, width / 2, height / 2));

    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(
        x + width,
        y + height,
        x + width - r,
        y + height
    );
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    return shape;
}

/**
 * Creates a ShapeGeometry whose UV coordinates are normalized to [0..1]
 * so CanvasTextures map cleanly across rounded media layers.
 */
export function createNormalizedRoundedGeometry(
    width: number,
    height: number,
    radius: number
): THREE.ShapeGeometry {
    const shape = createRoundedRectShape(width, height, radius);
    const geom = new THREE.ShapeGeometry(shape, 64);
    const pos = geom.attributes.position;
    const uvs = new Float32Array(pos.count * 2);

    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        uvs[i * 2] = (vx + width / 2) / Math.max(0.0001, width);
        uvs[i * 2 + 1] = (vy + height / 2) / Math.max(0.0001, height);
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geom;
}

export function drawStudioPlaceholder(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    layerName: string,
    blurPx: number = 0,
    pixelRatio: number = 1
): void {
    ctx.save();
    if (blurPx > 0) {
        ctx.filter = `blur(${Math.min(24, blurPx) * pixelRatio}px)`;
    }

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.55, '#1e1b4b');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const pad = w * 0.05;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(pad, pad * 1.4, w * 0.56, h - pad * 2.6, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(18, Math.round(h * 0.075))}px Inter, sans-serif`;
    ctx.fillText('$148,920.00', pad * 1.6, h * 0.34);

    ctx.fillStyle = '#38bdf8';
    ctx.font = `600 ${Math.max(13, Math.round(h * 0.042))}px Inter, sans-serif`;
    ctx.fillText(layerName || 'Pasted image', pad * 1.6, h * 0.44);

    const bars = [0.35, 0.52, 0.44, 0.7, 0.62, 0.86, 0.75, 0.95];
    const chartX = pad * 1.6;
    const chartY = h * 0.54;
    const chartW = w * 0.46;
    const chartH = h * 0.26;
    const barW = chartW / (bars.length * 1.35);

    bars.forEach((b, i) => {
        const bh = chartH * b;
        const bx = chartX + i * barW * 1.35;
        const by = chartY + (chartH - bh);
        ctx.fillStyle = '#0088ff';
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, bh, 4);
        ctx.fill();
    });

    ctx.restore();
}

export function getLayerBlurBleedLayout(
    canvasW: number,
    canvasH: number,
    totalBlurPx: number,
    dofBlurPx: number,
    motionBlur?: { x: number; y: number },
    deviceFramed = false,
    effectPaddingPx = 0
) {
    const motionDistPx = motionBlur ? Math.hypot(motionBlur.x * canvasW, motionBlur.y * canvasH) : 0;
    const effectiveBlurPx = totalBlurPx + dofBlurPx * 1.5 + motionDistPx + effectPaddingPx;
    const paddingLimit = Math.max(256, Math.ceil(effectPaddingPx));
    const blurPadding = (!deviceFramed && effectiveBlurPx > 0.1)
        ? Math.min(paddingLimit, Math.ceil(effectiveBlurPx * 3))
        : 0;
    const paddedCanvasW = canvasW + blurPadding * 2;
    const paddedCanvasH = canvasH + blurPadding * 2;
    const widthScale = paddedCanvasW / canvasW;
    const heightScale = paddedCanvasH / canvasH;
    return {
        blurPadding,
        paddedCanvasW,
        paddedCanvasH,
        widthScale,
        heightScale,
    };
}

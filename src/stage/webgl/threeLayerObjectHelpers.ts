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

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const iconSize = Math.min(48, Math.min(w, h) * 0.2);
    const cx = w / 2;
    const cy = h / 2 - (layerName ? 10 : 0);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize, 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx - iconSize * 0.2, cy - iconSize * 0.15, iconSize * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - iconSize * 0.35, cy + iconSize * 0.35);
    ctx.lineTo(cx - iconSize * 0.05, cy);
    ctx.lineTo(cx + iconSize * 0.15, cy + iconSize * 0.2);
    ctx.lineTo(cx + iconSize * 0.35, cy + iconSize * 0.35);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    if (layerName) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = `500 ${Math.max(11, Math.round(h * 0.035))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(layerName, cx, cy + iconSize * 0.75);
    }

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

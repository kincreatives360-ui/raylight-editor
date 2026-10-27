import type { Layer, Project, AnimationBlockSettings } from '../../model/types';

/** The caller draws into an isolated layer surface; source-atop preserves glyph/shape alpha. */
export function drawMediaShimmer(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, progress: number, settings?: AnimationBlockSettings) {
    if (!(progress > 0 && progress < 1)) return;
    const direction = settings?.direction ?? 'right';
    const vertical = direction === 'up' || direction === 'down';
    const reverse = direction === 'left' || direction === 'up';
    const length = vertical ? canvasH : canvasW;
    const halfWidth = Math.max(.001, settings?.width ?? .18) * length / 2;
    const center = (reverse ? 1 - progress : progress) * (length + halfWidth * 2) - halfWidth;
    const gradient = ctx.createLinearGradient(vertical ? 0 : center - halfWidth, vertical ? center - halfWidth : 0, vertical ? 0 : center + halfWidth, vertical ? center + halfWidth : 0);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(.5, settings?.color ?? '#ffffff');
    gradient.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.max(0, Math.min(1, (settings?.intensity ?? 1) * .35));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
}

export function applyTextureMask(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, layer: Layer, project: Project) {
        // Alpha-mask compositing: shape layers can mask any image, text, or shape layer.
        // The mask is evaluated in the target layer's local UV space so it stays attached
        // while the target moves/animates. Only visible shape geometry is used as alpha.
        if (layer.maskLayerId) {
            const mask = project.shots.flatMap((shot) => shot.layers).find((candidate) => candidate.id === layer.maskLayerId);
            if (mask?.kind === 'shape') {
                const maskCtx = ctx;
                if (maskCtx) {
                    maskCtx.save();
                    maskCtx.globalCompositeOperation = 'destination-in';
                    maskCtx.globalAlpha = 1;
                    maskCtx.fillStyle = '#fff';
                    maskCtx.strokeStyle = '#fff';
                    maskCtx.lineWidth = Math.max(6, canvasH * 0.18);
                    maskCtx.beginPath();
                    if (mask.shape === 'ellipse') {
                        maskCtx.ellipse(canvasW / 2, canvasH / 2, canvasW / 2, canvasH / 2, 0, 0, Math.PI * 2);
                    } else if (mask.shape === 'line' || mask.shape === 'arrow') {
                        maskCtx.moveTo(0, canvasH / 2); maskCtx.lineTo(canvasW, canvasH / 2);
                        if (mask.shape === 'arrow') { maskCtx.moveTo(canvasW, canvasH / 2); maskCtx.lineTo(canvasW * 0.82, canvasH * 0.32); maskCtx.moveTo(canvasW, canvasH / 2); maskCtx.lineTo(canvasW * 0.82, canvasH * 0.68); }
                    } else if (mask.shape === 'polygon') {
                        const points = mask.points?.length ? mask.points : [{x:0.5,y:0},{x:1,y:0.5},{x:0.5,y:1},{x:0,y:0.5}];
                        points.forEach((pt, i) => { const x = pt.x * canvasW; const y = pt.y * canvasH; if (i === 0) maskCtx.moveTo(x,y); else maskCtx.lineTo(x,y); }); maskCtx.closePath();
                    } else {
                        const r = Math.max(0, (mask.cornerRadius || 0) * Math.min(canvasW, canvasH) * 0.5);
                        maskCtx.roundRect(0, 0, canvasW, canvasH, r);
                    }
                    if (mask.shape === 'line' || mask.shape === 'arrow') maskCtx.stroke(); else maskCtx.fill();
                    maskCtx.restore();
                }
            }
        }

}

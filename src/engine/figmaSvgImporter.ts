// src/engine/figmaSvgImporter.ts
import type {
    Layer,
    AssetRecord,
    ImageLayer,
    ShapeLayer,
    TextLayer,
} from '../model/types';
import {
    createDefaultImageLayer,
    createDefaultShapeLayer,
    createDefaultTextLayer,
} from '../model/defaults';

export interface FigmaImportResult {
    layers: Layer[];
    assets: Record<string, AssetRecord>;
}

// Reads an image file, extracts its natural width/height, and generates a lightweight thumbnail
export function readImageFileWithThumbnail(
    file: File
): Promise<AssetRecord> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.onload = () => {
            const dataUrl = String(reader.result);
            const img = new Image();
            img.onerror = () => reject(new Error(`Unable to decode image: ${file.name || 'image'}`));
            img.onload = () => {
                const natW = img.naturalWidth || img.width;
                const natH = img.naturalHeight || img.height;
                if (!Number.isFinite(natW) || !Number.isFinite(natH) || natW <= 0 || natH <= 0) {
                    reject(new Error(`Image has invalid dimensions: ${file.name || 'image'}`));
                    return;
                }

                // Generate a small 240px wide thumbnail for fast sidebar rendering
                let thumbUrl = dataUrl;
                try {
                    const thumbCanvas = document.createElement('canvas');
                    const scale = Math.min(1, 240 / natW);
                    thumbCanvas.width = Math.max(1, Math.round(natW * scale));
                    thumbCanvas.height = Math.max(1, Math.round(natH * scale));
                    const ctx = thumbCanvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
                        thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.8);
                    }
                } catch {
                    thumbUrl = dataUrl;
                }

                resolve({
                    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: file.name || 'Pasted image',
                    mimeType: file.type || 'image/png',
                    dataUrl,
                    thumbUrl,
                    width: natW,
                    height: natH,
                });
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
}

function parseNumericAttr(
    el: Element,
    attr: string,
    fallback = 0
): number {
    const raw = el.getAttribute(attr);
    if (!raw) return fallback;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

// Parses a Figma "Copy as SVG" string into separate editable Text, Shape, and Image layers
export function parseFigmaSvgToLayers(
    svgText: string,
    shotDurationMs: number,
    startingOrder: number
): FigmaImportResult {
    if (typeof DOMParser === 'undefined') {
        return { layers: [], assets: {} };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');

    if (!svgEl) {
        return { layers: [], assets: {} };
    }

    // Determine root SVG artboard dimensions from viewBox or width/height
    let boardW = parseNumericAttr(svgEl, 'width', 1200);
    let boardH = parseNumericAttr(svgEl, 'height', 800);
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
        const parts = viewBox
            .trim()
            .split(/[\s,]+/)
            .map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            boardW = parts[2];
            boardH = parts[3];
        }
    }
    boardW = Math.max(1, boardW || 1200);
    boardH = Math.max(1, boardH || 800);

    const layers: Layer[] = [];
    const assets: Record<string, AssetRecord> = {};
    let orderCounter = startingOrder;
    let zDepthCursor = 0;

    // Map any <linearGradient> definitions inside <defs>
    const gradientsMap: Record<
        string,
        { angle: number; stops: { at: number; color: string }[] }
    > = {};
    doc.querySelectorAll('linearGradient').forEach((gradEl) => {
        const id = gradEl.getAttribute('id');
        if (!id) return;
        const stops: { at: number; color: string }[] = [];
        gradEl.querySelectorAll('stop').forEach((stopEl, idx, arr) => {
            const offsetRaw = stopEl.getAttribute('offset') || `${idx / Math.max(1, arr.length - 1)}`;
            const at = offsetRaw.endsWith('%')
                ? parseFloat(offsetRaw) / 100
                : parseFloat(offsetRaw);
            const color =
                stopEl.getAttribute('stop-color') || '#6366f1';
            stops.push({
                at: Math.max(0, Math.min(1, Number.isFinite(at) ? at : 0)),
                color,
            });
        });
        if (stops.length >= 2) {
            gradientsMap[id] = { angle: 135, stops };
        }
    });

    // Walk direct & nested children of the SVG
    const candidates = Array.from(
        svgEl.querySelectorAll('rect, circle, ellipse, line, text, image, path')
    );

    for (const el of candidates) {
        // Skip elements inside <defs>, <clipPath>, or <mask>
        if (el.closest('defs, clipPath, mask, pattern')) continue;

        const tag = el.tagName.toLowerCase();
        const rawName =
            el.getAttribute('id') ||
            el.parentElement?.getAttribute('id') ||
            `Figma ${tag.charAt(0).toUpperCase() + tag.slice(1)}`;

        // 1. <rect> -> ShapeLayer (rectangle)
        if (tag === 'rect') {
            const x = parseNumericAttr(el, 'x', 0);
            const y = parseNumericAttr(el, 'y', 0);
            const w = parseNumericAttr(el, 'width', 0);
            const h = parseNumericAttr(el, 'height', 0);
            if (w <= 2 || h <= 2) continue;

            // Skip full-bleed background rect if it covers 99% of the artboard at (0,0)
            if (x === 0 && y === 0 && w >= boardW * 0.98 && h >= boardH * 0.98 && candidates.length > 1) {
                continue;
            }

            const rx = parseNumericAttr(el, 'rx', 0);
            const fillAttr = el.getAttribute('fill') || '#1e293b';
            const opacity = parseNumericAttr(el, 'opacity', 1);
            const fillOpacity = parseNumericAttr(el, 'fill-opacity', 1);

            let fill: ShapeLayer['fill'] = {
                kind: 'solid',
                color: fillAttr.startsWith('#') ? fillAttr : '#1e293b',
                opacity: fillOpacity,
            };

            if (fillAttr.startsWith('url(#')) {
                const gradId = fillAttr.slice(5, -1);
                if (gradientsMap[gradId]) {
                    fill = {
                        kind: 'gradient',
                        angle: gradientsMap[gradId].angle,
                        stops: gradientsMap[gradId].stops,
                    };
                }
            }

            const strokeColor = el.getAttribute('stroke');
            const strokeWidth = parseNumericAttr(el, 'stroke-width', 1);

            const centerXFrac = (x + w / 2) / boardW - 0.5;
            const centerYFrac = (y + h / 2) / boardH - 0.5;
            const widthFrac = Math.min(1, w / boardW);
            const heightFrac = Math.min(1, h / boardH);
            const cornerRadius = Math.min(0.5, rx / Math.max(1, Math.min(w, h) * 0.5));

            const shapeLayer = createDefaultShapeLayer({
                name: rawName,
                shape: 'rectangle',
                order: orderCounter++,
                outMs: shotDurationMs,
                position: {
                    x: Number(centerXFrac.toFixed(4)),
                    y: Number(centerYFrac.toFixed(4)),
                    z: Number(zDepthCursor.toFixed(3)),
                },
                rotation: { x: 0, y: 0, z: 0 },
                size: {
                    width: Number(widthFrac.toFixed(4)),
                    height: Number(heightFrac.toFixed(4)),
                },
                opacity,
                cornerRadius: Number(cornerRadius.toFixed(3)),
                fill,
                stroke: strokeColor
                    ? {
                        color: strokeColor,
                        width: Number((strokeWidth / boardW).toFixed(4)),
                        opacity: 1,
                    }
                    : undefined,
            });

            layers.push(shapeLayer);
            zDepthCursor += 0.04;
        }

        // 2. <circle> or <ellipse> -> ShapeLayer (ellipse)
        else if (tag === 'circle' || tag === 'ellipse') {
            const cx = parseNumericAttr(el, 'cx', boardW / 2);
            const cy = parseNumericAttr(el, 'cy', boardH / 2);
            const rx =
                tag === 'circle'
                    ? parseNumericAttr(el, 'r', 40)
                    : parseNumericAttr(el, 'rx', 40);
            const ry =
                tag === 'circle'
                    ? parseNumericAttr(el, 'r', 40)
                    : parseNumericAttr(el, 'ry', 40);

            const fillAttr = el.getAttribute('fill') || '#6366f1';
            const centerXFrac = cx / boardW - 0.5;
            const centerYFrac = cy / boardH - 0.5;

            const ellipseLayer = createDefaultShapeLayer({
                name: rawName,
                shape: 'ellipse',
                order: orderCounter++,
                outMs: shotDurationMs,
                position: {
                    x: Number(centerXFrac.toFixed(4)),
                    y: Number(centerYFrac.toFixed(4)),
                    z: Number(zDepthCursor.toFixed(3)),
                },
                rotation: { x: 0, y: 0, z: 0 },
                size: {
                    width: Number(((rx * 2) / boardW).toFixed(4)),
                    height: Number(((ry * 2) / boardH).toFixed(4)),
                },
                fill: {
                    kind: 'solid',
                    color: fillAttr.startsWith('#') ? fillAttr : '#6366f1',
                    opacity: 1,
                },
            });

            layers.push(ellipseLayer);
            zDepthCursor += 0.04;
        }

        // 3. <line> -> ShapeLayer (line)
        else if (tag === 'line') {
            const x1 = parseNumericAttr(el, 'x1', 0);
            const y1 = parseNumericAttr(el, 'y1', 0);
            const x2 = parseNumericAttr(el, 'x2', 100);
            const y2 = parseNumericAttr(el, 'y2', 0);
            const strokeColor = el.getAttribute('stroke') || '#94a3b8';

            const minX = Math.min(x1, x2);
            const minY = Math.min(y1, y2);
            const w = Math.max(20, Math.abs(x2 - x1));
            const h = Math.max(12, Math.abs(y2 - y1));

            const lineLayer = createDefaultShapeLayer({
                name: rawName,
                shape: 'line',
                order: orderCounter++,
                outMs: shotDurationMs,
                position: {
                    x: Number(((minX + w / 2) / boardW - 0.5).toFixed(4)),
                    y: Number(((minY + h / 2) / boardH - 0.5).toFixed(4)),
                    z: Number(zDepthCursor.toFixed(3)),
                },
                rotation: { x: 0, y: 0, z: 0 },
                size: {
                    width: Number((w / boardW).toFixed(4)),
                    height: Number((h / boardH).toFixed(4)),
                },
                stroke: { color: strokeColor, width: 0.003, opacity: 1 },
            });

            layers.push(lineLayer);
            zDepthCursor += 0.04;
        }

        // 4. <text> -> Editable 3D TextLayer
        else if (tag === 'text') {
            const content = (el.textContent || '').trim();
            if (!content) continue;

            const x = parseNumericAttr(el, 'x', boardW / 2);
            const y = parseNumericAttr(el, 'y', boardH / 2);
            const fontSizePx = parseNumericAttr(el, 'font-size', 32);
            const fontWeightRaw = el.getAttribute('font-weight') || '700';
            const weight =
                fontWeightRaw === 'bold'
                    ? 700
                    : Number.isFinite(parseInt(fontWeightRaw, 10))
                        ? parseInt(fontWeightRaw, 10)
                        : 600;
            const fill = el.getAttribute('fill') || '#ffffff';
            const anchor = el.getAttribute('text-anchor');
            const align: TextLayer['font']['align'] =
                anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';

            const estWidthFrac = Math.min(
                0.9,
                Math.max(0.22, (content.length * fontSizePx * 0.6) / boardW)
            );
            const centerXFrac =
                align === 'center'
                    ? x / boardW - 0.5
                    : x / boardW - 0.5 + estWidthFrac / 2;
            const centerYFrac = (y - fontSizePx * 0.35) / boardH - 0.5;

            const textLayer = createDefaultTextLayer({
                name: content.slice(0, 24),
                content,
                order: orderCounter++,
                outMs: shotDurationMs,
                position: {
                    x: Number(centerXFrac.toFixed(4)),
                    y: Number(centerYFrac.toFixed(4)),
                    z: Number((zDepthCursor + 0.06).toFixed(3)),
                },
                rotation: { x: 0, y: 0, z: 0 },
                maxWidth: Number(estWidthFrac.toFixed(3)),
                font: {
                    family: 'Inter',
                    size: Number(Math.max(0.018, Math.min(0.12, fontSizePx / boardH)).toFixed(4)),
                    weight,
                    color: fill.startsWith('#') ? fill : '#ffffff',
                    align,
                    letterSpacing: -0.01,
                },
            });

            layers.push(textLayer);
            zDepthCursor += 0.04;
        }

        // 5. <image> -> ImageLayer
        else if (tag === 'image') {
            const href =
                el.getAttribute('href') || el.getAttribute('xlink:href') || '';
            if (!href) continue;

            const x = parseNumericAttr(el, 'x', 0);
            const y = parseNumericAttr(el, 'y', 0);
            const w = parseNumericAttr(el, 'width', boardW * 0.5);
            const h = parseNumericAttr(el, 'height', boardH * 0.5);

            const assetId = `asset-figma-${Date.now()}-${orderCounter}`;
            assets[assetId] = {
                id: assetId,
                name: rawName,
                mimeType: 'image/png',
                dataUrl: href,
                thumbUrl: href,
                width: w,
                height: h,
            };

            const imgLayer: ImageLayer = createDefaultImageLayer({
                name: rawName,
                assetId,
                order: orderCounter++,
                outMs: shotDurationMs,
                position: {
                    x: Number(((x + w / 2) / boardW - 0.5).toFixed(4)),
                    y: Number(((y + h / 2) / boardH - 0.5).toFixed(4)),
                    z: Number(zDepthCursor.toFixed(3)),
                },
                rotation: { x: 0, y: 0, z: 0 },
                size: {
                    width: Number((w / boardW).toFixed(4)),
                    height: Number((h / boardH).toFixed(4)),
                },
                device: undefined, // Land flat when pasted from Figma
            });

            layers.push(imgLayer);
            zDepthCursor += 0.04;
        }
    }

    // Fallback: if the SVG was purely custom <path> artwork with no rects/text,
    // import the whole SVG as a crisp vector ImageLayer
    if (layers.length === 0) {
        const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
        const assetId = `asset-svg-${Date.now()}`;
        assets[assetId] = {
            id: assetId,
            name: 'Pasted Figma Vector.svg',
            mimeType: 'image/svg+xml',
            dataUrl: encoded,
            thumbUrl: encoded,
            width: boardW,
            height: boardH,
        };

        layers.push(
            createDefaultImageLayer({
                name: 'Pasted Figma Vector',
                assetId,
                order: startingOrder,
                outMs: shotDurationMs,
                position: { x: 0, y: 0, z: 0.1 },
                rotation: { x: 0, y: 0, z: 0 },
                size: { width: 0.55, height: 0.55 },
                device: undefined,
            })
        );
    }

    return { layers, assets };
}


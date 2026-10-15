// src/stage/Stage.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
    ZoomIn,
    ZoomOut,
    RotateCcw,
    UploadCloud,
    Copy,
    Trash2,
    FolderPlus,
    FolderMinus,
    ChevronsUp,
    ChevronsDown,
    ChevronUp,
    ChevronDown,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Type,
    Square,
    Circle,
    Layers,
    Sparkles,
} from 'lucide-react';
import type { AspectRatio, Project } from '../model/types';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { readImageFileWithThumbnail, parseFigmaSvgToLayers } from '../engine/figmaSvgImporter';
import { SelectionOverlay } from './SelectionOverlay';
import { Guides, type SnapGuideLine } from './Guides';
import { CanvasToolbar } from './CanvasToolbar';
import { ViewportCanvas } from './webgl/ViewportCanvas';

export const ASPECT_RATIO_CONFIG: Record<
    AspectRatio,
    { widthRatio: number; heightRatio: number; label: string }
> = {
    '16:9': { widthRatio: 16, heightRatio: 9, label: '16:9 Widescreen' },
    '4:3': { widthRatio: 4, heightRatio: 3, label: '4:3 Classic' },
    '3:2': { widthRatio: 3, heightRatio: 2, label: '3:2 Presentation' },
    '21:9': { widthRatio: 21, heightRatio: 9, label: '21:9 Ultrawide' },
    '1:1': { widthRatio: 1, heightRatio: 1, label: '1:1 Square' },
    '9:16': { widthRatio: 9, heightRatio: 16, label: '9:16 Vertical' },
    '3:4': { widthRatio: 3, heightRatio: 4, label: '3:4 Portrait' },
    '2:3': { widthRatio: 2, heightRatio: 3, label: '2:3 Social' },
    '4:5': { widthRatio: 4, heightRatio: 5, label: '4:5 Feed' },
};

export function kelvinToRgb(
    kelvin: number,
    alpha = 1
): { r: number; g: number; b: number; css: string } {
    const temp = Math.max(1000, Math.min(15000, kelvin)) / 100;
    let r: number;
    let g: number;
    let b: number;

    if (temp <= 66) {
        r = 255;
        g = 99.4708025861 * Math.log(temp) - 161.1195681661;
        b =
            temp <= 19
                ? 0
                : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
        r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
        b = 255;
    }

    const clampByte = (n: number) => Math.round(Math.max(0, Math.min(255, n)));
    const rByte = clampByte(r);
    const gByte = clampByte(g);
    const bByte = clampByte(b);

    return {
        r: rByte,
        g: gByte,
        b: bByte,
        css: `rgba(${rByte}, ${gByte}, ${bByte}, ${alpha})`,
    };
}

interface StageProps {
    project: Project;
    frame: EvaluatedProjectFrame;
    selectedLayerIds: string[];
    onSelectLayer: (layerId: string, multiSelect?: boolean) => void;
    showSafeArea?: boolean;
    snapEnabled?: boolean;
    onOpenTemplatesModal?: () => void;
    onUploadClick?: () => void;
    onPasteFigmaSample?: () => void;
}

export const Stage: React.FC<StageProps> = ({
    project,
    frame,
    selectedLayerIds,
    onSelectLayer,
    showSafeArea = true,
    snapEnabled = true,
    onOpenTemplatesModal,
    onUploadClick,
    onPasteFigmaSample,
}) => {
    const {
        addLayerToShot,
        updateShot,
        updateProject,
        addMultipleLayersToShot,
        deleteLayerFromShot,
        duplicateLayerInShot,
        restackLayerInShot,
        updateLayer,
        createGroupFromLayers,
        ungroupInShot,
    } = useProjectStore();
    const {
        activeTool,
        isAnimateMode,
        inspectorTab,
        canvasZoom,
        canvasPan,
        selectLayer,
        setSelectedLayerIds,
        setActiveTool,
        setCanvasZoom,
        setCanvasPan,
        resetCanvasView,
        clearLayerSelection,
    } = useSelectionStore();

    const containerRef = useRef<HTMLDivElement | null>(null);
    const stageFrameRef = useRef<HTMLDivElement | null>(null);

    const [viewportSize, setViewportSize] = useState({ width: 880, height: 540 });
    const [activeGuides, setActiveGuides] = useState<SnapGuideLine[]>([]);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        layerId: string | null;
    } | null>(null);
    const [drawBox, setDrawBox] = useState<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);

    // Dismiss context menu on click outside or Escape
    useEffect(() => {
        if (!contextMenu) return;
        const handleDismiss = () => setContextMenu(null);
        window.addEventListener('click', handleDismiss);
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('click', handleDismiss);
            window.removeEventListener('keydown', handleKey);
        };
    }, [contextMenu]);

    const handleLightPinMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const frameRect = stageFrameRef.current?.getBoundingClientRect();
        if (!frameRect) return;

        const onMove = (moveEv: MouseEvent) => {
            const relX = (moveEv.clientX - frameRect.left) / frameRect.width;
            const relY = (moveEv.clientY - frameRect.top) / frameRect.height;
            const posX = Math.max(-1, Math.min(1, Number((relX - 0.5).toFixed(2))));
            const posY = Math.max(-1, Math.min(1, Number((0.5 - relY).toFixed(2))));
            updateShot(frame.activeShot.id, (shot) => ({
                ...shot,
                light: {
                    ...shot.light,
                    position: { ...shot.light.position, x: posX, y: posY },
                },
            }));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            setViewportSize({
                width: Math.max(240, entry.contentRect.width - 96),
                height: Math.max(200, entry.contentRect.height - 110),
            });
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Track Spacebar hold for temporary Hand panning
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'Space') setIsSpaceHeld(true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpaceHeld(false);
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // Wheel handler: Cmd/Ctrl + Scroll (or pinch) zooms; plain scroll pans
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
                const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
                setCanvasZoom((prev) => prev * zoomFactor);
            } else {
                setCanvasPan((prev) => ({
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY,
                }));
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [setCanvasZoom, setCanvasPan]);

    const ratioSpec = ASPECT_RATIO_CONFIG[project.aspectRatio];
    const targetAspect = ratioSpec.widthRatio / ratioSpec.heightRatio;
    const availableAspect = viewportSize.width / viewportSize.height;

    let frameWidth: number;
    let frameHeight: number;

    if (availableAspect > targetAspect) {
        frameHeight = viewportSize.height;
        frameWidth = Math.round(frameHeight * targetAspect);
    } else {
        frameWidth = viewportSize.width;
        frameHeight = Math.round(frameWidth / targetAspect);
    }

    const { light } = frame.activeShot;
    const lightScreenX = (0.5 + light.position.x) * 100;
    const lightScreenY = (0.5 - light.position.y) * 100;

    const eff = frame.effects.state;
    const colorGradeCss = eff.colorGrade.enabled
        ? `brightness(${eff.colorGrade.exposure}) contrast(${eff.colorGrade.contrast}) saturate(${eff.colorGrade.saturation})`
        : undefined;

    const isCreationTool = ['text', 'image', 'rectangle', 'ellipse', 'line'].includes(
        activeTool
    );

    // ============================================================================
    // WORKSPACE MOUSE DOWN: Hand Pan, Click-and-Drag Layer Creation, or Deselect
    // ============================================================================
    const handleWorkspaceMouseDown = (e: React.MouseEvent) => {
        // 1. Hand Tool or Spacebar held or Middle-Click -> Pan Canvas
        if (activeTool === 'hand' || isSpaceHeld || e.button === 1) {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const initPan = { ...canvasPan };

            const onMove = (moveEv: MouseEvent) => {
                setCanvasPan({
                    x: initPan.x + (moveEv.clientX - startX),
                    y: initPan.y + (moveEv.clientY - startY),
                });
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return;
        }

        // 2. Creation Tools (T, I, R, O, L): Click or Drag to Draw on Stage
        if (isCreationTool && stageFrameRef.current) {
            e.preventDefault();
            e.stopPropagation();
            const rect = stageFrameRef.current.getBoundingClientRect();
            const startX = (e.clientX - rect.left) / canvasZoom;
            const startY = (e.clientY - rect.top) / canvasZoom;

            setDrawBox({ x: startX, y: startY, w: 0, h: 0 });

            let latestBox = { x: startX, y: startY, w: 0, h: 0 };

            const onMove = (moveEv: MouseEvent) => {
                const curX = (moveEv.clientX - rect.left) / canvasZoom;
                const curY = (moveEv.clientY - rect.top) / canvasZoom;
                latestBox = {
                    x: Math.min(startX, curX),
                    y: Math.min(startY, curY),
                    w: Math.abs(curX - startX),
                    h: Math.abs(curY - startY),
                };
                setDrawBox(latestBox);
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                setDrawBox(null);

                const draggedEnough = latestBox.w > 16 || latestBox.h > 16;
                const centerX2D = draggedEnough
                    ? latestBox.x + latestBox.w / 2
                    : startX;
                const centerY2D = draggedEnough
                    ? latestBox.y + latestBox.h / 2
                    : startY;

                const fracX = Number((centerX2D / frameWidth - 0.5).toFixed(4));
                const fracY = Number((centerY2D / frameHeight - 0.5).toFixed(4));
                const fracW = draggedEnough
                    ? Number(Math.max(0.08, latestBox.w / frameWidth).toFixed(4))
                    : undefined;
                const fracH = draggedEnough
                    ? Number(Math.max(0.04, latestBox.h / frameHeight).toFixed(4))
                    : undefined;

                let created;
                if (activeTool === 'text') {
                    created = addLayerToShot(frame.activeShot.id, 'text', {
                        position: { x: fracX, y: fracY, z: 0.1 },
                        ...(fracW ? { maxWidth: fracW } : {}),
                    });
                } else if (activeTool === 'image') {
                    created = addLayerToShot(frame.activeShot.id, 'image', {
                        position: { x: fracX, y: fracY, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 }, // Drop flat when drawn
                        ...(fracW && fracH
                            ? { size: { width: fracW, height: fracH } }
                            : {}),
                    });
                } else {
                    const shapeKind =
                        activeTool === 'ellipse'
                            ? 'ellipse'
                            : activeTool === 'line'
                                ? 'line'
                                : 'rectangle';
                    created = addLayerToShot(frame.activeShot.id, 'shape', {
                        shape: shapeKind,
                        position: { x: fracX, y: fracY, z: 0.1 },
                        ...(fracW && fracH
                            ? { size: { width: fracW, height: fracH } }
                            : {}),
                    });
                }

                onSelectLayer(created.id, false);
                setActiveTool('select');
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return;
        }

        // 3. Clicking empty workspace deselects layers (so right sidebar shows Project settings)
        clearLayerSelection();
    };

    // Deep Select (Cmd + Click): cycles through layers stacked behind the clicked layer
    const handleSelectLayerWithDeepSelect = (
        clickedLayerId: string,
        multiSelect?: boolean
    ) => {
        if (isCreationTool) return;
        onSelectLayer(clickedLayerId, multiSelect);
    };

    const selectedLayer = frame.activeShot.layers.find((l) =>
        selectedLayerIds.includes(l.id)
    );

    // ============================================================================
    // DRAG AND DROP ON CANVAS: Drop external desktop files or assets library items
    // ============================================================================
    const handleCanvasDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDraggingOver) setIsDraggingOver(true);
    };

    const handleCanvasDragLeave = (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOver(false);
        }
    };

    const handleCanvasDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const frameRect = stageFrameRef.current?.getBoundingClientRect();
        let dropX = 0;
        let dropY = 0;
        if (frameRect) {
            dropX = Math.max(
                -0.95,
                Math.min(
                    0.95,
                    Number(((e.clientX - frameRect.left) / frameRect.width - 0.5).toFixed(3))
                )
            );
            dropY = Math.max(
                -0.95,
                Math.min(
                    0.95,
                    Number(((e.clientY - frameRect.top) / frameRect.height - 0.5).toFixed(3))
                )
            );
        }

        // 1. Dragged from LeftPanel Assets library
        const assetId = e.dataTransfer.getData('application/x-raylight-asset-id');
        if (assetId && project.assets[assetId]) {
            const asset = project.assets[assetId];
            const assetAspect = (asset.width || 1920) / (asset.height || 1080);
            const frameAspect = frameWidth / frameHeight;
            let w = 0.55;
            let h = (w * frameAspect) / assetAspect;
            if (h > 0.8) {
                h = 0.8;
                w = (h * assetAspect) / frameAspect;
            }

            const newLayer = addLayerToShot(frame.activeShot.id, 'image', {
                name: asset.name,
                assetId: asset.id,
                position: { x: dropX, y: dropY, z: 0 },
                size: { width: Number(w.toFixed(3)), height: Number(h.toFixed(3)) },
                rotation: { x: 0, y: 0, z: 0 },
                device: undefined,
            });
            selectLayer(newLayer.id, false);
            return;
        }

        // 2. Desktop Files (Images, SVGs)
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
                try {
                    const svgText = await file.text();
                    const parsed = parseFigmaSvgToLayers(
                        svgText,
                        frame.activeShot.durationMs,
                        frame.activeShot.layers.length
                    );
                    if (parsed.layers.length > 0) {
                        addMultipleLayersToShot(
                            frame.activeShot.id,
                            parsed.layers,
                            parsed.assets
                        );
                        setSelectedLayerIds(parsed.layers.map((l) => l.id));
                    }
                } catch (err) {
                    console.error('Failed to parse dropped SVG:', err);
                }
            } else if (file.type.startsWith('image/')) {
                try {
                    const assetRecord = await readImageFileWithThumbnail(file);
                    updateProject(
                        (p) => ({
                            ...p,
                            assets: { ...p.assets, [assetRecord.id]: assetRecord },
                        }),
                        { skipHistory: true }
                    );

                    const assetAspect =
                        (assetRecord.width || 1920) / (assetRecord.height || 1080);
                    const frameAspect = frameWidth / frameHeight;
                    let w = 0.55;
                    let h = (w * frameAspect) / assetAspect;
                    if (h > 0.8) {
                        h = 0.8;
                        w = (h * assetAspect) / frameAspect;
                    }

                    const newLayer = addLayerToShot(frame.activeShot.id, 'image', {
                        name: file.name.replace(/\.[^/.]+$/, '') || 'Dropped image',
                        assetId: assetRecord.id,
                        position: { x: dropX, y: dropY, z: 0 },
                        size: { width: Number(w.toFixed(3)), height: Number(h.toFixed(3)) },
                        rotation: { x: 0, y: 0, z: 0 },
                        device: undefined,
                    });
                    selectLayer(newLayer.id, false);
                } catch (err) {
                    console.error('Failed to load dropped image:', err);
                }
            }
        }
    };

    // ============================================================================
    // RIGHT-CLICK CONTEXT MENU (Audit Section 6.4)
    // ============================================================================
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const targetEl = e.target as HTMLElement;
        const layerEl = targetEl.closest('[data-layer-id]');
        const clickedLayerId = layerEl?.getAttribute('data-layer-id');

        if (clickedLayerId) {
            if (!selectedLayerIds.includes(clickedLayerId)) {
                selectLayer(clickedLayerId, false);
            }
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                layerId: clickedLayerId,
            });
        } else if (selectedLayerIds.length > 0) {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                layerId: selectedLayerIds[0],
            });
        } else {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                layerId: null,
            });
        }
    };

    const contextMenuLayer = contextMenu?.layerId
        ? frame.activeShot.layers.find((l) => l.id === contextMenu.layerId) || null
        : null;

    return (
        <div
            ref={containerRef}
            onMouseDown={handleWorkspaceMouseDown}
            onContextMenu={handleContextMenu}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            className={`flex-1 bg-[#05060a] relative flex items-center justify-center overflow-hidden select-none ${activeTool === 'hand' || isSpaceHeld
                    ? 'cursor-grab active:cursor-grabbing'
                    : isCreationTool
                        ? 'cursor-crosshair'
                        : 'cursor-default'
                }`}
        >
            {/* Subtle Infinite Workspace Grid */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0)',
                    backgroundSize: `${24 * canvasZoom}px ${24 * canvasZoom}px`,
                    backgroundPosition: `${canvasPan.x}px ${canvasPan.y}px`,
                }}
            />

            {/* PAN & ZOOM WORKSPACE TRANSFORM WRAPPER */}
            <div
                style={{
                    transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom})`,
                    transformOrigin: 'center center',
                }}
                className="relative flex items-center justify-center"
            >
                {/* THE STAGE FRAME */}
                <div
                    ref={stageFrameRef}
                    className="relative rounded-xl border border-white/20 bg-[#070913] transition-[width,height] duration-150 overflow-visible"
                    style={{
                        width: `${frameWidth}px`,
                        height: `${frameHeight}px`,
                        filter: colorGradeCss,
                        // Dimmed off-screen room mask around the bright export frame
                        boxShadow:
                            '0 0 0 4000px rgba(5, 6, 10, 0.72), 0 25px 70px rgba(0,0,0,0.85)',
                    }}
                >
                    {/* PRIMARY 3D VIEWPORT CANVAS (Three.js / React Three Fiber - Raylight Engine) */}
                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-auto">
                        <ViewportCanvas
                            project={project}
                            frame={frame}
                            selectedLayerIds={selectedLayerIds}
                            onSelectLayer={handleSelectLayerWithDeepSelect}
                            onPointerMissed={() => clearLayerSelection()}
                        />
                    </div>

                    {/* Drag & Drop Target Glow Overlay */}
                    {isDraggingOver && (
                        <div className="absolute inset-0 z-50 bg-sky-500/15 border-2 border-dashed border-sky-400 rounded-xl flex flex-col items-center justify-center gap-2 backdrop-blur-[2px] pointer-events-none animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                                <UploadCloud className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-semibold text-white drop-shadow">
                                Drop image or SVG to add to scene
                            </span>
                            <span className="text-[11px] text-sky-200/80">
                                Places layer at cursor with natural dimensions
                            </span>
                        </div>
                    )}

                    {/* Empty Canvas Onboarding & Quick Actions (Audit Section 10) */}
                    {frame.activeShot.layers.length === 0 && !isDraggingOver && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 select-none pointer-events-auto">
                            <div className="w-full max-w-sm p-6 rounded-2xl bg-[#090c14]/90 border border-white/15 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-inner">
                                    <UploadCloud className="w-7 h-7" />
                                </div>

                                <div className="space-y-1.5">
                                    <h3 className="text-sm font-bold text-white tracking-wide">
                                        Empty Canvas
                                    </h3>
                                    <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                                        Drop a screenshot or video, paste vector frames from Figma (<kbd className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px]">⌘V</kbd>), or start with a pre-built template.
                                    </p>
                                </div>

                                <div className="w-full flex flex-col gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => onOpenTemplatesModal?.()}
                                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-500/20 transition"
                                    >
                                        <Sparkles className="w-4 h-4 text-sky-200" />
                                        <span>Browse Starter Templates</span>
                                    </button>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onUploadClick?.()}
                                            className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
                                        >
                                            <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                                            <span>Upload Media</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onPasteFigmaSample?.()}
                                            className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                                            <span>Paste Sample Figma</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SCENE POST-PROCESSING OVERLAYS (Vignette, Edge Fade, Film Grain) */}
                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none z-20">
                        {eff.vignette.enabled && (
                            <div
                                className="absolute inset-0"
                                style={{
                                    boxShadow: `inset 0 0 ${Math.round(
                                        Math.min(frameWidth, frameHeight) * 0.45
                                    )}px rgba(0, 0, 0, ${eff.vignette.intensity})`,
                                }}
                            />
                        )}

                        {eff.edgeFade.enabled && (
                            <div
                                className="absolute inset-0"
                                style={{
                                    boxShadow: `inset 0 ${Math.round(
                                        eff.edgeFade.top * 120
                                    )}px 60px -20px #05060a, inset 0 -${Math.round(
                                        eff.edgeFade.bottom * 120
                                    )}px 60px -20px #05060a`,
                                }}
                            />
                        )}

                        {eff.filmGrain.enabled && (
                            <div
                                className="absolute inset-0 mix-blend-overlay"
                                style={{
                                    opacity: Math.min(0.6, eff.filmGrain.intensity * 3.5),
                                    backgroundImage:
                                        'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                                    backgroundSize: `${3 + (frame.frameNumber % 3)}px ${3 + ((frame.frameNumber + 1) % 3)
                                        }px`,
                                }}
                            />
                        )}
                    </div>

                    {/* MIDDLE SURFACE: Smart Alignment Snapping Guides & Safe Area */}
                    <Guides
                        guides={activeGuides}
                        showSafeArea={showSafeArea}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        cameraZoom={frame.camera.zoom}
                        cameraTargetX={frame.camera.target.x}
                        cameraTargetY={frame.camera.target.y}
                    />

                    {/* Rubber-band Draw Box when dragging to create a new layer */}
                    {drawBox && (
                        <div
                            className="absolute border-2 border-sky-400 bg-sky-500/15 rounded pointer-events-none z-40"
                            style={{
                                left: `${drawBox.x}px`,
                                top: `${drawBox.y}px`,
                                width: `${drawBox.w}px`,
                                height: `${drawBox.h}px`,
                            }}
                        />
                    )}

                    {/* TOP SURFACE: Crisp 2D Selection Gizmo & Multi-Select Overlay */}
                    <SelectionOverlay
                        frame={frame}
                        selectedLayerIds={selectedLayerIds}
                        frameWidth={frameWidth}
                        frameHeight={frameHeight}
                        snapEnabled={snapEnabled}
                        onUpdateGuides={setActiveGuides}
                        onSelectLayer={handleSelectLayerWithDeepSelect}
                    />

                    {/* Scene Key Light Pin: Only visible when actively inspecting Scene & Light Rig */}
                    {inspectorTab === 'shot' && (
                        <div
                            onMouseDown={handleLightPinMouseDown}
                            className="w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-xl cursor-grab active:cursor-grabbing absolute z-30 flex items-center justify-center group"
                            style={{
                                left: `${lightScreenX}%`,
                                top: `${lightScreenY}%`,
                                backgroundColor: kelvinToRgb(light.temperature, 1).css,
                                boxShadow: `0 0 16px ${kelvinToRgb(light.temperature, 1).css}`,
                            }}
                            title={`Key Light: (${light.position.x.toFixed(2)}, ${light.position.y.toFixed(2)}) · Drag to reposition light rig`}
                        >
                            <span className="opacity-0 group-hover:opacity-100 transition absolute top-5 px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-mono text-white whitespace-nowrap pointer-events-none border border-white/10 shadow-lg">
                                Key Light ({light.position.x.toFixed(2)}, {light.position.y.toFixed(2)})
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Top-Left Active Animate Recording Pill (Raylight-style) */}
            {isAnimateMode && (
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-rose-600/90 backdrop-blur-md border border-rose-400/40 text-[11px] font-medium text-white flex items-center gap-2 shadow-lg animate-pulse pointer-events-none z-30">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>REC (⇧A)</span>
                </div>
            )}

            {/* Top-Right Workspace Zoom & Pan Controls */}
            <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-[#12141e]/90 backdrop-blur-md border border-white/10 text-[11px] font-mono text-gray-300 flex items-center gap-1.5 z-30"
            >
                <button
                    onClick={() => setCanvasZoom((z) => z - 0.15)}
                    title="Zoom Out (Cmd + Scroll)"
                    className="p-1 rounded hover:bg-white/10 cursor-pointer"
                >
                    <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[44px] text-center text-white">
                    {Math.round(canvasZoom * 100)}%
                </span>
                <button
                    onClick={() => setCanvasZoom((z) => z + 0.15)}
                    title="Zoom In (Cmd + Scroll)"
                    className="p-1 rounded hover:bg-white/10 cursor-pointer"
                >
                    <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={resetCanvasView}
                    title="Reset Pan & Zoom to Fit"
                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer border-l border-white/10 pl-1.5"
                >
                    <RotateCcw className="w-3 h-3" />
                </button>

            </div>

            {/* RAYLIGHT RIGHT-CLICK CONTEXT MENU (Audit Section 6.4) */}
            {contextMenu && (
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        left: `${Math.min(contextMenu.x, window.innerWidth - 232)}px`,
                        top: `${Math.min(
                            contextMenu.y,
                            window.innerHeight - (contextMenuLayer ? 390 : 220)
                        )}px`,
                    }}
                    className="fixed z-50 w-56 bg-[#0c0d14]/95 backdrop-blur-xl border border-white/12 shadow-2xl rounded-xl p-1 text-xs text-gray-200 flex flex-col gap-0.5 select-none"
                >
                    {contextMenuLayer ? (
                        <>
                            <div className="px-2.5 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider truncate border-b border-white/10 mb-0.5">
                                {contextMenuLayer.name}
                            </div>
                            <button
                                onClick={() => {
                                    const dup = duplicateLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id
                                    );
                                    if (dup) selectLayer(dup.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Duplicate</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘D
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const idsToGroup = selectedLayerIds.includes(
                                        contextMenuLayer.id
                                    )
                                        ? selectedLayerIds
                                        : [contextMenuLayer.id];
                                    createGroupFromLayers(frame.activeShot.id, idsToGroup);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <FolderPlus className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Group</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘G
                                </span>
                            </button>
                            {contextMenuLayer.groupId && (
                                <button
                                    onClick={() => {
                                        if (contextMenuLayer.groupId) {
                                            ungroupInShot(
                                                frame.activeShot.id,
                                                contextMenuLayer.groupId
                                            );
                                        }
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2">
                                        <FolderMinus className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Ungroup</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                        ⌘⇧G
                                    </span>
                                </button>
                            )}
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'front'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronsUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Bring to Front</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘]
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'forward'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Bring Forward</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ]
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'backward'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Send Backward</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    [
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    restackLayerInShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        'back'
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronsDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Send to Back</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘[
                                </span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    updateLayer(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        (l) => ({ ...l, locked: !l.locked })
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    {contextMenuLayer.locked ? (
                                        <Unlock className="w-3.5 h-3.5 text-amber-400" />
                                    ) : (
                                        <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    )}
                                    <span>
                                        {contextMenuLayer.locked ? 'Unlock Layer' : 'Lock Layer'}
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    updateLayer(
                                        frame.activeShot.id,
                                        contextMenuLayer.id,
                                        (l) => ({ ...l, hidden: !l.hidden })
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    {contextMenuLayer.hidden ? (
                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                        <EyeOff className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    )}
                                    <span>
                                        {contextMenuLayer.hidden ? 'Show Layer' : 'Hide Layer'}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘⇧H
                                </span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    deleteLayerFromShot(
                                        frame.activeShot.id,
                                        contextMenuLayer.id
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Delete</span>
                                </div>
                                <span className="text-[10px] font-mono text-rose-400/70">
                                    Del
                                </span>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="px-2.5 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider border-b border-white/10 mb-0.5">
                                Canvas
                            </div>
                            <button
                                onClick={() => {
                                    const l = addLayerToShot(frame.activeShot.id, 'text', {
                                        position: { x: 0, y: 0, z: 0 },
                                    });
                                    selectLayer(l.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Type className="w-3.5 h-3.5 text-sky-400" />
                                    <span>Add Text</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    T
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const l = addLayerToShot(frame.activeShot.id, 'shape', {
                                        shape: 'rectangle',
                                        position: { x: 0, y: 0, z: 0 },
                                    });
                                    selectLayer(l.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Square className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Add Rectangle</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    R
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    const l = addLayerToShot(frame.activeShot.id, 'shape', {
                                        shape: 'ellipse',
                                        position: { x: 0, y: 0, z: 0 },
                                    });
                                    selectLayer(l.id, false);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Circle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Add Ellipse</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    O
                                </span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => {
                                    setSelectedLayerIds(
                                        frame.activeShot.layers.map((l) => l.id)
                                    );
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-sky-500/20 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Select All Layers</span>
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                                    ⌘A
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    resetCanvasView();
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white text-gray-300 transition text-left cursor-pointer group"
                            >
                                <div className="flex items-center gap-2">
                                    <RotateCcw className="w-3.5 h-3.5 text-gray-400 group-hover:text-sky-300" />
                                    <span>Reset View to Fit</span>
                                </div>
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* FLOATING BOTTOM CANVAS TOOLBAR */}
            <CanvasToolbar selectedLayer={selectedLayer} />
        </div>
    );
};
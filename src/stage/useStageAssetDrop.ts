import React from 'react';
import type { Project } from '../model/types';
import type { EvaluatedProjectFrame } from '../engine/evaluateShot';
import { readImageFileWithThumbnail, readVideoFile, readAudioFile, parseFigmaSvgToLayers } from '../engine/figmaSvgImporter';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { computeFittedImageDimensions } from './stageAssetDropUtils';

interface UseStageAssetDropOptions {
    frame: EvaluatedProjectFrame;
    project: Project;
    stageFrameRef: React.RefObject<HTMLDivElement | null>;
    frameWidth: number;
    frameHeight: number;
    isDraggingOver: boolean;
    setIsDraggingOver: (active: boolean) => void;
}

export const useStageAssetDrop = ({ frame, project, stageFrameRef, frameWidth, frameHeight, isDraggingOver, setIsDraggingOver }: UseStageAssetDropOptions) => {
    const { addLayerToShot, addMultipleLayersToShot, updateProject } = useProjectStore();
    const { selectLayer, setSelectedLayerIds } = useSelectionStore();    // DRAG AND DROP ON CANVAS: Drop external desktop files or assets library items
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
            const size = computeFittedImageDimensions(asset.width, asset.height, frameWidth, frameHeight);

            const newLayer = addLayerToShot(frame.activeShot.id, 'image', {
                name: asset.name,
                assetId: asset.id,
                position: { x: dropX, y: dropY, z: 0 },
                size,
                rotation: { x: 0, y: 0, z: 0 },
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
            } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name)) {
                try {
                    const assetRecord = await readVideoFile(file);
                    updateProject(
                        (p) => ({
                            ...p,
                            assets: { ...p.assets, [assetRecord.id]: assetRecord },
                        }),
                        { skipHistory: true }
                    );

                    const size = computeFittedImageDimensions(assetRecord.width, assetRecord.height, frameWidth, frameHeight);

                    const newLayer = addLayerToShot(frame.activeShot.id, 'video', {
                        name: file.name.replace(/\.[^/.]+$/, '') || 'Dropped video',
                        assetId: assetRecord.id,
                        position: { x: dropX, y: dropY, z: 0 },
                        size,
                        rotation: { x: 0, y: 0, z: 0 },
                        cornerRadius: 0,
                    });
                    selectLayer(newLayer.id, false);
                } catch (err) {
                    console.error('Failed to load dropped video:', err);
                }
            } else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) {
                try {
                    const audioRecord = await readAudioFile(file);
                    const clipDuration = audioRecord.durationMs || 5000;
                    updateProject((p) => ({
                        ...p,
                        audio: {
                            ...(p.audio || { muted: false, masterVolume: 1 }),
                            clips: [
                                ...(p.audio?.clips || []),
                                {
                                    id: audioRecord.id,
                                    name: audioRecord.name,
                                    dataUrl: audioRecord.dataUrl,
                                    startMs: Math.max(0, frame.globalTimeMs || 0),
                                    durationMs: clipDuration,
                                    offsetMs: 0,
                                    volume: 1,
                                    muted: false,
                                },
                            ],
                        },
                    }));
                } catch (err) {
                    console.error('Failed to load dropped audio:', err);
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

                    const size = computeFittedImageDimensions(assetRecord.width, assetRecord.height, frameWidth, frameHeight);

                    const newLayer = addLayerToShot(frame.activeShot.id, 'image', {
                        name: file.name.replace(/\.[^/.]+$/, '') || 'Dropped image',
                        assetId: assetRecord.id,
                        position: { x: dropX, y: dropY, z: 0 },
                        size,
                        rotation: { x: 0, y: 0, z: 0 },
                    });
                    selectLayer(newLayer.id, false);
                } catch (err) {
                    console.error('Failed to load dropped image:', err);
                }
            }
        }
    };

    return { handleCanvasDragOver, handleCanvasDragLeave, handleCanvasDrop };
};

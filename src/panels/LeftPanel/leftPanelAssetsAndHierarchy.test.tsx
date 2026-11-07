import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { UploadedAssetsPanel } from './UploadedAssetsPanel';
import { FileTab } from './FileTab';
import { LayerIcon } from './LayerIcon';
import { DEFAULT_PROJECT, createDefaultShot } from '../../model/defaults';
import type { AssetRecord, Layer, Transitionish } from '../../model/types';

const NONE_TRANSITION: Transitionish = {
    type: 'none',
    durationMs: 0,
    delayMs: 0,
    distance: 0,
    easing: { kind: 'preset', name: 'linear' },
};

describe('Left Panel: Hierarchy & Asset Library', () => {
    beforeEach(() => {
        useProjectStore.setState({
            project: {
                ...DEFAULT_PROJECT,
                assets: {},
                shots: [
                    createDefaultShot({
                        id: 'shot-1',
                        name: 'Intro Scene',
                        startMs: 0,
                        durationMs: 4000,
                        layers: [],
                        groups: [],
                        cameraBlocks: [],
                    }),
                ],
            },
            past: [],
            future: [],
            isHydrating: false,
            hydrationRevision: 0,
        });
        useSelectionStore.setState({
            selectedLayerIds: [],
            selectedShotId: 'shot-1',
            inspectorTab: 'shot',
        });
    });

    describe('deleteAsset Store Action', () => {
        it('removes asset from project.assets and cascades to layers and background', () => {
            const assetId = 'asset-test-1';
            const mockAsset: AssetRecord = {
                id: assetId,
                name: 'hero-photo.png',
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,mock',
                width: 800,
                height: 600,
            };

            const store = useProjectStore.getState();
            store.updateProject((proj) => ({
                ...proj,
                assets: { [assetId]: mockAsset },
                background: {
                    kind: 'image',
                    assetId,
                    src: mockAsset.dataUrl,
                    color: '#000000',
                    fit: 'cover',
                    dim: 0,
                    blur: 0,
                    opacity: 1,
                },
                shots: [
                    {
                        ...proj.shots[0],
                        layers: [
                            {
                                id: 'layer-img-1',
                                name: 'Hero Image',
                                kind: 'image',
                                assetId,
                                order: 0,
                                hidden: false,
                                locked: false,
                                inMs: 0,
                                outMs: 4000,
                                position: { x: 0, y: 0, z: 0 },
                                rotation: { x: 0, y: 0, z: 0 },
                                scale: { x: 1, y: 1, z: 1 },
                                opacity: 1,
                                blendMode: 'normal',
                                entrance: { ...NONE_TRANSITION },
                                exit: { ...NONE_TRANSITION },
                                blocks: [],
                                effects: {} as any,
                                size: { width: 0.5, height: 0.5 },
                                cornerRadius: 0,
                            },
                        ],
                    },
                ],
            }));

            expect(useProjectStore.getState().project.assets[assetId]).toBeDefined();
            expect(useProjectStore.getState().project.shots[0].layers).toHaveLength(1);
            expect(useProjectStore.getState().project.background.kind).toBe('image');

            // Delete the asset
            useProjectStore.getState().deleteAsset(assetId);

            const updated = useProjectStore.getState().project;
            expect(updated.assets[assetId]).toBeUndefined();
            expect(updated.shots[0].layers).toHaveLength(0);
            expect(updated.background.kind).toBe('solid');
        });
    });

    describe('UploadedAssetsPanel Markup & Parity', () => {
        it('renders Search assets input and upload button', () => {
            const asset1: AssetRecord = {
                id: 'asset-1',
                name: 'background-art.png',
                mimeType: 'image/png',
                dataUrl: 'data:image/png;base64,1',
                width: 1920,
                height: 1080,
            };

            useProjectStore.getState().updateProject((proj) => ({
                ...proj,
                assets: {
                    [asset1.id]: asset1,
                },
            }));

            const project = useProjectStore.getState().project;
            const shot = project.shots[0];
            const html = renderToStaticMarkup(<UploadedAssetsPanel project={project} activeShot={shot} onUploadClick={() => {}} />);

            expect(html).toContain('Upload Media');
            expect(html).toContain('Search assets');
            expect(html).toContain('background-art.png');
            expect(html).toContain('1920×1080');
        });

        it('shows empty state when library has no assets', () => {
            const shot = useProjectStore.getState().project.shots[0];
            const html = renderToStaticMarkup(<UploadedAssetsPanel activeShot={shot} onUploadClick={() => {}} />);

            expect(html).toContain('No media yet. Upload an image or video file, or drag one here.');
        });
    });

    describe('FileTab Search & Filtering', () => {
        it('displays "No layers match your search." when search query matches nothing', () => {
            const shot = useProjectStore.getState().project.shots[0];
            const html = renderToStaticMarkup(<FileTab activeTab="file" activeShot={shot} searchQuery="non-existent-query" />);

            expect(html).toContain('No layers match your search.');
        });
    });

    describe('LayerIcon Rendering', () => {
        it('renders clean icons without redundant classes for video, image, and text', () => {
            const baseLayer = {
                order: 0,
                hidden: false,
                locked: false,
                inMs: 0,
                outMs: 4000,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                opacity: 1,
                blendMode: 'normal' as const,
                entrance: { ...NONE_TRANSITION },
                exit: { ...NONE_TRANSITION },
                blocks: [],
                effects: {} as any,
            };

            const videoLayer: Layer = {
                ...baseLayer,
                id: 'l-vid',
                name: 'clip.mp4',
                kind: 'video',
                assetId: 'a-vid',
                size: { width: 0.5, height: 0.5 },
                cornerRadius: 0,
            };
            const imageLayer: Layer = {
                ...baseLayer,
                id: 'l-img',
                name: 'photo.png',
                kind: 'image',
                assetId: 'a-img',
                size: { width: 0.5, height: 0.5 },
                cornerRadius: 0,
            };
            const textLayer: Layer = {
                ...baseLayer,
                id: 'l-txt',
                name: 'Heading',
                kind: 'text',
                content: 'Hello',
                maxWidth: 0.5,
                font: {
                    family: 'Inter',
                    size: 48,
                    weight: 600,
                    color: '#ffffff',
                    align: 'center',
                    letterSpacing: 0,
                },
            };

            const videoUnselectedHtml = renderToStaticMarkup(<LayerIcon layer={videoLayer} isSelected={false} />);
            const videoSelectedHtml = renderToStaticMarkup(<LayerIcon layer={videoLayer} isSelected={true} />);
            expect(videoUnselectedHtml).toContain('w-3.5 h-3.5 shrink-0 text-[#38bdf8]');
            expect(videoSelectedHtml).toBe(videoUnselectedHtml);

            const imageUnselectedHtml = renderToStaticMarkup(<LayerIcon layer={imageLayer} isSelected={false} />);
            const imageSelectedHtml = renderToStaticMarkup(<LayerIcon layer={imageLayer} isSelected={true} />);
            expect(imageUnselectedHtml).toContain('text-[#0ea5e9]');
            expect(imageSelectedHtml).toContain('text-[#38bdf8]');

            const textUnselectedHtml = renderToStaticMarkup(<LayerIcon layer={textLayer} isSelected={false} />);
            const textSelectedHtml = renderToStaticMarkup(<LayerIcon layer={textLayer} isSelected={true} />);
            expect(textUnselectedHtml).toContain('text-[#ec4899]');
            expect(textSelectedHtml).toContain('text-white');
        });
    });
});

// src/stage/cameraFramingOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraFramingOverlay } from './CameraFramingOverlay';
import { createDefaultCameraBlock } from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';

describe('CameraFramingOverlay UI Integration', () => {
    it('renders From and To framing boxes, interactive Move chip, and corner handles', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-test', 0, 2000, 'f1', 'f2', 'Pan Right');
        const shotWithBlock = {
            ...shot,
            cameraBlocks: [block],
        };

        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={shotWithBlock}
                selectedCameraBlockId={block.id}
                frameWidth={960}
                frameHeight={540}
            />
        );

        expect(html).toContain('data-camera-endpoint="from"');
        expect(html).toContain('data-camera-endpoint="to"');
        expect(html).toContain('border-dashed border-emerald-400');
        expect(html).toContain('border-solid border-emerald-400');

        // Corner handles for resizing
        expect(html).toContain('Drag to scale From framing (NW)');
        expect(html).toContain('Drag to scale To framing (SE)');
    });

    it('returns null when selectedCameraBlockId does not match any block', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={shot}
                selectedCameraBlockId="non-existent"
                frameWidth={960}
                frameHeight={540}
            />
        );

        expect(html).toBe('');
    });

    it('keeps camera movement and lens values in the inspector, not on-canvas controls', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-vertigo', 500, 3500, 'f1', 'f2', 'Vertigo (Dolly Zoom In)');
        block.mode = 'dollyzoom';
        if (block.from && block.to) {
            block.from.focalLength = 24;
            block.to.focalLength = 85;
        }

        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={{ ...shot, cameraBlocks: [block] }}
                selectedCameraBlockId={block.id}
                frameWidth={1920}
                frameHeight={1080}
            />
        );

        expect(html).toContain('data-camera-endpoint="from"');
        expect(html).toContain('data-camera-endpoint="to"');
        expect(html).not.toContain('Vertigo');
        expect(html).not.toContain('24mm');
        expect(html).not.toContain('85mm');
        expect(html).not.toContain('Edit From Camera Controls');
    });
});

describe('Camera framing overlay reference styling', () => {
    it('keeps the canvas overlay to labeled, draggable From and To framing boxes', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-overlay-reference', 0, 2000);
        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={{ ...shot, cameraBlocks: [block] }}
                selectedCameraBlockId={block.id}
                frameWidth={960}
                frameHeight={540}
            />
        );

        expect(html).toContain('data-camera-endpoint="from"');
        expect(html).toContain('data-camera-endpoint="to"');
        expect(html).toContain('>From</span>');
        expect(html).toContain('>To</span>');
        expect(html).not.toContain('Edit From Camera Controls &amp; Presets');
    });
});

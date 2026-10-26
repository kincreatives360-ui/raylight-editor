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
                cameraZoom={1.0}
            />
        );

        // From and To framing chips
        expect(html).toContain('From:');
        expect(html).toContain('To:');

        // Interactive Move Info Chip with active label and duration
        expect(html).toContain('Pan Right');
        expect(html).toContain('2.0s');
        expect(html).toContain('linear');

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
                cameraZoom={1.0}
            />
        );

        expect(html).toBe('');
    });

    it('renders with different movement modes and custom focal lengths', () => {
        const shot = useProjectStore.getState().project.shots[0];
        const block = createDefaultCameraBlock('block-vertigo', 500, 3500, 'f1', 'f2', 'Vertigo (Dolly Zoom In)');
        block.mode = 'dollyzoom';
        if (block.from && block.to) {
            block.from.focalLength = 24;
            block.to.focalLength = 85;
            block.from.orbit = 15;
            block.to.orbit = -15;
        }

        const shotWithBlock = {
            ...shot,
            cameraBlocks: [block],
        };

        const html = renderToStaticMarkup(
            <CameraFramingOverlay
                shot={shotWithBlock}
                selectedCameraBlockId={block.id}
                frameWidth={1920}
                frameHeight={1080}
                cameraZoom={1.5}
            />
        );

        // Movement chip shows label and duration
        expect(html).toContain('Vertigo (Dolly Zoom In)');
        expect(html).toContain('3.5s');

        // Mode and focal length badges
        expect(html).toContain('(dollyzoom)');
        expect(html).toContain('24mm');
        expect(html).toContain('85mm');
        expect(html).toContain('15°');
        expect(html).toContain('-15°');
    });
});

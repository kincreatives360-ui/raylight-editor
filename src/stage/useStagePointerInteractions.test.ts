import { act, createElement, type MouseEvent as ReactMouseEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { evaluateProjectAtTime } from '../engine/evaluateShot';
import { createDefaultProject, createDefaultShapeLayer } from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { useStagePointerInteractions } from './useStagePointerInteractions';

const { getProjection } = vi.hoisted(() => ({
    getProjection: vi.fn(),
}));

vi.mock('./webgl/cameraMath', () => ({
    DEFAULT_CAMERA_Z: 2.65,
    DEFAULT_FOCAL_LENGTH: 50,
    evaluateCameraPose: vi.fn(() => ({})),
    getLayerProjectedCorners: (...args: unknown[]) => getProjection(...args),
}));

let dom: JSDOM;
let root: Root | null = null;

function installMarqueeHandler({
    selectedLayerIds = [],
    shiftKey = false,
}: {
    selectedLayerIds?: string[];
    shiftKey?: boolean;
} = {}) {
    const project = createDefaultProject();
    project.shots[0].layers = [
        createDefaultShapeLayer({ id: 'target' }),
        createDefaultShapeLayer({ id: 'hidden' }),
    ];
    const frame = evaluateProjectAtTime(project, 0);
    const hiddenLayer = frame.layers.find((layer) => layer.id === 'hidden');
    if (hiddenLayer) hiddenLayer.visible = false;

    useProjectStore.setState({ project, dragSnapshot: null });
    useSelectionStore.setState({ selectedLayerIds, isTransformDragging: false });

    const setMarqueeBox = vi.fn();
    const setSelectedLayerIds = vi.fn();
    const clearLayerSelection = vi.fn();
    const options: Parameters<typeof useStagePointerInteractions>[0] = {
        activeTool: 'select',
        isSpaceHeld: false,
        frame,
        project,
        selectedCameraBlockId: null,
        canvasZoom: 1,
        canvasPan: { x: 0, y: 0 },
        frameWidth: 200,
        frameHeight: 200,
        isCreationTool: false,
        selectedLayerIds,
        stageFrameRef: {
            current: {
                getBoundingClientRect: () => ({
                    left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200,
                }),
            },
        } as never,
        onSelectLayer: vi.fn(),
        beginDragTransaction: vi.fn(),
        commitDragTransaction: vi.fn(),
        updateActiveShotCamera: vi.fn(),
        setCanvasPan: vi.fn() as never,
        setActiveTool: vi.fn() as never,
        setDrawBox: vi.fn() as never,
        setMarqueeBox: setMarqueeBox as never,
        setSelectedLayerIds: setSelectedLayerIds as never,
        clearLayerSelection,
        addLayerToShot: vi.fn() as never,
    };
    let handler: ((event: ReactMouseEvent) => void) | null = null;
    function Harness() {
        handler = useStagePointerInteractions(options);
        return null;
    }

    root = createRoot(dom.window.document.getElementById('stage')!);
    act(() => root!.render(createElement(Harness)));

    handler!({
        clientX: 45,
        clientY: 15,
        button: 0,
        shiftKey,
        metaKey: false,
        ctrlKey: false,
    } as never);

    return { clearLayerSelection, setMarqueeBox, setSelectedLayerIds };
}

function finishMarquee(clientX = 55, clientY = 25) {
    dom.window.dispatchEvent(new dom.window.MouseEvent('mousemove', {
        clientX,
        clientY,
    }));
    dom.window.dispatchEvent(new dom.window.MouseEvent('mouseup', {
        clientX,
        clientY,
    }));
}

beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="stage"></div>', { url: 'http://localhost' });
    vi.stubGlobal('window', dom.window);
    getProjection.mockReturnValue({
        pCenter: { x: 50, y: 10 },
        corners: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 20 },
            { x: 0, y: 20 },
        ],
    });
});

afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    dom.window.close();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe('stage marquee selection', () => {
    it('selects a projected polygon crossed by the marquee without containing its center or vertices', () => {
        const { setSelectedLayerIds } = installMarqueeHandler();

        finishMarquee();

        expect(getProjection).toHaveBeenCalled();
        expect(setSelectedLayerIds).toHaveBeenCalledWith(['target']);
    });

    it('preserves modifier-additive selection and skips invisible layers', () => {
        const { setSelectedLayerIds } = installMarqueeHandler({
            selectedLayerIds: ['existing'],
            shiftKey: true,
        });

        finishMarquee();

        expect(setSelectedLayerIds).toHaveBeenCalledWith(['existing', 'target']);
        expect(getProjection).toHaveBeenCalledOnce();
    });

    it('keeps the existing empty-marquee deselection behavior', () => {
        const { clearLayerSelection, setSelectedLayerIds } = installMarqueeHandler();

        finishMarquee(50, 20);

        expect(clearLayerSelection).toHaveBeenCalledOnce();
        expect(setSelectedLayerIds).not.toHaveBeenCalled();
    });
});

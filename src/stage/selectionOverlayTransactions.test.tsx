import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { createPointerDragLifecycle } from './selectionDragLifecycle';
import { createDefaultProject, createDefaultShapeLayer } from '../model/defaults';
import { useProjectStore } from '../store/useProjectStore';
import { SelectionOverlayVisuals } from './SelectionOverlayVisuals';
import { getLayerProjectedCorners } from './webgl/cameraMath';

type PointerEventType = Event & { pointerId: number; clientX: number; clientY: number };

function pointerEvent(type: string, pointerId: number, clientX = 0, clientY = 0): PointerEventType {
    return Object.assign(new Event(type), { pointerId, clientX, clientY });
}

function findTestElement(node: ReactNode, testId: string): React.ReactElement | null {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findTestElement(child, testId);
            if (found) return found;
        }
    } else if (isValidElement(node)) {
        const props = node.props as { children?: ReactNode; 'data-testid'?: string };
        if (props['data-testid'] === testId) return node;
        return findTestElement(props.children, testId);
    }
    return null;
}

describe('selection drag transactions', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        useProjectStore.setState({
            project: createDefaultProject(),
            past: [],
            future: [],
            dragSnapshot: null,
        });
    });

    it.each(['move', 'resize', 'rotate', 'crop', 'motion-end', 'corner-radius'])(
        'groups %s edits into one transaction and commits on pointer-up',
        (dragKind) => {
            const eventWindow = new EventTarget();
            vi.stubGlobal('window', eventWindow);
            const target = new EventTarget();
            const store = useProjectStore.getState();
            const begin = vi.fn(store.beginDragTransaction);
            const commit = vi.fn(store.commitDragTransaction);
            const cancel = vi.fn(store.cancelDragTransaction);
            let moveCount = 0;
            const onMove = vi.fn(() => useProjectStore.getState().updateProject(
                project => ({ ...project, name: `Edit ${++moveCount}` }),
                { skipHistory: true }
            ));

            createPointerDragLifecycle({
                pointerId: 7,
                target,
                begin,
                commit,
                cancel,
                onMove,
            });
            eventWindow.dispatchEvent(pointerEvent('pointermove', 7, 10, 12));
            eventWindow.dispatchEvent(pointerEvent('pointermove', 7, 15, 17));
            eventWindow.dispatchEvent(pointerEvent('pointerup', 7));

            expect(begin, dragKind).toHaveBeenCalledOnce();
            expect(onMove, dragKind).toHaveBeenCalledTimes(2);
            expect(commit, dragKind).toHaveBeenCalledOnce();
            expect(cancel, dragKind).not.toHaveBeenCalled();
            expect(useProjectStore.getState().past).toHaveLength(1);
            eventWindow.dispatchEvent(pointerEvent('pointerup', 7));
            expect(commit, dragKind).toHaveBeenCalledOnce();
        }
    );

    it.each([
        ['pointer-cancel', () => pointerEvent('pointercancel', 7)],
        ['lost pointer capture', () => pointerEvent('lostpointercapture', 7)],
        ['Escape', () => Object.assign(new Event('keydown'), { key: 'Escape' })],
        ['window blur', () => new Event('blur')],
    ])('rolls back on %s', (_reason, makeEvent) => {
        const eventWindow = new EventTarget();
        vi.stubGlobal('window', eventWindow);
        const target = new EventTarget();
        const store = useProjectStore.getState();
        const startingProject = store.project;
        const begin = vi.fn(store.beginDragTransaction);
        const commit = vi.fn(store.commitDragTransaction);
        const cancel = vi.fn(store.cancelDragTransaction);

        createPointerDragLifecycle({
            pointerId: 7,
            target,
            begin,
            commit,
            cancel,
            onMove: () => useProjectStore.getState().updateProject(
                project => ({ ...project, name: 'Canceled edit' }),
                { skipHistory: true }
            ),
        });
        eventWindow.dispatchEvent(pointerEvent('pointermove', 7, 20, 10));
        if (_reason === 'lost pointer capture') target.dispatchEvent(makeEvent());
        else eventWindow.dispatchEvent(makeEvent());

        expect(begin).toHaveBeenCalledOnce();
        expect(cancel).toHaveBeenCalledOnce();
        expect(commit).not.toHaveBeenCalled();
        expect(useProjectStore.getState().project).toBe(startingProject);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
        expect(useProjectStore.getState().past).toHaveLength(0);
        eventWindow.dispatchEvent(pointerEvent('pointerup', 7));
        expect(cancel).toHaveBeenCalledOnce();
    });

    it('ignores events from a pointer that does not own the drag', () => {
        const eventWindow = new EventTarget();
        vi.stubGlobal('window', eventWindow);
        const store = useProjectStore.getState();
        const begin = vi.fn(store.beginDragTransaction);
        const commit = vi.fn(store.commitDragTransaction);
        const cancel = vi.fn(store.cancelDragTransaction);
        const onMove = vi.fn();

        createPointerDragLifecycle({
            pointerId: 7,
            target: new EventTarget(),
            begin,
            commit,
            cancel,
            onMove,
        });
        eventWindow.dispatchEvent(pointerEvent('pointermove', 8));
        eventWindow.dispatchEvent(pointerEvent('pointerup', 8));

        expect(onMove).not.toHaveBeenCalled();
        expect(commit).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('cancels an active transaction when the drag owner unmounts', () => {
        const eventWindow = new EventTarget();
        vi.stubGlobal('window', eventWindow);
        const store = useProjectStore.getState();
        const startingProject = store.project;
        const cancel = vi.fn(store.cancelDragTransaction);
        const dispose = createPointerDragLifecycle({
            pointerId: 7,
            target: new EventTarget(),
            begin: store.beginDragTransaction,
            commit: store.commitDragTransaction,
            cancel,
            onMove: () => useProjectStore.getState().updateProject(
                project => ({ ...project, name: 'Canceled on unmount' }),
                { skipHistory: true }
            ),
        });
        eventWindow.dispatchEvent(pointerEvent('pointermove', 7));

        dispose();
        dispose();

        expect(cancel).toHaveBeenCalledOnce();
        expect(useProjectStore.getState().project).toBe(startingProject);
        expect(useProjectStore.getState().dragSnapshot).toBeNull();
    });

    it('updates corner radius without recording a history entry per pointer move', () => {
        const layer = createDefaultShapeLayer();
        const updateLayer = vi.fn();
        let moveHandler: ((event: PointerEvent | MouseEvent) => void) | null = null;
        const projected = {
            corners: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            pCenter: { x: 50, y: 50 },
            pNW: { x: 0, y: 0 },
            pNE: { x: 100, y: 0 },
            pSE: { x: 100, y: 100 },
            pSW: { x: 0, y: 100 },
        } as ReturnType<typeof getLayerProjectedCorners>;
        const props: React.ComponentProps<typeof SelectionOverlayVisuals> = {
            selectedEvalLayers: [],
            projectCorners: vi.fn(),
            primaryProj: projected,
            layer,
            activeShotId: 'shot',
            frameWidth: 100,
            isLocked: false,
            isCropping: false,
            isAnimateMode: false,
            isEditingInlineText: false,
            setIsEditingInlineText: vi.fn(),
            activeTool: 'select',
            borderColor: '#0088ff',
            isMotionBlock: false,
            motionStartPoint: { x: 50, y: 50 },
            motionEndPoint: { x: 50, y: 50 },
            motionMidControl: { x: 50, y: 50 },
            motionAmount: { x: 0, y: 0 },
            handleItems: [],
            onMoveStart: vi.fn(),
            onMotionEndStart: vi.fn(),
            onRotateStart: vi.fn(),
            onResizeStart: vi.fn(),
            onSelectLayer: vi.fn(),
            updateLayer,
            onPointerDrag: (_event, onMove) => { moveHandler = onMove; },
        };
        const root = SelectionOverlayVisuals(props);
        const handle = findTestElement(root, 'corner-radius-nw');
        expect(handle).not.toBeNull();

        const elementProps = handle!.props as {
            onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
        };
        elementProps.onPointerDown({
            stopPropagation: vi.fn(),
            preventDefault: vi.fn(),
            clientX: 0,
            clientY: 0,
        } as unknown as React.PointerEvent<HTMLDivElement>);
        moveHandler?.(pointerEvent('pointermove', 7, 40, 40) as PointerEvent);

        expect(updateLayer).toHaveBeenCalledOnce();
        expect(updateLayer.mock.calls[0][3]).toEqual({ skipHistory: true });
        const update = updateLayer.mock.calls[0][2] as (value: typeof layer) => typeof layer;
        expect(update(layer).cornerRadius).toBeGreaterThan(0);
    });
});

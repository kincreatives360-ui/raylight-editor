import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AreaGizmo } from './SceneLighting';

describe('AreaGizmo geometry lifecycle & memory safety', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    beforeAll(() => {
        (globalThis as unknown as { HTMLIFrameElement: unknown }).HTMLIFrameElement = class HTMLIFrameElement {};
        (globalThis as unknown as { Element: unknown }).Element = class Element {};
        (globalThis as unknown as { HTMLElement: unknown }).HTMLElement = class HTMLElement {};
        (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

        const doc = {
            nodeType: 9,
            defaultView: globalThis,
            createElement: (tag: string) => {
                const el: {
                    tagName: string;
                    nodeType: number;
                    ownerDocument: typeof doc;
                    children: unknown[];
                    style: Record<string, string>;
                    setAttribute: () => void;
                    removeAttribute: () => void;
                    appendChild: (c: unknown) => void;
                    removeChild: (c: unknown) => void;
                    insertBefore: (c: unknown) => void;
                    addEventListener: () => void;
                    removeEventListener: () => void;
                } = {
                    tagName: tag.toUpperCase(),
                    nodeType: 1,
                    ownerDocument: doc,
                    children: [],
                    style: {},
                    setAttribute: () => {},
                    removeAttribute: () => {},
                    appendChild: (c) => el.children.push(c),
                    removeChild: (c) => {
                        const i = el.children.indexOf(c);
                        if (i !== -1) el.children.splice(i, 1);
                    },
                    insertBefore: (c) => el.children.push(c),
                    addEventListener: () => {},
                    removeEventListener: () => {},
                };
                return el;
            },
            createComment: () => ({ nodeType: 8, ownerDocument: doc }),
            createTextNode: (t: string) => ({ nodeType: 3, textContent: t, ownerDocument: doc }),
            body: { appendChild: () => {}, removeChild: () => {} },
            addEventListener: () => {},
            removeEventListener: () => {},
        };

        (globalThis as unknown as { window: unknown }).window = globalThis;
        (globalThis as unknown as { document: unknown }).document = doc;
    });

    afterAll(() => {
        (globalThis as unknown as { window: unknown }).window = originalWindow;
        (globalThis as unknown as { document: unknown }).document = originalDocument;
    });

    it('creates edges geometry and disposes previous edges on dimension change and unmount', async () => {
        const planeDisposeSpy = vi.spyOn(THREE.PlaneGeometry.prototype, 'dispose');
        const edgesDisposeSpy = vi.spyOn(THREE.EdgesGeometry.prototype, 'dispose');

        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);

        // Mount the component
        await act(async () => {
            root.render(React.createElement(AreaGizmo, {
                position: [0, 0, 0],
                width: 4,
                height: 2.5,
                colorHex: '#ffffff',
            }));
        });

        // The intermediate plane must be disposed immediately to prevent leaking buffer attributes
        expect(planeDisposeSpy).toHaveBeenCalled();
        expect(edgesDisposeSpy).not.toHaveBeenCalled();

        // Change its dimensions to trigger a rerender
        await act(async () => {
            root.render(React.createElement(AreaGizmo, {
                position: [0, 0, 0],
                width: 6,
                height: 3.5,
                colorHex: '#ffffff',
            }));
        });

        // Changing dimensions must trigger useEffect cleanup disposing the previous edges geometry
        expect(edgesDisposeSpy).toHaveBeenCalledTimes(1);

        // Unmount the component
        await act(async () => {
            root.unmount();
        });

        // Unmounting must dispose the final edges geometry via useEffect cleanup
        expect(edgesDisposeSpy).toHaveBeenCalledTimes(2);

        planeDisposeSpy.mockRestore();
        edgesDisposeSpy.mockRestore();
    });
});

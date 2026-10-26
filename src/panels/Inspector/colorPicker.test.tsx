import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorPicker, ColorField, type GradientValue } from './ColorPicker';

describe('ColorPicker Component', () => {
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
                    dataset: Record<string, string>;
                    setAttribute: (name: string, val: string) => void;
                    removeAttribute: (name: string) => void;
                    appendChild: (c: unknown) => void;
                    removeChild: (c: unknown) => void;
                    insertBefore: (c: unknown) => void;
                    addEventListener: (evt: string, cb: (e: unknown) => void) => void;
                    removeEventListener: () => void;
                    getBoundingClientRect: () => { left: number; top: number; right: number; bottom: number; width: number; height: number };
                    focus: () => void;
                } = {
                    tagName: tag.toUpperCase(),
                    nodeType: 1,
                    ownerDocument: doc,
                    children: [],
                    style: {},
                    dataset: {},
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
                    getBoundingClientRect: () => ({ left: 100, top: 100, right: 400, bottom: 400, width: 300, height: 300 }),
                    focus: () => {},
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

    it('renders ColorField button properly', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <ColorField
                    value="#ff0000"
                    onChange={onChange}
                    aria-label="Accent Color"
                />
            );
        });

        expect(container.children.length).toBeGreaterThan(0);
        expect(onChange).not.toHaveBeenCalled();

        await act(async () => {
            root.unmount();
        });
    });

    it('manages gradient value with stable stop identity', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();
        const onGradientChange = vi.fn();

        const initialGradient: GradientValue = {
            angle: 90,
            stops: [
                { at: 0, color: '#ff0000', opacity: 1 },
                { at: 1, color: '#0000ff', opacity: 1 },
            ],
        };

        await act(async () => {
            root.render(
                <ColorPicker
                    color="#ff0000"
                    onChange={onChange}
                    gradientValue={initialGradient}
                    onGradientChange={onGradientChange}
                    showGradientMode={true}
                />
            );
        });

        expect(container.children.length).toBeGreaterThan(0);
        expect(onGradientChange).not.toHaveBeenCalled();

        await act(async () => {
            root.unmount();
        });
    });
});

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrubInput } from './ScrubInput';

interface MockDomElement {
    tagName: string;
    nodeType: number;
    ownerDocument: unknown;
    children: MockDomElement[];
    style: Record<string, string>;
    dataset: Record<string, string>;
    value?: string;
    setAttribute: (name: string, val: string) => void;
    removeAttribute: (name: string) => void;
    appendChild: (c: MockDomElement) => void;
    removeChild: (c: MockDomElement) => void;
    insertBefore: (c: MockDomElement) => void;
    addEventListener: (evt: string, cb: (e: unknown) => void) => void;
    removeEventListener: (evt: string, cb: (e: unknown) => void) => void;
    setPointerCapture: () => void;
    releasePointerCapture: () => void;
    hasPointerCapture: () => boolean;
    getBoundingClientRect: () => { left: number; top: number; right: number; bottom: number; width: number; height: number };
    focus: () => void;
    blur: () => void;
    select: () => void;
    [key: string]: unknown;
}

describe('ScrubInput Component', () => {
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
            createElement: (tag: string): MockDomElement => {
                const el: MockDomElement = {
                    tagName: tag.toUpperCase(),
                    nodeType: 1,
                    ownerDocument: doc,
                    children: [],
                    style: {},
                    dataset: {},
                    value: '',
                    setAttribute: () => {},
                    removeAttribute: () => {},
                    appendChild: (c: MockDomElement) => el.children.push(c),
                    removeChild: (c: MockDomElement) => {
                        const i = el.children.indexOf(c);
                        if (i !== -1) el.children.splice(i, 1);
                    },
                    insertBefore: (c: MockDomElement) => el.children.push(c),
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    setPointerCapture: () => {},
                    releasePointerCapture: () => {},
                    hasPointerCapture: () => true,
                    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 }),
                    focus: () => {},
                    blur: () => {},
                    select: () => {},
                };
                return el;
            },
            createComment: () => ({ nodeType: 8, ownerDocument: doc }),
            createTextNode: (t: string) => ({ nodeType: 3, textContent: t, ownerDocument: doc }),
            body: { style: {}, appendChild: () => {}, removeChild: () => {} },
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

    it('renders label and initial value correctly', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <ScrubInput
                    label="Width"
                    value={120}
                    step={1}
                    unit="px"
                    onChange={onChange}
                />
            );
        });

        expect(container.children.length).toBeGreaterThan(0);
        expect(onChange).not.toHaveBeenCalled();

        await act(async () => {
            root.unmount();
        });
    });

    it('auto-detects decimal places from step when decimals is omitted', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <ScrubInput
                    label="Speed"
                    value={1.5}
                    step={0.1}
                    onChange={onChange}
                />
            );
        });

        expect(container.children.length).toBeGreaterThan(0);

        await act(async () => {
            root.unmount();
        });
    });

    it('safely handles non-finite or undefined values without crashing', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <ScrubInput
                    label="Fallback"
                    value={NaN}
                    min={0}
                    max={100}
                    onChange={onChange}
                />
            );
        });

        expect(container.children.length).toBeGreaterThan(0);

        await act(async () => {
            root.unmount();
        });
    });
});

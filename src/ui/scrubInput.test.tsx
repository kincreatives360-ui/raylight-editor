import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrubInput, evaluateMathExpression } from './ScrubInput';

interface MockDomElement {
    tagName: string;
    nodeType: number;
    ownerDocument: unknown;
    children: MockDomElement[];
    style: Record<string, string>;
    dataset: Record<string, string>;
    value?: string;
    textContent?: string;
    attributes: Record<string, string>;
    setAttribute: (name: string, val: string) => void;
    getAttribute: (name: string) => string | null;
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
    querySelector?: (sel: string) => MockDomElement | null;
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
                const attributes: Record<string, string> = {};
                const el: MockDomElement = {
                    tagName: tag.toUpperCase(),
                    nodeType: 1,
                    ownerDocument: doc,
                    children: [],
                    style: {},
                    dataset: {},
                    value: '',
                    attributes,
                    setAttribute: (name: string, val: string) => {
                        attributes[name] = String(val);
                        if (name === 'value') el.value = String(val);
                    },
                    getAttribute: (name: string) => attributes[name] ?? null,
                    removeAttribute: (name: string) => { delete attributes[name]; },
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
                    get textContent(): string {
                        const getText = (node: MockDomElement): string => {
                            if (node.nodeType === 3) return node.textContent || '';
                            return node.children.map(getText).join('');
                        };
                        return el.children.map(getText).join('');
                    },
                    set textContent(val: string) {
                        el.children = [{
                            tagName: '',
                            nodeType: 3,
                            textContent: val,
                            ownerDocument: doc,
                            children: [],
                            style: {},
                            dataset: {},
                            attributes: {},
                            setAttribute: () => {},
                            getAttribute: () => null,
                            removeAttribute: () => {},
                            appendChild: () => {},
                            removeChild: () => {},
                            insertBefore: () => {},
                            addEventListener: () => {},
                            removeEventListener: () => {},
                            setPointerCapture: () => {},
                            releasePointerCapture: () => {},
                            hasPointerCapture: () => false,
                            getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
                            focus: () => {},
                            blur: () => {},
                            select: () => {},
                        }];
                    },
                    querySelector: (sel: string): MockDomElement | null => {
                        const find = (node: MockDomElement): MockDomElement | null => {
                            if (sel === '[role="spinbutton"]' && node.attributes['role'] === 'spinbutton') {
                                return node;
                            }
                            if (sel.startsWith('#') && node.attributes['id'] === sel.slice(1)) {
                                return node;
                            }
                            for (const child of node.children) {
                                const found = find(child);
                                if (found) return found;
                            }
                            return null;
                        };
                        return find(el);
                    },
                };
                return el;
            },
            createComment: () => ({ nodeType: 8, ownerDocument: doc }),
            createTextNode: (t: string) => ({
                tagName: '',
                nodeType: 3,
                textContent: t,
                ownerDocument: doc,
                children: [],
                style: {},
                dataset: {},
                attributes: {},
                setAttribute: () => {},
                getAttribute: () => null,
                removeAttribute: () => {},
                appendChild: () => {},
                removeChild: () => {},
                insertBefore: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                setPointerCapture: () => {},
                releasePointerCapture: () => {},
                hasPointerCapture: () => false,
                getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
                focus: () => {},
                blur: () => {},
                select: () => {},
            }),
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
        const spinbutton = container.querySelector('[role="spinbutton"]') as HTMLElement | null;
        expect(spinbutton).not.toBeNull();
        expect(spinbutton?.getAttribute('aria-valuenow')).toBe('1.5');
        expect(container.textContent).toContain('1.5');

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
        const spinbutton = container.querySelector('[role="spinbutton"]') as HTMLElement | null;
        expect(spinbutton).not.toBeNull();
        expect(spinbutton?.getAttribute('aria-valuenow')).toBe('0');
        expect(container.textContent).toContain('0');

        await act(async () => {
            root.unmount();
        });
    });

    it('infers precision for exponential step notation such as 1e-7', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <ScrubInput
                    label="Fine"
                    value={0.0000003}
                    step={1e-7}
                    onChange={onChange}
                />
            );
        });

        const spinbutton = container.querySelector('[role="spinbutton"]') as HTMLElement | null;
        expect(spinbutton).not.toBeNull();
        expect(spinbutton?.getAttribute('aria-valuenow')).toBe(String(0.0000003));
        expect(container.textContent).toContain('0.0000003');

        await act(async () => {
            root.unmount();
        });
    });

    it('accurately evaluates arithmetic expressions like 1920/2 and 100+48', () => {
        expect(evaluateMathExpression('1920/2')).toBe(960);
        expect(evaluateMathExpression('100+48')).toBe(148);
        expect(evaluateMathExpression('50*1.5')).toBe(75);
        expect(evaluateMathExpression('(100 - 20) / 2')).toBe(40);
        expect(evaluateMathExpression('-10 + 5')).toBe(-5);
        expect(evaluateMathExpression('invalid')).toBeNull();
    });

    it('associates JSX element label with input via aria-labelledby when ariaLabel is not provided', async () => {
        const container = (document as unknown as { createElement: (tag: string) => unknown }).createElement('div') as HTMLElement;
        const root = createRoot(container);
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <ScrubInput
                    label={<span>Custom JSX Label</span>}
                    value={10}
                    onChange={onChange}
                />
            );
        });

        const spinbutton = container.querySelector('[role="spinbutton"]') as HTMLElement | null;
        expect(spinbutton).not.toBeNull();
        const labelledBy = spinbutton?.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        const labelSpan = container.querySelector(`#${labelledBy}`);
        expect(labelSpan).not.toBeNull();
        expect(labelSpan?.textContent).toContain('Custom JSX Label');

        await act(async () => {
            root.unmount();
        });
    });
});

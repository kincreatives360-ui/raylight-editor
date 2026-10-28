import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AudioClip } from '../model/types';
import { AudioClipBar } from '../panels/Timeline/AudioClipBar';
import { TransitionPill } from '../panels/Timeline/TransitionPill';
import { LayerEffectCard } from '../panels/Inspector/sections/LayerEffectCard';
import { InlineRenameInput } from './InlineRenameInput';

type ElementProps = {
    children?: ReactNode;
    title?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onPointerDown?: React.PointerEventHandler<HTMLElement>;
};

function findByTitle(node: ReactElement, title: string): ReactElement<ElementProps> {
    const result = findByTitleOrNull(node, title);
    if (result) return result;
    throw new Error(`Missing control: ${title}`);
}

function findByTitleOrNull(node: ReactElement, title: string): ReactElement<ElementProps> | null {
    const element = node as ReactElement<ElementProps>;
    if (element.props.title === title) return element;
    for (const child of Children.toArray(element.props.children)) {
        if (isValidElement(child)) {
            const result = findByTitleOrNull(child, title);
            if (result) return result;
        }
    }
    return null;
}

function pointerEvent() {
    return { stopPropagation: vi.fn(), preventDefault: vi.fn() } as unknown as React.PointerEvent<HTMLElement>;
}

describe('shared timeline controls', () => {
    it('routes audio move/trim gestures and prevents delete clicks from seeking', () => {
        const clip = { id: 'audio', name: 'Music', durationMs: 2000 } as AudioClip;
        const onDrag = vi.fn(), onSeek = vi.fn(), onDelete = vi.fn();
        const bar = AudioClipBar({ clip, left: 25, width: 100, muted: false, onDrag, onSeek, onDelete });
        const event = pointerEvent();
        bar.props.onPointerDown(event);
        findByTitle(bar, 'Trim audio start').props.onPointerDown!(event);
        findByTitle(bar, 'Trim audio end').props.onPointerDown!(event);
        expect(onDrag.mock.calls.map(call => call[1])).toEqual(['move', 'left', 'right']);
        const remove = findByTitle(bar, 'Delete audio clip');
        remove.props.onPointerDown!(event);
        remove.props.onClick!(event);
        expect(event.stopPropagation).toHaveBeenCalledTimes(2);
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onSeek).not.toHaveBeenCalled();
        bar.props.onClick(event);
        expect(onSeek).toHaveBeenCalledOnce();
    });

    for (const side of ['entrance', 'exit'] as const) {
        it(`routes ${side} trim gestures and retains its distinct edge hints`, () => {
            const onDrag = vi.fn(), onClick = vi.fn();
            const pill = TransitionPill({ side, left: 20, width: 50, selected: true, ghosted: false,
                easing: { kind: 'preset', name: side === 'entrance' ? 'ease-out' : 'ease-in' }, onDrag, onClick });
            const left = side === 'entrance' ? 'Drag left edge to adjust In delay & length' : 'Drag left edge to resize Out duration';
            const right = side === 'entrance' ? 'Drag right edge to resize In duration' : 'Drag right edge to adjust Out end point';
            const event = pointerEvent();
            pill.props.onPointerDown(event);
            findByTitle(pill, left).props.onPointerDown!(event);
            findByTitle(pill, right).props.onPointerDown!(event);
            expect(onDrag.mock.calls.map(call => call[1])).toEqual(['move', 'left', 'right']);
            pill.props.onClick(event);
            expect(onClick).toHaveBeenCalledWith(event);
            expect(renderToStaticMarkup(pill)).toContain(`data-preset-pill="${side === 'entrance' ? 'in' : 'out'}"`);
        });
    }
});

describe('shared inspector controls', () => {
    it('removes an effect without toggling its disclosure', () => {
        const onRemove = vi.fn();
        const card = LayerEffectCard({ title: 'Glow', icon: <span />, onRemove, children: <span>Parameters</span> });
        const event = pointerEvent();
        findByTitle(card, 'Remove Glow').props.onClick!(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(onRemove).toHaveBeenCalledOnce();
        expect(renderToStaticMarkup(card)).toContain('Parameters');
    });

    it('commits the current name on Enter or blur and cancels on Escape', () => {
        const onCommit = vi.fn(), onCancel = vi.fn();
        const input = InlineRenameInput({ defaultValue: 'Old name', onCommit, onCancel });
        const event = { key: 'Enter', currentTarget: { value: 'New name' }, stopPropagation: vi.fn(), preventDefault: vi.fn() };
        input.props.onKeyDown(event as unknown as React.KeyboardEvent<HTMLInputElement>);
        expect(onCommit).toHaveBeenCalledWith('New name');
        onCommit.mockClear();
        input.props.onKeyDown({ ...event, key: 'Escape' } as unknown as React.KeyboardEvent<HTMLInputElement>);
        expect(onCancel).toHaveBeenCalledOnce();
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(onCommit).not.toHaveBeenCalled();
        input.props.onBlur(event as unknown as React.FocusEvent<HTMLInputElement>);
        expect(onCommit).toHaveBeenCalledWith('New name');
        expect(event.stopPropagation).toHaveBeenCalledTimes(2);
    });
});

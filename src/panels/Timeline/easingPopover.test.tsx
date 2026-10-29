import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EasingPopover } from './EasingPopover';

describe('EasingPopover Component', () => {
    it('renders dual-pane easing editor with presets list and SVG curve editor', () => {
        const handleChange = vi.fn();
        const handleClose = vi.fn();

        const html = renderToStaticMarkup(
            <EasingPopover
                easing={{ kind: 'preset', name: 'ease-in-out' }}
                onChange={handleChange}
                onClose={handleClose}
            />
        );

        // Header
        expect(html).toContain('Easing curve');

        // Left pane presets
        expect(html).toContain('Presets');
        expect(html).toContain('Ease In Out');
        expect(html).toContain('Linear');
        expect(html).toContain('Ease Back');
        expect(html).toContain('Expo Out');
        expect(html).toContain('Spring Gentle');
        expect(html).toContain('Spring Bouncy');

        // Right pane coordinates
        expect(html).toContain('X1');
        expect(html).toContain('Y1');
        expect(html).toContain('X2');
        expect(html).toContain('Y2');
    });
});


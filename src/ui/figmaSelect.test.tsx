import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FigmaSelect } from './FigmaSelect';

describe('FigmaSelect trigger', () => {
    it('resolves the selected label inside fragments and grouped options', () => {
        const html = renderToStaticMarkup(<FigmaSelect value="portrait" aria-label="Aspect ratio">
            <><optgroup label="Formats"><option value="landscape">Landscape</option><option value="portrait">Portrait 9:16</option></optgroup></>
        </FigmaSelect>);
        expect(html).toContain('role="combobox"');
        expect(html).toContain('aria-label="Aspect ratio"');
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('Portrait 9:16');
        expect(html).not.toContain('<select');
        expect(html).not.toContain('role="listbox"');
    });

    it('keeps a locked light-type control disabled', () => {
        const html = renderToStaticMarkup(<FigmaSelect disabled value="sun" aria-label="Light type">
            <option value="sun">Sun</option><option value="point">Point</option>
        </FigmaSelect>);
        expect(html).toMatch(/<button[^>]*disabled=""/);
        expect(html).toContain('Sun');
    });
});

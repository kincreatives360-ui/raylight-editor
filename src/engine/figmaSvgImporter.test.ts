// src/engine/figmaSvgImporter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseFigmaSvgToLayers } from './figmaSvgImporter';
import type { ShapeLayer, TextLayer, ImageLayer } from '../model/types';

class MockElement {
  tagName: string;
  attrs: Record<string, string>;
  textContent: string;
  children: MockElement[] = [];
  parentElement: MockElement | null = null;

  constructor(tagName: string, attrs: Record<string, string> = {}, textContent = '') {
    this.tagName = tagName.toLowerCase();
    this.attrs = attrs;
    this.textContent = textContent;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  closest(selector: string): MockElement | null {
    const tags = selector.split(',').map((s) => s.trim().toLowerCase());
    let curr = this.parentElement;
    while (curr) {
      if (tags.includes(curr.tagName)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const tags = selector.split(',').map((s) => s.trim().toLowerCase());
    const results: MockElement[] = [];
    const walk = (node: MockElement) => {
      for (const child of node.children) {
        if (tags.includes(child.tagName)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function parseMockSvg(svgText: string): MockElement {
  const root = new MockElement('root');
  const stack: MockElement[] = [root];

  // Regex to match tags and attributes
  const tokenRegex = /<([a-zA-Z0-9:-]+)([^>]*?)(\/?>)|<\/([a-zA-Z0-9:-]+)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(svgText)) !== null) {
    const [, openTag, attrStr, selfClose, closeTag, text] = match;
    if (openTag) {
      const attrs: Record<string, string> = {};
      const attrRegex = /([a-zA-Z0-9:-]+)=["']([^"']*)["']/g;
      let aMatch: RegExpExecArray | null;
      while ((aMatch = attrRegex.exec(attrStr)) !== null) {
        attrs[aMatch[1]] = aMatch[2];
      }
      const el = new MockElement(openTag, attrs);
      const parent = stack[stack.length - 1];
      el.parentElement = parent;
      parent.children.push(el);
      if (!selfClose || !selfClose.includes('/')) {
        stack.push(el);
      }
    } else if (closeTag) {
      if (stack.length > 1 && stack[stack.length - 1].tagName === closeTag.toLowerCase()) {
        stack.pop();
      }
    } else if (text && text.trim()) {
      const current = stack[stack.length - 1];
      if (current) {
        current.textContent = (current.textContent + ' ' + text.trim()).trim();
      }
    }
  }

  return root;
}

class MockDOMParser {
  parseFromString(text: string): {
    querySelector: (sel: string) => MockElement | null;
    querySelectorAll: (sel: string) => MockElement[];
  } {
    const doc = parseMockSvg(text);
    return {
      querySelector: (sel: string) => doc.querySelector(sel),
      querySelectorAll: (sel: string) => doc.querySelectorAll(sel),
    };
  }
}

describe('parseFigmaSvgToLayers', () => {
  const originalDOMParser = (globalThis as unknown as { DOMParser?: unknown }).DOMParser;

  beforeEach(() => {
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = MockDOMParser;
  });

  afterEach(() => {
    if (originalDOMParser !== undefined) {
      (globalThis as unknown as { DOMParser: unknown }).DOMParser = originalDOMParser;
    } else {
      delete (globalThis as unknown as { DOMParser?: unknown }).DOMParser;
    }
  });

  it('1. Returns empty layers and assets if DOMParser is unavailable', () => {
    delete (globalThis as unknown as { DOMParser?: unknown }).DOMParser;
    const res = parseFigmaSvgToLayers('<svg></svg>', 4000, 0);
    expect(res.layers).toEqual([]);
    expect(res.assets).toEqual({});
  });

  it('2. Parses <rect> elements into ShapeLayer with normalized coordinates and colors', () => {
    const svg = `
      <svg width="1000" height="500" viewBox="0 0 1000 500">
        <rect id="card-bg" x="100" y="50" width="800" height="400" rx="20" fill="#1e293b" opacity="0.9" />
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(1);

    const layer = res.layers[0] as ShapeLayer;
    expect(layer.kind).toBe('shape');
    expect(layer.name).toBe('card-bg');
    expect(layer.shape).toBe('rectangle');
    // Center X: (100 + 400) / 1000 - 0.5 = 0
    expect(layer.position.x).toBe(0);
    // Center Y: (50 + 200) / 500 - 0.5 = 0
    expect(layer.position.y).toBe(0);
    // Width fraction: 800 / 1000 = 0.8
    expect(layer.size.width).toBe(0.8);
    // Height fraction: 400 / 500 = 0.8
    expect(layer.size.height).toBe(0.8);
    expect(layer.fill.kind).toBe('solid');
    if (layer.fill.kind === 'solid') {
      expect(layer.fill.color).toBe('#1e293b');
    }
    expect(layer.opacity).toBe(0.9);
  });

  it('3. Skips full-bleed background rect (>98% coverage at 0,0) when foreground layers exist', () => {
    const svg = `
      <svg width="1000" height="600">
        <rect id="canvas-bg" x="0" y="0" width="1000" height="600" fill="#000000" />
        <rect id="button" x="200" y="200" width="200" height="80" rx="8" fill="#6366f1" />
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(1);
    expect(res.layers[0].name).toBe('button');
  });

  it('4. Parses <circle> and <ellipse> into ShapeLayers', () => {
    const svg = `
      <svg width="1000" height="1000">
        <circle id="avatar-circle" cx="500" cy="500" r="100" fill="#ef4444" />
        <ellipse id="badge-pill" cx="200" cy="200" rx="80" ry="40" fill="#10b981" />
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(2);

    const circle = res.layers[0] as ShapeLayer;
    expect(circle.shape).toBe('ellipse');
    expect(circle.position.x).toBe(0);
    expect(circle.position.y).toBe(0);
    expect(circle.size.width).toBe(0.2); // (100 * 2) / 1000
    if (circle.fill.kind === 'solid') {
      expect(circle.fill.color).toBe('#ef4444');
    }

    const ellipse = res.layers[1] as ShapeLayer;
    expect(ellipse.shape).toBe('ellipse');
    expect(ellipse.size.width).toBe(0.16); // (80 * 2) / 1000
    expect(ellipse.size.height).toBe(0.08); // (40 * 2) / 1000
    if (ellipse.fill.kind === 'solid') {
      expect(ellipse.fill.color).toBe('#10b981');
    }
  });

  it('5. Parses <line> elements into ShapeLayers', () => {
    const svg = `
      <svg width="1000" height="500">
        <line id="divider" x1="100" y1="250" x2="900" y2="250" stroke="#94a3b8" />
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(1);
    const line = res.layers[0] as ShapeLayer;
    expect(line.shape).toBe('line');
    expect(line.stroke?.color).toBe('#94a3b8');
  });

  it('6. Parses <text> into editable TextLayer with typography settings', () => {
    const svg = `
      <svg width="1200" height="800">
        <text id="hero-title" x="600" y="400" font-size="48" font-weight="bold" fill="#f8fafc" text-anchor="middle">
          Design at the Speed of Light
        </text>
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(1);

    const text = res.layers[0] as TextLayer;
    expect(text.kind).toBe('text');
    expect(text.content).toBe('Design at the Speed of Light');
    expect(text.font.weight).toBe(700);
    expect(text.font.align).toBe('center');
    expect(text.font.color).toBe('#f8fafc');
    expect(text.font.size).toBeCloseTo(48 / 800, 3);
  });

  it('7. Parses <image> elements into ImageLayers and asset dictionary', () => {
    const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const svg = `
      <svg width="1000" height="600">
        <image id="photo-layer" x="100" y="50" width="400" height="300" href="${testDataUrl}" />
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(1);

    const img = res.layers[0] as ImageLayer;
    expect(img.kind).toBe('image');
    expect(img.name).toBe('photo-layer');
    expect(res.assets[img.assetId]).toBeDefined();
    expect(res.assets[img.assetId].dataUrl).toBe(testDataUrl);
  });

  it('8. Fallback vector artwork creates single ImageLayer when only custom <path> exists', () => {
    const svg = `
      <svg width="800" height="600">
        <path d="M10 80 Q 95 10 180 80" stroke="black" fill="transparent"/>
      </svg>
    `;

    const res = parseFigmaSvgToLayers(svg, 4000, 0);
    expect(res.layers.length).toBe(1);
    const fallback = res.layers[0] as ImageLayer;
    expect(fallback.name).toBe('Pasted Figma Vector');
    expect(fallback.kind).toBe('image');
  });

  it('9. Edge case: protects against 0-dimension SVG without producing NaN or Infinity', () => {
    const zeroSvg = `
      <svg width="0" height="0">
        <rect x="0" y="0" width="10" height="10" fill="#ffffff" />
      </svg>
    `;

    const res = parseFigmaSvgToLayers(zeroSvg, 4000, 0);
    expect(res.layers.length).toBe(1);
    const rect = res.layers[0] as ShapeLayer;
    expect(Number.isFinite(rect.position.x)).toBe(true);
    expect(Number.isFinite(rect.position.y)).toBe(true);
    expect(Number.isFinite(rect.size.width)).toBe(true);
    expect(Number.isFinite(rect.size.height)).toBe(true);
  });
});

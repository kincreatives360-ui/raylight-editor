// src/engine/fontLoader.ts
// Dynamic Google Fonts Loader & Font Catalog for Raylight Editor

export interface FontDefinition {
    name: string;
    family: string;
    category: 'Sans-Serif' | 'Display' | 'Serif' | 'Monospace' | 'Handwriting' | 'System';
    googleQuery?: string;
}

export const POPULAR_FONTS: FontDefinition[] = [
    // Sans-Serif (Modern UI)
    { name: 'Inter', family: 'Inter, sans-serif', category: 'Sans-Serif', googleQuery: 'Inter:wght@300;400;500;600;700;800;900' },
    { name: 'Outfit', family: 'Outfit, sans-serif', category: 'Sans-Serif', googleQuery: 'Outfit:wght@300;400;500;600;700;800;900' },
    { name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif', category: 'Sans-Serif', googleQuery: 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800' },
    { name: 'Montserrat', family: 'Montserrat, sans-serif', category: 'Sans-Serif', googleQuery: 'Montserrat:wght@300;400;500;600;700;800;900' },
    { name: 'Roboto', family: 'Roboto, sans-serif', category: 'Sans-Serif', googleQuery: 'Roboto:wght@300;400;500;700;900' },

    // Display & Expressive
    { name: 'Space Grotesk', family: '"Space Grotesk", sans-serif', category: 'Display', googleQuery: 'Space+Grotesk:wght@300;400;500;600;700' },
    { name: 'Syne', family: 'Syne, sans-serif', category: 'Display', googleQuery: 'Syne:wght@400;500;600;700;800' },
    { name: 'Bebas Neue', family: '"Bebas Neue", sans-serif', category: 'Display', googleQuery: 'Bebas+Neue' },
    { name: 'Cinzel', family: 'Cinzel, serif', category: 'Display', googleQuery: 'Cinzel:wght@400;600;700;900' },

    // Editorial & Serif
    { name: 'Playfair Display', family: '"Playfair Display", serif', category: 'Serif', googleQuery: 'Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400' },
    { name: 'Lora', family: 'Lora, serif', category: 'Serif', googleQuery: 'Lora:ital,wght@0,400;0,500;0,600;0,700;1,400' },

    // Monospace & Technical
    { name: 'JetBrains Mono', family: '"JetBrains Mono", monospace', category: 'Monospace', googleQuery: 'JetBrains+Mono:wght@300;400;500;600;700' },
    { name: 'Fira Code', family: '"Fira Code", monospace', category: 'Monospace', googleQuery: 'Fira+Code:wght@300;400;500;600;700' },

    // Creative & Script
    { name: 'Caveat', family: 'Caveat, cursive', category: 'Handwriting', googleQuery: 'Caveat:wght@400;600;700' },

    // System Fallbacks
    { name: 'System Sans', family: 'sans-serif', category: 'System' },
    { name: 'System Serif', family: 'serif', category: 'System' },
    { name: 'System Mono', family: 'monospace', category: 'System' },
];

export const POPULAR_FONT_NAMES: string[] = POPULAR_FONTS.map((f) => f.name);

const loadedFonts = new Set<string>([
    'sans-serif',
    'serif',
    'monospace',
    'system-ui',
    'arial',
    'helvetica',
]);

/**
 * Dynamically injects and activates Google Fonts via CSS stylesheet link into document.head.
 */
export async function loadGoogleFont(rawFontName: string): Promise<boolean> {
    if (typeof window === 'undefined' || !rawFontName) return true;

    // Clean font family string (e.g. '"Space Grotesk", sans-serif' -> 'Space Grotesk')
    const primaryName = rawFontName.split(',')[0].replace(/["']/g, '').trim();
    if (!primaryName || loadedFonts.has(primaryName.toLowerCase())) {
        return true;
    }

    const matchedDef = POPULAR_FONTS.find(
        (f) => f.name.toLowerCase() === primaryName.toLowerCase()
    );

    // If it's a pure system font, no need to download
    if (matchedDef?.category === 'System') {
        loadedFonts.add(primaryName.toLowerCase());
        return true;
    }

    const query = matchedDef?.googleQuery || `${encodeURIComponent(primaryName)}:wght@300;400;500;600;700;800`;
    const elementId = `raylight-font-${primaryName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    if (!document.getElementById(elementId)) {
        const link = document.createElement('link');
        link.id = elementId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
        document.head.appendChild(link);
    }

    try {
        if ('fonts' in document) {
            // Await font readiness with a safety timeout so slow networks do not freeze UI
            const fontCheckPromise = document.fonts.load(`16px "${primaryName}"`);
            const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2500));
            await Promise.race([fontCheckPromise, timeoutPromise]);
        }
        loadedFonts.add(primaryName.toLowerCase());
        return true;
    } catch {
        loadedFonts.add(primaryName.toLowerCase());
        return false;
    }
}

/**
 * Loads a local font file (.ttf, .otf, .woff, .woff2) into document.fonts using the FontFace API.
 */
export async function loadCustomFontFile(file: File): Promise<string> {
    const rawName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const buffer = await file.arrayBuffer();
    const fontFace = new FontFace(rawName, buffer);
    const loadedFace = await fontFace.load();
    (document.fonts as unknown as Set<FontFace>).add(loadedFace);
    loadedFonts.add(rawName.toLowerCase());
    return rawName;
}

/**
 * Scans all shots and text layers in a project to eagerly preload all required fonts.
 */
export async function preloadProjectFonts(project: {
    shots: Array<{ layers: Array<{ kind: string; font?: { family: string } }> }>;
}): Promise<void> {
    if (!project?.shots) return;
    const fontPromises: Promise<boolean>[] = [];
    for (const shot of project.shots) {
        for (const layer of shot.layers) {
            if (layer.kind === 'text' && layer.font?.family) {
                fontPromises.push(loadGoogleFont(layer.font.family));
            }
        }
    }
    await Promise.allSettled(fontPromises);
}

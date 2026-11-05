/**
 * Export capability registry.
 *
 * Single source of truth for which formats this browser can actually produce,
 * probed once per session. The UI reads this to disable unsupported options
 * with a reason; the engine uses it to pick fallbacks.
 */

export interface FormatCapability {
    available: boolean;
    /** Why it's unavailable, for display in the UI. */
    reason?: string;
}

export interface ExportCapabilities {
    mp4: FormatCapability;
    webm: FormatCapability;
    gif: FormatCapability;
    png: FormatCapability;
    pngSeq: FormatCapability;
}

let cached: ExportCapabilities | null = null;

/** Probes WebCodecs/muxer support. Resolved once; pass `{ refresh: true }` to re-probe. */
export async function getExportCapabilities(
    options: { refresh?: boolean } = {}
): Promise<ExportCapabilities> {
    if (cached && !options.refresh) return cached;

    const capabilities: ExportCapabilities = {
        mp4: { available: false },
        webm: { available: false },
        gif: { available: true },
        png: { available: true },
        pngSeq: { available: true },
    };

    if (typeof document !== 'undefined') {
        // GIF/PNG need 2D canvas + Blob; effectively universal in our targets.
        const probe = document.createElement('canvas').getContext('2d');
        if (!probe) {
            capabilities.gif = { available: false, reason: 'Canvas 2D is unavailable.' };
            capabilities.png = { available: false, reason: 'Canvas 2D is unavailable.' };
            capabilities.pngSeq = { available: false, reason: 'Canvas 2D is unavailable.' };
        }
    }

    try {
        const { mediabunnyLayer } = await import('./webCodecsExporter');
        const [mp4, mp4Audio, webm] = await Promise.all([
            mediabunnyLayer.isSupported('mp4', false),
            mediabunnyLayer.isSupported('mp4', true),
            mediabunnyLayer.isSupported('webm', true),
        ]);
        if (mp4) {
            capabilities.mp4 = {
                available: true,
                ...(mp4Audio ? {} : { reason: 'Video only — this browser cannot encode AAC audio.' }),
            };
        } else {
            capabilities.mp4 = {
                available: false,
                reason: 'This browser cannot encode H.264 (MP4) video.',
            };
        }
        capabilities.webm = webm
            ? { available: true }
            : { available: false, reason: 'This browser cannot encode WebM video.' };
    } catch {
        capabilities.mp4 = { available: false, reason: 'WebCodecs is unavailable.' };
        capabilities.webm = { available: false, reason: 'WebCodecs is unavailable.' };
    }

    cached = capabilities;
    return cached;
}

/**
 * Picks the best available video format for the requested one, honouring the
 * user's choice when possible and falling back with a note when not.
 * Pure decision function over an explicit capability set (injectable for tests).
 */
export function selectVideoFormat(
    requested: 'mp4' | 'webm',
    caps: ExportCapabilities
): { format: 'mp4' | 'webm'; fallbackNote?: string } {
    const requestedCap = caps[requested];
    if (requestedCap.available && !requestedCap.reason) {
        return { format: requested };
    }
    const alternate = requested === 'mp4' ? 'webm' : 'mp4';
    const label = (format: 'mp4' | 'webm'): string => (format === 'mp4' ? 'MP4' : 'WebM');
    if (caps[alternate].available && !caps[alternate].reason) {
        return {
            format: alternate,
            fallbackNote: `${label(requested)} is unavailable (${
                requestedCap.reason ?? 'unsupported'
            }); exporting ${label(alternate)} instead.`,
        };
    }
    throw new Error(
        requestedCap.reason ??
        `Neither ${label(requested)} nor WebM video can be encoded in this browser.`
    );
}

/** Async wrapper: probes (or uses cached) capabilities, then selects. */
export async function resolveVideoFormat(
    requested: 'mp4' | 'webm',
    options: { refresh?: boolean; capabilities?: ExportCapabilities } = {}
): Promise<{ format: 'mp4' | 'webm'; fallbackNote?: string }> {
    const caps = options.capabilities ?? (await getExportCapabilities(options));
    return selectVideoFormat(requested, caps);
}

/** Test hook: clears the probe cache. */
export function resetExportCapabilities(): void {
    cached = null;
}

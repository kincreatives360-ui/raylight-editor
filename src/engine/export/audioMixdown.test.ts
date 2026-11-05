import { describe, expect, it, vi, beforeEach } from 'vitest';
import { prepareAudioMixPlan, renderAudioMix, MIX_SAMPLE_RATE } from './audioMixdown';

const decodeMock = vi.hoisted(() => vi.fn());

vi.mock('../audioEngine', () => ({
    decodeAudioFromDataUrl: decodeMock,
}));

function fakeBuffer(durationSec: number, channels = 2): AudioBuffer {
    return {
        duration: durationSec,
        numberOfChannels: channels,
        sampleRate: 44100,
    } as unknown as AudioBuffer;
}

interface FakeParam {
    events: Array<{ method: string; value: number; time: number }>;
    setValueAtTime(value: number, time: number): void;
    linearRampToValueAtTime(value: number, time: number): void;
}

interface FakeNode {
    buffer?: AudioBuffer | null;
    gain?: FakeParam;
    connect(target: unknown): void;
    start(when: number, offset: number, duration: number): void;
}

function installOfflineAudioContext() {
    const sources: FakeNode[] = [];
    const gains: FakeNode[] = [];
    let lastLength = 0;
    const context = {
        destination: {},
        createBufferSource(): FakeNode {
            const node: FakeNode = {
                buffer: null,
                connect: vi.fn(),
                start: vi.fn(),
            };
            sources.push(node);
            return node;
        },
        createGain(): FakeNode {
            const param: FakeParam = {
                events: [],
                setValueAtTime(value, time) {
                    this.events.push({ method: 'set', value, time });
                },
                linearRampToValueAtTime(value, time) {
                    this.events.push({ method: 'ramp', value, time });
                },
            };
            const node: FakeNode = {
                gain: param,
                connect: vi.fn(),
                start: vi.fn(),
            };
            gains.push(node);
            return node;
        },
        startRendering: vi.fn(async () => fakeBuffer(lastLength / MIX_SAMPLE_RATE)),
    };
    const original = (globalThis as { OfflineAudioContext?: unknown }).OfflineAudioContext;
    (globalThis as { OfflineAudioContext?: unknown }).OfflineAudioContext = class {
        constructor(_channels: number, length: number, sampleRate: number) {
            expect(sampleRate).toBe(MIX_SAMPLE_RATE);
            lastLength = length;
            Object.assign(this, context);
        }
    };
    return {
        sources,
        gains,
        renderedLength: () => lastLength,
        restore() {
            (globalThis as { OfflineAudioContext?: unknown }).OfflineAudioContext = original;
        },
    };
}

const clip = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    name: `clip ${id}`,
    startMs: 0,
    durationMs: 1000,
    offsetMs: 0,
    volume: 1,
    muted: false,
    dataUrl: `data:audio/wav;base64,${id}`,
    ...overrides,
});

beforeEach(() => {
    decodeMock.mockReset();
});

describe('prepareAudioMixPlan', () => {
    it('decodes each unique source once and plans the mix', async () => {
        decodeMock.mockResolvedValue(fakeBuffer(5));
        const result = await prepareAudioMixPlan(
            [clip('a'), clip('b', { dataUrl: 'data:audio/wav;base64,a' })],
            { masterVolume: 0.5 },
            0,
            1000
        );
        // Two clips share one dataUrl → one decode.
        expect(decodeMock).toHaveBeenCalledTimes(1);
        expect(result).not.toBeNull();
        expect(result!.plan.entries).toHaveLength(2);
        expect(result!.plan.entries[0].gain).toBeCloseTo(0.5, 9);
        // Buffers are keyed by clip id for rendering.
        expect(result!.buffers.get('a')).toBeDefined();
        expect(result!.buffers.get('b')).toBeDefined();
    });

    it('returns null for a muted project (video-only export)', async () => {
        const result = await prepareAudioMixPlan([clip('a')], { muted: true }, 0, 1000);
        expect(result).toBeNull();
        expect(decodeMock).not.toHaveBeenCalled();
    });

    it('throws an honest error when a clip cannot be decoded', async () => {
        decodeMock.mockResolvedValue(null);
        await expect(
            prepareAudioMixPlan([clip('a')], {}, 0, 1000)
        ).rejects.toThrow(/could not be decoded/);
    });

    it('never silently produces silent output: decode failure aborts the export', async () => {
        decodeMock.mockRejectedValue(new Error('bad data'));
        await expect(
            prepareAudioMixPlan([clip('a')], {}, 0, 1000)
        ).rejects.toThrow('bad data');
    });
});

describe('renderAudioMix', () => {
    it('renders the plan sample-accurately through OfflineAudioContext', async () => {
        decodeMock.mockResolvedValue(fakeBuffer(5));
        const plan = await prepareAudioMixPlan(
            [clip('a', { startMs: 200, durationMs: 600 })],
            {},
            0,
            2000
        );
        const harness = installOfflineAudioContext();
        try {
            const mixed = await renderAudioMix(plan!);
            expect(mixed).toBeDefined();
            // Context length covers the full window.
            expect(harness.renderedLength()).toBe(2 * MIX_SAMPLE_RATE);
            expect(harness.sources).toHaveLength(1);
            // Source starts at dest offset with authored trim offset + duration.
            const startArgs = (harness.sources[0].start as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(startArgs[0]).toBeCloseTo(0.2, 6);
            expect(startArgs[1]).toBeCloseTo(0, 6);
            expect(startArgs[2]).toBeCloseTo(0.6, 6);
            // De-click gain automation present on both boundaries.
            const events = harness.gains[0].gain!.events;
            expect(events.some((e) => e.method === 'ramp' && e.value > 0)).toBe(true);
            expect(events.some((e) => e.method === 'ramp' && e.value === 0)).toBe(true);
        } finally {
            harness.restore();
        }
    });

    it('refuses to run without OfflineAudioContext', async () => {
        decodeMock.mockResolvedValue(fakeBuffer(1));
        const plan = await prepareAudioMixPlan([clip('a')], {}, 0, 500);
        const original = (globalThis as { OfflineAudioContext?: unknown }).OfflineAudioContext;
        delete (globalThis as { OfflineAudioContext?: unknown }).OfflineAudioContext;
        try {
            await expect(renderAudioMix(plan!)).rejects.toThrow(/OfflineAudioContext is required/);
        } finally {
            (globalThis as { OfflineAudioContext?: unknown }).OfflineAudioContext = original;
        }
    });

    it('honours cancellation before rendering', async () => {
        decodeMock.mockResolvedValue(fakeBuffer(1));
        const plan = await prepareAudioMixPlan([clip('a')], {}, 0, 500);
        const controller = new AbortController();
        controller.abort();
        await expect(
            renderAudioMix(plan!, { signal: controller.signal })
        ).rejects.toThrow(/cancelled/i);
    });
});

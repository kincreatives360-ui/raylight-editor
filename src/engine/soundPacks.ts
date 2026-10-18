// src/engine/soundPacks.ts
/**
 * Built-in curated sound effects library for motion graphics.
 * Generates high-fidelity 16-bit PCM WAV audio clips on demand.
 */

export interface BuiltinSoundItem {
    id: string;
    name: string;
    category: 'Transition' | 'UI & Tactile' | 'Impact & FX' | 'Notification';
    durationMs: number;
    description: string;
    generateWavDataUrl: () => string;
}

function encodePcmToWavDataUrl(sampleRate: number, samples: Float32Array): string {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true); // NumChannels (Mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample

    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        const val = s < 0 ? s * 0x8000 : s * 0x7fff;
        view.setInt16(offset, val, true);
        offset += 2;
    }

    // Convert ArrayBuffer to binary string and then Base64
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Cached generated data URLs so each sound is only synthesized once
const cachedSoundUrls = new Map<string, string>();

function getOrGenerate(id: string, generator: () => Float32Array, sampleRate = 44100): string {
    const existing = cachedSoundUrls.get(id);
    if (existing) return existing;
    const samples = generator();
    const dataUrl = encodePcmToWavDataUrl(sampleRate, samples);
    cachedSoundUrls.set(id, dataUrl);
    return dataUrl;
}

export const BUILTIN_SOUND_PACKS: BuiltinSoundItem[] = [
    {
        id: 'sfx-whoosh-fast',
        name: 'Fast Air Whoosh',
        category: 'Transition',
        durationMs: 420,
        description: 'Smooth aerodynamic transition whoosh for cuts and camera moves.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-whoosh-fast', () => {
                const sampleRate = 44100;
                const duration = 0.42;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const progress = t / duration;
                    const env = Math.sin(progress * Math.PI);
                    const noise = Math.random() * 2 - 1;
                    const freq = 320 + Math.sin(progress * Math.PI) * 1400;
                    const sine = Math.sin(2 * Math.PI * freq * t);
                    samples[i] = (noise * 0.65 + sine * 0.35) * env * 0.85;
                }
                return samples;
            }),
    },
    {
        id: 'sfx-ui-pop',
        name: 'Organic Bubble Pop',
        category: 'UI & Tactile',
        durationMs: 140,
        description: 'Crisp organic pop for button presses and layer entrances.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-ui-pop', () => {
                const sampleRate = 44100;
                const duration = 0.14;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const freq = 920 * Math.exp(-t * 22);
                    const env = Math.exp(-t * 32);
                    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.9;
                }
                return samples;
            }),
    },
    {
        id: 'sfx-camera-shutter',
        name: 'Camera Shutter Snap',
        category: 'UI & Tactile',
        durationMs: 220,
        description: 'Dual mechanical click and snap for screenshot reveals.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-camera-shutter', () => {
                const sampleRate = 44100;
                const duration = 0.22;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const click1 = t < 0.04 ? (Math.random() * 2 - 1) * Math.exp(-t * 120) : 0;
                    const t2 = t - 0.055;
                    const click2 = t2 > 0 && t2 < 0.08 ? (Math.random() * 2 - 1) * Math.exp(-t2 * 90) : 0;
                    samples[i] = (click1 * 0.7 + click2 * 0.85) * 0.95;
                }
                return samples;
            }),
    },
    {
        id: 'sfx-digital-chime',
        name: 'Success Bell Chime',
        category: 'Notification',
        durationMs: 680,
        description: 'Harmonic two-tone bell chime for milestones and highlights.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-digital-chime', () => {
                const sampleRate = 44100;
                const duration = 0.68;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const tone1 = Math.sin(2 * Math.PI * 659.25 * t) * Math.exp(-t * 7); // E5
                    const tone2 =
                        t > 0.08
                            ? Math.sin(2 * Math.PI * 987.77 * (t - 0.08)) * Math.exp(-(t - 0.08) * 5) // B5
                            : 0;
                    samples[i] = (tone1 * 0.5 + tone2 * 0.6) * 0.85;
                }
                return samples;
            }),
    },
    {
        id: 'sfx-sub-boom',
        name: 'Cinematic Sub Impact',
        category: 'Impact & FX',
        durationMs: 1100,
        description: 'Deep 48Hz sub-bass punch for dramatic card and device drops.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-sub-boom', () => {
                const sampleRate = 44100;
                const duration = 1.1;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const freq = 65 * Math.exp(-t * 2.8) + 38;
                    const env = Math.exp(-t * 3.6);
                    const sine = Math.sin(2 * Math.PI * freq * t);
                    // Soft saturation
                    const saturated = Math.tanh(sine * 1.5);
                    samples[i] = saturated * env * 0.95;
                }
                return samples;
            }),
    },
    {
        id: 'sfx-tension-riser',
        name: 'Tension Riser Swell',
        category: 'Impact & FX',
        durationMs: 950,
        description: 'Building harmonic swell leading up to feature reveals.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-tension-riser', () => {
                const sampleRate = 44100;
                const duration = 0.95;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const progress = t / duration;
                    const env = Math.pow(progress, 1.8);
                    const freq = 160 + Math.pow(progress, 2.2) * 880;
                    const saw = (2 * ((t * freq) % 1)) - 1;
                    const noise = (Math.random() * 2 - 1) * 0.25;
                    samples[i] = (saw * 0.6 + noise) * env * 0.8;
                }
                return samples;
            }),
    },
    {
        id: 'sfx-cyber-glitch',
        name: 'Cybernetic Glitch Stutter',
        category: 'Impact & FX',
        durationMs: 320,
        description: 'Frequency-modulated digital stutter for glitch transitions.',
        generateWavDataUrl: () =>
            getOrGenerate('sfx-cyber-glitch', () => {
                const sampleRate = 44100;
                const duration = 0.32;
                const totalSamples = Math.floor(sampleRate * duration);
                const samples = new Float32Array(totalSamples);
                for (let i = 0; i < totalSamples; i++) {
                    const t = i / sampleRate;
                    const lfo = Math.sin(2 * Math.PI * 48 * t);
                    const freq = 440 + lfo * 320;
                    const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
                    const env = Math.exp(-t * 8);
                    samples[i] = square * env * 0.65;
                }
                return samples;
            }),
    },
];

import { describe, expect, it } from 'vitest';
import { createZip, crc32, frameEntryName } from './zipWriter';

const decoder = new TextDecoder();

describe('crc32', () => {
    it('matches the standard check vector', () => {
        // CRC-32 of ASCII "123456789" is the reference value 0xCBF43926.
        expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    });

    it('returns 0 for empty input', () => {
        expect(crc32(new Uint8Array(0))).toBe(0);
    });
});

describe('createZip', () => {
    it('rejects empty archives', () => {
        expect(() => createZip([])).toThrow();
    });

    it('writes valid local headers, central directory, and EOCD', async () => {
        const blob = createZip([
            { name: 'frame-000000.png', data: new Uint8Array([1, 2, 3]) },
            { name: 'frame-000001.png', data: new Uint8Array([4, 5]) },
        ]);
        expect(blob.type).toBe('application/zip');
        const bytes = new Uint8Array(await blob.arrayBuffer());

        // Local file header signature at offset 0.
        expect(decoder.decode(bytes.slice(0, 4))).toBe('PK\u0003\u0004');
        // EOCD signature present near the end.
        const eocdOffset = bytes.length - 22;
        expect(bytes[eocdOffset]).toBe(0x50);
        expect(bytes[eocdOffset + 1]).toBe(0x4b);
        expect(bytes[eocdOffset + 2]).toBe(0x05);
        expect(bytes[eocdOffset + 3]).toBe(0x06);
        // Entry count in EOCD.
        const view = new DataView(bytes.buffer);
        expect(view.getUint16(eocdOffset + 10, true)).toBe(2);
        // UTF-8 filename flag set on the first local header (offset 6).
        expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    });

    it('preserves entry payloads byte-for-byte', async () => {
        const payload = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
        const blob = createZip([{ name: 'a.png', data: payload }]);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        // Payload starts at local header (30) + filename length (5).
        const start = 30 + 'a.png'.length;
        expect(Array.from(bytes.slice(start, start + payload.length))).toEqual(
            Array.from(payload)
        );
    });
});

describe('frameEntryName', () => {
    it('zero-pads to six digits', () => {
        expect(frameEntryName(0)).toBe('frame-000000.png');
        expect(frameEntryName(42)).toBe('frame-000042.png');
        expect(frameEntryName(123456)).toBe('frame-123456.png');
    });
});

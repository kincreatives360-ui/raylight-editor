/**
 * Minimal store-only (uncompressed) ZIP writer for PNG sequence export.
 *
 * PNG frames are already deflate-compressed, so re-compressing them inside the
 * archive buys nothing; store-only keeps this dependency-free and fast. Output
 * is a standard ZIP file readable by macOS Archive Utility, Windows Explorer,
 * 7-Zip, and `unzip`.
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

const DOS_DATE = (() => {
    // Fixed timestamp keeps archive output deterministic for a given input set.
    const year = 2026;
    const month = 1;
    const day = 1;
    return {
        time: (0 << 11) | (0 << 5) | 0, // 00:00:00
        date: ((year - 1980) << 9) | (month << 5) | day,
    };
})();

function writeU16(view: DataView, offset: number, value: number): void {
    view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
    view.setUint32(offset, value, true);
}

/** Builds a ZIP archive from the given entries, in order. */
export function createZip(entries: ZipEntry[]): Blob {
    if (entries.length === 0) {
        throw new Error('Cannot create a ZIP archive without entries');
    }

    const encoder = new TextEncoder();
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let localOffset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const checksum = crc32(entry.data);

        const local = new Uint8Array(30 + nameBytes.length + entry.data.length);
        const localView = new DataView(local.buffer);
        writeU32(localView, 0, 0x04034b50); // local file header signature
        writeU16(localView, 4, 20); // version needed
        writeU16(localView, 6, 0x0800); // UTF-8 filename flag
        writeU16(localView, 8, 0); // method: store
        writeU16(localView, 10, DOS_DATE.time);
        writeU16(localView, 12, DOS_DATE.date);
        writeU32(localView, 14, checksum);
        writeU32(localView, 18, entry.data.length); // compressed size
        writeU32(localView, 22, entry.data.length); // uncompressed size
        writeU16(localView, 26, nameBytes.length);
        local.set(nameBytes, 30);
        local.set(entry.data, 30 + nameBytes.length);
        localParts.push(local);

        const central = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(central.buffer);
        writeU32(centralView, 0, 0x02014b50); // central directory signature
        writeU16(centralView, 4, 20); // version made by
        writeU16(centralView, 6, 20); // version needed
        writeU16(centralView, 8, 0x0800);
        writeU16(centralView, 10, 0);
        writeU16(centralView, 12, DOS_DATE.time);
        writeU16(centralView, 14, DOS_DATE.date);
        writeU32(centralView, 16, checksum);
        writeU32(centralView, 20, entry.data.length);
        writeU32(centralView, 24, entry.data.length);
        writeU16(centralView, 28, nameBytes.length);
        central.set(nameBytes, 46);
        centralParts.push(central);

        localOffset += local.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeU32(endView, 0, 0x06054b50); // end of central directory signature
    writeU16(endView, 8, entries.length);
    writeU16(endView, 10, entries.length);
    writeU32(endView, 12, centralSize);
    writeU32(endView, 16, localOffset);

    return new Blob([...localParts, ...centralParts, end] as BlobPart[], {
        type: 'application/zip',
    });
}

/** Zero-padded frame filename, e.g. frame-000123.png */
export function frameEntryName(frameIndex: number): string {
    return `frame-${String(frameIndex).padStart(6, '0')}.png`;
}

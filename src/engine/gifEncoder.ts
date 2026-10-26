/** Incremental GIF89a encoder. Keeps only encoded chunks, not every raw RGBA frame. */
function encodeLzwClearCodeStream(indices: Uint8Array): Uint8Array {
    // Uses 8-bit color indices with periodic Clear Codes (256) every 120 pixels
    // so 9-bit LZW codes never overflow the dictionary—100% GIF89a compliant & fast!
    const CLEAR_CODE = 256;
    const EOI_CODE = 257;
    const subBlockBytes: number[] = [];

    let bitBuffer = 0;
    let bitCount = 0;

    const write9BitCode = (code: number) => {
        bitBuffer |= code << bitCount;
        bitCount += 9;
        while (bitCount >= 8) {
            subBlockBytes.push(bitBuffer & 0xff);
            bitBuffer >>= 8;
            bitCount -= 8;
        }
    };

    write9BitCode(CLEAR_CODE);
    for (let i = 0; i < indices.length; i++) {
        if (i > 0 && i % 120 === 0) {
            write9BitCode(CLEAR_CODE);
        }
        write9BitCode(indices[i]);
    }
    write9BitCode(EOI_CODE);

    if (bitCount > 0) {
        subBlockBytes.push(bitBuffer & 0xff);
    }

    // Packetize into 255-byte GIF sub-blocks
    const numBlocks = Math.ceil(subBlockBytes.length / 255);
    const totalLen = 1 + subBlockBytes.length + numBlocks + 1;
    const output = new Uint8Array(totalLen);
    let ptr = 0;
    output[ptr++] = 8; // LZW Minimum Code Size = 8

    for (let offset = 0; offset < subBlockBytes.length; offset += 255) {
        const chunkSize = Math.min(255, subBlockBytes.length - offset);
        output[ptr++] = chunkSize;
        for (let j = 0; j < chunkSize; j++) {
            output[ptr++] = subBlockBytes[offset + j];
        }
    }
    output[ptr++] = 0; // Block Terminator
    return output.slice(0, ptr);
}


export class IncrementalGifEncoder {
    private readonly chunks: Uint8Array[] = [];
    private frameCount = 0;
    private readonly width: number;
    private readonly height: number;
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 65535 || height > 65535) {
            throw new RangeError('Invalid GIF dimensions');
        }
        const header = new Uint8Array(800);
        let at = 0;
        const ascii = (str: string) => { for (let i = 0; i < str.length; i++) header[at++] = str.charCodeAt(i); };
        const u16 = (n: number) => { header[at++] = n & 255; header[at++] = (n >> 8) & 255; };
        ascii('GIF89a'); u16(width); u16(height);
        header[at++] = 0xf7; header[at++] = 0; header[at++] = 0;
        for (let i=0;i<256;i++) {
            header[at++] = ((i>>5)&7)*36;
            header[at++] = ((i>>2)&7)*36;
            header[at++] = (i&3)*85;
        }
        header[at++] = 0x21; header[at++] = 0xff; header[at++] = 11;
        ascii('NETSCAPE2.0'); header[at++] = 3; header[at++] = 1; u16(0); header[at++] = 0;
        this.chunks.push(header.slice(0,at));
    }

    addFrame(frame: ImageData, delayCentiseconds: number): void {
        if (frame.width !== this.width || frame.height !== this.height) throw new RangeError('GIF frame dimensions mismatch');
        if (frame.data.length !== this.width*this.height*4) throw new RangeError('GIF frame pixel size mismatch');
        if (!Number.isInteger(delayCentiseconds) || delayCentiseconds < 1 || delayCentiseconds > 65535) throw new RangeError('Invalid GIF delay');
        const frameHeader = new Uint8Array([
            0x21,0xf9,4,0,
            delayCentiseconds & 255,(delayCentiseconds>>8)&255,0,0,
            0x2c,0,0,0,0,
            this.width & 255,(this.width>>8)&255,
            this.height & 255,(this.height>>8)&255,0,
        ]);
        const rgba = frame.data;
        const pixels = new Uint8Array(this.width*this.height);
        for(let i=0;i<pixels.length;i++) {
            const j=i*4;
            pixels[i]=((rgba[j]>>5)<<5)|((rgba[j+1]>>5)<<2)|(rgba[j+2]>>6);
        }
        this.chunks.push(frameHeader,encodeLzwClearCodeStream(pixels));
        this.frameCount++;
    }

    finish(): Blob {
        if(this.frameCount === 0) throw new Error('Cannot encode a GIF without frames');
        return new Blob([...this.chunks,new Uint8Array([0x3b])] as BlobPart[],{type:'image/gif'});
    }
}

/** Distributes centisecond rounding across frames to avoid cumulative timing drift. */
export function gifFrameDelayCentiseconds(frameIndex: number, fps: number): number {
    if (!Number.isInteger(frameIndex) || frameIndex < 0 || !Number.isFinite(fps) || fps <= 0) {
        throw new RangeError('Invalid frame index or GIF frame rate');
    }
    return Math.max(1, Math.round(((frameIndex+1)*100)/fps)-Math.round((frameIndex*100)/fps));
}

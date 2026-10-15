// src/stage/stageUtils.ts
import type { AspectRatio } from '../model/types';

export const ASPECT_RATIO_CONFIG: Record<
    AspectRatio,
    { widthRatio: number; heightRatio: number; label: string }
> = {
    '16:9': { widthRatio: 16, heightRatio: 9, label: '16:9 Widescreen' },
    '4:3': { widthRatio: 4, heightRatio: 3, label: '4:3 Classic' },
    '3:2': { widthRatio: 3, heightRatio: 2, label: '3:2 Presentation' },
    '21:9': { widthRatio: 21, heightRatio: 9, label: '21:9 Ultrawide' },
    '1:1': { widthRatio: 1, heightRatio: 1, label: '1:1 Square' },
    '9:16': { widthRatio: 9, heightRatio: 16, label: '9:16 Vertical' },
    '3:4': { widthRatio: 3, heightRatio: 4, label: '3:4 Portrait' },
    '2:3': { widthRatio: 2, heightRatio: 3, label: '2:3 Social' },
    '4:5': { widthRatio: 4, heightRatio: 5, label: '4:5 Feed' },
};

export function kelvinToRgb(
    kelvin: number,
    alpha = 1
): { r: number; g: number; b: number; css: string } {
    const temp = Math.max(1000, Math.min(15000, kelvin)) / 100;
    let r: number;
    let g: number;
    let b: number;

    if (temp <= 66) {
        r = 255;
        g = 99.4708025861 * Math.log(temp) - 161.1195681661;
        b =
            temp <= 19
                ? 0
                : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
        r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
        b = 255;
    }

    const clampByte = (n: number) => Math.round(Math.max(0, Math.min(255, n)));
    const rByte = clampByte(r);
    const gByte = clampByte(g);
    const bByte = clampByte(b);

    return {
        r: rByte,
        g: gByte,
        b: bByte,
        css: `rgba(${rByte}, ${gByte}, ${bByte}, ${alpha})`,
    };
}

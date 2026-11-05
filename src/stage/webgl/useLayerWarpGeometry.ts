import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { WarpEffect } from '../../model/types';
import { createWarpGeometry, updateWarpGeometry } from './layerEffects';

interface UseLayerWarpGeometryParams {
    warp: WarpEffect | undefined;
    meshW: number;
    meshH: number;
    widthScale: number;
    heightScale: number;
    authoredW: number;
    authoredH: number;
    halo: { widthScale: number; heightScale: number } | null;
    currentTimeMs: number;
    shotStartMs: number;
}

export function useLayerWarpGeometry({
    warp,
    meshW,
    meshH,
    widthScale,
    heightScale,
    authoredW,
    authoredH,
    halo,
    currentTimeMs,
    shotStartMs,
}: UseLayerWarpGeometryParams) {
    const warpedGeometry = useMemo(
        () =>
            warp?.enabled && warp.mode
                ? createWarpGeometry(
                      meshW * widthScale,
                      meshH * heightScale,
                      authoredW * widthScale,
                      authoredH * heightScale,
                      warp
                  )
                : null,
        [warp, meshW, meshH, widthScale, heightScale, authoredW, authoredH]
    );

    const warpedHaloGeometry = useMemo(
        () =>
            warp?.enabled && warp.mode && halo
                ? createWarpGeometry(
                      meshW * widthScale * halo.widthScale,
                      meshH * heightScale * halo.heightScale,
                      authoredW * widthScale * halo.widthScale,
                      authoredH * heightScale * halo.heightScale,
                      warp,
                      { width: authoredW * widthScale, height: authoredH * heightScale }
                  )
                : null,
        [warp, halo, meshW, meshH, widthScale, heightScale, authoredW, authoredH]
    );

    const turbulenceFrame = useRef<{
        time: number;
        geometry: THREE.PlaneGeometry;
        haloGeometry?: THREE.PlaneGeometry | null;
    } | null>(null);

    useFrame(() => {
        if (!warp?.enabled || warp.mode !== 'turbulent' || !warpedGeometry) return;
        const time = Math.max(0, (currentTimeMs ?? 0) - shotStartMs) / 1000;
        if (
            turbulenceFrame.current?.time === time &&
            turbulenceFrame.current.geometry === warpedGeometry &&
            turbulenceFrame.current.haloGeometry === warpedHaloGeometry
        ) {
            return;
        }

        updateWarpGeometry(
            warpedGeometry,
            meshW * widthScale,
            meshH * heightScale,
            authoredW * widthScale,
            authoredH * heightScale,
            warp,
            time
        );

        if (warpedHaloGeometry && halo) {
            updateWarpGeometry(
                warpedHaloGeometry,
                meshW * widthScale * halo.widthScale,
                meshH * heightScale * halo.heightScale,
                authoredW * widthScale * halo.widthScale,
                authoredH * heightScale * halo.heightScale,
                warp,
                time,
                { width: authoredW * widthScale, height: authoredH * heightScale }
            );
        }

        turbulenceFrame.current = { time, geometry: warpedGeometry, haloGeometry: warpedHaloGeometry };
    });

    useEffect(() => {
        return () => {
            warpedGeometry?.dispose();
            warpedHaloGeometry?.dispose();
        };
    }, [warpedGeometry, warpedHaloGeometry]);

    return {
        warpedGeometry,
        warpedHaloGeometry,
    };
}

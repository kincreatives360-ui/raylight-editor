import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceFrameSettings } from '../../model/types';
import { createReflectionTexture } from './deviceTextures';
import { useDisposable } from './useDisposable';

interface ScreenMaterialOptions {
  color?: string;
  opacity?: number;
  roughness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  reflectionOpacity?: number;
  blending?: THREE.Blending;
  side?: THREE.Side;
}

export function useDeviceScreenMaterials(settings: DeviceFrameSettings, {
  color = settings.glassTint,
  opacity = settings.glassOpacity,
  roughness = settings.glassRoughness,
  clearcoat = 1,
  clearcoatRoughness = settings.glassRoughness,
  reflectionOpacity = settings.reflection * 0.75,
  blending = THREE.NormalBlending,
  side = THREE.FrontSide,
}: ScreenMaterialOptions = {}) {
  const { gloss, reflection, glassTint } = settings;
  const reflectionTexture = useMemo(
    () => createReflectionTexture(gloss, reflection, glassTint),
    [gloss, reflection, glassTint]
  );
  const glassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color, transparent: true, opacity, roughness, metalness: 0,
    clearcoat, clearcoatRoughness, blending, depthWrite: false, side,
  }), [color, opacity, roughness, clearcoat, clearcoatRoughness, blending, side]);
  const reflectionMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: reflectionTexture, transparent: true, opacity: reflectionOpacity,
    blending, depthWrite: false, side,
  }), [reflectionTexture, reflectionOpacity, blending, side]);

  useDisposable(reflectionTexture);
  useDisposable(glassMaterial);
  useDisposable(reflectionMaterial);
  return { glassMaterial, reflectionMaterial };
}

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Environment, Lightformer } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { LightRig, SceneLight } from '../../model/types';
import { resolveLighting, type ResolvedLighting, type ResolvedSceneLight } from '../../engine/lightingSystem';

interface SceneLightingProps {
  light?: LightRig;
}

type Vector3Tuple = [number, number, number];

// RectAreaLight requires its LTC lookup textures before the first WebGL render.
RectAreaLightUniformsLib.init();

interface PanelProfile {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  intensity: number;
  color: string;
  form?: 'rect' | 'ring';
}

const ENVIRONMENT_PANELS: Record<NonNullable<LightRig['environment']>, PanelProfile[]> = {
  studio: [
    { position: [0, 5, -5], rotation: [0, 0, 0], scale: [8, 5, 1], intensity: 4, color: '#ffffff' },
    { position: [-5, 1, 1], rotation: [0, Math.PI / 2, 0], scale: [2, 6, 1], intensity: 2, color: '#dce8ff' },
    { position: [5, 2, 1], rotation: [0, -Math.PI / 2, 0], scale: [1.5, 5, 1], intensity: 2, color: '#fff0d8' },
  ],
  softbox: [
    { position: [-4, 4, -2], rotation: [0, 0.5, 0], scale: [7, 7, 1], intensity: 4, color: '#f4f8ff' },
    { position: [4, 2, 2], rotation: [0, -0.7, 0], scale: [4, 5, 1], intensity: 1.8, color: '#ffffff' },
  ],
  'strip-light': [
    { position: [0, 5, -3], rotation: [0, 0, 0], scale: [10, 1, 1], intensity: 4, color: '#ffffff' },
    { position: [-4, 1, 2], rotation: [0, Math.PI / 2, 0], scale: [1, 7, 1], intensity: 2, color: '#dce8ff' },
    { position: [4, 1, 2], rotation: [0, -Math.PI / 2, 0], scale: [1, 7, 1], intensity: 2, color: '#dce8ff' },
  ],
  daylight: [
    { position: [-3, 6, -4], rotation: [0.2, 0.4, 0], scale: [12, 8, 1], intensity: 5, color: '#fff1d8' },
    { position: [4, 2, 2], rotation: [0, -0.8, 0], scale: [3, 6, 1], intensity: 1.2, color: '#dcecff' },
  ],
  'night-city': [
    { position: [-5, 3, -3], rotation: [0, 0.6, 0], scale: [2, 7, 1], intensity: 3, color: '#94baff' },
    { position: [-1, 5, -4], rotation: [0, -0.2, 0], scale: [1, 4, 1], intensity: 2, color: '#e2edff' },
    { position: [4, 2, -2], rotation: [0, -0.7, 0], scale: [2, 5, 1], intensity: 2.5, color: '#ffb7a0' },
    { position: [0, -3, -4], rotation: [0, 0, 0], scale: [7, 1, 1], intensity: 1, color: '#b3c8ff' },
  ],
  warehouse: [
    { position: [0, 7, -3], rotation: [0, 0, 0], scale: [12, 2, 1], intensity: 4, color: '#fff5df' },
    { position: [-6, 2, 0], rotation: [0, Math.PI / 2, 0], scale: [2, 8, 1], intensity: 1.8, color: '#e4ebff' },
  ],
  custom: [
    { position: [0, 5, -4], rotation: [0, 0, 0], scale: [8, 5, 1], intensity: 3, color: '#ffffff' },
    { position: [-4, 1, 2], rotation: [0, Math.PI / 2, 0], scale: [2, 5, 1], intensity: 1.4, color: '#ffffff' },
  ],
};

function AimedDirectionalLight({ config }: { config: ResolvedLighting['key'] | ResolvedSceneLight }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const [tx, ty, tz] = config.target;

  useLayoutEffect(() => {
    if (lightRef.current && targetRef.current) lightRef.current.target = targetRef.current;
  }, [tx, ty, tz]);

  return (
    <group>
      <object3D ref={targetRef} position={config.target} />
      <directionalLight
        ref={lightRef}
        position={config.position}
        intensity={config.intensity}
        color={config.color}
        castShadow={config.castShadow}
        shadow-intensity={config.shadowIntensity}
        shadow-radius={config.shadowRadius}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
    </group>
  );
}

function AimedSpotLight({ config }: { config: ResolvedSceneLight }) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const [tx, ty, tz] = config.target;

  useLayoutEffect(() => {
    if (lightRef.current && targetRef.current) lightRef.current.target = targetRef.current;
  }, [tx, ty, tz]);

  return (
    <group>
      <object3D ref={targetRef} position={config.target} />
      <spotLight
        ref={lightRef}
        position={config.position}
        intensity={config.intensity}
        color={config.color}
        distance={config.distance}
        decay={config.decay}
        angle={config.angle}
        penumbra={config.penumbra}
        castShadow={config.castShadow}
        shadow-intensity={config.shadowIntensity}
        shadow-radius={config.shadowRadius}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-camera-near={0.1}
        shadow-camera-far={Math.max(12, config.distance)}
      />
    </group>
  );
}

function AreaLight({ config }: { config: ResolvedSceneLight }) {
  const lightRef = useRef<THREE.RectAreaLight>(null);
  const [tx, ty, tz] = config.target;
  useLayoutEffect(() => {
    lightRef.current?.lookAt(tx, ty, tz);
  }, [tx, ty, tz]);
  return <rectAreaLight ref={lightRef} position={config.position} intensity={config.intensity} color={config.color} width={config.width} height={config.height} />;
}

export const AreaGizmo: React.FC<{
  position: Vector3Tuple;
  width: number;
  height: number;
  colorHex: string;
}> = ({ position, width, height, colorHex }) => {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(width, height);
    const edges = new THREE.EdgesGeometry(plane);
    plane.dispose();
    return edges;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={position}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={colorHex} />
      </lineSegments>
    </group>
  );
};

function LightGizmo({ source, position, color }: { source: SceneLight; position: Vector3Tuple; color: string }) {
  if (source.type === 'ambient') return null;
  if (source.type === 'area') {
    return (
      <group position={position}>
        <mesh>
          <planeGeometry args={[source.width ?? 3, source.height ?? 3]} />
          <meshBasicMaterial color={color} wireframe side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
  if (source.type === 'spot') {
    return (
      <group position={position}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.2, 0.35, 12]} />
          <meshBasicMaterial color={color} wireframe />
        </mesh>
      </group>
    );
  }
  return (
    <group position={position}>
      <mesh>
        {source.type === 'point' ? <sphereGeometry args={[0.12, 12, 12]} /> : <octahedronGeometry args={[0.16]} />}
        <meshBasicMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}

function SceneLightEmitter({ source, sourceModel, showGizmo }: { source: ResolvedSceneLight; sourceModel?: SceneLight; showGizmo: boolean }) {
  const color = source.color;
  let emitter: React.ReactNode;

  switch (source.type) {
    case 'ambient':
      emitter = <ambientLight intensity={source.intensity * 0.5} color={color} />;
      break;
    case 'point':
      emitter = (
        <pointLight
          position={source.position}
          intensity={source.intensity}
          color={color}
          distance={source.distance}
          decay={source.decay}
          castShadow={source.castShadow}
          shadow-intensity={source.shadowIntensity}
          shadow-radius={source.shadowRadius}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.1}
          shadow-camera-far={Math.max(10, source.distance)}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
        />
      );
      break;
    case 'spot':
      emitter = <AimedSpotLight config={source} />;
      break;
    case 'area':
      emitter = <AreaLight config={source} />;
      break;
    case 'directional':
      emitter = <AimedDirectionalLight config={source} />;
      break;
  }

  return (
    <React.Fragment key={source.id}>
      {emitter}
      {showGizmo && sourceModel && <LightGizmo source={sourceModel} position={source.position} color={color} />}
    </React.Fragment>
  );
}

function RoomEnvironment({ light }: { light: LightRig }) {
  const resolved = resolveLighting(light);
  const [environment, color] = [resolved.room.environment, resolved.room.color];
  const panels = useMemo(() => ENVIRONMENT_PANELS[environment].map((panel) => ({
    ...panel,
    color: environment === 'custom' ? color : panel.color,
  })), [environment, color]);

  return (
    <Environment
      key={`${environment}:${color}`}
      background={false}
      frames={1}
      resolution={128}
      environmentIntensity={resolved.room.environmentIntensity}
    >
      {panels.map((panel, index) => <Lightformer key={`${environment}-${index}`} {...panel} />)}
    </Environment>
  );
}

/** Three.js light emitters and a procedural PBR environment resolved from saved light controls. */
export const SceneLighting: React.FC<SceneLightingProps> = ({ light }) => {
  const resolved = useMemo(() => resolveLighting(light), [light]);
  const rig = light ?? {
    position: { x: -0.28, y: 0.36, z: 0.9 }, intensity: 1.2, temperature: 6100, ambience: 0.45,
  } satisfies LightRig;
  const sourceModels = new Map((rig.sources ?? []).map((source) => [source.id, source]));

  return (
    <group name="raylight_scene_lighting">
      <RoomEnvironment light={rig} />
      <ambientLight intensity={resolved.room.intensity} color={resolved.room.color} />
      {resolved.key.enabled && <AimedDirectionalLight config={resolved.key} />}
      {resolved.fill.enabled && (
        <directionalLight position={resolved.fill.position} intensity={resolved.fill.intensity} color={resolved.fill.color} />
      )}
      {resolved.showGizmos && resolved.key.enabled && (
        <mesh position={resolved.key.position}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" wireframe />
        </mesh>
      )}
      {resolved.sources.map((source) => (
        <SceneLightEmitter
          key={source.id}
          source={source}
          sourceModel={sourceModels.get(source.id)}
          showGizmo={resolved.showGizmos}
        />
      ))}
    </group>
  );
};






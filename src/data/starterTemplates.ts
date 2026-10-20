// src/data/starterTemplates.ts
import type { Project, Shot } from '../model/types';
import {
  createDefaultShot,
  createDefaultImageLayer,
  createDefaultTextLayer,
  DEFAULT_SCENE_EFFECTS,
  DEFAULT_EFFECTS_ORDER,
  CURRENT_SCHEMA_VERSION,
} from '../model/defaults';

export interface StarterTemplate {
  id: string;
  name: string;
  category: 'Device Showcase' | 'Product Walkthrough' | 'Cinematic Studio' | 'Social & Vertical';
  badge: string;
  description: string;
  aspectRatio: '16:9' | '9:16';
  thumbnailColor: string;
  getProject: () => Project;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'iphone-titanium-reveal',
    name: 'iPhone 15 Pro Showcase',
    category: 'Device Showcase',
    badge: 'Hardware',
    description: '3D titanium iPhone with screen glare, dramatic spring push-in, and synchronized whoosh audio.',
    aspectRatio: '16:9',
    thumbnailColor: 'from-blue-600/30 to-indigo-900/40',
    getProject: () => {
      const now = Date.now();
      const shotId = `shot-${now}`;
      const f1Id = `f1-${now}`;
      const f2Id = `f2-${now}`;
      const camBlkId = `cam-${now}`;

      const deviceLayer = createDefaultImageLayer({
        id: `layer-dev-${now}`,
        name: 'iPhone 15 Pro Max',
        position: { x: 0, y: -0.04, z: 0 },
        device: {
          type: 'iphone',
          color: 'titanium',
          gloss: 0.75,
          glare: 0.35,
          screenGlow: 0.15,
        },
      });

      const titleLayer = createDefaultTextLayer({
        id: `layer-txt-${now}`,
        name: 'Headline',
        position: { x: 0, y: 0.38, z: 0.12 },
        content: 'TITANIUM CRAFT',
        font: {
          family: 'Inter',
          size: 0.045,
          weight: 800,
          color: '#ffffff',
          align: 'center',
          letterSpacing: -0.02,
        },
      });

      const shot: Shot = {
        ...createDefaultShot({
          id: shotId,
          name: 'Device Reveal',
          durationMs: 4000,
          layers: [deviceLayer, titleLayer],
          framings: [
            {
              id: f1Id,
              name: 'Wide Establishing',
              target: { x: 0, y: -54, z: 0 },
              zoom: 0.95,
              roll: 0,
              orbit: 0,
            },
            {
              id: f2Id,
              name: 'Macro Push-In',
              target: { x: 0, y: 43, z: 0 },
              zoom: 1.25,
              roll: -1.5,
              orbit: 2,
            },
          ],
          cameraBlocks: [
            {
              id: camBlkId,
              label: 'Spring Push-In',
              startMs: 200,
              durationMs: 3200,
              fromFramingId: f1Id,
              toFramingId: f2Id,
              mode: 'dolly',
              easing: {
                kind: 'spring',
                name: 'bouncy',
                config: { stiffness: 160, damping: 16, mass: 1 },
              },
            },
          ],
          light: {
            position: { x: 0.5, y: 0.6, z: 1.2 },
            intensity: 1.4,
            temperature: 6500,
            ambience: 0.3,
            ambientColor: '#f1f5f9',
            keyLightEnabled: true,
            castShadow: true,
            showGizmos: false,
            sources: [
              {
                id: 'rim-light',
                name: 'Specular Rim',
                type: 'spot',
                enabled: true,
                position: { x: -0.7, y: 0.5, z: -0.8 },
                target: { x: 0, y: 0, z: 0 },
                intensity: 1.6,
                color: '#38bdf8',
                angle: 0.55,
                penumbra: 0.45,
                castShadow: false,
              },
            ],
          },
        }),
      };

      return {
        id: `project-iphone-${now}`,
        name: 'iPhone 15 Pro Showcase',
        version: CURRENT_SCHEMA_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        aspectRatio: '16:9',
        fps: 60,
        background: {
          kind: 'gradient',
          angle: 145,
          stops: [
            { at: 0, color: '#090a12' },
            { at: 1, color: '#141829' },
          ],
        },
        assets: {},
        audio: {
          muted: false,
          masterVolume: 1,
          clips: [
            {
              id: `audio-whoosh-${now}`,
              name: 'Fast Swoosh Whoosh',
              dataUrl: 'https://jkfgfwhjinktxvvmhpiy.supabase.co/storage/v1/object/public/assets/curated/sounds/whoosh-fast-swoosh.mp3',
              startMs: 100,
              durationMs: 1400,
              offsetMs: 0,
              volume: 0.9,
              muted: false,
            },
          ],
        },
        shots: [shot],
      };
    },
  },
  {
    id: 'macbook-pro-studio',
    name: 'MacBook Pro Walkthrough',
    category: 'Product Walkthrough',
    badge: 'Laptop',
    description: '3D Space Black MacBook with glossy Retina display, smooth orbit pan, and rim lighting.',
    aspectRatio: '16:9',
    thumbnailColor: 'from-zinc-700/30 to-black/50',
    getProject: () => {
      const now = Date.now();
      const shotId = `shot-${now}`;
      const f1Id = `f1-${now}`;
      const f2Id = `f2-${now}`;
      const camBlkId = `cam-${now}`;

      const macbookLayer = createDefaultImageLayer({
        id: `layer-mac-${now}`,
        name: 'MacBook Pro 14"',
        position: { x: 0, y: -0.06, z: 0 },
        device: {
          type: 'macbook',
          color: 'space-black',
          gloss: 0.8,
          glare: 0.3,
          screenGlow: 0.1,
          lidAngle: 105,
        },
      });

      const titleLayer = createDefaultTextLayer({
        id: `layer-txt-${now}`,
        name: 'Sub-Headline',
        position: { x: 0, y: 0.4, z: 0.1 },
        content: 'ENGINEERED FOR POWER',
        font: {
          family: 'Inter',
          size: 0.038,
          weight: 700,
          color: '#f4f4f5',
          align: 'center',
          letterSpacing: -0.01,
        },
      });

      const shot: Shot = {
        ...createDefaultShot({
          id: shotId,
          name: 'Studio Orbit',
          durationMs: 4500,
          layers: [macbookLayer, titleLayer],
          framings: [
            {
              id: f1Id,
              name: 'Angle 3/4',
              target: { x: 0, y: 0, z: 0 },
              zoom: 1.0,
              roll: 0,
              orbit: -4,
            },
            {
              id: f2Id,
              name: 'Front Center',
              target: { x: 0, y: 54, z: 0 },
              zoom: 1.15,
              roll: 0,
              orbit: 3,
            },
          ],
          cameraBlocks: [
            {
              id: camBlkId,
              label: 'Smooth Orbit',
              startMs: 0,
              durationMs: 4500,
              fromFramingId: f1Id,
              toFramingId: f2Id,
              mode: 'dolly',
              easing: { kind: 'preset', name: 'ease-in-out' },
            },
          ],
          light: {
            position: { x: -0.4, y: 0.7, z: 1.0 },
            intensity: 1.3,
            temperature: 5800,
            ambience: 0.4,
            ambientColor: '#1e293b',
            keyLightEnabled: true,
            castShadow: true,
            showGizmos: false,
          },
        }),
      };

      return {
        id: `project-macbook-${now}`,
        name: 'MacBook Pro Walkthrough',
        version: CURRENT_SCHEMA_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        aspectRatio: '16:9',
        fps: 60,
        background: {
          kind: 'gradient',
          angle: 180,
          stops: [
            { at: 0, color: '#0b0c10' },
            { at: 1, color: '#161822' },
          ],
        },
        assets: {},
        audio: {
          muted: false,
          masterVolume: 1,
          clips: [
            {
              id: `audio-ui-${now}`,
              name: 'Glass Chime UI',
              dataUrl: 'https://jkfgfwhjinktxvvmhpiy.supabase.co/storage/v1/object/public/assets/curated/sounds/ui-glass-chime.mp3',
              startMs: 200,
              durationMs: 2000,
              offsetMs: 0,
              volume: 0.8,
              muted: false,
            },
          ],
        },
        shots: [shot],
      };
    },
  },
  {
    id: 'neon-cyber-teaser',
    name: 'Cyberpunk Neon Teaser',
    category: 'Cinematic Studio',
    badge: 'Stylized',
    description: 'High-contrast cyan & magenta studio lighting, bloom glow, and snappy kinetic choreography.',
    aspectRatio: '16:9',
    thumbnailColor: 'from-fuchsia-900/40 via-purple-900/30 to-cyan-900/40',
    getProject: () => {
      const now = Date.now();
      const shotId = `shot-${now}`;
      const f1Id = `f1-${now}`;
      const f2Id = `f2-${now}`;

      const deviceLayer = createDefaultImageLayer({
        id: `layer-phone-${now}`,
        name: 'Phone Cyber Matrix',
        position: { x: 0, y: -0.02, z: 0 },
        device: {
          type: 'samsung-galaxy',
          color: 'midnight',
          gloss: 0.9,
          glare: 0.5,
          screenGlow: 0.3,
        },
      });

      const titleLayer = createDefaultTextLayer({
        id: `layer-neon-${now}`,
        name: 'Neon Title',
        position: { x: 0, y: 0.38, z: 0.2 },
        content: 'NEO VELOCITY',
        font: {
          family: 'Inter',
          size: 0.046,
          weight: 900,
          color: '#38bdf8',
          align: 'center',
          letterSpacing: -0.02,
        },
      });

      const effects = structuredClone(DEFAULT_SCENE_EFFECTS);
      effects.bloom = { enabled: true, intensity: 1.4, threshold: 0.4 };
      effects.vignette = { enabled: true, intensity: 0.55 };

      const shot: Shot = {
        ...createDefaultShot({
          id: shotId,
          name: 'Neon Rush',
          durationMs: 3500,
          layers: [deviceLayer, titleLayer],
          effects,
          effectsOrder: [...DEFAULT_EFFECTS_ORDER],
          framings: [
            {
              id: f1Id,
              name: 'Far Left Angle',
              target: { x: -192, y: 0, z: 0 },
              zoom: 0.9,
              roll: 2.5,
              orbit: -5,
            },
            {
              id: f2Id,
              name: 'Snap Center',
              target: { x: 0, y: 22, z: 0 },
              zoom: 1.2,
              roll: 0,
              orbit: 0,
            },
          ],
          cameraBlocks: [
            {
              id: `cam-${now}`,
              label: 'Snappy Kinetic Snap',
              startMs: 300,
              durationMs: 2500,
              fromFramingId: f1Id,
              toFramingId: f2Id,
              mode: 'dolly',
              easing: { kind: 'spring', name: 'snappy' },
            },
          ],
          light: {
            position: { x: -0.6, y: 0.8, z: 0.8 },
            intensity: 1.4,
            temperature: 8000,
            ambience: 0.1,
            ambientColor: '#020617',
            keyLightEnabled: true,
            castShadow: true,
            showGizmos: false,
            sources: [
              {
                id: 'rim-cyan',
                name: 'Cyber Cyan Rim',
                type: 'spot',
                enabled: true,
                position: { x: 0.9, y: 0.5, z: -0.9 },
                target: { x: 0, y: 0, z: 0 },
                intensity: 1.8,
                color: '#06b6d4',
                angle: 0.6,
                penumbra: 0.5,
                castShadow: false,
              },
              {
                id: 'rim-magenta',
                name: 'Neon Magenta Fill',
                type: 'point',
                enabled: true,
                position: { x: -0.7, y: -0.3, z: 0.6 },
                intensity: 1.2,
                color: '#ec4899',
                castShadow: false,
              },
            ],
          },
        }),
      };

      return {
        id: `project-neon-${now}`,
        name: 'Cyberpunk Neon Teaser',
        version: CURRENT_SCHEMA_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        aspectRatio: '16:9',
        fps: 60,
        background: {
          kind: 'gradient',
          angle: 135,
          stops: [
            { at: 0, color: '#05020c' },
            { at: 1, color: '#130426' },
          ],
        },
        assets: {},
        audio: {
          muted: false,
          masterVolume: 1,
          clips: [
            {
              id: `audio-impact-${now}`,
              name: 'Cinematic Sub Impact',
              dataUrl: 'https://jkfgfwhjinktxvvmhpiy.supabase.co/storage/v1/object/public/assets/curated/sounds/impact-cinematic-sub-drop.mp3',
              startMs: 250,
              durationMs: 2400,
              offsetMs: 0,
              volume: 1,
              muted: false,
            },
          ],
        },
        shots: [shot],
      };
    },
  },
  {
    id: 'tiktok-reels-story',
    name: 'TikTok & Reels 9:16 Story',
    category: 'Social & Vertical',
    badge: '9:16 Viral',
    description: 'Portrait format tailored for mobile feeds with safe-zone aligned typography and playful pop transitions.',
    aspectRatio: '9:16',
    thumbnailColor: 'from-rose-600/30 to-amber-700/30',
    getProject: () => {
      const now = Date.now();
      const shotId = `shot-${now}`;
      const f1Id = `f1-${now}`;
      const f2Id = `f2-${now}`;

      const phoneLayer = createDefaultImageLayer({
        id: `layer-phone-${now}`,
        name: 'Vertical Phone Frame',
        position: { x: 0, y: -0.05, z: 0 },
        device: {
          type: 'iphone',
          color: 'space-black',
          gloss: 0.7,
          glare: 0.25,
          screenGlow: 0.1,
        },
      });

      const headerText = createDefaultTextLayer({
        id: `layer-hdr-${now}`,
        name: 'Safe Zone Header',
        position: { x: 0, y: 0.42, z: 0.15 },
        content: 'MEET RAYLIGHT',
        font: {
          family: 'Inter',
          size: 0.044,
          weight: 800,
          color: '#ffffff',
          align: 'center',
          letterSpacing: -0.02,
        },
      });

      const shot: Shot = {
        ...createDefaultShot({
          id: shotId,
          name: 'Social Hook',
          durationMs: 3800,
          layers: [phoneLayer, headerText],
          framings: [
            {
              id: f1Id,
              name: 'Mobile Fit',
              target: { x: 0, y: 0, z: 0 },
              zoom: 1.0,
            },
            {
              id: f2Id,
              name: 'Card Focus',
              target: { x: 0, y: 54, z: 0 },
              zoom: 1.15,
            },
          ],
          cameraBlocks: [
            {
              id: `cam-${now}`,
              label: 'Gentle Vertical Float',
              startMs: 200,
              durationMs: 3000,
              fromFramingId: f1Id,
              toFramingId: f2Id,
              mode: 'dolly',
              easing: { kind: 'spring', name: 'gentle' },
            },
          ],
          light: {
            position: { x: 0.3, y: 0.8, z: 1.2 },
            intensity: 1.35,
            temperature: 6000,
            ambience: 0.4,
            ambientColor: '#fef3c7',
            keyLightEnabled: true,
            castShadow: true,
            showGizmos: false,
          },
        }),
      };

      return {
        id: `project-vertical-${now}`,
        name: 'TikTok & Reels 9:16 Story',
        version: CURRENT_SCHEMA_VERSION,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        aspectRatio: '9:16',
        fps: 60,
        background: {
          kind: 'gradient',
          angle: 180,
          stops: [
            { at: 0, color: '#18070d' },
            { at: 1, color: '#2a0e1a' },
          ],
        },
        assets: {},
        audio: {
          muted: false,
          masterVolume: 1,
          clips: [
            {
              id: `audio-pop-${now}`,
              name: 'Bubble Pop',
              dataUrl: 'https://jkfgfwhjinktxvvmhpiy.supabase.co/storage/v1/object/public/assets/curated/sounds/pop-bubble-1.mp3',
              startMs: 200,
              durationMs: 800,
              offsetMs: 0,
              volume: 1,
              muted: false,
            },
          ],
        },
        shots: [shot],
      };
    },
  },
];

// src/engine/evaluateShot.test.ts
import { describe, it, expect } from 'vitest';
import {
  evaluateProjectAtTime,
  getShotTransitionCompositeState,
  resolveDepthOfFieldFocusZ,
} from './evaluateShot';
import {
  DEFAULT_PROJECT,
  createDefaultShot,
  createDefaultShapeLayer,
  createDefaultTextLayer,
  createDefaultImageLayer,
  createMultiShotContractFixture,
} from '../model/defaults';
import { validateProject } from '../model/schema';
import { useProjectStore } from '../store/useProjectStore';
import type { Project, Shot } from '../model/types';

describe('evaluateProjectAtTime', () => {
  it('uses an empty render shot when a project has no shots', () => {
    const frame = evaluateProjectAtTime({ ...DEFAULT_PROJECT, shots: [] }, 0);

    expect(frame.activeShot.layers).toEqual([]);
  });

  it('1. Computes active shot, local time, frame number, and progress across multi-shot project', () => {
    const shot1: Shot = createDefaultShot({
      id: 'shot-1',
      name: 'Intro',
      startMs: 0,
      durationMs: 3000,
    });

    const shot2: Shot = createDefaultShot({
      id: 'shot-2',
      name: 'Main Content',
      startMs: 3000,
      durationMs: 4000,
    });

    const project: Project = {
      ...DEFAULT_PROJECT,
      fps: 60,
      shots: [shot1, shot2],
    };

    // t=1500 (Midway into Shot 1)
    const frame1 = evaluateProjectAtTime(project, 1500);
    expect(frame1.activeShot.id).toBe('shot-1');
    expect(frame1.shotIndex).toBe(0);
    expect(frame1.shotLocalTimeMs).toBe(1500);
    expect(frame1.shotProgress).toBeCloseTo(0.5, 3);
    expect(frame1.frameNumber).toBe(90); // (1.5s * 60fps)

    // t=5000 (2000ms into Shot 2: 3000ms..7000ms)
    const frame2 = evaluateProjectAtTime(project, 5000);
    expect(frame2.activeShot.id).toBe('shot-2');
    expect(frame2.shotIndex).toBe(1);
    expect(frame2.shotLocalTimeMs).toBe(2000);
    expect(frame2.shotProgress).toBeCloseTo(0.5, 3);
    expect(frame2.frameNumber).toBe(300); // (5s * 60fps)
  });

  it('2. Evaluates group hierarchy: hiding a parent group hides child layers and nested groups', () => {
    const parentGroupId = 'grp-parent';
    const childGroupId = 'grp-child';

    const layer1 = createDefaultShapeLayer({
      id: 'l1',
      name: 'Parent Group Layer',
      groupId: parentGroupId,
      inMs: 0,
      outMs: 4000,
    });

    const layer2 = createDefaultTextLayer({
      id: 'l2',
      name: 'Child Group Layer',
      groupId: childGroupId,
      inMs: 0,
      outMs: 4000,
    });

    const layer3 = createDefaultShapeLayer({
      id: 'l3',
      name: 'Ungrouped Layer',
      inMs: 0,
      outMs: 4000,
    });

    const shot = createDefaultShot({
      layers: [layer1, layer2, layer3],
      groups: [
        {
          id: parentGroupId,
          name: 'Parent Group',
          hidden: true, // Parent is hidden
          collapsed: false,
          locked: false,
        },
        {
          id: childGroupId,
          name: 'Child Group',
          hidden: false, // Child marked visible, but parent is hidden
          parentGroupId,
          collapsed: false,
          locked: false,
        },
      ],
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };
    const frame = evaluateProjectAtTime(project, 1000);

    const evalL1 = frame.layers.find((l) => l.id === 'l1');
    const evalL2 = frame.layers.find((l) => l.id === 'l2');
    const evalL3 = frame.layers.find((l) => l.id === 'l3');

    // l1 and l2 must be hidden because parent group is hidden
    expect(evalL1?.visible).toBe(false);
    expect(evalL2?.visible).toBe(false);

    // Ungrouped layer remains visible
    expect(evalL3?.visible).toBe(true);
  });

  it('3. Computes depth of field blur and total blur per layer', () => {
    const layerSharp = createDefaultShapeLayer({
      id: 'l-sharp',
      position: { x: 0, y: 0, z: 0 },
      effects: { layerBlur: 0 },
      inMs: 0,
      outMs: 4000,
    });

    const layerBlurred = createDefaultShapeLayer({
      id: 'l-blurred',
      position: { x: 0, y: 0, z: 2.0 }, // Far out of focus
      effects: { layerBlur: 0.05 }, // 0.05 * 100 = 5px manual blur
      inMs: 0,
      outMs: 4000,
    });

    const shot = createDefaultShot({
      layers: [layerSharp, layerBlurred],
      effects: {
        ...DEFAULT_PROJECT.shots[0].effects,
        depthOfField: {
          enabled: true,
          target: { x: 0, y: 0, z: 0 },
          focusRange: 0.2,
          aperture: 2.8,
          bokehScale: 1.5,
          bokehShape: 'spherical',
        },
      },
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };
    const frame = evaluateProjectAtTime(project, 1000);

    const evalSharp = frame.layers.find((l) => l.id === 'l-sharp')!;
    const evalBlurred = frame.layers.find((l) => l.id === 'l-blurred')!;

    // Sharp layer at z=0 is inside focus range -> 0 DoF blur, 0 total blur
    expect(evalSharp.dofBlurPx).toBe(0);
    expect(evalSharp.totalBlurPx).toBe(0);

    // Blurred layer has both DoF blur and manual blur
    expect(evalBlurred.dofBlurPx).toBeGreaterThan(0);
    expect(evalBlurred.totalBlurPx).toBeGreaterThanOrEqual(evalBlurred.dofBlurPx + 5);
  });

  it('4. Evaluates animated effect blocks (e.g. bloom, vignette) on the timeline', () => {
    const shot = createDefaultShot({
      durationMs: 4000,
      effects: {
        ...DEFAULT_PROJECT.shots[0].effects,
        bloom: { enabled: false, intensity: 0, threshold: 0.8 },
      },
      effectBlocks: [
        {
          id: 'eb-bloom',
          label: 'Bloom Flash',
          effectKey: 'bloom',
          startMs: 1000,
          durationMs: 1000,
          fromValue: 0,
          toValue: 2.5,
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };

    // Before effect block starts: t=500
    const before = evaluateProjectAtTime(project, 500);
    expect(before.activeShot.effects.bloom.intensity).toBe(0);

    // Halfway through effect block: t=1500
    const mid = evaluateProjectAtTime(project, 1500);
    expect(mid.activeShot.effects.bloom.enabled).toBe(true);
    expect(mid.activeShot.effects.bloom.intensity).toBeCloseTo(1.25, 2);

    // After effect block completes: t=2500
    const after = evaluateProjectAtTime(project, 2500);
    expect(after.activeShot.effects.bloom.intensity).toBe(2.5);
  });

  it('5. Evaluates shot-to-shot transitions and produces outgoingFrame', () => {
    const shot1: Shot = createDefaultShot({
      id: 'shot-1',
      startMs: 0,
      durationMs: 3000,
    });

    const shot2: Shot = createDefaultShot({
      id: 'shot-2',
      startMs: 3000,
      durationMs: 4000,
      transition: {
        type: 'crossfade',
        durationMs: 1000,
        easing: { kind: 'preset', name: 'linear' },
      },
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot1, shot2] };

    // t=3500 (500ms into 1000ms transition of Shot 2)
    const frame = evaluateProjectAtTime(project, 3500);
    expect(frame.shotTransition.isTransitioning).toBe(true);
    expect(frame.shotTransition.type).toBe('crossfade');
    expect(frame.shotTransition.progress).toBeCloseTo(0.5, 2);
    expect(frame.shotTransition.outgoingFrame).toBeDefined();
    expect(frame.shotTransition.outgoingFrame?.activeShot.id).toBe('shot-1');

    // t=4500 (> transition duration)
    const afterTrans = evaluateProjectAtTime(project, 4500);
    expect(afterTrans.shotTransition.isTransitioning).toBe(false);
    expect(afterTrans.shotTransition.outgoingFrame).toBeUndefined();
  });

  it('6. Edge cases: empty shots array, negative time, and missing properties do not crash', () => {
    const emptyProject: Project = {
      ...DEFAULT_PROJECT,
      shots: [],
    };

    // Should gracefully fall back to a default shot without throwing
    const frame = evaluateProjectAtTime(emptyProject, -500);
    expect(frame.shotIndex).toBe(0);
    expect(frame.shotLocalTimeMs).toBe(0);
    expect(frame.activeShot).toBeDefined();
    expect(Array.isArray(frame.layers)).toBe(true);
  });

  it('7. Animated rack focus dynamically updates layer blur according to evaluated focus distance', () => {
    const layerAt1 = createDefaultImageLayer({
      id: 'l-target',
      position: { x: 0, y: 0, z: 1.0 },
      inMs: 0,
      outMs: 2000,
    });

    const shot = createDefaultShot({
      durationMs: 2000,
      layers: [layerAt1],
      effects: {
        ...DEFAULT_PROJECT.shots[0].effects,
        depthOfField: {
          enabled: true,
          target: { x: 0, y: 0, z: 0 },
          focusRange: 0.1,
          aperture: 2.8,
          bokehScale: 1.0,
          bokehShape: 'spherical',
        },
      },
      focusBlocks: [
        {
          id: 'focus-rack',
          startMs: 0,
          durationMs: 1000,
          fromZ: 0,
          toZ: 1.0,
          easing: { kind: 'preset', name: 'linear' },
        },
      ],
    });

    const project: Project = { ...DEFAULT_PROJECT, shots: [shot] };

    // At t=0: focus is at z=0, layer is at z=1 -> layer is out of focus, has blur
    const frameAt0 = evaluateProjectAtTime(project, 0);
    const layerAt0 = frameAt0.layers.find((l) => l.id === 'l-target')!;
    expect(layerAt0.dofBlurPx).toBeGreaterThan(0);
    const initialBlur = layerAt0.dofBlurPx;

    // At t=500: focus is at z=0.5 -> layer is closer to focus, blur decreases
    const frameAt500 = evaluateProjectAtTime(project, 500);
    const layerAt500 = frameAt500.layers.find((l) => l.id === 'l-target')!;
    expect(layerAt500.dofBlurPx).toBeLessThan(initialBlur);
    expect(layerAt500.dofBlurPx).toBeGreaterThan(0);

    // At t=1000: focus is at z=1.0 -> layer is exactly in focus, blur is 0
    const frameAt1000 = evaluateProjectAtTime(project, 1000);
    const layerAt1000 = frameAt1000.layers.find((l) => l.id === 'l-target')!;
    expect(layerAt1000.dofBlurPx).toBe(0);
  });

  it('8. Phase 0 Contract Fixture: validates multi-shot timebase, transition outgoingFrame, reused video assets, and future audio cues', () => {
    const fixture = createMultiShotContractFixture();
    const validation = validateProject(fixture);
    expect(validation.success).toBe(true);

    // Verify fixture contains audio clips at t=0 and after initial playhead (t=1200ms, t=3200ms)
    const audioStarts = fixture.audio?.clips.map((c) => c.startMs) ?? [];
    expect(audioStarts).toEqual([0, 1200, 3200]);

    // Verify Shot 1 evaluation at t=1500ms (shotLocalTimeMs = 1500ms)
    const frameShot1 = evaluateProjectAtTime(fixture, 1500);
    expect(frameShot1.activeShot.id).toBe('shot-1');
    expect(frameShot1.shotLocalTimeMs).toBe(1500);
    const vidShot1 = frameShot1.layers.find((l) => l.id === 'vid-shot1')!;
    expect(vidShot1.visible).toBe(true);

    // Verify Transition Midpoint at t=3500ms (Shot 2 startMs=3000ms, shotLocalTimeMs=500ms, 50% through 1000ms crossfade)
    const frameTransition = evaluateProjectAtTime(fixture, 3500);
    expect(frameTransition.activeShot.id).toBe('shot-2');
    expect(frameTransition.shotLocalTimeMs).toBe(500);
    expect(frameTransition.shotTransition.isTransitioning).toBe(true);
    expect(frameTransition.shotTransition.type).toBe('crossfade');
    expect(frameTransition.shotTransition.progress).toBeCloseTo(0.5, 3);
    expect(frameTransition.shotTransition.outgoingFrame).toBeDefined();
    expect(frameTransition.shotTransition.outgoingFrame?.activeShot.id).toBe('shot-1');
    expect(frameTransition.shotTransition.outgoingFrame?.layers.length).toBe(3);

    // Verify Shot-Local Video Timebase Contract in Shot 2 at global t=3600ms:
    // Shot 2 starts at 3000ms -> shotLocalTimeMs = 600ms.
    // 'vid-shot2-shared' has inMs = 400ms (shot-local), so its media offset is (600 - 400) = 200ms (0.2s), NOT (3600 - 400) = 3200ms!
    const frameShot2 = evaluateProjectAtTime(fixture, 3600);
    const sharedVidInShot2 = frameShot2.layers.find((l) => l.id === 'vid-shot2-shared')!;
    expect(sharedVidInShot2.visible).toBe(true);
    const expectedShotLocalVideoSec = (frameShot2.shotLocalTimeMs - sharedVidInShot2.layer.inMs) / 1000;
    const buggyGlobalVideoSec = (3600 - sharedVidInShot2.layer.inMs) / 1000;
    expect(expectedShotLocalVideoSec).toBeCloseTo(0.2, 3);
    expect(buggyGlobalVideoSec).toBeCloseTo(3.2, 3);
  });

  it('9. Phase 0 End-to-End Lifecycle Route: create shot -> add media -> edit/animate -> drag transaction undo -> evaluate', () => {
    const store = useProjectStore.getState();
    store.resetProject();

    // 1. Create Shot 1 (replaces blank placeholder) & Shot 2
    const s1 = store.addShot();
    const s2 = store.addShot();
    expect(useProjectStore.getState().project.shots.map((s) => s.id)).toEqual([s1.id, s2.id]);

    // 2. Add media & text layers to Shot 1
    const vidLayer = store.addLayerToShot(s1.id, 'video', { name: 'Demo Recording' });
    const txtLayer = store.addLayerToShot(s1.id, 'text', { name: 'Launch Title' });
    expect(useProjectStore.getState().project.shots[0].layers).toHaveLength(2);

    // 3. Perform a bracketed drag transaction on the text layer and verify single-step undo grouping
    const historyBeforeDrag = useProjectStore.getState().past.length;
    store.beginDragTransaction();
    store.updateLayer(s1.id, txtLayer.id, (l) => ({ ...l, position: { x: 0.1, y: 0.1, z: 0 } }), { skipHistory: true });
    store.updateLayer(s1.id, txtLayer.id, (l) => ({ ...l, position: { x: 0.25, y: 0.2, z: 0 } }), { skipHistory: true });
    store.commitDragTransaction();
    expect(useProjectStore.getState().past.length).toBe(historyBeforeDrag + 1);

    // 4. Evaluate across both shots and verify Undo restores pre-drag position
    const evalMoved = evaluateProjectAtTime(useProjectStore.getState().project, 500);
    expect(evalMoved.layers.find((l) => l.id === txtLayer.id)?.position.x).toBeCloseTo(0.25, 3);

    store.undo();
    const evalUndone = evaluateProjectAtTime(useProjectStore.getState().project, 500);
    expect(evalUndone.layers.find((l) => l.id === txtLayer.id)?.position.x).toBeCloseTo(0, 3);
    expect(vidLayer.kind).toBe('video');
  });

  it('10. Phase 0 Baseline Scale Benchmarks: records repeatable evaluation and serialization timings at 10, 100, and 500 layers', () => {
    const buildScaledProject = (shotCount: number, totalLayers: number): Project => {
      const layersPerShot = Math.ceil(totalLayers / shotCount);
      const shots: Shot[] = Array.from({ length: shotCount }, (_, sIdx) =>
        createDefaultShot({
          id: `scale-shot-${sIdx}`,
          name: `Shot ${sIdx + 1}`,
          startMs: sIdx * 3000,
          durationMs: 3000,
          layers: Array.from({ length: layersPerShot }, (__, lIdx) =>
            createDefaultShapeLayer({
              id: `layer-${sIdx}-${lIdx}`,
              name: `Layer ${lIdx}`,
              order: lIdx,
              inMs: 0,
              outMs: 3000,
              position: { x: (lIdx % 10) * 0.05 - 0.25, y: Math.floor(lIdx / 10) * 0.05 - 0.25, z: lIdx * 0.001 },
            })
          ),
        })
      );
      return { ...createMultiShotContractFixture(), shots };
    };

    const scales = [
      { label: 'small-10', shots: 1, layers: 10, maxEvalMs: 25 },
      { label: 'medium-100', shots: 3, layers: 100, maxEvalMs: 50 },
      { label: 'large-500', shots: 5, layers: 500, maxEvalMs: 120 },
    ];

    for (const scale of scales) {
      const proj = buildScaledProject(scale.shots, scale.layers);
      const t0 = performance.now();
      const frame = evaluateProjectAtTime(proj, 1500);
      const evalMs = performance.now() - t0;

      const s0 = performance.now();
      const json = JSON.stringify(proj);
      const serializeMs = performance.now() - s0;

      expect(frame.layers.length).toBeGreaterThan(0);
      expect(json.length).toBeGreaterThan(100);
      expect(evalMs).toBeLessThan(scale.maxEvalMs);
      expect(serializeMs).toBeLessThan(250);
    }
  });

  it('11. Phase 1 Parity: getShotTransitionCompositeState, resolveDepthOfFieldFocusZ, sequential CameraBlocks, and motionVector', () => {
    const project = createMultiShotContractFixture();
    // At t=3300ms (halfway through Shot 2's 600ms crossfade transition)
    const transFrame = evaluateProjectAtTime(project, 3300);
    const comp = getShotTransitionCompositeState(transFrame);
    expect(comp.isActive).toBe(true);
    expect(comp.outgoingLayers.length).toBeGreaterThan(0);
    expect(comp.incomingLayers.length).toBeGreaterThan(0);
    expect(comp.outgoingOpacity + comp.incomingOpacity).toBeCloseTo(1, 2);
    expect(comp.outgoingShotStartMs).toBe(0);

    // Foreground hero layer fallback for Depth-of-Field auto-focus
    const focusZ = resolveDepthOfFieldFocusZ(undefined, [
      { id: 'bg', position: { z: -0.8 } },
      { id: 'hero', position: { z: 0.35 } },
    ]);
    expect(focusZ).toBeCloseTo(0.35, 3);

    // Scene motionBlur populates effects.motionVector when camera/layers move
    project.shots[0].effects.motionBlur.enabled = true;
    const motionFrame = evaluateProjectAtTime(project, 300);
    expect(motionFrame.effects.motionVector).toBeDefined();
    expect(Math.hypot(motionFrame.effects.motionVector!.x, motionFrame.effects.motionVector!.y)).toBeGreaterThan(0);
  });
});

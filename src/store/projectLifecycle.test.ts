// src/store/projectLifecycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './useProjectStore';
import { useSelectionStore } from './useSelectionStore';
import { usePlayheadStore } from './usePlayheadStore';
import { DEFAULT_PROJECT, createDefaultProject, createDefaultShot } from '../model/defaults';
import { isBlankProjectState } from '../model/types';

describe('Project Lifecycle & Shot Management Store Methods', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('1. resetProject() creates an independent deep-copy and preserves DEFAULT_PROJECT immutability', () => {
    const store = useProjectStore.getState();

    // Mutate the active project in store
    store.updateProject((proj) => ({
      ...proj,
      name: 'Mutated Project Name',
      shots: [
        {
          ...proj.shots[0],
          name: 'Mutated Shot',
        },
      ],
    }));

    expect(useProjectStore.getState().project.name).toBe('Mutated Project Name');

    // Reset project
    store.resetProject();
    const freshProject = useProjectStore.getState().project;

    expect(freshProject.name).toBe(DEFAULT_PROJECT.name);
    expect(freshProject.shots[0].name).toBe(DEFAULT_PROJECT.shots[0].name);

    // Verify DEFAULT_PROJECT itself was never mutated
    expect(DEFAULT_PROJECT.name).toBe('Untitled project');

    // Verify createDefaultProject creates a new object reference each time
    const p1 = createDefaultProject();
    const p2 = createDefaultProject();
    expect(p1).not.toBe(p2);
    expect(p1.shots).not.toBe(p2.shots);
  });

  it('replaces the implicit placeholder once, then appends each added blank shot', () => {
    const store = useProjectStore.getState();
    expect(isBlankProjectState(store.project)).toBe(true);

    const firstShot = store.addShot();
    expect(useProjectStore.getState().project.shots).toHaveLength(1);
    expect(isBlankProjectState(useProjectStore.getState().project)).toBe(false);

    const secondShot = store.addShot();
    const shotsAfter = useProjectStore.getState().project.shots;

    expect(shotsAfter).toHaveLength(2);
    expect(shotsAfter.map((shot) => shot.id)).toEqual([firstShot.id, secondShot.id]);
    expect(shotsAfter.map((shot) => shot.startMs)).toEqual([0, firstShot.durationMs]);
  });

  it('recognizes and replaces a legacy markerless blank startup shot', () => {
    const store = useProjectStore.getState();
    store.updateProject((project) => ({
      ...project,
      shots: [createDefaultShot({
        id: 'legacy-shot',
        isPlaceholder: undefined,
        layers: [],
        groups: [],
        cameraBlocks: [],
        lightBlocks: [],
        effectBlocks: [],
      })],
    }));

    expect(isBlankProjectState(useProjectStore.getState().project)).toBe(true);
    const added = store.addShot();

    expect(useProjectStore.getState().project.shots).toEqual([added]);
  });

  it('deletes the last real shot and leaves the project with no shots', () => {
    const store = useProjectStore.getState();
    const first = createDefaultShot({ id: 'shot-1', name: 'Shot 1' });
    const last = createDefaultShot({ id: 'shot-2', name: 'Shot 2' });
    store.updateProject((project) => ({ ...project, shots: [first, last] }));

    store.deleteShot(first.id);
    expect(useProjectStore.getState().project.shots.map((shot) => shot.id)).toEqual([last.id]);

    store.deleteShot(last.id);
    expect(useProjectStore.getState().project.shots).toEqual([]);
    expect(isBlankProjectState(useProjectStore.getState().project)).toBe(true);
  });

  it('adds every layer kind without implicit entrance or exit transitions', () => {
    const store = useProjectStore.getState();

    for (const kind of ['video', 'image', 'shape', 'text'] as const) {
      const layer = store.addLayerToShot('shot-1', kind);
      expect(layer.entrance.type).toBe('none');
      expect(layer.exit.type).toBe('none');
      expect(layer.blocks).toEqual([]);
    }
  });

  it('3. splitShotAtPlayhead recalculates startMs for newly created and all subsequent shots', () => {
    const store = useProjectStore.getState();

    // Create 2 shots: Shot 1 (4000ms, startMs: 0), Shot 2 (3000ms, startMs: 4000)
    store.updateProject((proj) => ({
      ...proj,
      shots: [
        createDefaultShot({
          id: 'shot-1',
          name: 'Shot 1',
          durationMs: 4000,
          startMs: 0,
          layers: [],
          cameraBlocks: [],
          lightBlocks: [],
          effectBlocks: [],
        }),
        createDefaultShot({
          id: 'shot-2',
          name: 'Shot 2',
          durationMs: 3000,
          startMs: 4000,
          layers: [],
          cameraBlocks: [],
          lightBlocks: [],
          effectBlocks: [],
        }),
      ],
    }));

    // Split Shot 1 at 1500ms
    const result = store.splitShotAtPlayhead('shot-1', 1500);
    expect(result).not.toBeNull();

    const shots = useProjectStore.getState().project.shots;
    expect(shots.length).toBe(3);

    // Shot 1 (first half)
    expect(shots[0].id).toBe('shot-1');
    expect(shots[0].startMs).toBe(0);
    expect(shots[0].durationMs).toBe(1500);

    // Split shot (second half)
    expect(shots[1].startMs).toBe(1500);
    expect(shots[1].durationMs).toBe(2500);

    // Subsequent shot (Shot 2) must start at 1500 + 2500 = 4000ms
    expect(shots[2].id).toBe('shot-2');
    expect(shots[2].startMs).toBe(4000);
    expect(shots[2].durationMs).toBe(3000);
  });

  it('undo prunes deleted layer IDs from selection store and updates validation', () => {
    const projectStore = useProjectStore.getState();
    const shot = projectStore.addShot();
    const layer = projectStore.addLayerToShot(shot.id, 'shape');

    useSelectionStore.getState().selectShot(shot.id);
    useSelectionStore.getState().selectLayer(layer.id);
    expect(useSelectionStore.getState().selectedLayerIds).toEqual([layer.id]);

    // Now undo the layer addition
    projectStore.undo();

    // Verify layer is no longer in project
    const currentShot = useProjectStore.getState().project.shots.find((s) => s.id === shot.id);
    expect(currentShot?.layers.find((l) => l.id === layer.id)).toBeUndefined();

    // Verify selection store pruned the removed layer
    expect(useSelectionStore.getState().selectedLayerIds).toEqual([]);
    expect(useProjectStore.getState().validation.success).toBe(true);
  });

  it('loadProjectJson clears history, resets playhead to 0, and resets selection', () => {
    useProjectStore.getState().addShot();
    const shot = useProjectStore.getState().project.shots[0];
    const layer = useProjectStore.getState().addLayerToShot(shot.id, 'text');
    useSelectionStore.getState().selectShot(shot.id);
    useSelectionStore.getState().selectLayer(layer.id);
    usePlayheadStore.getState().setCurrentTimeMs(2500);

    expect(useProjectStore.getState().past.length).toBeGreaterThan(0);
    expect(usePlayheadStore.getState().currentTimeMs).toBe(2500);
    expect(useSelectionStore.getState().selectedLayerIds).toEqual([layer.id]);

    const newProject = createDefaultProject();
    newProject.name = 'Imported Project';

    const result = useProjectStore.getState().loadProjectJson(JSON.stringify(newProject));
    expect(result.success).toBe(true);

    const state = useProjectStore.getState();
    expect(state.project.name).toBe('Imported Project');
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(usePlayheadStore.getState().currentTimeMs).toBe(0);
    expect(useSelectionStore.getState().selectedLayerIds).toEqual([]);
    expect(useSelectionStore.getState().selectedShotId).toBe(state.project.shots[0].id);
  });

  it('updateProject refreshes updatedAt for one-shot skipHistory updates and stamps once on commitDragTransaction', () => {
    const store = useProjectStore.getState();
    store.updateProject((p) => ({ ...p, updatedAt: '2020-01-01T00:00:00.000Z' }), { skipHistory: true });
    // One-shot skipHistory outside drag refreshes updatedAt without adding to history
    const oneShotUpdatedAt = useProjectStore.getState().project.updatedAt;
    expect(oneShotUpdatedAt).not.toBe('2020-01-01T00:00:00.000Z');
    expect(useProjectStore.getState().past.length).toBe(0);

    // Drag transaction preserves updatedAt during drag frames and stamps once on commit
    store.beginDragTransaction();
    const dragStartUpdatedAt = useProjectStore.getState().project.updatedAt;
    store.updateProject((p) => ({ ...p, name: 'Transient Change' }), { skipHistory: true });
    expect(useProjectStore.getState().project.name).toBe('Transient Change');
    expect(useProjectStore.getState().project.updatedAt).toBe(dragStartUpdatedAt);

    store.commitDragTransaction();
    expect(useProjectStore.getState().past.length).toBe(1);
    expect(useProjectStore.getState().project.updatedAt.length).toBeGreaterThan(0);
  });
});

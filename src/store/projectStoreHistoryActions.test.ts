import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './useProjectStore';

describe('project store drag transactions', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('cancels a drag before any project change without changing history', () => {
    const store = useProjectStore.getState();
    const startingProject = store.project;
    const startingPast = store.past;
    const startingFuture = store.future;

    store.beginDragTransaction();
    store.cancelDragTransaction();

    expect(useProjectStore.getState().project).toBe(startingProject);
    expect(useProjectStore.getState().dragSnapshot).toBeNull();
    expect(useProjectStore.getState().past).toBe(startingPast);
    expect(useProjectStore.getState().future).toBe(startingFuture);
  });

  it('restores the exact starting project and leaves history unchanged after multiple updates', () => {
    const store = useProjectStore.getState();
    store.updateProject((project) => ({ ...project, name: 'History entry 1' }));
    store.updateProject((project) => ({ ...project, name: 'History entry 2' }));
    store.undo();

    const currentStore = useProjectStore.getState();
    const startingProject = currentStore.project;
    const startingPast = currentStore.past;
    const startingFuture = currentStore.future;

    currentStore.beginDragTransaction();
    currentStore.updateProject((project) => ({ ...project, name: 'First drag update' }));
    currentStore.updateProject((project) => ({ ...project, name: 'Second drag update' }));
    currentStore.cancelDragTransaction();

    expect(useProjectStore.getState().project).toBe(startingProject);
    expect(useProjectStore.getState().dragSnapshot).toBeNull();
    expect(useProjectStore.getState().past).toBe(startingPast);
    expect(useProjectStore.getState().future).toBe(startingFuture);
  });

  it('commits updates as one undoable history entry', () => {
    const store = useProjectStore.getState();
    const startingProject = store.project;

    store.beginDragTransaction();
    store.updateProject((project) => ({ ...project, name: 'First drag update' }));
    store.updateProject((project) => ({ ...project, name: 'Committed drag update' }));
    store.commitDragTransaction();

    expect(useProjectStore.getState().project.name).toBe('Committed drag update');
    expect(useProjectStore.getState().past).toEqual([startingProject]);
    expect(useProjectStore.getState().dragSnapshot).toBeNull();

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project).toBe(startingProject);
  });
});

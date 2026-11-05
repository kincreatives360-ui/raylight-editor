import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../model/defaults';
import { validateProject } from '../model/schema';
import { useProjectStore } from '../store/useProjectStore';

describe('Pen path layer lifecycle', () => {
  it('stores a closed polygon path as a selectable, undoable, serializable shape layer', () => {
    const project = createDefaultProject();
    const store = useProjectStore.getState();
    expect(store.loadProjectJson(project).success).toBe(true);
    const shotId = project.shots[0].id;
    const path = store.addLayerToShot(shotId, 'shape', {
      name: 'Pen path',
      shape: 'polygon',
      points: [{ x: 0, y: 0 }, { x: 1, y: 0.2 }, { x: 0.7, y: 1 }],
      position: { x: 0.1, y: -0.1, z: 0.1 },
      size: { width: 0.35, height: 0.22 },
    });
    expect(path).toMatchObject({ kind: 'shape', shape: 'polygon', name: 'Pen path' });
    expect(path.kind === 'shape' ? path.points : []).toHaveLength(3);
    const saved = validateProject(JSON.parse(JSON.stringify(useProjectStore.getState().project)));
    expect(saved.success).toBe(true);
    if (saved.success) {
      const loadedPath = saved.data.shots.find((shot) => shot.id === shotId)?.layers.find((layer) => layer.id === path.id);
      expect(loadedPath).toEqual(path);
    }
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.shots.find((shot) => shot.id === shotId)?.layers.some((layer) => layer.id === path.id)).toBe(false);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.shots.find((shot) => shot.id === shotId)?.layers.some((layer) => layer.id === path.id)).toBe(true);
    useProjectStore.getState().resetProject();
  });
});

import { describe, expect, it } from 'vitest';
import { createDefaultProject } from './defaults';
import { resolveShotBackground } from './types';
import { useProjectStore } from '../store/useProjectStore';

describe('independent project and shot backgrounds', () => {
    it('follows project changes only for inheriting shots and preserves a saved override', () => {
        const project = createDefaultProject();
        project.background = { kind: 'solid', color: '#123456' };
        const shot = project.shots[0];
        shot.background = { kind: 'solid', color: '#ff9900' };
        shot.useProjectBackground = true;
        useProjectStore.setState({ project });
        const store = useProjectStore.getState();
        store.updateProject((p) => ({ ...p, background: { kind: 'solid', color: '#abcdef' } }));
        let state = useProjectStore.getState().project;
        expect(resolveShotBackground(state, state.shots[0])).toEqual({ kind: 'solid', color: '#abcdef' });
        expect(state.shots[0].background).toEqual({ kind: 'solid', color: '#ff9900' });
        store.updateShot(shot.id, (s) => ({ ...s, useProjectBackground: false }));
        state = useProjectStore.getState().project;
        expect(resolveShotBackground(state, state.shots[0])).toEqual({ kind: 'solid', color: '#ff9900' });
        expect(state.background).toEqual({ kind: 'solid', color: '#abcdef' });
    });
});

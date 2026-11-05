import type { CameraBlock } from '../model/types';
import { createDefaultCameraBlock } from '../model/defaults';
import { generateId } from '../model/id';
import type { ProjectStoreActionCreator } from './projectStoreTypes';

export const createCameraActions: ProjectStoreActionCreator<'addCameraBlockToShot'> = (_set, get) => ({
    addCameraBlockToShot: (shotId, options = {}) => {
        const shot = get().project.shots.find((candidate) => candidate.id === shotId);
        if (!shot) return null;

        const id = generateId('cam-blk');
        const block: CameraBlock = {
            ...createDefaultCameraBlock(
                id,
                options.startMs ?? 0,
                options.durationMs ?? shot.durationMs,
                options.fromFramingId ?? shot.framings[0]?.id ?? 'f1',
                options.toFramingId ?? shot.framings[1]?.id ?? 'f2',
                options.label ?? 'Camera Move'
            ),
            ...(options.mode ? { mode: options.mode } : {}),
            ...(options.from ? { from: options.from } : {}),
            ...(options.to ? { to: options.to } : {}),
            ...(options.easing ? { easing: options.easing } : {}),
        };

        get().updateShot(shotId, (currentShot) => ({
            ...currentShot,
            cameraBlocks: [...(currentShot.cameraBlocks || []), block],
        }));
        return block;
    },

});

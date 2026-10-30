import type {
  AnimationBlockProperty,
  AssetRecord,
  AudioClip,
  CameraBlock,
  CameraKeyframeEndpoint,
  Easing,
  Group,
  ImageLayer,
  Layer,
  Project,
  ShapeLayer,
  Shot,
  TextLayer,
  Vec3,
} from '../model/types';
import type { ValidationResult } from '../model/schema';
import type { StoreApi } from 'zustand';

export interface AddCameraBlockOptions {
    label?: string;
    startMs?: number;
    durationMs?: number;
    mode?: CameraBlock['mode'];
    fromFramingId?: string;
    toFramingId?: string;
    from?: CameraKeyframeEndpoint;
    to?: CameraKeyframeEndpoint;
    easing?: Easing;
}

export type RestackMode = 'forward' | 'backward' | 'front' | 'back';

export interface ProjectStore {
    project: Project;
    past: Project[];
    future: Project[];
    dragSnapshot: Project | null;
    validation: ValidationResult;
    isHydrating: boolean;
    hydrationRevision: number;
    setHydrated: (status: boolean) => void;

    updateProject: (
        updater: (project: Project) => Project,
        options?: { skipHistory?: boolean }
    ) => void;
    updateShot: (
        shotId: string,
        updater: Partial<Shot> | ((shot: Shot) => Shot),
        options?: { skipHistory?: boolean }
    ) => void;
    updateLayer: (
        shotId: string,
        layerId: string,
        updater: (layer: Layer) => Layer,
        options?: { skipHistory?: boolean }
    ) => void;

    addLayerToShot: (
        shotId: string,
        kind: Layer['kind'],
        customOverrides?: Partial<ImageLayer> &
            Partial<ShapeLayer> &
            Partial<TextLayer>
    ) => Layer;
    addCameraBlockToShot: (
        shotId: string,
        options?: AddCameraBlockOptions
    ) => CameraBlock | null;
    toggleProjectAudioMuted: () => void;
    addMultipleLayersToShot: (
        shotId: string,
        newLayers: Layer[],
        newAssets?: Record<string, AssetRecord>
    ) => Layer[];
    deleteLayerFromShot: (shotId: string, layerId: string) => void;
    deleteMultipleLayersFromShot: (shotId: string, layerIds: string[]) => void;
    duplicateLayerInShot: (shotId: string, layerId: string) => Layer | null;
    reorderLayerInShot: (
        shotId: string,
        layerId: string,
        direction: 'up' | 'down'
    ) => void;
    restackLayerInShot: (
        shotId: string,
        layerId: string,
        mode: RestackMode
    ) => void;
    moveLayerToOrderAndGroup: (
        shotId: string,
        draggedLayerId: string,
        targetLayerId: string | null,
        targetGroupId: string | undefined
    ) => void;

    recordAnimatedBlockAtPlayhead: (
        shotId: string,
        layerId: string,
        property: AnimationBlockProperty,
        deltaAmount: Vec3 | number,
        shotLocalTimeMs: number,
        labelPrefix?: string,
        options?: { skipHistory?: boolean }
    ) => string;

    createGroupFromLayers: (
        shotId: string,
        layerIds: string[],
        name?: string
    ) => Group | null;
    ungroupInShot: (shotId: string, groupId: string) => void;
    updateGroupInShot: (
        shotId: string,
        groupId: string,
        updater: (group: Group) => Group
    ) => void;

    addShot: () => Shot;
    duplicateShot: (shotId: string) => Shot | null;
    deleteShot: (shotId: string) => void;
    splitShotAtPlayhead: (shotId: string, globalTimeMs: number) => Shot | null;
    splitAudioClipAtPlayhead: (clipId: string, globalTimeMs: number) => AudioClip | null;
    splitAtPlayhead: (globalTimeMs: number) => boolean;

    beginDragTransaction: () => void;
    commitDragTransaction: () => void;
    undo: () => void;
    redo: () => void;
    resetProject: () => void;
    loadProjectJson: (rawJson: unknown) => ValidationResult;
}


export type ProjectStoreActionCreator<K extends keyof ProjectStore> =
  (set: StoreApi<ProjectStore>['setState'], get: StoreApi<ProjectStore>['getState']) => Pick<ProjectStore, K>;

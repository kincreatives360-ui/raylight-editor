import type { ChangeEvent } from 'react';
import { importProjectFromFile } from '../storage/projectIO';
import { useProjectStore } from '../store/useProjectStore';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useSelectionStore } from '../store/useSelectionStore';

type UpdateProject = ReturnType<typeof useProjectStore.getState>['updateProject'];

export async function handleAppProjectImport(
  event: ChangeEvent<HTMLInputElement>,
  updateProject: UpdateProject,
  onError?: (message: string) => void
): Promise<void> {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';

  const result = await importProjectFromFile(file);
  if ('project' in result) {
    const playhead = usePlayheadStore.getState();
    playhead.setIsPlaying(false);
    playhead.setCurrentTimeMs(0);

    updateProject(() => result.project, { skipHistory: false });

    const selection = useSelectionStore.getState();
    selection.clearLayerSelection();
    selection.selectCameraBlock(null);
    selection.selectLightBlock(null);
    selection.selectLight(null);
    selection.selectAudioClip(null);
    if (result.project.shots[0]?.id) {
      selection.selectShot(result.project.shots[0].id);
    }
  } else {
    const errorMsg = 'Failed to import project: ' + (result.errors[0] || 'Invalid file format');
    console.error(errorMsg, result.errors);
    if (onError) {
      onError(errorMsg);
    }
  }
}

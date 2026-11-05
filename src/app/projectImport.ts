import type { ChangeEvent } from 'react';
import { importProjectFromFile } from '../storage/projectIO';
import { useProjectStore } from '../store/useProjectStore';

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
    updateProject(() => result.project, { skipHistory: false });
  } else {
    const errorMsg = 'Failed to import project: ' + (result.errors[0] || 'Invalid file format');
    console.error(errorMsg, result.errors);
    if (onError) {
      onError(errorMsg);
    }
  }
}

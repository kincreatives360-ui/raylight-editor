import type { ChangeEvent } from 'react';
import { importProjectFromFile } from '../storage/projectIO';
import { useProjectStore } from '../store/useProjectStore';

type UpdateProject = ReturnType<typeof useProjectStore.getState>['updateProject'];

export async function handleAppProjectImport(
  event: ChangeEvent<HTMLInputElement>,
  updateProject: UpdateProject
): Promise<void> {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';

  const result = await importProjectFromFile(file);
  if (result.success) {
    updateProject(() => result.project, { skipHistory: false });
  } else {
    console.error('Failed to import project file:', result.errors);
    alert('Failed to import project: ' + (result.errors?.[0] || 'Invalid file format'));
  }
}

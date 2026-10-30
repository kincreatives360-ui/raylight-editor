import { useEffect, type MutableRefObject } from 'react';
import type { Layer, Project } from '../model/types';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { parseFigmaSvgToLayers, readImageFileWithThumbnail } from '../engine/figmaSvgImporter';

interface UseAppClipboardPasteOptions {
  activeShot: Project['shots'][number];
  copiedLayersRef: MutableRefObject<Layer[]>;
  addLayerToShot: ReturnType<typeof useProjectStore.getState>['addLayerToShot'];
  addMultipleLayersToShot: ReturnType<typeof useProjectStore.getState>['addMultipleLayersToShot'];
  updateProject: ReturnType<typeof useProjectStore.getState>['updateProject'];
  selectLayer: ReturnType<typeof useSelectionStore.getState>['selectLayer'];
  setSelectedLayerIds: ReturnType<typeof useSelectionStore.getState>['setSelectedLayerIds'];
  setInspectorTab: ReturnType<typeof useSelectionStore.getState>['setInspectorTab'];
}

export function useAppClipboardPaste({
  activeShot,
  copiedLayersRef,
  addLayerToShot,
  addMultipleLayersToShot,
  updateProject,
  selectLayer,
  setSelectedLayerIds,
  setInspectorTab,
}: UseAppClipboardPasteOptions): void {
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const plainText = clipboard.getData('text/plain') || '';
      if (plainText.trim().startsWith('<svg') || plainText.includes('<svg')) {
        event.preventDefault();
        const parsed = parseFigmaSvgToLayers(plainText, activeShot.durationMs, activeShot.layers.length);
        if (parsed.layers.length > 0) {
          addMultipleLayersToShot(activeShot.id, parsed.layers, parsed.assets);
          setInspectorTab('layer');
          setSelectedLayerIds(parsed.layers.map((layer) => layer.id));
        }
        return;
      }

      const items = Array.from(clipboard.items || []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        event.preventDefault();
        const file = imageItem.getAsFile();
        if (file) {
          const assetRecord = await readImageFileWithThumbnail(file);
          const newLayer = addLayerToShot(activeShot.id, 'image', {
            name: 'Pasted image',
            assetId: assetRecord.id,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
          });
          updateProject(
            (project) => ({ ...project, assets: { ...project.assets, [assetRecord.id]: assetRecord } }),
            { skipHistory: true }
          );
          setInspectorTab('layer');
          selectLayer(newLayer.id, false);
        }
        return;
      }

      if (copiedLayersRef.current.length > 0) {
        event.preventDefault();
        const clonedLayers: Layer[] = copiedLayersRef.current.map((original, index) => {
          const clone: Layer = structuredClone(original);
          clone.id = `layer-${original.kind}-${Date.now()}-${index}`;
          clone.name = `${original.name} Copy`;
          clone.position = {
            ...original.position,
            x: Number((original.position.x + 0.03).toFixed(4)),
            y: Number((original.position.y + 0.03).toFixed(4)),
          };
          return clone;
        });
        addMultipleLayersToShot(activeShot.id, clonedLayers);
        setInspectorTab('layer');
        setSelectedLayerIds(clonedLayers.map((layer) => layer.id));
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [
    activeShot.id,
    activeShot.durationMs,
    activeShot.layers.length,
    addLayerToShot,
    addMultipleLayersToShot,
    copiedLayersRef,
    selectLayer,
    setSelectedLayerIds,
    setInspectorTab,
    updateProject,
  ]);
}

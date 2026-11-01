import type { ChangeEvent } from 'react';
import type { Layer, Project } from '../model/types';
import { createDefaultShot, createDefaultVideoLayer } from '../model/defaults';
import { usePlayheadStore } from '../store/usePlayheadStore';
import { useProjectStore } from '../store/useProjectStore';
import { useSelectionStore } from '../store/useSelectionStore';
import { parseFigmaSvgToLayers, readImageFileWithThumbnail } from '../engine/figmaSvgImporter';

interface MediaImportOptions {
  activeShot?: Project['shots'][number];
  selectedLayer: Layer | undefined;
  updateProject: ReturnType<typeof useProjectStore.getState>['updateProject'];
  addLayerToShot: ReturnType<typeof useProjectStore.getState>['addLayerToShot'];
  addMultipleLayersToShot: ReturnType<typeof useProjectStore.getState>['addMultipleLayersToShot'];
  selectLayer: ReturnType<typeof useSelectionStore.getState>['selectLayer'];
  setSelectedLayerIds: ReturnType<typeof useSelectionStore.getState>['setSelectedLayerIds'];
  setInspectorTab: ReturnType<typeof useSelectionStore.getState>['setInspectorTab'];
  setAudioLabel: (label: string) => void;
}

export async function handleAppMediaUpload(
  event: ChangeEvent<HTMLInputElement>,
  {
    activeShot,
    selectedLayer,
    updateProject,
    addLayerToShot,
    addMultipleLayersToShot,
    selectLayer,
    setSelectedLayerIds,
    setInspectorTab,
    setAudioLabel,
  }: MediaImportOptions
): Promise<void> {
  const file = event.target.files?.[0];
  if (!file) return;

  // Resolve target shot or create one if the project has no shots
  let targetShot = activeShot;
  if (!targetShot) {
    const store = useProjectStore.getState();
    const existing = store.project.shots.find((s) => !s.isPlaceholder);
    if (existing) {
      targetShot = existing;
    } else {
      targetShot = store.addShot();
      useSelectionStore.getState().selectShot(targetShot.id);
    }
  }

  const shotId = targetShot.id;
  const shotDurationMs = targetShot.durationMs ?? 4000;
  const shotStartMs = targetShot.startMs ?? 0;
  const layerCount = targetShot.layers?.length ?? 0;

  if (file.type.startsWith('video/')) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = dataUrl;
    const addVideoClip = (durationMs: number) => {
      const assetId = `video-asset-${Date.now()}`;
      const videoWidth = video.videoWidth || 1920;
      const videoHeight = video.videoHeight || 1080;
      const asset = {
        id: assetId,
        name: file.name,
        mimeType: file.type,
        dataUrl,
        width: videoWidth,
        height: videoHeight,
      };
      const currentPlayheadMs = usePlayheadStore.getState().currentTimeMs;
      const clipDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
      const clipEnd = currentPlayheadMs + clipDuration;

      const videoLayer = createDefaultVideoLayer({
        id: `layer-video-${Date.now()}`,
        name: file.name,
        order: layerCount + 1,
        inMs: 0,
        outMs: shotDurationMs,
        assetId,
        size: { width: 0.65, height: Math.min(0.85, 0.65 * (videoHeight / (videoWidth || 1))) },
      });

      updateProject((project) => {
        const currentTotal = project.shots.reduce((max, shot) => Math.max(max, shot.startMs + shot.durationMs), 0);
        let nextShots = project.shots;
        if (clipEnd > currentTotal) {
          if (nextShots.length === 0) {
            nextShots = [createDefaultShot({ durationMs: clipEnd })];
          } else {
            const lastIndex = nextShots.length - 1;
            nextShots = nextShots.map((shot, index) =>
              index === lastIndex ? { ...shot, durationMs: clipEnd - shot.startMs } : shot
            );
          }
        }
        const effectiveShotId = shotId || nextShots[0]?.id;
        nextShots = nextShots.map((shot) =>
          shot.id === effectiveShotId ? { ...shot, layers: [...shot.layers, videoLayer] } : shot
        );

        return {
          ...project,
          shots: nextShots,
          assets: { ...project.assets, [assetId]: asset },
          audio: {
            clips: [
              ...(project.audio?.clips || []),
              {
                id: `audio-${assetId}`,
                name: file.name,
                assetId,
                dataUrl,
                startMs: currentPlayheadMs,
                durationMs: clipDuration,
                offsetMs: 0,
                volume: 1,
                muted: false,
              },
            ],
            muted: project.audio?.muted || false,
            masterVolume: project.audio?.masterVolume ?? 1,
          },
        };
      });

      setSelectedLayerIds([videoLayer.id]);
      setInspectorTab('layer');
      setAudioLabel(file.name);
      event.target.value = '';
    };
    video.addEventListener('loadedmetadata', () => addVideoClip(video.duration * 1000), { once: true });
    video.addEventListener('error', () => addVideoClip(10000), { once: true });
    return;
  }

  if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
    const svgText = await file.text();
    const parsed = parseFigmaSvgToLayers(svgText, shotDurationMs, layerCount);
    if (parsed.layers.length > 0) {
      addMultipleLayersToShot(shotId, parsed.layers, parsed.assets);
      setInspectorTab('layer');
      setSelectedLayerIds(parsed.layers.map((layer) => layer.id));
    }
    event.target.value = '';
    return;
  }

  const assetRecord = await readImageFileWithThumbnail(file);
  updateProject((project) => ({ ...project, assets: { ...project.assets, [assetRecord.id]: assetRecord } }), { skipHistory: true });
  if (selectedLayer?.kind === 'image') {
    updateProject((project) => ({
      ...project,
      shots: project.shots.map((shot) => shot.id !== shotId ? shot : ({
        ...shot,
        layers: shot.layers.map((layer) =>
          layer.id === selectedLayer.id && layer.kind === 'image'
            ? { ...layer, assetId: assetRecord.id, name: file.name }
            : layer
        ),
      })),
    }));
    selectLayer(selectedLayer.id, false);
  } else {
    const currentPlayheadMs = usePlayheadStore.getState().currentTimeMs;
    const newLayer = addLayerToShot(shotId, 'image', {
      name: file.name,
      assetId: assetRecord.id,
      position: { x: 0, y: 0, z: 0.1 },
      rotation: { x: 0, y: 0, z: 0 },
      size: {
        width: Math.min(0.85, (assetRecord.width / Math.max(1, assetRecord.height)) * 0.42),
        height: 0.72,
      },
      inMs: Math.max(0, Math.min(Math.max(0, shotDurationMs - 1), currentPlayheadMs - shotStartMs)),
      outMs: shotDurationMs,
    });
    selectLayer(newLayer.id, false);
  }
  setInspectorTab('layer');
  event.target.value = '';
}

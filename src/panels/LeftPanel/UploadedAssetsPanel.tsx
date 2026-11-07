import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Video as VideoIcon } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { SearchField } from '../../ui/SearchField';
import { ModalShell } from '../../ui/ModalShell';
import { readImageFileWithThumbnail } from '../../engine/figmaSvgImporter';
import { createDefaultVideoLayer } from '../../model/defaults';
import type { Shot, AssetRecord } from '../../model/types';

interface UploadedAssetsPanelProps {
    project?: import('../../model/types').Project;
    activeShot?: Shot;
    onUploadClick: () => void;
}

export const UploadedAssetsPanel: React.FC<UploadedAssetsPanelProps> = ({
    project: propProject,
    activeShot,
    onUploadClick,
}) => {
    const storeProject = useProjectStore((state) => state.project);
    const project = propProject ?? storeProject;
    const updateProject = useProjectStore((state) => state.updateProject);
    const deleteAsset = useProjectStore((state) => state.deleteAsset);
    const addLayerToShot = useProjectStore((state) => state.addLayerToShot);
    const addShot = useProjectStore((state) => state.addShot);

    const selectLayer = useSelectionStore((state) => state.selectLayer);
    const selectShot = useSelectionStore((state) => state.selectShot);
    const setInspectorTab = useSelectionStore((state) => state.setInspectorTab);

    const [searchQuery, setSearchQuery] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<AssetRecord | null>(null);

    const assetList = useMemo(
        () => Object.values(project.assets).filter((a) => !a.mimeType?.startsWith('audio/')),
        [project.assets]
    );

    const filteredAssets = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return assetList;
        return assetList.filter((asset) => asset.name.toLowerCase().includes(q));
    }, [assetList, searchQuery]);

    const getAssetUsageCount = (assetId: string) => {
        let count = 0;
        if (project.background?.kind === 'image' && project.background.assetId === assetId) {
            count++;
        }
        for (const shot of project.shots) {
            if (shot.background?.kind === 'image' && shot.background.assetId === assetId) {
                count++;
            }
            for (const layer of shot.layers) {
                if ((layer as { assetId?: string }).assetId === assetId) {
                    count++;
                }
            }
        }
        return count;
    };

    const handleProcessFile = async (file: File) => {
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

            await new Promise<void>((resolve) => {
                const onLoaded = () => {
                    const assetId = `video-asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const videoWidth = video.videoWidth || 1920;
                    const videoHeight = video.videoHeight || 1080;
                    const asset: AssetRecord = {
                        id: assetId,
                        name: file.name,
                        mimeType: file.type,
                        dataUrl,
                        width: videoWidth,
                        height: videoHeight,
                    };

                    updateProject((proj) => ({
                        ...proj,
                        assets: { ...proj.assets, [assetId]: asset },
                    }));

                    let shotId = activeShot?.id;
                    if (!shotId) {
                        const createdShot = addShot();
                        shotId = createdShot.id;
                        selectShot(shotId);
                    }

                    const videoLayer = createDefaultVideoLayer({
                        id: `layer-video-${Date.now()}`,
                        name: file.name,
                        order: (activeShot?.layers.length ?? 0) + 1,
                        inMs: 0,
                        outMs: activeShot?.durationMs ?? 4000,
                        assetId,
                        size: { width: 0.65, height: Math.min(0.85, 0.65 * (videoHeight / (videoWidth || 1))) },
                    });

                    updateProject((proj) => ({
                        ...proj,
                        shots: proj.shots.map((s) =>
                            s.id === shotId ? { ...s, layers: [...s.layers, videoLayer] } : s
                        ),
                    }));
                    setInspectorTab('layer');
                    selectLayer(videoLayer.id);
                    video.removeEventListener('error', onError);
                    resolve();
                };
                const onError = () => {
                    video.removeEventListener('loadedmetadata', onLoaded);
                    resolve();
                };
                video.addEventListener('loadedmetadata', onLoaded, { once: true });
                video.addEventListener('error', onError, { once: true });
            });
            return;
        }

        try {
            const assetRecord = await readImageFileWithThumbnail(file);
            updateProject(
                (proj) => ({
                    ...proj,
                    assets: { ...proj.assets, [assetRecord.id]: assetRecord },
                }),
                { skipHistory: true }
            );

            let shotId = activeShot?.id;
            if (!shotId) {
                const createdShot = addShot();
                shotId = createdShot.id;
                selectShot(shotId);
            }

            const created = addLayerToShot(shotId, 'image', {
                assetId: assetRecord.id,
                name: file.name,
                rotation: { x: 0, y: 0, z: 0 },
            });
            setInspectorTab('layer');
            selectLayer(created.id);
        } catch {
            // Non-image/non-video or invalid format dropped
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        for (const file of files) {
            try {
                await handleProcessFile(file);
            } catch {
                // Continue processing subsequent files after a failure
            }
        }
    };

    return (
        <div
            className={`flex-1 flex flex-col min-h-0 gap-2.5 transition-all rounded-xl ${
                isDragOver ? 'ring-2 ring-brand-blue bg-brand-blue/5' : ''
            }`}
            onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setIsDragOver(true);
                }
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDragOver(false);
                }
            }}
            onDrop={handleDrop}
        >
            <button
                type="button"
                onClick={onUploadClick}
                className="w-full py-2 px-3 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-brand-blue/15"
            >
                <Plus className="w-4 h-4" />
                <span>Upload Media</span>
            </button>

            <SearchField
                containerClassName="relative"
                iconClassName="w-3.5 h-3.5 text-disabled absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                type="text"
                placeholder="Search assets"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-surface border border-subtle text-[11px] text-foreground placeholder:text-disabled focus:outline-none focus:border-brand-blue transition-colors"
                clearButtonClassName="text-muted-foreground hover:text-foreground cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {filteredAssets.map((asset) => {
                    const isVideo = asset.mimeType?.startsWith('video/') || false;
                    return (
                        <div
                            key={asset.id}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('application/x-raylight-asset-id', asset.id);
                                e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => {
                                let shotId = activeShot?.id;
                                if (!shotId) {
                                    const createdShot = addShot();
                                    shotId = createdShot.id;
                                    selectShot(shotId);
                                }
                                const created = addLayerToShot(shotId, isVideo ? 'video' : 'image', {
                                    assetId: asset.id,
                                    name: asset.name,
                                    rotation: { x: 0, y: 0, z: 0 },
                                });
                                setInspectorTab('layer');
                                selectLayer(created.id);
                            }}
                            className="p-2 rounded-xl bg-surface hover:bg-subtle border border-subtle flex items-center gap-2.5 cursor-grab transition group"
                        >
                            <div className="w-10 h-8 rounded-lg bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                {asset.thumbUrl || asset.dataUrl ? (
                                    <img
                                        src={asset.thumbUrl || asset.dataUrl}
                                        alt={asset.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : isVideo ? (
                                    <VideoIcon className="w-4 h-4 text-brand-blue" />
                                ) : (
                                    <ImageIcon className="w-4 h-4 text-brand-blue" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-medium text-foreground truncate group-hover:text-brand-blue transition-colors">
                                    {asset.name}
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground">
                                    {asset.width}&times;{asset.height}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                    type="button"
                                    title="Set as Canvas Background"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateProject((proj) => ({
                                            ...proj,
                                            background: {
                                                kind: 'image',
                                                assetId: asset.id,
                                                src: asset.dataUrl,
                                                color: '#000000',
                                                fit: 'cover',
                                                dim: 0,
                                                blur: 0,
                                                opacity: 1,
                                            },
                                        }));
                                    }}
                                    className="px-2 py-1 rounded-md bg-white/10 hover:bg-brand-blue text-muted-foreground hover:text-white text-[10px] font-medium transition cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                    Set Bg
                                </button>
                                <button
                                    type="button"
                                    title="Delete from library"
                                    aria-label="Delete from library"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setAssetToDelete(asset);
                                    }}
                                    className="p-1 rounded-md bg-white/10 hover:bg-rose-500/80 text-muted-foreground hover:text-white transition cursor-pointer flex items-center justify-center"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredAssets.length === 0 && (
                    <div className="py-10 text-center text-xs text-disabled border border-dashed border-subtle rounded-xl p-4">
                        {assetList.length === 0
                            ? 'No media yet. Upload an image or video file, or drag one here.'
                            : 'No assets match your search.'}
                    </div>
                )}
            </div>

            {assetToDelete && (
                <ModalShell
                    onClose={() => setAssetToDelete(null)}
                    surfaceProps={{
                        className: 'w-full max-w-sm rounded-xl bg-surface border border-subtle p-5 shadow-2xl flex flex-col gap-4',
                    }}
                >
                    <div className="space-y-1.5">
                        <h3 className="text-sm font-semibold text-foreground">Delete from library</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {(() => {
                                const usage = getAssetUsageCount(assetToDelete.id);
                                return usage > 0
                                    ? `"${assetToDelete.name}" is used by ${usage} ${
                                          usage === 1 ? 'layer' : 'layers'
                                      } in this project. Deleting removes ${
                                          usage === 1 ? 'that layer' : 'those layers'
                                      } and the file itself. This cannot be undone.`
                                    : `"${assetToDelete.name}" will be permanently deleted from your library. This cannot be undone.`;
                            })()}
                        </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setAssetToDelete(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                deleteAsset(assetToDelete.id);
                                setAssetToDelete(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                </ModalShell>
            )}
        </div>
    );
};

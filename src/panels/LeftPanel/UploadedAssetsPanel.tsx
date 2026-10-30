import React from 'react';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import type { Shot } from '../../model/types';

interface UploadedAssetsPanelProps {
    assetCategory: 'uploads';
    activeShot: Shot;
    onUploadClick: () => void;
}

export const UploadedAssetsPanel: React.FC<UploadedAssetsPanelProps> = ({
    assetCategory,
    activeShot,
    onUploadClick,
}) => {
    const { project, updateProject, addLayerToShot } = useProjectStore();
    const { selectLayer, setInspectorTab } = useSelectionStore();
    const assetList = Object.values(project.assets);

    return (
        <>                    {assetCategory === 'uploads' && (
                        <div className="flex-1 flex flex-col min-h-0 gap-2.5">
                            <button
                                onClick={onUploadClick}
                                className="w-full py-2 px-3 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-brand-blue/15"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Upload Media</span>
                            </button>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                                {assetList.map((asset) => (
                                    <div
                                        key={asset.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData(
                                                'application/x-raylight-asset-id',
                                                asset.id
                                            );
                                            e.dataTransfer.effectAllowed = 'copy';
                                        }}
                                        onClick={() => {
                                            const created = addLayerToShot(activeShot.id, 'image', {
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
                                            className="px-2 py-1 rounded-md bg-white/10 hover:bg-brand-blue text-muted-foreground hover:text-white text-[10px] font-medium transition cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 shadow-xs"
                                        >
                                            Set Bg
                                        </button>
                                    </div>
                                ))}
                                {assetList.length === 0 && (
                                    <div className="py-10 text-center text-xs text-disabled border border-dashed border-subtle rounded-xl p-4">
                                        No uploaded media yet.<br />Click Upload Media to add photos or videos.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

        </>
    );
};
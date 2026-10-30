import { MenuSurface, MenuItem } from '../../ui/Menu';
import { SoundEffectsPanel } from './SoundEffectsPanel';
import { UploadedAssetsPanel } from './UploadedAssetsPanel';
import { ShaderPresetsPanel } from './ShaderPresetsPanel';
import { FileTab } from './FileTab';
import { IconButton } from '../../ui/primitives';
import { SearchField } from '../../ui/SearchField';
import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, ChevronDown, Activity, PanelLeftClose, Download, FolderOpen, RotateCcw } from 'lucide-react';
import type { Shot } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { exportProjectToFile, importProjectFromFile, useStorageStatus } from '../../storage/projectIO';
import { createDefaultProject } from '../../model/defaults';

interface LeftPanelProps {
    activeShot: Shot;
    onUploadClick: () => void;
    audioLabel: string;
    onSelectAudioClick: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = React.memo(({
    activeShot,
    onUploadClick,
    audioLabel,
    onSelectAudioClick,
}) => {
    const {
        project,
        updateProject,
        addLayerToShot,
        addCameraBlockToShot,
        addShot,
    } = useProjectStore();

    const {
        timelineView,
        selectLayer,
        selectShot,
        selectCameraBlock,
        setInspectorTab,
        setTimelineView,
        toggleLeftPanel,
        leftPanelWidth,
    } = useSelectionStore();

    const [activeTab, setActiveTab] = useState<'file' | 'assets'>('file');
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [assetCategory, setAssetCategory] = useState<'uploads' | 'shaders' | 'sfx'>('uploads');
    const [selectedSfxCategory, setSelectedSfxCategory] = useState('All');
    const [soundSearchQuery, setSoundSearchQuery] = useState('');
    const [playingSfxId, setPlayingSfxId] = useState<string | null>(null);
    const activeAudioRef = useRef<HTMLAudioElement | null>(null);
    const projectFileInputRef = useRef<HTMLInputElement | null>(null);
    const storage = useStorageStatus();

    const handleImportProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        try {
            const result = await importProjectFromFile(file);
            if (result.success) {
                updateProject(() => result.data);
                setProjectMenuOpen(false);
            } else {
                alert(`Could not load project: ${result.errors[0] || 'Invalid file format'}`);
            }
        } catch (err) {
            alert(`Error reading project file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    useEffect(() => {
        return () => {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
        };
    }, []);

    const handleTogglePreviewSound = (id: string, src: string) => {
        if (playingSfxId === id) {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause();
                activeAudioRef.current = null;
            }
            setPlayingSfxId(null);
            return;
        }

        if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current = null;
        }

        const audio = new Audio(src);
        activeAudioRef.current = audio;
        setPlayingSfxId(id);
        audio.onended = () => {
            if (activeAudioRef.current === audio) {
                activeAudioRef.current = null;
                setPlayingSfxId(null);
            }
        };
        audio.onerror = () => {
            if (activeAudioRef.current === audio) {
                activeAudioRef.current = null;
                setPlayingSfxId(null);
            }
        };
        audio.play().catch(() => {
            setPlayingSfxId(null);
        });
    };

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    const dimensionRepairsInFlight = useRef(new Set<string>());

    // Repair dimensions for assets imported by older builds, which stored 0×0.
    useEffect(() => {
        Object.values(project.assets).forEach((asset) => {
            if ((asset.width > 0 && asset.height > 0) || !asset.dataUrl || dimensionRepairsInFlight.current.has(asset.id)) return;
            if (!asset.mimeType.startsWith('image/') && !asset.mimeType.startsWith('video/')) return;
            dimensionRepairsInFlight.current.add(asset.id);

            const saveDimensions = (width: number, height: number) => {
                if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
                updateProject((current) => {
                    const stored = current.assets[asset.id];
                    if (!stored || (stored.width > 0 && stored.height > 0)) return current;
                    return {
                        ...current,
                        assets: { ...current.assets, [asset.id]: { ...stored, width, height } },
                    };
                }, { skipHistory: true });
            };

            if (asset.mimeType.startsWith('video/')) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    saveDimensions(video.videoWidth, video.videoHeight);
                    video.src = '';
                };
                video.onerror = () => {
                    dimensionRepairsInFlight.current.delete(asset.id);
                    video.src = '';
                };
                video.src = asset.dataUrl;
            } else {
                const image = new Image();
                image.onload = () => saveDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height);
                image.onerror = () => {
                    dimensionRepairsInFlight.current.delete(asset.id);
                };
                image.src = asset.dataUrl;
            }
        });
    }, [project.assets, updateProject]);

    return (
        <aside
            id="raylight-left-panel"
            style={{ width: `var(--workspace-left-width, ${leftPanelWidth}px)` }}
            className="raylight-left-panel border-r border-subtle bg-app flex flex-col shrink-0 text-xs select-none h-full relative"
        >
            {/* 1. TOP HEADER: [R Canvas v] + [+] */}
            <div className="h-11 px-3 flex items-center justify-between shrink-0 relative">
                {/* Hidden Project JSON File Input */}
                <input
                    ref={projectFileInputRef}
                    type="file"
                    accept=".json,.raylight.json,application/json"
                    onChange={handleImportProjectFile}
                    className="hidden"
                    aria-hidden="true"
                />

                <button
                    onClick={() => setProjectMenuOpen((v) => !v)}
                    aria-expanded={projectMenuOpen}
                    aria-haspopup="menu"
                    title={`Project Menu • ${storage.message}`}
                    className="px-2.5 py-1 rounded-full bg-surface hover:bg-subtle border border-subtle flex items-center gap-1.5 text-[11px] font-semibold text-foreground cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
                >
                    <span className="font-bold tracking-tight text-sm leading-none">
                        R
                    </span>
                    <span>Canvas</span>
                    <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                            storage.status === 'saved'
                                ? 'bg-emerald-400'
                                : storage.status === 'saving'
                                ? 'bg-sky-400 animate-pulse'
                                : storage.status === 'warning'
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                        }`}
                        title={storage.message}
                    />
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>

                {projectMenuOpen && (
                    <MenuSurface className="absolute top-11 left-3 w-60 rounded-xl bg-surface border border-subtle shadow-2xl p-1 text-xs z-50">
                        <div className="px-2.5 py-1.5 border-b border-subtle mb-1">
                            <div className="font-semibold text-foreground truncate text-[11px]">{project.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    storage.status === 'saved'
                                        ? 'bg-emerald-400'
                                        : storage.status === 'saving'
                                        ? 'bg-sky-400 animate-pulse'
                                        : storage.status === 'warning'
                                        ? 'bg-amber-400'
                                        : 'bg-rose-400'
                                }`} />
                                <span className="truncate">{storage.message}</span>
                            </div>
                        </div>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                exportProjectToFile(project);
                                setProjectMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-muted-foreground hover:bg-subtle cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-brand-blue" />
                            <span>Export Project (.raylight.json)</span>
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                projectFileInputRef.current?.click();
                                setProjectMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-muted-foreground hover:bg-subtle cursor-pointer"
                        >
                            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                            <span>Import Project File...</span>
                        </MenuItem>
                        <div className="my-1 border-t border-subtle" />
                        <MenuItem
                            unstyled
                            onClick={() => {
                                setTimelineView(timelineView === 'video' ? 'scene' : 'video');
                                setProjectMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-muted-foreground hover:text-foreground hover:bg-subtle cursor-pointer"
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Switch to {timelineView === 'video' ? 'Scene (3D Layers)' : 'Video (Timeline Clips)'}</span>
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                if (window.confirm('Reset this project to a fresh blank canvas? Unsaved changes will be replaced.')) {
                                    updateProject(() => createDefaultProject());
                                    setProjectMenuOpen(false);
                                }
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>New Blank Project</span>
                        </MenuItem>
                    </MenuSurface>
                )}

                <div className="flex items-center gap-1">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Add blank shot, layer, or camera"
                        icon={<>
                            <Plus className="w-3.5 h-3.5" />
                        </>}
                        onClick={() => setAddMenuOpen((v) => !v)}
                        aria-expanded={addMenuOpen}
                        aria-haspopup="menu"
                        className="w-7 h-7 rounded-full bg-surface hover:bg-subtle border border-subtle flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
                        title="Add Blank Shot, Layer, or Camera"
                    />

                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Collapse Left Panel ( [ )"
                        icon={<>
                            <PanelLeftClose className="w-3.5 h-3.5" />
                        </>}
                        onClick={toggleLeftPanel}
                        className="w-7 h-7 rounded-full hover:bg-surface border border-transparent hover:border-subtle flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue"
                        title="Collapse Left Panel ( [ )"
                    />
                </div>

                {addMenuOpen && (
                    <MenuSurface
                        className="absolute top-11 right-3 w-48 rounded-xl bg-surface border border-subtle shadow-2xl p-1 text-xs z-50"
                    >
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const created = addShot();
                                selectShot(created.id);
                                setInspectorTab('shot');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-muted-foreground hover:bg-subtle cursor-pointer"
                        >
                            + Blank Shot (Scene)
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'image');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-muted-foreground hover:bg-subtle cursor-pointer"
                        >
                            + Image Layer
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'shape');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-muted-foreground hover:bg-subtle cursor-pointer"
                        >
                            + Rectangle Shape
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const l = addLayerToShot(activeShot.id, 'text');
                                selectLayer(l.id);
                                setInspectorTab('layer');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-muted-foreground hover:bg-subtle cursor-pointer"
                        >
                            + 3D Text Layer
                        </MenuItem>
                        <MenuItem
                            unstyled
                            onClick={() => {
                                const block = addCameraBlockToShot(activeShot.id);
                                if (!block) return;
                                selectCameraBlock(block.id);
                                setTimelineView('scene');
                                setAddMenuOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-emerald-400 hover:bg-white/5 cursor-pointer border-t border-white/10 mt-1 pt-1.5"
                        >
                            + Add Camera Move
                        </MenuItem>
                    </MenuSurface>
                )}
            </div>

            {/* 2. SUB-HEADER: Clean [File] | [Assets] + Search Icon */}
            <div className="h-9 border-y border-white/[0.07] px-3 flex items-center justify-between shrink-0" role="tablist" aria-label="Left panel views">
                <div className="flex items-center gap-1.5">
                    <button
                        role="tab"
                        id="left-panel-tab-file"
                        aria-controls="left-panel-panel-file"
                        aria-selected={activeTab === 'file'}
                        tabIndex={activeTab === 'file' ? 0 : -1}
                        onClick={() => setActiveTab('file')}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setActiveTab('assets');
                                document.getElementById('left-panel-tab-assets')?.focus();
                            }
                        }}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue ${activeTab === 'file'
                            ? 'bg-subtle text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        File
                    </button>
                    <button
                        role="tab"
                        id="left-panel-tab-assets"
                        aria-controls="left-panel-panel-assets"
                        aria-selected={activeTab === 'assets'}
                        tabIndex={activeTab === 'assets' ? 0 : -1}
                        onClick={() => setActiveTab('assets')}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setActiveTab('file');
                                document.getElementById('left-panel-tab-file')?.focus();
                            }
                        }}
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue ${activeTab === 'assets'
                            ? 'bg-subtle text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Assets
                    </button>
                </div>

                <IconButton
                    unstyled
                    tooltip={false}
                    label="Search layers"
                    icon={<>
                        <Search className="w-3.5 h-3.5" />
                    </>}
                    onClick={() => {
                        setSearchOpen((v) => !v);
                        if (searchOpen) setSearchQuery('');
                    }}
                    className={`p-1 rounded hover:bg-white/5 cursor-pointer ${searchOpen ? 'text-brand-blue' : 'text-muted-foreground hover:text-foreground'
                    }`}
                />
            </div>

            {searchOpen && (
                <SearchField
                    containerClassName="px-3 py-1.5 border-b border-subtle bg-panel flex items-center gap-1.5"
                    iconClassName="w-3 h-3 text-muted-foreground"
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find layer..."
                    aria-label="Filter layers by name"
                    className="w-full bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                    onClear={() => setSearchQuery('')}
                    clearButtonClassName="text-muted-foreground hover:text-foreground cursor-pointer"
                ></SearchField>
            )}

            {/* =================================================================== */}
            {/* FILE TAB: UPPER TREE + LOWER SYNCHRONIZED TIMELINE TRACK RACK       */}
            {/* =================================================================== */}
            <FileTab activeTab={activeTab} activeShot={activeShot} searchQuery={searchQuery} />

            {/* =================================================================== */}
            {/* ASSETS TAB: UNIFIED STUDIO ASSET LIBRARY                            */}
            {/* =================================================================== */}
            {activeTab === 'assets' && (
                <div id="left-panel-panel-assets" role="tabpanel" aria-labelledby="left-panel-tab-assets" className="flex-1 flex flex-col min-h-0 p-3 gap-2.5">
                    {/* Subcategory Navigation Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar shrink-0 border-b border-white/[0.06]">
                        {([
                            { id: 'uploads', label: 'Uploads' },
                            { id: 'shaders', label: 'Shaders' },
                            { id: 'sfx', label: 'Sound FX' },
                        ] as const).map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setAssetCategory(cat.id)}
                                className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition cursor-pointer ${
                                    assetCategory === cat.id
                                        ? 'bg-brand-blue text-white shadow-xs'
                                        : 'bg-surface text-muted-foreground hover:text-foreground border border-subtle'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* SUBCATEGORY 1: UPLOADS */}
                    {assetCategory === 'uploads' && (
                        <UploadedAssetsPanel
                            assetCategory={assetCategory}
                            activeShot={activeShot}
                            onUploadClick={onUploadClick}
                        />
                    )}

                    {/* SUBCATEGORY 3: SHADERS */}
                    {assetCategory === 'shaders' && <ShaderPresetsPanel assetCategory={assetCategory} />}

                    {/* SUBCATEGORY 4: SOUND FX */}
                    {assetCategory === 'sfx' && (
                        <SoundEffectsPanel
                            assetCategory={assetCategory}
                            audioLabel={audioLabel}
                            onSelectAudioClick={onSelectAudioClick}
                            selectedSfxCategory={selectedSfxCategory}
                            onSelectedSfxCategoryChange={setSelectedSfxCategory}
                            soundSearchQuery={soundSearchQuery}
                            onSoundSearchQueryChange={setSoundSearchQuery}
                            playingSfxId={playingSfxId}
                            onTogglePreviewSound={handleTogglePreviewSound}
                        />
                    )}

                </div>
            )}

        </aside>
    );
});


import { IconButton } from '../../ui/primitives';
import { PanelRightClose, Sparkles } from 'lucide-react';
import React,{ useEffect,useRef,useState } from 'react';
import { DisplaySettingsMenu } from '../../ui/DisplaySettingsMenu';
import type {
AnimationBlockProperty,
CameraBlock,
Layer,
LightAnimationBlock,
Shot,
} from '../../model/types';
import { isBlankProjectState } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { InspectorModeTabs } from '../../ui/primitives';
import { CameraBlockSection } from './sections/CameraBlockSection';
import { AudioClipInspector } from './sections/AudioClipInspector';
import { LayerDesignInspector } from './sections/LayerDesignInspector';
import { LayerAnimateInspector, addLayerAnimation } from './sections/LayerAnimateInspector';
import { LightBlockInspector } from './sections/LightBlockInspector';
import { LightInspector } from './sections/LightInspector';
import { ProjectSettingsPanel } from './ProjectSettingsPanel';
import { ShotSettingsPanel } from './ShotSettingsPanel';

interface RightSidebarProps {
    activeShot?: Shot;
    selectedLayer: Layer | undefined;
    selectedLayerIds: string[];
    onSwapImageClick: () => void;
    onOpenExportModal: (initialScope?: 'entire' | 'shot') => void;
    onOpenShortcuts?: () => void;
    showSafeArea?: boolean;
    onToggleSafeArea?: () => void;
    leftPanelOpen?: boolean;
    timelineOpen?: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = React.memo(({
    activeShot,
    selectedLayer,
    selectedLayerIds,
    onSwapImageClick,
    onOpenExportModal,
    onOpenShortcuts,
    showSafeArea,
    onToggleSafeArea,
    leftPanelOpen,
    timelineOpen,
}) => {
    const {
        project,
        updateLayer,
    } = useProjectStore();
    const {
        selectedCameraBlockId,
        selectedLightBlockId,
        selectedLightId,
        selectedAudioClipId,
        selectLight,
        selectLightBlock,
        selectCameraBlock,
        selectAudioClip,
        clearLayerSelection,
        setInspectorTab,
        toggleRightSidebar,
        rightSidebarWidth,
        inspectorTab,
    } = useSelectionStore();

    const [mainTab, setMainTab] = useState<'design' | 'animate'>('design');
    const [customFonts, setCustomFonts] = useState<string[]>([]);
    const fontInputRef = useRef<HTMLInputElement>(null);

    const isSelectedLightValid = Boolean(
        selectedLightId && (
            selectedLightId === 'sun-key' ||
            selectedLightId === 'key' ||
            selectedLightId === 'sun' ||
            selectedLightId === 'room' ||
            activeShot?.light?.sources?.some((s) => s.id === selectedLightId)
        )
    );
    const effectiveInspectorTab = (selectedLightId && !isSelectedLightValid) ? 'project' : inspectorTab;

    useEffect(() => {
        if (selectedLightId && !isSelectedLightValid) {
            selectLight(null);
        }
    }, [selectedLightId, isSelectedLightValid, selectLight]);

    const isBlankState = isBlankProjectState(project);
    const effectiveMainTab = isBlankState ? 'design' : mainTab;

    const activeCameraBlock: CameraBlock | undefined =
        activeShot?.cameraBlocks?.find((cb) => cb.id === selectedCameraBlockId);

    const activeLightBlock: LightAnimationBlock | undefined =
        activeShot?.lightBlocks?.find((lb) => lb.id === selectedLightBlockId);

    const activeAudioClip =
        project.audio?.clips?.find((clip) => clip.id === selectedAudioClipId);

    const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLayer || selectedLayer.kind !== 'text' || !activeShot) return;
        const fontName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
        try {
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, buffer);
            const loaded = await fontFace.load();
            (document.fonts as unknown as Set<FontFace>).add(loaded);
            setCustomFonts((prev) =>
                prev.includes(fontName) ? prev : [...prev, fontName]
            );
            updateLayer(activeShot.id, selectedLayer.id, (l) =>
                l.kind === 'text' ? { ...l, font: { ...l.font, family: fontName } } : l
            );
        } catch (err) {
            console.error('Failed to load custom font:', err);
        }
    };

    const handleAddAnimationBlock = (property: AnimationBlockProperty) => {
        if (activeShot) {
            addLayerAnimation(activeShot, selectedLayerIds, property);
            setMainTab('animate');
        }
    };

    return (
        <aside
            id="raylight-inspector"
            style={{ width: `var(--workspace-right-width, ${rightSidebarWidth}px)` }}
            className="raylight-right-sidebar border-l border-subtle bg-app flex flex-col shrink-0 text-xs select-none h-full relative"
        >
            <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFontFileUpload}
                className="hidden"
            />

            {/* 1. TOP HEADER BAR */}
            <div className="h-11 px-3 flex items-center justify-between shrink-0 border-b border-subtle">
                <div className="flex items-center">
                    <IconButton
                        unstyled
                        tooltip={false}
                        label="Collapse Inspector sidebar ( ] )"
                        icon={<>
                            <PanelRightClose className="w-3.5 h-3.5" />
                        </>}
                        onClick={toggleRightSidebar}
                        title="Collapse Inspector sidebar ( ] )"
                        className="p-1.5 rounded-lg hover:bg-subtle text-muted-foreground/70 hover:text-foreground cursor-pointer transition"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <DisplaySettingsMenu
                        showSafeArea={showSafeArea}
                        onToggleSafeArea={onToggleSafeArea}
                        leftPanelOpen={leftPanelOpen}
                        rightSidebarOpen={true}
                        timelineOpen={timelineOpen}
                    />

                    <button
                        onClick={() => onOpenExportModal('entire')}
                        className="px-3.5 py-1.5 rounded-lg bg-brand-blue hover:bg-brand-blue-hover text-white font-medium text-[11px] cursor-pointer transition shadow-xs"
                    >
                        Export
                    </button>
                </div>
            </div>

            {/* =================================================================== */}
            {/* CAMERA BLOCK INSPECTOR (When Camera Move is Selected)               */}
            {/* =================================================================== */}
            {activeCameraBlock && activeShot ? (
                <CameraBlockSection
                    activeShotId={activeShot.id}
                    activeCameraBlock={activeCameraBlock}
                    onDone={() => selectCameraBlock(null)}
                />
            ) : activeLightBlock && activeShot ? (
                <LightBlockInspector
                    activeShotId={activeShot.id}
                    activeLightBlock={activeLightBlock}
                    onDone={() => selectLightBlock(null)}
                />
            ) : activeAudioClip ? (
                <AudioClipInspector
                    clip={activeAudioClip}
                    onDone={() => selectAudioClip(null)}
                />
            ) : selectedLayer && activeShot ? (
                <>
                    {/* 2. SUB-HEADER: Context navigation (Only when layer is selected) */}
                    <div className="h-10 border-b border-subtle px-3.5 flex items-center shrink-0 bg-app">
                        <InspectorModeTabs
                            mode={effectiveMainTab}
                            onChange={setMainTab}
                            ariaLabel="Object properties"
                            animateLabel={(selectedLayer as any)?.kind === 'audio' ? 'automate' : undefined}
                        />
                    </div>

                    {/* =============================================================== */}
                    {/* TAB 1: DESIGN (WHEN A LAYER IS SELECTED)                        */}
                    {/* =============================================================== */}
                    {effectiveMainTab === 'design' && selectedLayer && <LayerDesignInspector key={selectedLayer.id}
                        activeShot={activeShot} selectedLayer={selectedLayer} selectedLayerIds={selectedLayerIds}
                        onSwapImageClick={onSwapImageClick} customFonts={customFonts} onUploadFontClick={()=>fontInputRef.current?.click()}
                        onAddAnimationBlock={handleAddAnimationBlock}
                    />}

                    {/* =============================================================== */}
                    {/* TAB 2: ANIMATE (WHEN A LAYER IS SELECTED)                       */}
                    {/* =============================================================== */}
                    {effectiveMainTab === 'animate' && selectedLayer && <LayerAnimateInspector key={selectedLayerIds.join(',')}
                        activeShot={activeShot} selectedLayer={selectedLayer} selectedLayerIds={selectedLayerIds}
                    />}
                </>
            ) : selectedLightId && isSelectedLightValid && activeShot ? (
                <LightInspector
                    activeShot={activeShot}
                    selectedLightId={selectedLightId}
                    onClose={() => selectLight(null)}
                />
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {effectiveInspectorTab === 'shot' && activeShot ? (
                        <ShotSettingsPanel
                            activeShot={activeShot}
                            onOpenExportModal={onOpenExportModal}
                        />
                    ) : (
                        <ProjectSettingsPanel />
                    )}
                </div>
            )}

            {/* Persistent Inspector Footer: Ask Raylight & Help */}
            <div className="px-3.5 py-2.5 border-t border-subtle flex items-center justify-end gap-2 shrink-0 bg-app">
                <button
                    type="button"
                    onClick={onOpenShortcuts}
                    title="Ask Raylight AI Assistant & Shortcuts"
                    className="h-7 px-3 rounded-full bg-surface hover:bg-subtle border border-subtle text-foreground text-[11px] font-medium flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                    <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
                    <span>Ask Raylight</span>
                </button>
                <button
                    type="button"
                    onClick={onOpenShortcuts}
                    title="Help & Shortcuts (?)"
                    className="w-7 h-7 rounded-full bg-surface hover:bg-subtle border border-subtle text-muted-foreground hover:text-foreground flex items-center justify-center text-[11px] font-medium shadow-xs transition cursor-pointer"
                >
                    ?
                </button>
            </div>

        </aside>
    );
});

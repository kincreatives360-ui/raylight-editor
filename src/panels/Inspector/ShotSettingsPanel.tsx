import React, { useState } from 'react';
import type { Shot } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { InspectorRow, InspectorModeTabs, Switch } from '../../ui/primitives';
import { CameraBlockSection } from './sections/CameraBlockSection';
import { ProjectSettingsPanel } from './ProjectSettingsPanel';
import { SceneEffectsSection } from './sections/SceneEffectsSection';
interface ShotSettingsPanelProps {
    activeShot: Shot;
    onOpenExportModal?: () => void;
}

export const ShotSettingsPanel: React.FC<ShotSettingsPanelProps> = ({
    activeShot,
    onOpenExportModal,
}) => {
    const { project, updateShot, addCameraBlockToShot } = useProjectStore();
    const [shotTab, setShotTab] = useState<'design' | 'animate'>('design');

    const isUsingProjectBg = activeShot.useProjectBackground !== false;

    return (
        <div className="shot-settings-panel flex-1 min-h-0 overflow-y-auto select-none" data-testid="shot-settings-section">
            <div className="space-y-4">
                {/* Header: Design / Animate tabs matching mockup */}
                <InspectorModeTabs
                    mode={shotTab}
                    onChange={setShotTab}
                    ariaLabel="Shot settings"
                    fullWidth
                    className="shot-settings-tabs flex items-center gap-2 px-3 py-2 border-b border-subtle"
                />

                {/* Shot Title & Duration */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] text-muted-foreground block font-normal">Shot Name</label>
                        <span className="text-[11px] font-mono text-disabled">
                            {(activeShot.durationMs / 1000).toFixed(1)}s
                        </span>
                    </div>
                    <input
                        type="text"
                        value={activeShot.name || ''}
                        onChange={(e) => updateShot(activeShot.id, (s) => ({ ...s, name: e.target.value }))}
                        placeholder="Shot name"
                        className="w-full h-8 px-3 rounded-lg bg-surface border border-subtle text-[12px] text-foreground outline-none focus:border-brand-blue transition placeholder:text-disabled"
                    />
                </div>

                {shotTab === 'design' ? (
                    <>
                        {/* Background Section */}
                        <div className="space-y-2.5">
                            <h3 className="text-[12px] font-semibold text-foreground tracking-wide">Background</h3>

                            {/* Use project toggle switch */}
                            <div className="flex items-center justify-between py-2">
                                <span className="text-[11px] font-medium text-foreground">Use project</span>
                                <Switch
                                    ariaLabel="Use project background"
                                    checked={isUsingProjectBg}
                                    onChange={(next) => {
                                        updateShot(activeShot.id, (s) => ({
                                            ...s,
                                            useProjectBackground: next,
                                            background: s.background ?? structuredClone(project.background),
                                        }));
                                    }}
                                />
                            </div>

                            {/* Inherited or override */}
                            {isUsingProjectBg ? (
                                <div className="sr-only">
                                    <span>Inheriting project background</span>
                                    <span
                                        className="w-2.5 h-2.5 rounded-full border border-subtle"
                                        style={{
                                            backgroundColor:
                                                project.background.kind === 'solid'
                                                    ? project.background.color
                                                    : '#0088ff',
                                        }}
                                    />
                                </div>
                            ) : (
                                <ProjectSettingsPanel
                                    backgroundOnly
                                    background={activeShot.background ?? project.background}
                                    onBackgroundChange={(background) => updateShot(activeShot.id, (shot) => ({ ...shot, background, useProjectBackground: false }))}
                                />
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-subtle" />

                        {/* Scene Effects in Figma Style (+) and (-) */}
                        <SceneEffectsSection shot={activeShot} />

                        {/* Divider */}
                        <div className="border-t border-subtle" />

                        {/* Export Section */}
                        <InspectorRow
                            unstyled
                            className="space-y-2"
                            labelTag="span"
                            labelClassName="text-[11px] text-muted-foreground block font-normal"
                            label={<>Export</>}
                        >
                            {onOpenExportModal && (
                                <button
                                    type="button"
                                    onClick={onOpenExportModal}
                                    className="w-full py-2 px-3 rounded-xl bg-muted hover:bg-subtle border border-subtle text-foreground font-medium text-[12px] transition cursor-pointer text-center"
                                >
                                    Export shot
                                </button>
                            )}
                        </InspectorRow>


                    </>
                ) : (
                    /* Animate Tab for Shot: Camera Animation / Controls */
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[12px] font-semibold text-foreground tracking-wide">Camera Motion</h3>
                            <span className="text-[10px] text-disabled">
                                {activeShot.cameraBlocks?.length || 0} moves
                            </span>
                        </div>
                        {activeShot.cameraBlocks && activeShot.cameraBlocks.length > 0 ? (
                            <CameraBlockSection
                                activeShotId={activeShot.id}
                                activeCameraBlock={activeShot.cameraBlocks[0]}
                                onDone={() => {}}
                            />
                        ) : (
                            <div className="py-6 px-3 rounded-xl border border-dashed border-subtle bg-subtle/40 text-center space-y-2">
                                <span className="text-[11px] text-disabled block">No camera animation in this shot</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        addCameraBlockToShot(activeShot.id);
                                    }}
                                    className="py-1 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition cursor-pointer"
                                >
                                    + Add Camera Move
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


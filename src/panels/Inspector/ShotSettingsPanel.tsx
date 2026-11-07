import React, { useState } from 'react';
import type { Shot, ShotTransition } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { InspectorRow, InspectorModeTabs, Switch } from '../../ui/primitives';
import { FigmaSelect } from '../../ui/FigmaSelect';
import { ScrubInput } from '../../ui/ScrubInput';
import { CameraBlockSection } from './sections/CameraBlockSection';
import { ProjectSettingsPanel } from './ProjectSettingsPanel';
import { SceneEffectsSection } from './sections/SceneEffectsSection';
interface ShotSettingsPanelProps {
    activeShot: Shot;
    onOpenExportModal?: (initialScope?: 'entire' | 'shot') => void;
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
            <div className="space-y-5 px-3.5 py-3">
                {/* Header: Design / Animate tabs matching mockup */}
                <InspectorModeTabs
                    mode={shotTab}
                    onChange={setShotTab}
                    ariaLabel="Shot settings"
                    fullWidth
                    className="shot-settings-tabs flex items-center gap-2 -mx-3.5 -mt-3 px-3.5 py-2.5 border-b border-subtle mb-1"
                />

                {/* Shot Title */}
                <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground block font-medium uppercase tracking-[.04em]">Shot Name</label>
                    <input
                        type="text"
                        value={activeShot.name || ''}
                        onChange={(e) => updateShot(activeShot.id, (s) => ({ ...s, name: e.target.value }))}
                        placeholder="Shot name"
                        className="w-full h-8 px-3 rounded-lg bg-surface border border-subtle text-[12px] text-foreground outline-none focus:border-brand-blue transition placeholder:text-disabled"
                    />
                </div>

                {/* Shot Duration */}
                <InspectorRow
                    unstyled
                    className="space-y-1.5"
                    labelTag="label"
                    labelClassName="text-[11px] font-medium text-muted-foreground block uppercase tracking-[.04em]"
                    label={<>Duration</>}
                >
                    <ScrubInput
                        label={<span className="text-disabled font-medium mr-1.5">Dur</span>}
                        value={Number((activeShot.durationMs / 1000).toFixed(2))}
                        min={0.5}
                        max={60}
                        step={0.1}
                        unit=" s"
                        onChange={(val) => {
                            const newDurationMs = Math.round(Math.max(500, Math.min(60000, val * 1000)));
                            updateShot(activeShot.id, (s) => ({
                                ...s,
                                durationMs: newDurationMs,
                                ...(s.transition && s.transition.durationMs > newDurationMs
                                    ? {
                                          transition: {
                                              ...s.transition,
                                              durationMs: newDurationMs,
                                          },
                                      }
                                    : {}),
                            }));
                        }}
                        className="h-8 px-3 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[12px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                    />
                </InspectorRow>

                {shotTab === 'design' ? (
                    <>
                        {/* Shot Transition */}
                        <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[.04em]">Transition</h3>
                            <div className="relative">
                                <FigmaSelect
                                    value={activeShot.transition?.type ?? 'cut'}
                                    onChange={(e) => {
                                        const type = e.target.value as ShotTransition['type'];
                                        updateShot(activeShot.id, (s) => ({
                                            ...s,
                                            transition: {
                                                type,
                                                durationMs: type === 'cut' ? 0 : s.transition?.durationMs || 500,
                                                easing: s.transition?.easing ?? { kind: 'preset', name: 'linear' },
                                            },
                                        }));
                                    }}
                                    className="w-full h-8 px-3 pr-8 rounded-lg bg-surface border border-subtle text-[12px] text-foreground outline-none appearance-none cursor-pointer focus:border-brand-blue transition"
                                >
                                    <option value="cut">Cut (Instant)</option>
                                    <option value="crossfade">Crossfade</option>
                                    <option value="push">Push</option>
                                    <option value="slide">Slide</option>
                                </FigmaSelect>
                            </div>

                            {activeShot.transition?.type && activeShot.transition.type !== 'cut' && (
                                <InspectorRow
                                    unstyled
                                    className="space-y-1.5"
                                    labelTag="label"
                                    labelClassName="text-[11px] font-medium text-muted-foreground block"
                                    label={<>Transition Duration</>}
                                >
                                    <ScrubInput
                                        label={<span className="text-disabled font-medium mr-1.5">T</span>}
                                        value={Number(((activeShot.transition.durationMs || 500) / 1000).toFixed(2))}
                                        min={0.1}
                                        max={Math.min(5, Number((activeShot.durationMs / 1000).toFixed(2)))}
                                        step={0.05}
                                        unit=" s"
                                        onChange={(val) => {
                                            const durationMs = Math.round(Math.max(100, Math.min(activeShot.durationMs, val * 1000)));
                                            updateShot(activeShot.id, (s) => ({
                                                ...s,
                                                transition: {
                                                    ...s.transition,
                                                    durationMs,
                                                },
                                            }));
                                        }}
                                        className="h-8 px-3 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[12px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                    />
                                </InspectorRow>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-subtle" />

                        {/* Background Section */}
                        <div className="space-y-2">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[.04em]">Background</h3>

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
                                    onClick={() => onOpenExportModal('shot')}
                                    className="w-full py-2 px-3 rounded-xl bg-muted hover:bg-subtle border border-subtle text-foreground font-medium text-[12px] transition cursor-pointer text-center"
                                >
                                    Export shot
                                </button>
                            )}
                        </InspectorRow>


                    </>
                ) : (
                    /* Animate Tab for Shot: Camera Animation / Controls */
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[.04em]">Camera Motion</h3>
                            <span className="text-[11px] font-mono text-disabled">
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


import React from 'react';
import type { AspectRatio, Project } from '../../model/types';
import { InspectorRow } from '../../ui/primitives';
import { FigmaSelect } from '../../ui/FigmaSelect';
import { ScrubInput } from '../../ui/ScrubInput';

interface ProjectDetailsSectionProps {
    project: Project;
    updateProject: (updater: (project: Project) => Project) => void;
}

export const ProjectDetailsSection: React.FC<ProjectDetailsSectionProps> = ({ project, updateProject }) => (
    <>
        <h2 className="text-[13px] font-semibold text-foreground tracking-wide">Project Settings</h2>

        <InspectorRow
            unstyled
            className="space-y-1.5"
            labelTag="label"
            labelClassName="text-[11px] text-muted-foreground block font-normal"
            label={<>Name</>}
        >
            <input
                type="text"
                value={project.name}
                onChange={(e) => updateProject((p) => ({ ...p, name: e.target.value }))}
                placeholder="Untitled project"
                className="w-full h-8 px-3 rounded-lg bg-surface border border-subtle text-[12px] text-foreground outline-none focus:border-brand-blue transition placeholder:text-disabled"
            />
        </InspectorRow>

        <InspectorRow
            unstyled
            className="space-y-1.5"
            labelTag="label"
            labelClassName="text-[11px] text-muted-foreground block font-normal"
            label={<>Aspect Ratio</>}
        >
            <div className="relative">
                <FigmaSelect
                    value={project.aspectRatio}
                    onChange={(e) => updateProject((p) => ({ ...p, aspectRatio: e.target.value as AspectRatio }))}
                    className="w-full h-8 px-3 pr-8 rounded-lg bg-surface border border-subtle text-[12px] text-foreground outline-none appearance-none cursor-pointer focus:border-brand-blue transition"
                >
                    <option value="16:9">Landscape 16:9</option>
                    <option value="9:16">Portrait 9:16</option>
                    <option value="1:1">Square 1:1</option>
                    <option value="4:3">Standard 4:3</option>
                    <option value="3:2">Photo 3:2</option>
                    <option value="21:9">Cinema 21:9</option>
                    <option value="4:5">Social 4:5</option>
                </FigmaSelect>
            </div>
        </InspectorRow>

        <InspectorRow
            unstyled
            className="space-y-1.5"
            labelTag="label"
            labelClassName="text-[11px] text-muted-foreground block font-normal"
            label={<>Lens</>}
        >
            <ScrubInput
                label={<span className="text-disabled font-medium mr-1.5">F</span>}
                value={project.defaultCamera?.focalLength ?? 50}
                min={14}
                max={200}
                step={1}
                unit=" mm"
                onChange={(val) => {
                    updateProject((p) => ({
                        ...p,
                        defaultCamera: {
                            position: p.defaultCamera?.position ?? { x: 0, y: 0, z: 2.65 },
                            rotation: p.defaultCamera?.rotation ?? { x: 0, y: 0, z: 0 },
                            focalLength: Math.max(14, Math.min(200, val)),
                        },
                    }));
                }}
                className="h-8 px-3 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[12px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
            />
        </InspectorRow>
    </>
);

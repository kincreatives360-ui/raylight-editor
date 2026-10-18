import { ColorField, ColorPicker } from '../ColorPicker';
import { saveImageAsset } from '../imageAssetHelper';
// src/panels/Inspector/sections/BackgroundSection.tsx
import React, { useRef, useState } from 'react';
import { Palette, Image as ImageIcon } from 'lucide-react';
import type { Background, Shot } from '../../../model/types';
import { resolveShotBackground } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';

interface BackgroundSectionProps {
    activeShot: Shot;
}

type BgUiKind = 'color' | 'image' | 'shader';

function bgToUiKind(bg: Background): BgUiKind {
    if (bg.kind === 'image') return 'image';
    if (bg.kind === 'gradient') return 'shader';
    return 'color';
}

function solidColorOf(bg: Background): string {
    if (bg.kind === 'solid') return bg.color;
    if (bg.kind === 'gradient') return bg.stops[0]?.color ?? '#0a0a0c';
    return '#0a0a0c';
}

export const BackgroundSection: React.FC<BackgroundSectionProps> = ({
    activeShot,
}) => {
    const { project, updateProject, updateShot } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const useProject = activeShot.useProjectBackground !== false;
    const effectiveBg = resolveShotBackground(project, activeShot);
    const uiKind = bgToUiKind(effectiveBg);
    const currentColor = solidColorOf(effectiveBg);
    const [colorDraft, setColorDraft] = useState(currentColor);
    const [previousColor, setPreviousColor] = useState(currentColor);
    if (currentColor !== previousColor) {
        setPreviousColor(currentColor);
        setColorDraft(currentColor);
    }

    /** Write background either to project (when Use project) or to the shot override. */
    const setBackground = (next: Background) => {
        if (useProject) {
            updateProject((p) => ({ ...p, background: next }));
        } else {
            updateShot(activeShot.id, (s) => ({
                ...s,
                useProjectBackground: false,
                background: next,
            }));
        }
    };

    const handleToggleUseProject = (enabled: boolean) => {
        if (enabled) {
            // Inherit project; clear local override so it stays in sync
            updateShot(activeShot.id, (s) => ({
                ...s,
                useProjectBackground: true,
                background: undefined,
            }));
        } else {
            // Snapshot current project bg into the shot so the user can edit independently
            updateShot(activeShot.id, (s) => ({
                ...s,
                useProjectBackground: false,
                background: s.background ?? { ...project.background },
            }));
        }
    };

    const handleSetColor = (color: string) => {
        setBackground({ kind: 'solid', color });
    };

    const handleSetKind = (kind: BgUiKind) => {
        if (kind === 'color') {
            setBackground({ kind: 'solid', color: currentColor });
        } else if (kind === 'shader') {
            if (effectiveBg.kind === 'gradient') {
                setBackground(effectiveBg);
            } else {
                setBackground({
                    kind: 'gradient',
                    angle: 135,
                    stops: [
                        { at: 0, color: currentColor },
                        { at: 1, color: '#000000' },
                    ],
                });
            }
        } else {
            // image — keep existing assetId if already image, else empty
            const assetId =
                effectiveBg.kind === 'image' ? effectiveBg.assetId : '';
            setBackground({ kind: 'image', assetId });
        }
    };

    const handlePickImage = (file: File | null) => {
        if (!file) return;
        saveImageAsset({
            file,
            assetId: `bg-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            updateProject,
            onSave: (assetId) => setBackground({ kind: 'image', assetId }),
        });
    };

    const assetPreview =
        effectiveBg.kind === 'image' && effectiveBg.assetId
            ? project.assets[effectiveBg.assetId]?.dataUrl ??
            project.assets[effectiveBg.assetId]?.thumbUrl
            : undefined;

    return (
        <div className="p-3.5 space-y-3">
            {/* Header + Use project toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] font-medium text-[#e4e4e7]">
                        Background
                    </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-[10px] text-[#a1a1aa]">Use project</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={useProject}
                        aria-label="Use project background"
                        onClick={() => handleToggleUseProject(!useProject)}
                        className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${useProject ? 'bg-[#0088ff]' : 'bg-[#3f3f46]'
                            }`}
                        style={{ height: 18, width: 32 }}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${useProject ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                            style={{ width: 14, height: 14 }}
                        />
                    </button>
                </label>
            </div>

            {/* Type: Color | Image | Shader */}
            <div className="space-y-1.5">
                <span className="text-[10px] text-[#a1a1aa]">Type</span>
                <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                    {(['color', 'image', 'shader'] as BgUiKind[]).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => handleSetKind(k)}
                            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium capitalize transition cursor-pointer ${uiKind === k
                                ? 'bg-[#2a2a2e] text-white shadow-sm'
                                : 'text-[#a1a1aa] hover:text-white'
                                }`}
                        >
                            {k === 'color' ? 'Color' : k === 'image' ? 'Image' : 'Shader'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Color controls: use the shared Raylight popover everywhere. */}
            {uiKind === 'color' && (
                <div className="space-y-2">
                    <ColorPicker
                        color={currentColor}
                        label="Background color"
                        onChange={handleSetColor}
                        showGradientMode={false}
                    />
                    <div className="flex items-center h-7 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/[0.06] gap-1.5">
                        <span className="text-[10px] text-[#a1a1aa] font-medium">HEX</span>
                        <input
                            type="text"
                            aria-label="Background color HEX"
                            value={colorDraft}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setColorDraft(raw);
                                let value = raw.trim();
                                if (!value.startsWith('#')) value = `#${value}`;
                                if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
                                    handleSetColor(value.toLowerCase());
                                }
                            }}
                            onBlur={() => {
                                let value = colorDraft.trim();
                                if (!value.startsWith('#')) value = `#${value}`;
                                if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
                                    handleSetColor(value.toLowerCase());
                                    setColorDraft(value.toLowerCase());
                                } else {
                                    setColorDraft(currentColor);
                                }
                            }}
                            className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-white outline-none"
                            spellCheck={false}
                        />
                    </div>
                </div>
            )}

            {/* Image controls */}
            {uiKind === 'image' && (
                <div className="space-y-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
                    />
                    {assetPreview ? (
                        <div className="relative rounded-lg overflow-hidden border border-white/10 aspect-video bg-black/40">
                            <img
                                src={assetPreview}
                                alt="Background"
                                className="w-full h-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 text-[10px] text-white hover:bg-black/90 cursor-pointer"
                            >
                                Replace
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-20 rounded-lg border border-dashed border-white/15 bg-[#1c1c1f] hover:border-[#0088ff]/50 hover:bg-[#1c1c1f]/80 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                            <ImageIcon className="w-5 h-5 text-[#a1a1aa]" />
                            <span className="text-[10px] text-[#a1a1aa]">Upload background image</span>
                        </button>
                    )}
                </div>
            )}

            {/* Shader (gradient) controls */}
            {uiKind === 'shader' && effectiveBg.kind === 'gradient' && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                            <ColorField
                                aria-label="Gradient start color"
                                value={effectiveBg.stops[0]?.color || '#0a0a0c'}
                                onChange={(e) => {
                                    const col = e.target.value;
                                    const stops = [...effectiveBg.stops];
                                    stops[0] = { ...stops[0], at: stops[0]?.at ?? 0, color: col };
                                    setBackground({ ...effectiveBg, stops });
                                }}
                                className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] text-[#a1a1aa]">Start</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <ColorField
                                aria-label="Gradient end color"
                                value={effectiveBg.stops[1]?.color || '#000000'}
                                onChange={(e) => {
                                    const col = e.target.value;
                                    const stops = [...effectiveBg.stops];
                                    stops[1] = { ...stops[1], at: stops[1]?.at ?? 1, color: col };
                                    setBackground({ ...effectiveBg, stops });
                                }}
                                className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] text-[#a1a1aa]">End</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#a1a1aa]">
                            <span>Angle</span>
                            <span className="font-mono text-white/80">{effectiveBg.angle}°</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={effectiveBg.angle}
                            onChange={(e) =>
                                setBackground({
                                    ...effectiveBg,
                                    angle: Number(e.target.value),
                                })
                            }
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[#1c1c1f] accent-[#0088ff]"
                        />
                    </div>
                    {/* Preview strip */}
                    <div
                        className="h-6 rounded-md border border-white/10"
                        style={{
                            background: `linear-gradient(${effectiveBg.angle}deg, ${effectiveBg.stops
                                .map((s) => `${s.color} ${s.at * 100}%`)
                                .join(', ')})`,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// src/panels/Inspector/sections/BackgroundSection.tsx
import React, { useRef } from 'react';
import { Palette, Image as ImageIcon } from 'lucide-react';
import type { Background, Shot } from '../../../model/types';
import { RAYLIGHT_COLOR_PALETTE, resolveShotBackground } from '../../../model/types';
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
            setBackground({
                kind: 'gradient',
                angle: 135,
                stops: [
                    { at: 0, color: currentColor },
                    { at: 1, color: '#000000' },
                ],
            });
        } else {
            // image — keep existing assetId if already image, else empty
            const assetId =
                effectiveBg.kind === 'image' ? effectiveBg.assetId : '';
            setBackground({ kind: 'image', assetId });
        }
    };

    const handlePickImage = async (file: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const assetId = `bg-asset-${Date.now()}`;
            // Store as project asset so Viewport / exporter can resolve it
            updateProject((p) => ({
                ...p,
                assets: {
                    ...p.assets,
                    [assetId]: {
                        id: assetId,
                        name: file.name,
                        mimeType: file.type || 'image/png',
                        dataUrl,
                        width: 0,
                        height: 0,
                    },
                },
            }));
            setBackground({ kind: 'image', assetId });
        };
        reader.readAsDataURL(file);
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
                    <span className="text-[10px] text-[#71717a]">Use project</span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={useProject}
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
                <span className="text-[10px] text-[#71717a]">Type</span>
                <div className="flex items-center gap-1 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]">
                    {(['color', 'image', 'shader'] as BgUiKind[]).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => handleSetKind(k)}
                            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium capitalize transition cursor-pointer ${uiKind === k
                                    ? 'bg-[#2a2a2e] text-white shadow-sm'
                                    : 'text-[#71717a] hover:text-white'
                                }`}
                        >
                            {k === 'color' ? 'Color' : k === 'image' ? 'Image' : 'Shader'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Color controls */}
            {uiKind === 'color' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="relative shrink-0">
                            <input
                                type="color"
                                value={currentColor}
                                onChange={(e) => handleSetColor(e.target.value)}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                title="Pick color"
                            />
                            <div
                                className="w-7 h-7 rounded-lg border border-white/10"
                                style={{ backgroundColor: currentColor }}
                            />
                        </div>
                        <div className="flex-1 flex items-center h-7 px-2.5 rounded-lg bg-[#1c1c1f] border border-white/[0.06] gap-1.5">
                            <span className="text-[10px] text-[#71717a] font-medium">HEX</span>
                            <input
                                type="text"
                                value={currentColor}
                                onChange={(e) => {
                                    let v = e.target.value.trim();
                                    if (!v.startsWith('#')) v = `#${v}`;
                                    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) handleSetColor(v);
                                    else handleSetColor(v); // allow typing
                                }}
                                onBlur={(e) => {
                                    let v = e.target.value.trim();
                                    if (!v.startsWith('#')) v = `#${v}`;
                                    if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
                                        handleSetColor(v);
                                    }
                                }}
                                className="flex-1 bg-transparent text-[11px] font-mono text-white outline-none"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* Raylight custom palette (matches raylight.app bottom swatches) */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                        {RAYLIGHT_COLOR_PALETTE.map((c) => (
                            <button
                                key={c}
                                type="button"
                                title={c}
                                onClick={() => handleSetColor(c)}
                                className={`w-5 h-5 rounded-full border transition cursor-pointer shrink-0 ${currentColor.toLowerCase() === c.toLowerCase()
                                        ? 'border-white scale-110 shadow-md ring-1 ring-white/40'
                                        : 'border-white/15 hover:border-white/40 hover:scale-105'
                                    }`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
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
                            <ImageIcon className="w-5 h-5 text-[#71717a]" />
                            <span className="text-[10px] text-[#71717a]">Upload background image</span>
                        </button>
                    )}
                </div>
            )}

            {/* Shader (gradient) controls */}
            {uiKind === 'shader' && effectiveBg.kind === 'gradient' && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={effectiveBg.stops[0]?.color || '#0a0a0c'}
                                onChange={(e) => {
                                    const col = e.target.value;
                                    const stops = [...effectiveBg.stops];
                                    stops[0] = { ...stops[0], at: stops[0]?.at ?? 0, color: col };
                                    setBackground({ ...effectiveBg, stops });
                                }}
                                className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] text-[#71717a]">Start</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={effectiveBg.stops[1]?.color || '#000000'}
                                onChange={(e) => {
                                    const col = e.target.value;
                                    const stops = [...effectiveBg.stops];
                                    stops[1] = { ...stops[1], at: stops[1]?.at ?? 1, color: col };
                                    setBackground({ ...effectiveBg, stops });
                                }}
                                className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                            <span className="text-[10px] text-[#71717a]">End</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#71717a]">
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

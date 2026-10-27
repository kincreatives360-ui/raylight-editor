import { FigmaSelect } from '../../../ui/FigmaSelect';
// src/panels/Inspector/sections/TypographySection.tsx
import React from 'react';
import { Type, Upload } from 'lucide-react';
import type { TextLayer } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { ColorField } from '../ColorPicker';
import { ScrubInput } from '../../../ui/ScrubInput';
import { POPULAR_FONT_NAMES as POPULAR_FONTS, loadGoogleFont } from '../../../engine/fontLoader';

interface TypographySectionProps {
    activeShotId: string;
    layer: TextLayer;
    customFonts: string[];
    onUploadFontClick: () => void;
}

export const TypographySection: React.FC<TypographySectionProps> = ({
    activeShotId,
    layer,
    customFonts,
    onUploadFontClick,
}) => {
    const { updateLayer } = useProjectStore();

    const refStageH = 1080;

    return (
        <div className="p-3.5 space-y-3">
            <div className="text-[11px] font-medium text-[#e4e4e7] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-amber-400" />
                    Typography
                </span>
                <button
                    type="button"
                    onClick={onUploadFontClick}
                    title="Upload Custom Font (.ttf, .otf, .woff2)"
                    aria-label="Upload custom font"
                    className="text-[10px] text-[#0088ff] hover:underline flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0088ff]"
                >
                    <Upload className="w-3 h-3" />
                    <span>Upload font</span>
                </button>
            </div>

            {/* Content textarea */}
            <div className="space-y-1">
                <span className="text-[10px] text-[#a1a1aa]">Text Content</span>
                <textarea
                    rows={2}
                    value={layer.content}
                    onChange={(e) =>
                        updateLayer(activeShotId, layer.id, (l) =>
                            l.kind === 'text' ? { ...l, content: e.target.value } : l
                        )
                    }
                    className="w-full p-2 rounded-lg bg-[#1c1c1f] border border-white/10 text-[11px] text-white outline-none focus:border-amber-400 resize-none font-sans"
                    aria-label="Text content"
                />
            </div>

            {/* Font Family */}
            <div className="space-y-1">
                <span className="text-[10px] text-[#a1a1aa]">Font Family</span>
                <FigmaSelect
                    value={layer.font.family}
                    onChange={(e) => {
                        const nextFont = e.target.value;
                        loadGoogleFont(nextFont);
                        updateLayer(activeShotId, layer.id, (l) =>
                            l.kind === 'text'
                                ? { ...l, font: { ...l.font, family: nextFont } }
                                : l
                        );
                    }}
                    aria-label="Font family"
                    className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white outline-none cursor-pointer"
                >
                    {[...POPULAR_FONTS, ...customFonts].map((f) => (
                        <option key={f} value={f}>
                            {f}
                        </option>
                    ))}
                </FigmaSelect>
            </div>

            {/* Color & Size */}
            <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-1">
                    <span className="text-[10px] text-[#a1a1aa]">Color</span>
                    <div className="flex items-center gap-1.5 h-7 px-1.5 rounded-lg bg-[#1c1c1f] border border-white/10">
                        <ColorField
                            aria-label="Text color"
                            value={layer.font.color}
                            onChange={(e) =>
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'text'
                                        ? { ...l, font: { ...l.font, color: e.target.value } }
                                        : l
                                )
                            }
                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                            type="text"
                            aria-label="Text color hex"
                            value={layer.font.color}
                            onChange={(e) => {
                                let color = e.target.value.trim();
                                if (!color.startsWith('#')) color = `#${color}`;
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'text'
                                        ? { ...l, font: { ...l.font, color } }
                                        : l
                                );
                            }}
                            className="w-full bg-transparent text-[10px] font-mono text-white outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <span className="text-[10px] text-[#a1a1aa]">Size</span>
                    <ScrubInput
                        label="A"
                        value={Math.round(layer.font.size * refStageH)}
                        min={8}
                        max={300}
                        step={1}
                        unit="px"
                        onChange={(sizePx) =>
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'text'
                                    ? { ...l, font: { ...l.font, size: sizePx / refStageH } }
                                    : l
                            )
                        }
                    />
                </div>
            </div>

            {/* Weight & Letter Spacing */}
            <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-1">
                    <span className="text-[10px] text-[#a1a1aa]">Weight</span>
                    <FigmaSelect
                        value={layer.font.weight}
                        onChange={(e) => {
                            const weight = Number(e.target.value);
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'text'
                                    ? { ...l, font: { ...l.font, weight } }
                                    : l
                            );
                        }}
                        aria-label="Font weight"
                        className="w-full h-7 rounded-lg bg-[#1c1c1f] border border-white/10 px-2 text-[11px] text-white outline-none cursor-pointer"
                    >
                        <option value={300}>300 Light</option>
                        <option value={400}>400 Regular</option>
                        <option value={500}>500 Medium</option>
                        <option value={600}>600 SemiBold</option>
                        <option value={700}>700 Bold</option>
                        <option value={800}>800 ExtraBold</option>
                        <option value={900}>900 Black</option>
                    </FigmaSelect>
                </div>

                <div className="space-y-1">
                    <span className="text-[10px] text-[#a1a1aa]">Spacing</span>
                    <ScrubInput
                        label="↔"
                        value={layer.font.letterSpacing}
                        min={-5}
                        max={30}
                        step={0.5}
                        decimals={1}
                        onChange={(letterSpacing) =>
                            updateLayer(activeShotId, layer.id, (l) =>
                                l.kind === 'text'
                                    ? { ...l, font: { ...l.font, letterSpacing } }
                                    : l
                            )
                        }
                    />
                </div>
            </div>

            {/* Text Alignment */}
            <div className="space-y-1">
                <span className="text-[10px] text-[#a1a1aa]">Align</span>
                <div className="grid grid-cols-3 gap-0.5 bg-[#1c1c1f] p-0.5 rounded-lg border border-white/[0.06]" role="radiogroup" aria-label="Text alignment">
                    {(['left', 'center', 'right'] as const).map((al) => (
                        <button
                            key={al}
                            type="button"
                            role="radio"
                            aria-checked={layer.font.align === al}
                            aria-label={`Align ${al}`}
                            onClick={() =>
                                updateLayer(activeShotId, layer.id, (l) =>
                                    l.kind === 'text'
                                        ? { ...l, font: { ...l.font, align: al } }
                                        : l
                                )
                            }
                            className={`h-6 rounded text-[10px] capitalize flex items-center justify-center transition cursor-pointer ${layer.font.align === al
                                ? 'bg-[#2a2a30] text-white font-medium'
                                : 'text-[#a1a1aa] hover:text-white'
                                }`}
                        >
                            {al}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

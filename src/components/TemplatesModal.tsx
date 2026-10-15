// src/components/TemplatesModal.tsx
import React, { useState } from 'react';
import { X, Sparkles, Clock, Film, ArrowRight, PlusCircle } from 'lucide-react';
import { STARTER_TEMPLATES, type StarterTemplate } from '../model/starterTemplates';
import type { AspectRatio } from '../model/types';

interface TemplatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: StarterTemplate) => void;
    onSelectBlank: (aspectRatio: AspectRatio) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
    isOpen,
    onClose,
    onSelectTemplate,
    onSelectBlank,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedRatio, setSelectedRatio] = useState<string>('All');

    if (!isOpen) return null;

    const categories = ['All', 'SaaS & Web', 'Mobile & Social', 'Hardware & 3D', 'Brand & Typography'];
    const ratios = ['All', '16:9', '9:16', '21:9'];

    const filteredTemplates = STARTER_TEMPLATES.filter((tmpl) => {
        const matchesCategory = selectedCategory === 'All' || tmpl.category === selectedCategory;
        const matchesRatio = selectedRatio === 'All' || tmpl.aspectRatio === selectedRatio;
        return matchesCategory && matchesRatio;
    });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl max-h-[90vh] bg-[#0c0e17] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* MODAL HEADER */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-600/20 text-white">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-wide">
                                Starter Project Templates
                            </h2>
                            <p className="text-xs text-gray-400">
                                Pre-calibrated 3D scenes, mockups, and camera animation presets.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* FILTER CONTROLS */}
                <div className="px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/40 text-xs">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                                    selectedCategory === cat
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Aspect Ratio Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[11px]">Format:</span>
                        {ratios.map((r) => (
                            <button
                                key={r}
                                onClick={() => setSelectedRatio(r)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                                    selectedRatio === r
                                        ? 'bg-white/20 text-white font-semibold'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* TEMPLATES CARDS GRID */}
                <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Blank Project Starter Card */}
                    <div className="p-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/40 transition flex flex-col justify-between group">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400">
                                    Clean Slate
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                                    16:9 / 9:16
                                </span>
                            </div>
                            <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition flex items-center gap-1.5">
                                <PlusCircle className="w-4 h-4 text-sky-400" />
                                Blank Canvas Project
                            </h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Start completely from scratch with an empty scene. Ideal for dropping screenshots or pasting directly from Figma with ⌘V.
                            </p>
                        </div>

                        <div className="pt-4 flex items-center gap-2">
                            <button
                                onClick={() => onSelectBlank('16:9')}
                                className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition cursor-pointer"
                            >
                                Blank 16:9
                            </button>
                            <button
                                onClick={() => onSelectBlank('9:16')}
                                className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition cursor-pointer"
                            >
                                Blank 9:16
                            </button>
                        </div>
                    </div>

                    {/* Pre-calibrated Templates */}
                    {filteredTemplates.map((template) => (
                        <div
                            key={template.id}
                            className="p-4 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/60 hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 transition flex flex-col justify-between group"
                        >
                            <div className="space-y-2.5">
                                {/* Top Badges */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                                            {template.aspectRatio}
                                        </span>
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                            {template.badge}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                                        <span className="flex items-center gap-1">
                                            <Film className="w-3 h-3 text-gray-400" />
                                            {template.scenesCount} {template.scenesCount > 1 ? 'Scenes' : 'Scene'}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-gray-400" />
                                            {template.durationSec.toFixed(1)}s
                                        </span>
                                    </div>
                                </div>

                                {/* Title & Subtitle */}
                                <div>
                                    <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition">
                                        {template.title}
                                    </h3>
                                    <span className="text-[11px] text-gray-400 block font-medium">
                                        {template.subtitle}
                                    </span>
                                </div>

                                {/* Description */}
                                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                                    {template.description}
                                </p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {template.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[10px] text-gray-400"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Load Template Action Button */}
                            <div className="pt-4 border-t border-white/5 mt-3">
                                <button
                                    onClick={() => onSelectTemplate(template)}
                                    className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-sky-600/25 group-hover:bg-sky-500"
                                >
                                    <span>Use This Template</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* MODAL FOOTER */}
                <div className="p-3.5 border-t border-white/10 bg-black/50 flex items-center justify-between text-xs text-gray-400">
                    <span className="text-[11px]">
                        Need custom graphics? Paste vector frames with <kbd className="px-1 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px]">⌘V</kbd> at any time.
                    </span>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition cursor-pointer text-xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

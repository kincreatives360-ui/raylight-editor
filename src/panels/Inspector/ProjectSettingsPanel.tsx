import React, { useRef } from 'react';
import { mergeGradient } from '../../stage/gradientGeometry';
import { IconButton, InspectorRow, SegmentedControl } from '../../ui/primitives';
import { Trash2, Upload } from 'lucide-react';
import { DEFAULT_SHADER_CONFIGS, SHADER_PRESETS, SHADER_PRESET_METADATA, isPaletteShader, type ShaderPreset } from '../../model/backgroundPresets';
import type { Background } from '../../model/types';
import { RAYLIGHT_COLOR_PALETTE } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { FigmaSelect } from '../../ui/FigmaSelect';
import { ScrubInput } from '../../ui/ScrubInput';
import { ColorPicker } from './ColorPicker';
import { saveImageAsset } from './imageAssetHelper';
import { ShaderPreviewCanvas } from './ShaderPreviewCanvas';
import { ProjectDetailsSection } from './ProjectDetailsSection';
interface ProjectSettingsPanelProps {
    backgroundOnly?: boolean;
    background?: Background;
    onBackgroundChange?: (background: Background) => void;
    onSwapImageClick?: () => void;
    onOpenShortcuts?: () => void;
    onOpenExportModal?: () => void;
}

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
    backgroundOnly = false,
    background,
    onBackgroundChange,
    onSwapImageClick: _onSwapImageClick,
    onOpenShortcuts: _onOpenShortcuts,
    onOpenExportModal: _onOpenExportModal,
}) => {
    const { project, updateProject } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const bg = background ?? project.background;
    const bgMode: 'color' | 'image' | 'shader' =
        bg.kind === 'shader' ? 'shader' : bg.kind === 'image' ? 'image' : 'color';

    // Synchronize project background changes to all shots that inherit project background
    const setProjectBackground = (newBg: Background) => {
        if (onBackgroundChange) { onBackgroundChange(newBg); return; }
        updateProject((p) => ({
            ...p,
            background: newBg,
        }));
    };

    const handleModeChange = (mode: 'color' | 'image' | 'shader') => {
        if (mode === bgMode) return;
        if (mode === 'shader') {
            const currentPreset: ShaderPreset = bg.kind === 'shader' ? bg.preset : 'silkFlow';
            const cfg = DEFAULT_SHADER_CONFIGS[currentPreset] || DEFAULT_SHADER_CONFIGS.silkFlow;
            let c1 = cfg.colors?.[0] || cfg.color || '#4f46e5';
            let c2 = cfg.colors?.[1] || cfg.backgroundColor || '#ec4899';
            let c3 = cfg.colors?.[2] || '#06b6d4';

            if (bg.kind === 'solid') {
                c1 = bg.color;
            } else if (bg.kind === 'gradient' && bg.stops.length >= 2) {
                c1 = bg.stops[0].color;
                c2 = bg.stops[1].color;
                if (bg.stops[2]) c3 = bg.stops[2].color;
            }

            setProjectBackground({
                kind: 'shader',
                preset: currentPreset,
                color: c1,
                colors: [c1, c2, c3],
                color1: c1,
                color2: c2,
                color3: c3,
                backgroundColor: c2,
                speed: cfg.speed ?? 0.8,
                waves: cfg.waves ?? 1.2,
                noiseScale: cfg.waves ?? 1.2,
                focus: cfg.focus ?? 1,
                glow: cfg.glow ?? 0.85,
                shine: cfg.shine ?? 0.6,
                angle: cfg.angle ?? 28,
            });
        } else if (mode === 'image') {
            const prevImageBg = bg.kind === 'image' ? bg : undefined;
            const existingAsset = Object.values(project.assets || {}).find((a) => a.mimeType?.startsWith('image/'));
            const letterboxColor = prevImageBg?.color || (bg.kind === 'shader' ? (bg.backgroundColor || '#000000') : '#000000');
            setProjectBackground({
                kind: 'image',
                src: prevImageBg?.src || existingAsset?.dataUrl,
                assetId: prevImageBg?.assetId || existingAsset?.id,
                color: letterboxColor,
                fit: prevImageBg?.fit || 'cover',
                opacity: prevImageBg?.opacity ?? 1,
                dim: prevImageBg?.dim ?? 0,
                blur: prevImageBg?.blur ?? 0,
            });
        } else {
            // mode === 'color' - Default to solid color, never reset existing color or force gradient
            if (bg.kind === 'solid' || bg.kind === 'gradient') return;
            let baseColor = '#0c0e17';
            if (bg.kind === 'shader') {
                baseColor = bg.color1 || bg.colors?.[0] || bg.color || '#0c0e17';
            } else if (bg.kind === 'image' && bg.color) {
                baseColor = bg.color;
            }
            setProjectBackground({
                kind: 'solid',
                color: baseColor,
            });
        }
    };

    const shaderBg = bg.kind === 'shader' ? bg : null;
    const currentPreset = shaderBg?.preset || 'silkFlow';
    const currentMeta = SHADER_PRESET_METADATA[currentPreset];
    const isPalette = isPaletteShader(currentPreset);

    const shaderColor1 = shaderBg?.color1 || shaderBg?.colors?.[0] || shaderBg?.color || '#4f46e5';
    const shaderColor2 = shaderBg?.color2 || shaderBg?.colors?.[1] || shaderBg?.backgroundColor || '#ec4899';
    const shaderColor3 = shaderBg?.color3 || shaderBg?.colors?.[2] || '#06b6d4';

    const updateShaderKnob = (
        knob: 'speed' | 'waves' | 'noiseScale' | 'focus' | 'glow' | 'shine',
        val: number
    ) => {
        if (!shaderBg) return;
        setProjectBackground({
            ...shaderBg,
            [knob]: val,
            ...(knob === 'waves' ? { noiseScale: val } : {}),
        });
    };

    const updateShaderColors = (c1?: string, c2?: string, c3?: string) => {
        if (!shaderBg) return;
        const col1 = c1 ?? shaderColor1;
        const col2 = c2 ?? shaderColor2;
        const col3 = c3 ?? shaderColor3;
        setProjectBackground({
            ...shaderBg,
            color: col1,
            backgroundColor: col2,
            color1: col1,
            color2: col2,
            color3: col3,
            colors: [col1, col2, col3],
        });
    };

    const selectShaderPreset = (p: ShaderPreset) => {
        const cfg = DEFAULT_SHADER_CONFIGS[p] || DEFAULT_SHADER_CONFIGS.silk;
        const pColors = cfg.colors?.length ? [...cfg.colors] : [cfg.color, cfg.backgroundColor || '#05050a'];
        const c1 = pColors[0] || cfg.color || '#4f46e5';
        const c2 = pColors[1] || cfg.backgroundColor || '#ec4899';
        const c3 = pColors[2] || (pColors.length > 2 ? pColors[2] : '#06b6d4');

        setProjectBackground({
            kind: 'shader',
            preset: p,
            color: cfg.color || c1,
            backgroundColor: cfg.backgroundColor || c2,
            color1: c1,
            color2: c2,
            color3: c3,
            colors: pColors,
            speed: cfg.speed ?? 1,
            waves: cfg.waves ?? 1,
            noiseScale: cfg.waves ?? 1,
            focus: cfg.focus ?? 1,
            glow: cfg.glow ?? 1,
            shine: cfg.shine ?? 1,
            angle: cfg.angle ?? 28,
        });
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        saveImageAsset({
            file,
            updateProject,
            onSave: (assetId, dataUrl) => {
                setProjectBackground({
                    kind: 'image',
                    assetId,
                    src: dataUrl,
                    color: bg.kind === 'image' ? bg.color || '#000000' : '#000000',
                    fit: bg.kind === 'image' ? bg.fit || 'cover' : 'cover',
                    dim: bg.kind === 'image' ? bg.dim ?? 0 : 0,
                    blur: bg.kind === 'image' ? bg.blur ?? 0 : 0,
                    opacity: 1,
                });
            },
        });
        if (e.target) e.target.value = '';
    };

    return (
        <div className={backgroundOnly ? "min-w-0" : "flex-1 overflow-y-auto px-4 py-3.5 flex flex-col select-none"} data-testid={backgroundOnly ? "shot-background-editor" : "project-settings-section"}>
            <div className="space-y-4">
                {!backgroundOnly && <>
                <ProjectDetailsSection project={project} updateProject={updateProject} />
                </>}
                {/* Background Section */}
                <div className="space-y-2.5">
                    {!backgroundOnly && <label className="text-[11px] text-muted-foreground block font-normal">Background</label>}
                    {/* 3-segmented button */}
                    <SegmentedControl
                        unstyled
                        ariaLabel="Background mode"
                        value={bgMode}
                        onChange={handleModeChange}
                        className="h-8 p-0.5 rounded-lg bg-subtle border border-subtle grid grid-cols-3 gap-0.5"
                        buttonClassName={(_, selected) => `rounded-md text-[11px] font-medium transition cursor-pointer flex items-center justify-center ${selected ? 'border border-subtle bg-muted text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                        options={[{ value: 'color', label: 'Color' }, { value: 'image', label: 'Image' }, { value: 'shader', label: 'Shader' }]}
                    />

                    {/* Mode == 'color' */}
                    {bgMode === 'color' && (
                        <div className="space-y-2.5 pt-0.5">
                            <label className="text-[11px] text-muted-foreground block font-normal">Color & Gradient</label>
                            <ColorPicker
                                color={bg.kind === 'solid' ? bg.color : (bg.kind === 'gradient' ? bg.stops[0]?.color || '#090a12' : '#000000')}
                                gradientValue={bg.kind === 'gradient' ? {
                                    angle: bg.angle || 135,
                                    gradientType: bg.gradientType || 'linear',
                                    stops: bg.stops,
                                } : undefined}
                                showGradientMode={true}
                                gradientTypes={['linear', 'radial', 'angular']}
                                onChange={(c) => {
                                    setProjectBackground({ kind: 'solid', color: c });
                                }}
                                onGradientChange={(g) => {
                                    setProjectBackground({
                                        ...mergeGradient(bg.kind === 'gradient' ? bg : undefined, g),
                                        angle: g.angle,
                                        gradientType: ['linear', 'radial', 'angular'].includes(g.gradientType ?? 'linear') ? g.gradientType as 'linear' | 'radial' | 'angular' : 'linear',
                                        stops: g.stops,
                                    });
                                }}
                                className="h-8 px-2.5 rounded-lg bg-surface border border-subtle hover:border-brand-blue flex items-center gap-2.5 text-[12px] text-foreground cursor-pointer transition"
                            />

                            {/* Quick swatches */}
                            <div className="flex items-center gap-1.5 pt-1">
                                {RAYLIGHT_COLOR_PALETTE.map((swatch) => (
                                    <button
                                        key={swatch}
                                        type="button"
                                        onClick={() => setProjectBackground({ kind: 'solid', color: swatch })}
                                        className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition cursor-pointer shrink-0"
                                        style={{ backgroundColor: swatch }}
                                        title={swatch}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mode == 'image' */}
                    {bgMode === 'image' && (
                        <div className="space-y-3 pt-0.5">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileInput}
                            />

                            {/* Image Header & Preview Card */}
                            <InspectorRow
                                unstyled
                                className="space-y-1.5"
                                labelTag="label"
                                labelClassName="text-[11px] text-muted-foreground block font-normal"
                                label={<>Image</>}
                            >
                                {bg.kind === 'image' && (bg.src || (bg.assetId && project.assets[bg.assetId]?.dataUrl)) ? (
                                    <div
                                        className="relative group rounded-xl overflow-hidden border border-subtle bg-subtle aspect-[16/9] max-h-36 cursor-pointer shadow-inner"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <img
                                            src={bg.src || (bg.assetId ? project.assets[bg.assetId]?.dataUrl : '')}
                                            alt="Background preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fileInputRef.current?.click();
                                                }}
                                                className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-[11px] font-medium text-white shadow-xs transition"
                                            >
                                                Replace
                                            </button>
                                            <IconButton
                                                unstyled
                                                tooltip={false}
                                                label="Remove image"
                                                icon={<>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </>}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setProjectBackground({
                                                        kind: 'image',
                                                        src: undefined,
                                                        assetId: undefined,
                                                        color: bg.color || '#000000',
                                                        fit: bg.fit || 'cover',
                                                        dim: bg.dim ?? 0,
                                                        blur: bg.blur ?? 0,
                                                        opacity: 1,
                                                    });
                                                }}
                                                className="p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition"
                                                title="Remove image"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-6 px-3 rounded-xl border border-dashed border-subtle hover:border-medium bg-subtle/50 hover:bg-subtle flex flex-col items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition group"
                                        >
                                            <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
                                            <span className="font-medium">Upload Image</span>
                                            <span className="text-[10px] text-disabled">PNG, JPG, WebP</span>
                                        </button>
                                        {Object.values(project.assets || {}).filter((a) => a.mimeType?.startsWith('image/')).length > 0 && (
                                            <div className="space-y-1.5 pt-1">
                                                <span className="text-[10px] text-disabled block">From Project Assets:</span>
                                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                                    {Object.values(project.assets || {})
                                                        .filter((a) => a.mimeType?.startsWith('image/'))
                                                        .map((asset) => (
                                                            <button
                                                                key={asset.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setProjectBackground({
                                                                        kind: 'image',
                                                                        assetId: asset.id,
                                                                        src: asset.dataUrl,
                                                                        color: bg.kind === 'image' ? bg.color || '#000000' : '#000000',
                                                                        fit: bg.kind === 'image' ? bg.fit || 'cover' : 'cover',
                                                                        dim: bg.kind === 'image' ? bg.dim ?? 0 : 0,
                                                                        blur: bg.kind === 'image' ? bg.blur ?? 0 : 0,
                                                                        opacity: 1,
                                                                    });
                                                                }}
                                                                className="w-10 h-10 rounded-lg border border-subtle hover:border-brand-blue overflow-hidden shrink-0 transition relative group cursor-pointer"
                                                                title={asset.name}
                                                            >
                                                                <img
                                                                    src={asset.thumbUrl || asset.dataUrl}
                                                                    alt={asset.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </InspectorRow>

                            {bg.kind === 'image' && (
                                <>
                                    {/* Fit: Fill (cover) / Fit (contain) */}
                                    <InspectorRow
                                        unstyled
                                        className="space-y-1.5"
                                        labelTag="label"
                                        labelClassName="text-[11px] text-muted-foreground block font-normal"
                                        label={<>Fit</>}
                                    >
                                        <div className="relative">
                                            <FigmaSelect
                                                value={(bg.fit ?? 'cover') === 'contain' ? 'contain' : 'cover'}
                                                onChange={(e) => setProjectBackground({ ...bg, fit: e.target.value as 'cover' | 'contain' })}
                                                className="w-full h-8 pl-3 pr-8 rounded-lg bg-surface border border-subtle hover:border-brand-blue text-[11px] text-foreground appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-blue transition"
                                            >
                                                <option value="cover">Fill</option>
                                                <option value="contain">Fit</option>
                                            </FigmaSelect>
                                        </div>
                                    </InspectorRow>

                                    {/* Dim & Blur */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <ScrubInput
                                            label="Dim"
                                            value={Math.round((bg.dim ?? 0) * 100)}
                                            min={0}
                                            max={100}
                                            step={5}
                                            unit="%"
                                            onChange={(v) => setProjectBackground({ ...bg, dim: v / 100 })}
                                            className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                        />
                                        <ScrubInput
                                            label="Blur"
                                            value={Math.round(bg.blur ?? 0)}
                                            min={0}
                                            max={100}
                                            step={1}
                                            unit="%"
                                            onChange={(v) => setProjectBackground({ ...bg, blur: v })}
                                            className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                        />
                                    </div>

                                    {/* Backdrop Color */}
                                    <InspectorRow
                                        unstyled
                                        className="space-y-1.5"
                                        labelTag="label"
                                        labelClassName="text-[11px] text-muted-foreground block font-normal"
                                        label={<>Backdrop</>}
                                    >
                                        <ColorPicker
                                            color={bg.color || '#000000'}
                                            showGradientMode={false}
                                            onChange={(c) => setProjectBackground({ ...bg, color: c })}
                                        />
                                    </InspectorRow>
                                </>
                            )}
                        </div>
                    )}

                    {/* Mode == 'shader' */}
                    {bgMode === 'shader' && shaderBg && (
                        <div className="space-y-3 pt-0.5">
                            {/* Preset Visual Card */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted-foreground font-normal">Preset</span>
                                    <span className="text-brand-blue font-medium">{currentMeta?.label || currentPreset}</span>
                                </div>
                                <div
                                    className="h-20 rounded-xl border border-subtle hover:border-medium overflow-hidden relative cursor-pointer group bg-app transition shadow-inner"
                                >
                                    {/* Dynamic Shader Swatch Representation */}
                                    <ShaderPreviewCanvas
                                        preset={currentPreset}
                                        color1={shaderColor1}
                                        color2={shaderColor2}
                                        color3={shaderColor3}
                                        colors={shaderBg?.colors}
                                        speed={shaderBg?.speed ?? 1}
                                        waves={shaderBg?.waves ?? 1}
                                        focus={shaderBg?.focus ?? 1}
                                        glow={shaderBg?.glow ?? 1}
                                        shine={shaderBg?.shine ?? 1}
                                    />
                                    <FigmaSelect
                                        aria-label="Shader preset"
                                        value={currentPreset}
                                        onChange={(event) => selectShaderPreset(event.target.value as ShaderPreset)}
                                        className="absolute bottom-2 left-2 h-6 max-w-[calc(100%-16px)] px-2 rounded-md bg-black/70 border border-white/10 text-[11px] text-white"
                                    >
                                        {SHADER_PRESETS.map((preset) => <option key={preset} value={preset}>{SHADER_PRESET_METADATA[preset]?.label || preset}</option>)}
                                    </FigmaSelect>
                                </div>


                            </div>

                            {/* Shader Colors matching Raylight: Color & Accent */}
                            <div className="space-y-2 pt-1 border-t border-subtle">
                                <InspectorRow
                                    unstyled
                                    className="space-y-1.5"
                                    labelTag="label"
                                    labelClassName="text-[11px] text-muted-foreground block font-normal"
                                    label={<>Color</>}
                                >
                                    <ColorPicker
                                        label="Color"
                                        color={shaderColor1.startsWith('#') ? shaderColor1 : `#${shaderColor1}`}
                                        showGradientMode={false}
                                        onChange={(c) => updateShaderColors(c, undefined, undefined)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle hover:border-brand-blue flex items-center gap-2 text-[12px] text-foreground transition w-full"
                                    />
                                </InspectorRow>

                                <InspectorRow
                                    unstyled
                                    className="space-y-1.5"
                                    labelTag="label"
                                    labelClassName="text-[11px] text-muted-foreground block font-normal"
                                    label={<>Accent</>}
                                >
                                    <ColorPicker
                                        label="Accent"
                                        color={shaderColor2.startsWith('#') ? shaderColor2 : `#${shaderColor2}`}
                                        showGradientMode={false}
                                        onChange={(c) => updateShaderColors(undefined, c, undefined)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle hover:border-brand-blue flex items-center gap-2 text-[12px] text-foreground transition w-full"
                                    />
                                </InspectorRow>

                                {isPalette && (
                                    <InspectorRow
                                        unstyled
                                        className="space-y-1.5"
                                        labelTag="label"
                                        labelClassName="text-[11px] text-muted-foreground block font-normal"
                                        label={<>Color 3</>}
                                    >
                                        <ColorPicker
                                            label="Color 3"
                                            color={shaderColor3.startsWith('#') ? shaderColor3 : `#${shaderColor3}`}
                                            showGradientMode={false}
                                            onChange={(c) => updateShaderColors(undefined, undefined, c)}
                                            className="h-8 px-2.5 rounded-lg bg-surface border border-subtle hover:border-brand-blue flex items-center gap-2 text-[12px] text-foreground transition w-full"
                                        />
                                    </InspectorRow>
                                )}
                            </div>

                            {/* Shader Parameters Grid */}
                            <div className="space-y-2 pt-1 border-t border-subtle">

                                {/* Row 1: Speed & Waves */}
                                <div className="grid grid-cols-2 gap-2">
                                    <ScrubInput
                                        label="Speed"
                                        value={shaderBg.speed ?? 1}
                                        min={0}
                                        max={5}
                                        step={0.1}
                                        decimals={1}
                                        unit=" x"
                                        onChange={(v) => updateShaderKnob('speed', v)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                    />
                                    <ScrubInput
                                        label={currentMeta?.knobs?.waves?.label || 'Waves'}
                                        value={Math.round((shaderBg.waves ?? 1) * 100)}
                                        min={10}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('waves', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                    />
                                </div>

                                {/* Row 2: Focus & Glow */}
                                <div className="grid grid-cols-2 gap-2">
                                    <ScrubInput
                                        label={currentMeta?.knobs?.focus?.label || 'Focus'}
                                        value={Math.round((shaderBg.focus ?? 1) * 100)}
                                        min={10}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('focus', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                    />
                                    <ScrubInput
                                        label={currentMeta?.knobs?.glow?.label || 'Glow'}
                                        value={Math.round((shaderBg.glow ?? 1) * 100)}
                                        min={0}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('glow', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                    />
                                </div>

                                {/* Row 3: Shine */}
                                <div>
                                    <ScrubInput
                                        label={currentMeta?.knobs?.shine?.label || 'Shine'}
                                        value={Math.round((shaderBg.shine ?? 1) * 100)}
                                        min={0}
                                        max={300}
                                        step={5}
                                        unit=" %"
                                        onChange={(v) => updateShaderKnob('shine', v / 100)}
                                        className="h-8 px-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-[11px] text-foreground hover:border-brand-blue transition cursor-ew-resize"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


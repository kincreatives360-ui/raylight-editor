import { ColorField, ColorPicker, type GradientValue } from './ColorPicker';
import React, { useEffect, useRef } from 'react';
import { Image as ImageIcon, Palette } from 'lucide-react';
import type { Background, GradientStop, Shot } from '../../model/types';
import { resolveShotBackground } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { useSelectionStore } from '../../store/useSelectionStore';
import { saveImageAsset } from './imageAssetHelper';

type BackgroundType = 'color' | 'image' | 'shader';
interface BackgroundEditorProps { scope: 'project' | 'shot'; activeShot?: Shot; }

function firstColor(background: Background): string {
    if (background.kind === 'solid') return background.color;
    if (background.kind === 'gradient') return background.stops[0]?.color ?? '#0a0a0c';
    return '#0a0a0c';
}

function initialGradient(color: string): GradientValue {
    return { angle: 0, gradientType: 'linear', stops: [{ at: 0, color, opacity: 1 }, { at: 1, color: '#000000', opacity: 1 }] };
}

export const BackgroundEditor: React.FC<BackgroundEditorProps> = ({ scope, activeShot }) => {
    const { project, updateProject, updateShot } = useProjectStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const gradientEditorActive = useSelectionStore((state) => state.gradientEditorActive);
    const gradientEditorAngle = useSelectionStore((state) => state.gradientEditorAngle);
    const setGradientEditor = useSelectionStore((state) => state.setGradientEditor);
    const setGradientEditorAngle = useSelectionStore((state) => state.setGradientEditorAngle);
    const isShot = scope === 'shot';
    const useProject = !isShot || activeShot?.useProjectBackground !== false;
    const background = isShot && activeShot ? resolveShotBackground(project, activeShot) : project.background;
    const color = firstColor(background);
    const isColorGradient = background.kind === 'gradient' && background.source === 'color';
    const type: BackgroundType = background.kind === 'solid' || isColorGradient ? 'color' : background.kind === 'image' ? 'image' : 'shader';

    const setBackground = (next: Background) => {
        if (!isShot) {
            updateProject((current) => ({ ...current, background: next }));
            return;
        }
        if (!activeShot) return;
        updateShot(activeShot.id, (current) => ({ ...current, useProjectBackground: false, background: next }));
    };

    const setUseProject = (enabled: boolean) => {
        if (!activeShot) return;
        updateShot(activeShot.id, (current) => ({
            ...current,
            useProjectBackground: enabled,
            background: enabled ? undefined : { ...project.background },
        }));
        if (enabled) setGradientEditor(false);
    };

    const writeColor = (nextColor: string) => setBackground({ kind: 'solid', color: nextColor });
    const asGradientValue = (bg: Background): GradientValue | undefined => bg.kind === 'gradient' ? { angle: bg.angle, gradientType: bg.gradientType ?? 'linear', stops: bg.stops } : undefined;
    const enterColorGradient = () => {
        const existing = background.kind === 'gradient' ? background : initialGradient(color);
        const next: Background = { kind: 'gradient', source: 'color', angle: existing.angle, gradientType: existing.gradientType ?? 'linear', stops: existing.stops };
        setBackground(next);
        setGradientEditor(true, next.angle);
    };
    const updateColorGradient = (next: GradientValue) => {
        setBackground({ kind: 'gradient', source: 'color', angle: next.angle, gradientType: next.gradientType ?? 'linear', stops: next.stops });
        setGradientEditorAngle(next.angle);
    };

    useEffect(() => {
        if (!gradientEditorActive || !isColorGradient || gradientEditorAngle === background.angle) return;
        setBackground({ ...background, angle: gradientEditorAngle });
    }, [gradientEditorActive, gradientEditorAngle, isColorGradient, background, setBackground]);

    useEffect(() => () => setGradientEditor(false), [setGradientEditor]);

    const setType = (nextType: BackgroundType) => {
        setGradientEditor(false);
        if (nextType === 'color') {
            if (background.kind === 'gradient' && background.source === 'color') {
                setBackground({ kind: 'solid', color: firstColor(background) });
            } else if (background.kind !== 'solid') setBackground({ kind: 'solid', color });
        } else if (nextType === 'image') {
            setBackground({ kind: 'image', assetId: background.kind === 'image' ? background.assetId : '' });
        } else {
            const gradient = background.kind === 'gradient' ? background : initialGradient(color);
            setBackground({ ...gradient, kind: 'gradient', source: 'shader' });
        }
    };

    const pickImage = (file: File | undefined) => {
        if (!file || !file.type.startsWith('image/')) return;
        saveImageAsset({
            file,
            assetId: `background-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            updateProject,
            onSave: (assetId) => setBackground({ kind: 'image', assetId }),
        });
    };

    const setShaderStop = (index: number, stopPatch: Partial<GradientStop>) => {
        if (background.kind !== 'gradient') return;
        const stops = [...background.stops];
        stops[index] = { ...stops[index], ...stopPatch };
        setBackground({ ...background, stops });
    };
    const asset = background.kind === 'image' ? project.assets[background.assetId] : undefined;
    const gradientValue = isColorGradient ? asGradientValue(background) : undefined;

    return <section className="space-y-3 p-3.5" aria-label={isShot ? 'Shot background' : 'Project background'}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-[#a1a1aa]" /><span className="text-[11px] font-medium text-[#e4e4e7]">Background</span></div>
            {isShot && <label className="flex cursor-pointer select-none items-center gap-3"><span className="text-[11px] text-[#a1a1aa]">Use project</span><button type="button" role="switch" aria-label="Use project background" aria-checked={useProject} onClick={() => setUseProject(!useProject)} className="relative h-[18px] w-8 rounded-full bg-[#444448]"><span className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full shadow transition-all ${useProject ? 'translate-x-0 bg-white' : 'translate-x-[14px] bg-[#a1a1aa]'}`} /></button></label>}
        </div>

        {(!isShot || !useProject) && <>
            <div className="space-y-1.5"><span className="text-[10px] text-[#a1a1aa]">Type</span><div className="flex rounded-lg border border-white/[0.06] bg-[#1c1c1f] p-0.5">
                {([['color', 'Color'], ['image', 'Image'], ['shader', 'Shader']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={type === key} onClick={() => setType(key)} className={`flex-1 rounded-md px-2 py-1 text-[11px] transition ${type === key ? 'bg-[#343438] text-white shadow-sm ring-1 ring-white/10' : 'text-[#a1a1aa] hover:text-white'}`}>{label}</button>)}
            </div></div>

            {type === 'color' && <div className="space-y-1.5"><span className="text-[10px] text-[#a1a1aa]">Color</span><ColorPicker color={color} gradientValue={gradientValue} onChange={writeColor} onEnterGradient={enterColorGradient} onExitGradient={() => setGradientEditor(false)} onGradientChange={updateColorGradient} /></div>}

            {type === 'image' && <div className="space-y-2"><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { pickImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />{asset?.dataUrl ? <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/40"><img src={asset.thumbUrl || asset.dataUrl} alt="Background preview" className="h-full w-full object-cover" /><button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-1 text-[10px] text-white hover:bg-black">Replace</button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-[#1c1c1f] text-[#a1a1aa] hover:border-white/30"><ImageIcon className="h-5 w-5" /><span className="text-[10px]">Choose background image</span></button>}</div>}

            {type === 'shader' && background.kind === 'gradient' && <div className="space-y-2"><span className="text-[10px] text-[#a1a1aa]">Shader gradient</span><div className="grid grid-cols-2 gap-2">{background.stops.slice(0, 2).map((stop, index) => <label key={index} className="flex items-center gap-1.5 rounded-md bg-[#1c1c1f] p-1.5"><ColorField  aria-label={`Shader color ${index + 1}`} value={stop.color} onChange={(event) => setShaderStop(index, { color: event.target.value })} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0" /><span className="text-[10px] text-[#a1a1aa]">{index === 0 ? 'Start' : 'End'}</span></label>)}</div><label className="block space-y-1 text-[10px] text-[#a1a1aa]">Angle {background.angle}°<input type="range" min="0" max="360" value={background.angle} onChange={(event) => setBackground({ ...background, angle: Number(event.target.value) })} className="w-full accent-[#a1a1aa]" /></label><div className="h-7 rounded-md border border-white/10" style={{ background: `linear-gradient(${background.angle}deg, ${background.stops.map((stop) => `${stop.color} ${stop.at * 100}%`).join(', ')})` }} /></div>}
        </>}
    </section>;
};

import { AlignCenter, AlignCenterVertical, AlignEndVertical, AlignLeft, AlignRight, AlignStartVertical, ArrowUpDown, MoveHorizontal, Upload } from 'lucide-react';
import { POPULAR_FONT_NAMES, loadGoogleFont } from '../../../engine/fontLoader';
import type { TextLayer } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { ScrubInput } from '../../../ui/ScrubInput';
import { IconButton, InspectorRow, SegmentedControl } from '../../../ui/primitives';
import { DesignSection } from './DesignSection';
interface Props { activeShotId: string; layer: TextLayer; customFonts: string[]; onUploadFontClick: () => void; }
const WEIGHTS = [[100, 'Thin'], [200, 'Extra light'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']] as const;
export function TypographySection({ activeShotId, layer, customFonts, onUploadFontClick }: Props) {
    const updateLayer = useProjectStore((s) => s.updateLayer);
    const update = (patch: Partial<TextLayer['font']>) => updateLayer(activeShotId, layer.id, (l) => l.kind === 'text' ? { ...l, font: { ...l.font, ...patch } } : l);
    return <DesignSection title="Typography" actions={<IconButton label="Upload custom font" icon={<Upload />} onClick={onUploadFontClick} />}>
        <InspectorRow label="Font" stacked><FigmaSelect aria-label="Font family" className="object-design-input" value={layer.font.family} onChange={(event) => { loadGoogleFont(event.target.value); update({ family: event.target.value }); }}>{[...new Set([layer.font.family, ...POPULAR_FONT_NAMES, ...customFonts])].map((family) => <option key={family} value={family}>{family}</option>)}</FigmaSelect></InspectorRow>
        <InspectorRow label="Weight" stacked><div className="object-design-pair"><FigmaSelect aria-label="Font weight" className="object-design-input" value={layer.font.weight} onChange={(event) => update({ weight: Number(event.target.value) })}>{WEIGHTS.map(([weight, name]) => <option key={weight} value={weight}>{name}</option>)}</FigmaSelect><ScrubInput label="Size" aria-label="Font size" value={Math.round(layer.font.size * 1080)} min={6} max={600} onChange={(value) => update({ size: value / 1080 })} /></div></InspectorRow>
        <InspectorRow label="Spacing" stacked><div className="object-design-triple"><ScrubInput label={<MoveHorizontal />} aria-label="Letter spacing" value={layer.font.letterSpacing} min={-5} max={100} step={.1} onChange={(value) => update({ letterSpacing: value })} /><ScrubInput label={<ArrowUpDown />} aria-label="Line height" value={layer.font.lineHeight ?? 1.22} min={.5} max={4} step={.05} onChange={(value) => update({ lineHeight: value })} /><ScrubInput label="W" aria-label="Text width" value={Math.round(layer.maxWidth * 1920)} min={96} max={7680} onChange={(value) => updateLayer(activeShotId, layer.id, (l) => l.kind === 'text' ? { ...l, maxWidth: value / 1920 } : l)} /></div></InspectorRow>
        <InspectorRow label="Text alignment" stacked><div className="object-design-pair"><SegmentedControl value={layer.font.align} onChange={(align) => update({ align })} options={[{ value: 'left', icon: <AlignLeft />, ariaLabel: 'Align left' }, { value: 'center', icon: <AlignCenter />, ariaLabel: 'Align center' }, { value: 'right', icon: <AlignRight />, ariaLabel: 'Align right' }]} /><SegmentedControl value={layer.verticalAlign ?? 'middle'} onChange={(verticalAlign) => updateLayer(activeShotId, layer.id, (l) => l.kind === 'text' ? { ...l, verticalAlign } : l)} options={[{ value: 'top', icon: <AlignStartVertical />, ariaLabel: 'Align text top' }, { value: 'middle', icon: <AlignCenterVertical />, ariaLabel: 'Align text middle' }, { value: 'bottom', icon: <AlignEndVertical />, ariaLabel: 'Align text bottom' }]} /></div></InspectorRow>
    </DesignSection>;
}

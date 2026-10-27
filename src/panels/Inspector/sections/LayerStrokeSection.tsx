import { Minus, Plus } from 'lucide-react';
import type { Layer } from '../../../model/types';
import { useProjectStore } from '../../../store/useProjectStore';
import { FigmaSelect } from '../../../ui/FigmaSelect';
import { IconButton } from '../../../ui/primitives';
import { ScrubInput } from '../../../ui/ScrubInput';
import { ColorPicker } from '../ColorPicker';
import { DesignSection } from './DesignSection';

type StrokeLayer = Exclude<Layer, { kind: 'text' }>;
type Stroke = NonNullable<StrokeLayer['stroke']>;
export function LayerStrokeSection({ shotId, layer }: { shotId: string; layer: StrokeLayer }) {
    const updateLayer = useProjectStore((s) => s.updateLayer);
    const stroke = layer.stroke;
    const update = (patch: Partial<Stroke>) => updateLayer(shotId, layer.id, (l) => l.kind !== 'text' ? { ...l, stroke: { color: '#d9d9d9', width: .002, opacity: 1, ...l.stroke, ...patch } } : l);
    return <DesignSection title="Stroke" actions={<IconButton label={stroke ? 'Remove Stroke' : 'Add Stroke'} icon={stroke ? <Minus /> : <Plus />} onClick={() => stroke ? updateLayer(shotId, layer.id, (l) => l.kind !== 'text' ? { ...l, stroke: undefined } : l) : update({})} />}>
        {stroke && <>
            <ColorPicker label="Stroke color" color={stroke.color} showGradientMode={false} onChange={(color) => update({ color })} />
            <div className="object-design-pair">
                <ScrubInput label="W" aria-label="Stroke width" value={stroke.width * 1000} min={.1} max={100} step={.1} unit=" px" onChange={(value) => update({ width: value / 1000 })} />
                <ScrubInput label="Opacity" aria-label="Stroke opacity" value={stroke.opacity * 100} min={0} max={100} unit=" %" onChange={(value) => update({ opacity: value / 100 })} />
            </div>
            {layer.kind === 'shape' && <div className="object-design-pair">
                <FigmaSelect aria-label="Stroke alignment" className="object-design-input" value={layer.stroke?.align ?? 'inside'} onChange={(event) => update({ align: event.target.value as 'inside' | 'center' | 'outside' })}>{['inside', 'center', 'outside'].map((align) => <option key={align} value={align}>{align}</option>)}</FigmaSelect>
                <FigmaSelect aria-label="Stroke style" className="object-design-input" value={layer.stroke?.style ?? 'solid'} onChange={(event) => update({ style: event.target.value as 'solid' | 'dashed' | 'dotted' })}>{['solid', 'dashed', 'dotted'].map((style) => <option key={style} value={style}>{style}</option>)}</FigmaSelect>
            </div>}
        </>}
    </DesignSection>;
}

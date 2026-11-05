import { AxisFields } from '../../../ui/AxisFields';
import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, CircleDot, Crosshair, FlipHorizontal, FlipVertical, Radius, Ratio, RotateCcw, RotateCw, Scan, Square } from 'lucide-react';

import { isLayerEffectivelyLocked } from '../../../engine/evaluateShot';
import { degToRad, radToDeg } from '../../../model/defaults';
import { getDevicePlacementSize, isFixedDeviceFrame, resizeDevicePlacement } from '../../../model/deviceFrame';
import type { Layer, Shot } from '../../../model/types';
import { ASPECT_RATIO_CONFIG, getArtboardDimensions } from '../../../stage/stageUtils';
import { useProjectStore } from '../../../store/useProjectStore';
import { ScrubInput } from '../../../ui/ScrubInput';
import { IconButton, InspectorRow } from '../../../ui/primitives';
import { DesignSection } from './DesignSection';

export function LayerGeometrySections({ shot, layer, selectedLayerIds, aspectLocked, onAspectLockedChange }: { shot: Shot; layer: Layer; selectedLayerIds: string[]; aspectLocked: boolean; onAspectLockedChange: (locked: boolean) => void }) {
    const { project, updateLayer, updateShot } = useProjectStore();

    const update = (updater: (current: Layer) => Layer) => updateLayer(shot.id, layer.id, updater);
    const aspect = ASPECT_RATIO_CONFIG[project.aspectRatio];
    const projectAspect = aspect.widthRatio / aspect.heightRatio;
    const fixedFrame = (layer.kind === 'image' || layer.kind === 'video') && layer.deviceFrame?.enabled && isFixedDeviceFrame(layer.deviceFrame) ? layer.deviceFrame : undefined;
    const artboard = getArtboardDimensions(project.aspectRatio);
    const stageW = fixedFrame ? artboard.width : 1920;
    const stageH = fixedFrame ? artboard.height : 1080;
    const size = layer.kind !== 'text' ? layer.size : undefined;
    const displaySize = size && fixedFrame ? getDevicePlacementSize(size, fixedFrame, projectAspect) : size;
    const has3D = Math.abs(layer.rotation.x) > 0.001 || Math.abs(layer.rotation.y) > 0.001 || Math.abs(layer.position.z) > 0.001;

    const align = (axis: 'x' | 'y', value: number) => {
        const selected = new Set(selectedLayerIds);
        updateShot(shot.id, (s) => ({ ...s, layers: s.layers.map((l) => selected.has(l.id) && !isLayerEffectivelyLocked(l, s.groups) ? { ...l, position: { ...l.position, [axis]: value } } : l) }));
    };
    const resize = (axis: 'width' | 'height', pixels: number) => update((l) => {
        if (l.kind === 'text') return l;
        const normalized = pixels / (axis === 'width' ? stageW : stageH);
        if (fixedFrame) return { ...l, size: resizeDevicePlacement(l.size, axis, normalized, getDevicePlacementSize(l.size, fixedFrame, projectAspect)) };
        const ratio = normalized / Math.max(0.0001, l.size[axis]);
        return { ...l, size: { width: axis === 'width' ? normalized : aspectLocked ? l.size.width * ratio : l.size.width, height: axis === 'height' ? normalized : aspectLocked ? l.size.height * ratio : l.size.height } };
    });
    const rotate = (axis: 'x' | 'y' | 'z', degrees: number) => update((l) => ({ ...l, rotation: { ...l.rotation, [axis]: degToRad(degrees) } }));

    return <>
        <DesignSection title="Position">
            <InspectorRow label="Alignment" stacked><div className="object-design-alignment">
                {[['x', -0.32, 'Align Left', AlignHorizontalJustifyStart], ['x', 0, 'Center X', AlignHorizontalJustifyCenter], ['x', 0.32, 'Align Right', AlignHorizontalJustifyEnd], ['y', -0.32, 'Align Top', AlignVerticalJustifyStart], ['y', 0, 'Center Y', AlignVerticalJustifyCenter], ['y', 0.32, 'Align Bottom', AlignVerticalJustifyEnd]].map(([axis, value, name, Icon], index) => {
                    const Glyph = Icon as typeof AlignHorizontalJustifyStart;
                    return <IconButton key={String(name)} label={String(name)} icon={<Glyph />} onClick={() => align(axis as 'x' | 'y', Number(value))} className={index === 3 ? 'alignment-second-group' : ''} />;
                })}
            </div></InspectorRow>
            <InspectorRow label="Position" stacked><div className="object-design-field-action">
                <AxisFields
                    className="object-design-pair"
                    fields={(['x', 'y'] as const).map((axis) => ({"key": axis, "label": axis.toUpperCase(), "value": Math.round(layer.position[axis] * (axis === 'x' ? 1920 : 1080)), "step": 1, "onChange": (value) => update((l) => ({ ...l, position: { ...l.position, [axis]: value / (axis === 'x' ? 1920 : 1080) } }))}))}
                />
                <IconButton label="Center Position (0, 0)" icon={<Crosshair />} onClick={() => update((l) => ({ ...l, position: { ...l.position, x: 0, y: 0 } }))} />
            </div></InspectorRow>
            <InspectorRow label="Depth & rotation" stacked><div className="object-design-pair object-design-action-space">
                <ScrubInput label="Z" value={Math.round(layer.position.z * 1000)} step={1} onChange={(value) => update((l) => ({ ...l, position: { ...l.position, z: value / 1000 } }))} />
                <ScrubInput label={<RotateCw />} aria-label="Rotation" value={radToDeg(layer.rotation.z)} step={1} unit="°" onChange={(value) => rotate('z', value)} />
            </div></InspectorRow>
            <InspectorRow label="Rotation" stacked><div className="object-design-field-action"><div className="object-design-action-strip">
                <IconButton label="Rotate 90° Clockwise" icon={<RotateCw />} onClick={() => rotate('z', radToDeg(layer.rotation.z) + 90)} />
                <IconButton label="Flip Horizontally" icon={<FlipHorizontal />} onClick={() => update((l) => ({ ...l, scale: { ...l.scale, x: -l.scale.x } }))} />
                <IconButton label="Flip Vertically" icon={<FlipVertical />} onClick={() => update((l) => ({ ...l, scale: { ...l.scale, y: -l.scale.y } }))} />
            </div><IconButton label="Reset rotation" icon={<Scan />} onClick={() => rotate('z', 0)} /></div></InspectorRow>
        </DesignSection>
        <DesignSection title="Tilt" collapsible defaultOpen={has3D}>
            <InspectorRow label="Tilt" stacked><AxisFields
                className="object-design-pair object-design-action-space"
                fields={(['x', 'y'] as const).map((axis) => ({"key": axis, "label": axis.toUpperCase(), "value": radToDeg(layer.rotation[axis]), "min": -360, "max": 360, "step": 1, "unit": "°", "onChange": (value) => rotate(axis, value)}))}
            /></InspectorRow>
            <InspectorRow label="Tilt" stacked><div className="object-design-action-strip object-design-action-space">
                <IconButton label="Reset Tilt (0°)" icon={<RotateCcw />} onClick={() => update((l) => ({ ...l, rotation: { ...l.rotation, x: 0, y: 0 } }))} />
                <IconButton label="Invert Yaw Angle" icon={<FlipHorizontal />} onClick={() => rotate('y', -radToDeg(layer.rotation.y))} />
                <IconButton label="Isometric 3D Preset" icon={<Square />} onClick={() => update((l) => ({ ...l, rotation: { x: degToRad(-35), y: degToRad(20), z: degToRad(15) } }))} />
            </div></InspectorRow>
        </DesignSection>
        {layer.kind !== 'text' && displaySize && <DesignSection title="Layout">
            <InspectorRow label="Size" stacked><div className="object-design-field-action"><div className="object-design-pair">
                <ScrubInput label="W" value={Math.round(displaySize.width * stageW)} min={1} max={16000} step={1} onChange={(value) => resize('width', value)} />
                <ScrubInput label="H" value={Math.round(displaySize.height * stageH)} min={1} max={16000} step={1} onChange={(value) => resize('height', value)} />
            </div><IconButton label={fixedFrame ? 'Phone proportions are fixed' : aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'} icon={<Ratio />} active={aspectLocked || !!fixedFrame} disabled={!!fixedFrame} onClick={() => onAspectLockedChange(!aspectLocked)} /></div></InspectorRow>
            {layer.kind === 'shape' && <InspectorRow label="Depth" stacked><ScrubInput label="D" value={layer.depth ?? 0} min={-500} max={500} onChange={(value) => update((l) => l.kind === 'shape' ? { ...l, depth: value } : l)} /></InspectorRow>}
        </DesignSection>}
        <DesignSection title="Appearance"><InspectorRow label="Opacity" stacked><div className={layer.kind === 'text' ? '' : 'object-design-pair object-design-action-space'}>
            <ScrubInput label={<CircleDot />} aria-label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} unit=" %" onChange={(value) => update((l) => ({ ...l, opacity: value / 100 }))} />
            {layer.kind !== 'text' && <ScrubInput label={<Radius />} aria-label="Corner radius" value={Math.round(layer.cornerRadius * 100)} min={0} max={50} unit=" %" onChange={(value) => update((l) => l.kind !== 'text' ? { ...l, cornerRadius: value / 100 } : l)} />}
        </div></InspectorRow></DesignSection>
    </>;
}

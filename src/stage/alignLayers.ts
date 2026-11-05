import type { Layer } from '../model/types';

export type LayerAlignment = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';

export const alignLayers = (
    layers: Layer[],
    layerIds: Set<string>,
    alignment: LayerAlignment,
    targetAspect: number
) => layers.map((layer) => {
    if (!layerIds.has(layer.id) || layer.locked) return layer;

    const size = 'size' in layer ? layer.size : { width: 300, height: 200 };
    const layerWidth = ((size.width || 300) / 1920) * (layer.scale?.x ?? 1);
    const layerHeight = ((size.height || 200) / 1080) * (layer.scale?.y ?? 1);
    const halfWidth = targetAspect / 2;
    let x = layer.position.x;
    let y = layer.position.y;

    if (alignment === 'left') x = -halfWidth + layerWidth / 2;
    else if (alignment === 'center-h') x = 0;
    else if (alignment === 'right') x = halfWidth - layerWidth / 2;
    else if (alignment === 'top') y = 0.5 - layerHeight / 2;
    else if (alignment === 'center-v') y = 0;
    else if (alignment === 'bottom') y = -0.5 + layerHeight / 2;

    return { ...layer, position: { ...layer.position, x, y } };
});

import { Circle, Image as ImageIcon, Square, Type, Video } from 'lucide-react';
import type { Layer } from '../../model/types';

interface LayerIconProps {
    layer: Layer;
    isSelected: boolean;
}

export const LayerIcon = ({ layer, isSelected }: LayerIconProps) => {
    if (layer.kind === 'video') {
        return (
            <Video
                className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#38bdf8]' : 'text-[#38bdf8]'}`}
            />
        );
    }
    if (layer.kind === 'image') {
        return (
            <ImageIcon
                className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#38bdf8]' : 'text-[#0ea5e9]'}`}
            />
        );
    }
    if (layer.kind === 'shape') {
        return layer.shape === 'ellipse' ? (
            <Circle className="w-3.5 h-3.5 shrink-0 text-[#8b5cf6]" />
        ) : (
            <Square className="w-3.5 h-3.5 shrink-0 text-[#8b5cf6]" />
        );
    }
    return (
        <Type
            className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#ec4899]'}`}
        />
    );
};

import { IconButton } from '../../../ui/primitives';
import type { ReactNode } from 'react';
import { Minus } from 'lucide-react';

interface LayerEffectCardProps {
    title: string;
    icon: ReactNode;
    removeLabel?: string;
    onRemove: () => void;
    children: ReactNode;
}

export function LayerEffectCard({ title, icon, removeLabel = `Remove ${title}`, onRemove, children }: LayerEffectCardProps) {
    return <details className="object-design-effect">
        <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
            <div className="flex items-center gap-1.5">
                {icon}
                <span>{title}</span>
            </div>
            <IconButton unstyled tooltip={false} label={removeLabel} icon={<>
                <Minus className="w-3 h-3" />
            </>} onClick={event => { event.preventDefault(); onRemove(); }}
className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
title={removeLabel} />
        </summary>
        {children}
    </details>;
}

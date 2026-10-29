import { IconButton } from '../../../ui/primitives';
import type { ReactNode } from 'react';
import { Eye, EyeOff, Minus } from 'lucide-react';

interface LayerEffectCardProps {
    title: string;
    icon: ReactNode;
    removeLabel?: string;
    onRemove: () => void;
    children: ReactNode;
    enabled?: boolean;
    onToggle?: () => void;
}

export function LayerEffectCard({ title, icon, removeLabel = `Remove ${title}`, onRemove, children, enabled = true, onToggle }: LayerEffectCardProps) {
    return <details className="object-design-effect">
        <summary className="flex items-center justify-between text-[11px] font-medium text-[#e4e4e7]">
            <div className="flex items-center gap-1.5">
                {icon}
                <span>{title}</span>
            </div>
            <span className="flex items-center gap-1">
            {onToggle && <IconButton unstyled tooltip={false} label={`${enabled ? 'Disable' : 'Enable'} ${title}`} icon={enabled ? <Eye size={13} /> : <EyeOff size={13} />} onClick={event => { event.preventDefault(); onToggle(); }} className="p-1 text-muted-foreground hover:text-foreground" />}
            <IconButton unstyled tooltip={false} label={removeLabel} icon={<>
                <Minus className="w-3 h-3" />
            </>} onClick={event => { event.preventDefault(); onRemove(); }}
className="p-0.5 rounded hover:bg-white/10 text-[#a1a1aa] hover:text-white cursor-pointer"
title={removeLabel} />
            </span>
        </summary>
        {children}
    </details>;
}

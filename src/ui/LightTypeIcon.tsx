import { LIGHT_TYPE_META } from './lightTypes';
import type { LightSourceType } from '../model/types';



export function LightTypeIcon({ type, className, colored = true }: {
    type: LightSourceType;
    className?: string;
    colored?: boolean;
}) {
    const metadata = LIGHT_TYPE_META[type] ?? LIGHT_TYPE_META.directional;
    const Icon = metadata.icon;
    return <Icon className={className ?? `w-3.5 h-3.5${colored ? ` ${metadata.color}` : ''}`} />;
}

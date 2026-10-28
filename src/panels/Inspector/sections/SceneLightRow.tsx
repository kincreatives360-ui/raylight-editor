import type { ReactNode } from 'react';

export function SceneLightRow({ id, selected, onSelect, icon, name, actions, custom = false, environment = false }: {
    id: string;
    selected: boolean;
    onSelect: () => void;
    icon: ReactNode;
    name: ReactNode;
    actions?: ReactNode;
    custom?: boolean;
    environment?: boolean;
}) {
    return <div data-testid={`scene-light-item-${id}`} data-selected={selected ? 'true' : 'false'} onClick={onSelect}
        className={`group px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] transition cursor-pointer ${selected
            ? 'bg-[#0088ff]/15 border-[#0088ff]/40 text-white'
            : `bg-[#18181b] border-white/[0.06] text-[#d4d4d8] hover:bg-white/[0.04]${environment ? '' : ' hover:border-white/15'}`}`}>
        <div className={`flex items-center gap-2 min-w-0${custom ? ' flex-1 mr-2' : ''}`}>{icon}{name}</div>
        {actions && <div className={custom ? 'flex items-center gap-0.5 shrink-0' : 'flex items-center gap-1'}>{actions}</div>}
    </div>;
}

import type { ComponentProps } from 'react';
import { ScrubInput } from './ScrubInput';

export type AxisField = ComponentProps<typeof ScrubInput> & { key: string };

export function AxisFields({ fields, className }: { fields: AxisField[]; className?: string }) {
    const columns = fields.length === 1 ? 'grid-cols-1' : fields.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
    return <div className={className ?? `grid ${columns} gap-2`}>
        {fields.map(({ key, ...field }) => <ScrubInput key={key} {...field} />)}
    </div>;
}

import { Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { IconButton, SectionHeader } from '../../../ui/primitives';

/** Shared section spacing and disclosure used by every object Design inspector. */
export function DesignSection({ title, children, collapsible = false, defaultOpen = true, actions }: {
    title: string; children?: ReactNode; collapsible?: boolean; defaultOpen?: boolean; actions?: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return <section className="object-design-section" aria-label={title}>
        <SectionHeader title={title} className="object-design-heading" actions={<>{actions}{collapsible && <IconButton
            label={`${open ? 'Collapse' : 'Expand'} ${title}`} aria-expanded={open} icon={open ? <Minus /> : <Plus />} size="xs" onClick={() => setOpen(!open)}
        />}</>} />
        {(!collapsible || open) && children && <div className="object-design-fields">{children}</div>}
    </section>;
}

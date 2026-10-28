import { useId, useState, type ReactNode, type DetailsHTMLAttributes, type HTMLAttributes } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function InspectorDisclosure({ title, children, open, onOpenChange, defaultOpen = true,
    className = 'p-3.5 space-y-3', headerClassName = 'flex items-center justify-between cursor-pointer w-full text-left',
    titleClassName = 'text-[11px] font-medium text-[#e4e4e7]', bodyClassName,
    headerContent, toggleLabel, chevronClassName = 'w-3.5 h-3.5 text-[#a1a1aa]',
}: {
    title: ReactNode;
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    className?: string;
    headerClassName?: string;
    titleClassName?: string;
    bodyClassName?: string;
    headerContent?: ReactNode;
    toggleLabel?: string;
    chevronClassName?: string;
}) {
    const [localOpen, setLocalOpen] = useState(defaultOpen);
    const isOpen = open ?? localOpen;
    const bodyId = useId();
    const Chevron = isOpen ? ChevronUp : ChevronDown;
    return <div className={className}>
        <button type="button" aria-label={toggleLabel} aria-expanded={isOpen} aria-controls={bodyId} className={headerClassName}
            onClick={() => { setLocalOpen(!isOpen); onOpenChange?.(!isOpen); }}>
            {headerContent ?? <span className={titleClassName}>{title}</span>}
            <Chevron className={chevronClassName} />
        </button>
        {isOpen && <div id={bodyId} className={bodyClassName}>{children}</div>}
    </div>;
}

/** Native disclosures keep browser keyboard behavior and existing summary CSS. */
export function NativeInspectorDisclosure({ summary, summaryProps, children, ...props }: DetailsHTMLAttributes<HTMLDetailsElement> & {
    summary: ReactNode;
    summaryProps?: HTMLAttributes<HTMLElement>;
}) {
    return <details {...props}><summary {...summaryProps}>{summary}</summary>{children}</details>;
}

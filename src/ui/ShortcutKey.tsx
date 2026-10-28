import type { HTMLAttributes } from 'react';

export function ShortcutKey({ className = 'px-1.5 py-0.5 bg-white/[0.06] rounded border border-white/10 font-mono text-[11px]', ...props }: HTMLAttributes<HTMLElement>) {
    return <kbd className={className} {...props} />;
}

import type { ComponentProps } from 'react';
import { ScrubInput } from './ScrubInput';

type TimingField = ComponentProps<typeof ScrubInput>;

export function AnimationTimingFields({ start, duration, className = 'grid grid-cols-2 gap-2' }: {
    start: TimingField;
    duration: TimingField;
    className?: string;
}) {
    return <div className={className}><ScrubInput {...start} /><ScrubInput {...duration} /></div>;
}

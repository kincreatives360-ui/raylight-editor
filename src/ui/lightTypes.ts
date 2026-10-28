import { Sun, Flashlight, Lightbulb, Square } from 'lucide-react';

export const LIGHT_TYPE_META = {
    directional: { icon: Sun, label: 'Sun', menuLabel: 'Directional', color: 'text-amber-400' },
    spot: { icon: Flashlight, label: 'Spot', menuLabel: 'Spot Light', color: 'text-orange-400' },
    point: { icon: Lightbulb, label: 'Point', menuLabel: 'Point Light', color: 'text-yellow-300' },
    area: { icon: Square, label: 'Area', menuLabel: 'Area Light', color: 'text-blue-400' },
    ambient: { icon: Sun, label: 'Ambient', menuLabel: 'Ambient', color: 'text-amber-400' },
} as const;

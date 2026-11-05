import type React from 'react';
import { Circle, Minus, Pentagon, Square, ArrowRight, Feather } from 'lucide-react';
import type { CanvasTool } from '../store/useSelectionStore';
import { PEN_PATH_SHORTCUT } from '../utils/penPathShortcut';

export const SHAPE_TOOL_ITEMS: { id: CanvasTool; label: string; key: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'rectangle', label: 'Rectangle', key: 'R', icon: Square },
    { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
    { id: 'polygon', label: 'Polygon', key: '', icon: Pentagon },
    { id: 'pen', label: 'Pen path', key: PEN_PATH_SHORTCUT.label, icon: Feather },
    { id: 'line', label: 'Line', key: 'L', icon: Minus },
    { id: 'arrow', label: 'Arrow', key: 'A', icon: ArrowRight },
];

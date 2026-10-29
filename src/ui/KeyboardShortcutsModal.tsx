import { IconButton } from './primitives';
import { ShortcutKey } from './ShortcutKey';
import { SearchField } from './SearchField';
import { ModalShell } from './ModalShell';
// src/ui/KeyboardShortcutsModal.tsx
import React, { useState, useMemo } from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { getModifierKey } from '../utils/shortcuts';
import { CAMERA_TOOL_SHORTCUT, SCISSORS_SHORTCUT } from '../utils/cameraShortcuts';
import { PEN_PATH_SHORTCUT } from '../utils/penPathShortcut';

export interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Tools' | 'Playback & Animation' | 'Layers & Editing' | 'View & Navigation';
}

const SHORTCUTS: ShortcutItem[] = [
  // Tools
  { keys: ['V'], description: 'Select Tool (Plane-aware move)', category: 'Tools' },
  { keys: ['G'], description: 'Move Tool (Free 3D translation)', category: 'Tools' },
  { keys: ['Y'], description: 'Tilt Tool (3D Rotation / Orbit)', category: 'Tools' },
  { keys: ['H'], description: 'Hand Tool (Pan stage viewport)', category: 'Tools' },
  { keys: ['T'], description: 'Text Tool (Place text layer)', category: 'Tools' },
  { keys: ['I'], description: 'Media Tool (Place image/video frame)', category: 'Tools' },
  { keys: ['R'], description: 'Rectangle Tool (Draw box)', category: 'Tools' },
  { keys: ['O'], description: 'Ellipse Tool (Draw circle)', category: 'Tools' },
  { keys: ['L'], description: 'Line Tool (Draw straight line)', category: 'Tools' },
  { keys: ['A'], description: 'Arrow Tool (Draw direction arrow)', category: 'Tools' },
  { keys: [...PEN_PATH_SHORTCUT.keys], description: 'Pen Path Tool (Draw freehand polygon paths)', category: 'Tools' },
  { keys: [...CAMERA_TOOL_SHORTCUT.keys], description: 'Orbit Tool (Camera, Pan, Dolly)', category: 'Tools' },
  { keys: [...SCISSORS_SHORTCUT.keys], description: 'Scissors (Split shot at playhead)', category: 'Tools' },

  // Playback & Animation
  { keys: ['Space'], description: 'Play / Pause timeline playback', category: 'Playback & Animation' },
  { keys: ['Shift', 'A'], description: 'Toggle Live Motion Recording (Animate Mode)', category: 'Playback & Animation' },
  { keys: ['Arrow Keys'], description: 'Nudge selected layer position (0.005 units)', category: 'Playback & Animation' },
  { keys: ['Shift', 'Arrow Keys'], description: 'Fast nudge selected layer (0.025 units)', category: 'Playback & Animation' },

  // Layers & Editing
  { keys: ['⌘/Ctrl', 'A'], description: 'Select all layers in active shot', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'C'], description: 'Copy selected layers to clipboard', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'D'], description: 'Duplicate selected layer', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'G'], description: 'Group selected layers into container', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'Shift', 'G'], description: 'Ungroup container layer', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', ']'], description: 'Bring layer forward one level', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', '['], description: 'Send layer backward one level', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'Shift', ']'], description: 'Bring layer to extreme front', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'Shift', '['], description: 'Send layer to extreme back', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'Shift', 'H'], description: 'Toggle layer visibility (Hide/Show)', category: 'Layers & Editing' },
  { keys: ['Delete / ⌫'], description: 'Delete selected layer(s)', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'Z'], description: 'Undo last change', category: 'Layers & Editing' },
  { keys: ['⌘/Ctrl', 'Shift', 'Z'], description: 'Redo previously undone change', category: 'Layers & Editing' },

  // View & Navigation
  { keys: ['F'], description: 'Frame Selection (Fit camera to selected layer/scene)', category: 'View & Navigation' },
  { keys: ["'"], description: "Toggle Safe Zones & Rule of Thirds grid", category: 'View & Navigation' },
  { keys: ['\\'], description: 'Zen Mode (Toggle both left & right sidebars)', category: 'View & Navigation' },
  { keys: ['['], description: 'Toggle Left Sidebar (Panels & Audio)', category: 'View & Navigation' },
  { keys: [']'], description: 'Toggle Right Inspector Sidebar', category: 'View & Navigation' },
  { keys: ['?'], description: 'Open Keyboard Shortcuts Guide', category: 'View & Navigation' },
  { keys: ['Esc'], description: 'Deselect / Cancel crop / Close modal', category: 'View & Navigation' },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const handleClose = () => {
    setSearch('');
    setActiveCategory('All');
    onClose();
  };

  const categories = useMemo(() => {
    return ['All', 'Tools', 'Playback & Animation', 'Layers & Editing', 'View & Navigation'];
  }, []);

  const filteredShortcuts = useMemo(() => {
    return SHORTCUTS.filter((sc) => {
      const matchesCategory =
        activeCategory === 'All' || sc.category === activeCategory;
      const q = search.trim().toLowerCase();
      if (!q) return matchesCategory;
      const matchesText =
        sc.description.toLowerCase().includes(q) ||
        sc.keys.some((k) => k.toLowerCase().includes(q)) ||
        sc.category.toLowerCase().includes(q);
      return matchesCategory && matchesText;
    });
  }, [search, activeCategory]);

  if (!isOpen) return null;

  return (
    <ModalShell
        onClose={handleClose}
        backdropProps={{"role": "dialog", "aria-modal": "true", "aria-labelledby": "shortcuts-title", "className": "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-150", "onClick": handleClose}}
        surfaceProps={{"id": "raylight-keyboard-shortcuts-modal", "className": "raylight-modal w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-surface border border-subtle shadow-2xl overflow-hidden text-xs", "onClick": (e) => e.stopPropagation()}}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle bg-surface/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-blue/15 border border-brand-blue/30 flex items-center justify-center text-brand-blue">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-sm font-semibold text-white">
                Studio Keyboard Shortcuts
              </h2>
              <p className="text-xs text-muted-foreground">
                Master speed editing with professional hotkeys &amp; controls
              </p>
            </div>
          </div>
          <IconButton
              unstyled
              tooltip={false}
              label="Close shortcuts guide"
              icon={<>
                <X className="w-4 h-4" />
              </>}
              onClick={handleClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-subtle transition cursor-pointer"
          />
        </div>

        {/* Search & Category Filter Pills */}
        <div className="p-4 border-b border-subtle bg-app space-y-3">
          <SearchField
              containerClassName="relative"
              iconClassName="absolute left-3 top-2.5 w-3.5 h-3.5 text-disabled"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortcuts by action or key (e.g. animate, nudge, group, safe)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface border border-subtle text-foreground placeholder-disabled text-xs focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition"
              autoFocus
          ></SearchField>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-brand-blue text-white shadow-xs'
                    : 'bg-subtle text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center text-disabled">
              No shortcuts found matching &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredShortcuts.map((sc) => (
                <div
                  key={sc.description}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-subtle/70 hover:bg-subtle border border-subtle transition group"
                >
                  <span className="text-gray-300 font-medium text-[11px] pr-2">
                    {sc.description}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {sc.keys.map((k, kidx) => (
                      <ShortcutKey
                        key={`${k}-${kidx}`}
                        className="px-2 py-0.5 rounded-md bg-surface border border-subtle text-foreground font-mono tabular-nums text-[11px] font-semibold tracking-tight shadow-xs select-none"
                      >
                        {k === '⌘/Ctrl' ? getModifierKey() : k}
                      </ShortcutKey>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-subtle bg-surface flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-brand-blue" />
            <span>Press <ShortcutKey className="px-1.5 py-0.5 rounded bg-subtle text-white text-[11px]">?</ShortcutKey> anywhere to toggle this guide</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1 rounded-lg bg-subtle hover:bg-muted text-white text-xs font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </ModalShell>
  );
};

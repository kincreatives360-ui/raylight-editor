// src/ui/CommandMenu.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { formatShortcut } from '../utils/shortcuts';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Tools' | 'Playback' | 'Editing' | 'View' | 'Project';
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string[];
  action: () => void;
}

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        c.category.toLowerCase().includes(lower) ||
        c.subtitle?.toLowerCase().includes(lower)
    );
  }, [commands, query]);

  // Reset state on open
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  // Derive clamped active index without setState effect
  const activeIndex = Math.min(selectedIndex, Math.max(0, filteredCommands.length - 1));

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (Math.min(prev, Math.max(0, filteredCommands.length - 1)) + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (Math.min(prev, Math.max(0, filteredCommands.length - 1)) - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredCommands[activeIndex];
      if (current) {
        onClose();
        current.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Menu"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#141418] border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-[#18181f]">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
            aria-autocomplete="list"
            aria-controls="command-list"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-white/[0.06] rounded border border-white/10">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div
          id="command-list"
          ref={listRef}
          role="listbox"
          className="max-h-[380px] overflow-y-auto p-2 space-y-1"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isSelected}
                  onClick={() => {
                    onClose();
                    cmd.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs select-none transition-colors ${
                    isSelected
                      ? 'bg-[#0088ff] text-white shadow-sm'
                      : 'text-zinc-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-zinc-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-medium truncate">{cmd.title}</div>
                      {cmd.subtitle && (
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-white/80' : 'text-zinc-500'
                          }`}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span
                      className={`text-[9.5px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.04] text-zinc-500'
                      }`}
                    >
                      {cmd.category}
                    </span>
                    {cmd.shortcut && cmd.shortcut.length > 0 && (
                      <kbd
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                          isSelected
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-black/30 text-zinc-400 border-white/10'
                        }`}
                      >
                        {formatShortcut(cmd.shortcut)}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-[#121216] text-[10.5px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1 py-0.5 bg-white/[0.06] rounded border border-white/10">↑</kbd>
            <kbd className="px-1 py-0.5 bg-white/[0.06] rounded border border-white/10">↓</kbd>
            <span>Execute:</span>
            <kbd className="px-1 py-0.5 bg-white/[0.06] rounded border border-white/10">Enter</kbd>
          </div>
          <span className="font-mono text-[10px]">
            {filteredCommands.length} command{filteredCommands.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
};

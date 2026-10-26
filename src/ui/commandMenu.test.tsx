// src/ui/commandMenu.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommandMenu, type CommandItem } from './CommandMenu';
import { Type, Play } from 'lucide-react';

describe('CommandMenu Component (Detail 3)', () => {
  const dummyCommands: CommandItem[] = [
    {
      id: 'add-text',
      title: 'Add Text Layer',
      category: 'Tools',
      icon: Type,
      shortcut: ['T'],
      action: vi.fn(),
    },
    {
      id: 'play-pause',
      title: 'Toggle Playback',
      category: 'Playback',
      icon: Play,
      shortcut: ['Space'],
      action: vi.fn(),
    },
  ];

  it('renders command palette with search input and filtered commands', () => {
    const html = renderToStaticMarkup(
      <CommandMenu isOpen={true} onClose={vi.fn()} commands={dummyCommands} />
    );

    expect(html).toContain('Command Menu');
    expect(html).toContain('Type a command or search actions...');
    expect(html).toContain('Add Text Layer');
    expect(html).toContain('Toggle Playback');
    expect(html).toContain('Tools');
    expect(html).toContain('Playback');
  });

  it('returns null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <CommandMenu isOpen={false} onClose={vi.fn()} commands={dummyCommands} />
    );
    expect(html).toBe('');
  });
});

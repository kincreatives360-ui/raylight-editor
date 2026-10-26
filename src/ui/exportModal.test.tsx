// src/ui/exportModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExportModal } from './ExportModal';
import { createDefaultProject, createDefaultShot } from '../model/defaults';

describe('ExportModal Component', () => {
  const project = createDefaultProject();
  const activeShot = createDefaultShot({ id: 'shot-1', name: 'Intro Shot', startMs: 0, durationMs: 5000 });

  it('renders null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ExportModal
        isOpen={false}
        onClose={vi.fn()}
        exportSettings={{
          format: 'mp4',
          scope: 'entire',
          resolution: '1080p',
          fps: 30,
          quality: 'studio',
        }}
        setExportSettings={vi.fn()}
        exportMetrics={{
          width: 1920,
          height: 1080,
          estimatedSizeMb: '4.2',
          estimatedTimeSec: 6,
        }}
        project={project}
        activeShot={activeShot}
        exporting={false}
        exportProgressText=""
        exportPercent={0}
        exportError={null}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('renders export modal options, format buttons, and dimension metrics when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <ExportModal
        isOpen={true}
        onClose={vi.fn()}
        exportSettings={{
          format: 'mp4',
          scope: 'entire',
          resolution: '1080p',
          fps: 30,
          quality: 'studio',
        }}
        setExportSettings={vi.fn()}
        exportMetrics={{
          width: 1920,
          height: 1080,
          estimatedSizeMb: '4.2',
          estimatedTimeSec: 6,
        }}
        project={project}
        activeShot={activeShot}
        exporting={false}
        exportProgressText=""
        exportPercent={0}
        exportError={null}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
      />
    );

    expect(html).toContain('Export &amp; Share Video');
    expect(html).toContain('Animated GIF');
    expect(html).toContain('1920×1080px');
    expect(html).toContain('~4.2 MB');
    expect(html).toContain('~6s');
    expect(html).toContain('Made in Raylight Watermark');
  });

  it('renders progress bar and spinner during export', () => {
    const html = renderToStaticMarkup(
      <ExportModal
        isOpen={true}
        onClose={vi.fn()}
        exportSettings={{
          format: 'mp4',
          scope: 'entire',
          resolution: '1080p',
          fps: 30,
          quality: 'studio',
        }}
        setExportSettings={vi.fn()}
        exportMetrics={{
          width: 1920,
          height: 1080,
          estimatedSizeMb: '4.2',
          estimatedTimeSec: 6,
        }}
        project={project}
        activeShot={activeShot}
        exporting={true}
        exportProgressText="Rendering frame 45/150..."
        exportPercent={30}
        exportError={null}
        onStartExport={vi.fn()}
        onCancelExport={vi.fn()}
      />
    );

    expect(html).toContain('Rendering frame 45/150...');
    expect(html).toContain('30%');
    expect(html).toContain('Rendering...');
  });
});

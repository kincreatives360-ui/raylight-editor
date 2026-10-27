import type { SelectHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultImageLayer, createDefaultProject } from '../../model/defaults';
import { DEFAULT_DEVICE_FRAME_SETTINGS } from '../../model/deviceFrame';
import { useProjectStore } from '../../store/useProjectStore';
import { RightSidebar } from './RightSidebar';
import { DeviceFrameSection } from './sections/DeviceFrameSection';

// SSR uses Zustand's initial snapshot. Read the real loaded state for this rendering-only fixture.
vi.mock('../../store/useProjectStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/useProjectStore')>();
  const hook = (selector?: (state: ReturnType<typeof actual.useProjectStore.getState>) => unknown) =>
    selector ? selector(actual.useProjectStore.getState()) : actual.useProjectStore.getState();
  return { ...actual, useProjectStore: Object.assign(hook, actual.useProjectStore) };
});

describe('fixed device inspector dimensions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useProjectStore.getState().resetProject();
  });

  it('shows the actual body pixel dimensions on a portrait artboard', () => {
    const project = createDefaultProject();
    project.aspectRatio = '9:16';
    const layer = createDefaultImageLayer({
      size: { width: 0.7, height: 0.6 },
      deviceFrame: { ...DEFAULT_DEVICE_FRAME_SETTINGS, enabled: true },
    });
    project.shots[0].layers = [layer];
    useProjectStore.getState().loadProjectJson(project);
    const html = renderToStaticMarkup(<RightSidebar activeShot={project.shots[0]} selectedLayer={layer} selectedLayerIds={[layer.id]} onSwapImageClick={() => {}} onOpenExportModal={() => {}} />);
    const width = html.match(/aria-label="W" aria-valuenow="([^"]+)"/)?.[1];
    const height = html.match(/aria-label="H" aria-valuenow="([^"]+)"/)?.[1];
    expect(Number(width)).toBe(Math.round(1920 * 0.6 * 70.6 / 146.6));
    expect(Number(height)).toBe(1152);
  });

  it('renders registered hardware model options and does not flag supported devices as unavailable', () => {
    const layer = createDefaultImageLayer({
      deviceFrame: {
        ...DEFAULT_DEVICE_FRAME_SETTINGS,
        enabled: true,
        deviceId: 'macbook-pro-16',
      },
    });
    const html = renderToStaticMarkup(<DeviceFrameSection layer={layer} onChange={() => {}} projectAspect={16 / 9} />);
    expect(html).toContain('macbook-pro-16');
    expect(html).toContain('studio-display-27');
    expect(html).toContain('android-flagship');
    expect(html).not.toContain('This device is unavailable');
  });
});

// These fixtures inspect the configured option catalogs. Portal behavior is checked separately.
vi.mock('../../ui/FigmaSelect', () => ({
    FigmaSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

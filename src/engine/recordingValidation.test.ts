import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRecordedVideo } from './recordingValidation';

describe('validateRecordedVideo', () => {
  let origDocument: unknown;
  let origURL: unknown;

  beforeEach(() => {
    origDocument = (globalThis as unknown as { document?: unknown }).document;
    origURL = (globalThis as unknown as { URL?: unknown }).URL;
  });

  afterEach(() => {
    (globalThis as unknown as { document?: unknown }).document = origDocument;
    (globalThis as unknown as { URL?: unknown }).URL = origURL;
  });

  it('rejects immediately when blob is empty', async () => {
    const emptyBlob = { size: 0 } as Blob;
    await expect(validateRecordedVideo(emptyBlob)).rejects.toThrow(
      'Video export finished without any recorded data.'
    );
  });

  it('resolves when video successfully decodes a frame with positive dimensions', async () => {
    const fakeBlob = { size: 1024 } as Blob;
    const fakeVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
      muted: false,
      preload: '',
      src: '',
      onloadeddata: null as (() => void) | null,
      onerror: null as (() => void) | null,
      load: vi.fn(),
      removeAttribute: vi.fn(),
    };

    const mockCreateObjectURL = vi.fn(() => 'blob:mock-video-url');
    const mockRevokeObjectURL = vi.fn();
    (globalThis as unknown as { URL?: unknown }).URL = {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    };

    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => {
        setTimeout(() => {
          if (fakeVideo.onloadeddata) fakeVideo.onloadeddata();
        }, 5);
        return fakeVideo;
      }),
    };

    await expect(validateRecordedVideo(fakeBlob)).resolves.toBeUndefined();
    expect(mockCreateObjectURL).toHaveBeenCalledWith(fakeBlob);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-video-url');
  });

  it('rejects when video element reports an error', async () => {
    const fakeBlob = { size: 1024 } as Blob;
    const fakeVideo = {
      videoWidth: 0,
      videoHeight: 0,
      muted: false,
      preload: '',
      src: '',
      onloadeddata: null as (() => void) | null,
      onerror: null as (() => void) | null,
      load: vi.fn(),
      removeAttribute: vi.fn(),
    };

    (globalThis as unknown as { URL?: unknown }).URL = {
      createObjectURL: vi.fn(() => 'blob:mock-video-url'),
      revokeObjectURL: vi.fn(),
    };

    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn(() => {
        setTimeout(() => {
          if (fakeVideo.onerror) fakeVideo.onerror();
        }, 5);
        return fakeVideo;
      }),
    };

    await expect(validateRecordedVideo(fakeBlob)).rejects.toThrow(
      'Recorded video contains no decodable video frames.'
    );
  });
});

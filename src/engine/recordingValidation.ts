/** Decode an actual frame before offering a recording for download. A nonempty
 * Blob may contain only a muxer header when codec initialization failed. */
export async function validateRecordedVideo(blob: Blob): Promise<void> {
  if (!blob.size) throw new Error('Video export finished without any recorded data.');
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); video.onloadeddata = null; video.onerror = null; };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Recorded video did not decode a frame. Please retry the export.')); }, 15000);
      video.onloadeddata = () => {
        cleanup();
        if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
        else reject(new Error('Recorded video contains no decodable video frames.'));
      };
      video.onerror = () => { cleanup(); reject(new Error('Recorded video contains no decodable video frames. Please retry the export.')); };
      video.muted = true; video.preload = 'auto'; video.src = url; video.load();
    });
  } finally {
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}

/**
 * Checks whether WebCodecs is available for frame-by-frame encoding.
 */
export function isWebCodecsSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === 'function' &&
        typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame === 'function'
    );
}

/**
 * Checks whether MediaRecorder supports MP4 encoding.
 */
export function isMediaRecorderMp4Supported(): boolean {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false;
    return (
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.4d002a,mp4a.40.2') ||
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.4d002a') ||
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E') ||
        MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ||
        MediaRecorder.isTypeSupported('video/mp4')
    );
}

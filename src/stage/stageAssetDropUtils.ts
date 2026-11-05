export const computeFittedImageDimensions = (
    assetWidth: number | undefined,
    assetHeight: number | undefined,
    frameWidth: number,
    frameHeight: number
) => {
    const assetAspect = (assetWidth || 1920) / (assetHeight || 1080);
    const frameAspect = frameWidth / frameHeight;
    let width = 0.55;
    let height = (width * frameAspect) / assetAspect;
    if (height > 0.8) {
        height = 0.8;
        width = (height * assetAspect) / frameAspect;
    }
    return { width: Number(width.toFixed(3)), height: Number(height.toFixed(3)) };
};

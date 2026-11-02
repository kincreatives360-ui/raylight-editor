import { expect, test } from '@playwright/test';

test('adding a shape keeps the WebGL stage rendering', async ({ page }) => {
    test.setTimeout(90_000);

    const referenceErrors: string[] = [];
    page.on('pageerror', (error) => {
        if (error.name === 'ReferenceError') referenceErrors.push(error.message);
    });

    await page.goto('/');
    const canvas = page.locator('#raylight-stage-webgl-canvas canvas');
    await expect(canvas).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: 'Add blank shot, layer, or camera' }).click();
    await page.getByText('+ Rectangle Shape', { exact: true }).click();
    await expect(canvas).toBeVisible();
    await expect(page.getByText('Rectangle 1', { exact: true })).toBeVisible();

    const expectVisibleRender = () =>
        expect
            .poll(
                () =>
                    canvas.evaluate((element) => {
                        const gl = element.getContext('webgl2') ?? element.getContext('webgl');
                        if (!gl) return 0;

                        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                        gl.readPixels(
                            0,
                            0,
                            gl.drawingBufferWidth,
                            gl.drawingBufferHeight,
                            gl.RGBA,
                            gl.UNSIGNED_BYTE,
                            pixels
                        );

                        let visiblePixels = 0;
                        for (let i = 0; i < pixels.length; i += 4) {
                            if (pixels[i + 3] > 16 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 80) {
                                visiblePixels += 1;
                            }
                        }
                        return visiblePixels;
                    }),
                { timeout: 15_000 }
            )
            .toBeGreaterThan(100);

    await expectVisibleRender();

    const lostContext = await canvas.evaluate((element) => {
        const gl = element.getContext('webgl2') ?? element.getContext('webgl');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (!extension) return false;
        (window as Window & { restoreStageWebGLContext?: () => void }).restoreStageWebGLContext = () =>
            extension.restoreContext();
        extension.loseContext();
        return true;
    });
    expect(lostContext).toBe(true);
    await expect
        .poll(() => canvas.evaluate((element) => element.getContext('webgl2')?.isContextLost() ?? false), {
            timeout: 10_000,
        })
        .toBe(true);

    const requestedRestore = await page.evaluate(() => {
        const restore = (window as Window & { restoreStageWebGLContext?: () => void }).restoreStageWebGLContext;
        if (!restore) return false;
        restore();
        delete (window as Window & { restoreStageWebGLContext?: () => void }).restoreStageWebGLContext;
        return true;
    });
    expect(requestedRestore).toBe(true);
    await expect
        .poll(() => canvas.evaluate((element) => !(element.getContext('webgl2')?.isContextLost() ?? true)), {
            timeout: 15_000,
        })
        .toBe(true);
    await expectVisibleRender();

    expect(referenceErrors).toEqual([]);
});

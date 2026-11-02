import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: './.playwright/test-results',
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4179',
        browserName: 'chromium',
        launchOptions: {
            args: ['--use-gl=angle', '--use-angle=swiftshader'],
        },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort',
        url: 'http://127.0.0.1:4179',
        reuseExistingServer: false,
        timeout: 120_000,
    },
});

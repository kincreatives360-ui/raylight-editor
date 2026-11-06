#!/usr/bin/env node
/**
 * Minimal multi-viewport screenshot + optional pixel diff.
 * Usage:
 *   node visual_diff.js <url> <outDir> [--widths 375,768,1440] [--storage-state auth.json]
 *   node visual_diff.js --diff before.png after.png [--threshold 0.1] [--out diff.png]
 *
 * For real pixelmatch you need: npm i pixelmatch pngjs
 * Without it, only captures screenshots.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDiff = args[0] === '--diff';

if (isDiff) {
  const before = args[1], after = args[2];
  const out = (() => { const i = args.indexOf('--out'); return i > -1 ? args[i+1] : 'diff.png'; })();
  const thr = (() => { const i = args.indexOf('--threshold'); return i > -1 ? +args[i+1] : 0.1; })();
  let PNG, pixelmatch;
  try {
    PNG = require('pngjs').PNG;
    pixelmatch = require('pixelmatch');
  } catch (e) {
    console.error('pixelmatch/pngjs not installed. Run: npm i pixelmatch pngjs');
    console.error(e.message);
    process.exit(1);
  }

  try {
    const img1 = PNG.sync.read(fs.readFileSync(before));
    const img2 = PNG.sync.read(fs.readFileSync(after));
    if (img1.width !== img2.width || img1.height !== img2.height) {
      console.error(`Image dimension mismatch: ${before} is ${img1.width}x${img1.height}, but ${after} is ${img2.width}x${img2.height}`);
      process.exit(1);
    }
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    const n = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: thr });
    fs.writeFileSync(out, PNG.sync.write(diff));
    console.log(`Diff pixels: ${n} / ${width*height} (${(100*n/(width*height)).toFixed(2)}%) → ${out}`);
  } catch (e) {
    console.error('Diff error:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

const url = args[0], outDir = args[1];
if (!url || !outDir) {
  console.error('usage: node visual_diff.js <url> <outDir> [--widths 375,768,1440] ...');
  process.exit(1);
}
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > -1 ? args[i+1] : d; };
const widths = (opt('widths', '375,768,1440')).split(',').map(Number);
const ss = opt('storage-state');
const height = +opt('height', 900);

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright required'); process.exit(1); }

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const w of widths) {
    const ctxOpts = { viewport: { width: w, height }, deviceScaleFactor: 1 };
    if (ss) ctxOpts.storageState = ss;
    const context = await browser.newContext(ctxOpts);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.warn(e.message));
    await page.waitForTimeout(1200);
    const file = path.join(outDir, `vp-${w}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log('wrote', file);
    await context.close();
  }
  await browser.close();
})();

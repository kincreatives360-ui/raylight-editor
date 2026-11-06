#!/usr/bin/env node
/**
 * Accessibility tree + keyboard tab-order walker.
 * Usage: node a11y_walk.cjs <url> <outDir> [--storage-state auth.json] [--steps steps.json] [--max 400]
 *
 * Writes:
 *   a11y-tree.json   simplified accessibility snapshot (role, name, value, states)
 *   tab-order.json   sequential tab stops with selectors and roles
 *   a11y-digest.md   human-readable summary
 */
const fs = require('fs');
const path = require('path');
const { runSteps } = require('./lib/steps.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { try { ({ chromium } = require('playwright-core')); } catch (e2) {
  console.error('Playwright required'); process.exit(1); } }

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node a11y_walk.cjs <url> <outDir> [--storage-state auth.json] [--steps steps.json] [--max 400] [--headless new|false]');
  console.log('');
  console.log('Writes:');
  console.log('  a11y-tree.json   simplified accessibility snapshot (role, name, value, states)');
  console.log('  tab-order.json   sequential tab stops with selectors and roles');
  console.log('  a11y-digest.md   human-readable summary');
  process.exit(0);
}
const url = args[0], outDir = args[1];
if (!url || !outDir) { console.error('usage: node a11y_walk.cjs <url> <outDir> [options]'); process.exit(1); }
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : d; };
const flag = (n) => args.includes('--' + n);
const max = +opt('max', 400);
const stepsFile = opt('steps', null);
const headless = flag('headless') ? (opt('headless', 'new') === 'false' ? false : opt('headless', 'new')) : true;
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless });
  const ctxOpts = { viewport: { width: 1440, height: 900 } };
  if (opt('storage-state')) ctxOpts.storageState = opt('storage-state');
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.warn(e.message));
  await page.waitForTimeout(1000);
  if (stepsFile) {
    await runSteps(page, JSON.parse(fs.readFileSync(stepsFile, 'utf8')));
    await page.waitForTimeout(500);
  }

  // Accessibility snapshot via supported Playwright representation
  let snap = null;
  let ariaSnapshotYaml = null;
  try {
    if (typeof page.locator === 'function') {
      ariaSnapshotYaml = await page.locator(':root').ariaSnapshot().catch(() => null);
      if (ariaSnapshotYaml) {
        snap = { ariaSnapshot: ariaSnapshotYaml };
      }
    }
    if (!snap && page.accessibility && typeof page.accessibility.snapshot === 'function') {
      snap = await page.accessibility.snapshot({ interestingOnly: false }).catch(() => null);
    }
  } catch (e) {
    snap = null;
  }
  fs.writeFileSync(path.join(outDir, 'a11y-tree.json'), JSON.stringify(snap || {}, null, 2));

  // Tab order by walking focus
  const tabOrder = await page.evaluate(async (maxN) => {
    const out = [];
    const seen = new Set();
    // start from body
    document.body.focus?.();
    let prev = null;
    for (let i = 0; i < maxN; i++) {
      // simulate Tab
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) {
        // force first focusable
        const first = document.querySelector('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (first) first.focus();
      }
      const el = document.activeElement;
      if (!el || el === document.body) break;
      const key = el;
      if (seen.has(key) && out.length > 3) break; // looped
      seen.add(key);
      const r = el.getBoundingClientRect();
      out.push({
        index: out.length,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || el.getAttribute('aria-role') || null,
        name: el.getAttribute('aria-label') || el.getAttribute('name') || (el.innerText || '').trim().slice(0, 60) || el.getAttribute('placeholder') || null,
        id: el.id || null,
        type: el.getAttribute('type'),
        tabIndex: el.tabIndex,
        href: el.getAttribute('href')?.slice(0, 80) || null,
        bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      });
      // dispatch Tab
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true }));
      // actual focus move via browser is better with Playwright keyboard, so we return and let outer do it
      break; // we'll do sequential in outer loop
    }
    return out;
  }, max);

  // Better tab order using Playwright keyboard
  const order = [];
  const seenSel = new Set();
  await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(30);
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const r = el.getBoundingClientRect();
      // build a rough selector
      let sel = el.tagName.toLowerCase();
      if (el.id) sel = '#' + CSS.escape(el.id);
      else if (el.getAttribute('name')) sel += `[name="${el.getAttribute('name')}"]`;
      else if (el.className && typeof el.className === 'string') {
        const c = el.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (c) sel += '.' + c;
      }
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        name: (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText || el.innerText || el.value || el.getAttribute('placeholder') || '').toString().trim().slice(0, 80),
        id: el.id || null,
        type: el.type || null,
        tabIndex: el.tabIndex,
        selectorHint: sel,
        bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      };
    });
    if (!info) break;
    const key = info.selectorHint + '|' + info.name;
    if (seenSel.has(key) && order.length > 5) break;
    seenSel.add(key);
    order.push({ index: order.length, ...info });
  }

  fs.writeFileSync(path.join(outDir, 'tab-order.json'), JSON.stringify(order, null, 2));

  // Digest
  const roles = {};
  if (ariaSnapshotYaml) {
    const roleMatches = ariaSnapshotYaml.matchAll(/^\s*-\s+([a-zA-Z0-9_-]+)/gm);
    for (const m of roleMatches) {
      const r = m[1];
      roles[r] = (roles[r] || 0) + 1;
    }
  } else {
    function walk(n) {
      if (!n) return;
      const r = n.role || 'none';
      roles[r] = (roles[r] || 0) + 1;
      (n.children || []).forEach(walk);
    }
    walk(snap);
  }
  const md = [
    `# A11y walk: ${url}`,
    ``,
    `## Role counts (accessibility snapshot)`,
    ...Object.entries(roles).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `- ${k}: ${v}`),
    ``,
    `## Tab order (${order.length} stops)`,
    ...order.slice(0, 60).map(o => `${o.index}. \`${o.selectorHint}\` role=${o.role||'-'} name="${(o.name||'').slice(0,40)}" `),
    order.length > 60 ? `... and ${order.length-60} more` : '',
    ``,
    `Files: a11y-tree.json, tab-order.json`
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'a11y-digest.md'), md);
  console.log('Wrote a11y-tree.json, tab-order.json, a11y-digest.md');
  console.log(`Roles: ${Object.keys(roles).length}, Tab stops: ${order.length}`);
  await browser.close();
})();

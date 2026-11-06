#!/usr/bin/env node
/**
 * Control sweep: operates every interactive element and records what happens.
 *
 * Usage:
 *   node interaction_sweep.cjs <url> <outDir> [--width 1440] [--height 900] [--limit 300]
 *        [--scope "<css selector>"] [--shots] [--no-reload] [--fuzz-inputs] [--allow-destructive] [--storage-state auth.json]
 *        [--steps steps.json]   run pre-actions before the sweep (reach a specific app state)
 *
 * For each interactive element (visible, enabled):
 *   - captures resting style, then hover style diff, focus-visible diff, tooltip appearance
 *   - clicks (or types for inputs), waits, and records: URL change, DOM mutations (added/removed,
 *     dialogs/menus/popovers), network requests, focus move, console errors, downloads, popups
 *   - resets (Escape, then reload if state changed) so each control is tested from the same start
 *
 * Output: interactions.json, coverage.json (and C-###.png when --shots).
 * Destructive-looking controls (delete, pay, sign out...) are skipped unless --allow-destructive.
 * This does NOT replace manual testing of drag, resize, canvas, right-click and multi-step flows.
 */
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { try { ({ chromium } = require('playwright-core')); } catch (e2) { console.error('Playwright not found. npm i playwright && npx playwright install chromium'); process.exit(1); } }

const args = process.argv.slice(2);
const url = args[0], outDir = args[1];
if (!url || !outDir) { console.error('usage: node interaction_sweep.cjs <url> <outDir> [options]'); process.exit(1); }
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : d; };
const flag = (n) => args.includes('--' + n);
const width = +opt('width', 1440), height = +opt('height', 900), limit = +opt('limit', 300);
const scopeSel = opt('scope', null);
const stepsFile = opt('steps', null);
const shots = flag('shots'), noReload = flag('no-reload'), fuzz = flag('fuzz-inputs'), allowDestructive = flag('allow-destructive');

async function runSteps(page, steps) {
  for (const s of steps) {
    const action = (s.action || s.type || '').toLowerCase();
    const sel = s.selector || s.sel;
    const val = s.value ?? s.text ?? s.key ?? '';
    const ms = s.ms || s.wait || 500;
    try {
      if (action === 'wait' || action === 'timeout') await page.waitForTimeout(+ms);
      else if (action === 'click') await page.click(sel, { timeout: 10000 });
      else if (action === 'dblclick') await page.dblclick(sel, { timeout: 10000 });
      else if (action === 'type' || action === 'fill') await page.fill(sel, String(val));
      else if (action === 'press' || action === 'key') await page.keyboard.press(String(val || s.key));
      else if (action === 'hover') await page.hover(sel);
      else if (action === 'select') await page.selectOption(sel, val);
      else if (action === 'goto') await page.goto(val || s.url, { waitUntil: 'networkidle', timeout: 45000 });
      else if (action === 'scroll') await page.evaluate((y) => window.scrollBy(0, y || 800), +val || 800);
      else console.warn('unknown step action:', action);
      if (s.pause) await page.waitForTimeout(+s.pause);
    } catch (e) {
      console.warn('step failed:', action, sel || val, e.message);
      if (s.required) throw e;
    }
  }
}

fs.mkdirSync(outDir, { recursive: true });

const DESTRUCTIVE = /(delete|remove|destroy|erase|reset all|clear all|sign ?out|log ?out|logout|unsubscribe|cancel (plan|subscription)|pay\b|purchase|buy now|place order|checkout|confirm payment|deactivate|close account|send\b|publish|submit order)/i;
const WATCH = ['color','backgroundColor','borderColor','boxShadow','transform','opacity','outlineColor','outlineWidth','outlineStyle','textDecorationLine','filter','cursor','width','height','fontWeight'];

async function collect(page) {
  return page.evaluate((scopeSel) => {
    const scopeEl = scopeSel ? document.querySelector(scopeSel) : null;
    if (scopeSel && !scopeEl) return [];
    const SEL = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=radio],[role=switch],[role=slider],[role=combobox],[role=treeitem],[contenteditable=true],[tabindex]:not([tabindex="-1"])';
    const seen = new Set(); const out = [];
    const sel = (el) => {
      if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
      const parts = []; let n = el;
      while (n && n.nodeType === 1 && n !== document.documentElement && parts.length < 12) {
        let s = n.tagName.toLowerCase(); const p = n.parentElement;
        if (p) { const same = [...p.children].filter(c => c.tagName === n.tagName); if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')'; }
        parts.unshift(s); n = p;
      }
      return parts.join(' > ');
    };
    const consider = (el) => {
      if (seen.has(el)) return; seen.add(el);
      if (scopeEl && !scopeEl.contains(el)) return;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      out.push({ selector: sel(el), tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), role: el.getAttribute('role'),
        name: (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        href: el.getAttribute('href'), visible, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
        bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
    };
    document.querySelectorAll(SEL).forEach(consider);
    document.querySelectorAll('div,span,li,img,svg,p').forEach(el => { if (!seen.has(el) && getComputedStyle(el).cursor === 'pointer') { const hasInteractiveAncestor = el.closest(SEL); if (!hasInteractiveAncestor) consider(el); } });
    return out;
  }, scopeSel);
}

(async () => {
  const browser = await chromium.launch();
  const ctxOpts = { viewport: { width, height }, acceptDownloads: true };
  if (opt('storage-state')) ctxOpts.storageState = opt('storage-state');
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const reqs = []; const errors = [];
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), type: r.resourceType() }));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  let downloads = []; page.on('download', (d) => downloads.push(d.suggestedFilename()));
  let popups = []; context.on('page', (p) => { if (p !== page) { popups.push(p.url()); p.close().catch(() => {}); } });

  const load = async () => { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {}); await page.waitForTimeout(500); };
  await load();
  if (stepsFile) {
    const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
    console.log('Running', steps.length, 'pre-steps from', stepsFile);
    await runSteps(page, steps);
    await page.waitForTimeout(600);
  }
  const controls = await collect(page);
  console.log(`found ${controls.length} candidate controls (${controls.filter(c => c.visible).length} visible)`);

  const results = []; let idx = 0;
  for (const c of controls.slice(0, limit)) {
    idx++;
    const id = 'C-' + String(idx).padStart(3, '0');
    const rec = { id, ...c, status: 'pending' };
    if (!c.visible) { rec.status = 'skipped: not visible in default state'; results.push(rec); continue; }
    if (c.disabled) { rec.status = 'recorded: disabled in default state'; results.push(rec); continue; }
    if (!allowDestructive && DESTRUCTIVE.test(c.name)) { rec.status = 'skipped: destructive-looking (use --allow-destructive on a test account)'; results.push(rec); continue; }
    const loc = page.locator(c.selector).first();
    try {
      if (!(await loc.count())) { rec.status = 'skipped: selector no longer matches'; results.push(rec); continue; }
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      const startUrl = page.url();
      const rest = await loc.evaluate((el, W) => { const cs = getComputedStyle(el); const o = {}; W.forEach(p => o[p] = cs[p]); return o; }, WATCH);
      await page.evaluate(() => {
        window.__reMut = { added: [], removed: 0, attrs: [] };
        window.__reObs && window.__reObs.disconnect();
        window.__reObs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'attributes' && window.__reMut.attrs.length < 15) { window.__reMut.attrs.push({ tag: m.target.tagName.toLowerCase(), attr: m.attributeName, value: String(m.target.getAttribute(m.attributeName)).slice(0, 80) }); } m.addedNodes.forEach(n => { if (n.nodeType === 1 && window.__reMut.added.length < 15) { const r = n.getBoundingClientRect(); window.__reMut.added.push({ tag: n.tagName.toLowerCase(), role: n.getAttribute('role'), cls: (n.className && n.className.toString().slice(0, 60)) || '', text: (n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80), bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }); } }); window.__reMut.removed += m.removedNodes.length; } });
        window.__reObs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      });
      reqs.length = 0; errors.length = 0; downloads = []; popups = [];

      // hover
      await loc.hover({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(650);
      const hov = await loc.evaluate((el, W) => { const cs = getComputedStyle(el); const o = {}; W.forEach(p => o[p] = cs[p]); return o; }, WATCH).catch(() => null);
      rec.hoverDiff = hov ? Object.fromEntries(Object.entries(hov).filter(([k, v]) => v !== rest[k]).map(([k, v]) => [k, { from: rest[k], to: v }])) : null;
      rec.tooltip = await page.evaluate(() => { const t = document.querySelector('[role=tooltip]'); return t ? (t.innerText || '').trim().slice(0, 100) : null; });
      const mutAfterHover = await page.evaluate(() => { const n = window.__reMut.added.length; window.__reMut.attrs = []; window.__reMut.removed = 0; return n; });

      // focus-visible via keyboard
      await loc.focus({ timeout: 1000 }).catch(() => {});
      await page.keyboard.press('Shift+Tab').catch(() => {}); await page.keyboard.press('Tab').catch(() => {});
      const foc = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); return { focusedIsSelf: document.activeElement === el, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, boxShadow: cs.boxShadow, matchesFocusVisible: el.matches(':focus-visible') }; }, c.selector).catch(() => null);
      rec.focus = foc;

      // act
      const tag = c.tag, type = (c.type || '').toLowerCase();
      if ((tag === 'input' && !['button','submit','reset','checkbox','radio','file','image'].includes(type)) || tag === 'textarea') {
        rec.action = 'type';
        const samples = fuzz ? ['', 'a', 'Test value 123', 'x'.repeat(300), '<b>html</b>', '😀 unicode', '-1', '999999999999'] : ['Test value 123'];
        rec.inputAttrs = await loc.evaluate((el) => ({ required: el.required, pattern: el.pattern, maxLength: el.maxLength, min: el.min, max: el.max, step: el.step, autocomplete: el.autocomplete, inputMode: el.inputMode }));
        rec.typed = [];
        for (const s of samples) {
          await loc.fill(s, { timeout: 2000 }).catch(() => {});
          await loc.press('Enter', { timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(250);
          const v = await loc.evaluate((el) => ({ valid: el.checkValidity ? el.checkValidity() : null, message: el.validationMessage || null, value: (el.value || '').slice(0, 60) })).catch(() => null);
          rec.typed.push({ input: s.slice(0, 40), result: v });
        }
      } else if (tag === 'select') {
        rec.action = 'select';
        rec.options = await loc.evaluate((el) => [...el.options].map(o => o.text.trim()).slice(0, 30));
        if (rec.options.length > 1) await loc.selectOption({ index: 1 }, { timeout: 2000 }).catch(() => {});
      } else {
        rec.action = 'click';
        await loc.click({ timeout: 2500, trial: false }).catch((e) => { rec.clickError = e.message.split('\n')[0]; });
      }
      await page.waitForTimeout(500);

      // observe
      rec.urlChanged = page.url() !== startUrl ? page.url() : null;
      const mut = await page.evaluate(() => ({ ...window.__reMut, dialogs: [...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open],[role=menu],[role=listbox],[role=alertdialog],[data-radix-popper-content-wrapper],[role=tooltip]')].filter(d => { const r = d.getBoundingClientRect(); const cs = getComputedStyle(d); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }).map(d => ({ role: d.getAttribute('role') || d.tagName.toLowerCase(), text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100) })), activeEl: document.activeElement ? (document.activeElement.tagName.toLowerCase() + (document.activeElement.id ? '#' + document.activeElement.id : '')) : null, expanded: null }));
      rec.domAdded = mut.added; rec.domRemovedCount = mut.removed; rec.attributeChanges = mut.attrs; rec.overlays = mut.dialogs; rec.focusAfter = mut.activeEl;
      rec.afterAriaExpanded = await loc.getAttribute('aria-expanded').catch(() => null);
      rec.afterAriaPressed = await loc.getAttribute('aria-pressed').catch(() => null);
      rec.afterDataState = await loc.getAttribute('data-state').catch(() => null);
      rec.network = reqs.filter(r => !/\.(png|jpg|jpeg|svg|gif|webp|woff2?|css|ico)(\?|$)/i.test(r.url)).slice(0, 10);
      rec.consoleErrors = errors.slice(0, 5); rec.downloads = downloads.slice(); rec.popups = popups.slice();
      rec.hoverCausedDom = mutAfterHover > 0;
      if (shots) await page.screenshot({ path: path.join(outDir, id + '.png') });
      rec.status = 'swept';

      // reset
      await page.keyboard.press('Escape').catch(() => {});
      const changed = rec.urlChanged || rec.domAdded.length || rec.domRemovedCount || (rec.attributeChanges && rec.attributeChanges.length) || rec.afterAriaPressed !== null;
      if (!noReload && changed) { await load(); }
    } catch (e) { rec.status = 'error: ' + e.message.split('\n')[0]; await load(); }
    results.push(rec);
    if (idx % 10 === 0) console.log(`  swept ${idx}/${Math.min(controls.length, limit)}`);
  }

  fs.writeFileSync(path.join(outDir, 'interactions.json'), JSON.stringify(results, null, 2));
  const by = (p) => results.filter(r => r.status.startsWith(p)).length;
  const cov = { total: controls.length, swept: by('swept'), skippedNotVisible: by('skipped: not visible'), skippedDestructive: by('skipped: destructive'), disabled: by('recorded: disabled'), errors: by('error'), note: 'Items skipped here must be covered manually (open menus/dialogs first, then re-sweep, or use another auth state).' };
  fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(cov, null, 2));
  await browser.close();
  console.log('coverage:', JSON.stringify(cov));
  console.log('output:', outDir);
})().catch((e) => { console.error(e); process.exit(1); });

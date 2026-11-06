#!/usr/bin/env node
/**
 * DOM + style + network inventory of a live page (Playwright).
 *
 * Usage:
 *   node dom_inventory.cjs <url> <outDir> [--width 1440] [--height 900] [--wait 1500]
 *        [--max-nodes 6000] [--scroll] [--storage-state auth.json] [--dark]
 *        [--root "<css selector>"] [--max-depth N]   (scope the walk to one feature subtree)
 *        [--steps steps.json]   run pre-actions before inventory (click/type/wait/key/select/hover)
 *        [--shot-at <ms>]       extra full-page screenshot after N ms (for motion apps)
 *
 * Writes to <outDir>:
 *   inventory.json   tree of nodes (path, tag, role, text, bbox, style ids, interactive flag, listeners),
 *                    deduped computed-style table, pseudo elements, shadow roots, iframes
 *   interactive.json flat list of interactive elements with selectors
 *   network.json     every request (url, method, type, status, content-type, size)
 *   console.json     console messages and page errors
 *   css-vars.json    custom properties found in stylesheets
 *   fonts.json       document.fonts and font file requests
 *   globals.json     detected framework/library globals and storage keys
 *   rendered.html    serialized DOM after load
 *   screenshot.png   viewport + full-page screenshot
 *   css/             raw stylesheet bodies
 */
const fs = require('fs');
const path = require('path');
const { runSteps } = require('./lib/steps.cjs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { try { ({ chromium } = require('playwright-core')); } catch (e2) {
  console.error('Playwright not found. Run: npm i playwright && npx playwright install chromium'); process.exit(1); } }

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node dom_inventory.cjs <url> <outDir> [--width 1440] [--height 900] [--wait 1500]');
  console.log('       [--max-nodes 6000] [--scroll] [--storage-state auth.json] [--dark]');
  console.log('       [--root "<css selector>"] [--max-depth N]   (scope the walk to one feature subtree)');
  console.log('       [--steps steps.json]   run pre-actions before inventory (click/type/wait/key/select/hover)');
  console.log('       [--shot-at <ms>]       extra full-page screenshot after N ms (for motion apps)');
  console.log('       [--headless new|false]');
  console.log('');
  console.log('Writes to <outDir>:');
  console.log('  inventory.json   tree of nodes (path, tag, role, text, bbox, style ids, interactive flag, listeners),');
  console.log('                   deduped computed-style table, pseudo elements, shadow roots, iframes');
  console.log('  interactive.json flat list of interactive elements with selectors');
  console.log('  network.json     every request (url, method, type, status, content-type, size)');
  console.log('  console.json     console messages and page errors');
  console.log('  css-vars.json    custom properties found in stylesheets');
  console.log('  fonts.json       document.fonts and font file requests');
  console.log('  globals.json     detected framework/library globals and storage keys');
  console.log('  rendered.html    serialized DOM after load');
  console.log('  screenshot.png   viewport + full-page screenshot');
  console.log('  css/             raw stylesheet bodies');
  process.exit(0);
}
const url = args[0];
const outDir = args[1];
if (!url || !outDir) { console.error('usage: node dom_inventory.cjs <url> <outDir> [options]'); process.exit(1); }
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : d; };
const flag = (n) => args.includes('--' + n);
const width = +opt('width', 1440), height = +opt('height', 900);
const waitMs = +opt('wait', 1500), maxNodes = +opt('max-nodes', 6000);
const rootSel = opt('root', null), maxDepth = +opt('max-depth', 999);
const stepsFile = opt('steps', null);
const shotAt = opt('shot-at', null);
const isHeadlessNew = flag('headless') && opt('headless', 'new') === 'new';
const isHeadlessFalse = flag('headless') && opt('headless', 'new') === 'false';
const headless = !isHeadlessFalse;
fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });

const STYLE_PROPS = [
  'display','position','top','right','bottom','left','zIndex','float','boxSizing',
  'flexDirection','flexWrap','flexGrow','flexShrink','flexBasis','justifyContent','alignItems','alignSelf','alignContent','gap','rowGap','columnGap','order',
  'gridTemplateColumns','gridTemplateRows','gridColumn','gridRow','gridAutoFlow',
  'width','height','minWidth','maxWidth','minHeight','maxHeight','aspectRatio',
  'marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft',
  'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopStyle','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor',
  'borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius',
  'outlineWidth','outlineStyle','outlineColor','outlineOffset',
  'color','backgroundColor','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat',
  'opacity','boxShadow','filter','backdropFilter','mixBlendMode','transform','transformOrigin','clipPath','mask',
  'overflowX','overflowY','overscrollBehavior','scrollbarWidth','visibility',
  'fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','textTransform','textDecorationLine','textOverflow','whiteSpace','wordBreak','fontVariantNumeric','textShadow',
  'cursor','pointerEvents','userSelect','resize','objectFit','objectPosition','listStyleType',
  'transitionProperty','transitionDuration','transitionTimingFunction','transitionDelay',
  'animationName','animationDuration','animationTimingFunction','animationDelay','animationIterationCount','animationDirection','animationFillMode',
  'willChange','contain','isolation'
];

(async () => {
  const launchOptions = { headless };
  if (isHeadlessNew) launchOptions.channel = 'chromium';
  const browser = await chromium.launch(launchOptions);
  const ctxOpts = { viewport: { width, height }, deviceScaleFactor: 1 };
  const ss = opt('storage-state');
  if (ss) ctxOpts.storageState = ss;
  if (flag('dark')) ctxOpts.colorScheme = 'dark';
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();

  // listener + context logging, installed before any page script runs
  await page.addInitScript(() => {
    window.__reListeners = new WeakMap();
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, o) {
      try {
        if (this instanceof Element) {
          const s = window.__reListeners.get(this) || new Set();
          s.add(type); window.__reListeners.set(this, s);
        }
      } catch (e) {}
      return orig.call(this, type, fn, o);
    };
    window.__reCtx = [];
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...r) {
      try { window.__reCtx.push(String(t)); } catch (e) {}
      return gc.call(this, t, ...r);
    };
    window.__reWasm = 0;
    if (window.WebAssembly) {
      for (const k of ['instantiate', 'instantiateStreaming']) {
        const f = WebAssembly[k];
        if (f) WebAssembly[k] = function (...a) { window.__reWasm++; return f.apply(this, a); };
      }
    }
  });

  const network = [], consoleLog = [], cssBodies = [];
  page.on('response', async (res) => {
    const req = res.request();
    const rec = { url: res.url(), method: req.method(), type: req.resourceType(), status: res.status(),
      contentType: (res.headers()['content-type'] || ''), size: +(res.headers()['content-length'] || 0) };
    if (req.postData() && req.method() !== 'GET') { const pd = req.postData(); rec.postData = pd.length > 2000 ? pd.slice(0, 2000) + '...' : pd; }
    network.push(rec);
    if (req.resourceType() === 'stylesheet') {
      try { cssBodies.push({ url: res.url(), body: await res.text() }); } catch (e) {}
    }
  });
  page.on('websocket', (ws) => network.push({ url: ws.url(), method: 'WS', type: 'websocket', status: 101 }));
  page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text().slice(0, 500) }));
  page.on('pageerror', (e) => consoleLog.push({ type: 'pageerror', text: String(e).slice(0, 500) }));

  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); }
  catch (e) { console.error('goto warning:', e.message); }
  await page.waitForTimeout(waitMs);

  if (stepsFile) {
    const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
    console.log('Running', steps.length, 'pre-steps from', stepsFile);
    await runSteps(page, steps);
    await page.waitForTimeout(500);
  }
  if (shotAt) {
    await page.waitForTimeout(+shotAt);
    await page.screenshot({ path: path.join(outDir, 'screenshot-motion.png'), fullPage: true });
  }

  if (flag('scroll')) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
  }

  const data = await page.evaluate(({ STYLE_PROPS, maxNodes, rootSel, maxDepth }) => {
    const styleTable = {}; let styleCount = 0; const styleIds = new Map();
    const interactive = []; let nodeCount = 0;
    const INTERACTIVE_TAGS = new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','DETAILS','LABEL','OPTION']);
    const INTERACTIVE_ROLES = /^(button|link|tab|menuitem|menuitemcheckbox|menuitemradio|option|checkbox|radio|switch|slider|combobox|textbox|searchbox|treeitem|gridcell|spinbutton|listbox|menu|dialog|tooltip)$/;

    function styleId(cs) {
      const o = {}; for (const p of STYLE_PROPS) o[p] = cs[p];
      const key = JSON.stringify(o);
      if (!styleIds.has(key)) { const id = 's' + (++styleCount); styleIds.set(key, id); styleTable[id] = o; }
      return styleIds.get(key);
    }
    function selectorFor(el) {
      if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
      const parts = []; let n = el;
      while (n && n.nodeType === 1 && n !== document.documentElement) {
        let s = n.tagName.toLowerCase();
        const p = n.parentElement;
        if (p) { const same = [...p.children].filter(c => c.tagName === n.tagName); if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')'; }
        parts.unshift(s); n = p;
        if (parts.length > 12) break;
      }
      return parts.join(' > ');
    }
    function ownText(el) {
      let t = ''; for (const c of el.childNodes) if (c.nodeType === 3) t += c.textContent;
      return t.replace(/\s+/g, ' ').trim().slice(0, 120);
    }
    function pseudo(el, which) {
      const cs = getComputedStyle(el, which);
      if (!cs || cs.content === 'none' || cs.content === 'normal' || cs.content === '""' && cs.display === 'none') return null;
      return { content: cs.content, styleId: styleId(cs) };
    }
    function isInteractive(el, cs) {
      const role = el.getAttribute('role');
      if (INTERACTIVE_TAGS.has(el.tagName) && !(el.tagName === 'A' && !el.hasAttribute('href'))) return 'tag';
      if (role && INTERACTIVE_ROLES.test(role)) return 'role';
      if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return 'tabindex';
      if (el.isContentEditable && el.getAttribute('contenteditable') !== null) return 'contenteditable';
      if (el.hasAttribute('onclick')) return 'onclick';
      if (el.draggable) return 'draggable';
      if (cs.cursor === 'pointer') return 'cursor';
      const ls = window.__reListeners && window.__reListeners.get(el);
      if (ls && [...ls].some(t => /^(click|pointerdown|mousedown|keydown|dblclick|contextmenu|touchstart|dragstart)$/.test(t))) return 'listener';
      return null;
    }
    function walk(el, depth, pathStr) {
      if (nodeCount >= maxNodes) return null;
      nodeCount++;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const attrs = {}; const data = {}; const aria = {};
      for (const a of el.attributes) {
        if (a.name.startsWith('data-')) data[a.name] = a.value.slice(0, 80);
        else if (a.name.startsWith('aria-')) aria[a.name] = a.value.slice(0, 80);
        else if (['id','class','role','type','href','src','alt','title','placeholder','name','value','for','tabindex','disabled','checked','required','pattern','maxlength','min','max','step','target','rel','contenteditable','draggable','lang','dir'].includes(a.name)) attrs[a.name] = a.value.slice(0, 160);
      }
      const node = {
        path: pathStr, tag: el.tagName.toLowerCase(), attrs, aria, data,
        text: ownText(el),
        bbox: [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10],
        styleId: styleId(cs),
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
        scrollable: (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(cs.overflowY)) || (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(cs.overflowX)) || undefined,
      };
      const b = pseudo(el, '::before'), a = pseudo(el, '::after');
      if (b) node.before = b; if (a) node.after = a;
      const ls = window.__reListeners && window.__reListeners.get(el);
      if (ls) node.listeners = [...ls];
      const why = isInteractive(el, cs);
      if (why) {
        node.interactive = why;
        interactive.push({ selector: selectorFor(el), path: pathStr, tag: node.tag, role: attrs.role || null, name: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 80), why, bbox: node.bbox, visible: node.visible, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' });
      }
      if (el.tagName === 'IFRAME') node.iframe = { src: el.src, sandbox: el.getAttribute('sandbox') };
      if (el.tagName === 'CANVAS') node.canvas = { w: el.width, h: el.height };
      if (el.tagName === 'SVG' || el.tagName === 'svg') node.svg = { viewBox: el.getAttribute('viewBox') };
      const kids = [];
      if (depth >= maxDepth) { if (el.children.length) node.childrenOmitted = el.children.length; return node; }
      if (el.shadowRoot) { node.shadow = true; for (const c of el.shadowRoot.children) { const k = walk(c, depth + 1, pathStr + '>>shadow>' + c.tagName.toLowerCase()); if (k) kids.push(k); } }
      if (!['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName) && el.tagName.toLowerCase() !== 'svg' ) {
        let i = 0;
        for (const c of el.children) { const k = walk(c, depth + 1, pathStr + '>' + c.tagName.toLowerCase() + ':' + (i++)); if (k) kids.push(k); }
      }
      if (kids.length) node.children = kids;
      return node;
    }

    const rootEl = rootSel ? document.querySelector(rootSel) : document.documentElement;
    if (!rootEl) return { error: 'root selector not found: ' + rootSel };
    const tree = walk(rootEl, 0, rootSel ? 'root' : 'html');
    const G = {};
    const probe = {
      React: () => !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size || !!document.querySelector('[data-reactroot]') || [...document.querySelectorAll('div,main,section')].slice(0, 80).some(e => Object.keys(e).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'))),
      'Next.js': () => !!window.next || !!document.getElementById('__NEXT_DATA__'),
      Vue: () => !!window.__VUE__ || !!document.querySelector('[data-v-app]') || [...document.querySelectorAll('div')].slice(0, 80).some(e => e.__vue_app__ || e.__vue__),
      Nuxt: () => !!window.__NUXT__, Angular: () => !!document.querySelector('[ng-version]'),
      Svelte: () => [...document.querySelectorAll('[class*="svelte-"]')].length > 0,
      jQuery: () => window.jQuery ? window.jQuery.fn.jquery : false,
      Redux: () => !!window.__REDUX_DEVTOOLS_EXTENSION__, Apollo: () => !!window.__APOLLO_CLIENT__ || !!window.__APOLLO_STATE__,
      THREE: () => {
        if (!window.THREE) return window.__THREE__ || false;
        const info = { revision: window.THREE.REVISION || true };
        try {
          // common patterns: apps expose scene/camera on window or a known key
          const candidates = [window.scene, window.__THREE_SCENE__, window.threeScene];
          for (const s of candidates) {
            if (s && s.isScene) {
              info.sceneChildren = s.children?.length;
              info.sceneType = 'Scene';
              break;
            }
          }
        } catch(e) {}
        return info;
      },
      PIXI: () => {
        if (!window.PIXI) return !!window.__PIXI_APP__ && 'app';
        const info = { version: window.PIXI.VERSION || true };
        try {
          const app = window.__PIXI_APP__ || window.app || window.pixiApp;
          if (app && app.stage) {
            info.stageChildren = app.stage.children?.length;
            info.renderer = app.renderer?.type;
            info.screen = app.screen ? [app.screen.width, app.screen.height] : null;
          }
        } catch(e) {}
        return info;
      },
      Konva: () => {
        if (!window.Konva) return false;
        try {
          const stages = window.Konva.stages || [];
          return { version: window.Konva.version || true, stages: stages.length, stageSizes: stages.slice(0,3).map(s => [s.width(), s.height()]) };
        } catch(e) { return true; }
      },
      fabric: () => !!window.fabric, paper: () => !!window.paper, p5: () => !!window.p5, Two: () => !!window.Two,
      BABYLON: () => !!window.BABYLON,
      gsap: () => {
        if (!window.gsap) return false;
        const info = { version: window.gsap.version || true };
        try {
          const tl = window.gsap.globalTimeline;
          if (tl && tl.getChildren) {
            const kids = tl.getChildren(true, true, true);
            info.totalChildren = kids.length;
            info.tweens = kids.filter(c => c.targets || c.vars).length;
            info.timelines = kids.filter(c => c.getChildren).length;
            // sample a few active ones
            info.sample = kids.slice(0, 8).map(c => ({
              duration: c.duration ? c.duration() : null,
              progress: c.progress ? c.progress() : null,
              paused: c.paused ? c.paused() : null,
              targets: c.targets ? (Array.isArray(c.targets) ? c.targets.length : 1) : null
            }));
          }
          if (window.ScrollTrigger) info.ScrollTrigger = true;
          if (window.Flip) info.Flip = true;
        } catch(e) {}
        return info;
      },
      lottie: () => !!window.lottie || !!window.bodymovin, rive: () => !!window.rive, anime: () => !!window.anime,
      opentype: () => !!window.opentype, monaco: () => !!window.monaco, d3: () => !!window.d3, Plotly: () => !!window.Plotly, Chart: () => !!window.Chart,
      ffmpeg: () => !!window.FFmpeg || !!window.createFFmpeg,
      WebCodecs: () => typeof window.VideoEncoder !== 'undefined',
      Radix: () => !!document.querySelector('[data-radix-popper-content-wrapper],[data-radix-collection-item],[data-state]'),
      Tailwind: () => !![...document.querySelectorAll('[class]')].slice(0, 200).find(e => /\b(flex|grid)\b/.test(e.className) && /\b(items-center|gap-\d|px-\d|py-\d|text-(xs|sm|base))\b/.test(e.className)),
      Elementor: () => {
        const has = !!document.querySelector('[data-elementor-type], .elementor-element, .elementor-widget');
        if (!has) return false;
        const vars = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch(e){ return []; } })
          .filter(r => r.style && [...r.style].some(p => p.startsWith('--e-global-')))
          .length;
        const widgets = [...document.querySelectorAll('[class*="elementor-widget-"]')].map(e => (e.className.match(/elementor-widget-([\w-]+)/)||[])[1]).filter(Boolean);
        return { vars: vars, widgets: [...new Set(widgets)].slice(0, 40), version: window.elementorFrontend?.config?.version || true };
      },
      WordPress: () => !!document.querySelector('link[href*="wp-content"], script[src*="wp-includes"], #wpadminbar') || !!window.wp,
      ProseMirror: () => !!document.querySelector('.ProseMirror'), Lexical: () => !!document.querySelector('[data-lexical-editor]'), Slate: () => !!document.querySelector('[data-slate-editor]'),
      CodeMirror: () => !!document.querySelector('.cm-editor, .CodeMirror'),
      serviceWorker: () => !!navigator.serviceWorker?.controller,
      canvasContexts: () => (window.__reCtx || []).length ? [...new Set(window.__reCtx)] : false,
      wasmInstantiations: () => window.__reWasm || false,
    };
    for (const [k, fn] of Object.entries(probe)) { try { const v = fn(); if (v) G[k] = v; } catch (e) {} }
    const store = {};
    try { store.localStorage = Object.keys(localStorage); } catch (e) {}
    try { store.sessionStorage = Object.keys(sessionStorage); } catch (e) {}
    store.cookies = document.cookie.split(';').map(s => s.trim().split('=')[0]).filter(Boolean);
    try {
      if (indexedDB.databases) {
        // async; leave a marker, agent can follow up
        store.indexedDB = 'databases-api-available';
      } else {
        store.indexedDB = 'no-databases-api';
      }
    } catch (e) { store.indexedDB = 'error'; }
    const fonts = []; try { document.fonts.forEach(f => fonts.push({ family: f.family, weight: f.weight, style: f.style, status: f.status })); } catch (e) {}
    const rootCS = getComputedStyle(document.documentElement);
    const meta = { title: document.title, lang: document.documentElement.lang, themeColor: document.querySelector('meta[name=theme-color]')?.content, colorScheme: rootCS.colorScheme, bodyBg: getComputedStyle(document.body).backgroundColor, scrollHeight: document.documentElement.scrollHeight, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio };
    const stylesheets = [...document.styleSheets].map(s => { let n = null; try { n = s.cssRules.length; } catch (e) {} return { href: s.href, rules: n }; });
    // Extract @keyframes names and sample transition/animation tokens from stylesheets
    const keyframes = [];
    const motionTokens = { durations: new Set(), easings: new Set(), delays: new Set() };
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = [...sheet.cssRules]; } catch (e) { continue; }
        for (const r of rules) {
          if (r.type === CSSRule.KEYFRAMES_RULE || r.name) {
            try { keyframes.push({ name: r.name, rules: r.cssRules ? r.cssRules.length : 0 }); } catch(e) {}
          }
          if (r.style) {
            const d = r.style.transitionDuration || r.style.animationDuration;
            const e = r.style.transitionTimingFunction || r.style.animationTimingFunction;
            const dl = r.style.transitionDelay || r.style.animationDelay;
            if (d) d.split(',').forEach(x => motionTokens.durations.add(x.trim()));
            if (e) e.split(',').forEach(x => motionTokens.easings.add(x.trim()));
            if (dl) dl.split(',').forEach(x => motionTokens.delays.add(x.trim()));
          }
        }
      }
    } catch (e) {}
    const motion = {
      keyframes: keyframes.slice(0, 80),
      durations: [...motionTokens.durations].slice(0, 30),
      easings: [...motionTokens.easings].slice(0, 30),
      delays: [...motionTokens.delays].slice(0, 20)
    };
    return { tree, styleTable, interactive, G, store, fonts, meta, stylesheets, motion, nodeCount, truncated: nodeCount >= maxNodes };
  }, { STYLE_PROPS, maxNodes, rootSel, maxDepth });
  if (data.error) { console.error(data.error); await browser.close(); process.exit(2); }

  try { data.store.indexedDB = await page.evaluate(async () => indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : null); } catch (e) {}

  // css variables from stylesheet bodies
  const vars = {};
  for (const [i, c] of cssBodies.entries()) {
    const safe = (new URL(c.url).pathname.split('/').pop() || 'sheet').replace(/[^\w.-]/g, '_').slice(0, 60);
    fs.writeFileSync(path.join(outDir, 'css', `${i}-${safe}`), c.body);
    for (const m of c.body.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g)) { if (!vars[m[1]]) vars[m[1]] = m[2].trim().slice(0, 160); }
  }
  // inline <style> tags
  const inlineCss = await page.evaluate(() => [...document.querySelectorAll('style')].map(s => s.textContent || '').join('\n'));
  for (const m of inlineCss.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g)) { if (!vars[m[1]]) vars[m[1]] = m[2].trim().slice(0, 160); }

  const wj = (n, o) => fs.writeFileSync(path.join(outDir, n), JSON.stringify(o, null, 2));
  wj('inventory.json', { url, root: rootSel, capturedAt: new Date().toISOString(), viewport: { width, height }, meta: data.meta, nodeCount: data.nodeCount, truncated: data.truncated, styleProps: STYLE_PROPS, styleTable: data.styleTable, tree: data.tree });
  wj('interactive.json', data.interactive);
  wj('network.json', network);
  wj('console.json', consoleLog);
  wj('css-vars.json', vars);
  wj('fonts.json', { documentFonts: data.fonts, fontRequests: network.filter(n => /font|woff|ttf|otf/i.test(n.contentType + n.url)).map(n => n.url) });
  // Async IndexedDB database list (shapes still require per-DB open)
  try {
    const idbList = await page.evaluate(async () => {
      if (!indexedDB.databases) return { note: 'databases() not available' };
      const dbs = await indexedDB.databases();
      return dbs.map(d => ({ name: d.name, version: d.version }));
    });
    data.store.indexedDB = idbList;
  } catch (e) { data.store.indexedDB = { error: String(e.message||e) }; }
  wj('globals.json', { globals: data.G, storage: data.store, stylesheets: data.stylesheets });

  if (data.motion) wj('motion.json', data.motion);
  fs.writeFileSync(path.join(outDir, 'rendered.html'), await page.content());
  if (rootSel) await page.locator(rootSel).first().screenshot({ path: path.join(outDir, 'screenshot-root.png') }).catch(() => {});
  else {
    await page.screenshot({ path: path.join(outDir, 'screenshot.png') });
    await page.screenshot({ path: path.join(outDir, 'screenshot-full.png'), fullPage: true }).catch(() => {});
  }
  await browser.close();

  console.log(`inventory: ${data.nodeCount} nodes${data.truncated ? ' (TRUNCATED, raise --max-nodes)' : ''}, ${Object.keys(data.styleTable).length} unique style sets`);
  console.log(`interactive elements: ${data.interactive.length}`);
  console.log(`network requests: ${network.length}, css vars: ${Object.keys(vars).length}`);
  console.log('detected:', JSON.stringify(data.G));
  console.log('output:', outDir);
})().catch((e) => { console.error(e); process.exit(1); });

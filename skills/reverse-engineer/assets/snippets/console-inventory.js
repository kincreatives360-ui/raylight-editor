/**
 * Paste into browser DevTools console as a Playwright-free fallback.
 * Copies a compact inventory of interactive elements + CSS vars + key globals to clipboard.
 * Does not replace the full scripts — use when Chromium/Playwright is unavailable.
 */
(async () => {
  const interactive = [];
  const sel = 'a[href],button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[tabindex]:not([tabindex="-1"]),[onclick]';
  document.querySelectorAll(sel).forEach((el, i) => {
    if (i > 400) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return;
    interactive.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      name: el.getAttribute('name'),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      text: (el.innerText || el.value || '').slice(0, 80).trim(),
      aria: el.getAttribute('aria-label'),
      classes: (el.className && String(el.className).slice(0, 120)) || null,
      bbox: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    });
  });
  const vars = {};
  const cs = getComputedStyle(document.documentElement);
  for (const p of cs) if (p.startsWith('--')) vars[p] = cs.getPropertyValue(p).trim();
  const G = {};
  const probes = {
    React: () => !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    Next: () => !!window.next || !!document.getElementById('__NEXT_DATA__'),
    Vue: () => !!window.__VUE__,
    THREE: () => window.THREE?.REVISION || !!window.THREE,
    PIXI: () => window.PIXI?.VERSION || !!window.PIXI,
    gsap: () => window.gsap?.version || !!window.gsap,
    Elementor: () => !!document.querySelector('[data-elementor-type],.elementor-element'),
  };
  for (const [k, fn] of Object.entries(probes)) try { const v = fn(); if (v) G[k] = v; } catch {}
  const out = {
    url: location.href,
    title: document.title,
    interactiveCount: interactive.length,
    interactive: interactive.slice(0, 200),
    cssVarCount: Object.keys(vars).length,
    cssVarsSample: Object.fromEntries(Object.entries(vars).slice(0, 40)),
    globals: G,
    localStorageKeys: Object.keys(localStorage || {}),
  };
  const json = JSON.stringify(out, null, 2);
  console.log(json);
  try {
    await navigator.clipboard.writeText(json);
    console.log('%cCopied inventory JSON to clipboard', 'color:green;font-weight:bold');
  } catch {
    console.log('Could not write clipboard — copy from console above');
  }
  return out;
})();

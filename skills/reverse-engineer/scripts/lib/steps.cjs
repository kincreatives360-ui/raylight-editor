/**
 * Shared step runner for reverse-engineer scripts.
 */
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

module.exports = { runSteps };


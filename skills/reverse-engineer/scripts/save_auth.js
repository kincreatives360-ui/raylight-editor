#!/usr/bin/env node
/**
 * Interactive helper to produce auth.json for --storage-state.
 * Usage: node save_auth.js <url> [auth.json] [--headless new|false]
 * Opens a browser, you log in manually, then press Enter in the terminal.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node save_auth.js <url> [auth.json] [--headless new|false]');
  console.log('Opens a browser, you log in manually, then press Enter in the terminal.');
  process.exit(0);
}

const url = args[0];
const out = args[1] || 'auth.json';
if (!url) { console.error('usage: node save_auth.js <url> [auth.json]'); process.exit(1); }

const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : d; };
const headless = flag('headless') ? (opt('headless', 'false') === 'false' ? false : opt('headless', 'false')) : false;

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright required'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  console.log('Log in in the browser window, then press Enter here...');
  await new Promise(r => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); r(); });
  });
  await context.storageState({ path: out });
  console.log('Wrote', out);
  await browser.close();
})();

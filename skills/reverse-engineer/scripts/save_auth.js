#!/usr/bin/env node
/**
 * Interactive helper to produce auth.json for --storage-state.
 * Usage: node save_auth.js <url> [auth.json]
 * Opens a browser, you log in manually, then press Enter in the terminal.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const url = process.argv[2];
const out = process.argv[3] || 'auth.json';
if (!url) { console.error('usage: node save_auth.js <url> [auth.json]'); process.exit(1); }

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright required'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ headless: false });
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

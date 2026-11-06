#!/usr/bin/env node
/**
 * doctor.js — check environment for reverse-engineer skill
 * Usage: node scripts/doctor.js
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const checks = [];
function ok(msg) { checks.push({ status: 'ok', msg }); console.log('  ✓ ' + msg); }
function warn(msg) { checks.push({ status: 'warn', msg }); console.log('  ! ' + msg); }
function fail(msg) { checks.push({ status: 'fail', msg }); console.log('  ✗ ' + msg); }

console.log('reverse-engineer doctor\n');

// Node
const nodeV = process.versions.node;
const major = parseInt(nodeV.split('.')[0], 10);
if (major >= 18) ok(`Node.js ${nodeV}`);
else fail(`Node.js ${nodeV} (need >= 18)`);

// npm
try {
  const npmV = execSync('npm -v', { encoding: 'utf8' }).trim();
  ok(`npm ${npmV}`);
} catch { fail('npm not found'); }

// Python
let py = null;
for (const cmd of ['python3', 'python', 'py']) {
  try {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) { py = cmd; ok(`${cmd}: ${ (r.stdout || r.stderr).trim() }`); break; }
  } catch {}
}
if (!py) fail('No python/python3/py found (needed for fingerprint, summarize, tokens, lint)');

// Playwright
let hasPw = false;
try {
  require.resolve('playwright');
  hasPw = true;
  ok('playwright package present');
} catch {
  try {
    require.resolve('playwright-core');
    hasPw = true;
    ok('playwright-core present');
  } catch {
    fail('Playwright not installed. Run: npm i playwright && npx playwright install chromium');
  }
}

if (hasPw) {
  try {
    const { chromium } = require('playwright');
    // quick launch test is expensive; just check binary path existence is hard, so soft check
    ok('Playwright importable (Chromium binary checked at runtime)');
  } catch (e) {
    warn('Playwright import failed: ' + e.message);
  }
}

// Platform notes
const plat = process.platform;
ok(`Platform: ${plat}`);
if (plat === 'win32') {
  warn('Windows: prefer node scripts over .sh; sed -i is GNU-only. Use scaffold_workspace.js');
}

// Summary
const fails = checks.filter(c => c.status === 'fail').length;
const warns = checks.filter(c => c.status === 'warn').length;
// optional pixel diff deps
try { require.resolve('pixelmatch'); require.resolve('pngjs'); ok('pixelmatch + pngjs (visual_diff --diff)'); }
catch { warn('pixelmatch/pngjs optional — only needed for pixel diffs: npm i pixelmatch pngjs'); }

console.log('\n' + (fails ? `FAIL (${fails} critical)` : warns ? `OK with ${warns} warning(s)` : 'All good'));
process.exit(fails ? 1 : 0);

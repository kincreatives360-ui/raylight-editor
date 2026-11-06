#!/usr/bin/env node
/**
 * One-command recon: fingerprint + inventory + summarize + tokens.
 * Usage:
 *   node recon.js <url> <workspace-or-outDir> [--root "selector"] [--steps steps.json] [--width 1440]
 *                 [--storage-state auth.json] [--dark] [--skip-tokens] [--format json|markdown] [--json-out <file>]
 *
 * Writes under <out>/01-recon/ and <out>/02-evidence/home/ (or the path you give).
 * Prefer pointing at an already-scaffolded re-<slug> directory.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
if (!url || !out) {
  console.error('usage: node recon.js <url> <outDir> [options passed to inventory]');
  process.exit(1);
}

const scriptDir = __dirname;
const extra = args.slice(2);

const format = extra.includes('--format') ? extra[extra.indexOf('--format') + 1] : 'markdown';
const jsonOut = extra.includes('--json-out') ? extra[extra.indexOf('--json-out') + 1] : null;

function run(cmd, cargs, label) {
  console.log('\n→', label);
  const r = spawnSync(cmd, cargs, { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error(label, 'failed with code', r.status);
    process.exit(r.status || 1);
  }
}

const reconDir = path.join(out, '01-recon');
const homeDir = path.join(out, '02-evidence', 'home');
fs.mkdirSync(reconDir, { recursive: true });
fs.mkdirSync(homeDir, { recursive: true });

let pyCmd = null;
for (const c of ['python3', 'python', 'py']) {
  try {
    const r = spawnSync(c, ['--version'], { stdio: 'ignore' });
    if (r.status === 0) { pyCmd = c; break; }
  } catch (e) {}
}
if (!pyCmd) pyCmd = 'python3';

// 1. Fingerprint
const stackOut = path.join(reconDir, 'stack.json');
run(pyCmd, [path.join(scriptDir, 'fingerprint_stack.py'), url, '--out', stackOut], 'fingerprint_stack');

// 2. DOM inventory
run('node', [path.join(scriptDir, 'dom_inventory.cjs'), url, homeDir, ...extra], 'dom_inventory');

// 3. Summarize
const inv = path.join(homeDir, 'inventory.json');
const digestOut = path.join(homeDir, 'digest.md');
if (fs.existsSync(inv)) {
  const summarizeArgs = [path.join(scriptDir, 'summarize_inventory.py'), inv, '--out', digestOut];
  if (format === 'json') summarizeArgs.push('--format', 'json');
  run(pyCmd, summarizeArgs, 'summarize_inventory');
}

// 4. Tokens (optional)
if (!extra.includes('--skip-tokens') && fs.existsSync(inv)) {
  const tokensOut = path.join(out, '03-docs');
  fs.mkdirSync(tokensOut, { recursive: true });
  const tokensArgs = [path.join(scriptDir, 'extract_tokens.py'), inv, '--out', path.join(tokensOut, 'design-tokens.json')];
  if (format === 'json') tokensArgs.push('--format', 'json');
  run(pyCmd, tokensArgs, 'extract_tokens');
}


// Optional a11y (skip with --no-a11y)
if (!extra.includes('--no-a11y')) {
  const a11yDir = path.join(out, '02-evidence', 'a11y');
  fs.mkdirSync(a11yDir, { recursive: true });
  const a11yArgs = [path.join(scriptDir, 'a11y_walk.cjs'), url, a11yDir];
  // forward storage-state / steps if present
  const si = extra.indexOf('--storage-state');
  if (si > -1 && extra[si+1]) { a11yArgs.push('--storage-state', extra[si+1]); }
  const sti = extra.indexOf('--steps');
  if (sti > -1 && extra[sti+1]) { a11yArgs.push('--steps', extra[sti+1]); }
  run('node', a11yArgs, 'a11y_walk');
}

console.log('\nRecon complete.');
console.log('  stack:   ', stackOut);
console.log('  digest:  ', digestOut);
console.log('  inventory + screenshots under', homeDir);

if (jsonOut) {
  const summary = {
    stack: stackOut,
    digest: digestOut,
    inventory: inv,
    homeDir,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
  console.log('  summary: ', jsonOut);
}

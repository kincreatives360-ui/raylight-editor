#!/usr/bin/env node
/**
 * Cross-platform workspace scaffolder.
 * Usage: node scaffold_workspace.js <slug> [output-dir] [--tier full|impl] [--feature "name"]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) {
  console.error('usage: node scaffold_workspace.js <slug> [output-dir] [--tier full|impl] [--feature "name"]');
  process.exit(1);
}
const slug = args.shift();
let out = '.';
let tier = 'impl';
let feature = '';
if (args.length && !args[0].startsWith('--')) out = args.shift();
while (args.length) {
  const a = args.shift();
  if (a === '--tier') tier = args.shift() || 'impl';
  else if (a === '--feature') feature = args.shift() || '';
  else { console.error('unknown option', a); process.exit(1); }
}

const root = path.join(out, `re-${slug}`);
const skillDir = path.resolve(__dirname, '..');
const tpl = path.join(skillDir, 'assets', 'templates');

function cpNew(src, dest) {
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}
function cpDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      cpDir(srcPath, destPath);
    } else {
      if (!fs.existsSync(destPath)) fs.copyFileSync(srcPath, destPath);
    }
  }
}
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function writeIfMissing(p, content) {
  if (!fs.existsSync(p)) fs.writeFileSync(p, content);
}

ensureDir(path.join(root, '01-recon'));
ensureDir(path.join(root, '02-evidence', 'screens'));
ensureDir(path.join(root, '02-evidence', 'controls'));
ensureDir(path.join(root, '02-evidence', 'sweep'));
ensureDir(path.join(root, '06-parity'));

// Copy CI template
cpDir(path.join(tpl, '.github'), path.join(root, '.github'));

cpNew(path.join(tpl, 'state.md'), path.join(root, 'STATE.md'));
writeIfMissing(path.join(root, 'UNKNOWNS.md'), `# Unknowns, assumptions, risks
| ID | Type | Description | How to verify | Status |
|---|---|---|---|---|
`);

if (tier === 'full') {
  for (const d of [
    '02-evidence/flows', '02-evidence/network', '02-evidence/motion',
    '03-docs/user-flows', '03-docs/adr', '04-components', '05-features'
  ]) ensureDir(path.join(root, d));
  cpNew(path.join(tpl, 'prd.md'), path.join(root, '03-docs', 'PRD.md'));
  cpNew(path.join(tpl, 'trd.md'), path.join(root, '03-docs', 'TRD.md'));
  cpNew(path.join(tpl, 'user-flow.md'), path.join(root, '03-docs', 'user-flows', '_TEMPLATE-J-00.md'));
  cpNew(path.join(tpl, 'component-spec.md'), path.join(root, '04-components', '_TEMPLATE-K-00.md'));
  cpNew(path.join(tpl, 'build-card.md'), path.join(root, '05-features', '_TEMPLATE-F-000.md'));
  cpNew(path.join(tpl, 'adr.md'), path.join(root, '03-docs', 'adr', '_TEMPLATE-ADR-000.md'));
  cpNew(path.join(tpl, 'interaction-spec.md'), path.join(root, '03-docs', 'INTERACTION-SPEC.md'));
  writeIfMissing(path.join(root, 'feature-matrix.csv'),
    'id,stage,name,area,type,screens,controls,depends_on,priority,status,card_file,evidence,confidence\n');
  writeIfMissing(path.join(root, '00-INDEX.md'),
    `# Reverse engineering: ${slug} (Tier T1 full kit)\nCreated: ${new Date().toISOString().slice(0,10)}\nStatus board: see STATE.md. Documents (link as written):\nFirst five cards to run:\n`);
} else {
  cpNew(path.join(tpl, 'implementation-doc.md'), path.join(root, 'IMPLEMENTATION.md'));
  if (feature) {
    const p = path.join(root, 'IMPLEMENTATION.md');
    let txt = fs.readFileSync(p, 'utf8');
    txt = txt.replace(/# IMPLEMENTATION: <Feature or product part>/, `# IMPLEMENTATION: ${feature}`);
    fs.writeFileSync(p, txt);
  }
}

console.log(`Workspace ready: ${root} (tier: ${tier})`);
console.log(`Notice: GitHub Actions workflows are in ${path.join(root, '.github')}. Move .github to your repository root for GitHub to run them.`);

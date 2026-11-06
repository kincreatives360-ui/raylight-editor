#!/usr/bin/env node
/**
 * Main CLI entry point for @reverse-engineer/cli
 * Routes to subcommands or runs the full pipeline
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptDir = __dirname;
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

if (args[0] === '--version' || args[0] === '-v') {
  const pkg = JSON.parse(fs.readFileSync(path.join(scriptDir, '..', 'package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

const subcommand = args[0];
const subArgs = args.slice(1);

const commands = {
  recon: 'recon.js',
  inventory: 'dom_inventory.cjs',
  sweep: 'interaction_sweep.cjs',
  summarize: 'summarize_inventory.py',
  tokens: 'extract_tokens.py',
  diff: 'diff_inventories.py',
  'lint-cards': 'lint_cards.py',
  'visual-diff': 'visual_diff.js',
  a11y: 'a11y_walk.cjs',
  fingerprint: 'fingerprint_stack.py',
  'har-to-contracts': 'har_to_contracts.py',
  'har-to-msw': 'har_to_msw.py',
  'unpack-extension': 'unpack_extension.py',
  scaffold: 'scaffold_workspace.js',
  'save-auth': 'save_auth.js',
  doctor: 'doctor.js',
  'run-agent': 'run_agent.js',
  'generate-tests': 'generate_tests.py',
  'theme-tokens': 'theme_tokens.py',
  'inspect-canvas': 'inspect_canvas.py',
  'inspect-extension': 'inspect_extension.py',
  'capture-websocket': 'capture_websocket.py',
  'enforce-budget': 'enforce_budget.py',
};

const script = commands[subcommand];
if (!script) {
  console.error(`Unknown command: ${subcommand}`);
  console.error('Run "reverse-engineer --help" for usage.');
  process.exit(1);
}

const ext = path.extname(script);
let cmd, cmdArgs;

if (ext === '.js' || ext === '.cjs') {
  cmd = 'node';
  cmdArgs = [path.join(scriptDir, script), ...subArgs];
} else if (ext === '.py') {
  cmd = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  cmdArgs = [path.join(scriptDir, script), ...subArgs];
} else {
  console.error(`Unknown script type: ${ext}`);
  process.exit(1);
}

const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: false });
if (r.error) {
  console.error(`Error executing ${cmd}: ${r.error.message}`);
}
process.exit(r.status ?? 1);

function printHelp() {
  console.log(`
@reverse-engineer/cli — Reverse engineer any web app to 1-to-1 parity

Usage:
  reverse-engineer <command> [args...]

Commands:
  recon              One-command recon: fingerprint + inventory + summarize + tokens + a11y
  inventory          DOM + style + network inventory of a live page (Playwright)
  sweep              Control sweep: operates every interactive element
  summarize          Compact digest of inventory.json
  tokens             Turn inventory.json into design token draft
  diff               Compare reference vs rebuild inventories
  lint-cards         Lint build cards before handoff
  visual-diff        Multi-viewport screenshots + pixel-perfect diffing
  a11y               Accessibility tree, tab order, keyboard map
  fingerprint        Static stack fingerprint for a URL (no JS execution)
  har-to-contracts   Convert network HAR to API contract markdown
  har-to-msw         Generate MSW handlers from network capture
  unpack-extension   Extract Chrome/Firefox extension manifest + file tree
  scaffold           Create workspace folder structure
  save-auth          Save login state for authenticated recon
  doctor             Check environment (Node, Python, Playwright)
  run-agent          Execute a build card with an AI coding agent
  generate-tests     Generate Playwright/Vitest tests from sweep data
  theme-tokens       Light/dark token pairing, contrast validation, semantic roles
  inspect-canvas     Deep Canvas/WebGL/WASM inspection (Three.js, PixiJS, Babylon, raw WebGL)
  inspect-extension  Browser extension & Electron/Tauri app analysis
  capture-websocket  WebSocket/SSE/stream capture for real-time collaboration apps
  enforce-budget     Performance budget enforcement (Core Web Vitals, resources, runtime)

Examples:
  # Full recon in one command
  reverse-engineer recon https://app.example.com ./re-myapp

  # Scoped capture for a feature
  reverse-engineer inventory https://app.example.com ./re-myapp/02-evidence/home --root "#timeline"
  reverse-engineer sweep https://app.example.com ./re-myapp/02-evidence/sweep --scope "#timeline"

  # Generate digest and tokens
  reverse-engineer summarize ./re-myapp/02-evidence/home/inventory.json --out ./re-myapp/02-evidence/home/digest.md
  reverse-engineer tokens ./re-myapp/02-evidence/home/inventory.json --out ./re-myapp/03-docs/design-tokens.json

  # Parity verification
  reverse-engineer diff ./re-myapp/06-parity/ref.json ./re-myapp/06-parity/build.json --out ./re-myapp/06-parity/diff.md

  # Lint cards
  reverse-engineer lint-cards ./re-myapp/IMPLEMENTATION.md

  # Scaffold workspace
  reverse-engineer scaffold my-app --tier full

  # Phase 2: Agent orchestration & test generation
  reverse-engineer run-agent re-myapp/IMPLEMENTATION.md#F-001 --provider anthropic
  reverse-engineer generate-tests re-myapp/02-evidence/sweep/interactions.json --out-dir tests
  reverse-engineer har-to-msw re-myapp/02-evidence/home/network.json --out msw-handlers.ts
  reverse-engineer theme-tokens re-myapp/03-docs/design-tokens.json --validate --wcag AA

  # Phase 3: Canvas, Extensions, WebSockets, Performance
  reverse-engineer inspect-canvas https://app.example.com ./re-canvas --engine three --duration 30
  reverse-engineer inspect-extension ./my-extension.crx ./re-ext --type extension
  reverse-engineer capture-websocket https://app.example.com ./re-ws --duration 60
  reverse-engineer enforce-budget https://app.example.com ./budget.json --runs 3 --format github-annotation

Run any command with --help for its specific options.
`);
}
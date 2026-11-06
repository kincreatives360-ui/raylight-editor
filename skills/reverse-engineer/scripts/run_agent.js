#!/usr/bin/env node
/**
 * Agent Orchestration Layer
 * Runs a coding agent on a single build card with full context injection.
 *
 * Usage:
 *   node run_agent.js <card-file-or-id> [options]
 *
 * Options:
 *   --workspace <path>     Workspace root (default: auto-detect from card location)
 *   --provider <name>      Agent provider: anthropic, openai, local (default: anthropic)
 *   --model <name>         Model name (default: claude-3-5-sonnet-20241022 for anthropic)
 *   --api-key <key>        API key (or set ANTHROPIC_API_KEY / OPENAI_API_KEY env var)
 *   --dry-run              Print the prompt without executing
 *   --timeout <ms>         Request timeout in ms (default: 120000)
 *   --verbose              Verbose output
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
Agent Orchestration Layer
=========================

Runs a coding agent on a single build card with full context injection.

Usage:
  run_agent.js <card-file-or-id> [options]

Options:
  --workspace <path>     Workspace root (default: auto-detect)
  --provider <name>      Provider: anthropic, openai, local (default: anthropic)
  --model <name>         Model name (default: claude-3-5-sonnet-20241022)
  --api-key <key>        API key (or use ANTHROPIC_API_KEY/OPENAI_API_KEY env)
  --dry-run              Print the assembled prompt without executing
  --timeout <ms>         Request timeout in ms (default: 120000)
  --verbose              Verbose output

Examples:
  # Run card F-001 from implementation doc
  npx reverse-engineer run-agent re-myapp/IMPLEMENTATION.md#F-001

  # Run specific card file
  npx reverse-engineer run-agent re-myapp/05-features/F-001-button-primary.md

  # Dry run to see prompt
  npx reverse-engineer run-agent re-myapp/IMPLEMENTATION.md#F-001 --dry-run

  # Use local model via Ollama
  npx reverse-engineer run-agent re-myapp/IMPLEMENTATION.md#F-001 --provider local --model llama3.1
`);
  process.exit(0);
}

function parseArgs(argv) {
  const opts = {
    workspace: null,
    provider: 'anthropic',
    model: null,
    apiKey: null,
    dryRun: false,
    timeout: 120000,
    verbose: false,
  };
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--workspace') opts.workspace = argv[++i];
    else if (arg === '--provider') opts.provider = argv[++i];
    else if (arg === '--model') opts.model = argv[++i];
    else if (arg === '--api-key') opts.apiKey = argv[++i];
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--timeout') opts.timeout = +argv[++i];
    else if (arg === '--verbose') opts.verbose = true;
    else if (!arg.startsWith('--')) {
      if (!opts.card) opts.card = arg;
      else console.warn('Ignoring extra positional arg:', arg);
    }
  }
  return opts;
}

const opts = parseArgs(args);

if (!opts.card) {
  console.error('Error: Card file or ID required');
  process.exit(1);
}

// Default models per provider
const DEFAULT_MODELS = {
  anthropic: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o',
  local: 'llama3.1',
};

if (!opts.model) opts.model = DEFAULT_MODELS[opts.provider] || DEFAULT_MODELS.anthropic;

// API key resolution
const ENV_KEYS = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  local: null,
};

if (!opts.apiKey && ENV_KEYS[opts.provider]) {
  opts.apiKey = process.env[ENV_KEYS[opts.provider]];
  if (!opts.apiKey && opts.provider !== 'local') {
    console.error(`Error: No API key provided. Set ${ENV_KEYS[opts.provider]} env var or use --api-key`);
    process.exit(1);
  }
}

// Resolve workspace
function resolveWorkspace(cardPath) {
  let dir = path.dirname(path.resolve(cardPath));
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'STATE.md'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const workspace = opts.workspace || resolveWorkspace(opts.card);
if (!fs.existsSync(path.join(workspace, 'STATE.md'))) {
  console.warn(`Warning: No STATE.md found in ${workspace}. Context may be incomplete.`);
}

// Load context files
function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const stateMd = readIfExists(path.join(workspace, 'STATE.md')) || '';
const unknownsMd = readIfExists(path.join(workspace, 'UNKNOWNS.md')) || '';

// Try to find design tokens
let designTokens = '';
const tokenPaths = [
  path.join(workspace, '03-docs', 'design-tokens.json'),
  path.join(workspace, '03-docs', 'DESIGN-SYSTEM.md'),
];
for (const p of tokenPaths) {
  const content = readIfExists(p);
  if (content) { designTokens = content; break; }
}

// Try to find implementation doc
let implDoc = '';
const implPaths = [
  path.join(workspace, 'IMPLEMENTATION.md'),
  path.join(workspace, '03-docs', 'PRD.md'),
];
for (const p of implPaths) {
  const content = readIfExists(p);
  if (content) { implDoc = content; break; }
}

// Parse card
let cardContent = '';
let cardId = '';

if (opts.card.includes('#')) {
  // Card ID in implementation doc: file.md#F-001
  const [file, id] = opts.card.split('#');
  cardId = id;
  const fullPath = path.resolve(file);
  const content = readIfExists(fullPath);
  if (!content) { console.error(`File not found: ${fullPath}`); process.exit(1); }
  
  // Extract card section
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\r?\\n)(###\\s+${escapedId}\\b[\\s\\S]*?)(?=(?:\\r?\\n)###\\s+F-\\d+|$)`);
  const match = content.match(regex);
  if (!match) { console.error(`Card ${id} not found in ${fullPath}`); process.exit(1); }
  cardContent = match[1].trim();
} else {
  // Direct card file
  const fullPath = path.resolve(opts.card);
  cardContent = readIfExists(fullPath);
  if (!cardContent) { console.error(`File not found: ${fullPath}`); process.exit(1); }
  const m = cardContent.match(/^###\s+(F-\d+)/m);
  cardId = m ? m[1] : 'unknown';
}

// Extract card metadata
function extractField(content, field) {
  const patterns = [
    new RegExp(`(?:^|\\r?\\n)##\\s+${field}\\s*\\r?\\n([\\s\\S]*?)(?=(?:\\r?\\n)##|$)`, 'i'),
    new RegExp(`\\b${field}\\s*:\\s*([^\\n|]+)`, 'i'),
  ];
  for (const re of patterns) {
    const m = content.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

const goal = extractField(cardContent, 'Goal') || extractField(cardContent, 'goal');
const spec = extractField(cardContent, 'Spec') || extractField(cardContent, 'spec');
const accept = extractField(cardContent, 'Acceptance') || extractField(cardContent, 'acceptance tests');
const doneWhen = extractField(cardContent, 'Done when') || extractField(cardContent, 'done when');
const outOfScope = extractField(cardContent, 'Out of scope') || extractField(cardContent, 'out of scope') || extractField(cardContent, 'not in scope');
const depends = extractField(cardContent, 'depends');
const files = extractField(cardContent, 'files');

// Build agent prompt
const prompt = `You are implementing ONE build card in an existing project.

# Card: ${cardId}
${cardContent}

# Project Context

## STATE.md (resume file)
${stateMd.slice(0, 3000)}${stateMd.length > 3000 ? '\n... (truncated)' : ''}

## Design Tokens / System
${designTokens.slice(0, 3000)}${designTokens.length > 3000 ? '\n... (truncated)' : ''}

## Implementation Document (relevant sections)
${implDoc.slice(0, 4000)}${implDoc.length > 4000 ? '\n... (truncated)' : ''}

## Unknowns Log
${unknownsMd.slice(0, 1000)}${unknownsMd.length > 1000 ? '\n... (truncated)' : ''}

# Your Task
${goal || 'See card above for goal.'}

# Constraints
- Only modify files listed in the card's "files" or "scope" section
- Do not modify anything else except to register/export the component
- Follow the spec exactly. Use tokens, never hardcoded values.
- Do not add features, refactor unrelated code, or change behavior of other components.
- If the spec is ambiguous or evidence is missing, STOP and ask instead of guessing.

# Acceptance Criteria
${accept || 'See card above.'}

# Done When
${doneWhen || 'See card above.'}

# Out of Scope
${outOfScope || 'See card above.'}

When finished:
1. Run the verification commands specified in the card
2. Confirm every item in "Done when"
3. Reply with: (1) files changed, (2) checks run and results, (3) any deviation from spec and why
`;

if (opts.dryRun) {
  console.log('\n=== ASSEMBLED PROMPT ===\n');
  console.log(prompt);
  console.log('\n=== END PROMPT ===\n');
  console.log(`Would invoke: ${opts.provider}/${opts.model}`);
  process.exit(0);
}

// Helper to run temporary provider script safely
function runTempScript(scriptContent, extraEnv) {
  const tmpDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '..'), '.agent-tmp-'));
  const tmp = path.join(tmpDir, 'agent.mjs');
  try {
    fs.writeFileSync(tmp, scriptContent);
    const env = { ...process.env, ...extraEnv };
    const r = spawnSync('node', [tmp], { env, timeout: opts.timeout, stdio: 'inherit' });
    return r.status ?? 1;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// Invoke agent
function invokeAgent(prompt) {
  const provider = opts.provider;
  
  if (provider === 'anthropic') {
    const script = `
import anthropic from '@anthropic-ai/sdk';
const client = new anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const msg = await client.messages.create({
  model: process.env.AGENT_MODEL,
  max_tokens: 8192,
  temperature: 0.1,
  system: 'You are a senior software engineer implementing a single build card. Follow constraints exactly.',
  messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }]
});
console.log(msg.content[0].text);
`;
    return runTempScript(script, {
      ANTHROPIC_API_KEY: opts.apiKey || process.env.ANTHROPIC_API_KEY,
      AGENT_MODEL: opts.model,
    });
  }
  
  if (provider === 'openai') {
    const script = `
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await client.chat.completions.create({
  model: process.env.AGENT_MODEL,
  messages: [
    { role: 'system', content: 'You are a senior software engineer implementing a single build card. Follow constraints exactly.' },
    { role: 'user', content: ${JSON.stringify(prompt)} }
  ],
  temperature: 0.1,
  max_tokens: 8192,
});
console.log(completion.choices[0].message.content);
`;
    return runTempScript(script, {
      OPENAI_API_KEY: opts.apiKey || process.env.OPENAI_API_KEY,
      AGENT_MODEL: opts.model,
    });
  }
  
  if (provider === 'local') {
    const script = `
const baseUrl = process.env.AGENT_BASE_URL;
const response = await fetch(\`\${baseUrl}/api/chat\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.AGENT_MODEL,
    messages: [
      { role: 'system', content: 'You are a senior software engineer implementing a single build card. Follow constraints exactly.' },
      { role: 'user', content: ${JSON.stringify(prompt)} }
    ],
    stream: false,
    options: { temperature: 0.1 }
  })
});
const data = await response.json();
console.log(data.message.content);
`;
    return runTempScript(script, {
      AGENT_MODEL: opts.model,
      AGENT_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
  }
  
  console.error(`Unknown provider: ${provider}`);
  return 1;
}

console.log(`\n🤖 Invoking ${opts.provider}/${opts.model} for card ${cardId}...`);
console.log(`📁 Workspace: ${workspace}`);
console.log(`⏱️  Timeout: ${opts.timeout}ms\n`);

const exitCode = invokeAgent(prompt);
process.exit(exitCode);
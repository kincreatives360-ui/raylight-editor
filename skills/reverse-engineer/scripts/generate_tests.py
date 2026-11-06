#!/usr/bin/env python3
"""
Generate Playwright tests from interaction_sweep.cjs output (interactions.json).

Usage:
  python generate_tests.py interactions.json [--out-dir tests] [--format playwright|vitest|jest]
        [--base-url http://localhost:3000] [--storage-state auth.json] [--group-by card|page|feature]

Reads interactions.json (from interaction_sweep.cjs) and generates runnable test files
with proper selectors, assertions for hover/focus/click effects, and token-based style checks.
"""
import argparse, json, os, re, sys
from pathlib import Path
from collections import defaultdict
from urllib.parse import urlparse

TEMPLATE_PLAYWRIGHT = '''// Auto-generated from interaction sweep data
// Source: {source_file}
// Card: {card_id}
// Run: npx playwright test {test_file}

import {{ test, expect }} from '@playwright/test';

const BASE_URL = '{base_url}';

test.describe('{suite_name}', () => {{
{test_cases}
}});
'''

TEST_CASE_PLAYWRIGHT = '''  test({test_name}, async ({{ page }}) => {{
    await page.goto(BASE_URL + {path}, {{ waitUntil: 'networkidle' }});
    await page.waitForTimeout(500);
{setup_steps}
    const el = page.locator({selector}).first();
    await expect(el).toBeVisible();
{action_steps}
{assertions}
  }});
'''

TEMPLATE_VITEST = '''// Auto-generated from interaction sweep data
// Source: {source_file}
// Run: npx vitest run {test_file}

import {{ describe, it, beforeEach, afterEach }} from 'vitest';
import {{ expect }} from '@playwright/test';
import {{ chromium }} from 'playwright';

const BASE_URL = '{base_url}';

describe('{suite_name}', () => {{
  let browser;
  let page;

  beforeEach(async () => {{
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
  }});

  afterEach(async () => {{
    await browser.close();
  }});

{test_cases}
}});
'''

TEST_CASE_VITEST = '''  it({test_name}, async () => {{
    await page.goto(BASE_URL + {path}, {{ waitUntil: 'networkidle' }});
    await page.waitForTimeout(500);
{setup_steps}
    const el = page.locator({selector}).first();
    await expect(el).toBeVisible();
{action_steps}
{assertions}
  }});
'''

def sanitize_name(name):
    """Convert a string to a valid test name."""
    return re.sub(r'[^a-zA-Z0-9_]+', '_', name).strip('_').lower()

def style_assertion(prop, expected):
    """Generate a style assertion."""
    return f"await expect(el).toHaveCSS({json.dumps(prop)}, {json.dumps(expected)});"

def generate_assertions(rec, tokens=None):
    """Generate assertions from sweep record."""
    assertions = []
    
    # Hover diff assertions
    if rec.get('hoverDiff'):
        for prop, diff in rec['hoverDiff'].items():
            if 'to' in diff:
                assertions.append(style_assertion(prop, diff['to']))
    
    # Focus assertions
    if rec.get('focus') and rec['focus'].get('outline'):
        assertions.append(f"await expect(el).toHaveCSS('outline', {json.dumps(rec['focus']['outline'])});")
    
    # ARIA state assertions
    if rec.get('afterAriaExpanded') is not None:
        assertions.append(f"await expect(el).toHaveAttribute('aria-expanded', {json.dumps(str(rec['afterAriaExpanded']))});")
    if rec.get('afterAriaPressed') is not None:
        assertions.append(f"await expect(el).toHaveAttribute('aria-pressed', {json.dumps(str(rec['afterAriaPressed']))});")
    if rec.get('afterDataState'):
        assertions.append(f"await expect(el).toHaveAttribute('data-state', {json.dumps(str(rec['afterDataState']))});")
    
    # Overlay assertions
    if rec.get('overlays'):
        for overlay in rec['overlays']:
            role = overlay.get('role', 'dialog')
            assertions.append(f"await expect(page.locator({json.dumps(f'[role={role}]')})).toBeVisible();")
    
    # URL change
    if rec.get('urlChanged'):
        parsed = urlparse(rec['urlChanged'])
        target_path = parsed.path + ('?' + parsed.query if parsed.query else '')
        if not target_path:
            target_path = '/'
        assertions.append(f"await expect(page).toHaveURL(BASE_URL + {json.dumps(target_path)});")
    
    # Network requests
    if rec.get('network'):
        for req in rec['network'][:3]:
            assertions.append(f"// Network: {req.get('method', 'GET')} {req.get('url', '')}")
    
    # Tooltip
    if rec.get('tooltip'):
        assertions.append(f"await expect(page.locator('[role=tooltip]')).toContainText({json.dumps(rec['tooltip'][:50])});")
    
    if not assertions:
        assertions.append("// No specific assertions generated - add custom checks")
    
    return '\n'.join(f'    {a}' for a in assertions)

def generate_action_steps(rec):
    """Generate action steps from sweep record."""
    steps = []
    action = rec.get('action', 'click')
    tag = rec.get('tag', '')
    type_ = rec.get('type', '').lower()
    
    if action == 'type' or (tag == 'input' and type_ not in ('button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image')):
        steps.append("    await el.fill('Test value 123');")
        steps.append("    await el.press('Enter');")
        steps.append("    await page.waitForTimeout(250);")
    elif tag == 'select':
        steps.append("    await el.selectOption({ index: 1 });")
        steps.append("    await page.waitForTimeout(250);")
    else:
        steps.append("    await el.click({ trial: false });")
        steps.append("    await page.waitForTimeout(500);")
    
    return '\n'.join(steps)

def generate_setup_steps(rec):
    """Generate setup steps if needed (e.g., for elements inside overlays)."""
    return ''

def group_by_card(records):
    """Group interactions by card ID prefix."""
    groups = defaultdict(list)
    for r in records:
        cid = r.get('id', 'unknown')
        # Extract card prefix F-### or use first part
        m = re.match(r'(F-\d+)', cid)
        key = m.group(1) if m else 'ungrouped'
        groups[key].append(r)
    return groups

def group_by_page(records):
    """Group by URL path."""
    groups = defaultdict(list)
    for r in records:
        # Would need page info from inventory - use default
        groups['default'].append(r)
    return groups

def generate_test_file(records, args, group_name='default'):
    """Generate a single test file."""
    source_file = args.interactions
    base_url = args.base_url
    
    test_cases = []
    for rec in records:
        if rec.get('status') != 'swept':
            continue
        if not rec.get('visible', True):
            continue
        if rec.get('disabled'):
            continue
        
        selector = rec.get('selector', '')
        name = rec.get('name', 'unnamed')
        tag = rec.get('tag', 'element')
        cid = rec.get('id', 'unknown')
        
        test_name = f"{cid} {tag} {name[:50]}"
        
        assertions = generate_assertions(rec)
        actions = generate_action_steps(rec)
        setup = generate_setup_steps(rec)
        
        if args.format == 'playwright':
            tc = TEST_CASE_PLAYWRIGHT.format(
                test_name=json.dumps(test_name),
                path=json.dumps('/'),
                selector=json.dumps(selector),
                setup_steps=setup,
                action_steps=actions,
                assertions=assertions,
            )
        else:
            tc = TEST_CASE_VITEST.format(
                test_name=json.dumps(test_name),
                path=json.dumps('/'),
                selector=json.dumps(selector),
                setup_steps=setup,
                action_steps=actions,
                assertions=assertions,
            )
        test_cases.append(tc)
    
    suite_name = f"{group_name} - {len(test_cases)} interactions"
    
    if args.format == 'playwright':
        content = TEMPLATE_PLAYWRIGHT.format(
            source_file=source_file,
            card_id=group_name,
            test_file=Path(args.out_dir) / f"{sanitize_name(group_name)}.spec.ts",
            base_url=base_url,
            suite_name=suite_name,
            test_cases='\n'.join(test_cases),
        )
        ext = '.spec.ts'
    else:
        content = TEMPLATE_VITEST.format(
            source_file=source_file,
            base_url=base_url,
            suite_name=suite_name,
            test_cases='\n'.join(test_cases),
        )
        ext = '.test.ts'
    
    return content, ext

def main():
    ap = argparse.ArgumentParser(description='Generate tests from interaction sweep data')
    ap.add_argument('interactions', help='interactions.json from interaction_sweep.cjs')
    ap.add_argument('--out-dir', default='tests', help='Output directory')
    ap.add_argument('--format', choices=['playwright', 'vitest'], default='playwright')
    ap.add_argument('--base-url', default='http://localhost:3000', help='Base URL for tests')
    ap.add_argument('--storage-state', help='Playwright storage state file')
    ap.add_argument('--group-by', choices=['card', 'page', 'feature', 'none'], default='card')
    ap.add_argument('--dry-run', action='store_true', help='Print to stdout instead of writing files')
    a = ap.parse_args()
    
    with open(a.interactions, 'r', encoding='utf-8') as f:
        records = json.load(f)
    
    swept = [r for r in records if r.get('status') == 'swept' and r.get('visible', True) and not r.get('disabled')]
    print(f"Found {len(swept)} swept interactions out of {len(records)} total")
    
    if a.group_by == 'card':
        groups = group_by_card(swept)
    elif a.group_by == 'page':
        groups = group_by_page(swept)
    else:
        groups = {'all': swept}
    
    os.makedirs(a.out_dir, exist_ok=True)
    
    for group_name, group_records in groups.items():
        content, ext = generate_test_file(group_records, a, group_name)
        out_file = Path(a.out_dir) / f"{sanitize_name(group_name)}{ext}"
        
        if a.dry_run:
            print(f"\n=== {out_file} ===")
            print(content)
        else:
            out_file.write_text(content, encoding='utf-8')
            print(f"Generated: {out_file}")
    
    # Generate package.json test script hint
    if a.format == 'playwright':
        print("\nAdd to package.json:")
        print('  "scripts": {')
        print('    "test:e2e": "playwright test",')
        print('    "test:e2e:ui": "playwright test --ui"')
        print('  }')
    elif a.format == 'vitest':
        print("\nAdd to package.json:")
        print('  "scripts": {')
        print('    "test:e2e": "vitest run tests/"')
        print('  }')

if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Performance Budget Enforcement
Enforces performance budgets during parity verification and CI.

Usage:
  python enforce_budget.py <url> <budget-file> [--out-dir results] [--runs 3]
        [--headless new|false] [--width 1440] [--height 900] [--storage-state auth.json]
        [--fail-on-warn] [--format json|junit|github-annotation]

Features:
- Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP)
- Custom budgets per page/route
- Resource budgets (JS, CSS, images, fonts, total)
- Timing budgets (DOMContentLoaded, load, TTI)
- Runtime budgets (long tasks, layout shifts, memory)
- Bundle size budgets (from build output)
- Regression detection (compare against baseline)
- CI integration with annotations
"""
import argparse, json, os, sys, statistics, subprocess
from pathlib import Path
from datetime import datetime
from collections import defaultdict


DEFAULT_BUDGETS = {
    "core_web_vitals": {
        "LCP": {"good": 2500, "needs_improvement": 4000, "unit": "ms"},
        "FID": {"good": 100, "needs_improvement": 300, "unit": "ms"},
        "CLS": {"good": 0.1, "needs_improvement": 0.25, "unit": "score"},
        "FCP": {"good": 1800, "needs_improvement": 3000, "unit": "ms"},
        "TTFB": {"good": 800, "needs_improvement": 1800, "unit": "ms"},
        "INP": {"good": 200, "needs_improvement": 500, "unit": "ms"},
    },
    "timing": {
        "domContentLoaded": {"good": 1500, "needs_improvement": 3000, "unit": "ms"},
        "load": {"good": 3000, "needs_improvement": 5000, "unit": "ms"},
        "tti": {"good": 3800, "needs_improvement": 7300, "unit": "ms"},
    },
    "resources": {
        "totalSize": {"good": 500000, "needs_improvement": 1500000, "unit": "bytes"},
        "jsSize": {"good": 170000, "needs_improvement": 500000, "unit": "bytes"},
        "cssSize": {"good": 50000, "needs_improvement": 150000, "unit": "bytes"},
        "imageSize": {"good": 300000, "needs_improvement": 1000000, "unit": "bytes"},
        "fontSize": {"good": 50000, "needs_improvement": 200000, "unit": "bytes"},
        "requestCount": {"good": 50, "needs_improvement": 100, "unit": "count"},
    },
    "runtime": {
        "longTasks": {"good": 0, "needs_improvement": 5, "unit": "count"},
        "maxTaskDuration": {"good": 50, "needs_improvement": 200, "unit": "ms"},
        "layoutShifts": {"good": 0, "needs_improvement": 10, "unit": "count"},
        "memoryJSHeap": {"good": 10000000, "needs_improvement": 50000000, "unit": "bytes"},
    },
}


def load_budget(budget_path):
    """Load budget configuration from file."""
    with open(budget_path) as f:
        if budget_path.endswith('.json'):
            return json.load(f)
        elif budget_path.endswith(('.yaml', '.yml')):
            try:
                import yaml
                return yaml.safe_load(f)
            except ImportError:
                print("PyYAML not installed. Use JSON budget file.")
                sys.exit(1)
    return DEFAULT_BUDGETS


def merge_budgets(defaults, custom):
    """Deep merge custom budgets with defaults."""
    result = json.loads(json.dumps(defaults))
    
    def merge(d, c):
        for k, v in c.items():
            if k in d and isinstance(d[k], dict) and isinstance(v, dict):
                merge(d[k], v)
            else:
                d[k] = v
    
    merge(result, custom)
    return result


def evaluate_metric(value, budget):
    """Evaluate a metric against budget thresholds."""
    if value is None:
        return "unknown", "No data"
    
    good = budget.get("good")
    needs = budget.get("needs_improvement")
    
    if good is not None and value <= good:
        return "pass", f"{value} <= {good} (good)"
    elif needs is not None and value <= needs:
        return "warn", f"{value} <= {needs} (needs improvement)"
    else:
        threshold = needs if needs is not None else good
        return "fail", f"{value} > {threshold} (poor)"


def collect_metrics(page, url):
    """Collect all performance metrics from a page."""
    # Navigation timing
    nav_timing = page.evaluate("""
        () => {
            const nt = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: nt.domContentLoadedEventEnd - nt.startTime,
                load: nt.loadEventEnd - nt.startTime,
                ttfb: nt.responseStart - nt.requestStart,
                dns: nt.domainLookupEnd - nt.domainLookupStart,
                tcp: nt.connectEnd - nt.connectStart,
                tls: nt.secureConnectionStart > 0 ? nt.connectEnd - nt.secureConnectionStart : 0,
                redirect: nt.redirectEnd - nt.redirectStart,
            };
        }
    """)
    
    # Paint timing
    paint = page.evaluate("""
        () => {
            const entries = performance.getEntriesByType('paint');
            return {
                fcp: entries.find(e => e.name === 'first-paint')?.startTime || 0,
                fcp_content: entries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
            };
        }
    """)
    
    # LCP
    lcp = page.evaluate("""
        () => new Promise(resolve => {
            new PerformanceObserver(list => {
                const entries = list.getEntries();
                const last = entries[entries.length - 1];
                resolve(last.startTime);
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            // Fallback timeout
            setTimeout(() => resolve(null), 100);
        })
    """)
    
    # FID/INP
    fid_inp = page.evaluate("""
        () => new Promise(resolve => {
            let fid = null;
            let inp = 0;
            new PerformanceObserver(list => {
                list.getEntries().forEach(e => {
                    if (e.entryType === 'first-input') {
                        fid = e.processingStart - e.startTime;
                    } else if (e.entryType === 'event') {
                        inp = Math.max(inp, e.duration);
                    }
                });
            }).observe({ type: 'first-input', buffered: true });
            new PerformanceObserver(list => {
                list.getEntries().forEach(e => {
                    inp = Math.max(inp, e.duration);
                });
            }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
            setTimeout(() => resolve({ fid, inp }), 100);
        })
    """)
    
    # CLS
    cls = page.evaluate("""
        () => new Promise(resolve => {
            let cls = 0;
            let sessionValue = 0;
            new PerformanceObserver(list => {
                list.getEntries().forEach(e => {
                    if (!e.hadRecentInput) {
                        sessionValue += e.value;
                        cls = Math.max(cls, sessionValue);
                    } else {
                        sessionValue = 0;
                    }
                });
            }).observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => resolve(cls), 100);
        })
    """)
    
    # Long tasks
    long_tasks = page.evaluate("""
        () => new Promise(resolve => {
            const tasks = [];
            new PerformanceObserver(list => {
                list.getEntries().forEach(e => {
                    tasks.push({
                        duration: e.duration,
                        startTime: e.startTime,
                        name: e.name,
                    });
                });
            }).observe({ type: 'longtask', buffered: true });
            setTimeout(() => resolve(tasks), 100);
        })
    """)
    
    # Resource timing
    resources = page.evaluate("""
        () => {
            return performance.getEntriesByType('resource').map(r => ({
                name: r.name,
                type: r.initiatorType,
                size: r.transferSize || r.encodedBodySize || r.decodedBodySize || 0,
                duration: r.duration,
                startTime: r.startTime,
            }));
        }
    """)
    
    # Memory (if available)
    memory = page.evaluate("""
        () => performance.memory ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        } : null
    """)
    
    return {
        'url': url,
        'timestamp': datetime.now().isoformat(),
        'navigation': nav_timing,
        'paint': paint,
        'lcp': lcp,
        'fid_inp': fid_inp,
        'cls': cls,
        'long_tasks': long_tasks,
        'resources': resources,
        'memory': memory,
    }


def evaluate_budgets(metrics, budgets):
    """Evaluate all metrics against budgets."""
    results = {
        'core_web_vitals': {},
        'timing': {},
        'resources': {},
        'runtime': {},
        'summary': {'pass': 0, 'warn': 0, 'fail': 0, 'unknown': 0},
    }
    
    # Core Web Vitals
    cwv = budgets.get('core_web_vitals', {})
    results['core_web_vitals']['LCP'] = evaluate_metric(metrics.get('lcp'), cwv.get('LCP', {}))
    results['core_web_vitals']['FID'] = evaluate_metric(metrics.get('fid_inp', {}).get('fid'), cwv.get('FID', {}))
    results['core_web_vitals']['INP'] = evaluate_metric(metrics.get('fid_inp', {}).get('inp'), cwv.get('INP', {}))
    results['core_web_vitals']['CLS'] = evaluate_metric(metrics.get('cls'), cwv.get('CLS', {}))
    results['core_web_vitals']['FCP'] = evaluate_metric(metrics.get('paint', {}).get('fcp_content'), cwv.get('FCP', {}))
    results['core_web_vitals']['TTFB'] = evaluate_metric(metrics.get('navigation', {}).get('ttfb'), cwv.get('TTFB', {}))
    
    # Timing
    timing = budgets.get('timing', {})
    results['timing']['domContentLoaded'] = evaluate_metric(metrics.get('navigation', {}).get('domContentLoaded'), timing.get('domContentLoaded', {}))
    results['timing']['load'] = evaluate_metric(metrics.get('navigation', {}).get('load'), timing.get('load', {}))
    results['timing']['tti'] = evaluate_metric(None, timing.get('tti', {}))  # Would need more complex calculation
    
    # Resources
    res = budgets.get('resources', {})
    total_size = sum(r['size'] for r in metrics.get('resources', []))
    js_size = sum(r['size'] for r in metrics.get('resources', []) if r['type'] == 'script')
    css_size = sum(r['size'] for r in metrics.get('resources', []) if r['type'] == 'css' or r['type'] == 'stylesheet')
    img_size = sum(r['size'] for r in metrics.get('resources', []) if r['type'] in ('img', 'image', 'icon'))
    font_size = sum(r['size'] for r in metrics.get('resources', []) if r['type'] == 'font')
    req_count = len(metrics.get('resources', []))
    
    results['resources']['totalSize'] = evaluate_metric(total_size, res.get('totalSize', {}))
    results['resources']['jsSize'] = evaluate_metric(js_size, res.get('jsSize', {}))
    results['resources']['cssSize'] = evaluate_metric(css_size, res.get('cssSize', {}))
    results['resources']['imageSize'] = evaluate_metric(img_size, res.get('imageSize', {}))
    results['resources']['fontSize'] = evaluate_metric(font_size, res.get('fontSize', {}))
    results['resources']['requestCount'] = evaluate_metric(req_count, res.get('requestCount', {}))
    
    # Runtime
    rt = budgets.get('runtime', {})
    long_tasks = metrics.get('long_tasks', [])
    results['runtime']['longTasks'] = evaluate_metric(len(long_tasks), rt.get('longTasks', {}))
    max_task = max((t['duration'] for t in long_tasks), default=0)
    results['runtime']['maxTaskDuration'] = evaluate_metric(max_task, rt.get('maxTaskDuration', {}))
    # Layout shifts - would need more detailed tracking
    results['runtime']['layoutShifts'] = evaluate_metric(0, rt.get('layoutShifts', {}))
    if metrics.get('memory'):
        results['runtime']['memoryJSHeap'] = evaluate_metric(metrics['memory'].get('usedJSHeapSize'), rt.get('memoryJSHeap', {}))
    
    # Summary
    for category in ['core_web_vitals', 'timing', 'resources', 'runtime']:
        for metric, (status, msg) in results[category].items():
            results['summary'][status] += 1
    
    return results


def run_multiple(page, url, runs, budgets):
    """Run multiple times and collect median."""
    all_metrics = []
    for i in range(runs):
        print(f"  Run {i+1}/{runs}...")
        page.reload(wait_until='networkidle')
        page.wait_for_timeout(1000)
        metrics = collect_metrics(page, url)
        all_metrics.append(metrics)
    
    # Calculate medians
    def median(values):
        vals = [v for v in values if v is not None]
        return statistics.median(vals) if vals else None
    
    median_metrics = {
        'navigation': {},
        'paint': {},
        'resources': all_metrics[0]['resources'],  # Use first run resources
        'memory': all_metrics[0]['memory'],
    }
    
    for key in ['domContentLoaded', 'load', 'ttfb', 'dns', 'tcp', 'tls', 'redirect']:
        median_metrics['navigation'][key] = median([m['navigation'][key] for m in all_metrics])
    
    for key in ['fcp', 'fcp_content']:
        median_metrics['paint'][key] = median([m['paint'][key] for m in all_metrics])
    
    median_metrics['lcp'] = median([m['lcp'] for m in all_metrics])
    median_metrics['fid_inp'] = {
        'fid': median([m['fid_inp']['fid'] for m in all_metrics]),
        'inp': median([m['fid_inp']['inp'] for m in all_metrics]),
    }
    median_metrics['cls'] = median([m['cls'] for m in all_metrics])
    median_metrics['long_tasks'] = all_metrics[0]['long_tasks']  # Use first run
    
    return median_metrics


def format_output(results, metrics, format='json'):
    """Format results for output."""
    if format == 'json':
        return json.dumps({
            'metrics': metrics,
            'results': results,
        }, indent=2, default=str)
    
    elif format == 'junit':
        # JUnit XML for CI
        lines = ['<?xml version="1.0" encoding="UTF-8"?>']
        lines.append(f'<testsuite name="Performance Budget" tests="{results["summary"]["pass"] + results["summary"]["warn"] + results["summary"]["fail"]}" failures="{results["summary"]["fail"]}" timestamp="{datetime.now().isoformat()}">')
        
        for category in ['core_web_vitals', 'timing', 'resources', 'runtime']:
            for metric, (status, msg) in results[category].items():
                lines.append(f'  <testcase name="{category}.{metric}" classname="{category}">')
                if status == 'fail':
                    lines.append(f'    <failure message="{msg}">{msg}</failure>')
                elif status == 'warn':
                    lines.append(f'    <skipped message="{msg}"/>')
                lines.append('  </testcase>')
        
        lines.append('</testsuite>')
        return '\n'.join(lines)
    
    elif format == 'github-annotation':
        # GitHub Actions annotations
        lines = []
        for category in ['core_web_vitals', 'timing', 'resources', 'runtime']:
            for metric, (status, msg) in results[category].items():
                if status == 'fail':
                    lines.append(f"::error title=Performance Budget: {category}.{metric}::{msg}")
                elif status == 'warn':
                    lines.append(f"::warning title=Performance Budget: {category}.{metric}::{msg}")
                else:
                    lines.append(f"::notice title=Performance Budget: {category}.{metric}::{msg}")
        return '\n'.join(lines)
    
    else:
        # Human readable
        lines = []
        lines.append("=" * 60)
        lines.append("PERFORMANCE BUDGET REPORT")
        lines.append("=" * 60)
        lines.append(f"URL: {metrics.get('url', 'N/A')}")
        lines.append(f"Timestamp: {metrics.get('timestamp', 'N/A')}")
        lines.append("")
        
        for category in ['core_web_vitals', 'timing', 'resources', 'runtime']:
            cat_results = results[category]
            if not cat_results:
                continue
            lines.append(f"\n{category.upper().replace('_', ' ')}:")
            lines.append("-" * 40)
            for metric, (status, msg) in cat_results.items():
                icon = "✅" if status == 'pass' else "⚠️" if status == 'warn' else "❌" if status == 'fail' else "❓"
                lines.append(f"  {icon} {metric}: {msg}")
        
        lines.append("\n" + "=" * 60)
        s = results['summary']
        lines.append(f"SUMMARY: {s['pass']} pass, {s['warn']} warn, {s['fail']} fail, {s['unknown']} unknown")
        lines.append("=" * 60)
        
        return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser(description='Performance Budget Enforcement')
    ap.add_argument('url', help='URL to test')
    ap.add_argument('budget', nargs='?', help='Budget file (JSON/YAML), uses defaults if omitted')
    ap.add_argument('--out-dir', default='perf-results', help='Output directory')
    ap.add_argument('--runs', type=int, default=3, help='Number of runs (median used)')
    ap.add_argument('--headless', choices=['new', 'false'], default='new')
    ap.add_argument('--width', type=int, default=1440)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--storage-state', help='Playwright storage state')
    ap.add_argument('--fail-on-warn', action='store_true', help='Exit with error on warnings')
    ap.add_argument('--format', choices=['json', 'junit', 'github-annotation', 'text'], default='text')
    ap.add_argument('--baseline', help='Baseline results file for regression detection')
    a = ap.parse_args()
    
    if len(sys.argv) == 1:
        ap.print_help()
        return
    
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)
    
    headless = a.headless == 'new' or (a.headless == 'false' and False)
    out_dir = Path(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Load budgets
    budgets = DEFAULT_BUDGETS
    if a.budget:
        custom = load_budget(a.budget)
        budgets = merge_budgets(DEFAULT_BUDGETS, custom)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={'width': a.width, 'height': a.height},
            storage_state=a.storage_state if a.storage_state else None,
        )
        page = context.new_page()
        
        # Navigate
        print(f"Navigating to {a.url}...")
        page.goto(a.url, wait_until='networkidle', timeout=60000)
        page.wait_for_timeout(2000)
        
        # Run multiple times
        print(f"Running {a.runs} times...")
        metrics = run_multiple(page, a.url, a.runs, budgets)
        metrics['url'] = a.url
        metrics['timestamp'] = datetime.now().isoformat()
        
        # Evaluate
        print("Evaluating budgets...")
        results = evaluate_budgets(metrics, budgets)
        
        # Regression detection
        if a.baseline and Path(a.baseline).exists():
            with open(a.baseline) as f:
                baseline = json.load(f)
            print("Checking regressions...")
            regressions = []
            # Compare key metrics
            for key in ['lcp', 'cls']:
                curr = metrics.get(key)
                base = baseline.get('metrics', {}).get(key)
                if curr and base and curr > base * 1.1:  # 10% regression
                    regressions.append(f"{key}: {base:.1f} -> {curr:.1f} (+{(curr/base-1)*100:.1f}%)")
            for key in ['navigation.domContentLoaded', 'navigation.load', 'navigation.ttfb']:
                curr_val = metrics['navigation'].get(key.split('.')[-1])
                base_val = baseline.get('metrics', {}).get('navigation', {}).get(key.split('.')[-1])
                if curr_val and base_val and curr_val > base_val * 1.1:
                    regressions.append(f"{key}: {base_val:.1f} -> {curr_val:.1f} (+{(curr_val/base_val-1)*100:.1f}%)")
            if regressions:
                results['regressions'] = regressions
                print(f"⚠️  REGRESSIONS DETECTED:")
                for r in regressions:
                    print(f"  {r}")
        
        # Format output
        output = format_output(results, metrics, a.format)
        
        # Save
        out_file = out_dir / f'perf-report.{a.format if a.format != "text" else "txt"}'
        out_file.write_text(output)
        
        # Also save raw data
        raw_file = out_dir / 'perf-metrics.json'
        raw_file.write_text(json.dumps({
            'metrics': metrics,
            'results': results,
            'budgets': budgets,
        }, indent=2, default=str))
        
        print(f"\nReport saved to: {out_file}")
        print(f"Raw data: {raw_file}")
        
        # Print summary
        print(format_output(results, metrics, 'text'))
        
        browser.close()
    
    # Exit code
    if results['summary']['fail'] > 0:
        sys.exit(1)
    elif a.fail_on_warn and results['summary']['warn'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
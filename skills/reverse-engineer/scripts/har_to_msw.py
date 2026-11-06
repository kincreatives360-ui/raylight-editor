#!/usr/bin/env python3
"""
Generate MSW (Mock Service Worker) handlers from HAR file.

Usage:
  python har_to_msw.py network.json [--out msw-handlers.ts] [--base-url https://api.example.com]
        [--format typescript|javascript] [--group-by domain|endpoint] [--include-failures]

Reads network.json (from dom_inventory.cjs or HAR) and generates MSW handler files
with proper request/response typing, delay simulation, and error scenarios.
"""
import argparse, json, os, re, sys
from pathlib import Path
from collections import defaultdict
from urllib.parse import urlparse, parse_qs

MSW_TEMPLATE_TS = '''// Auto-generated MSW handlers from network capture
// Source: {source_file}
// Generated: {timestamp}
// Run: npx msw init public/ (first time), then import in test setup

import {{ http, HttpResponse, delay, graphql }} from 'msw';

{handlers}

export const handlers = [
{handler_list}
];

export default handlers;
'''

MSW_TEMPLATE_JS = '''// Auto-generated MSW handlers from network capture
// Source: {source_file}
// Generated: {timestamp}

import {{ http, HttpResponse, delay, graphql }} from 'msw';

{handlers}

export const handlers = [
{handler_list}
];

export default handlers;
'''

def sanitize_name(name):
    """Convert to valid JavaScript identifier."""
    return re.sub(r'[^a-zA-Z0-9_]+', '_', name).strip('_')

def extract_path_params(url, base_url):
    """Extract path parameters from URL."""
    parsed = urlparse(url)
    base_parsed = urlparse(base_url) if base_url else None
    
    # Remove base URL if path starts with it
    path = parsed.path
    if base_parsed and base_parsed.path and base_parsed.path != '/':
        if path.startswith(base_parsed.path):
            path = path[len(base_parsed.path):]
    
    # Convert path segments that look like IDs to params (:id, :id2, ...)
    segments = path.strip('/').split('/')
    param_segments = []
    param_counter = 0
    for seg in segments:
        if not seg:
            continue
        if re.match(r'^[0-9a-fA-F-]{8,}$', seg) or re.match(r'^\d+$', seg):
            param_counter += 1
            param_name = 'id' if param_counter == 1 else f'id{param_counter}'
            param_segments.append(f':{param_name}')
        else:
            param_segments.append(seg)
    
    return '/' + '/'.join(param_segments) if param_segments else '/'

def is_graphql_record(req):
    """Check if record is GraphQL."""
    url = req.get('url', '')
    method = req.get('method', 'GET').upper()
    return req.get('type') == 'graphql' or (url.endswith('/graphql') and method == 'POST')

def generate_handler(req, handler_idx, base_url):
    """Generate a single MSW handler."""
    method = req.get('method', 'GET').lower()
    url = req.get('url', '')
    status = req.get('status', 200)
    content_type = req.get('contentType', 'application/json')
    
    path = extract_path_params(url, base_url)
    parsed = urlparse(url)
    base_parsed = urlparse(base_url) if base_url else None

    # Origin handling: if request is on another origin, retain its origin
    if parsed.netloc and (not base_parsed or parsed.netloc != base_parsed.netloc):
        target_path = f"{parsed.scheme}://{parsed.netloc}{path}"
    else:
        target_path = path
    
    # Generate response body
    if content_type.startswith('application/json'):
        response_body = '{}'
        if 'response' in req and req['response']:
            try:
                response_body = json.dumps(req['response'], indent=2)
            except (TypeError, ValueError):
                response_body = '{}'
    else:
        response_body = '""'
    
    # Generate unique handler name
    clean_path = sanitize_name(path.replace('/', '_').strip('_'))
    handler_name = f"handler{handler_idx}_{sanitize_name(method)}_{clean_path}" if clean_path else f"handler{handler_idx}_{sanitize_name(method)}"
    
    # Delay simulation
    delay_ms = req.get('duration', 0) or 0
    delay_str = f"await delay({delay_ms});\n    " if delay_ms > 0 else ""
    
    target_path_lit = json.dumps(target_path)
    content_type_lit = json.dumps(content_type)
    
    handler = (
        f"const {handler_name} = http.{method}({target_path_lit}, async () => {{\n"
        f"  {delay_str}return HttpResponse.json({response_body}, {{\n"
        f"    status: {status},\n"
        f"    headers: {{\n"
        f"      'Content-Type': {content_type_lit},\n"
        f"    }},\n"
        f"  }});\n"
        f"}});"
    )
    
    return handler, handler_name

def generate_graphql_handlers(records, base_url):
    """Generate GraphQL handlers from detected GraphQL requests."""
    graphql_requests = [r for r in records if is_graphql_record(r)]
    
    if not graphql_requests:
        return '', []
    
    handlers = []
    names = []
    seen_ops = set()
    name_counts = defaultdict(int)

    for req in graphql_requests:
        post_data = req.get('postData', '{}')
        operation_name = None
        if post_data:
            try:
                body = json.loads(post_data) if isinstance(post_data, str) else post_data
                if isinstance(body, dict):
                    operation_name = body.get('operationName')
            except (TypeError, ValueError, json.JSONDecodeError):
                pass
        
        # Do not emit synthetic Operation{idx} when operationName is missing
        if not operation_name:
            continue
        
        if operation_name in seen_ops:
            continue
        seen_ops.add(operation_name)
        
        sanitized = sanitize_name(operation_name) or 'unnamed'
        name_counts[sanitized] += 1
        suffix = f"_{name_counts[sanitized]}" if name_counts[sanitized] > 1 else ""
        handler_name = f"graphql_{sanitized}{suffix}"
        
        op_lit = json.dumps(operation_name)
        handler = (
            f"const {handler_name} = graphql.query({op_lit}, async () => {{\n"
            f"  return HttpResponse.json({{ data: {{}} }}, {{ status: 200 }});\n"
            f"}});"
        )
        handlers.append(handler)
        names.append(handler_name)
    
    return '\n\n'.join(handlers), names

def main():
    ap = argparse.ArgumentParser(description='Generate MSW handlers from network capture')
    ap.add_argument('network', help='network.json from dom_inventory.cjs or HAR file')
    ap.add_argument('--out', default='msw-handlers.ts', help='Output file')
    ap.add_argument('--base-url', default='', help='Base URL to strip from paths (auto-detected if empty)')
    ap.add_argument('--format', choices=['typescript', 'javascript'], default='typescript')
    ap.add_argument('--group-by', choices=['domain', 'endpoint', 'none'], default='domain')
    ap.add_argument('--include-failures', action='store_true', help='Include 4xx/5xx responses')
    ap.add_argument('--dry-run', action='store_true', help='Print to stdout')
    a = ap.parse_args()
    
    with open(a.network, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle HAR format
    if isinstance(data, dict) and 'log' in data and 'entries' in data['log']:
        entries = data['log']['entries']
        records = []
        for e in entries:
            req = e.get('request', {})
            res = e.get('response', {})
            post_data_obj = req.get('postData') or {}
            timings = e.get('timings') or {}
            wait = max(0, timings.get('wait') or 0)
            receive = max(0, timings.get('receive') or 0)
            duration = max(0, wait + receive)
            records.append({
                'url': req.get('url', ''),
                'method': req.get('method', 'GET'),
                'status': res.get('status', 200),
                'contentType': (res.get('content') or {}).get('mimeType', 'application/json'),
                'postData': post_data_obj.get('text'),
                'duration': duration,
            })
    else:
        # Already in our network.json format
        records = data if isinstance(data, list) else [data]
    
    # Filter out records without url and static assets
    STATIC_EXTS = ('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.css', '.js', '.map', '.woff', '.woff2', '.ttf', '.otf', '.eot')
    filtered = []
    for r in records:
        url = r.get('url', '')
        if not url:
            continue
        parsed_path = urlparse(url).path.lower()
        if any(parsed_path.endswith(ext) for ext in STATIC_EXTS):
            continue
        filtered.append(r)
    
    print(f"Processing {len(filtered)} network requests (filtered from {len(records)})")
    
    # Auto-detect base URL
    base_url = a.base_url
    if not base_url and filtered and filtered[0].get('url'):
        parsed = urlparse(filtered[0]['url'])
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        print(f"Auto-detected base URL: {base_url}")
    
    # Group by domain
    groups = defaultdict(list)
    for r in filtered:
        parsed = urlparse(r['url'])
        domain = parsed.netloc
        if a.group_by == 'domain':
            groups[domain].append(r)
        elif a.group_by == 'endpoint':
            path = parsed.path.split('/')[1] if parsed.path else 'root'
            groups[path].append(r)
        else:
            groups['all'].append(r)
    
    all_handlers = []
    all_names = []
    handler_counter = 0
    
    for group_name, group_records in groups.items():
        group_handlers = []
        for req in group_records:
            if is_graphql_record(req):
                continue
            if not a.include_failures and req.get('status', 200) >= 400:
                continue
            handler_counter += 1
            handler, name = generate_handler(req, handler_counter, base_url)
            group_handlers.append(handler)
            all_names.append(name)
        
        if group_handlers:
            if a.group_by != 'none':
                all_handlers.append(f"// --- {group_name} ---")
            all_handlers.extend(group_handlers)
    
    # Add GraphQL handlers
    gql_handlers, gql_names = generate_graphql_handlers(filtered, base_url)
    if gql_handlers:
        all_handlers.append('\n// --- GraphQL ---')
        all_handlers.append(gql_handlers)
        all_names.extend(gql_names)
    
    # Build output
    handler_list = ',\n'.join(f'  {name}' for name in all_names)
    handlers_str = '\n\n'.join(all_handlers)
    
    template = MSW_TEMPLATE_TS if a.format == 'typescript' else MSW_TEMPLATE_JS
    from datetime import datetime
    output = template.format(
        source_file=a.network,
        timestamp=datetime.now().isoformat(),
        handlers=handlers_str,
        handler_list=handler_list,
    )
    
    if a.dry_run:
        print(output)
    else:
        Path(a.out).write_text(output, encoding='utf-8')
        print(f"Generated: {a.out}")
        print(f"\nTo use in tests:")
        print(f"  import {{ handlers }} from './{Path(a.out).name}';")
        print(f"  import {{ setupServer }} from 'msw/node';")
        print(f"  const server = setupServer(...handlers);")
        print(f"  beforeAll(() => server.listen());")
        print(f"  afterEach(() => server.resetHandlers());")
        print(f"  afterAll(() => server.close());")

if __name__ == '__main__':
    main()
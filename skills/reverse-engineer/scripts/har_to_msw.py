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
    base_parsed = urlparse(base_url)
    
    # Remove base URL
    path = parsed.path
    if base_parsed.path != '/':
        if path.startswith(base_parsed.path):
            path = path[len(base_parsed.path):]
    
    # Convert path segments that look like IDs to params
    segments = path.strip('/').split('/')
    param_segments = []
    for seg in segments:
        if re.match(r'^[0-9a-fA-F-]{8,}$', seg) or re.match(r'^\d+$', seg):
            param_segments.append(f':{sanitize_name(seg)}')
        else:
            param_segments.append(seg)
    
    return '/' + '/'.join(param_segments) if param_segments else '/'

def generate_handler(req, idx, base_url):
    """Generate a single MSW handler."""
    method = req.get('method', 'GET').lower()
    url = req.get('url', '')
    status = req.get('status', 200)
    content_type = req.get('contentType', 'application/json')
    post_data = req.get('postData')
    
    path = extract_path_params(url, base_url)
    
    # Generate response
    if content_type.startswith('application/json'):
        response_body = '{}'
        if 'response' in req and req['response']:
            try:
                response_body = json.dumps(req['response'], indent=2)
            except:
                response_body = '{}'
    else:
        response_body = '""'
    
    # Generate handler
    handler_name = f"handler{idx}_{sanitize_name(method)}_{sanitize_name(path.replace('/', '_').strip('_'))}"
    
    # Request body matcher for POST/PUT/PATCH
    request_matchers = []
    if post_data and method in ('post', 'put', 'patch'):
        try:
            body = json.loads(post_data) if isinstance(post_data, str) else post_data
            # Create a loose matcher
            request_matchers.append(f"body: {json.dumps(body, indent=4)}")
        except:
            pass
    
    matchers = ',\n'.join(request_matchers)
    options_str = f",\n  {{ {matchers} }}" if matchers else ""
    
    # Delay simulation
    delay_ms = req.get('duration', 0) or 0
    delay_str = f"await delay({delay_ms});\n    " if delay_ms > 0 else ""
    
    # Error simulation for failed requests
    error_str = ""
    if status >= 400:
        error_str = f"\n    if (Math.random() < 0.1) {{\n      return HttpResponse.json({{ error: 'Simulated failure' }}, {{ status: 500 }});\n    }}"
    
    handler = (
        f"const {handler_name} = http.{method}('{base_url}{path}'{options_str}, async () => {{\n"
        f"  {delay_str}return HttpResponse.json({response_body}, {{\n"
        f"    status: {status},\n"
        f"    headers: {{\n"
        f"      'Content-Type': '{content_type}',\n"
        f"    }},\n"
        f"  }});\n"
        f"{error_str}\n"
        f"}});"
    )
    
    return handler, handler_name

def generate_graphql_handlers(records, base_url):
    """Generate GraphQL handlers from detected GraphQL requests."""
    graphql_requests = []
    for r in records:
        if r.get('type') == 'graphql' or (r.get('url', '').endswith('/graphql') and r.get('method') == 'POST'):
            graphql_requests.append(r)
    
    if not graphql_requests:
        return '', []
    
    handlers = []
    names = []
    for idx, req in enumerate(graphql_requests):
        post_data = req.get('postData', '{}')
        try:
            body = json.loads(post_data) if isinstance(post_data, str) else post_data
            operation_name = body.get('operationName', f'Operation{idx}')
            query = body.get('query', '')
        except:
            operation_name = f'Operation{idx}'
            query = ''
        
        handler_name = f"graphql{sanitize_name(operation_name)}"
        handler = (
            f"const {handler_name} = graphql.query('{operation_name}', async () => {{\n"
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
            req = e['request']
            res = e['response']
            records.append({
                'url': req['url'],
                'method': req['method'],
                'status': res['status'],
                'contentType': res.get('content', {}).get('mimeType', 'application/json'),
                'postData': req.get('postData', {}).get('text'),
                'duration': e.get('timings', {}).get('wait', 0) + e.get('timings', {}).get('receive', 0),
            })
    else:
        # Already in our network.json format
        records = data if isinstance(data, list) else [data]
    
    # Filter out static assets unless they're fonts
    filtered = []
    for r in records:
        url = r.get('url', '')
        ctype = r.get('contentType', '')
        if any(url.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.css', '.js', '.map', '.woff', '.woff2', '.ttf', '.otf', '.eot')):
            if not any(url.endswith(ext) for ext in ('.woff', '.woff2', '.ttf', '.otf', '.eot')):
                continue
        filtered.append(r)
    
    print(f"Processing {len(filtered)} network requests (filtered from {len(records)})")
    
    # Auto-detect base URL
    base_url = a.base_url
    if not base_url and filtered:
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
    
    for group_name, group_records in groups.items():
        if a.group_by != 'none':
            all_handlers.append(f"// --- {group_name} ---")
        
        for idx, req in enumerate(group_records):
            if not a.include_failures and req.get('status', 200) >= 400:
                continue
            handler, name = generate_handler(req, idx, base_url)
            all_handlers.append(handler)
            all_names.append(name)
    
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
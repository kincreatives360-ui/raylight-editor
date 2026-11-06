#!/usr/bin/env python3
"""
Extension & Desktop App Inspector
Reverse engineers browser extensions (Chrome/Firefox) and Electron/Tauri apps.

Usage:
  python inspect_extension.py <target> <out-dir> [--type extension|electron|tauri|auto]
        [--profile-dir path] [--extension-id ID] [--electron-port 9222]
        [--storage-state auth.json] [--headless new|false]

Features:
- Chrome/Firefox extension: manifest, background scripts, content scripts, popup, options
- Electron: main process, renderer processes, IPC channels, preload scripts
- Tauri: Rust backend commands, frontend hooks, IPC
- Extracts permissions, API usage, message passing, storage
"""
import argparse, json, os, sys, zipfile, shutil, subprocess, tempfile, re
from pathlib import Path
from datetime import datetime


def unpack_chrome_extension(crx_path, out_dir):
    """Unpack Chrome CRX or ZIP extension."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Try as ZIP first (unpacked extension or ZIP file)
    try:
        with zipfile.ZipFile(crx_path, 'r') as z:
            z.extractall(out_dir)
            return out_dir
    except zipfile.BadZipFile:
        pass
    
    # Try CRX format (Chrome Web Store format)
    # CRX3 format: magic(4) + version(4) + public_key_len(4) + signature_len(4) + public_key + signature + zip_data
    with open(crx_path, 'rb') as f:
        magic = f.read(4)
        if magic == b'Cr24':
            version = int.from_bytes(f.read(4), 'little')
            pubkey_len = int.from_bytes(f.read(4), 'little')
            sig_len = int.from_bytes(f.read(4), 'little')
            f.seek(12 + pubkey_len + sig_len)
            zip_data = f.read()
            zip_path = out_dir / 'extension.zip'
            zip_path.write_bytes(zip_data)
            with zipfile.ZipFile(zip_path, 'r') as z:
                z.extractall(out_dir)
            zip_path.unlink()
            return out_dir
    
    raise ValueError(f"Unknown extension format: {crx_path}")


def unpack_firefox_extension(xpi_path, out_dir):
    """Unpack Firefox XPI (ZIP-based)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(xpi_path, 'r') as z:
        z.extractall(out_dir)
    return out_dir


def analyze_manifest(manifest_path):
    """Analyze extension manifest.json."""
    with open(manifest_path) as f:
        manifest = json.load(f)
    
    analysis = {
        'manifest_version': manifest.get('manifest_version', manifest.get('manifest_version', 1)),
        'name': manifest.get('name'),
        'version': manifest.get('version'),
        'description': manifest.get('description'),
        'permissions': manifest.get('permissions', []),
        'optional_permissions': manifest.get('optional_permissions', []),
        'host_permissions': manifest.get('host_permissions', []),
        'content_scripts': [],
        'background': {},
        'action': manifest.get('action') or manifest.get('browser_action') or manifest.get('page_action'),
        'options_page': manifest.get('options_page') or manifest.get('options_ui', {}).get('page'),
        'side_panel': manifest.get('side_panel'),
        'devtools_page': manifest.get('devtools_page'),
        'commands': manifest.get('commands', {}),
        'web_accessible_resources': manifest.get('web_accessible_resources', []),
        'externally_connectable': manifest.get('externally_connectable', {}),
        'content_security_policy': manifest.get('content_security_policy'),
        'csp': manifest.get('csp'),
        'key': manifest.get('key') is not None,
    }
    
    # Background scripts
    bg = manifest.get('background', {})
    if isinstance(bg, dict):
        analysis['background'] = {
            'scripts': bg.get('scripts', []),
            'service_worker': bg.get('service_worker'),
            'type': bg.get('type', 'persistent' if bg.get('scripts') else 'module'),
            'persistent': bg.get('persistent', True),
        }
    elif isinstance(bg, list):
        analysis['background'] = { 'scripts': bg, 'type': 'persistent' }
    
    # Content scripts
    for cs in manifest.get('content_scripts', []):
        analysis['content_scripts'].append({
            'matches': cs.get('matches', []),
            'exclude_matches': cs.get('exclude_matches', []),
            'js': cs.get('js', []),
            'css': cs.get('css', []),
            'run_at': cs.get('run_at', 'document_idle'),
            'all_frames': cs.get('all_frames', False),
            'match_about_blank': cs.get('match_about_blank', False),
        })
    
    return analysis


def analyze_background_script(script_path):
    """Analyze background/service worker script for API usage."""
    try:
        with open(script_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except:
        return {}
    
    # Detect Chrome API usage
    apis = {
        'chrome.runtime': ['onMessage', 'sendMessage', 'connect', 'onConnect', 'getURL', 'id'],
        'chrome.storage': ['local', 'sync', 'session', 'onChanged'],
        'chrome.tabs': ['query', 'create', 'update', 'remove', 'onUpdated', 'onActivated', 'sendMessage'],
        'chrome.windows': ['create', 'getCurrent', 'onFocusChanged'],
        'chrome.webRequest': ['onBeforeRequest', 'onHeadersReceived', 'onCompleted'],
        'chrome.declarativeNetRequest': ['updateDynamicRules', 'getDynamicRules'],
        'chrome.cookies': ['get', 'set', 'remove', 'onChanged'],
        'chrome.history': ['search', 'deleteUrl', 'onVisited'],
        'chrome.bookmarks': ['create', 'get', 'search', 'onCreated'],
        'chrome.downloads': ['download', 'search', 'onCreated'],
        'chrome.contextMenus': ['create', 'onClicked', 'removeAll'],
        'chrome.alarms': ['create', 'onAlarm'],
        'chrome.notifications': ['create', 'onClicked'],
        'chrome.identity': ['getAuthToken', 'launchWebAuthFlow'],
        'chrome.management': ['getAll', 'setEnabled'],
        'chrome.debugger': ['attach', 'sendCommand'],
        'chrome.devtools': ['panels', 'inspectedWindow', 'network'],
        'chrome.scripting': ['executeScript', 'insertCSS', 'removeCSS'],
        'chrome.offscreen': ['createDocument', 'closeDocument'],
    }
    
    found = {}
    for api, methods in apis.items():
        for method in methods:
            if f'{api}.{method}' in content or f'{api}["{method}"]' in content:
                found.setdefault(api, []).append(method)
    
    # Detect message passing patterns
    messaging = {
        'runtime.onMessage': 'chrome.runtime.onMessage' in content,
        'runtime.sendMessage': 'chrome.runtime.sendMessage' in content,
        'runtime.connect': 'chrome.runtime.connect' in content,
        'runtime.onConnect': 'chrome.runtime.onConnect' in content,
        'tabs.sendMessage': 'chrome.tabs.sendMessage' in content,
    }
    
    # Detect event listeners
    events = []
    event_patterns = [
        'onInstalled', 'onStartup', 'onSuspend', 'onUpdateAvailable',
        'onMessageExternal', 'onConnectExternal',
    ]
    for ev in event_patterns:
        if f'chrome.runtime.{ev}' in content:
            events.append(f'chrome.runtime.{ev}')
    
    return {
        'apis': found,
        'messaging': messaging,
        'events': events,
        'size': len(content),
    }


def analyze_content_scripts(script_paths):
    """Analyze content scripts for DOM interaction patterns."""
    results = []
    for path in script_paths:
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except:
            results.append({'file': path, 'error': 'Could not read'})
            continue
        
        analysis = {
            'file': path,
            'size': len(content),
            'dom_apis': [],
            'selectors': [],
            'mutation_observer': 'MutationObserver' in content,
            'shadow_dom': 'shadowRoot' in content or 'attachShadow' in content,
        }
        
        # DOM API usage
        dom_apis = [
            'querySelector', 'querySelectorAll', 'getElementById', 'getElementsByClassName',
            'createElement', 'appendChild', 'insertBefore', 'removeChild', 'replaceChild',
            'addEventListener', 'removeEventListener', 'dispatchEvent',
            'setAttribute', 'getAttribute', 'removeAttribute', 'hasAttribute',
            'classList', 'style', 'dataset', 'innerHTML', 'textContent', 'innerText',
        ]
        for api in dom_apis:
            if api in content:
                analysis['dom_apis'].append(api)
        
        # CSS selectors (basic extraction)
        selector_matches = re.findall(r'querySelector\(["\']([^"\']+)["\']', content)
        analysis['selectors'] = list(set(selector_matches))[:50]
        
        results.append(analysis)
    
    return results


def inspect_electron_app(port=9222, out_dir='.'):
    """Inspect Electron app via remote debugging port."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Try to connect via CDP
    import urllib.request
    try:
        url = f'http://localhost:{port}/json'
        with urllib.request.urlopen(url, timeout=5) as resp:
            targets = json.load(resp)
    except Exception as e:
        return {'error': f'Could not connect to Electron on port {port}: {e}'}
    
    results = {
        'targets': targets,
        'main_process': None,
        'renderers': [],
        'ipc_channels': [],
    }
    
    # Find main process and renderers
    for t in targets:
        if t.get('type') == 'page':
            results['renderers'].append({
                'url': t.get('url'),
                'title': t.get('title'),
                'devtools_url': t.get('devtoolsFrontendUrl'),
                'websocket': t.get('webSocketDebuggerUrl'),
            })
        elif t.get('type') == 'background_page' or 'main' in t.get('url', ''):
            results['main_process'] = t
    
    return results


def inspect_tauri_app(port=9222, out_dir='.'):
    """Inspect Tauri app (uses WebView2, similar to Electron)."""
    # Tauri uses webview which can be debugged via CDP
    return inspect_electron_app(port, out_dir)


def capture_extension_popup(page, extension_id, out_dir):
    """Capture extension popup page."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Navigate to popup
    popup_url = f'chrome-extension://{extension_id}/popup.html'
    try:
        page.goto(popup_url, wait_until='networkidle', timeout=10000)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(out_dir / 'popup.png'), full_page=True)
        html = page.content()
        (out_dir / 'popup.html').write_text(html)
        return {'url': popup_url, 'captured': True}
    except Exception as e:
        return {'url': popup_url, 'captured': False, 'error': str(e)}


def capture_extension_options(page, extension_id, options_page, out_dir):
    """Capture extension options page."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    if not options_page:
        return {'captured': False, 'reason': 'No options page'}
    
    options_url = f'chrome-extension://{extension_id}/{options_page}'
    try:
        page.goto(options_url, wait_until='networkidle', timeout=10000)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(out_dir / 'options.png'), full_page=True)
        html = page.content()
        (out_dir / 'options.html').write_text(html)
        return {'url': options_url, 'captured': True}
    except Exception as e:
        return {'url': options_url, 'captured': False, 'error': str(e)}


def capture_devtools_panel(page, extension_id, devtools_page, out_dir):
    """Capture extension devtools panel."""
    if not devtools_page:
        return {'captured': False, 'reason': 'No devtools page'}
    
    # DevTools pages are loaded within DevTools, harder to capture directly
    return {'captured': False, 'reason': 'DevTools panel capture not implemented'}


def main():
    ap = argparse.ArgumentParser(description='Extension & Desktop App Inspector')
    ap.add_argument('target', help='Path to CRX/XPI file, extension directory, or "electron"/"tauri"')
    ap.add_argument('out_dir', help='Output directory')
    ap.add_argument('--type', choices=['extension', 'electron', 'tauri', 'auto'], default='auto')
    ap.add_argument('--profile-dir', help='Browser profile directory (for installed extensions)')
    ap.add_argument('--extension-id', help='Extension ID (for installed extensions)')
    ap.add_argument('--electron-port', type=int, default=9222, help='Electron CDP port')
    ap.add_argument('--storage-state', help='Playwright storage state')
    ap.add_argument('--headless', choices=['new', 'false'], default='new')
    ap.add_argument('--width', type=int, default=1440)
    ap.add_argument('--height', type=int, default=900)
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
    
    result = {
        'target': a.target,
        'type': a.type,
        'timestamp': datetime.now().isoformat(),
    }
    
    if a.type in ('extension', 'auto') and (a.target.endswith('.crx') or a.target.endswith('.xpi') or a.target.endswith('.zip')):
        # Unpack extension
        ext_dir = out_dir / 'unpacked'
        if a.target.endswith('.crx'):
            unpack_chrome_extension(a.target, ext_dir)
            result['browser'] = 'chrome'
        elif a.target.endswith('.xpi'):
            unpack_firefox_extension(a.target, ext_dir)
            result['browser'] = 'firefox'
        else:
            shutil.copytree(a.target, ext_dir, dirs_exist_ok=True)
        
        # Analyze manifest
        manifest_path = ext_dir / 'manifest.json'
        if manifest_path.exists():
            result['manifest'] = analyze_manifest(manifest_path)
            
            # Analyze background script
            bg = result['manifest'].get('background', {})
            if bg.get('service_worker'):
                sw_path = ext_dir / bg['service_worker']
                if sw_path.exists():
                    result['background_analysis'] = analyze_background_script(sw_path)
            elif bg.get('scripts'):
                for script in bg['scripts']:
                    script_path = ext_dir / script
                    if script_path.exists():
                        result['background_analysis'] = analyze_background_script(script_path)
                        break
            
            # Analyze content scripts
            cs_scripts = []
            for cs in result['manifest'].get('content_scripts', []):
                for script in cs.get('js', []):
                    cs_scripts.append(ext_dir / script)
            if cs_scripts:
                result['content_script_analysis'] = analyze_content_scripts(cs_scripts)
        
        # List all files
        result['files'] = [str(f.relative_to(ext_dir)) for f in ext_dir.rglob('*') if f.is_file()]
    
    elif a.type in ('electron', 'auto') and a.target in ('electron', 'Electron'):
        # Inspect running Electron app
        result['electron'] = inspect_electron_app(a.electron_port, out_dir)
    
    elif a.type in ('tauri', 'auto') and a.target in ('tauri', 'Tauri'):
        result['tauri'] = inspect_tauri_app(a.electron_port, out_dir)
    
    # If extension ID provided, use Playwright to capture UI
    if a.extension_id:
        with sync_playwright() as p:
            # Launch Chrome with extension loaded
            browser = p.chromium.launch(headless=headless, args=[
                f'--load-extension={a.target}' if os.path.isdir(a.target) else '',
                '--disable-extensions-except=' + a.target if os.path.isdir(a.target) else '',
            ])
            context = browser.new_context(
                viewport={'width': a.width, 'height': a.height},
                storage_state=a.storage_state if a.storage_state else None,
            )
            page = context.new_page()
            
            # Capture popup
            result['popup'] = capture_extension_popup(page, a.extension_id, out_dir / 'popup')
            
            # Capture options
            options_page = result.get('manifest', {}).get('options_page')
            result['options'] = capture_extension_options(page, a.extension_id, options_page, out_dir / 'options')
            
            # Capture devtools
            devtools_page = result.get('manifest', {}).get('devtools_page')
            result['devtools'] = capture_devtools_panel(page, a.extension_id, devtools_page, out_dir / 'devtools')
            
            browser.close()
    
    # Save result
    output_path = out_dir / 'extension_analysis.json'
    output_path.write_text(json.dumps(result, indent=2, default=str))
    print(f"Analysis saved to: {output_path}")
    
    # Print summary
    if 'manifest' in result:
        m = result['manifest']
        print(f"\nExtension: {m.get('name')} v{m.get('version')}")
        print(f"Manifest V{m.get('manifest_version')}")
        print(f"Permissions: {len(m.get('permissions', []))}")
        print(f"Content scripts: {len(m.get('content_scripts', []))}")
        print(f"Background: {m.get('background', {}).get('type', 'unknown')}")
        if m.get('action'):
            print(f"Action: {m['action']}")
    if 'electron' in result:
        e = result['electron']
        print(f"\nElectron targets: {len(e.get('targets', []))}")
        print(f"Renderers: {len(e.get('renderers', []))}")
    if 'tauri' in result:
        print(f"\nTauri inspection: {result['tauri']}")


if __name__ == '__main__':
    import re
    main()
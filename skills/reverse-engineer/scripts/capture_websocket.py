#!/usr/bin/env python3
"""
WebSocket & Real-time Collaboration Capture
Captures and analyzes WebSocket traffic for reverse engineering real-time apps.

Usage:
  python capture_websocket.py <url> <out-dir> [--duration 60] [--filter regex]
        [--storage-state auth.json] [--headless new|false] [--steps steps.json]
        [--decode-protobuf] [--protobuf-defs path] [--inject-hooks]

Features:
- Captures all WebSocket frames (client→server, server→client)
- Attempts automatic protocol detection (JSON, MessagePack, Protocol Buffers, custom)
- Tracks connection lifecycle (open, close, error, reconnect)
- Correlates messages with DOM mutations/user actions
- Generates message sequence diagrams
- Exports to PCAP-like format for Wireshark analysis
- Injects hooks to capture send/receive before encryption
"""
import argparse, json, os, sys, re, time, base64
from pathlib import Path
from datetime import datetime
from collections import defaultdict

try:
    import msgpack
    HAS_MSGPACK = True
except ImportError:
    HAS_MSGPACK = False


INJECTION_SCRIPT = r'''
(() => {
  window.__wsInspector = {
    connections: [],
    messages: [],
    mutations: [],
    actions: [],
  };
  
  // Hook WebSocket constructor with construct trap
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args) {
      const ws = Reflect.construct(target, args);
      const url = args[0];
      const protocols = args[1];
      const connId = 'ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      
      const connInfo = {
        id: connId,
        url: url,
        protocols: protocols,
        readyState: ws.readyState,
        createdAt: performance.now(),
        sent: 0,
        received: 0,
      };
      window.__wsInspector.connections.push(connInfo);
      
      // Hook send
      const originalSend = ws.send.bind(ws);
      ws.send = function(data) {
        const msg = {
          timestamp: performance.now(),
          connectionId: connId,
          direction: 'outgoing',
          data: data,
          type: typeof data,
          size: data?.byteLength || data?.length || 0,
        };
        window.__wsInspector.messages.push(msg);
        connInfo.sent++;
        if (window.__wsInspector.messages.length > 5000) window.__wsInspector.messages.shift();
        return originalSend(data);
      };
      
      // Track incoming messages and lifecycle via addEventListener
      ws.addEventListener('message', (event) => {
        const msg = {
          timestamp: performance.now(),
          connectionId: connId,
          direction: 'incoming',
          data: event.data,
          type: typeof event.data,
          size: event.data?.byteLength || event.data?.length || 0,
        };
        window.__wsInspector.messages.push(msg);
        connInfo.received++;
        if (window.__wsInspector.messages.length > 5000) window.__wsInspector.messages.shift();
      });
      
      ws.addEventListener('open', (event) => {
        connInfo.readyState = ws.readyState;
        connInfo.openedAt = performance.now();
      });
      
      ws.addEventListener('close', (event) => {
        connInfo.readyState = ws.readyState;
        connInfo.closedAt = performance.now();
        connInfo.closeCode = event.code;
        connInfo.closeReason = event.reason;
        connInfo.wasClean = event.wasClean;
      });
      
      ws.addEventListener('error', (event) => {
        connInfo.error = { timestamp: performance.now() };
      });
      
      return ws;
    }
  });
  
  // Hook EventSource (SSE) with construct trap
  const OriginalEventSource = window.EventSource;
  window.EventSource = new Proxy(OriginalEventSource, {
    construct(target, args) {
      const es = Reflect.construct(target, args);
      const url = args[0];
      const connId = 'sse_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      
      const connInfo = {
        id: connId,
        url: url,
        type: 'EventSource',
        createdAt: performance.now(),
      };
      window.__wsInspector.connections.push(connInfo);
      
      const recordedEvents = new Set(['message']);
      function recordEvent(type, event) {
        const msg = {
          timestamp: performance.now(),
          connectionId: connId,
          direction: 'incoming',
          eventType: type,
          data: event.data,
          type: typeof event.data,
          lastEventId: event.lastEventId,
        };
        window.__wsInspector.messages.push(msg);
        if (window.__wsInspector.messages.length > 5000) window.__wsInspector.messages.shift();
      }
      es.addEventListener('message', (e) => recordEvent('message', e));
      const origAddEventListener = es.addEventListener.bind(es);
      es.addEventListener = function(type, listener, options) {
        if (!recordedEvents.has(type) && type !== 'open' && type !== 'error') {
          recordedEvents.add(type);
          origAddEventListener(type, (e) => recordEvent(type, e));
        }
        return origAddEventListener(type, listener, options);
      };
      
      return es;
    }
  });
  
  // Hook fetch for streaming responses
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const requestId = 'fetch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const startTime = performance.now();
    
    return originalFetch.apply(this, args).then(response => {
      // Check if it's a streaming response without locking stream
      if (response.body) {
        const streamConn = {
          id: requestId,
          url: args[0],
          type: 'ReadableStream',
          createdAt: startTime,
          isStreaming: true,
        };
        window.__wsInspector.connections.push(streamConn);
      }
      return response;
    });
  };
  
  // Record user actions for correlation
  function pushAction(action) {
    window.__wsInspector.actions.push(action);
    if (window.__wsInspector.actions.length > 5000) window.__wsInspector.actions.shift();
  }
  
  document.addEventListener('click', (e) => {
    pushAction({
      timestamp: performance.now(),
      type: 'click',
      target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
      x: e.clientX,
      y: e.clientY,
    });
  }, true);
  
  document.addEventListener('keydown', (e) => {
    pushAction({
      timestamp: performance.now(),
      type: 'keydown',
      key: e.key,
      code: e.code,
      target: e.target.tagName,
    });
  }, true);
  
  document.addEventListener('input', (e) => {
    pushAction({
      timestamp: performance.now(),
      type: 'input',
      target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
      value: e.target.value?.slice(0, 100),
    });
  }, true);
  
  // Record DOM mutations
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (m.type === 'childList' && m.addedNodes.length) {
        window.__wsInspector.mutations.push({
          timestamp: performance.now(),
          type: 'childList',
          added: m.addedNodes.length,
          removed: m.removedNodes.length,
          parent: m.target.tagName + (m.target.id ? '#' + m.target.id : ''),
        });
      } else if (m.type === 'attributes') {
        window.__wsInspector.mutations.push({
          timestamp: performance.now(),
          type: 'attributes',
          attribute: m.attributeName,
          target: m.target.tagName + (m.target.id ? '#' + m.target.id : ''),
        });
      }
      if (window.__wsInspector.mutations.length > 5000) window.__wsInspector.mutations.shift();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  window.__wsInspector._observer = observer;
})();
'''


def decode_message(data):
    """Attempt to decode message as various formats."""
    if isinstance(data, (bytes, bytearray)):
        # Try UTF-8
        try:
            return data.decode('utf-8'), 'utf-8'
        except UnicodeDecodeError:
            pass
        
        # Try base64
        try:
            decoded = base64.b64decode(data)
            try:
                return decoded.decode('utf-8'), 'base64->utf-8'
            except:
                return data.hex(), 'base64->hex'
        except:
            pass
        
        return data.hex(), 'hex'
    
    elif isinstance(data, str):
        # Try JSON
        try:
            parsed = json.loads(data)
            return json.dumps(parsed, indent=2), 'json'
        except:
            pass
        
        # Try msgpack if available
        if HAS_MSGPACK:
            try:
                decoded = msgpack.unpackb(data.encode('latin-1'), raw=False)
                return json.dumps(decoded, indent=2, default=str), 'msgpack'
            except:
                pass
        
        return data, 'string'
    
    return str(data), 'unknown'


def analyze_protocol(messages):
    """Analyze message patterns to infer protocol."""
    stats = {
        'total': len(messages),
        'incoming': 0,
        'outgoing': 0,
        'formats': defaultdict(int),
        'connections': set(),
        'message_types': defaultdict(int),
        'size_distribution': {'<100': 0, '100-1k': 0, '1k-10k': 0, '>10k': 0},
    }
    
    for msg in messages:
        direction = msg.get('direction', 'unknown')
        stats[direction] += 1
        stats['connections'].add(msg.get('connectionId'))
        
        data = msg.get('data')
        decoded, fmt = decode_message(data)
        stats['formats'][fmt] += 1
        
        size = msg.get('size', 0)
        if size < 100:
            stats['size_distribution']['<100'] += 1
        elif size < 1000:
            stats['size_distribution']['100-1k'] += 1
        elif size < 10000:
            stats['size_distribution']['1k-10k'] += 1
        else:
            stats['size_distribution']['>10k'] += 1
        
        # Infer message type from content
        if isinstance(decoded, str):
            if decoded.strip().startswith('{'):
                stats['message_types']['json'] += 1
                try:
                    obj = json.loads(decoded)
                    if 'type' in obj:
                        stats['message_types'][f'json:{obj["type"]}'] += 1
                    elif 'method' in obj:
                        stats['message_types'][f'json:method:{obj["method"]}'] += 1
                    elif 'event' in obj:
                        stats['message_types'][f'json:event:{obj["event"]}'] += 1
                except:
                    pass
            elif ' ' in decoded and not '\n' in decoded[:50]:
                # Possible space-separated protocol
                stats['message_types']['space_separated'] += 1
    
    stats['connections'] = len(stats['connections'])
    stats['formats'] = dict(stats['formats'])
    stats['message_types'] = dict(stats['message_types'])
    
    return stats


def generate_sequence_diagram(messages, actions, mutations, max_events=100):
    """Generate Mermaid sequence diagram."""
    lines = ['sequenceDiagram', '    autonumber']
    
    # Collect unique connections
    connections = set()
    for m in messages:
        connections.add(m.get('connectionId', 'unknown'))
    
    for conn in connections:
        lines.append(f'    participant {conn} as {conn[:20]}')
    
    lines.append('    participant User as User Actions')
    lines.append('    participant DOM as DOM Mutations')
    
    # Merge and sort events by timestamp
    all_events = []
    for m in messages[:max_events]:
        all_events.append(('msg', m.get('timestamp', 0), m))
    for a in actions[:max_events]:
        all_events.append(('action', a.get('timestamp', 0), a))
    for mut in mutations[:max_events]:
        all_events.append(('mutation', mut.get('timestamp', 0), mut))
    
    all_events.sort(key=lambda x: x[1])
    
    for ev_type, ts, ev in all_events[:max_events]:
        if ev_type == 'msg':
            conn = ev.get('connectionId', 'unknown')
            direction = ev.get('direction', '?')
            size = ev.get('size', 0)
            data_preview = ''
            if isinstance(ev.get('data'), str):
                data_preview = ev['data'][:50].replace('\n', '\\n').replace(';', ' ').replace('#', ' ')
            elif isinstance(ev.get('data'), (bytes, bytearray)):
                data_preview = f'<binary {len(ev["data"])} bytes>'
            
            if direction == 'outgoing':
                lines.append(f'    User ->> {conn}: outgoing ({size}b) {data_preview}')
            else:
                lines.append(f'    {conn} -->> User: incoming ({size}b) {data_preview}')
        
        elif ev_type == 'action':
            action_type = ev.get('type', 'action')
            target = ev.get('target', '').replace(';', ' ').replace('#', ' ')
            lines.append(f'    User ->> DOM: {action_type} {target}')
        
        elif ev_type == 'mutation':
            mut_type = ev.get('type', 'mutation')
            parent = ev.get('parent', '').replace(';', ' ').replace('#', ' ')
            lines.append(f'    DOM ->> User: {mut_type} {parent}')
    
    return '\n'.join(lines)


def save_pcap_like(messages, out_path):
    """Save messages in PCAP-like JSON format for analysis."""
    packets = []
    for i, msg in enumerate(messages):
        packets.append({
            'frame_number': i + 1,
            'timestamp': msg.get('timestamp', 0),
            'connection_id': msg.get('connectionId'),
            'direction': msg.get('direction'),
            'length': msg.get('size', 0),
            'data_type': type(msg.get('data')).__name__,
            'data_preview': str(msg.get('data'))[:200] if msg.get('data') else '',
        })
    
    with open(out_path, 'w') as f:
        json.dump({
            'format': 'ws-pcap-like',
            'version': 1,
            'captured_at': datetime.now().isoformat(),
            'packet_count': len(packets),
            'packets': packets,
        }, f, indent=2)


def main():
    if len(sys.argv) == 1:
        ap = argparse.ArgumentParser(description='WebSocket & Real-time Collaboration Capture')
        ap.add_argument('url', help='URL to inspect')
        ap.add_argument('out_dir', help='Output directory')
        ap.print_help()
        return

    ap = argparse.ArgumentParser(description='WebSocket & Real-time Collaboration Capture')
    ap.add_argument('url', help='URL to inspect')
    ap.add_argument('out_dir', help='Output directory')
    ap.add_argument('--duration', type=int, default=60, help='Capture duration in seconds')
    ap.add_argument('--filter', help='Regex filter for WebSocket URLs')
    ap.add_argument('--storage-state', help='Playwright storage state')
    ap.add_argument('--headless', choices=['new', 'false'], default='new')
    ap.add_argument('--steps', help='JSON file with pre-navigation steps')
    ap.add_argument('--no-inject-hooks', dest='inject_hooks', action='store_false', default=True, help='Disable WebSocket hook injection')
    ap.add_argument('--width', type=int, default=1440)
    ap.add_argument('--height', type=int, default=900)
    a = ap.parse_args()
    
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)
    
    headless = a.headless == 'new' or (a.headless == 'false' and False)
    out_dir = Path(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={'width': a.width, 'height': a.height},
            storage_state=a.storage_state if a.storage_state else None,
        )
        page = context.new_page()
        
        # Inject WebSocket hooks
        if a.inject_hooks:
            page.add_init_script(INJECTION_SCRIPT)
        
        # Also capture via CDP for raw frames before navigation
        cdp_ws_messages = []
        try:
            cdp = context.new_cdp_session(page)
            cdp.send('Network.enable')
            
            def on_ws_created(msg):
                cdp_ws_messages.append({'type': 'created', 'timestamp': time.time(), 'data': msg})
            
            def on_ws_frame_recv(msg):
                cdp_ws_messages.append({'type': 'frame', 'direction': 'incoming', 'timestamp': time.time(), 'data': msg})
            
            def on_ws_frame_sent(msg):
                cdp_ws_messages.append({'type': 'frame', 'direction': 'outgoing', 'timestamp': time.time(), 'data': msg})
            
            def on_ws_closed(msg):
                cdp_ws_messages.append({'type': 'closed', 'timestamp': time.time(), 'data': msg})
            
            cdp.on('Network.webSocketCreated', on_ws_created)
            cdp.on('Network.webSocketFrameReceived', on_ws_frame_recv)
            cdp.on('Network.webSocketFrameSent', on_ws_frame_sent)
            cdp.on('Network.webSocketClosed', on_ws_closed)
        except Exception as e:
            print(f"CDP capture not available: {e}")
            cdp = None
        
        # Navigate
        print(f"Navigating to {a.url}...")
        page.goto(a.url, wait_until='networkidle', timeout=60000)
        page.wait_for_timeout(2000)
        
        # Run pre-steps
        if a.steps:
            with open(a.steps) as f:
                steps = json.load(f)
            for step in steps:
                if step.get('action') == 'click':
                    page.click(step['selector'])
                elif step.get('action') == 'wait':
                    page.wait_for_timeout(step.get('ms', 1000))
                elif step.get('action') == 'key':
                    page.keyboard.press(step['value'])
                elif step.get('action') == 'hover':
                    page.hover(step['selector'])
                page.wait_for_timeout(500)
        
        # Wait and capture
        print(f"Capturing WebSocket traffic for {a.duration} seconds...")
        start = time.time()
        while time.time() - start < a.duration:
            page.wait_for_timeout(1000)
            elapsed = int(time.time() - start)
            if elapsed % 10 == 0:
                print(f"  {elapsed}s elapsed...")
        
        # Extract injected inspector data
        print("Extracting captured data...")
        inspector_data = page.evaluate("() => window.__wsInspector || {}")
        
        messages = inspector_data.get('messages', [])
        connections = inspector_data.get('connections', [])
        actions = inspector_data.get('actions', [])
        mutations = inspector_data.get('mutations', [])
        
        if a.filter:
            pattern = re.compile(a.filter)
            matching_ids = {c['id'] for c in connections if pattern.search(c.get('url', ''))}
            connections = [c for c in connections if c.get('id') in matching_ids]
            messages = [m for m in messages if m.get('connectionId') in matching_ids]
        
        print(f"Captured {len(messages)} messages across {len(connections)} connections")
        print(f"User actions: {len(actions)}")
        print(f"DOM mutations: {len(mutations)}")
        
        # Analyze protocol
        stats = analyze_protocol(messages)
        
        # Generate sequence diagram
        diagram = generate_sequence_diagram(messages, actions, mutations)
        
        # Save outputs
        # Raw messages
        messages_path = out_dir / 'ws_messages.json'
        messages_path.write_text(json.dumps(messages, indent=2, default=str))
        
        # Connections
        connections_path = out_dir / 'ws_connections.json'
        connections_path.write_text(json.dumps(connections, indent=2, default=str))
        
        # Stats
        stats_path = out_dir / 'ws_stats.json'
        stats_path.write_text(json.dumps(stats, indent=2, default=str))
        
        # Sequence diagram
        diagram_path = out_dir / 'ws_sequence.mmd'
        diagram_path.write_text(diagram)
        
        # PCAP-like
        pcap_path = out_dir / 'ws_capture.pcap.json'
        save_pcap_like(messages, pcap_path)
        
        # CDP messages
        if cdp_ws_messages:
            cdp_path = out_dir / 'ws_cdp_capture.json'
            cdp_path.write_text(json.dumps(cdp_ws_messages, indent=2, default=str))
        
        # Summary
        summary = {
            'url': a.url,
            'duration': a.duration,
            'timestamp': datetime.now().isoformat(),
            'connections': len(connections),
            'messages': len(messages),
            'actions': len(actions),
            'mutations': len(mutations),
            'stats': stats,
        }
        
        summary_path = out_dir / 'ws_summary.json'
        summary_path.write_text(json.dumps(summary, indent=2, default=str))
        
        print(f"\nResults saved to {out_dir}:")
        print(f"  Messages: {messages_path}")
        print(f"  Connections: {connections_path}")
        print(f"  Stats: {stats_path}")
        print(f"  Sequence diagram: {diagram_path}")
        print(f"  PCAP-like: {pcap_path}")
        print(f"  Summary: {summary_path}")
        
        # Print protocol analysis
        print(f"\nProtocol Analysis:")
        print(f"  Formats: {stats['formats']}")
        print(f"  Message types: {list(stats['message_types'].keys())[:10]}")
        print(f"  Size dist: {stats['size_distribution']}")
        
        browser.close()


if __name__ == '__main__':
    main()
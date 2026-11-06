#!/usr/bin/env python3
"""
Canvas/WebGL Deep Inspection Module
Analyzes canvas/WebGL/WASM applications by injecting inspection scripts.

Usage:
  python inspect_canvas.py <url> <out-dir> [--engine three|pixi|babylon|webgl|wasm|auto]
        [--duration 30] [--capture-frames] [--storage-state auth.json] [--headless new|false]

Features:
- Detects rendering engine (Three.js, PixiJS, Babylon.js, raw WebGL, WASM)
- Captures scene graph, draw calls, shader info, texture details
- Records animation frames with timing
- Extracts geometry, materials, lights, cameras
- Outputs structured JSON for reconstruction
"""
import argparse, json, os, sys, time, re
from pathlib import Path
from datetime import datetime

# Injection scripts for different engines
INJECTION_SCRIPTS = {
    'three': r'''
(() => {
  window.__canvasInspector = window.__canvasInspector || { frames: [], drawCalls: [] };
  window.__canvasInspector.three = null;
  
  function initThree(THREE) {
    if (!THREE || !THREE.WebGLRenderer || THREE.__inspectorHooked) return;
    THREE.__inspectorHooked = true;
    
    // Hook THREE.WebGLRenderer
    const originalRender = THREE.WebGLRenderer.prototype.render;
    THREE.WebGLRenderer.prototype.render = function(scene, camera) {
      const frame = {
        timestamp: performance.now(),
        scene: scene.uuid,
        camera: camera.uuid,
        objects: [],
      };
      
      // Traverse scene graph
      scene.traverse(obj => {
        if (obj.isMesh || obj.isLine || obj.isPoints || obj.isSprite) {
          frame.objects.push({
            uuid: obj.uuid,
            type: obj.type,
            name: obj.name,
            geometry: obj.geometry ? { uuid: obj.geometry.uuid, type: obj.geometry.type } : null,
            material: obj.material ? { uuid: obj.material.uuid, type: obj.material.type, transparent: obj.material.transparent, opacity: obj.material.opacity } : null,
            position: obj.position.toArray(),
            rotation: obj.rotation.toArray(),
            scale: obj.scale.toArray(),
            visible: obj.visible,
            frustumCulled: obj.frustumCulled,
            renderOrder: obj.renderOrder,
          });
        } else if (obj.isLight) {
          frame.objects.push({
            uuid: obj.uuid,
            type: obj.type,
            name: obj.name,
            color: obj.color ? obj.color.getHexString() : null,
            intensity: obj.intensity,
            position: obj.position.toArray(),
            target: obj.target ? obj.target.position.toArray() : null,
          });
        } else if (obj.isCamera) {
          frame.objects.push({
            uuid: obj.uuid,
            type: obj.type,
            name: obj.name,
            fov: obj.fov,
            aspect: obj.aspect,
            near: obj.near,
            far: obj.far,
            position: obj.position.toArray(),
          });
        }
      });
      
      window.__canvasInspector.frames.push(frame);
      if (window.__canvasInspector.frames.length > 300) window.__canvasInspector.frames.shift();
      
      const res = originalRender.apply(this, arguments);
      if (this.info && this.info.render) {
        window.__canvasInspector.drawCalls.push({
          timestamp: performance.now(),
          frame: this.info.render.frame,
          calls: this.info.render.calls,
          triangles: this.info.render.triangles,
          points: this.info.render.points,
          lines: this.info.render.lines,
        });
        if (window.__canvasInspector.drawCalls.length > 1000) window.__canvasInspector.drawCalls.shift();
      }
      return res;
    };
  }

  function hookWhenAvailable(prop, hookFn) {
    if (window[prop]) {
      try { hookFn(window[prop]); } catch (e) {}
      return;
    }
    let value;
    let hooked = false;
    try {
      Object.defineProperty(window, prop, {
        configurable: true,
        enumerable: true,
        get() { return value; },
        set(val) {
          value = val;
          if (!hooked && val) {
            hooked = true;
            try { hookFn(val); } catch (e) {}
          }
        }
      });
    } catch (e) {}
    window.addEventListener('DOMContentLoaded', () => { if (window[prop]) try { hookFn(window[prop]); } catch (e) {} });
    window.addEventListener('load', () => { if (window[prop]) try { hookFn(window[prop]); } catch (e) {} });
  }

  hookWhenAvailable('THREE', initThree);

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    this.__contextType = type;
    return originalGetContext.call(this, type, ...args);
  };
  
  // Auto-detect existing renderer
  setTimeout(() => {
    if (window.renderer && window.renderer.isWebGLRenderer) {
      window.__canvasInspector.three = {
        renderer: window.renderer.uuid,
        scene: window.scene?.uuid,
        camera: window.camera?.uuid,
      };
    }
  }, 1000);
})();
''',
    'pixi': r'''
(() => {
  window.__canvasInspector = window.__canvasInspector || { frames: [], drawCalls: [] };
  window.__canvasInspector.pixi = null;
  
  function initPixi(PIXI) {
    if (!PIXI || PIXI.__inspectorHooked) return;
    PIXI.__inspectorHooked = true;

    // Hook PIXI.Application render
    if (PIXI.Application) {
      const originalRender = PIXI.Application.prototype.render;
      PIXI.Application.prototype.render = function() {
        const frame = {
          timestamp: performance.now(),
          stageChildren: [],
        };
        
        if (this.stage) {
          this.stage.children.forEach(child => {
            frame.stageChildren.push({
              type: child.constructor.name,
              name: child.name,
              children: child.children?.length || 0,
              visible: child.visible,
              alpha: child.alpha,
              position: [child.x, child.y],
              scale: [child.scale.x, child.scale.y],
              rotation: child.rotation,
            });
          });
        }
        
        window.__canvasInspector.frames.push(frame);
        if (window.__canvasInspector.frames.length > 300) window.__canvasInspector.frames.shift();
        
        return originalRender.apply(this, arguments);
      };
    }
    
    // Hook renderer.plugins
    if (PIXI.Renderer) {
      const originalPluginRender = PIXI.Renderer.prototype.render;
      PIXI.Renderer.prototype.render = function() {
        const drawCalls = this.renderer?.drawCalls || 0;
        window.__canvasInspector.drawCalls = window.__canvasInspector.drawCalls || [];
        window.__canvasInspector.drawCalls.push({
          timestamp: performance.now(),
          drawCalls,
        });
        return originalPluginRender.apply(this, arguments);
      };
    }
  }

  function hookWhenAvailable(prop, hookFn) {
    if (window[prop]) {
      try { hookFn(window[prop]); } catch (e) {}
      return;
    }
    let value;
    let hooked = false;
    try {
      Object.defineProperty(window, prop, {
        configurable: true,
        enumerable: true,
        get() { return value; },
        set(val) {
          value = val;
          if (!hooked && val) {
            hooked = true;
            try { hookFn(val); } catch (e) {}
          }
        }
      });
    } catch (e) {}
    window.addEventListener('DOMContentLoaded', () => { if (window[prop]) try { hookFn(window[prop]); } catch (e) {} });
    window.addEventListener('load', () => { if (window[prop]) try { hookFn(window[prop]); } catch (e) {} });
  }

  hookWhenAvailable('PIXI', initPixi);

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    this.__contextType = type;
    return originalGetContext.call(this, type, ...args);
  };
  
  setTimeout(() => {
    if (window.app && window.PIXI && window.app instanceof window.PIXI.Application) {
      window.__canvasInspector.pixi = {
        app: true,
        renderer: window.app.renderer?.type,
        screen: window.app.screen ? [window.app.screen.width, window.app.screen.height] : null,
      };
    }
  }, 1000);
})();
''',
    'babylon': r'''
(() => {
  window.__canvasInspector = window.__canvasInspector || { frames: [] };
  window.__canvasInspector.babylon = null;
  
  function initBabylon(BABYLON) {
    if (!BABYLON || !BABYLON.Engine || BABYLON.__inspectorHooked) return;
    BABYLON.__inspectorHooked = true;

    // Hook BABYLON.Engine render
    const originalRender = BABYLON.Engine.prototype.render;
    BABYLON.Engine.prototype.render = function() {
      const frame = {
        timestamp: performance.now(),
        scenes: [],
      };
      
      this.scenes.forEach(scene => {
        const sceneData = {
          name: scene.name,
          meshes: [],
          lights: [],
          cameras: [],
        };
        
        scene.meshes.forEach(mesh => {
          sceneData.meshes.push({
            name: mesh.name,
            id: mesh.id,
            vertices: mesh.getTotalVertices?.(),
            material: mesh.material ? mesh.material.name : null,
            visible: Boolean(mesh.isVisible),
            position: mesh.position?.asArray(),
          });
        });
        
        scene.lights.forEach(light => {
          sceneData.lights.push({
            name: light.name,
            type: light.getTypeID?.(),
            intensity: light.intensity,
          });
        });
        
        scene.cameras.forEach(cam => {
          sceneData.cameras.push({
            name: cam.name,
            type: cam.getTypeID?.(),
            position: cam.position?.asArray(),
          });
        });
        
        frame.scenes.push(sceneData);
      });
      
      window.__canvasInspector.frames.push(frame);
      if (window.__canvasInspector.frames.length > 300) window.__canvasInspector.frames.shift();
      
      return originalRender.apply(this, arguments);
    };
  }

  function hookWhenAvailable(prop, hookFn) {
    if (window[prop]) {
      try { hookFn(window[prop]); } catch (e) {}
      return;
    }
    let value;
    let hooked = false;
    try {
      Object.defineProperty(window, prop, {
        configurable: true,
        enumerable: true,
        get() { return value; },
        set(val) {
          value = val;
          if (!hooked && val) {
            hooked = true;
            try { hookFn(val); } catch (e) {}
          }
        }
      });
    } catch (e) {}
    window.addEventListener('DOMContentLoaded', () => { if (window[prop]) try { hookFn(window[prop]); } catch (e) {} });
    window.addEventListener('load', () => { if (window[prop]) try { hookFn(window[prop]); } catch (e) {} });
  }

  hookWhenAvailable('BABYLON', initBabylon);

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    this.__contextType = type;
    return originalGetContext.call(this, type, ...args);
  };
  
  setTimeout(() => {
    if (window.engine && window.BABYLON && window.engine instanceof window.BABYLON.Engine) {
      window.__canvasInspector.babylon = {
        engine: true,
        scenes: window.engine.scenes?.length,
      };
    }
  }, 1000);
})();
''',
    'webgl': r'''
(() => {
  window.__canvasInspector = window.__canvasInspector || { drawCalls: [], shaders: [], textures: [], buffers: [] };
  window.__canvasInspector.webgl = null;
  
  let webglCaptured = false;
  function captureWebGLParams(gl) {
    if (webglCaptured || !gl) return;
    try {
      webglCaptured = true;
      window.__canvasInspector.webgl = {
        version: gl.getParameter(gl.VERSION),
        shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      };
    } catch (e) {}
  }

  function recordDrawCall(method, mode, count, args) {
    window.__canvasInspector.drawCalls = window.__canvasInspector.drawCalls || [];
    window.__canvasInspector.drawCalls.push({
      timestamp: performance.now(),
      method: method,
      mode: mode,
      count: count,
      args: args.map(a => typeof a === 'number' ? a : 'buffer'),
    });
    if (window.__canvasInspector.drawCalls.length > 1000) window.__canvasInspector.drawCalls.shift();
  }

  function instrumentWebGLPrototype(proto) {
    if (!proto) return;
    if (proto.drawArrays && !proto.__drawArraysHooked) {
      const orig = proto.drawArrays;
      proto.drawArrays = function(mode, first, count) {
        recordDrawCall('drawArrays', mode, count, [first, count]);
        return orig.call(this, mode, first, count);
      };
      proto.__drawArraysHooked = true;
    }
    if (proto.drawElements && !proto.__drawElementsHooked) {
      const orig = proto.drawElements;
      proto.drawElements = function(mode, count, type, offset) {
        recordDrawCall('drawElements', mode, count, [type, offset]);
        return orig.call(this, mode, count, type, offset);
      };
      proto.__drawElementsHooked = true;
    }
    if (proto.drawArraysInstanced && !proto.__drawArraysInstancedHooked) {
      const orig = proto.drawArraysInstanced;
      proto.drawArraysInstanced = function(mode, first, count, instanceCount) {
        recordDrawCall('drawArraysInstanced', mode, count, [first, count, instanceCount]);
        return orig.call(this, mode, first, count, instanceCount);
      };
      proto.__drawArraysInstancedHooked = true;
    }
    if (proto.drawElementsInstanced && !proto.__drawElementsInstancedHooked) {
      const orig = proto.drawElementsInstanced;
      proto.drawElementsInstanced = function(mode, count, type, offset, instanceCount) {
        recordDrawCall('drawElementsInstanced', mode, count, [type, offset, instanceCount]);
        return orig.call(this, mode, count, type, offset, instanceCount);
      };
      proto.__drawElementsInstancedHooked = true;
    }
    if (proto.compileShader && !proto.__compileShaderHooked) {
      const orig = proto.compileShader;
      proto.compileShader = function(shader) {
        try {
          const source = this.getShaderSource(shader);
          const type = this.getShaderParameter(shader, this.SHADER_TYPE);
          window.__canvasInspector.shaders.push({
            timestamp: performance.now(),
            type: type === this.VERTEX_SHADER ? 'vertex' : 'fragment',
            source: source ? source.slice(0, 5000) : '',
          });
        } catch (e) {}
        return orig.call(this, shader);
      };
      proto.__compileShaderHooked = true;
    }
    if (proto.texImage2D && !proto.__texImage2DHooked) {
      const orig = proto.texImage2D;
      proto.texImage2D = function(...args) {
        window.__canvasInspector.textures.push({
          timestamp: performance.now(),
          target: args[0],
          level: args[1],
          internalFormat: args[2],
          width: args[3],
          height: args[4],
        });
        return orig.apply(this, args);
      };
      proto.__texImage2DHooked = true;
    }
    if (proto.bufferData && !proto.__bufferDataHooked) {
      const orig = proto.bufferData;
      proto.bufferData = function(target, data, usage) {
        window.__canvasInspector.buffers.push({
          timestamp: performance.now(),
          target,
          size: data?.byteLength || data?.length,
          usage,
        });
        return orig.call(this, target, data, usage);
      };
      proto.__bufferDataHooked = true;
    }
  }

  if (typeof WebGLRenderingContext !== 'undefined') {
    instrumentWebGLPrototype(WebGLRenderingContext.prototype);
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    instrumentWebGLPrototype(WebGL2RenderingContext.prototype);
  }

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    this.__contextType = type;
    const ctx = originalGetContext.call(this, type, ...args);
    if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
      captureWebGLParams(ctx);
    }
    return ctx;
  };
})();
''',
    'wasm': r'''
(() => {
  window.__canvasInspector = window.__canvasInspector || { imports: [], exports: [] };
  window.__canvasInspector.wasm = null;
  window.__canvasInspector.memory = null;
  
  const importCallCounts = {};
  const MAX_IMPORT_SAMPLES = 500;

  function wrapImports(imports) {
    if (!imports) return imports;
    const wrapped = { ...imports };
    Object.keys(imports).forEach(ns => {
      wrapped[ns] = { ...imports[ns] };
      Object.keys(imports[ns]).forEach(fn => {
        const original = imports[ns][fn];
        if (typeof original === 'function') {
          const key = `${ns}.${fn}`;
          importCallCounts[key] = 0;
          wrapped[ns][fn] = function(...args) {
            importCallCounts[key] = (importCallCounts[key] || 0) + 1;
            if (window.__canvasInspector.imports.length < MAX_IMPORT_SAMPLES) {
              window.__canvasInspector.imports.push({
                timestamp: performance.now(),
                namespace: ns,
                function: fn,
                callCount: importCallCounts[key],
                args: args.map(a => typeof a),
              });
            }
            return original.apply(this, args);
          };
        }
      });
    });
    return wrapped;
  }

  function recordWasmInstance(result, bytesOrSource) {
    window.__canvasInspector.wasm = { modules: window.__canvasInspector.wasm?.modules || [] };
    const instance = (result && result.instance) ? result.instance : result;
    
    let size = null;
    if (bytesOrSource && (bytesOrSource.byteLength !== undefined || bytesOrSource.length !== undefined)) {
      size = bytesOrSource.byteLength || bytesOrSource.length;
    }
    
    const moduleInfo = {
      timestamp: performance.now(),
      size: size,
      exports: instance && instance.exports ? Object.keys(instance.exports) : [],
    };
    window.__canvasInspector.wasm.modules.push(moduleInfo);
    
    if (instance && instance.exports && instance.exports.memory) {
      window.__canvasInspector.memory = {
        initial: instance.exports.memory.buffer ? instance.exports.memory.buffer.byteLength : null,
      };
    }
  }

  const originalInstantiate = WebAssembly.instantiate;
  WebAssembly.instantiate = function(bytesOrModule, imports) {
    const wrappedImports = wrapImports(imports);
    return originalInstantiate.call(WebAssembly, bytesOrModule, wrappedImports || imports).then(result => {
      try {
        recordWasmInstance(result, bytesOrModule);
      } catch (e) {}
      return result;
    });
  };

  const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
  if (originalInstantiateStreaming) {
    WebAssembly.instantiateStreaming = function(source, imports) {
      const wrappedImports = wrapImports(imports);
      return originalInstantiateStreaming.call(WebAssembly, source, wrappedImports || imports).then(result => {
        try {
          recordWasmInstance(result, null);
        } catch (e) {}
        return result;
      });
    };
  }

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    this.__contextType = type;
    return originalGetContext.call(this, type, ...args);
  };
})();
''',
    'auto': r'''
(() => {
  window.__canvasInspector = window.__canvasInspector || { detected: [], frames: [] };
  
  // Detection checks
  const checks = [
    { name: 'three', check: () => window.THREE && (window.THREE.REVISION || window.THREE.WebGLRenderer) },
    { name: 'pixi', check: () => window.PIXI && (window.PIXI.VERSION || window.PIXI.Application) },
    { name: 'babylon', check: () => window.BABYLON && window.BABYLON.Engine },
    { name: 'fabric', check: () => window.fabric && window.fabric.version },
    { name: 'paper', check: () => window.paper && window.paper.version },
    { name: 'konva', check: () => window.Konva && window.Konva.version },
    { name: 'p5', check: () => window.p5 && window.p5.prototype },
    { name: 'two', check: () => window.Two && window.Two.version },
    { name: 'gsap', check: () => window.gsap && window.gsap.version },
    { name: 'lottie', check: () => window.lottie || window.bodymovin },
    { name: 'rive', check: () => window.rive },
  ];
  
  window.__canvasInspector.runDetection = function() {
    window.__canvasInspector.detected = window.__canvasInspector.detected || [];
    checks.forEach(c => {
      try {
        if (c.check() && !window.__canvasInspector.detected.includes(c.name)) {
          window.__canvasInspector.detected.push(c.name);
        }
      } catch (e) {}
    });
    return window.__canvasInspector.detected;
  };

  window.__canvasInspector.runDetection();
  window.addEventListener('DOMContentLoaded', () => window.__canvasInspector.runDetection());
  window.addEventListener('load', () => window.__canvasInspector.runDetection());
  
  // Hook requestAnimationFrame for frame timing
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    return originalRAF(function(timestamp) {
      window.__canvasInspector.frames.push({ timestamp });
      if (window.__canvasInspector.frames.length > 300) window.__canvasInspector.frames.shift();
      cb(timestamp);
    });
  };
  
  // Hook canvas context creation
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, attrs) {
    this.__contextType = type;
    const ctx = originalGetContext.call(this, type, attrs);
    if (type.includes('webgl') || type === '2d') {
      window.__canvasInspector.contexts = window.__canvasInspector.contexts || [];
      window.__canvasInspector.contexts.push({
        timestamp: performance.now(),
        type,
        canvas: { width: this.width, height: this.height },
      });
    }
    return ctx;
  };
})();
''',
}


def inject_inspector(page, engine):
    """Inject the appropriate inspection script."""
    script = INJECTION_SCRIPTS.get(engine, INJECTION_SCRIPTS['auto'])
    page.add_init_script(script)


def extract_results(page, engine):
    """Extract inspection results from the page."""
    base = page.evaluate("""
        () => {
            if (window.__canvasInspector && typeof window.__canvasInspector.runDetection === 'function') {
                window.__canvasInspector.runDetection();
            }
            return window.__canvasInspector || {};
        }
    """)
    
    # Also get canvas info using recorded context types
    canvases = page.evaluate("""
        () => Array.from(document.querySelectorAll('canvas')).map(c => ({
            width: c.width,
            height: c.height,
            styleWidth: c.style.width,
            styleHeight: c.style.height,
            contextTypes: c.__contextType ? [c.__contextType] : ['unknown']
        }))
    """)
    
    base['canvases'] = canvases
    base['engine'] = engine
    base['capturedAt'] = datetime.now().isoformat()
    
    return base


def save_output(data, out_dir, prefix='canvas'):
    """Save inspection results."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Full JSON
    json_path = out_dir / f'{prefix}_inspection.json'
    json_path.write_text(json.dumps(data, indent=2, default=str))
    
    # Summary
    summary = {
        'engine': data.get('engine'),
        'detected': data.get('detected', []),
        'canvases': len(data.get('canvases', [])),
        'frames': len(data.get('frames', [])),
        'drawCalls': len(data.get('drawCalls', [])),
        'shaders': len(data.get('shaders', [])),
        'textures': len(data.get('textures', [])),
        'buffers': len(data.get('buffers', [])),
        'three': data.get('three'),
        'pixi': data.get('pixi'),
        'babylon': data.get('babylon'),
        'webgl': data.get('webgl'),
        'wasm': data.get('wasm'),
    }
    
    summary_path = out_dir / f'{prefix}_summary.json'
    summary_path.write_text(json.dumps(summary, indent=2))
    
    # If Three.js, extract scene graph
    if data.get('three') and data.get('frames'):
        latest_frame = data['frames'][-1]
        scene_path = out_dir / f'{prefix}_scene_graph.json'
        scene_path.write_text(json.dumps({
            'timestamp': latest_frame.get('timestamp'),
            'objects': latest_frame.get('objects', []),
        }, indent=2))
    
    return json_path, summary_path


def main():
    ap = argparse.ArgumentParser(description='Canvas/WebGL deep inspection')
    ap.add_argument('url', help='URL to inspect')
    ap.add_argument('out_dir', help='Output directory')
    ap.add_argument('--engine', choices=['three', 'pixi', 'babylon', 'webgl', 'wasm', 'auto'], default='auto')
    ap.add_argument('--duration', type=int, default=30, help='Capture duration in seconds')
    ap.add_argument('--capture-frames', action='store_true', help='Capture screenshot frames')
    ap.add_argument('--storage-state', help='Playwright storage state file')
    ap.add_argument('--headless', choices=['new', 'false'], default='new')
    ap.add_argument('--width', type=int, default=1440)
    ap.add_argument('--height', type=int, default=900)
    ap.add_argument('--steps', help='JSON file with pre-navigation steps')
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
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={'width': a.width, 'height': a.height},
            storage_state=a.storage_state if a.storage_state else None,
        )
        page = context.new_page()
        
        # Inject inspector before navigation
        inject_inspector(page, a.engine)
        
        # Navigate
        print(f"Navigating to {a.url}...")
        page.goto(a.url, wait_until='networkidle', timeout=60000)
        page.wait_for_timeout(2000)
        
        # Run pre-steps if provided
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
        
        # Capture frames
        print(f"Capturing for {a.duration} seconds...")
        if a.capture_frames:
            frames_dir = Path(a.out_dir) / 'frames'
            frames_dir.mkdir(parents=True, exist_ok=True)
        
        start = time.time()
        frame_count = 0
        while time.time() - start < a.duration:
            page.wait_for_timeout(1000)
            frame_count += 1
            if a.capture_frames and frame_count % 5 == 0:
                page.screenshot(path=str(frames_dir / f'frame_{frame_count:04d}.png'))
            if frame_count % 10 == 0:
                print(f"  {frame_count}s elapsed...")
        
        # Extract results
        print("Extracting results...")
        data = extract_results(page, a.engine)
        
        # Save
        json_path, summary_path = save_output(data, a.out_dir)
        print(f"Saved: {json_path}")
        print(f"Summary: {summary_path}")
        
        # Print summary
        print(f"\nDetected engines: {data.get('detected', [])}")
        print(f"Canvases: {len(data.get('canvases', []))}")
        print(f"Frames captured: {len(data.get('frames', []))}")
        if data.get('drawCalls'):
            print(f"Draw calls recorded: {len(data['drawCalls'])}")
        if data.get('shaders'):
            print(f"Shaders captured: {len(data['shaders'])}")
        if data.get('textures'):
            print(f"Textures: {len(data['textures'])}")
        if data.get('buffers'):
            print(f"Buffers: {len(data['buffers'])}")
        
        browser.close()


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Static stack fingerprint for a URL. Standard library only.

Usage:
  python fingerprint_stack.py <url> [--out stack.json] [--html-file saved.html]

Fetches the page (or reads a saved HTML file), inspects headers, HTML, script and
stylesheet URLs, meta tags and markers, and reports likely technologies with the
evidence found. It does not execute JavaScript. Pair it with dom_inventory.cjs for
runtime globals and the rendered DOM.
"""
import argparse, json, re, sys, urllib.request, urllib.error
from urllib.parse import urljoin, urlparse

UA = "Mozilla/5.0 (compatible; reverse-engineer-skill/1.0)"

# (name, category, [(where, regex)]) where in: html, header, url, cookie
RULES = [
    ("Next.js", "framework", [("html", r"/_next/static/"), ("html", r'id="__NEXT_DATA__"'), ("header", r"x-powered-by:\s*next\.js")]),
    ("Nuxt", "framework", [("html", r"/_nuxt/"), ("html", r"window\.__NUXT__")]),
    ("Remix", "framework", [("html", r"__remixContext")]),
    ("SvelteKit", "framework", [("html", r"/_app/immutable/"), ("html", r"__sveltekit")]),
    ("Astro", "framework", [("html", r"astro-island"), ("html", r"/_astro/")]),
    ("Angular", "framework", [("html", r"ng-version="), ("html", r"_ngcontent-")]),
    ("Vue", "framework", [("html", r"data-v-[0-9a-f]{6,}"), ("html", r"__vue")]),
    ("React (hint)", "framework", [("html", r"data-reactroot"), ("html", r"react(\.production|-dom)")]),
    ("Solid (hint)", "framework", [("html", r"data-hk=")]),
    ("Qwik", "framework", [("html", r"q:container")]),
    ("Vite build", "build", [("html", r'/assets/index-[A-Za-z0-9_-]{6,}\.js'), ("html", r"/@vite/client")]),
    ("Webpack", "build", [("html", r"webpackChunk"), ("html", r"/static/js/main\.[0-9a-f]+\.js")]),
    ("jQuery", "library", [("html", r"jquery[.-]?[\d.]*(min)?\.js")]),
    ("HTMX", "library", [("html", r"\bhx-(get|post|trigger|target)=")]),
    ("Alpine.js", "library", [("html", r"\bx-data=")]),
    ("WordPress", "cms", [("html", r"/wp-content/"), ("html", r"/wp-json/"), ("html", r'content="WordPress')]),
    ("Elementor", "cms", [("html", r"elementor-element"), ("html", r"data-elementor-type")]),
    ("Webflow", "builder", [("html", r"data-wf-page"), ("html", r"webflow\.js")]),
    ("Framer", "builder", [("html", r"framerusercontent\.com"), ("html", r"data-framer-")]),
    ("Wix", "builder", [("html", r"wixstatic\.com")]),
    ("Squarespace", "builder", [("html", r"squarespace\.com"), ("html", r"SQUARESPACE_CONTEXT")]),
    ("Shopify", "ecommerce", [("html", r"cdn\.shopify\.com"), ("header", r"x-shopify")]),
    ("Tailwind CSS", "styling", [("html", r'class="[^"]*\b(flex|grid)\b[^"]*\b(items-center|gap-\d|px-\d|text-(sm|xs|base|lg))\b'), ("html", r"--tw-")]),
    ("Bootstrap", "styling", [("html", r"bootstrap(\.min)?\.(css|js)"), ("html", r'class="[^"]*\bcol-(sm|md|lg)-\d')]),
    ("Radix UI", "ui", [("html", r"data-radix-"), ("html", r'data-state="(open|closed|checked|unchecked)"')]),
    ("shadcn/ui (likely)", "ui", [("html", r"data-slot=")]),
    ("React Aria", "ui", [("html", r"data-rac"), ("html", r"react-aria-")]),
    ("Headless UI", "ui", [("html", r"headlessui-")]),
    ("MUI", "ui", [("html", r"\bMui[A-Z][A-Za-z]+-root")]),
    ("Chakra UI", "ui", [("html", r"\bchakra-[a-z]+")]),
    ("Ant Design", "ui", [("html", r"\bant-(btn|layout|menu|table|input)")]),
    ("Mantine", "ui", [("html", r"\bmantine-"), ("html", r"--mantine-")]),
    ("styled-components", "styling", [("html", r"data-styled"), ("html", r'class="[^"]*\bsc-[A-Za-z]{5,}')]),
    ("Emotion", "styling", [("html", r"data-emotion"), ("html", r'class="[^"]*\bcss-[a-z0-9]{5,}')]),
    ("ProseMirror/TipTap", "editor", [("html", r"ProseMirror"), ("html", r"\btiptap\b")]),
    ("Lexical", "editor", [("html", r"data-lexical-editor")]),
    ("Slate", "editor", [("html", r"data-slate-editor")]),
    ("Monaco", "editor", [("html", r"monaco-editor")]),
    ("CodeMirror", "editor", [("html", r"cm-editor|CodeMirror")]),
    ("Three.js", "rendering", [("html", r"three(\.min)?\.js|/three@")]),
    ("PixiJS", "rendering", [("html", r"pixi(\.min)?\.js|/pixi\.js@")]),
    ("GSAP", "animation", [("html", r"gsap(\.min)?\.js|/gsap@")]),
    ("Lottie", "animation", [("html", r"lottie(\.min)?\.js|lottie-web|dotlottie")]),
    ("Rive", "animation", [("html", r"rive(\.min)?\.js|@rive-app")]),
    ("Firebase", "backend", [("html", r"firebase(app|io)\.com"), ("html", r"firestore\.googleapis\.com")]),
    ("Supabase", "backend", [("html", r"\.supabase\.co")]),
    ("Convex", "backend", [("html", r"convex\.cloud")]),
    ("Clerk", "auth", [("html", r"clerk\.(accounts|com|dev)|\.clerk\.")]),
    ("Auth0", "auth", [("html", r"auth0\.com")]),
    ("Stripe", "payments", [("html", r"js\.stripe\.com")]),
    ("Algolia", "search", [("html", r"algolia(net)?\.(com|net)")]),
    ("Google Analytics/GTM", "analytics", [("html", r"googletagmanager\.com|google-analytics\.com|gtag\(")]),
    ("PostHog", "analytics", [("html", r"posthog")]),
    ("Segment", "analytics", [("html", r"cdn\.segment\.com")]),
    ("Sentry", "monitoring", [("html", r"sentry(-cdn)?\.(io|com)|browser\.sentry")]),
    ("Vercel", "hosting", [("header", r"x-vercel-id|server:\s*vercel")]),
    ("Netlify", "hosting", [("header", r"x-nf-request-id|server:\s*netlify")]),
    ("Cloudflare", "hosting", [("header", r"cf-ray|server:\s*cloudflare")]),
    ("AWS CloudFront", "hosting", [("header", r"x-amz-cf-id|via:.*cloudfront")]),
    ("GitHub Pages", "hosting", [("header", r"server:\s*github\.com")]),
    ("PWA manifest", "pwa", [("html", r'rel="manifest"')]),
]

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(3_000_000).decode("utf-8", "replace")
            headers = "\n".join(f"{k}: {v}" for k, v in r.headers.items())
            return r.geturl(), r.status, headers, body
    except urllib.error.HTTPError as e:
        body = e.read(300_000).decode("utf-8", "replace")
        headers = "\n".join(f"{k}: {v}" for k, v in e.headers.items())
        return url, e.code, headers, body

def head_ok(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read(2000).decode("utf-8", "replace")
    except Exception:
        return None, ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--out")
    ap.add_argument("--html-file", help="analyze a saved HTML file instead of fetching the HTML")
    ap.add_argument("--no-probe", action="store_true", help="skip probing source maps and well-known files")
    a = ap.parse_args()

    final_url, status, headers, html = a.url, None, "", ""
    if a.html_file:
        html = open(a.html_file, encoding="utf-8", errors="replace").read()
    else:
        final_url, status, headers, html = fetch(a.url)

    hay = {"html": html, "header": headers.lower()}
    findings = []
    for name, cat, pats in RULES:
        ev = []
        for where, rx in pats:
            flags = re.I
            text = hay.get(where, "")
            m = re.search(rx, text, flags)
            if m:
                snippet = text[max(0, m.start()-20): m.end()+40].replace("\n", " ")[:140]
                ev.append({"where": where, "pattern": rx, "match": snippet})
        if ev:
            conf = "high" if len(ev) >= 2 else "medium"
            findings.append({"name": name, "category": cat, "confidence": conf, "evidence": ev})

    scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, re.I)
    styles = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\']', html, re.I)
    styles += re.findall(r'<link[^>]+href=["\']([^"\']+\.css[^"\']*)["\']', html, re.I)
    metas = re.findall(r'<meta[^>]+(?:name|property)=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\']', html, re.I)
    generator = [c for n, c in metas if n.lower() == "generator"]
    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)

    hosts = sorted({urlparse(urljoin(final_url, u)).netloc for u in scripts + styles if urlparse(urljoin(final_url, u)).netloc})

    probes = {}
    if not a.no_probe and not a.html_file:
        base = f"{urlparse(final_url).scheme}://{urlparse(final_url).netloc}"
        for path in ["/robots.txt", "/sitemap.xml", "/manifest.json", "/site.webmanifest", "/openapi.json", "/.well-known/security.txt"]:
            st, snippet = head_ok(base + path)
            if st and st < 400:
                probes[path] = {"status": st, "head": snippet[:300]}
        # source map discovery on first few same-origin scripts
        maps = []
        final_parsed = urlparse(final_url)
        for s in scripts[:10]:
            su = urljoin(final_url, s)
            su_parsed = urlparse(su)
            if su_parsed.scheme != final_parsed.scheme or su_parsed.netloc != final_parsed.netloc:
                continue
            try:
                _, st, _, full = fetch(su)
            except Exception:
                continue
            if not st or st >= 400 or not full:
                continue
            m = re.search(r"sourceMappingURL=([^\s*]+)", full[-2500:] if full else "")
            if m:
                map_url = urljoin(su, m.group(1).strip())
                entry = {"script": su, "sourceMappingURL": m.group(1), "resolved": map_url}
                # try to fetch the map and list original sources (architecture only, never copy code)
                try:
                    mst, _, _, mbody = fetch(map_url)
                    if mst and mst < 400 and mbody and mbody.lstrip().startswith("{"):
                        import json as _json
                        sm = _json.loads(mbody)
                        srcs = sm.get("sources") or []
                        entry["sourcesCount"] = len(srcs)
                        entry["sourcesSample"] = srcs[:40]  # original file tree hints
                        entry["sourceRoot"] = sm.get("sourceRoot")
                except Exception:
                    pass
                maps.append(entry)
        probes["sourceMaps"] = maps

    result = {
        "url": a.url, "finalUrl": final_url, "status": status,
        "title": title.group(1).strip() if title else None,
        "generator": generator,
        "findings": sorted(findings, key=lambda f: (f["category"], f["name"])),
        "scripts": scripts, "stylesheets": styles, "thirdPartyAndAssetHosts": hosts,
        "headers": headers, "probes": probes,
        "note": "Static analysis only. Confirm with dom_inventory.cjs (runtime globals, rendered DOM, network).",
    }
    out = json.dumps(result, indent=2)
    if a.out:
        import os
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        open(a.out, "w").write(out)
        print(f"wrote {a.out}")
    # human summary
    print(f"\nFingerprint for {final_url}")
    for f in result["findings"]:
        print(f"  [{f['confidence']:6}] {f['category']:10} {f['name']}")
    if not findings:
        print("  no known signatures found (likely a custom build, canvas app, or JS-rendered shell; run dom_inventory.cjs)")
    if not a.out:
        print("\n(use --out to save full JSON)")

if __name__ == "__main__":
    main()

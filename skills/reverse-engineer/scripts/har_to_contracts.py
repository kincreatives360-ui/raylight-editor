#!/usr/bin/env python3
"""
Infer a rough API contract from network.json (produced by dom_inventory) or a HAR file.
Usage:
  python har_to_contracts.py <network.json|file.har> [--out api-contracts.md]
"""
import json, sys, argparse, re
from collections import defaultdict
from urllib.parse import urlparse, parse_qs

def load(path):
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data  # network.json style
    if "log" in data and "entries" in data["log"]:
        # HAR
        out = []
        for e in data["log"]["entries"]:
            req = e.get("request", {})
            res = e.get("response", {})
            out.append({
                "url": req.get("url"),
                "method": req.get("method"),
                "type": e.get("_resourceType") or req.get("headers", [{}])[0],
                "status": res.get("status"),
                "contentType": next((h["value"] for h in res.get("headers", []) if h["name"].lower() == "content-type"), ""),
                "postData": (req.get("postData") or {}).get("text"),
            })
        return out
    raise SystemExit("Unrecognized format (expect network.json list or HAR)")

def path_key(url):
    p = urlparse(url)
    # collapse numeric / uuid segments
    parts = []
    for seg in p.path.strip("/").split("/"):
        if re.fullmatch(r"\d+", seg):
            parts.append("{id}")
        elif re.fullmatch(r"[0-9a-fA-F-]{8,}", seg) and "-" in seg:
            parts.append("{uuid}")
        else:
            parts.append(seg)
    return p.netloc + "/" + "/".join(parts)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    rows = load(a.input)
    # focus on XHR/fetch/json
    api = []
    for r in rows:
        ct = (r.get("contentType") or "").lower()
        typ = (r.get("type") or "").lower()
        if typ in ("xhr", "fetch", "xmlhttprequest") or "json" in ct or "api" in (r.get("url") or ""):
            api.append(r)
        elif r.get("method") and r["method"] not in ("GET", "HEAD", "OPTIONS") and r.get("postData"):
            api.append(r)

    groups = defaultdict(list)
    for r in api:
        if not r.get("url"): continue
        key = f"{r.get('method','GET')} {path_key(r['url'])}"
        groups[key].append(r)

    lines = ["# Inferred API surface (from network capture)", "",
             "Shape-level only. Confirm payloads manually. Dynamic IDs collapsed to {id}/{uuid}.", ""]
    for key in sorted(groups.keys()):
        samples = groups[key]
        statuses = sorted({s.get("status") for s in samples if s.get("status")})
        cts = sorted({(s.get("contentType") or "").split(";")[0] for s in samples if s.get("contentType")})
        lines.append(f"## `{key}`")
        lines.append(f"- samples: {len(samples)}")
        lines.append(f"- status: {statuses}")
        lines.append(f"- content-type: {cts}")
        # sample query keys
        qkeys = set()
        for s in samples[:5]:
            q = urlparse(s["url"]).query
            qkeys.update(parse_qs(q).keys())
        if qkeys:
            lines.append(f"- query keys: {sorted(qkeys)}")
        # post body keys if JSON-ish
        body_keys = set()
        for s in samples[:5]:
            pd = s.get("postData")
            if not pd: continue
            try:
                obj = json.loads(pd if isinstance(pd, str) else "{}")
                if isinstance(obj, dict):
                    body_keys.update(obj.keys())
            except Exception:
                pass
        if body_keys:
            lines.append(f"- body keys (sample): {sorted(body_keys)}")
        lines.append("")
    text = "\n".join(lines)
    if a.out:
        open(a.out, "w").write(text)
        print(f"wrote {a.out}")
    else:
        print(text)
    print(f"\n{len(groups)} endpoint groups from {len(api)} API-like requests")

if __name__ == "__main__":
    main()

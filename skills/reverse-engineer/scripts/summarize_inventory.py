#!/usr/bin/env python3
"""
Compact digest of inventory.json so an agent reads ~250 lines instead of megabytes.

Usage:
  python summarize_inventory.py inventory.json [--interactions interactions.json] [--out digest.md]
        [--depth 5] [--max-lines 250] [--node "<path>"] [--format json|markdown]

Outputs: meta, indented outline (repeated siblings collapsed with counts), component candidates
(repeated structures), controls table, top style values. --node prints only one subtree (by path).
"""
import argparse, json, re, sys
from collections import Counter

def sig(n, d=2):
    cls = " ".join(sorted((n["attrs"].get("class", "") or "").split())[:3])
    s = n["tag"] + "." + cls
    if d > 0:
        s += "(" + ",".join(sig(c, d - 1) for c in (n.get("children") or [])[:6]) + ")"
    return s

def layout(st):
    d = st.get("display", "")
    if "flex" in d:
        bits = [f'flex-{"col" if "column" in st.get("flexDirection","") else "row"}']
        if st.get("gap") not in (None, "normal", "0px"): bits.append("gap " + st["gap"])
        if st.get("justifyContent") not in (None, "normal", "flex-start"): bits.append("jc " + st["justifyContent"])
        if st.get("alignItems") not in (None, "normal", "stretch"): bits.append("ai " + st["alignItems"])
        return " ".join(bits)
    if "grid" in d: return "grid " + (st.get("gridTemplateColumns", "")[:40])
    if st.get("position") in ("fixed", "sticky", "absolute"): return st["position"]
    return d if d not in ("block", "inline", "") else ""

def label(n, st):
    a = n["attrs"]; t = n["tag"]
    if a.get("id"): t += "#" + a["id"]
    cls = [c for c in (a.get("class", "") or "").split() if c][:2]
    if cls: t += "." + ".".join(cls)
    if a.get("role"): t += f' [{a["role"]}]'
    b = n["bbox"]
    out = f'{t} {int(b[2])}x{int(b[3])}'
    lay = layout(st)
    if lay: out += " | " + lay
    if st.get("overflowY") in ("auto", "scroll") or st.get("overflowX") in ("auto", "scroll"): out += " | scroll"
    if n.get("interactive"): out += " | ★" + n["interactive"]
    if n.get("text"): out += f' "{n["text"][:40]}"'
    if n.get("canvas"): out += " | canvas"
    if n.get("shadow"): out += " | shadow"
    return out

def find(n, path):
    if n["path"] == path: return n
    for c in n.get("children") or []:
        r = find(c, path)
        if r: return r

def build_digest(inv, table, root, args):
    """Build digest as structured data for JSON output."""
    m = inv.get("meta", {})
    result = {
        "meta": {
            "title": m.get("title") or inv["url"],
            "url": inv["url"],
            "root": inv.get("root") or "page",
            "capturedAt": inv.get("capturedAt"),
            "viewport": inv.get("viewport"),
            "nodeCount": inv.get("nodeCount"),
            "truncated": inv.get("truncated", False),
        },
        "outline": [],
        "componentCandidates": [],
        "interactiveElements": [],
        "sweepResults": None,
        "detectedGlobals": [],
        "motionTokens": {},
        "topStyleValues": {},
    }

    sigs = Counter()
    def count(n):
        if n.get("visible"): sigs[sig(n)] += 1
        for c in n.get("children") or []: count(c)
    count(root)

    def outline(n, depth):
        if depth > args.depth or not n.get("visible", True): return
        st = table[n["styleId"]]
        result["outline"].append({
            "depth": depth,
            "label": label(n, st),
            "path": n["path"],
        })
        kids = [c for c in (n.get("children") or []) if c.get("visible", True) and c["tag"] not in ("script", "style", "noscript", "path", "br")]
        i = 0
        while i < len(kids):
            s = sig(kids[i]); j = i
            while j + 1 < len(kids) and sig(kids[j + 1]) == s: j += 1
            run = j - i + 1
            outline(kids[i], depth + 1)
            if run > 1:
                result["outline"].append({
                    "depth": depth + 1,
                    "label": f"... x{run} identical siblings (showing 1)",
                    "path": "",
                })
            i = j + 1
        if n.get("childrenOmitted"):
            result["outline"].append({
                "depth": depth + 1,
                "label": f'(+{n["childrenOmitted"]} children beyond max depth)',
                "path": "",
            })
    outline(root, 0)

    comps = [(s, c) for s, c in sigs.items() if c >= 3 and len(s) > 12]
    if comps:
        for s, c in sorted(comps, key=lambda x: -x[1])[:12]:
            result["componentCandidates"].append({"signature": s[:100], "count": c})

    inter = []
    def gi(n):
        if n.get("interactive") and n.get("visible"): inter.append(n)
        for c in n.get("children") or []: gi(c)
    gi(root)
    for n in inter[:60]:
        nm = n.get("text") or n["aria"].get("aria-label") or n["attrs"].get("placeholder") or n["attrs"].get("title") or n["attrs"].get("href", "")
        result["interactiveElements"].append({
            "tag": n["tag"],
            "role": n["attrs"].get("role"),
            "name": str(nm)[:40],
            "bbox": [int(n["bbox"][2]), int(n["bbox"][3])],
            "interactiveType": n["interactive"],
            "path": n["path"][-50:],
        })
    if len(inter) > 60:
        result["interactiveElements"].append({"note": f"... {len(inter) - 60} more (see interactive.json)"})

    if args.interactions:
        try:
            rs = json.load(open(args.interactions, encoding="utf-8"))
            sw = [r for r in rs if r["status"] == "swept"]
            sweep_data = {"swept": len(sw), "total": len(rs), "details": []}
            for r in sw[:50]:
                bits = []
                if r.get("hoverDiff"): bits.append("hover:" + ",".join(r["hoverDiff"].keys())[:40])
                if r.get("overlays"): bits.append("opens:" + ",".join(o["role"] for o in r["overlays"]))
                if r.get("urlChanged"): bits.append("url->" + r["urlChanged"][-30:])
                if r.get("network"): bits.append(f'net:{len(r["network"])}')
                if r.get("tooltip"): bits.append(f'tip:"{r["tooltip"][:25]}"')
                if r.get("attributeChanges"): bits.append("attrs:" + ",".join(sorted({x["attr"] for x in r["attributeChanges"]}))[:40])
                sweep_data["details"].append({
                    "id": r["id"],
                    "tag": r["tag"],
                    "name": r["name"][:30],
                    "effects": bits or ["no visible effect"],
                })
            skipped = [r for r in rs if r["status"] != "swept"]
            if skipped:
                sweep_data["skipped"] = len(skipped)
                sweep_data["skipReasons"] = list(sorted({r['status'][:28] for r in skipped}))
            result["sweepResults"] = sweep_data
        except Exception as e:
            result["sweepResults"] = {"error": str(e)}

    # Globals
    import os
    base = os.path.dirname(os.path.abspath(args.inventory))
    gpath = os.path.join(base, "globals.json")
    if os.path.isfile(gpath):
        try:
            g = json.load(open(gpath, encoding="utf-8"))
            gl = g.get("globals") or {}
            for k, v in list(gl.items())[:25]:
                result["detectedGlobals"].append({
                    "name": k,
                    "value": v if not isinstance(v, (dict, list)) else json.dumps(v)[:120],
                })
        except Exception:
            pass

    # Motion
    mpath = os.path.join(base, "motion.json")
    if os.path.isfile(mpath):
        try:
            m = json.load(open(mpath, encoding="utf-8"))
            if m.get("keyframes"):
                result["motionTokens"]["keyframes"] = [k.get("name","?") for k in m["keyframes"][:20]]
            if m.get("durations"):
                result["motionTokens"]["durations"] = m["durations"][:12]
            if m.get("easings"):
                result["motionTokens"]["easings"] = m["easings"][:12]
        except Exception:
            pass

    # Top style values
    use = Counter()
    def u(n):
        if n.get("visible"): use[n["styleId"]] += 1
        for c in n.get("children") or []: u(c)
    u(root)
    col, bg, fs, ff = Counter(), Counter(), Counter(), Counter()
    for sid, n in use.items():
        s = table[sid]
        col[s["color"]] += n
        if s["backgroundColor"] not in ("rgba(0, 0, 0, 0)", "transparent"):
            bg[s["backgroundColor"]] += n
        fs[f'{s["fontSize"]}/{s["fontWeight"]}'] += n
        ff[s["fontFamily"].split(",")[0]] += n
    result["topStyleValues"] = {
        "text": [{"value": k, "count": v} for k, v in col.most_common(4)],
        "background": [{"value": k, "count": v} for k, v in bg.most_common(4) if k != "rgba(0, 0, 0, 0)"],
        "sizeWeight": [{"value": k, "count": v} for k, v in fs.most_common(5)],
        "font": [{"value": k, "count": v} for k, v in ff.most_common(2)],
    }

    return result

def render_markdown(result, max_lines):
    L = []
    m = result["meta"]
    L.append(f'# Digest: {m["title"]}')
    L.append(f'url: {m["url"]} | root: {m["root"]} | captured: {m["capturedAt"]} | viewport: {m["viewport"]} | nodes: {m["nodeCount"]}{" (TRUNCATED)" if m["truncated"] else ""}')
    L.append("")
    L.append("## Outline (repeated siblings collapsed)")
    for item in result["outline"]:
        L.append("  " * item["depth"] + item["label"])
    L.append("")
    if result["componentCandidates"]:
        L.append("## Component candidates (repeated structure, count)")
        for c in result["componentCandidates"]:
            L.append(f'- x{c["count"]}: {c["signature"]}')
        L.append("")
    L.append(f"## Interactive elements ({len([x for x in result['interactiveElements'] if 'note' not in x])} visible)")
    for item in result["interactiveElements"]:
        if "note" in item:
            L.append(f'- {item["note"]}')
        else:
            L.append(f'- {item["tag"]}{("[" + item["role"] + "]") if item["role"] else ""} "{item["name"]}" {item["bbox"][0]}x{item["bbox"][1]} ({item["interactiveType"]}) {item["path"]}')
    L.append("")
    if result["sweepResults"]:
        sr = result["sweepResults"]
        if "error" in sr:
            L.append(f"(could not read interactions: {sr['error']})")
        else:
            L.append(f"## Sweep results ({sr['swept']} swept of {sr['total']})")
            for r in sr["details"]:
                L.append(f'- {r["id"]} {r["tag"]} "{r["name"]}": ' + (" | ".join(r["effects"]) or "no visible effect"))
            if sr.get("skipped"):
                L.append(f'- not swept: {sr["skipped"]} ({"; ".join(sr["skipReasons"])})')
            L.append("")
    if result["detectedGlobals"]:
        L.append("## Detected globals / libraries")
        for g in result["detectedGlobals"]:
            L.append(f'- {g["name"]}: {g["value"]}')
        L.append("")
    if result["motionTokens"]:
        L.append("## Motion tokens")
        if result["motionTokens"].get("keyframes"):
            L.append("keyframes: " + ", ".join(result["motionTokens"]["keyframes"]))
        if result["motionTokens"].get("durations"):
            L.append("durations: " + ", ".join(result["motionTokens"]["durations"]))
        if result["motionTokens"].get("easings"):
            L.append("easings: " + ", ".join(result["motionTokens"]["easings"]))
        L.append("")
    L.append("## Top style values (use extract_tokens.py for full)")
    L.append("text: " + ", ".join(f'{k["value"]} x{k["count"]}' for k in result["topStyleValues"]["text"]))
    L.append("bg: " + ", ".join(f'{k["value"]} x{k["count"]}' for k in result["topStyleValues"]["background"]))
    L.append("size/weight: " + ", ".join(f'{k["value"]} x{k["count"]}' for k in result["topStyleValues"]["sizeWeight"]))
    L.append("font: " + ", ".join(f'{k["value"]} x{k["count"]}' for k in result["topStyleValues"]["font"]))
    if len(L) > max_lines:
        L = L[:max_lines - 1] + [f"... digest cut at {max_lines} lines. Use --depth lower, --node <path>, or capture with --root."]
    return "\n".join(L)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inventory"); ap.add_argument("--interactions"); ap.add_argument("--out")
    ap.add_argument("--depth", type=int, default=5); ap.add_argument("--max-lines", type=int, default=250)
    ap.add_argument("--node")
    ap.add_argument("--format", choices=["json", "markdown"], default="markdown")
    a = ap.parse_args()
    inv = json.load(open(a.inventory, encoding="utf-8")); table = inv["styleTable"]; root = inv["tree"]
    if a.node:
        root = find(root, a.node)
        if not root: print("node not found"); return
    result = build_digest(inv, table, root, a)
    if a.format == "json":
        text = json.dumps(result, indent=2)
    else:
        text = render_markdown(result, a.max_lines)
    if a.out: open(a.out, "w", encoding="utf-8").write(text); print(f"wrote {a.out}")
    else: print(text)

if __name__ == "__main__":
    main()

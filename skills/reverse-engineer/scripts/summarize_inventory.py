#!/usr/bin/env python3
"""
Compact digest of inventory.json so an agent reads ~250 lines instead of megabytes.

Usage:
  python summarize_inventory.py inventory.json [--interactions interactions.json] [--out digest.md]
        [--depth 5] [--max-lines 250] [--node "<path>"]

Outputs: meta, indented outline (repeated siblings collapsed with counts), component candidates
(repeated structures), controls table, top style values. --node prints only one subtree (by path).
"""
import argparse, json, re
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inventory"); ap.add_argument("--interactions"); ap.add_argument("--out")
    ap.add_argument("--depth", type=int, default=5); ap.add_argument("--max-lines", type=int, default=250)
    ap.add_argument("--node")
    a = ap.parse_args()
    inv = json.load(open(a.inventory)); table = inv["styleTable"]; root = inv["tree"]
    if a.node:
        root = find(root, a.node)
        if not root: print("node not found"); return
    L = []
    m = inv.get("meta", {})
    L.append(f'# Digest: {m.get("title") or inv["url"]}')
    L.append(f'url: {inv["url"]} | root: {inv.get("root") or "page"} | captured: {inv.get("capturedAt")} | viewport: {inv.get("viewport")} | nodes: {inv.get("nodeCount")}{" (TRUNCATED)" if inv.get("truncated") else ""}')
    L.append("")
    L.append("## Outline (repeated siblings collapsed)")
    sigs = Counter()
    def count(n):
        if n.get("visible"): sigs[sig(n)] += 1
        for c in n.get("children") or []: count(c)
    count(root)

    def outline(n, depth):
        if depth > a.depth or not n.get("visible", True): return
        st = table[n["styleId"]]
        L.append("  " * depth + label(n, st))
        kids = [c for c in (n.get("children") or []) if c.get("visible", True) and c["tag"] not in ("script", "style", "noscript", "path", "br")]
        i = 0
        while i < len(kids):
            s = sig(kids[i]); j = i
            while j + 1 < len(kids) and sig(kids[j + 1]) == s: j += 1
            run = j - i + 1
            outline(kids[i], depth + 1)
            if run > 1: L.append("  " * (depth + 1) + f"... x{run} identical siblings (showing 1)")
            i = j + 1
        if n.get("childrenOmitted"): L.append("  " * (depth + 1) + f'(+{n["childrenOmitted"]} children beyond max depth)')
    outline(root, 0)
    L.append("")
    comps = [(s, c) for s, c in sigs.items() if c >= 3 and len(s) > 12]
    if comps:
        L.append("## Component candidates (repeated structure, count)")
        for s, c in sorted(comps, key=lambda x: -x[1])[:12]: L.append(f"- x{c}: {s[:100]}")
        L.append("")
    inter = []
    def gi(n):
        if n.get("interactive") and n.get("visible"): inter.append(n)
        for c in n.get("children") or []: gi(c)
    gi(root)
    L.append(f"## Interactive elements ({len(inter)} visible)")
    for n in inter[:60]:
        nm = n.get("text") or n["aria"].get("aria-label") or n["attrs"].get("placeholder") or n["attrs"].get("title") or n["attrs"].get("href", "")
        L.append(f'- {n["tag"]}{("[" + n["attrs"]["role"] + "]") if n["attrs"].get("role") else ""} "{str(nm)[:40]}" {int(n["bbox"][2])}x{int(n["bbox"][3])} ({n["interactive"]}) {n["path"][-50:]}')
    if len(inter) > 60: L.append(f"- ... {len(inter) - 60} more (see interactive.json)")
    L.append("")
    if a.interactions:
        try:
            rs = json.load(open(a.interactions)); sw = [r for r in rs if r["status"] == "swept"]
            L.append(f"## Sweep results ({len(sw)} swept of {len(rs)})")
            for r in sw[:50]:
                bits = []
                if r.get("hoverDiff"): bits.append("hover:" + ",".join(r["hoverDiff"].keys())[:40])
                if r.get("overlays"): bits.append("opens:" + ",".join(o["role"] for o in r["overlays"]))
                if r.get("urlChanged"): bits.append("url->" + r["urlChanged"][-30:])
                if r.get("network"): bits.append(f'net:{len(r["network"])}')
                if r.get("tooltip"): bits.append(f'tip:"{r["tooltip"][:25]}"')
                if r.get("attributeChanges"): bits.append("attrs:" + ",".join(sorted({x["attr"] for x in r["attributeChanges"]}))[:40])
                L.append(f'- {r["id"]} {r["tag"]} "{r["name"][:30]}": ' + (" | ".join(bits) or "no visible effect"))
            skipped = [r for r in rs if r["status"] != "swept"]
            if skipped: L.append(f"- not swept: {len(skipped)} (" + "; ".join(sorted({r['status'][:28] for r in skipped})) + ")")
            L.append("")
        except Exception as e:
            L.append(f"(could not read interactions: {e})")
    use = Counter()
    def u(n):
        if n.get("visible"): use[n["styleId"]] += 1
        for c in n.get("children") or []: u(c)
    u(root)
    col, bg, fs, ff = Counter(), Counter(), Counter(), Counter()
    for sid, n in use.items():
        s = table[sid]; col[s["color"]] += n; bg[s["backgroundColor"]] += n; fs[f'{s["fontSize"]}/{s["fontWeight"]}'] += n; ff[s["fontFamily"].split(",")[0]] += n
    # Sibling artifacts from same inventory run
    import os
    base = os.path.dirname(os.path.abspath(a.inventory))
    gpath = os.path.join(base, "globals.json")
    mpath = os.path.join(base, "motion.json")
    if os.path.isfile(gpath):
        try:
            g = json.load(open(gpath))
            gl = g.get("globals") or {}
            if gl:
                L.append("## Detected globals / libraries")
                for k, v in list(gl.items())[:25]:
                    L.append(f"- {k}: {v if not isinstance(v, (dict, list)) else json.dumps(v)[:120]}")
                L.append("")
            st = g.get("storage") or {}
            if st.get("indexedDB"):
                L.append(f"IndexedDB: {st['indexedDB']}")
                L.append("")
        except Exception:
            pass
    if os.path.isfile(mpath):
        try:
            m = json.load(open(mpath))
            L.append("## Motion tokens")
            if m.get("keyframes"):
                L.append("keyframes: " + ", ".join(k.get("name","?") for k in m["keyframes"][:20]))
            if m.get("durations"):
                L.append("durations: " + ", ".join(m["durations"][:12]))
            if m.get("easings"):
                L.append("easings: " + ", ".join(m["easings"][:12]))
            L.append("")
        except Exception:
            pass
    L.append("## Top style values (use extract_tokens.py for full)")
    L.append("text: " + ", ".join(f"{k} x{v}" for k, v in col.most_common(4)))
    L.append("bg: " + ", ".join(f"{k} x{v}" for k, v in bg.most_common(4) if k != "rgba(0, 0, 0, 0)"))
    L.append("size/weight: " + ", ".join(f"{k} x{v}" for k, v in fs.most_common(5)))
    L.append("font: " + ", ".join(f"{k} x{v}" for k, v in ff.most_common(2)))
    if len(L) > a.max_lines:
        L = L[:a.max_lines - 1] + [f"... digest cut at {a.max_lines} lines. Use --depth lower, --node <path>, or capture with --root."]
    text = "\n".join(L)
    if a.out: open(a.out, "w").write(text); print(f"wrote {a.out} ({len(L)} lines)")
    else: print(text)

if __name__ == "__main__":
    main()

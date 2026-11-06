#!/usr/bin/env python3
"""
Compare a reference inventory with a rebuild inventory (both from dom_inventory.cjs).

Usage: python diff_inventories.py ref.json build.json [--out diff.md] [--tol 1.0]

Nodes are matched structurally, not by class names (a rebuild will have different classes):
  key = tag + role + normalized own text + index among siblings with the same signature.
Reports: unmatched nodes (missing / extra), bbox differences beyond tolerance, and computed
style differences per tracked property, then a score. Use scoped runs per component when possible.
Dynamic content (timestamps, user data) will show up as text mismatches: review, then mask.
"""
import argparse, json, re
from collections import defaultdict

TRACK = ["display","position","flexDirection","justifyContent","alignItems","gap","gridTemplateColumns",
         "paddingTop","paddingRight","paddingBottom","paddingLeft","marginTop","marginBottom",
         "color","backgroundColor","borderTopWidth","borderTopColor","borderTopLeftRadius","boxShadow","opacity",
         "fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","textAlign",
         "overflowX","overflowY","cursor","transitionDuration","transitionTimingFunction","zIndex"]

def norm(t): return re.sub(r"\s+", " ", (t or "").strip().lower())[:30]

def flatten(inv):
    table = inv["styleTable"]; out = []
    def rec(n, parent_key, idx_counter):
        sig = (n["tag"], n["attrs"].get("role", ""), norm(n.get("text")))
        c = idx_counter[sig]; idx_counter[sig] += 1
        key = parent_key + "/" + "|".join(sig) + f"#{c}"
        out.append((key, n, table[n["styleId"]]))
        kids = n.get("children", []) or []
        cc = defaultdict(int)
        for k in kids: rec(k, key, cc)
    rec(inv["tree"], "", defaultdict(int))
    return out

def fnum(v):
    m = re.match(r"^(-?[\d.]+)", str(v)); return float(m.group(1)) if m else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref"); ap.add_argument("build"); ap.add_argument("--out"); ap.add_argument("--tol", type=float, default=1.0)
    a = ap.parse_args()
    R = flatten(json.load(open(a.ref))); B = flatten(json.load(open(a.build)))
    rmap = {k: (n, s) for k, n, s in R if n.get("visible")}
    bmap = {k: (n, s) for k, n, s in B if n.get("visible")}
    missing = [k for k in rmap if k not in bmap]; extra = [k for k in bmap if k not in rmap]
    matched = [k for k in rmap if k in bmap]

    style_diffs = []; bbox_diffs = []; prop_total = 0; prop_ok = 0
    for k in matched:
        rn, rs = rmap[k]; bn, bs = bmap[k]
        for p in TRACK:
            prop_total += 1
            if rs.get(p) == bs.get(p): prop_ok += 1
            else:
                x, y = fnum(rs.get(p)), fnum(bs.get(p))
                if x is not None and y is not None and abs(x - y) <= 0.5 and p not in ("opacity",): prop_ok += 1
                else: style_diffs.append((k, p, rs.get(p), bs.get(p)))
        rb, bb = rn["bbox"], bn["bbox"]
        if any(abs(rb[i] - bb[i]) > a.tol for i in (0, 1, 2, 3)): bbox_diffs.append((k, rb, bb))

    struct = len(matched) / max(1, len(rmap)) * 100
    style = prop_ok / max(1, prop_total) * 100
    lines = ["# Inventory diff", f"ref: {a.ref}", f"build: {a.build}", "",
             f"- Structure match: **{struct:.1f}%** ({len(matched)}/{len(rmap)} visible reference nodes found)",
             f"- Style match: **{style:.1f}%** ({prop_ok}/{prop_total} tracked properties)",
             f"- Position/size diffs over {a.tol}px: **{len(bbox_diffs)}**", f"- Missing in build: **{len(missing)}**  Extra in build: **{len(extra)}**", ""]
    by_prop = defaultdict(int)
    for _, p, _, _ in style_diffs: by_prop[p] += 1
    lines += ["## Most common style differences", "| property | count |", "|---|---|"] + [f"| {p} | {n} |" for p, n in sorted(by_prop.items(), key=lambda x: -x[1])[:15]] + [""]
    lines += ["## Missing in build (first 60)"] + [f"- `{k[-110:]}`" for k in missing[:60]] + [""]
    lines += ["## Extra in build (first 30)"] + [f"- `{k[-110:]}`" for k in extra[:30]] + [""]
    lines += ["## Style diffs (first 80)", "| node | prop | ref | build |", "|---|---|---|---|"] + [f"| `{k[-70:]}` | {p} | {r} | {b} |" for k, p, r, b in style_diffs[:80]] + [""]
    lines += ["## Size/position diffs (first 40)", "| node | ref bbox | build bbox |", "|---|---|---|"] + [f"| `{k[-70:]}` | {r} | {b} |" for k, r, b in bbox_diffs[:40]]
    text = "\n".join(lines)
    if a.out: open(a.out, "w").write(text); print("wrote", a.out)
    print("\n".join(lines[:9]))

if __name__ == "__main__":
    main()

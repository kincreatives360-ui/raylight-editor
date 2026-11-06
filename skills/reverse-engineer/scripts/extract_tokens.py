#!/usr/bin/env python3
"""
Turn inventory.json (from dom_inventory.cjs) into a design token draft.

Usage: python extract_tokens.py inventory.json [--css-vars css-vars.json] [--out design-tokens.json]

Counts usage across the style table (weighted by how many nodes use each style set) and
reports: colors (text, background, border) ranked by frequency, type scale, font families,
spacing values (margin/padding/gap), radii, shadows, z-index layers, transitions, and
breakpoint hints. The output is a DRAFT. A human or agent must name roles (primary, muted...)
by looking at where each value is used. Values are raw measured values.
"""
import argparse, json, re, sys
from collections import Counter

def walk(node, fn):
    fn(node)
    for c in node.get("children", []) or []:
        walk(c, fn)

def to_hex(c):
    m = re.match(r"rgba?\(([^)]+)\)", c or "")
    if not m: return c
    p = [x.strip() for x in re.split(r"[,/ ]+", m.group(1)) if x.strip()]
    try:
        r, g, b = [int(float(x)) for x in p[:3]]
        a = float(p[3]) if len(p) > 3 else 1.0
    except Exception:
        return c
    h = "#%02x%02x%02x" % (r, g, b)
    return h if a >= 0.999 else f"{h}@{round(a,2)}"

def px(v):
    m = re.match(r"^(-?[\d.]+)px$", v or "")
    return float(m.group(1)) if m else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inventory"); ap.add_argument("--css-vars"); ap.add_argument("--out", default="design-tokens.json")
    a = ap.parse_args()
    inv = json.load(open(a.inventory))
    table = inv["styleTable"]
    use = Counter()
    pseudo_ids = Counter()
    def visit(n):
        if n.get("visible"): use[n["styleId"]] += 1
        for k in ("before", "after"):
            if n.get(k): pseudo_ids[n[k]["styleId"]] += 1
    walk(inv["tree"], visit)

    text_colors, bg_colors, border_colors = Counter(), Counter(), Counter()
    fonts, sizes, weights, lines, tracking = Counter(), Counter(), Counter(), Counter(), Counter()
    space, radii, shadows, z, transitions, gaps, borders = Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter()
    for sid, n in use.items():
        s = table[sid]
        text_colors[to_hex(s["color"])] += n
        if s["backgroundColor"] not in ("rgba(0, 0, 0, 0)", "transparent"): bg_colors[to_hex(s["backgroundColor"])] += n
        for side in ("Top", "Right", "Bottom", "Left"):
            if px(s[f"border{side}Width"]) and s.get(f"border{side}Style", s.get("borderTopStyle")) != "none":
                border_colors[to_hex(s[f"border{side}Color"])] += n
                borders[s[f"border{side}Width"]] += n
        fonts[s["fontFamily"].split(",")[0].strip().strip('"\'')] += n
        sizes[s["fontSize"]] += n; weights[s["fontWeight"]] += n
        lines[f'{s["fontSize"]}/{s["lineHeight"]}'] += n
        if s["letterSpacing"] not in ("normal", "0px"): tracking[s["letterSpacing"]] += n
        for p in ("marginTop","marginRight","marginBottom","marginLeft","paddingTop","paddingRight","paddingBottom","paddingLeft"):
            v = px(s[p])
            if v and v > 0: space[v] += n
        for p in ("gap","rowGap","columnGap"):
            v = px(s[p])
            if v and v > 0: gaps[v] += n
        for p in ("borderTopLeftRadius","borderTopRightRadius","borderBottomRightRadius","borderBottomLeftRadius"):
            if s[p] not in ("0px",): radii[s[p]] += n
        if s["boxShadow"] != "none": shadows[s["boxShadow"]] += n
        if s["zIndex"] not in ("auto", "0"): z[s["zIndex"]] += n
        if s["transitionDuration"] not in ("0s", "") and s["transitionProperty"] != "none":
            transitions[f'{s["transitionProperty"]} {s["transitionDuration"]} {s["transitionTimingFunction"]} {s["transitionDelay"]}'] += n

    def top(c, k=20): return [{"value": v, "uses": n} for v, n in c.most_common(k)]
    scale = sorted({v for v in list(space) + list(gaps)})
    base = None
    for cand in (4, 8):
        if scale and sum(1 for v in scale if v % cand == 0) / len(scale) > 0.7: base = cand; break

    out = {
        "source": a.inventory, "viewport": inv.get("viewport"),
        "colors": {"text": top(text_colors), "background": top(bg_colors), "border": top(border_colors)},
        "typography": {"families": top(fonts, 8), "sizes": sorted([{"value": v, "uses": n} for v, n in sizes.items()], key=lambda x: px(x["value"]) or 0),
                       "weights": top(weights, 8), "sizeLineHeightPairs": top(lines, 20), "letterSpacing": top(tracking, 8)},
        "spacing": {"detectedBaseUnit": base, "values_px": scale, "mostUsed": top(space, 12), "gaps": top(gaps, 12)},
        "radii": top(radii, 12), "borderWidths": top(borders, 6), "shadows": top(shadows, 10),
        "zIndexLayers": sorted([{"value": v, "uses": n} for v, n in z.items()], key=lambda x: int(x["value"]) if re.match(r"^-?\d+$", x["value"]) else 0),
        "motion": top(transitions, 15),
        "cssVariables": json.load(open(a.css_vars)) if a.css_vars else None,
        "notes": ["DRAFT. Name roles by inspecting where values are used.", "Check hover/focus/active values separately (sweep hoverDiff).", "Check dark mode by re-running dom_inventory.cjs with --dark."],
    }
    json.dump(out, open(a.out, "w"), indent=2)
    print(f"wrote {a.out}")
    print("top text colors:", [x["value"] for x in out["colors"]["text"][:5]])
    print("top backgrounds:", [x["value"] for x in out["colors"]["background"][:5]])
    print("fonts:", [x["value"] for x in out["typography"]["families"][:4]], "| spacing base:", base)

if __name__ == "__main__":
    main()

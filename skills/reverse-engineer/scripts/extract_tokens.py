#!/usr/bin/env python3
"""
Turn inventory.json (from dom_inventory.cjs) into a design token draft.

Usage: python extract_tokens.py inventory.json [--css-vars css-vars.json] [--out design-tokens.json] [--format json|tailwind|css-modules|css-vars]

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

def to_tailwind(tokens):
    """Convert tokens to Tailwind config format."""
    config = {
        "theme": {
            "extend": {
                "colors": {},
                "fontFamily": {},
                "fontSize": {},
                "spacing": {},
                "borderRadius": {},
                "boxShadow": {},
                "zIndex": {},
                "transitionDuration": {},
                "transitionTimingFunction": {},
            }
        }
    }
    # Colors
    for role, values in tokens["colors"].items():
        for i, v in enumerate(values[:10]):
            name = f"{role}-{i+1}" if i > 0 else role
            config["theme"]["extend"]["colors"][name] = v["value"]
    # Typography
    for fam in tokens["typography"]["families"][:5]:
        key = re.sub(r"[^a-z0-9]+", "-", fam["value"].lower()).strip("-")
        config["theme"]["extend"]["fontFamily"][key] = [fam["value"]]
    for sz in tokens["typography"]["sizes"][:10]:
        key = sz["value"].replace("px", "").replace(".", "-")
        config["theme"]["extend"]["fontSize"][key] = sz["value"]
    # Spacing
    for sp in tokens["spacing"]["mostUsed"][:20]:
        key = f"{int(sp['value'])}" if sp['value'] == int(sp['value']) else str(sp['value']).replace(".", "-")
        config["theme"]["extend"]["spacing"][key] = f"{sp['value']}px"
    # Radii
    for rad in tokens["radii"][:10]:
        key = rad["value"].replace("px", "").replace(".", "-")
        config["theme"]["extend"]["borderRadius"][key] = rad["value"]
    # Shadows
    for i, sh in enumerate(tokens["shadows"][:10]):
        config["theme"]["extend"]["boxShadow"][f"level-{i+1}"] = sh["value"]
    # Z-index
    for z in tokens["zIndexLayers"][:10]:
        config["theme"]["extend"]["zIndex"][z["value"]] = z["value"]
    # Motion
    for i, tr in enumerate(tokens["motion"][:10]):
        parts = tr["value"].split()
        if len(parts) >= 2:
            config["theme"]["extend"]["transitionDuration"][f"custom-{i+1}"] = parts[1]
            if len(parts) >= 3:
                config["theme"]["extend"]["transitionTimingFunction"][f"custom-{i+1}"] = parts[2]
    return config

def to_css_modules(tokens):
    """Convert tokens to CSS Modules / CSS custom properties format."""
    lines = [":root {"]
    # Colors
    for role, values in tokens["colors"].items():
        for i, v in enumerate(values[:10]):
            name = f"{role}-{i+1}" if i > 0 else role
            lines.append(f"  --color-{name}: {v['value']};")
    # Typography
    for i, fam in enumerate(tokens["typography"]["families"][:5]):
        lines.append(f"  --font-family-{i+1}: {fam['value']};")
    for i, sz in enumerate(tokens["typography"]["sizes"][:10]):
        lines.append(f"  --font-size-{i+1}: {sz['value']};")
    for i, w in enumerate(tokens["typography"]["weights"][:5]):
        lines.append(f"  --font-weight-{i+1}: {w['value']};")
    # Spacing
    for i, sp in enumerate(tokens["spacing"]["mostUsed"][:20]):
        lines.append(f"  --spacing-{i+1}: {sp['value']}px;")
    for i, gap in enumerate(tokens["spacing"]["gaps"][:10]):
        lines.append(f"  --gap-{i+1}: {gap['value']}px;")
    # Radii
    for i, rad in enumerate(tokens["radii"][:10]):
        lines.append(f"  --radius-{i+1}: {rad['value']};")
    # Shadows
    for i, sh in enumerate(tokens["shadows"][:10]):
        lines.append(f"  --shadow-{i+1}: {sh['value']};")
    # Z-index
    for i, z in enumerate(tokens["zIndexLayers"][:10]):
        lines.append(f"  --z-{i+1}: {z['value']};")
    # Motion
    for i, tr in enumerate(tokens["motion"][:10]):
        lines.append(f"  --transition-{i+1}: {tr['value']};")
    lines.append("}")
    return "\n".join(lines)

def to_css_vars(tokens):
    """Alias for css-modules format."""
    return to_css_modules(tokens)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inventory"); ap.add_argument("--css-vars"); ap.add_argument("--out", default="design-tokens.json")
    ap.add_argument("--format", choices=["json", "tailwind", "css-modules", "css-vars"], default="json")
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

    if a.format == "json":
        output = json.dumps(out, indent=2)
    elif a.format == "tailwind":
        output = json.dumps(to_tailwind(out), indent=2)
    elif a.format in ("css-modules", "css-vars"):
        output = to_css_modules(out)
    else:
        output = json.dumps(out, indent=2)

    with open(a.out, "w") as f:
        f.write(output)
    print(f"wrote {a.out} ({a.format})")
    if a.format == "json":
        print("top text colors:", [x["value"] for x in out["colors"]["text"][:5]])
        print("top backgrounds:", [x["value"] for x in out["colors"]["background"][:5]])
        print("fonts:", [x["value"] for x in out["typography"]["families"][:4]], "| spacing base:", base)

if __name__ == "__main__":
    main()

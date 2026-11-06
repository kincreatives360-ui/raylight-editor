#!/usr/bin/env python3
"""
Lint build cards before handoff.

Usage: python lint_cards.py <IMPLEMENTATION.md | directory of F-###-*.md cards>

Checks per card: has Goal, Spec (or Scope + Spec), acceptance checks, Done when, a not-in-scope line;
title does not bundle features ("and", "+", "&", "/"-joined controls); depends_on IDs exist;
dependency graph has no cycles. Prints problems and a summary. Exit code 1 if errors.
Supports lite cards (### F-001 title | depends: F-000 | files: ...) and full card files.
"""
import sys, re, os, glob

def load(path):
    cards = []
    if os.path.isdir(path):
        for f in sorted(glob.glob(os.path.join(path, "F-*.md"))):
            t = open(f, encoding="utf-8").read()
            m = re.search(r"^#\s*(?:\[[^\]]*\]\s*)?(F-\d+)\s*(.*)$", t, re.M)
            if m: cards.append((m.group(1), m.group(2).strip(), t, f))
    else:
        t = open(path, encoding="utf-8").read()
        parts = re.split(r"^(?=###\s+F-\d+)", t, flags=re.M)
        for p in parts:
            m = re.match(r"###\s+(F-\d+)\s*(.*)", p)
            if m:
                end_m = re.search(r"\n(?=#{1,2}\s+)", p)
                card_text = p[:end_m.start() + 1] if end_m else p
                cards.append((m.group(1), m.group(2).strip(), card_text, path))
    return cards

def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(2)
    cards = load(sys.argv[1]); errs, warns = [], []
    ids = {c[0] for c in cards}
    if not cards: print("no cards found (expected '### F-001 ...' blocks or F-###-*.md files)"); sys.exit(1)
    deps = {}
    for cid, title, body, f in cards:
        low = body.lower()
        def need(label, rx):
            if not re.search(rx, low): errs.append(f"{cid}: missing {label}")
        need("goal", r"\bgoal\b")
        need("spec", r"\bspec\b|## spec|### structure")
        need("acceptance checks", r"\baccept|acceptance tests")
        need("done when", r"done when")
        if not re.search(r"not in scope|out of scope|do not touch", low): warns.append(f"{cid}: no out-of-scope line")
        head = title.split("|")[0]
        if re.search(r"\s(and|&|\+)\s", head.lower()): warns.append(f"{cid}: title may bundle features: '{head.strip()}'")
        if len(body.splitlines()) > 90: warns.append(f"{cid}: long card ({len(body.splitlines())} lines), consider splitting")
        if len(re.findall(r"- \[ \]", body)) == 0 and "accept" in low: warns.append(f"{cid}: acceptance has no checkbox items")
        if re.search(r"#[0-9a-fA-F]{3,8}\b", body) and "token" not in low: warns.append(f"{cid}: raw hex colors but no token names mentioned")
        m = re.search(r"depend(?:s|s on)?(?: on)?\s*:?\s*([^\n|]*)", body, re.I)
        d = set(re.findall(r"F-\d+", m.group(1))) if m else set()
        deps[cid] = d
        for x in d:
            if x not in ids: errs.append(f"{cid}: depends on unknown {x}")
    # cycle check
    state = {}
    def dfs(n, stack):
        if state.get(n) == 1: errs.append("cycle: " + " -> ".join(stack + [n])); return
        if state.get(n) == 2: return
        state[n] = 1
        for x in deps.get(n, []):
            if x in deps: dfs(x, stack + [n])
        state[n] = 2
    for n in deps: dfs(n, [])
    for e in errs: print("ERROR", e)
    for w in warns: print("warn ", w)
    print(f"\n{len(cards)} cards, {len(errs)} errors, {len(warns)} warnings")
    sys.exit(1 if errs else 0)

if __name__ == "__main__":
    main()

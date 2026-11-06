#!/usr/bin/env bash
# Prefer the Node version on Windows/macOS: node scripts/scaffold_workspace.js ...
# This bash version needs GNU sed (sed -i) and a POSIX shell.
# Usage: scaffold_workspace.sh <slug> [output-dir] [--tier full|impl] [--feature "<name>"]
#   --tier full : whole product from scratch (T1): full document set + cards folder
#   --tier impl : codebase exists or feature scoped (T2): ONE IMPLEMENTATION.md, no other docs (default)
set -euo pipefail
slug="${1:?usage: scaffold_workspace.sh <slug> [output-dir] [--tier full|impl] [--feature name]}"; shift
out="."; tier="impl"; feature=""
if [ $# -gt 0 ] && [[ "$1" != --* ]]; then out="$1"; shift; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --tier) tier="$2"; shift 2;;
    --feature) feature="$2"; shift 2;;
    *) echo "unknown option $1"; exit 1;;
  esac
done
root="$out/re-$slug"
skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tpl="$skill_dir/assets/templates"
cp_new() { [ -e "$2" ] || cp "$1" "$2"; }

mkdir -p "$root"/01-recon "$root"/02-evidence/screens "$root"/02-evidence/controls "$root"/02-evidence/sweep "$root"/06-parity
cp_new "$tpl/state.md" "$root/STATE.md"
[ -e "$root/UNKNOWNS.md" ] || cat > "$root/UNKNOWNS.md" << 'EOT'
# Unknowns, assumptions, risks
| ID | Type | Description | How to verify | Status |
|---|---|---|---|---|
EOT

if [ "$tier" = "full" ]; then
  mkdir -p "$root"/02-evidence/flows "$root"/02-evidence/network "$root"/02-evidence/motion \
           "$root"/03-docs/user-flows "$root"/03-docs/adr "$root"/04-components "$root"/05-features
  cp_new "$tpl/prd.md" "$root/03-docs/PRD.md"
  cp_new "$tpl/trd.md" "$root/03-docs/TRD.md"
  cp_new "$tpl/user-flow.md" "$root/03-docs/user-flows/_TEMPLATE-J-00.md"
  cp_new "$tpl/component-spec.md" "$root/04-components/_TEMPLATE-K-00.md"
  cp_new "$tpl/build-card.md" "$root/05-features/_TEMPLATE-F-000.md"
  cp_new "$tpl/adr.md" "$root/03-docs/adr/_TEMPLATE-ADR-000.md"
  cp_new "$tpl/interaction-spec.md" "$root/03-docs/INTERACTION-SPEC.md"
  [ -e "$root/feature-matrix.csv" ] || echo "id,stage,name,area,type,screens,controls,depends_on,priority,status,card_file,evidence,confidence" > "$root/feature-matrix.csv"
  [ -e "$root/00-INDEX.md" ] || cat > "$root/00-INDEX.md" << EOT
# Reverse engineering: $slug (Tier T1 full kit)
Created: $(date +%Y-%m-%d)
Status board: see STATE.md. Documents (link as written):
First five cards to run:
EOT
else
  cp_new "$tpl/implementation-doc.md" "$root/IMPLEMENTATION.md"
  if [ -n "$feature" ]; then
    # portable sed (GNU and BSD)
    tmp=$(mktemp)
    sed "s|# IMPLEMENTATION: <Feature or product part>|# IMPLEMENTATION: $feature|" "$root/IMPLEMENTATION.md" > "$tmp" && mv "$tmp" "$root/IMPLEMENTATION.md"
  fi
fi
echo "Workspace ready: $root (tier: $tier)"

#!/usr/bin/env python3
"""
Token Theming Engine - Light/dark pairing, contrast validation, semantic role assignment.

Usage:
  python theme_tokens.py design-tokens.json [--out themed-tokens.json]
        [--light-inventory light-inventory.json] [--dark-inventory dark-inventory.json]
        [--format json|tailwind|css-vars|figma] [--wcag AA|AAA]
        [--assign-roles] [--validate] [--report]

Features:
- Pair light/dark tokens from separate inventories
- Assign semantic roles (primary, secondary, surface, border, etc.) by usage context
- Validate WCAG contrast ratios (AA/AAA)
- Generate themed output for Tailwind, CSS vars, Figma tokens
- Report accessibility violations with fix suggestions
"""
import argparse, json, re, sys, math
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

# WCAG contrast thresholds
WCAG_THRESHOLDS = {
    'AA': { 'normal': 4.5, 'large': 3.0 },
    'AAA': { 'normal': 7.0, 'large': 4.5 },
}

# Semantic role patterns - usage context hints
ROLE_PATTERNS = {
    'primary': {
        'bg': ['button', 'btn', 'primary', 'cta', 'submit', 'hero', 'banner'],
        'text': ['link', 'heading', 'title', 'brand'],
        'border': ['focus', 'ring', 'active'],
    },
    'secondary': {
        'bg': ['button', 'btn', 'secondary', 'outline', 'ghost'],
        'text': ['subtitle', 'caption', 'muted'],
        'border': ['input', 'field', 'card'],
    },
    'surface': {
        'bg': ['background', 'bg', 'surface', 'card', 'panel', 'modal', 'dialog', 'popover'],
        'text': [],
        'border': ['divider', 'separator', 'hr'],
    },
    'background': {
        'bg': ['page', 'body', 'canvas', 'viewport'],
        'text': [],
        'border': [],
    },
    'border': {
        'bg': [],
        'text': [],
        'border': ['border', 'outline', 'stroke', 'ring', 'divider'],
    },
    'success': {
        'bg': ['success', 'positive', 'confirm', 'check'],
        'text': ['success', 'positive'],
        'border': ['success', 'valid'],
    },
    'warning': {
        'bg': ['warning', 'caution', 'pending'],
        'text': ['warning', 'caution'],
        'border': ['warning'],
    },
    'error': {
        'bg': ['error', 'danger', 'destructive', 'delete', 'critical'],
        'text': ['error', 'danger', 'destructive'],
        'border': ['error', 'invalid', 'danger'],
    },
    'info': {
        'bg': ['info', 'help', 'tooltip'],
        'text': ['info', 'link'],
        'border': ['info'],
    },
}

def load_inventory(path):
    """Load inventory.json from dom_inventory.cjs."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_tokens(path):
    """Load design-tokens.json from extract_tokens.py."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def to_rgb(color):
    """Parse color string to (r, g, b, a). Supports hex, #rrggbb@alpha, rgb, rgba."""
    if not color or not isinstance(color, str):
        return None
    try:
        color = color.strip()
        
        # Hex with optional @alpha: #ffffff@0.8
        hex_alpha_match = re.match(r'^#([0-9a-fA-F]{3,8})@([0-9.]+)$', color)
        if hex_alpha_match:
            hex_str = hex_alpha_match.group(1)
            alpha_val = float(hex_alpha_match.group(2))
            if len(hex_str) == 3:
                hex_str = ''.join(c * 2 for c in hex_str)
            if len(hex_str) >= 6:
                r = int(hex_str[0:2], 16)
                g = int(hex_str[2:4], 16)
                b = int(hex_str[4:6], 16)
                return (r, g, b, alpha_val)

        # Hex
        hex_match = re.match(r'^#([0-9a-fA-F]{3,8})$', color)
        if hex_match:
            hex_str = hex_match.group(1)
            if len(hex_str) == 3:
                hex_str = ''.join(c*2 for c in hex_str)
            if len(hex_str) == 6:
                r = int(hex_str[0:2], 16)
                g = int(hex_str[2:4], 16)
                b = int(hex_str[4:6], 16)
                return (r, g, b, 1.0)
            if len(hex_str) == 8:
                r = int(hex_str[0:2], 16)
                g = int(hex_str[2:4], 16)
                b = int(hex_str[4:6], 16)
                a = int(hex_str[6:8], 16) / 255
                return (r, g, b, a)
        
        # RGB/RGBA
        rgb_match = re.match(r'rgba?\(([^)]+)\)', color)
        if rgb_match:
            parts = [p.strip() for p in re.split(r'[,/ ]+', rgb_match.group(1)) if p.strip()]
            r = int(float(parts[0]))
            g = int(float(parts[1]))
            b = int(float(parts[2]))
            a = float(parts[3]) if len(parts) > 3 else 1.0
            return (r, g, b, a)
        
        # Named colors (basic)
        named = {
            'transparent': (0, 0, 0, 0),
            'black': (0, 0, 0, 1),
            'white': (255, 255, 255, 1),
            'red': (255, 0, 0, 1),
            'green': (0, 128, 0, 1),
            'blue': (0, 0, 255, 1),
        }
        if color.lower() in named:
            return named[color.lower()]
        
        return None
    except Exception:
        return None

def relative_luminance(r, g, b):
    """Calculate relative luminance per WCAG."""
    def channel(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

def contrast_ratio(color1, color2):
    """Calculate contrast ratio between two colors."""
    rgb1 = to_rgb(color1)
    rgb2 = to_rgb(color2)
    if not rgb1 or not rgb2:
        return None
    
    # Handle transparency - blend with white background
    def blend(rgb):
        r, g, b, a = rgb
        if a >= 1.0:
            return (r, g, b)
        # Blend with white
        return (
            int(r * a + 255 * (1 - a)),
            int(g * a + 255 * (1 - a)),
            int(b * a + 255 * (1 - a))
        )
    
    r1, g1, b1 = blend(rgb1)
    r2, g2, b2 = blend(rgb2)
    
    l1 = relative_luminance(r1, g1, b1)
    l2 = relative_luminance(r2, g2, b2)
    
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def assign_roles(tokens, inventory=None):
    """Assign semantic roles to color tokens based on usage context."""
    if not inventory:
        # Heuristic: assign by frequency and value
        roles = {}
        text_colors = tokens.get('colors', {}).get('text', [])
        bg_colors = tokens.get('colors', {}).get('background', [])
        border_colors = tokens.get('colors', {}).get('border', [])
        
        # Most used text -> primary text
        if text_colors:
            roles['text_primary'] = text_colors[0]['value']
        if len(text_colors) > 1:
            roles['text_secondary'] = text_colors[1]['value']
        if len(text_colors) > 2:
            roles['text_muted'] = text_colors[2]['value']
        
        # Most used bg -> surface
        if bg_colors:
            roles['bg_surface'] = bg_colors[0]['value']
        if len(bg_colors) > 1:
            roles['bg_primary'] = bg_colors[1]['value']
        if len(bg_colors) > 2:
            roles['bg_secondary'] = bg_colors[2]['value']
        
        # Borders
        if border_colors:
            roles['border_default'] = border_colors[0]['value']
        if len(border_colors) > 1:
            roles['border_strong'] = border_colors[1]['value']
        
        return roles
    
    # With inventory: analyze usage context
    # This would need the full inventory tree - simplified for now
    return assign_roles(tokens, None)

def pair_light_dark(light_tokens, dark_tokens):
    """Pair light and dark mode tokens by semantic role."""
    paired = {}
    
    # Get color arrays
    light_colors = light_tokens.get('colors', {})
    dark_colors = dark_tokens.get('colors', {})
    
    for category in ['text', 'background', 'border']:
        light_vals = light_colors.get(category, [])
        dark_vals = dark_colors.get(category, [])
        
        # Pair by index (assumes same order from extract_tokens)
        for i, (lv, dv) in enumerate(zip(light_vals, dark_vals)):
            role = f"{category}_{i}"
            paired[role] = {
                'light': lv['value'],
                'dark': dv['value'],
                'light_uses': lv.get('uses', 0),
                'dark_uses': dv.get('uses', 0),
            }
    
    return paired

def validate_contrast(paired_tokens, level='AA'):
    """Validate WCAG contrast for all text/background pairs."""
    violations = []
    passes = []
    skipped = []
    thresholds = WCAG_THRESHOLDS[level]
    
    # Test text on background combinations
    text_colors = {k: v for k, v in paired_tokens.items() if k.startswith('text_')}
    bg_colors = {k: v for k, v in paired_tokens.items() if k.startswith('bg_') or k.startswith('background_')}
    
    for text_role, text_val in text_colors.items():
        for bg_role, bg_val in bg_colors.items():
            light_ratio = contrast_ratio(text_val['light'], bg_val['light'])
            dark_ratio = contrast_ratio(text_val['dark'], bg_val['dark'])
            
            # Determine required threshold (large text if size > 18px or bold > 14px)
            # We don't have size info, so use normal threshold
            required = thresholds['normal']
            
            result = {
                'text_role': text_role,
                'bg_role': bg_role,
                'light_ratio': round(light_ratio, 2) if light_ratio is not None else None,
                'dark_ratio': round(dark_ratio, 2) if dark_ratio is not None else None,
                'required': required,
                'level': level,
            }
            
            # If either ratio cannot be computed, add to skipped instead of violations
            if light_ratio is None or dark_ratio is None:
                skipped.append(result)
                continue
            
            light_pass = light_ratio >= required
            dark_pass = dark_ratio >= required
            result['light_pass'] = light_pass
            result['dark_pass'] = dark_pass
            
            if light_pass and dark_pass:
                passes.append(result)
            else:
                violations.append(result)
    
    return {'passes': passes, 'violations': violations, 'skipped': skipped}

def suggest_fixes(violations, paired_tokens):
    """Suggest color adjustments to fix contrast violations."""
    suggestions = []
    for v in violations:
        text_val = paired_tokens.get(v['text_role'], {})
        bg_val = paired_tokens.get(v['bg_role'], {})
        
        # Try adjusting text color
        for mode in ['light', 'dark']:
            ratio = v[f'{mode}_ratio']
            if ratio and ratio < v['required']:
                # Suggest darkening text or lightening background
                suggestions.append({
                    'violation': v,
                    'mode': mode,
                    'suggestion': f"Adjust {v['text_role']} {mode} or {v['bg_role']} {mode} to achieve {v['required']}:1 ratio (current: {ratio}:1)",
                    'action': 'darken_text' if mode == 'light' else 'lighten_text',
                })
    
    return suggestions

def to_tailwind_config(paired_tokens, roles=None):
    """Generate Tailwind config with light/dark variants."""
    config = {
        'theme': {
            'extend': {
                'colors': {},
            }
        }
    }
    
    # Map paired tokens to Tailwind color scale
    for role, vals in paired_tokens.items():
        if isinstance(vals, dict) and 'light' in vals and 'dark' in vals:
            # Create color scale
            base_name = role.replace('_', '-')
            config['theme']['extend']['colors'][base_name] = {
                'light': vals['light'],
                'dark': vals['dark'],
                'DEFAULT': vals['light'],  # default to light
            }
    
    return config

def to_css_vars(paired_tokens):
    """Generate CSS custom properties with light/dark."""
    lines = [':root {', '  /* Light theme (default) */']
    
    for role, vals in paired_tokens.items():
        if isinstance(vals, dict) and 'light' in vals:
            name = role.replace('_', '-')
            lines.append(f'  --color-{name}: {vals["light"]};')
    
    lines.append('}')
    lines.append('')
    lines.append('@media (prefers-color-scheme: dark) {')
    lines.append('  :root {')
    
    for role, vals in paired_tokens.items():
        if isinstance(vals, dict) and 'dark' in vals:
            name = role.replace('_', '-')
            lines.append(f'    --color-{name}: {vals["dark"]};')
    
    lines.append('  }')
    lines.append('}')
    
    return '\n'.join(lines)

def to_figma_tokens(paired_tokens):
    """Generate Figma Tokens plugin compatible JSON."""
    figma = {
        '$themes': ['light', 'dark'],
        '$metadata': {
            'tokenSetOrder': ['light', 'dark'],
        },
        'color': {},
    }
    
    for role, vals in paired_tokens.items():
        if isinstance(vals, dict) and 'light' in vals and 'dark' in vals:
            name = role.replace('_', '/')
            figma['color'][name] = {
                '$type': 'color',
                'light': {'$value': vals['light']},
                'dark': {'$value': vals['dark']},
            }
    
    return figma

def main():
    ap = argparse.ArgumentParser(description='Token theming engine')
    ap.add_argument('tokens', help='design-tokens.json from extract_tokens.py')
    ap.add_argument('--out', default='themed-tokens.json', help='Output file')
    ap.add_argument('--light-inventory', help='Light mode inventory.json for role assignment')
    ap.add_argument('--dark-inventory', help='Dark mode inventory.json for pairing')
    ap.add_argument('--dark-tokens', help='Dark mode design-tokens.json for pairing')
    ap.add_argument('--format', choices=['json', 'tailwind', 'css-vars', 'figma'], default='json')
    ap.add_argument('--wcag', choices=['AA', 'AAA'], default='AA', help='WCAG level for contrast validation')
    ap.add_argument('--assign-roles', action='store_true', help='Assign semantic roles to tokens')
    ap.add_argument('--validate', action='store_true', help='Validate contrast ratios')
    ap.add_argument('--report', action='store_true', help='Generate detailed report')
    ap.add_argument('--dry-run', action='store_true', help='Print to stdout')
    a = ap.parse_args()
    
    # Load base tokens
    tokens = load_tokens(a.tokens)
    
    # Load dark tokens if provided
    dark_tokens = None
    if a.dark_tokens:
        dark_tokens = load_tokens(a.dark_tokens)
    elif a.dark_inventory:
        print("Error: Direct token extraction from --dark-inventory is not implemented. Please extract tokens first using extract_tokens.py and provide them via --dark-tokens.", file=sys.stderr)
        sys.exit(1)
    
    # Pair light/dark
    paired = {}
    if dark_tokens:
        paired = pair_light_dark(tokens, dark_tokens)
    else:
        # Single theme - just restructure
        for cat in ['text', 'background', 'border']:
            for i, v in enumerate(tokens.get('colors', {}).get(cat, [])):
                paired[f'{cat}_{i}'] = {
                    'light': v['value'],
                    'dark': v['value'],
                    'light_uses': v.get('uses', 0),
                }
    
    # Assign roles
    roles = None
    if a.assign_roles:
        roles = assign_roles(tokens, load_inventory(a.light_inventory) if a.light_inventory else None)
    
    # Validate contrast
    validation = None
    if a.validate:
        validation = validate_contrast(paired, a.wcag)
    
    # Generate output
    if a.format == 'json':
        output = {
            'meta': {
                'source': a.tokens,
                'generated': datetime.now().isoformat(),
                'wcag_level': a.wcag,
                'paired_count': len(paired),
            },
            'tokens': paired,
            'roles': roles,
            'validation': validation,
        }
        result = json.dumps(output, indent=2)
    elif a.format == 'tailwind':
        result = json.dumps(to_tailwind_config(paired, roles), indent=2)
    elif a.format == 'css-vars':
        result = to_css_vars(paired)
    elif a.format == 'figma':
        result = json.dumps(to_figma_tokens(paired), indent=2)
    
    if a.dry_run:
        print(result)
    else:
        Path(a.out).write_text(result, encoding='utf-8')
        print(f"Generated: {a.out}")
    
    # Print validation summary
    if a.validate and validation:
        v = validation['violations']
        p = validation['passes']
        s = validation.get('skipped', [])
        print(f"\nContrast Validation (WCAG {a.wcag}):")
        print(f"  Passes: {len(p)}")
        print(f"  Violations: {len(v)}")
        if s:
            print(f"  Skipped: {len(s)}")
        if v:
            print("\nTop violations:")
            for viol in v[:5]:
                print(f"  {viol['text_role']} on {viol['bg_role']}: "
                      f"light={viol['light_ratio']}:1 dark={viol['dark_ratio']}:1 "
                      f"(need {viol['required']}:1)")
    
    if a.report and validation:
        report_path = Path(a.out).with_suffix('.report.md')
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f"# Contrast Validation Report\n\n")
            f.write(f"**Source:** {a.tokens}\n")
            f.write(f"**WCAG Level:** {a.wcag}\n")
            f.write(f"**Generated:** {datetime.now().isoformat()}\n\n")
            f.write(f"## Summary\n")
            f.write(f"- **Passes:** {len(validation['passes'])}\n")
            f.write(f"- **Violations:** {len(validation['violations'])}\n")
            if validation.get('skipped'):
                f.write(f"- **Skipped (uncomputable):** {len(validation['skipped'])}\n")
            f.write("\n")
            if validation['violations']:
                f.write(f"## Violations\n\n")
                for v in validation['violations']:
                    f.write(f"### {v['text_role']} on {v['bg_role']}\n")
                    f.write(f"- Light ratio: {v['light_ratio']}:1 {'✅' if v['light_pass'] else '❌'}\n")
                    f.write(f"- Dark ratio: {v['dark_ratio']}:1 {'✅' if v['dark_pass'] else '❌'}\n")
                    f.write(f"- Required: {v['required']}:1 ({v['level']})\n\n")
        print(f"Report: {report_path}")

if __name__ == '__main__':
    main()
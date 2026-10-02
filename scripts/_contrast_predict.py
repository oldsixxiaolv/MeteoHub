#!/usr/bin/env python3
"""Pre-flight: verify proposed token edits pass WCAG AA before applying them."""

def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c*2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rel_lum(rgb):
    def channel(c):
        c /= 255.0
        return c/12.92 if c <= 0.03928 else ((c + 0.055)/1.055) ** 2.4
    r, g, b = rgb
    return 0.2126*channel(r) + 0.7152*channel(g) + 0.0722*channel(b)

def contrast(c1, c2):
    L1, L2 = rel_lum(hex_to_rgb(c1)), rel_lum(hex_to_rgb(c2))
    if L1 < L2: L1, L2 = L2, L1
    return (L1 + 0.05) / (L2 + 0.05)

# Proposed values (per Phase 1.3 report §2.3 and lead's directive)
PROPOSED = {
    # 1. link color: drop brand-500 to give ≥5:1 on neutral-50
    ("LIGHT", "brand-500-new"):  "#1f5ec8",  # was #256ef0 (4.34)
    # 2. muted text neutral-500: darken LIGHT, lighten DARK
    ("LIGHT", "neutral-500-new"): "#6b665d",  # was #7d776d (4.19)
    ("DARK",  "neutral-500-new"): "#928d83",  # was #807c72 (4.38)
    # 3. badge text: step down to accent-600 on accent-50
    ("LIGHT", "accent-600"):     "#b14810",  # already in tokens.css
    # 4. eyebrow: same accent-600 swap (light) OR step up to large text
    # 5. button bg LIGHT: add --button-primary-bg = #1453d8 (between 500/700)
    ("LIGHT", "button-primary"): "#1453d8",
    # Existing reference colors
    ("LIGHT", "neutral-50"):     "#faf8f5",
    ("LIGHT", "accent-50"):      "#fff3eb",
    ("LIGHT", "neutral-0"):      "#ffffff",
    ("DARK",  "neutral-50"):     "#161513",
    ("DARK",  "accent-50"):      "#0e1a35",
    ("DARK",  "brand-400"):      "#4d97ff",
    ("DARK",  "neutral-0"):      "#0f0e0c",
    ("DARK",  "accent-500"):     "#ffa874",
    ("LIGHT", "neutral-900"):    "#0f0d0a",
    ("DARK",  "neutral-900"):    "#f5f2ea",
}

print("=" * 70)
print("PRE-FLIGHT: predicted contrast ratios AFTER token edits")
print("=" * 70)
checks = [
    # (label, mode, fg, bg, target)
    ("link default LIGHT",         "LIGHT", "brand-500-new", "neutral-50", 4.5),
    ("muted text LIGHT",           "LIGHT", "neutral-500-new","neutral-50", 4.5),
    ("muted text DARK",            "DARK",  "neutral-500-new","neutral-50", 4.5),
    ("badge accent-600 on accent-50 LIGHT","LIGHT","accent-600","accent-50", 4.5),
    ("eyebrow accent-600 on neutral-50 LIGHT","LIGHT","accent-600","neutral-50", 4.5),
    ("button white on new button-primary LIGHT","LIGHT","neutral-0","button-primary", 4.5),
    # existing pass-throughs that must stay passing
    ("body primary LIGHT",         "LIGHT", "neutral-900", "neutral-50", 4.5),
    ("body primary DARK",          "DARK",  "neutral-900", "neutral-50", 4.5),
    ("link default DARK",          "DARK",  "brand-400", "neutral-50", 4.5),
    ("accent on page DARK",        "DARK",  "accent-500", "neutral-50", 4.5),
]

fails = 0
for label, mode, fg_t, bg_t, target in checks:
    fg = PROPOSED[(mode, fg_t)]
    bg = PROPOSED[(mode, bg_t)]
    r = contrast(fg, bg)
    status = "✅" if r >= target else "❌"
    if r < target: fails += 1
    print(f"  {status} {label:<48} {r:>5.2f}:1 (need {target})")

print()
print("=" * 70)
print(f"RESULT: {fails} predicted fail(s)")
print("=" * 70)

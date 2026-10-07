# Design — Segundo Cérebro

## Authority and current scope

The visual world is already approved: D-012, D-013, D-025 and D-030 in `docs/planejamento/registro-de-decisoes.md`; DS 2.1 measures and behavior in `docs/planejamento/14-prototipo-interacoes.md`. T-001 inherits this world for a provisional construction page. It does not ship the full design system, app shell or dashboard.

Product truth lives in `PRODUCT.md`. The `/` purpose, reading order and interaction contract live in `.impeccable/surfaces/home.md`.

## Brand and typography

- **Observed:** preserve the geometric “2” and its two nodes. The inline symbol and favicon originate in `novo-segundo-cerebro/design-system/brand`; geometry is unchanged. Brand lettering is real HTML in Geist rather than the legacy Inter-based SVG text.
- **Confirmed:** Geist is the sole family (D-025), served locally by the `geist` package through `next/font`; fallback is Segoe UI/system sans.
- **RECOMENDADO, implemented provisionally for T-001:** named CSS roles: title 42px desktop / 32px mobile, heading 20px, body 16px, label 14px. These are a deliberately small provisional set, not the T-002 final scale. The construction-page title is larger than the operational 28px title in doc 14 because this route explains one status instead of presenting a working module.
- Weights 400/500/600, tracking no tighter than -0.035em, prose line-height 1.6. No uppercase eyebrow or decorative monospace.

## Observed palette consumed by T-001

All page colors are named CSS variables in `src/app/globals.css`, copied from the approved prototype. Layout metadata repeats only the two canvas values required by the browser theme-color API; favicon preserves the original static brand asset colors.

| Role | Light | Dark |
|---|---|---|
| `--canvas` | `#f5f5f2` | `#0d0d0c` |
| `--surface` | `#ffffff` | `#161615` |
| `--surface-hover` | `#efeeea` | `#1d1d1b` |
| `--ink` | `#161613` | `#f2f1ec` |
| `--muted` | `#5f5e58` | `#b3b1a8` |
| `--line` | `#e6e4dd` | `#262624` |
| `--inverse` | `#161613` | `#f2f1ec` |
| `--inverse-ink` | `#f6f5f1` | `#161613` |
| `--inverse-muted` | `#b9b7af` | `#5c5b53` |

T-001 follows `prefers-color-scheme` directly. There is no theme preference, localStorage theme or selector. T-002 owns the complete source of tokens, Tailwind `@theme` integration, contrast validator and Claro/Escuro/Sistema behavior.

## Composition and material

The page composition and measures below are **RECOMENDADO**, implemented for this provisional surface. Palette and inherited panel-radius values are **OBSERVADO** in the approved visual references.

- A single asymmetric two-panel grid: the current construction state leads, the future product mechanism follows. No simulated navigation or sample dashboard data.
- Content width including padding: at most 1184px; inner columns 1.6:1 with 24px gap. At 767px and below, one column with 16px gap, keeping the DOM order.
- Generous radii inherit the explicitly approved bento identity: panels 28px desktop / 20px mobile; link control 12px. This intentionally preserves the product brief over the generic craft-floor radius suggestion.
- The inverse panel uses only a solid surface; the companion panel uses one border and no shadow. No nested cards, blur, decorative gradient or hero metric.
- Mobile uses 20px outer padding, safe-area insets and `dvh`. No global `overflow-x: hidden`.

## Interaction and accessibility

- One h1, semantic header/main/footer, named supporting section and a definition list for future capabilities.
- All available actions are links to real project destinations. No placeholder buttons, fake search, login, avatar or disabled future modules.
- Links have 48px minimum height, visible focus and hover/pressed feedback. A keyboard-only skip link targets the focusable main region.
- No page-load motion. Color transitions are 120ms and disappear under reduced-motion preferences. No transparency effect requires a reduced-transparency fallback on this surface.
- Selection, focus outline and browser light/dark surface use the same palette.

## Verification boundary

Static contrast calculation on 07/10/2026 used WCAG relative sRGB luminance for the exact foreground/background pairs present here. Minimum text contrast is 5.95:1 in light mode (muted/canvas) and 6.04:1 in dark mode (inverse-muted/inverse); primary-link hover is 9.03:1 and 6.04:1 respectively. This verifies the named color pairs, not the final browser rendering or the future four-surface token validator.

The root task owns typecheck/build, DOM seam tests and batched browser review at desktop/mobile sizes. The page has no remote font, service dependency or required environment variable. This document records implemented values and intended checks; it does not certify unexecuted visual, device or contrast tests. T-005 must still verify PWA behavior and physical-device installation.

## Deferred work

T-002: full token source, generated CSS/validator, theme persistence and token showcase. T-003/T-006: reusable primitives and their complete interaction states. T-004: actual navigation and app chrome. T-005: manifest, worker, offline fallback and visual CI gates. T-001 must not be reported as completing these tickets.

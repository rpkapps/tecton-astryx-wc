# Tecton theme — extracted visual system for the Astryx Web Components port

Research + data only. Machine-readable companion: [`tecton-semantic-map.json`](./tecton-semantic-map.json)
(every row below, with full palette paths, is in that file; the token build should read the JSON, not this page).

**Bottom line.**

- Every upstream Astryx semantic token (258: 188 core + 56 data-viz + 14 syntax) has a Tecton value for both modes.
  174 come straight from the owner's `tecton-astryx` theme, 28 are upstream defaults that Tecton deliberately keeps
  (spacing, motion, three sub-10px font sizes), and 56 are **proposed** here: all of them data-viz tokens, which
  `tecton-astryx` never mapped.
- The dark theme is well founded. Nearly every dark value is transcribed from the design and cross-checks against a
  second Tecton source (158 of 161 comparable roles agree).
- **The light theme needs an owner decision.** `tecton-astryx` *derived* every light value by rule, because it
  believed no light artefact existed. But `tecton-webcomponents/packages/wc/tokens/tecton-tokens.css` is a generated
  Tecton export that includes a full, designed light block, and it disagrees with the derivation on 114 of 161
  comparable roles (§3.4).
- Fonts: Figtree + IBM Plex Mono, both SIL OFL 1.1, delivered from `@fontsource-variable/figtree` +
  `@fontsource/ibm-plex-mono`. Radii: 0/2/4/8/12/16/full, applied by role. Spacing: Astryx unchanged, and no spacing
  exceptions were ever recorded.
- Icons: 131 Tecton glyphs (16×16, filled paths, outline + filled variants) exist as a Figma export in
  `tecton-astryx/design/icons/tecton/`. **No licence or provenance statement exists anywhere**, so the owner must
  confirm before we redistribute them.

Paths in the tables omit the `foundational.color.` prefix; the JSON carries the full path exactly as it appears in
`tecton.tokens.json`.

---

## 1. Sources and authority order

| # | Source | What it contributes | Trust |
|---|---|---|---|
| 1 | `tecton.tokens.json` (sha256 `4731ddd0…367f3`; identical copies in `tecton-webcomponents/packages/wc/tokens/` and `tecton-astryx/tokens/`) | 1,820 raw colour primitives. No semantics, no alias refs, no type/radius/space | Immutable primitive layer |
| 2 | `tecton-astryx/packages/react/src/theme/*.ts` (commit `8b59472`, built on `@astryxdesign/core` 0.6.2) | Semantic roles (`semantic.ts`), Astryx token bindings (`tectonTheme.ts`), type scale (`typography.ts`), 34 theme-local tokens (`localTokens.ts`), 73 component targets (`components.ts`), icon registry (`icons.ts`) | **Primary source for all Tecton decisions.** Where the code and its docs disagree, the code wins. For example, `light-mode.md` still quotes 10 %/20 % hover washes; the code uses 5 %/10 % |
| 3 | `tecton-astryx/design/foundations/*` | Verbatim transcription of the Tecton foundation pages: 266 colour rows (dark only), 16 type variants, 20 spacing and 7 radius tokens | Design ground truth for dark mode, type, radius and space |
| 4 | `tecton-astryx/design/components/*.md`, `docs/design/{fidelity-report,theme-audit,light-mode}.md` | Per-component measurements, gaps, and contrast audits | Evidence |
| 5 | `tecton-webcomponents/packages/wc/tokens/tecton-tokens.css` | "Generated CSS export of the Tecton design system (Tecton MUI v1.0), pasted verbatim": light **and** dark semantic tokens, type, space, radius, border widths, icon sizes | Independent Tecton output. Its dark block validates #2. Its light block is the only *designed* light data we have (§3.4) |
| 6 | Upstream Astryx `ca632c6` (`@astryxdesign/core` 0.6.3): `theme/tokens.stylex.ts`, `domainTokens/dataTokens.ts`, `syntax/tokens.ts`, `onMediaTokens.ts`, `themeAdaptations.ts` | The complete semantic token inventory we must bind | Inventory only |

Version drift 0.6.2 → 0.6.3: every colour, radius, shadow, focus, size, border and type token that upstream defines
at `ca632c6` is also in `tecton-astryx`'s `theme-token-manifest.json` (253 names). The only upstream names that
`tecton-astryx` never set are `--spacing-*` (15), `--duration-*` (9), `--ease-standard` and
`--font-size-{4xs,3xs,2xs}`. It kept all of them as upstream defaults on purpose. There is nothing new to map.

---

## 2. Token-file audit (`tecton.tokens.json`)

### 2.1 Structure

- The root is `foundational.color`; nothing else is at the top level. All 1,820 tokens are `$type: "color"`. There
  are no `$description` fields, no alias references (`{…}`), and no typography, radius, spacing or shadow tokens.
- Every token carries `$extensions`:
  - `com.figma.hiddenFromPublishing` is present on all 1,820 and `false` on all of them.
  - `com.figma.scopes` is present on 1,818, always `["ALL_SCOPES"]`. The two without scopes are the `shades.white`
    and `shades.black` value nodes.
  - Preserve both in the primitive manifest. Neither affects rendering.
- Values are all lowercase hex: 1,190 are opaque `#rrggbb` and 630 carry alpha as `#rrggbbaa`. There are no
  `rgb()` or named colours.
- Scope: 814 tokens sit under `onDark`, 796 under `onLight`, and 210 under neither: `shades` 42, `MPL` 43,
  `Colorcet` 125.

| Group | Shape | Count |
|---|---|---|
| 13 hue families (`red yellow pink green azure blue saffron lilac lime lemon violet orchid` + `mauve`/`graphite`) | `onDark` / `onLight`, each with a 23-stop ramp (`50 100 105 110 115 120 130 140 160 190 220 260 310 370 460 560 680 830 1000 1170 1300 1440 1570`), a `core.{50,100,200…900}` saturated sub-ramp (10), and a `transparent.<stop>.{5…95}` alpha ladder (19). `mauve` and `graphite` add `surface.{50…900}` (10). `lilac.onLight.transparent` also has a stray `110.50` | 104 each (124 for mauve/graphite, 105 for lilac) |
| `gray` (the neutral) | **Asymmetric.** `onDark` = `contrasts.<23 stops>` + `saturations.{5…95}` + `washes.{5…95}` (no plain ramp, no `transparent`). `onLight` = plain 23-stop ramp + `transparent.370.*` | 61 + 42 |
| `hotPink` | One token per mode: key **`"460 (focus outline)"`**. `onDark #ff52a8`, `onLight #ff00aa`. This is the only role named anywhere in the file | 2 |
| `shades` | `white` and `black` are **value + children** nodes: each has its own `$value` *and* a `transparent.{0,5…95}` group (20). Neither has an onDark/onLight split | 42 |
| `custom.appColors` | `onDark` / `onLight` × `app1…app4` (muted app-identity colours; not used by any Tecton role) | 8 |
| `MPL` | Matplotlib colormap samples, e.g. `viridis-0%`, `Plasma-25%`, `Turbo-40%`. Mixed-case keys with `%` | 43 |
| `Colorcet` | Colorcet colormap samples, e.g. `rainbow_bgyrm_35_85_c71-25%`. Underscores and `%` | 125 |

**Ramp direction.** On `onDark` a higher stop is *lighter*; on `onLight` a higher stop is *darker*. So a stop number
names a contrast *role* rather than a lightness, and that is what the "same family, same stop, other ramp"
light-derivation rule relies on. Alpha ladders sit on a different stop per surface (for example
`yellow.onDark.transparent.1000.*` and `yellow.onLight.transparent.160.*`), so the ladder step is the only stable
address. `tecton-astryx` takes the only (or last) ladder on each side.

### 2.2 Problems a DTCG compiler will hit

1. **Value-plus-children nodes** (`shades.white`, `shades.black`). DTCG 2025.10 has no node that is both token and
   group. Normalise to either `shades.white.$root` (the DTCG group-root convention) or a sibling group
   (`shades.whiteTransparent`, which is what `tecton-astryx`'s `palette.generated.ts` does). Do **not** drop the
   21 descendants.
2. **Punctuation keys**:
   - `%` in all 168 MPL/Colorcet keys
   - spaces and parentheses in `460 (focus outline)`
   - underscores in Colorcet names
   - mixed case (`Plasma`, `MPL`, `Colorcet`, `hotPink`, `onDark`)

   DTCG allows these characters, but Style Dictionary transforms and CSS identifiers do not treat them uniformly.
3. **Parenthetical role annotation.** Strip it from the stop (`460`) but keep it as metadata
   (`role: "focus outline"`). It is the only semantic hint in the file.
4. **Ambiguous hexes.** Some hexes appear on several paths: `#f7f6f8` = mauve/graphite/violet 1570;
   `#fbbc3b` = `yellow.1000` and `yellow.core.100`; `#b0d54e` = `lime.1000` and `lime.core.100`. Semantic bindings
   must therefore reference **paths, not hexes**, which is what the JSON map does.

### 2.3 Recommended normalisation to CSS custom-property names

This rule is deterministic, and I have verified it has no collisions on all 1,820 tokens: 1,820 unique names, 0
collisions, 0 case-fold collisions. The longest name is 56 characters.

```
name = "--tecton-palette-" + join("-", map(segments after "foundational.color", norm))
norm(seg):
  1. strip a trailing "(…)" parenthetical → record it as metadata alias   ("460 (focus outline)" → "460", alias "focus outline")
  2. "%" → "pct"                                                        ("viridis-0%" → "viridis-0pct")
  3. camelCase boundary → "-"                                           ("hotPink" → "hot-pink", "onDark" → "on-dark", "appColors" → "app-colors")
  4. lowercase; any run of [^a-z0-9] → "-"; trim "-"                    ("rainbow_bgyrm_35_85_c71" → "rainbow-bgyrm-35-85-c71")
value+children nodes: the node's own value is emitted at its own name, children append segments:
  shades.white → --tecton-palette-shades-white ; shades.white.transparent.5 → --tecton-palette-shades-white-transparent-5
```

Examples:

- `violet.onLight.transparent.370.25` → `--tecton-palette-violet-on-light-transparent-370-25`
- `gray.onDark.contrasts.1570` → `--tecton-palette-gray-on-dark-contrasts-1570`
- `hotPink.onDark.460 (focus outline)` → `--tecton-palette-hot-pink-on-dark-460`

Recommendations for the build:

- **Mode stays explicit in the primitive name.** Primitives are immutable. Only the semantic layer chooses a
  mode, with `light-dark()`.
- The dash-joined names are **not reversible** (segments can contain dashes), so the build must emit a
  `name → sourcePath → value → $extensions` manifest and fail on any collision. That includes collisions against
  semantic names: `--tecton-palette-*` must never overlap `--tecton-color-*`, which the Tecton export already uses
  for semantic roles, or Astryx's `--color-*`.
- **Public exposure.** Do not put 1,820 primitives on `:root`. Emit semantic tokens with literal
  `light-dark(<hex>, <hex>)` values, and carry each source path in the manifest and a CSS comment. The primitive
  CSS can be an optional, separately imported file for app authors. This follows plan §6: "decide public token
  exposure separately from source preservation".
- Keep MPL/Colorcet/`custom.appColors` in the manifest (possible continuous-scale sources for charts; §3.8), but
  out of the default CSS.

---

## 3. Semantic colour mapping

### 3.1 How to read

- **Light / Dark**: the palette path and the resolved hex. Translucent values are *not* pre-composited. Contrast
  (§9) is measured after compositing on the real background.
- **Source**:
  - `tecton-astryx (role x)`: the value `tecton-astryx` binds, through that `semantic.ts` role.
  - `proposed`: no Tecton decision exists, and the rationale is given.
  - `upstream-default`: kept unchanged, on purpose.
- **Verdict**: *wash* marks an alpha step used where Astryx composites a tint. *approximated* means Tecton has no
  role for it and `tecton-astryx` chose the closest one.
- Dark values are transcribed from the Tecton design. Light values are **derived** by
  `tecton-astryx`'s rule (same family, same stop, `onLight` ramp; `gray.onDark.contrasts.N ↔ gray.onLight.N`).
  Where the Tecton export's light block differs, the row says so (full list in §3.4).

### 3.2 Core, surface, text, icon, status, border, effects

| Upstream token | Light (palette path, hex) | Dark (palette path, hex) | Source | Notes |
|---|---|---|---|---|
| `--color-accent` | `violet.onLight.220` `#b89dc8` | `violet.onDark.220` `#5d4d68` | tecton-astryx (role `action.primary.background`) | Primary action fill (violet 220). A FILL, not ink: 2.2:1 on body - never use as text/icon/focus colour (theme-audit §15). Export light differs: `#644a78`. |
| `--color-accent-muted` | `violet.onLight.transparent.370.25` `#976dac40` | `violet.onDark.transparent.370.25` `#80708b40` | tecton-astryx | *wash.* 25% violet wash; selection/hover tint derived from accent. |
| `--color-on-accent` | `lilac.onLight.1300` `#35214b` | `lilac.onDark.1300` `#e5e0eb` | tecton-astryx (role `action.primary.text`) |  Export light differs: `#f7f3f8`. |
| `--color-neutral` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | tecton-astryx (role `action.secondary.background`) | Secondary action fill, also the system neutral. Export light differs: `#e4dde7`. |
| `--color-background-body` | `gray.onLight.100` `#f6f4f7` | `gray.onDark.contrasts.100` `#1d1c1f` | tecton-astryx (role `surface.backgroundDefault`) |  |
| `--color-background-surface` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` | tecton-astryx (role `surface.backgroundElevated`) | Tecton elevation runs DARK in dark mode: a panel is darker than the page. In light mode the derived value is lighter than body (light-mode.md weak point 3). |
| `--color-background-card` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` | tecton-astryx (role `surface.backgroundElevated`) |  |
| `--color-background-popover` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` | tecton-astryx (role `surface.backgroundElevated`) |  |
| `--color-background-muted` | `graphite.onLight.110` `#ebe9ee` | `graphite.onDark.110` `#28232c` | tecton-astryx (role `component.input.filled.background`) | *approximated.* Borrowed from the filled-input background (no Tecton "muted surface" role). Also used as code-block/kbd/syntax background and table stripe fallback. Export light differs: `#f0eef3`. |
| `--color-background-inverted` | `gray.onLight.1570` `#1e1825` | `gray.onDark.contrasts.1570` `#f6f5f8` | tecton-astryx (role `text.primary`) | Tooltip/inverted surface = primary ink. Export light differs: `#21172a`. |
| `--color-background-error-inverted` | `red.onLight.830` `#8b1f0b` | `red.onDark.830` `#e3a6a6` | tecton-astryx (role `status.error.bright`) |  Export light differs: `#ed371d`. |
| `--color-overlay` | `shades.black.transparent.50` `#00000080` | `shades.black.transparent.50` `#00000080` | tecton-astryx | *approximated.* Modal scrim, black 50% in both modes (heavy in light mode; light-mode.md weak point 6). |
| `--color-overlay-hover` | `shades.black.transparent.5` `#0000000d` | `shades.white.transparent.5` `#ffffff0d` | tecton-astryx | *approximated.* No Tecton source. Ink wash (black in light, white in dark) at 5%; was 10% until theme-audit §16 (icon-secondary on a 20% pressed row fell to 2.44:1). light-mode.md still quotes the old 10/20 - code is authoritative. |
| `--color-overlay-pressed` | `shades.black.transparent.10` `#0000001a` | `shades.white.transparent.10` `#ffffff1a` | tecton-astryx | *approximated.* As overlay-hover, 10%. |
| `--color-text-primary` | `gray.onLight.1570` `#1e1825` | `gray.onDark.contrasts.1570` `#f6f5f8` | tecton-astryx (role `text.primary`) |  Export light differs: `#21172a`. |
| `--color-text-secondary` | `graphite.onLight.680` `#604e6e` | `graphite.onDark.680` `#a7a2ac` | tecton-astryx (role `text.secondary`) |  |
| `--color-text-disabled` | `gray.onLight.220` `#ada3b2` | `gray.onDark.contrasts.220` `#545356` | tecton-astryx (role `text.disabled`) | Fails 4.5:1 by design (WCAG 1.4.3 exempts inactive controls). |
| `--color-text-accent` | `lilac.onLight.830` `#5c3878` | `lilac.onDark.830` `#beb1c8` | tecton-astryx (role `action.primary.adornment`) | Tecton links carry no colour; this is the lilac adornment ink. Link default colour is re-pointed to text-primary at component level. Export light differs: `#dbcae1`. |
| `--color-on-dark` | `gray.onDark.contrasts.1570` `#f6f5f8` | `gray.onDark.contrasts.1570` `#f6f5f8` | tecton-astryx | Fixed: dark side of Text primary in both modes. |
| `--color-on-light` | `gray.onDark.contrasts.50` `#131214` | `gray.onDark.contrasts.50` `#131214` | tecton-astryx | Fixed: dark side of Text inverse (#131214) in both modes. |
| `--color-icon-primary` | `gray.onLight.1570` `#1e1825` | `gray.onDark.contrasts.1570` `#f6f5f8` | tecton-astryx (role `text.primary`) |  Export light differs: `#21172a`. |
| `--color-icon-secondary` | `graphite.onLight.460` `#7b668b` | `graphite.onDark.460` `#89848e` | tecton-astryx (role `text.subtlest`) | Icons draw one step dimmer than adjacent text. Re-pointed to the label ink inside hovered/pressed buttons and on table headers (contrast fixes). |
| `--color-icon-disabled` | `gray.onLight.160` `#c7c1cc` | `gray.onDark.contrasts.160` `#403f42` | tecton-astryx (role `action.disabled.filledAdornment`) |  Export light differs: `#d3ced6`. |
| `--color-icon-accent` | `lilac.onLight.830` `#5c3878` | `lilac.onDark.830` `#beb1c8` | tecton-astryx (role `action.primary.adornment`) |  Export light differs: `#dbcae1`. |
| `--color-success` | `green.onLight.560` `#0c703e` | `green.onDark.560` `#4fa66f` | tecton-astryx (role `status.success.filledBackground`) | Filled severity colour - a fill; ChatToolCalls re-points to text-green when used as ink. |
| `--color-success-muted` | `green.onLight.transparent.310.25` `#10a05540` | `green.onDark.transparent.680.25` `#61b67f40` | tecton-astryx | *wash.* WASH (25% alpha), not Tecton "success Muted" (a solid, kept as --tecton-color-success-muted). |
| `--color-on-success` | `green.onLight.50` `#f3fef8` | `green.onDark.50` `#001607` | tecton-astryx (role `status.success.filledText`) |  |
| `--color-error` | `red.onLight.460` `#d22f11` | `red.onDark.460` `#c16e6c` | tecton-astryx (role `status.error.filledBackground`) |  Export light differs: `#a3240d`. |
| `--color-error-muted` | `red.onLight.transparent.370.25` `#ed371d40` | `red.onDark.transparent.370.25` `#b25d5940` | tecton-astryx | *wash.* Wash; solid Muted lives on --tecton-color-error-muted. |
| `--color-on-error` | `red.onLight.50` `#fffaf9` | `red.onDark.50` `#2e0000` | tecton-astryx (role `status.error.filledText`) |  |
| `--color-warning` | `yellow.onLight.680` `#7a4a00` | `yellow.onDark.680` `#e59306` | tecton-astryx (role `status.warning.filledBackground`) |  Export light differs: `#ffdd89`. |
| `--color-warning-muted` | `yellow.onLight.transparent.160.25` `#ffb61f40` | `yellow.onDark.transparent.1000.25` `#fbbc3b40` | tecton-astryx | *wash.* Wash; solid Muted lives on --tecton-color-warning-muted. |
| `--color-on-warning` | `yellow.onLight.50` `#fffbf1` | `yellow.onDark.50` `#1d0f01` | tecton-astryx (role `status.warning.filledText`) |  Export light differs: `#693f01`. |
| `--color-border` | `graphite.onLight.120` `#e4dde7` | `graphite.onDark.120` `#342f39` | tecton-astryx (role `surface.dividerSubtle`) | Divider subtle - the default Astryx border maps to Tecton's LOW emphasis rule. |
| `--color-border-emphasized` | `graphite.onLight.220` `#b2a1bb` | `graphite.onDark.220` `#57515c` | tecton-astryx (role `surface.dividerMedium`) | Divider medium. 2.2:1 on body - fails 1.4.11 (inherited from the design, pinned by test). Use divider-strong where a boundary must be perceived. |
| `--color-skeleton` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | tecton-astryx (role `action.secondary.background`) | *approximated.*  Export light differs: `#e4dde7`. |
| `--color-track` | `graphite.onLight.310` `#9884a4` | `graphite.onDark.310` `#6e6873` | tecton-astryx (role `component.progress.track`) | Progress/slider channel at divider-strong weight. |
| `--color-shadow` | `shades.black.transparent.15` `#00000026` | `shades.black.transparent.50` `#00000080` | tecton-astryx | *approximated.* Black 15% light / 50% dark. |
| `--color-tint-hover` | `shades.black` `#000000` | `shades.white` `#ffffff` | tecton-astryx | Mixed into surfaces with color-mix() by components for hover. |
| `--focus-outline-color` | `hotPink.onLight.460 (focus outline)` `#ff00aa` | `hotPink.onDark.460 (focus outline)` `#ff52a8` | tecton-astryx (role `action.focusRing`) | The only role named in the raw token file ("460 (focus outline)"). Every control but Tab draws it. Re-pointed to the on-colour ink inside Banner severity fills (1.0-2.5:1 there). Light #ff00aa is 3.29:1 on body but 2.48:1 on inverted/near-white surfaces (Toast, light media scrim) - recorded deviation, no second focus hue exists. |

**Focus, selection, hover/pressed, disabled — how they fit together**

- **Focus**: `--focus-outline-color` = `hotPink.460` (`#ff00aa` light, `#ff52a8` dark), 2px, solid, offset 2px.
  Buttons use a 1px offset via `--button-focus-offset`. Fields draw focus as border + 1px inset in the same colour
  (`border-color` + `box-shadow: inset 0 0 0 1px`), on all 16 field targets. Inside a `Banner` severity fill the
  colour is re-pointed to the banner's on-colour ink. The design gives Tab a dark-box focus; `tecton-astryx` did
  **not** reproduce that, and uses the ring.
- **Selection**: `--shadow-inset-selected` is a violet 50 % inset (never pink, so it cannot be mistaken for focus).
  Selected rows use `--tecton-color-table-row-selected` (graphite 190). Checkbox, radio and slider thumb select with
  a *bright chip* (`mauve.1300`), not the accent. The switch is the only violet selection control.
- **Hover/pressed**:
  - Buttons use explicit Tecton fills per state and set `--color-overlay-hover/pressed: transparent`, so the two do
    not stack.
  - Rows, list items and menu items keep the component's own hover mechanism, but `--color-overlay-hover` is
    re-pointed to the Tecton row fill (`graphite 140`).
  - Everywhere else uses the global 5 %/10 % ink washes.
- **Disabled**:
  - Filled controls use a *recessed* wash, not an opacity drop: black 40 % (dark) and black 10 % (light, a
    `tecton-astryx` exception).
  - Outlined controls use a transparent fill with a `gray 130` border and `gray 190` ink.

### 3.3 Hue families (badge/token tints, tag colours)

Tecton has 7 accents and Astryx has 10 hue slots:

- `cyan` **and** `teal` → azure
- `orange` → saffron
- `yellow` → lemon
- `gray` → graphite
- `purple` → lilac

The accent fill is ramp 560 (680 for blue), the text is 1000, and the background is the family's 25 % ladder step.

| Upstream token | Light (palette path, hex) | Dark (palette path, hex) | Source | Notes |
|---|---|---|---|---|
| `--color-background-blue` | `blue.onLight.transparent.370.25` `#507bd340` | `blue.onDark.transparent.370.25` `#4874cb40` | tecton-astryx | *wash.* blue 25% wash.  |
| `--color-border-blue` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | tecton-astryx | blue accent fill (680). |
| `--color-icon-blue` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | tecton-astryx | blue accent fill (680). |
| `--color-text-blue` | `blue.onLight.1000` `#1c3a75` | `blue.onDark.1000` `#b7c9eb` | tecton-astryx | blue accent text (1000). |
| `--color-background-cyan` | `azure.onLight.transparent.190.25` `#31c4c440` | `azure.onDark.transparent.830.25` `#32c9c940` | tecton-astryx | *wash.* azure 25% wash. cyan and teal both take azure (Tecton has no separate teal). |
| `--color-border-cyan` | `azure.onLight.560` `#1b6b6b` | `azure.onDark.560` `#29a6a6` | tecton-astryx | azure accent fill (560). |
| `--color-icon-cyan` | `azure.onLight.560` `#1b6b6b` | `azure.onDark.560` `#29a6a6` | tecton-astryx | azure accent fill (560). |
| `--color-text-cyan` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | tecton-astryx | azure accent text (1000). |
| `--color-background-teal` | `azure.onLight.transparent.190.25` `#31c4c440` | `azure.onDark.transparent.830.25` `#32c9c940` | tecton-astryx | *wash.* azure 25% wash. Duplicate of cyan (azure). |
| `--color-border-teal` | `azure.onLight.560` `#1b6b6b` | `azure.onDark.560` `#29a6a6` | tecton-astryx | azure accent fill (560). |
| `--color-icon-teal` | `azure.onLight.560` `#1b6b6b` | `azure.onDark.560` `#29a6a6` | tecton-astryx | azure accent fill (560). |
| `--color-text-teal` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | tecton-astryx | azure accent text (1000). |
| `--color-background-gray` | `graphite.onLight.transparent.370.25` `#8c769a40` | `graphite.onDark.transparent.370.25` `#7a747f40` | tecton-astryx | *wash.* graphite 25% wash. graphite |
| `--color-border-gray` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | tecton-astryx | graphite accent fill (560). |
| `--color-icon-gray` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | tecton-astryx | graphite accent fill (560). |
| `--color-text-gray` | `graphite.onLight.1000` `#433751` | `graphite.onDark.1000` `#cac6ce` | tecton-astryx | graphite accent text (1000). |
| `--color-background-green` | `green.onLight.transparent.310.25` `#10a05540` | `green.onDark.transparent.680.25` `#61b67f40` | tecton-astryx | *wash.* green 25% wash.  |
| `--color-border-green` | `green.onLight.560` `#0c703e` | `green.onDark.560` `#4fa66f` | tecton-astryx | green accent fill (560). |
| `--color-icon-green` | `green.onLight.560` `#0c703e` | `green.onDark.560` `#4fa66f` | tecton-astryx | green accent fill (560). |
| `--color-text-green` | `green.onLight.1000` `#07452a` | `green.onDark.1000` `#92d6a8` | tecton-astryx | green accent text (1000). |
| `--color-background-orange` | `saffron.onLight.transparent.190.25` `#e1a57940` | `saffron.onDark.transparent.830.25` `#dcac8940` | tecton-astryx | *wash.* saffron 25% wash. saffron |
| `--color-border-orange` | `saffron.onLight.560` `#914f20` | `saffron.onDark.560` `#cb8553` | tecton-astryx | saffron accent fill (560). |
| `--color-icon-orange` | `saffron.onLight.560` `#914f20` | `saffron.onDark.560` `#cb8553` | tecton-astryx | saffron accent fill (560). |
| `--color-text-orange` | `saffron.onLight.1000` `#593114` | `saffron.onDark.1000` `#e5c2a9` | tecton-astryx | saffron accent text (1000). |
| `--color-background-pink` | `pink.onLight.transparent.190.25` `#d5aaaa40` | `pink.onDark.transparent.830.25` `#d5aca440` | tecton-astryx | *wash.* pink 25% wash.  |
| `--color-border-pink` | `pink.onLight.560` `#994c4c` | `pink.onDark.560` `#c2867a` | tecton-astryx | pink accent fill (560). |
| `--color-icon-pink` | `pink.onLight.560` `#994c4c` | `pink.onDark.560` `#c2867a` | tecton-astryx | pink accent fill (560). |
| `--color-text-pink` | `pink.onLight.1000` `#5c2e2e` | `pink.onDark.1000` `#e1c3bd` | tecton-astryx | pink accent text (1000). |
| `--color-background-purple` | `lilac.onLight.transparent.370.25` `#9d6ab540` | `lilac.onDark.transparent.370.25` `#836e9140` | tecton-astryx | *wash.* lilac 25% wash. lilac - not on the Accents page; the ramp the primary action adornment comes from. |
| `--color-border-purple` | `lilac.onLight.560` `#7a4e9b` | `lilac.onDark.560` `#9f8ead` | tecton-astryx | lilac accent fill (560). |
| `--color-icon-purple` | `lilac.onLight.560` `#7a4e9b` | `lilac.onDark.560` `#9f8ead` | tecton-astryx | lilac accent fill (560). |
| `--color-text-purple` | `lilac.onLight.1000` `#4a3067` | `lilac.onDark.1000` `#cdc4d8` | tecton-astryx | lilac accent text (1000). |
| `--color-background-red` | `red.onLight.transparent.370.25` `#ed371d40` | `red.onDark.transparent.370.25` `#b25d5940` | tecton-astryx | *wash.* red 25% wash.  |
| `--color-border-red` | `red.onLight.560` `#ba2a0f` | `red.onDark.560` `#cc7f7d` | tecton-astryx | red accent fill (560). |
| `--color-icon-red` | `red.onLight.560` `#ba2a0f` | `red.onDark.560` `#cc7f7d` | tecton-astryx | red accent fill (560). |
| `--color-text-red` | `red.onLight.1000` `#751a0a` | `red.onDark.1000` `#ecbbbc` | tecton-astryx | red accent text (1000). |
| `--color-background-yellow` | `lemon.onLight.transparent.110.25` `#ffed2940` | `lemon.onDark.transparent.1440.25` `#fcf21e40` | tecton-astryx | *wash.* lemon 25% wash. lemon (not the amber "yellow" status family). |
| `--color-border-yellow` | `lemon.onLight.560` `#735e01` | `lemon.onDark.560` `#9e9813` | tecton-astryx | lemon accent fill (560). |
| `--color-icon-yellow` | `lemon.onLight.560` `#735e01` | `lemon.onDark.560` `#9e9813` | tecton-astryx | lemon accent fill (560). |
| `--color-text-yellow` | `lemon.onLight.1000` `#473a01` | `lemon.onDark.1000` `#d6ce1a` | tecton-astryx | lemon accent text (1000). |

### 3.4 Light mode: derived (tecton-astryx) vs designed (Tecton export) — decision needed

`tecton-astryx/docs/design/light-mode.md` says "there is no light artefact anywhere" and derives every light value.
But `tecton-webcomponents/packages/wc/tokens/tecton-tokens.css` is a Tecton-generated export with both `:root`
(light) and `.dark` blocks. I mapped 161 `semantic.ts` roles to its variables by name
(`EXPORT_VAR` in the build script; recorded as `exportAlt` in the JSON):

- **Dark: 158 / 161 identical.** This confirms the export and the `tecton-astryx` transcription describe the same
  system. The 3 differences are the truncated `input / outlined / states / hover-…` rows, where `tecton-astryx`
  guessed:
  - The export gives `states-hover-border #a7a2ac`, `states-press-border #b8b4bc` and
    `states-hover-contrast-text #cac5d2`.
  - `tecton-astryx` has `hoverBorder #cac5d2`, `pressBorder #e3e0e8` and `hoverContrastText #a7a2ac`, i.e. hover
    border and hover ink swapped.
  - **Recommend the export values for dark.**
- **Light: 114 / 161 differ.** The export's light mode is a *designed* inversion, not a stop-mirror:
  - The primary button is dark violet `#644a78` (`mauve.onLight.680`) with near-white ink, where `tecton-astryx`
    has a pale `#b89dc8` with dark ink.
  - The warning fill is pale `#ffdd89` with dark ink.
  - The top-nav band turns white with black 50 % text. This fixes the 51 top-nav contrast failures
    `theme-audit.md` recorded in light mode.
  - The disabled fill is `#ffffff33` (white 20 %) instead of a black wash.
  - The table header is lighter.
  - Every export light value resolves to a real palette path; none are free hexes.

Token-level differences (all 161 role rows are in Appendix A and the JSON):

| Token | Role | tecton-astryx light (derived) | Tecton export light |
|---|---|---|---|
| `--color-accent` | `action.primary.background` | `#b89dc8` (`violet.onLight.220`) | `#644a78` (`mauve.onLight.680`) |
| `--color-on-accent` | `action.primary.text` | `#35214b` (`lilac.onLight.1300`) | `#f7f3f8` (`violet.onLight.100`) |
| `--color-neutral` | `action.secondary.background` | `#d5cddb` (`graphite.onLight.140`) | `#e4dde7` (`graphite.onLight.120`) |
| `--color-background-muted` | `component.input.filled.background` | `#ebe9ee` (`graphite.onLight.110`) | `#f0eef3` (`graphite.onLight.105`) |
| `--color-background-inverted` | `text.primary` | `#1e1825` (`gray.onLight.1570`) | `#21172a` (`graphite.onLight.1570`) |
| `--color-background-error-inverted` | `status.error.bright` | `#8b1f0b` (`red.onLight.830`) | `#ed371d` (`red.onLight.370`) |
| `--color-text-primary` | `text.primary` | `#1e1825` (`gray.onLight.1570`) | `#21172a` (`graphite.onLight.1570`) |
| `--color-text-accent` | `action.primary.adornment` | `#5c3878` (`lilac.onLight.830`) | `#dbcae1` (`violet.onLight.140`) |
| `--color-icon-primary` | `text.primary` | `#1e1825` (`gray.onLight.1570`) | `#21172a` (`graphite.onLight.1570`) |
| `--color-icon-disabled` | `action.disabled.filledAdornment` | `#c7c1cc` (`gray.onLight.160`) | `#d3ced6` (`gray.onLight.140`) |
| `--color-icon-accent` | `action.primary.adornment` | `#5c3878` (`lilac.onLight.830`) | `#dbcae1` (`violet.onLight.140`) |
| `--color-error` | `status.error.filledBackground` | `#d22f11` (`red.onLight.460`) | `#a3240d` (`red.onLight.680`) |
| `--color-warning` | `status.warning.filledBackground` | `#7a4a00` (`yellow.onLight.680`) | `#ffdd89` (`yellow.onLight.120`) |
| `--color-on-warning` | `status.warning.filledText` | `#fffbf1` (`yellow.onLight.50`) | `#693f01` (`yellow.onLight.830`) |
| `--color-skeleton` | `action.secondary.background` | `#d5cddb` (`graphite.onLight.140`) | `#e4dde7` (`graphite.onLight.120`) |
| `--tecton-color-success-muted` | `status.success.muted` | `#10a055` (`green.onLight.310`) | `#b8f8d5` (`green.onLight.110`) |
| `--tecton-color-warning-muted` | `status.warning.muted` | `#c07d00` (`yellow.onLight.310`) | `#ffdd89` (`yellow.onLight.120`) |
| `--tecton-color-info` | `status.info.main` | `#2850a1` (`blue.onLight.680`) | `#2f5dba` (`blue.onLight.560`) |
| `--tecton-color-info-bright` | `status.info.bright` | `#1c3a75` (`blue.onLight.1000`) | `#89a6e1` (`blue.onLight.220`) |
| `--tecton-color-info-muted` | `status.info.muted` | `#638ad9` (`blue.onLight.310`) | `#cbd9f1` (`blue.onLight.130`) |
| `--tecton-color-info-filled` | `status.info.filledBackground` | `#3a6acb` (`blue.onLight.460`) | `#2f5dba` (`blue.onLight.560`) |
| `--tecton-color-info-adornment` | `status.info.filledAdornment` | `#bed0ee` (`blue.onLight.140`) | `#f7f7fa` (`blue.onLight.50`) |
| `--tecton-color-on-status-neutral` | `status.neutral.filledText` | `#3a3343` (`gray.onLight.1000`) | `#4e4556` (`gray.onLight.830`) |
| `--tecton-color-text-lime` | `accent.lime.text` | `#33400e` (`lime.onLight.1000`) | `#3e4d11` (`lime.onLight.830`) |
| `--tecton-color-top-nav-background` | `component.topNav.solidBackground` | `#000000` (`shades.black`) | `#ffffff` (`shades.white`) |
| `--tecton-color-top-nav-text` | `component.topNav.contrastText` | `#ffffff80` (`shades.white.transparent.50`) | `#00000080` (`shades.black.transparent.50`) |
| `--tecton-color-table-header` | `component.table.headerBackground` | `#cbc0d1` (`graphite.onLight.160`) | `#d5cddb` (`graphite.onLight.140`) |
| `--tecton-color-table-stripe` | `component.table.cellBackgroundAlt` | `#dbd6dd` (`gray.onLight.130`) | `#f6f4f7` (`gray.onLight.100`) |
| `--tecton-color-table-row-hover` | `component.table.cellHoverBackground` | `#d5cddb` (`graphite.onLight.140`) | `#ebe9ee` (`graphite.onLight.110`) |
| `--tecton-color-table-row-selected` | `component.table.cellActiveBackground` | `#bcafc4` (`graphite.onLight.190`) | `#e4dde7` (`graphite.onLight.120`) |
| `--tecton-color-input-filled-background` | `component.input.filled.background` | `#ebe9ee` (`graphite.onLight.110`) | `#f0eef3` (`graphite.onLight.105`) |
| `--tecton-color-input-filled-hover` | `component.input.filled.hoverBackground` | `#e4dde7` (`graphite.onLight.120`) | `#f6f3f8` (`graphite.onLight.100`) |
| `--tecton-color-input-border` | `component.input.outlined.border` | `#b2a1bb` (`graphite.onLight.220`) | `#9884a4` (`graphite.onLight.310`) |
| `--tecton-color-input-border-hover` | `component.input.outlined.hoverBorder` | `#463458` (`mauve.onLight.1000`) | `#6d5a7d` (`graphite.onLight.560`) (dark also differs: export `#a7a2ac`) |
| `--tecton-color-input-text-only-rule` | `component.input.textOnly.contrastText` | `#6d5a7d` (`graphite.onLight.560`) | `#604e6e` (`graphite.onLight.680`) |
| `--tecton-color-action-tertiary-text` | `action.tertiary.text` | `#563f67` (`mauve.onLight.830`) | `#725687` (`mauve.onLight.560`) |

**Consequences if the export is adopted for light.** `--color-text-accent` and `--color-icon-accent` are bound to
`action.primary.adornment`. In the export that is the *on-primary* adornment (`#dbcae1`), which is 1.42:1 as ink on
the light page. In both modes those two tokens should instead bind to an ink role; keep `lilac.onLight.830`
(`#5c3878`, 8.4:1) as a proposed override. `--color-background-error-inverted` becomes `red.onLight.370`. All
`bannerStatus`/badge fills change weight.

**Recommendation:** adopt export light values wherever the export defines the role, keep the `tecton-astryx`
derivation only for roles the export lacks (washes, shades, component-story roles such as tab, checkbox and switch),
and re-run the §9 contrast checks. The JSON keeps both (`light` = `tecton-astryx`, `exportAlt.light` = export), so
the build can switch with one flag.

### 3.5 Theme-local tokens (Tecton roles Astryx has no name for)

These 34 are `tecton-astryx`'s `--tecton-color-*` custom properties. Component overrides read them. Keep the names,
since the port's components need the same roles.

| Theme-local token | Tecton role | Light | Dark | Export light (if different) |
|---|---|---|---|---|
| `--tecton-color-text-placeholder` | `text.placeholder` | `gray.onLight.310` `#92879a` | `gray.onDark.contrasts.310` `#6a696c` |  |
| `--tecton-color-divider-strong` | `surface.dividerStrong` | `graphite.onLight.310` `#9884a4` | `graphite.onDark.310` `#6e6873` |  |
| `--tecton-color-success-muted` | `status.success.muted` | `green.onLight.310` `#10a055` | `green.onDark.310` `#217846` | `#b8f8d5` (`green.onLight.110`) |
| `--tecton-color-warning-muted` | `status.warning.muted` | `yellow.onLight.310` `#c07d00` | `yellow.onDark.310` `#995b04` | `#ffdd89` (`yellow.onLight.120`) |
| `--tecton-color-error-muted` | `status.error.muted` | `red.onLight.190` `#f69c8f` | `red.onDark.190` `#832d28` |  |
| `--tecton-color-info` | `status.info.main` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | `#2f5dba` (`blue.onLight.560`) |
| `--tecton-color-info-bright` | `status.info.bright` | `blue.onLight.1000` `#1c3a75` | `blue.onDark.1000` `#b7c9eb` | `#89a6e1` (`blue.onLight.220`) |
| `--tecton-color-info-muted` | `status.info.muted` | `blue.onLight.310` `#638ad9` | `blue.onDark.310` `#3766c4` | `#cbd9f1` (`blue.onLight.130`) |
| `--tecton-color-info-filled` | `status.info.filledBackground` | `blue.onLight.460` `#3a6acb` | `blue.onDark.460` `#6086d2` | `#2f5dba` (`blue.onLight.560`) |
| `--tecton-color-on-info` | `status.info.filledText` | `blue.onLight.50` `#f7f7fa` | `blue.onDark.50` `#0a1324` |  |
| `--tecton-color-info-adornment` | `status.info.filledAdornment` | `blue.onLight.140` `#bed0ee` | `blue.onDark.140` `#1d3566` | `#f7f7fa` (`blue.onLight.50`) |
| `--tecton-color-status-neutral` | `status.neutral.main` | `gray.onLight.560` `#685d72` | `gray.onDark.contrasts.560` `#959497` |  |
| `--tecton-color-status-neutral-filled` | `status.neutral.filledBackground` | `gray.onLight.120` `#e1dee4` | `gray.onDark.contrasts.120` `#2c2b2e` |  |
| `--tecton-color-on-status-neutral` | `status.neutral.filledText` | `gray.onLight.1000` `#3a3343` | `gray.onDark.contrasts.1000` `#c8c7ca` | `#4e4556` (`gray.onLight.830`) |
| `--tecton-color-accent-lime` | `accent.lime.fill` | `lime.onLight.560` `#546918` | `lime.onDark.560` `#84a138` |  |
| `--tecton-color-text-lime` | `accent.lime.text` | `lime.onLight.1000` `#33400e` | `lime.onDark.1000` `#b0d54e` | `#3e4d11` (`lime.onLight.830`) |
| `--tecton-color-top-nav-background` | `component.topNav.solidBackground` | `shades.black` `#000000` | `shades.black` `#000000` | `#ffffff` (`shades.white`) |
| `--tecton-color-top-nav-text` | `component.topNav.contrastText` | `shades.white.transparent.50` `#ffffff80` | `shades.white.transparent.50` `#ffffff80` | `#00000080` (`shades.black.transparent.50`) |
| `--tecton-color-top-nav-adornment` | `component.topNav.adornment` | `lilac.onLight.460` `#8b5ba9` | `lilac.onDark.460` `#90809e` |  |
| `--tecton-color-table-header` | `component.table.headerBackground` | `graphite.onLight.160` `#cbc0d1` | `graphite.onDark.160` `#433d47` | `#d5cddb` (`graphite.onLight.140`) |
| `--tecton-color-table-footer` | `component.table.footer` | `graphite.onLight.110` `#ebe9ee` | `graphite.onDark.110` `#28232c` |  |
| `--tecton-color-table-stripe` | `component.table.cellBackgroundAlt` | `gray.onLight.130` `#dbd6dd` | `gray.onDark.contrasts.130` `#323134` | `#f6f4f7` (`gray.onLight.100`) |
| `--tecton-color-table-row-hover` | `component.table.cellHoverBackground` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | `#ebe9ee` (`graphite.onLight.110`) |
| `--tecton-color-table-row-selected` | `component.table.cellActiveBackground` | `graphite.onLight.190` `#bcafc4` | `graphite.onDark.190` `#4e4853` | `#e4dde7` (`graphite.onLight.120`) |
| `--tecton-color-input-filled-background` | `component.input.filled.background` | `graphite.onLight.110` `#ebe9ee` | `graphite.onDark.110` `#28232c` | `#f0eef3` (`graphite.onLight.105`) |
| `--tecton-color-input-filled-hover` | `component.input.filled.hoverBackground` | `graphite.onLight.120` `#e4dde7` | `graphite.onDark.120` `#342f39` | `#f6f3f8` (`graphite.onLight.100`) |
| `--tecton-color-input-border` | `component.input.outlined.border` | `graphite.onLight.220` `#b2a1bb` | `graphite.onDark.220` `#57515c` | `#9884a4` (`graphite.onLight.310`) |
| `--tecton-color-input-border-hover` | `component.input.outlined.hoverBorder` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | `#6d5a7d` (`graphite.onLight.560`) **dark differs: `#a7a2ac`** |
| `--tecton-color-input-value` | `component.input.outlined.valueText` | `graphite.onLight.1570` `#21172a` | `graphite.onDark.1570` `#f7f6f8` |  |
| `--tecton-color-input-placeholder` | `component.input.outlined.placeholderText` | `graphite.onLight.460` `#7b668b` | `graphite.onDark.460` `#89848e` |  |
| `--tecton-color-input-text-only-rule` | `component.input.textOnly.contrastText` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | `#604e6e` (`graphite.onLight.680`) |
| `--tecton-color-action-outlined-border` | `action.outlined.text` | `mauve.onLight.680` `#644a78` | `mauve.onDark.680` `#aaa1b2` |  |
| `--tecton-color-action-text-only` | `action.textOnly.text` | `mauve.onLight.560` `#725687` | `mauve.onDark.560` `#9a91a2` |  |
| `--tecton-color-action-tertiary-text` | `action.tertiary.text` | `mauve.onLight.830` `#563f67` | `mauve.onDark.830` `#bab3c0` | `#725687` (`mauve.onLight.560`) |

### 3.6 Shadows / elevation

Tecton is flat: panels are separated by a 1px rule and by getting *darker*. Only FAB has a shadow in the design.
`tecton-astryx` keeps soft single-layer drops so that components with an elevation prop still render sensibly.

| Token | Upstream default | Tecton value (light-dark) | Palette paths (light / dark) | Notes |
|---|---|---|---|---|
| `--shadow-low` | `0px 1px 1px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.2)), 0px 2px 8px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.2))` | `0px 1px 2px light-dark(#0000001a, #00000066)` | `shades.black.transparent.10` / `shades.black.transparent.40` | Tecton is flat - panels use a 1px rule, not a shadow. Soft single-layer drops kept so elevation props do not break. |
| `--shadow-med` | `0px 1px 2px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.2)), 0px 2px 12px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.2))` | `0px 2px 6px light-dark(#00000026, #00000080)` | `shades.black.transparent.15` / `shades.black.transparent.50` |  |
| `--shadow-high` | `0px 2px 2px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.2)), 0px 8px 24px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.3))` | `0px 8px 24px light-dark(#00000033, #00000099)` | `shades.black.transparent.20` / `shades.black.transparent.60` | Only FAB has a shadow in the design; FAB reads flatter than designed. |
| `--shadow-inset-hover` | `inset 0px 0px 0px 2px light-dark(rgba(5, 54, 89, 0.15), rgba(223, 226, 229, 0.2))` | `inset 0px 0px 0px 2px light-dark(#9272a440, #7d728440)` | `mauve.onLight.transparent.370.25` / `mauve.onDark.transparent.370.25` |  |
| `--shadow-inset-selected` | `inset 0px 0px 0px 2px rgba(1, 113, 227, 0.5)` | `inset 0px 0px 0px 2px light-dark(#976dac80, #80708b80)` | `violet.onLight.transparent.370.50` / `violet.onDark.transparent.370.50` | Selection is violet 50%, deliberately NOT the focus pink (theme-audit §9). |
| `--shadow-inset-success` | `inset 0px 0px 0px 2px rgba(38, 167, 86, 0.3)` | `inset 0px 0px 0px 2px light-dark(#10a0554d, #61b67f4d)` | `green.onLight.transparent.310.30` / `green.onDark.transparent.680.30` |  |
| `--shadow-inset-warning` | `inset 0px 0px 0px 2px rgba(226, 164, 0, 0.3)` | `inset 0px 0px 0px 2px light-dark(#ffb61f4d, #fbbc3b4d)` | `yellow.onLight.transparent.160.30` / `yellow.onDark.transparent.1000.30` |  |
| `--shadow-inset-error` | `inset 0px 0px 0px 2px rgba(227, 25, 59, 0.3)` | `inset 0px 0px 0px 2px light-dark(#ed371d4d, #b25d594d)` | `red.onLight.transparent.370.30` / `red.onDark.transparent.370.30` |  |

### 3.7 Syntax highlighting

`tecton-astryx` sets no syntax tokens. Upstream's 14 syntax defaults are `var()` references onto hue/text tokens that
Tecton *does* set, so they inherit Tecton values. `--color-syntax-background` → `--color-background-muted`. All
reach ≥ 6.1:1 in both modes (§9). Because cyan = teal = azure, operator, property and attribute share one colour,
which is acceptable but less distinctive than upstream.

| Upstream token | Light (palette path, hex) | Dark (palette path, hex) | Source | Notes |
|---|---|---|---|---|
| `--color-syntax-keyword` | `lilac.onLight.830` `#5c3878` | `lilac.onDark.830` `#beb1c8` | tecton-astryx → `--color-text-accent` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-string` | `green.onLight.1000` `#07452a` | `green.onDark.1000` `#92d6a8` | tecton-astryx → `--color-text-green` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-comment` | `graphite.onLight.680` `#604e6e` | `graphite.onDark.680` `#a7a2ac` | tecton-astryx → `--color-text-secondary` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-number` | `saffron.onLight.1000` `#593114` | `saffron.onDark.1000` `#e5c2a9` | tecton-astryx → `--color-text-orange` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-function` | `blue.onLight.1000` `#1c3a75` | `blue.onDark.1000` `#b7c9eb` | tecton-astryx → `--color-text-blue` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-type` | `lilac.onLight.1000` `#4a3067` | `lilac.onDark.1000` `#cdc4d8` | tecton-astryx → `--color-text-purple` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-variable` | `gray.onLight.1570` `#1e1825` | `gray.onDark.contrasts.1570` `#f6f5f8` | tecton-astryx → `--color-text-primary` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-operator` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | tecton-astryx → `--color-text-cyan` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. operator/property/attribute all resolve to azure 1000 (cyan=teal=azure). |
| `--color-syntax-constant` | `saffron.onLight.1000` `#593114` | `saffron.onDark.1000` `#e5c2a9` | tecton-astryx → `--color-text-orange` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-tag` | `red.onLight.1000` `#751a0a` | `red.onDark.1000` `#ecbbbc` | tecton-astryx → `--color-text-red` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-attribute` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | tecton-astryx → `--color-text-teal` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. operator/property/attribute all resolve to azure 1000 (cyan=teal=azure). |
| `--color-syntax-property` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | tecton-astryx → `--color-text-cyan` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. operator/property/attribute all resolve to azure 1000 (cyan=teal=azure). |
| `--color-syntax-punctuation` | `graphite.onLight.680` `#604e6e` | `graphite.onDark.680` `#a7a2ac` | tecton-astryx → `--color-text-secondary` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |
| `--color-syntax-background` | `graphite.onLight.110` `#ebe9ee` | `graphite.onDark.110` `#28232c` | tecton-astryx → `--color-background-muted` | Not set by tecton-astryx; upstream default is a var() onto a token tecton-astryx sets, so it inherits the Tecton value. |

### 3.8 Categorical / data-visualisation colours — all **proposed**

`tecton-astryx` never mapped `--color-data-*`. Its build emitted the upstream Meta-blue defaults. Proposal:

- **Categorical (10) + neutral**: mode-aware, taken from Tecton's accent *fill* stop (560; blue 680), exactly as the
  Tecton Accents page defines "fill". All clear 3:1 against the body in both modes (§9). Tecton has no teal, brown
  or indigo, so teal → **lime**, brown → **yellow** (amber) and indigo → **orchid**. This keeps 10 distinguishable
  series; the slot names then mismatch their hues and must be documented. `lemon` stays free for a user extension.
- **Sequential ramps (9 × 5)**: mode-invariant like upstream (5 = darkest … 1 = lightest), taken from the
  `onLight` ramp stops `1000/680/460/220/110` of blue, green (shamrock), saffron (orange), pink, lilac (purple), red,
  azure (teal), yellow and graphite (gray).
- **Continuous colormaps**: the token file already carries MPL (viridis, plasma, magma, inferno, cividis, turbo, …)
  and Colorcet samples. Recommend exposing them only to chart code, from the manifest.
- **Owner must approve.** Nothing in the Tecton design documents chart colours, apart from the Welcome page's
  description: "colour is spent only on data: teal/azure, salmon/red, amber and olive, muted green".

| Upstream token | Light (palette path, hex) | Dark (palette path, hex) | Source | Notes |
|---|---|---|---|---|
| `--color-data-categorical-blue` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | proposed | Proposed: blue accent-fill stop (680), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-orange` | `saffron.onLight.560` `#914f20` | `saffron.onDark.560` `#cb8553` | proposed | Proposed: saffron accent-fill stop (560), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-purple` | `lilac.onLight.560` `#7a4e9b` | `lilac.onDark.560` `#9f8ead` | proposed | Proposed: lilac accent-fill stop (560), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-green` | `green.onLight.560` `#0c703e` | `green.onDark.560` `#4fa66f` | proposed | Proposed: green accent-fill stop (560), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-pink` | `pink.onLight.560` `#994c4c` | `pink.onDark.560` `#c2867a` | proposed | Proposed: pink accent-fill stop (560), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-cyan` | `azure.onLight.560` `#1b6b6b` | `azure.onDark.560` `#29a6a6` | proposed | Proposed: azure accent-fill stop (560), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-red` | `red.onLight.560` `#ba2a0f` | `red.onDark.560` `#cc7f7d` | proposed | Proposed: red accent-fill stop (560), mode-aware (upstream uses one value in both modes). |
| `--color-data-categorical-teal` | `lime.onLight.560` `#546918` | `lime.onDark.560` `#84a138` | proposed | Proposed: lime accent-fill stop (560), mode-aware (upstream uses one value in both modes). Tecton has no teal distinct from azure (already used for cyan); lime keeps the 10 series distinguishable. Name/hue mismatch - document it. |
| `--color-data-categorical-brown` | `yellow.onLight.560` `#8a5601` | `yellow.onDark.560` `#d18404` | proposed | Proposed: yellow accent-fill stop (560), mode-aware (upstream uses one value in both modes). Tecton "yellow" family is amber/brown at 560 (dark #d18404, light #8a5601). |
| `--color-data-categorical-indigo` | `orchid.onLight.560` `#9526c9` | `orchid.onDark.560` `#c36dfd` | proposed | Proposed: orchid accent-fill stop (560), mode-aware (upstream uses one value in both modes). orchid is the only saturated blue-purple left unused; lilac/violet are too muted to separate from purple. |
| `--color-data-neutral` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | proposed | Proposed: graphite accent fill. |
| `--color-data-blue-5` | `blue.onLight.1000` `#1c3a75` | `blue.onLight.1000` `#1c3a75` | proposed | Proposed: blue.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-blue-4` | `blue.onLight.680` `#2850a1` | `blue.onLight.680` `#2850a1` | proposed | Proposed: blue.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-blue-3` | `blue.onLight.460` `#3a6acb` | `blue.onLight.460` `#3a6acb` | proposed | Proposed: blue.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-blue-2` | `blue.onLight.220` `#89a6e1` | `blue.onLight.220` `#89a6e1` | proposed | Proposed: blue.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-blue-1` | `blue.onLight.110` `#e3eaf8` | `blue.onLight.110` `#e3eaf8` | proposed | Proposed: blue.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-shamrock-5` | `green.onLight.1000` `#07452a` | `green.onLight.1000` `#07452a` | proposed | Proposed: green.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-shamrock-4` | `green.onLight.680` `#0a6238` | `green.onLight.680` `#0a6238` | proposed | Proposed: green.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-shamrock-3` | `green.onLight.460` `#0d7f46` | `green.onLight.460` `#0d7f46` | proposed | Proposed: green.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-shamrock-2` | `green.onLight.220` `#13bf63` | `green.onLight.220` `#13bf63` | proposed | Proposed: green.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-shamrock-1` | `green.onLight.110` `#b8f8d5` | `green.onLight.110` `#b8f8d5` | proposed | Proposed: green.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-orange-5` | `saffron.onLight.1000` `#593114` | `saffron.onLight.1000` `#593114` | proposed | Proposed: saffron.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-orange-4` | `saffron.onLight.680` `#80461c` | `saffron.onLight.680` `#80461c` | proposed | Proposed: saffron.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-orange-3` | `saffron.onLight.460` `#a65a25` | `saffron.onLight.460` `#a65a25` | proposed | Proposed: saffron.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-orange-2` | `saffron.onLight.220` `#dd9764` | `saffron.onLight.220` `#dd9764` | proposed | Proposed: saffron.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-orange-1` | `saffron.onLight.110` `#f7e6d9` | `saffron.onLight.110` `#f7e6d9` | proposed | Proposed: saffron.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-pink-5` | `pink.onLight.1000` `#5c2e2e` | `pink.onLight.1000` `#5c2e2e` | proposed | Proposed: pink.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-pink-4` | `pink.onLight.680` `#854242` | `pink.onLight.680` `#854242` | proposed | Proposed: pink.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-pink-3` | `pink.onLight.460` `#aa5555` | `pink.onLight.460` `#aa5555` | proposed | Proposed: pink.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-pink-2` | `pink.onLight.220` `#cc9999` | `pink.onLight.220` `#cc9999` | proposed | Proposed: pink.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-pink-1` | `pink.onLight.110` `#f3e7e7` | `pink.onLight.110` `#f3e7e7` | proposed | Proposed: pink.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-purple-5` | `lilac.onLight.1000` `#4a3067` | `lilac.onLight.1000` `#4a3067` | proposed | Proposed: lilac.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-purple-4` | `lilac.onLight.680` `#6b438c` | `lilac.onLight.680` `#6b438c` | proposed | Proposed: lilac.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-purple-3` | `lilac.onLight.460` `#8b5ba9` | `lilac.onLight.460` `#8b5ba9` | proposed | Proposed: lilac.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-purple-2` | `lilac.onLight.220` `#bc9ace` | `lilac.onLight.220` `#bc9ace` | proposed | Proposed: lilac.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-purple-1` | `lilac.onLight.110` `#ede8f3` | `lilac.onLight.110` `#ede8f3` | proposed | Proposed: lilac.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-red-5` | `red.onLight.1000` `#751a0a` | `red.onLight.1000` `#751a0a` | proposed | Proposed: red.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-red-4` | `red.onLight.680` `#a3240d` | `red.onLight.680` `#a3240d` | proposed | Proposed: red.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-red-3` | `red.onLight.460` `#d22f11` | `red.onLight.460` `#d22f11` | proposed | Proposed: red.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-red-2` | `red.onLight.220` `#f58879` | `red.onLight.220` `#f58879` | proposed | Proposed: red.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-red-1` | `red.onLight.110` `#fde4e1` | `red.onLight.110` `#fde4e1` | proposed | Proposed: red.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-teal-5` | `azure.onLight.1000` `#114242` | `azure.onLight.1000` `#114242` | proposed | Proposed: azure.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-teal-4` | `azure.onLight.680` `#185e5e` | `azure.onLight.680` `#185e5e` | proposed | Proposed: azure.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-teal-3` | `azure.onLight.460` `#1f7a7a` | `azure.onLight.460` `#1f7a7a` | proposed | Proposed: azure.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-teal-2` | `azure.onLight.220` `#2eb8b8` | `azure.onLight.220` `#2eb8b8` | proposed | Proposed: azure.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-teal-1` | `azure.onLight.110` `#c6f1f1` | `azure.onLight.110` `#c6f1f1` | proposed | Proposed: azure.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-yellow-5` | `yellow.onLight.1000` `#583400` | `yellow.onLight.1000` `#583400` | proposed | Proposed: yellow.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-yellow-4` | `yellow.onLight.680` `#7a4a00` | `yellow.onLight.680` `#7a4a00` | proposed | Proposed: yellow.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-yellow-3` | `yellow.onLight.460` `#9c6201` | `yellow.onLight.460` `#9c6201` | proposed | Proposed: yellow.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-yellow-2` | `yellow.onLight.220` `#e49700` | `yellow.onLight.220` `#e49700` | proposed | Proposed: yellow.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-yellow-1` | `yellow.onLight.110` `#ffe9ae` | `yellow.onLight.110` `#ffe9ae` | proposed | Proposed: yellow.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-gray-5` | `graphite.onLight.1000` `#433751` | `graphite.onLight.1000` `#433751` | proposed | Proposed: graphite.onLight.1000 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-gray-4` | `graphite.onLight.680` `#604e6e` | `graphite.onLight.680` `#604e6e` | proposed | Proposed: graphite.onLight.680 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-gray-3` | `graphite.onLight.460` `#7b668b` | `graphite.onLight.460` `#7b668b` | proposed | Proposed: graphite.onLight.460 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-gray-2` | `graphite.onLight.220` `#b2a1bb` | `graphite.onLight.220` `#b2a1bb` | proposed | Proposed: graphite.onLight.220 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |
| `--color-data-gray-1` | `graphite.onLight.110` `#ebe9ee` | `graphite.onLight.110` `#ebe9ee` | proposed | Proposed: graphite.onLight.110 in BOTH modes (upstream sequential ramps are mode-invariant, 5=darkest..1=lightest). |

### 3.9 Inverted surfaces (`onDark` / `onLight` media tokens)

Upstream defaults set `color-scheme`, `--color-text-primary` → `--color-on-{dark,light}`,
`--color-icon-primary` → the same, and `--color-accent` → the on-colour. `tecton-astryx` adds four pinned values per
surface:

- **onDark**: `--color-text-primary` #f6f5f8, `--color-text-secondary` #a7a2ac, `--color-background-surface`
  #131214, `--color-border` #342f39.
- **onLight**: #1e1825, #604e6e, #fafafb and #e4dde7.

These are the dark and light side of each pair respectively. The focus ring still fails on inverted surfaces (§9).

---

## 4. Typography

### 4.1 Families and stacks

| Token | Value | Source |
|---|---|---|
| `--font-family-body` | `Figtree, Helvetica, Arial, sans-serif` | tecton-astryx (the stack printed on the Tecton typography page) |
| `--font-family-heading` | same as body (headings differ by weight, 500) | tecton-astryx |
| `--font-family-code` | `"IBM Plex Mono", Consolas, Monaco, monospace` | tecton-astryx; also used for the three data variants |

For the WC port, prepend `"Figtree Variable"` if we ship `@fontsource-variable/figtree`, because that package
registers the family under that name. Example: `"Figtree Variable", Figtree, Helvetica, Arial, sans-serif`.

### 4.2 Scale (16 Tecton variants; rem at a 16px root)

There is no letter-spacing anywhere in Tecton: not in the foundation, the export or `tecton-astryx`, so use
`normal`. Only two weights are used, 400 and 500. The ladder is not geometric (10/12/14/16/20/24/32/40/48), so it is
written as explicit tokens.

| Variant | Size | px | Weight | Line-height | ≈ px | Family / numerals | Bound to Astryx |
|---|---|---|---|---|---|---|---|
| display1 | 3rem | 48 | 500 | 1.2083 | 58 | sans | `--text-display-1-*` |
| display2 | 2.5rem | 40 | 500 | 1.2 | 48 | sans | `--text-display-2-*` |
| display3 | 2rem | 32 | 500 | 1.1875 | 38 | sans | `--text-display-3-*` |
| heading1 | 1.5rem | 24 | 500 | 1.25 | 30 | sans | `--text-heading-1-*` |
| heading2 | 1.25rem | 20 | 500 | 1.2 | 24 | sans | `--text-heading-2-*` |
| large | 1rem | 16 | 500 | 1.25 | 20 | sans | `--text-large-*`, `--text-heading-3-*` |
| medium | 0.875rem | 14 | 400 | 1.2857 | 18 | sans | `--text-body-*` |
| mediumStrong | 0.875rem | 14 | 500 | 1.2857 | 18 | sans | `--text-label-*`, `--text-heading-4-*` |
| small | 0.75rem | 12 | 400 | 1.3333 | 16 | sans | `--text-supporting-*` |
| smallStrong | 0.75rem | 12 | 500 | 1.3333 | 16 | sans | `--text-heading-5-*` |
| tiny | 0.625rem | 10 | 500 | 1.4 | 14 | sans | `--text-heading-6-*` |
| largeData | 1rem | 16 | 400 | 1.25 | 20 | **mono, `tabular-nums`** | custom text type |
| mediumData | 0.875rem | 14 | 400 | 1.2857 | 18 | **mono, `tabular-nums`** | `--text-code-*` + custom type |
| smallData | 0.75rem | 12 | 400 | 1.3333 | 16 | **mono, `tabular-nums`** | custom text type |
| actionMedium | 0.875rem | 14 | 500 | 1.2857 | 18 | sans | custom type (button label) |
| actionSmall | 0.75rem | 12 | 500 | 1.3333 | 16 | sans | custom type |

Raw sizes are `--font-size-xs` 10, `sm` 12, `base` 14, `lg` **16** (upstream 17), `xl` 20, `2xl` 24, `3xl` **32**
(29), `4xl` **40** (35) and `5xl` **48** (42) px. `4xs/3xs/2xs` (6/7/8px) keep their upstream values because Tecton
has no equivalent.

Weights are `normal` 400, `medium` 500, **`semibold` 500** (Tecton has no 600) and `bold` 600 (kept only so prose
`<strong>` differs).

Notes:

- **Headings 3–6 are extrapolated.** Tecton names only two heading levels.
- The **type scale change is intentional geometry change**: `theme-audit.md` recorded 1,414 type-scale differences
  from the neutral theme, all "the theme working". Plan §6 requires geometry regression tests on this, even though
  spacing is unchanged.
- **Numerals.** The data variants use `font-variant-numeric: tabular-nums` in Plex Mono. Figtree text is
  proportional by default. `tecton-astryx`'s table example calls tabular figures "load-bearing".
- **Documented contradiction.** The foundation heading says data uses "Figtree with tabular numbers", but the
  printed CSS says Plex Mono. `tecton-astryx` and the Tecton export's `--tecton-font-family-mono` both follow Plex
  Mono.
- **Italics**: none of the 16 variants uses italic. Load italic only if prose needs it.

### 4.3 Font delivery

| Project | How |
|---|---|
| tecton-astryx | Does not ship fonts ("a design system that downloads fonts on your behalf decides your privacy policy"). Docs link Google Fonts: Figtree 400;500;600(;700) and Plex Mono 400;500 |
| tecton-webcomponents | `@fontsource/figtree` 5.3.0 (400/500/600) + `@fontsource/ibm-plex-mono` 5.3.0 (400/500) as dependencies. An opt-in `@tecton/wc/fonts.css` `@import`s them |

Recommendation for tecton-astryx-wc:

- An opt-in `fonts.css` entry, never auto-imported by components, built on:
  - **`@fontsource-variable/figtree`** 5.3.0, OFL-1.1. One `wght 300–900` file (latin 20 KB) covers 400/500/600,
    versus 3 × 11 KB statics. Family name is `"Figtree Variable"`.
  - **`@fontsource/ibm-plex-mono`** 5.3.0, OFL-1.1, 400 (+500 optional; latin ≈ 15 KB each). No variable Plex Mono
    package exists (`@fontsource-variable/ibm-plex-mono` returns 404).
- Both are **SIL OFL 1.1**: redistributable and bundleable, but the fonts must not be sold alone and the licence
  text must travel with them. Add to THIRD-PARTY-NOTICES.
- `@font-face` must live in **document** scope. Faces declared inside a shadow root are not reliably applied, so
  `fonts.css` is a light-DOM stylesheet.
- `font-display: swap` (the Fontsource default) plus metric-matched fallbacks (`size-adjust` / `ascent-override`
  on a local Arial/Helvetica face, or `font-size-adjust`). This follows the modern-web-guidance guide
  "visually-stable-font-fallbacks". The `tecton-webcomponents` review flagged the missing `font-size-adjust` and a
  missing Plex Mono preload.

---

## 5. Radii

The Tecton scale is `radius.0/25/50/100/150/200/round` = 0/2/4/8/12/16/1000px. It maps onto the Astryx role-based
tokens as follows. Upstream is 0/4/8/12/28/28/9999, so Tecton is uniformly tighter.

| Token | Tecton | Upstream | Role |
|---|---|---|---|
| `--radius-none` | 0px | 0px | flush seams |
| `--radius-inner` | **2px** (`radius.25`) | 4px | dense controls: checkbox box, menu item, select option row, kbd |
| `--radius-element` | **4px** (`radius.50`, "default Tecton corner") | 8px | button/icon-button/toggle, all fields (via `--_field-radius`), code block, banner card, anchored menu panel, segmented control |
| `--radius-container` | **8px** (`radius.100`) | 12px | card, section, dialog, popover |
| `--radius-chat` | **12px** (`radius.150`) | 28px | chat bubbles/composer (the name doesn't match the meaning; the value carries radius.150) |
| `--radius-page` | **16px** (`radius.200`) | 28px | page-level surfaces (same caveat) |
| `--radius-full` | 9999px (`radius.round` is 1000px) | 9999px | pills, circles |

Per-component special cases recorded in `components.ts` and the audits. Each is in the JSON under
`radius.specialCases`.

- **Never** set a `border-radius` shorthand on Button or ToggleButton. Inside a ButtonGroup the component squares
  its *interior* corners per corner, and a shorthand flattened 534 group instances (theme-audit §1). The group
  wrapper itself gets no radius; the end members own the corners.
- **Banner**: 4px through the component's private `--_banner-radius`, and only for `container=card`. Section banners
  are full-bleed and square. The header and body meet flush, and a shorthand put corners mid-banner.
- **DropdownMenu**: 4px only for `presentation=popover`. The bottom-sheet presentation stays square against the
  viewport edge. **Popover** keeps 8px from `--radius-container`, because it underlies mega menus and sheets that
  square themselves.
- DropdownMenuItem and SelectorOptionRow are 2px, inset inside the panel.
- **Token (chip)** and **Badge** are full pills, so single digits render as circles.
- **SegmentedControl**: do not restate radius or padding; the selected pill's concentric radius is computed from
  them.
- Checkbox 2px; radio, switch and avatar-circle use full.
- **Not expressed:**
  - The design's pill FAB (FAB = Button + elevation, so 4px).
  - Square-cornered list rows (the design draws them square, but they inherit 4px/2px).
  - Circular vs rounded-square IconButton (no shape prop).

---

## 6. Spacing, sizing, borders

- **Spacing kept.** The Tecton `space.*` scale is the same 4px grid:
  - `space.25` (2px) = `--spacing-0-5` and `space.75` (6px) = `--spacing-1-5`.
  - Tecton adds 56–144px steps that no component uses.
  - `tecton-astryx` sets **no** `--spacing-*` token and recorded **no spacing exceptions**. Its audit reports 0
    structural differences beyond type-scale-driven ones.
  - Its only spacing decisions were *removals*: it stopped overriding Card/Section padding (16px, equal to the
    Astryx default) and SegmentedControl padding.
  - Aliases `none/xxs/xs/sm/md/lg/xl/xxl` → `--spacing-0/0-5/1/2/3/4/6/8` exist in `tecton.space`.
- **Sizes**: `--size-element-sm/md/lg` = 28/32/36px. 28 and 32 are Tecton's measured Button/TextField sizes and
  equal upstream; 36 has no Tecton source. `--border-width` = 1px (every Tecton rule).
- **Export extras** (not bound to Astryx): `--tecton-border-width-{0,100,200,400}` = 0/1/2/4px and
  `--tecton-icon-size-{50…400}` = 12/16/20/24/32/40/48px. Astryx Icon sizes 12/16/20/24 already coincide.
- **Measured design geometry that is *not* applied** (candidates for the plan's `spacing-exceptions` review; none
  approved):
  - List rows 44/36px; table rows ~44/~34px; menu item ~34/~28px; tab ~32/~28px.
  - Switch ~34×16 / ~28×14 (Astryx 32×20 / 40×24); checkbox 16/12px; radio ~16/~13px.
  - Slider md 6px track + 20px thumb, sm ~2px + 12px.
  - Chip 24/20/18px; avatar 40/32/24/18 (Astryx 20/24/36/48); ToggleButton 4 sizes (~57/46/34/28).
  - Linear progress 3px track.

---

## 7. Per-component overrides (what Tecton imposes beyond tokens)

Taken from `tecton-astryx/packages/react/src/theme/components.ts`, which has 73 targets. The mechanism lessons
matter as much as the values. **Prefer re-pointing the token a component already mixes from, over setting the
property.** Setting the property broke hover `color-mix()`, forced-colours fallbacks and variant props in 12 audited
root causes.

| Astryx component (target) | Tecton override |
|---|---|
| **Button** | Five emphases: `primary`, `secondary`, `ghost` (= Tecton *tertiary*), plus custom variants **`outlined`** (1px `--tecton-color-action-outlined-border` rule, mauve ink) and **`text-only`** (ink only; *focus* paints a recessed fill `action.textOnly.focusBackground`). Every state is an explicit fill from `action.*` (rest/hover/active/disabled); overlay tints are set transparent. `destructive` has no Tecton source and is painted from `status.error.filled*`. Hover/pressed re-point `--color-icon-secondary` to the label ink (2.88:1 fix). Ghost ink goes through `--tecton-color-action-tertiary-text`, which Banner re-points. `--button-focus-offset: 1px`. No radius/weight override |
| **ToggleButton** | `isPressed` (attribute `data-is-pressed="true"`): activated fill `graphite 190`, hover 220, press 260, ink `mauve 1000`. It must stay activated under hover/press |
| **ButtonGroup** | nothing (end members own the corners) |
| **SegmentedControl / item** | strip `gray 120`; rest ink `graphite 560`; selected = flat `mauve 310` fill + `mauve 1570` ink, `box-shadow: none` (no lifted pill) |
| **Link** | `color=accent` (default) re-points `--color-text-accent` → `--color-text-primary`: Tecton links are body-coloured, and underline is the only affordance. Hover: text unchanged |
| **TextInput, TextArea, Selector, Typeahead, Tokenizer** | Outlined field: transparent fill, `--tecton-color-input-border` rule, hover `…-border-hover`, value ink `--tecton-color-input-value`. Focus = pink border + 1px pink inset. Disabled = `gray 130` border / `gray 190` ink. Validation recolours only the border (`status.*.outlineStrongBorder`) |
| **ComplexSelector, DateInput, DateRangeInput, DateTimeInput (+ date/time segments), FileInput, MultiSelector, NumberInput, PowerSearch, TimeInput** | Focus only (pink border + inset). The accent border was 2.2:1 |
| **FieldLabel / FieldStatus / InputStatusIcon** | label ink `graphite 560`. The status message has **no box** (`background: transparent`; the wash bled 6px into the transparent field) and uses `status.*.outlineText` ink |
| **SelectorOptionRow** | 2px radius; selected = row-selected fill |
| **CheckboxIndicator (+check)** | Box transparent, border `mauve 830`. Checked = **near-white chip `mauve 1300`** through `--color-accent`, with a dark glyph (`gray 50`). Disabled border `gray 190`. Indeterminate is *not themeable* (the design wants a filled `mauve 1000` box and dark dash) |
| **RadioIndicator** | Transparent centre; checked ring + dot = `mauve 1300` through `--color-accent`/`--color-on-accent` (keeps the forced-colours `CanvasText` branch) |
| **Switch / thumb** | Off track = **1px inset-shadow ring** `mauve 680` on transparent (not a border: that would shrink the pixel-sized track), with the thumb the same mauve. On track = `violet 370` via `--color-accent`, thumb `lilac 1300`. Disabled = ring `gray 190`. Checked+disabled = `graphite 220` track |
| **Banner / BannerIcon / BannerFrame** | Filled emphasis: severity `filledBackground` with **dark ink** by re-pointing text/icon/ghost-ink/**focus** tokens inside. Custom status **`neutral`**. Card radius 4px. Frame fill = card surface |
| **Badge** | Mapped to Tecton *Chip*: `neutral` = `gray 120` / `gray 1000`; info/success/warning/error = solid filled + on-ink; custom **`lime`** variant; hue variants stay tinted |
| **Token** | Full pill; `default` = chip fill; hue colours tinted |
| **StatusDot / AvatarStatusDot** | Severity `main` values; `accent` → info main |
| **ProgressBar track/fill** | Track `--color-track` (divider-strong weight). `accent` = Tecton "primary" neutral `graphite 830`; success/warning/error = filled; neutral = neutral main |
| **Tab / TabIndicator / TabStrip** | Rest `graphite 560`, hover `mauve 1000`, selected `mauve 1570` + weight 500, indicator = selected ink, strip border `--color-border` |
| **Item, ListItem, DropdownMenuItem, TableRow** | Hover through `--color-overlay-hover` → `graphite 140` (row hover). Menu item has 2px radius; destructive = error outline ink |
| **DropdownMenu** | popover surface + 1px `--color-border` rule; 4px radius on `presentation:popover` only; keeps its (soft) shadow |
| **TreeListItem** | selected = row-selected fill |
| **TopNav / TopNavItem** | solid black band, white 50 % ink; selected item = text-primary. Light mode fails; see §3.4 |
| **Table, TableHeader(+Cell), TableRow, TableCell, TableFooter** | borders `--color-border`. Header = `graphite 160` (the lightest surface), medium weight, and re-points `--color-icon-secondary` → text-secondary (2.88 → 4.3:1). Stripe via `--color-background-muted` → `gray 130`. Footer `graphite 110` |
| **Dialog, Popover** | + 1px `--color-border` rule (depth = rule + darkness); radius untouched (8px) |
| **Divider** | base = divider **medium**; `subtle` and `strong` variants. Medium has no variant slot, so the default shows medium |
| **Skeleton** | `--color-skeleton` |
| **Avatar / AvatarFallback** | fill `pink 560`, ink `gray 50`. No accent-per-instance prop and no "off" state |
| **Kbd, CodeBlock** | fill `--color-background-muted` |
| **Slider / track / thumb** | track `--color-track`; thumb = chip `mauve 1300` via `--color-accent` (keeps hover mix) |
| **Icon** | `color=accent` → `--color-icon-accent` (accent is a fill; 2.2:1 as ink) |
| **StepIndicator, StepConnector** | `--color-accent` → `--color-icon-accent` (glyph 2.2:1, badge digit 2.0:1). Not on Stepper itself, so primary buttons in step content keep the fill |
| **MetadataList** | "Show more" `--color-accent` → `--color-text-accent` |
| **ChatToolCalls** | `--color-success/error` → `--color-text-green/red` (diff stat 4.0:1 when hovered) |
| **Text** | 8 custom types (`mediumStrong smallStrong tiny largeData mediumData smallData actionMedium actionSmall`); data types use mono + `tabular-nums`; `color=placeholder` → `--tecton-color-text-placeholder` |
| **Card, Section, Tooltip, Heading, InputGroup, Field** | deliberately **no** override (defaults already equal Tecton, or no Tecton design exists). Tooltip stays the inverted surface |

**Design gaps that no theme expressed** (fidelity report §5), which a WC port *could* choose to implement:

- Filled and text-only field appearances (the tokens exist: `component.input.filled/textOnly.*`)
- Filled/outlined alert emphasis
- Chip outlined emphasis
- Tecton overlay Badge (count, 99+)
- Indeterminate filled checkbox
- Filled tab style and vertical tabs
- Tab dark-box focus
- Progress buffer and teal/lime colours
- Determinate circular progress
- Avatar accent and off state
- Divider medium variant
- `activated` state on Button/List/MenuItem
- Tree-view states (hidden, right-click)
- Toggle-button fourth size

---

## 8. Icons

| Fact | Value |
|---|---|
| Set | **131** glyphs in `tecton-astryx/design/icons/tecton/*.ts`, generated into `packages/react/src/icons/generated/*.tsx` |
| Format | Figma export. Each file calls `defineTectonSvgIcon(name, {viewBox:'0 0 16 16', outline, filled, colored?})` with inline `<path>` markup: filled shapes, `fill=currentColor`, no strokes. 59 of 131 have identical outline/filled markup. `strata` is `colored: true` (renders red, does not inherit colour). About 185 KB of path data in total. Ink fills a mean of 73 % of the box, versus about 83 % for Lucide, so the glyphs read about 10 % smaller |
| Domain glyphs | about 23 subsurface/energy glyphs with no equivalent anywhere: drill-bit, seismic, horizon, strata, well, well-pick, well-plan, trajectory, velocity-model, rock-formations, geobodies, geostructure, fault, log-curve, oil-rig-offshore, christmas-tree, valve, facility, surface, water, … |
| Generic glyph names | Material-Symbols-style (`visibility-off`, `open-in-new`, `more-vert`, `edit-square`, `collapse-content`, `drag-indicator`, `view-column`) |
| **Licence** | **None stated anywhere.** Not in `tecton-astryx` (its only notice is Astryx MIT), not in `tecton-webcomponents` (which ships 18 of the domain glyphs as `@tecton/wc/icons` data files, also unlicensed), and not in the token/design folders. `tecton-astryx`'s own fidelity report says "nothing in this repository contains [the artwork's source]". Treat it as owner-proprietary design assets until the owner confirms redistribution rights and whether any generic glyphs derive from Material Symbols (Apache-2.0, which requires a NOTICE) |

Semantic role coverage (Astryx `IconName` has 28 core roles plus namespaced ones):

| Astryx role | Tecton glyph |
|---|---|
| close, check, chevronDown/Left/Right, search, menu, copy, arrowUp, arrowDown, info, warning, error, microphone | same-named glyph (`error` → `error`, `success` → `check-circle`) |
| arrowsUpDown | `caret-up-down` |
| funnel | `filter` |
| eyeSlash | `visibility-off` |
| externalLink | `open-in-new` |
| viewColumns | `view-column` |
| wrench | `settings` |
| moreHorizontal | `more-vert`. **Vertical dots for a "horizontal" role.** Flag for the owner |
| **chevronsLeft, chevronsRight, calendar, clock, checkDouble, stop** | **no Tecton glyph.** They fall back to upstream 24-unit stroked icons (a visual mismatch). Gap |
| `numberInput:stepperDown` (namespaced) | not registered. Candidate: `chevron-down-small` (proposed) |

How to ship them in the WC port:

- **Per-icon ES modules** exporting data (`{name, viewBox, outline, filled, colored}`), not an SVG sprite. This is
  what `tecton-webcomponents` did.
- A **role registry** module for the 22 semantic roles, so `<ax-icon>`-style internals can resolve a role without
  importing all 131 icons.
- Render inline `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">` in the shadow
  root. Reasons:
  - Sprites referenced with `<use href="sprite.svg#id">` do not cross shadow roots or origins cleanly.
  - They can't be tree-shaken.
  - They complicate the `colored` glyph.
- Offer an optional generated sprite only as a non-component convenience.
- **Do not bundle Lucide.** Upstream's fallback is its own inline minimal set.
- Keep the source `.ts` files as the design source of truth. Generate from them and `--check` for drift.

---

## 9. Contrast

### 9.1 Known issues from the tecton-astryx audits

| Issue | Measured | Status in tecton-astryx |
|---|---|---|
| `--color-border-emphasized` (Divider medium) on body | 2.21 dark / 2.20 light (bar 3.0) | **Inherited from the design, left as-is and pinned by a test.** Use divider-strong (3.1:1) where a boundary must be seen |
| `--color-accent` used as *ink* (Icon accent, Stepper, MetadataList) | 2.20; Stepper digit on its own fill 1.98 | Fixed by re-pointing to `--color-icon/text-accent` per component |
| Focus pink on Banner severity fills | 1.0 (success), 1.2 (info/warning/error), 2.3 (neutral) | Fixed: focus ink re-pointed to the banner on-colour |
| Focus pink on inverted/near-white surfaces (Toast, light media scrim, light syntax preset) | #ff00aa 2.48; #ff52a8 2.99 | **Open deviation.** No second focus hue exists in Tecton |
| Fields ringing in accent | 2.2 on 121 focus stops | Fixed: every field focuses in pink |
| Icon-secondary on pressed row (20 % wash) | 2.44 | Fixed: washes reduced to 5 %/10 % |
| Icon-secondary on tertiary press fill / table header | 2.88 | Fixed: re-pointed to label ink / text-secondary |
| Ghost button ink on Banner warning/success | 1.21 / 1.4 | Fixed: `--tecton-color-action-tertiary-text` re-pointed |
| ChatToolCalls diff stat hovered | 4.02 | Fixed: text-green/red |
| Light: primary fill vs page | 2.2 (boundary; label 5.9 OK) | Open (derivation weakness) |
| Light: disabled label on disabled fill | ~2.2 (exempt) | Inherited |
| Light: top-nav band ink (black band, dark ink) | 1.21 / 2.81, 51 findings | **Open derivation gap.** The export light values fix it |
| Light: text-disabled on page | 2.22 (exempt, 44 findings) | By design |

### 9.2 Recomputed here

These are WCAG 2.x ratios, with alpha composited on the real background.

- The **Light** and **Dark** columns are the `tecton-astryx` values.
- The **Export light** column uses the export's value where the role exists in the export, and falls back to the
  `tecton-astryx` value otherwise.
- **Bold** marks a value under its bar.

| Pair | Bar | Light | Dark | Export light |
|---|---|---|---|---|
| text-primary / body | 4.5 | 15.84 | 15.62 | 15.73 |
| text-primary / surface | 4.5 | 16.6 | 17.2 | 16.49 |
| text-secondary / body | 4.5 | 6.83 | 6.79 | 6.83 |
| text-disabled / body | exempt/none | 2.22 | 2.22 | 2.22 |
| placeholder / body | 4.5 | **3.12** | **3.11** | **3.12** |
| input placeholder / body | 4.5 | 4.67 | 4.65 | 4.67 |
| icon-secondary / body | 3 | 4.67 | 4.65 | 4.67 |
| icon-secondary / body+overlay-pressed | 3 | 3.71 | 3.44 | 3.71 |
| text-accent (lilac) / body | 4.5 | 8.38 | 8.33 | **1.42** |
| accent fill / body (boundary) | 3 | **2.21** | **2.2** | 6.88 |
| on-accent / accent | 4.5 | 5.91 | 5.94 | 6.85 |
| focus ring / body | 3 | 3.29 | 5.67 | 3.29 |
| focus ring / surface | 3 | 3.45 | 6.25 | 3.45 |
| focus ring / accent fill | 3 | **1.49** | **2.58** | **2.09** |
| focus ring / inverted surface | 3 | 4.81 | **2.75** | 4.78 |
| focus ring / success fill | 3 | **1.71** | **1.0** | **1.71** |
| focus ring / warning fill | 3 | **2.08** | **1.21** | **2.74** |
| border (subtle) / body | exempt/none | 1.22 | 1.3 | 1.22 |
| border-emphasized / body | 3 | **2.2** | **2.21** | **2.2** |
| divider-strong / body | 3 | 3.11 | 3.14 | 3.11 |
| input border / body | 3 | **2.2** | **2.21** | 3.11 |
| track / body | 3 | 3.11 | 3.14 | 3.11 |
| on-success / success | 4.5 | 5.98 | 6.28 | 5.98 |
| on-warning / warning | 4.5 | 7.24 | 7.59 | 6.9 |
| on-error / error | 4.5 | 4.88 | 5.12 | 7.21 |
| on-info / info fill | 4.5 | 4.79 | 5.16 | 5.78 |
| error outline text / body | 4.5 | 5.6 | 5.57 | 6.82 |
| success fill as ink / body | 4.5 | 5.64 | 5.67 | 5.64 |
| error fill as ink / body | 4.5 | 4.62 | 4.62 | 6.82 |
| text-primary / table header | 4.5 | 9.9 | 9.68 | 11.13 |
| icon-secondary / table header | 3 | **2.92** | **2.88** | 3.3 |
| tab rest text / body | 4.5 | 5.63 | 5.65 | 5.63 |
| checkbox glyph / checked fill | 3 | 13.68 | 14.31 | 13.68 |
| switch off ring / body | 3 | 6.88 | 6.82 | 6.88 |
| switch on thumb / on track | 3 | 3.47 | 3.51 | 3.47 |
| disabled text / disabled fill | exempt/none | 1.76 | 2.47 | 1.94 |
| top-nav text / top-nav bg | 4.5 | 5.32 | 5.32 | **4.0** |
| text-primary / top-nav bg | 4.5 | **1.21** | 19.33 | 17.2 |
| text-blue / background-blue | 4.5 | 7.54 | 7.64 | 7.54 |
| text-yellow / background-yellow | 4.5 | 9.86 | 4.86 | 9.86 |
| syntax keyword / syntax bg | 4.5 | 7.6 | 7.54 | 7.6 |
| syntax string / syntax bg | 4.5 | 9.2 | 9.08 | 9.2 |
| syntax comment / syntax bg | 4.5 | 6.2 | 6.15 | 6.2 |
| syntax number / syntax bg | 4.5 | 9.3 | 9.23 | 9.3 |
| syntax type / syntax bg | 4.5 | 9.12 | 9.13 | 9.12 |
| syntax operator / syntax bg | 4.5 | 9.26 | 9.16 | 9.26 |
| syntax tag / syntax bg | 4.5 | 9.13 | 9.07 | 9.13 |
| data categorical yellow(brown) / body | 3 | 5.63 | 5.66 | 5.63 |
| data categorical teal(lime) / body | 3 | 5.63 | 5.76 | 5.63 |
| data categorical purple(lilac) / body | 3 | 5.66 | 5.61 | 5.66 |
| data categorical blue / body | 3 | 6.98 | 7.02 | 6.98 |

What the recomputation shows:

- **`--tecton-color-text-placeholder`** (`gray 310`) reaches only **3.1:1**. Fields actually use
  `input.outlined.placeholderText` (4.67), so bind placeholders to the latter.
- The focus ring fails on the **accent (primary button) fill** in both modes (1.49 / 2.58). The ring sits 1px
  *outside* the button, on the page, so it measures against the body (3.29 / 5.67), which is fine. It fails only
  for a component that draws the ring *on* a primary fill.
- `--tecton-color-input-border` (divider medium) is **2.2:1** against the page. The field boundary relies on it.
  WCAG 1.4.11 applies to the component boundary only when that is the sole identifier. The export's light value
  (`graphite 310`) reaches 3.11. **Flag for the owner.**
- `--color-icon-secondary` on the table header still measures 2.88/2.92. `tecton-astryx` fixed this by re-pointing
  the token inside the header cell, and the port must do the same.
- If export light is adopted, `--color-text-accent` must be rebound (1.42:1).

---

## 10. Motion, breakpoints, z-index

- **Motion**: no Tecton source. Keep upstream `--duration-{fast,medium,slow}{-min,,-max}`
  (130/175/230, 310/410/550, 730/975/1300ms) and `--ease-standard: cubic-bezier(0.24, 1, 0.4, 1)`.
- **Breakpoints**: no Tecton source. Upstream `DEFAULT_WIDTH_BREAKPOINTS` = sm 640, md 768, lg 1024, xl 1280,
  2xl 1536. These are theme-adaptation inputs, not custom properties.
- **z-index**: Astryx defines no z-index tokens. Overlays use the top layer. Hard-coded values exist: Toast
  viewport 500, BottomSheet 1000, AppShell skip-link 9999. There is nothing to map.

---

## 11. Gaps: where no Tecton decision exists

1. **Light mode source of truth**: derived (`tecton-astryx`) vs the designed export (114/161 roles differ). This
   blocks light sign-off.
2. **Data-viz colours** (56 tokens): all proposed here. The teal/brown/indigo slots have no Tecton hue.
3. **Icon licence/provenance** for the 131 glyphs, plus 6 roles with no glyph (chevronsLeft/Right, calendar, clock,
   checkDouble, stop) and `numberInput:stepperDown`. `moreHorizontal` → `more-vert` orientation.
4. **Motion, breakpoints, z-index, letter-spacing**: none in Tecton, so upstream is kept.
5. **Type**: headings 3–6 extrapolated; `semibold` collapses to 500; `bold` 600 is non-Tecton; data font
   contradiction (Figtree vs Plex) resolved toward Plex.
6. **Radius name drift**: `--radius-chat` carries 12 and `--radius-page` carries 16. The pill FAB and square list
   rows are not expressed.
7. **`--size-element-lg` 36px** has no Tecton source.
8. **Disputed dark values**: the input-outlined hover/press border and hover ink were swapped in `tecton-astryx`.
   The export resolves them.
9. **Focus on inverted surfaces** fails 3:1 in both modes. A second focus hue is needed from design.
10. **`--color-border-emphasized` / input border** at 2.2:1 is a design-level contrast shortfall.
11. **Destructive button** has no Tecton design; it is painted from error.
12. **`custom.appColors`** (app1–app4) has no documented use.

---

## Appendix A — Full Tecton role catalogue (`semantic.ts`, 192 roles)

The "Export light" column is filled only when the Tecton export defines the role and its light value differs from
the derived one. "(no export var)" marks roles that were read off component stories (tab, checkbox, switch,
toggleButton, progress, chip) or that the export lacks.

| Tecton role | Light | Dark | Export light (when different) |
|---|---|---|---|
| `text.primary` | `gray.onLight.1570` `#1e1825` | `gray.onDark.contrasts.1570` `#f6f5f8` | `#21172a` (`graphite.onLight.1570`) |
| `text.secondary` | `graphite.onLight.680` `#604e6e` | `graphite.onDark.680` `#a7a2ac` |  |
| `text.disabled` | `gray.onLight.220` `#ada3b2` | `gray.onDark.contrasts.220` `#545356` |  |
| `text.placeholder` | `gray.onLight.310` `#92879a` | `gray.onDark.contrasts.310` `#6a696c` |  |
| `text.inverse` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` |  |
| `text.subtlest` | `graphite.onLight.460` `#7b668b` | `graphite.onDark.460` `#89848e` |  |
| `surface.backgroundDefault` | `gray.onLight.100` `#f6f4f7` | `gray.onDark.contrasts.100` `#1d1c1f` |  |
| `surface.backgroundPaper` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` |  |
| `surface.backgroundElevated` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` |  |
| `surface.dividerMedium` | `graphite.onLight.220` `#b2a1bb` | `graphite.onDark.220` `#57515c` |  |
| `surface.dividerSubtle` | `graphite.onLight.120` `#e4dde7` | `graphite.onDark.120` `#342f39` |  |
| `surface.dividerStrong` | `graphite.onLight.310` `#9884a4` | `graphite.onDark.310` `#6e6873` |  |
| `action.primary.background` | `violet.onLight.220` `#b89dc8` | `violet.onDark.220` `#5d4d68` | `#644a78` (`mauve.onLight.680`) |
| `action.primary.text` | `lilac.onLight.1300` `#35214b` | `lilac.onDark.1300` `#e5e0eb` | `#f7f3f8` (`violet.onLight.100`) |
| `action.primary.hoverBackground` | `violet.onLight.310` `#a47db6` | `violet.onDark.310` `#74647f` | `#865fa0` (`violet.onLight.460`) |
| `action.primary.pressBackground` | `violet.onLight.370` `#976dac` | `violet.onDark.370` `#80708b` | `#563f67` (`mauve.onLight.830`) |
| `action.primary.activeBackground` | `violet.onLight.370` `#976dac` | `violet.onDark.370` `#80708b` | `#765292` (`violet.onLight.560`) |
| `action.primary.hoverText` | `shades.white` `#ffffff` | `shades.white` `#ffffff` |  |
| `action.primary.adornment` | `lilac.onLight.830` `#5c3878` | `lilac.onDark.830` `#beb1c8` | `#dbcae1` (`violet.onLight.140`) |
| `action.primary.hoverAdornment` | `shades.white.transparent.70` `#ffffffb3` | `shades.white.transparent.70` `#ffffffb3` | `#e3d1e9` (`lilac.onLight.130`) |
| `action.primary.pressAdornment` | `shades.white.transparent.80` `#ffffffcc` | `shades.white.transparent.80` `#ffffffcc` | `#e1d2e6` (`violet.onLight.130`) |
| `action.secondary.background` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | `#e4dde7` (`graphite.onLight.120`) |
| `action.secondary.text` | `mauve.onLight.830` `#563f67` | `mauve.onDark.830` `#bab3c0` | `#644a78` (`mauve.onLight.680`) |
| `action.secondary.hoverBackground` | `mauve.onLight.190` `#beabc9` | `mauve.onDark.190` `#514659` | `#ece8f0` (`mauve.onLight.110`) |
| `action.secondary.pressBackground` | `mauve.onLight.220` `#b59ec1` | `mauve.onDark.220` `#5a4f62` | `#ddd5e0` (`graphite.onLight.130`) |
| `action.secondary.hoverText` | `violet.onLight.1300` `#342346` | `violet.onDark.1300` `#e4e0ea` | `#765292` (`violet.onLight.560`) |
| `action.secondary.pressText` | `mauve.onLight.1440` `#291d35` | `mauve.onDark.1440` `#efecf3` | `#563f67` (`mauve.onLight.830`) |
| `action.secondary.adornment` | `mauve.onLight.560` `#725687` | `mauve.onDark.560` `#9a91a2` | `#826396` (`mauve.onLight.460`) |
| `action.secondary.hoverAdornment` | `violet.onLight.1000` `#483260` | `violet.onDark.1000` `#cbc4d5` | `#976dac` (`violet.onLight.370`) |
| `action.tertiary.background` | `shades.black.transparent.0` `#00000000` | `shades.black.transparent.0` `#00000000` | `#ffffff00` (`shades.white.transparent.0`) |
| `action.tertiary.text` | `mauve.onLight.830` `#563f67` | `mauve.onDark.830` `#bab3c0` | `#725687` (`mauve.onLight.560`) |
| `action.tertiary.hoverBackground` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | `#ece8f0` (`mauve.onLight.110`) |
| `action.tertiary.pressBackground` | `graphite.onLight.160` `#cbc0d1` | `graphite.onDark.160` `#433d47` | `#e4dde7` (`graphite.onLight.120`) |
| `action.tertiary.hoverText` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | `#765292` (`violet.onLight.560`) |
| `action.tertiary.pressText` | `mauve.onLight.1300` `#332442` | `mauve.onDark.1300` `#e3e0e8` | `#563f67` (`mauve.onLight.830`) |
| `action.tertiary.adornment` | `mauve.onLight.560` `#725687` | `mauve.onDark.560` `#9a91a2` | `#9272a4` (`mauve.onLight.370`) |
| `action.tertiary.hoverAdornment` | `violet.onLight.830` `#593c70` | `violet.onDark.830` `#bcb2c4` | `#976dac` (`violet.onLight.370`) |
| `action.outlined.background` | `shades.black.transparent.0` `#00000000` | `shades.black.transparent.0` `#00000000` | `#ffffff00` (`shades.white.transparent.0`) |
| `action.outlined.border` | `mauve.onLight.220` `#b59ec1` | `mauve.onDark.220` `#5a4f62` | `#beabc9` (`mauve.onLight.190`) |
| `action.outlined.strongBorder` | `mauve.onLight.680` `#644a78` | `mauve.onDark.680` `#aaa1b2` | `#725687` (`mauve.onLight.560`) |
| `action.outlined.text` | `mauve.onLight.680` `#644a78` | `mauve.onDark.680` `#aaa1b2` |  |
| `action.outlined.hoverBackground` | `graphite.onLight.160` `#cbc0d1` | `graphite.onDark.160` `#433d47` | `#f0edf4` (`mauve.onLight.105`) |
| `action.outlined.pressBackground` | `graphite.onLight.190` `#bcafc4` | `graphite.onDark.190` `#4e4853` | `#ddd5e0` (`graphite.onLight.130`) |
| `action.outlined.hoverBorder` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | `#865fa0` (`violet.onLight.460`) |
| `action.outlined.pressBorder` | `mauve.onLight.1170` `#3b2b4b` | `mauve.onDark.1170` `#d8d5de` | `#563f67` (`mauve.onLight.830`) |
| `action.outlined.hoverText` | `violet.onLight.1300` `#342346` | `violet.onDark.1300` `#e4e0ea` | `#765292` (`violet.onLight.560`) |
| `action.outlined.pressText` | `mauve.onLight.1440` `#291d35` | `mauve.onDark.1440` `#efecf3` | `#463458` (`mauve.onLight.1000`) |
| `action.outlined.adornment` | `mauve.onLight.460` `#826396` | `mauve.onDark.460` `#8b8293` |  |
| `action.textOnly.text` | `mauve.onLight.560` `#725687` | `mauve.onDark.560` `#9a91a2` |  |
| `action.textOnly.focusBackground` | `shades.black.transparent.5` `#0000000d` | `shades.black.transparent.50` `#00000080` | `#ffffff80` (`shades.white.transparent.50`) |
| `action.textOnly.hoverText` | `violet.onLight.830` `#593c70` | `violet.onDark.830` `#bcb2c4` | `#6b438c` (`lilac.onLight.680`) |
| `action.textOnly.pressText` | `lilac.onLight.830` `#5c3878` | `lilac.onDark.830` `#beb1c8` | `#463458` (`mauve.onLight.1000`) |
| `action.textOnly.adornment` | `mauve.onLight.310` `#9e80ae` | `mauve.onDark.310` `#716679` |  |
| `action.textOnly.hoverAdornment` | `violet.onLight.460` `#865fa0` | `violet.onDark.460` `#8e8199` |  |
| `action.disabled.filledBackground` | `shades.black.transparent.10` `#0000001a` | `shades.black.transparent.40` `#00000066` | `#ffffff33` (`shades.white.transparent.20`) |
| `action.disabled.filledText` | `gray.onLight.220` `#ada3b2` | `gray.onDark.contrasts.220` `#545356` | `#b8b1bf` (`gray.onLight.190`) |
| `action.disabled.filledAdornment` | `gray.onLight.160` `#c7c1cc` | `gray.onDark.contrasts.160` `#403f42` | `#d3ced6` (`gray.onLight.140`) |
| `action.disabled.outlineBackground` | `shades.black.transparent.0` `#00000000` | `shades.black.transparent.0` `#00000000` | `#ffffff00` (`shades.white.transparent.0`) |
| `action.disabled.outlineBorder` | `gray.onLight.130` `#dbd6dd` | `gray.onDark.contrasts.130` `#323134` | `#e1dee4` (`gray.onLight.120`) |
| `action.disabled.outlineText` | `gray.onLight.190` `#b8b1bf` | `gray.onDark.contrasts.190` `#4b4a4d` |  |
| `action.disabled.textOnlyText` | `gray.onLight.190` `#b8b1bf` | `gray.onDark.contrasts.190` `#4b4a4d` |  |
| `action.focusRing` | `hotPink.onLight.460 (focus outline)` `#ff00aa` | `hotPink.onDark.460 (focus outline)` `#ff52a8` |  |
| `status.success.main` | `green.onLight.830` `#095330` | `green.onDark.830` `#78c692` | `#0d7f46` (`green.onLight.460`) |
| `status.success.bright` | `green.onLight.1170` `#063a25` | `green.onDark.1170` `#ace4bd` | `#17e074` (`green.onLight.160`) |
| `status.success.muted` | `green.onLight.310` `#10a055` | `green.onDark.310` `#217846` | `#b8f8d5` (`green.onLight.110`) |
| `status.success.filledBackground` | `green.onLight.560` `#0c703e` | `green.onDark.560` `#4fa66f` |  |
| `status.success.filledText` | `green.onLight.50` `#f3fef8` | `green.onDark.50` `#001607` |  |
| `status.success.filledAdornment` | `green.onLight.50` `#f3fef8` | `green.onDark.50` `#001607` |  |
| `status.success.filledHoverBackground` | `green.onLight.680` `#0a6238` | `green.onDark.680` `#61b67f` | `#10a055` (`green.onLight.310`) |
| `status.success.filledPressBackground` | `green.onLight.830` `#095330` | `green.onDark.830` `#78c692` | `#13bf63` (`green.onLight.220`) |
| `status.success.outlineStrongBorder` | `green.onLight.830` `#095330` | `green.onDark.830` `#78c692` | `#0c703e` (`green.onLight.560`) |
| `status.success.outlineText` | `green.onLight.1000` `#07452a` | `green.onDark.1000` `#92d6a8` | `#0c703e` (`green.onLight.560`) |
| `status.error.main` | `red.onLight.460` `#d22f11` | `red.onDark.460` `#c16e6c` | `#ba2a0f` (`red.onLight.560`) |
| `status.error.bright` | `red.onLight.830` `#8b1f0b` | `red.onDark.830` `#e3a6a6` | `#ed371d` (`red.onLight.370`) |
| `status.error.muted` | `red.onLight.190` `#f69c8f` | `red.onDark.190` `#832d28` |  |
| `status.error.filledBackground` | `red.onLight.460` `#d22f11` | `red.onDark.460` `#c16e6c` | `#a3240d` (`red.onLight.680`) |
| `status.error.filledText` | `red.onLight.50` `#fffaf9` | `red.onDark.50` `#2e0000` |  |
| `status.error.filledAdornment` | `red.onLight.50` `#fffaf9` | `red.onDark.50` `#2e0000` |  |
| `status.error.filledHoverBackground` | `red.onLight.680` `#a3240d` | `red.onDark.680` `#d89291` | `#d22f11` (`red.onLight.460`) |
| `status.error.filledPressBackground` | `red.onLight.830` `#8b1f0b` | `red.onDark.830` `#e3a6a6` | `#ed371d` (`red.onLight.370`) |
| `status.error.outlineStrongBorder` | `red.onLight.560` `#ba2a0f` | `red.onDark.560` `#cc7f7d` | `#a3240d` (`red.onLight.680`) |
| `status.error.outlineText` | `red.onLight.560` `#ba2a0f` | `red.onDark.560` `#cc7f7d` | `#a3240d` (`red.onLight.680`) |
| `status.warning.main` | `yellow.onLight.830` `#693f01` | `yellow.onDark.830` `#f9a308` | `#9c6201` (`yellow.onLight.460`) |
| `status.warning.bright` | `yellow.onLight.1300` `#402400` | `yellow.onDark.1300` `#fddf91` | `#ffb61f` (`yellow.onLight.160`) |
| `status.warning.muted` | `yellow.onLight.310` `#c07d00` | `yellow.onDark.310` `#995b04` | `#ffdd89` (`yellow.onLight.120`) |
| `status.warning.filledBackground` | `yellow.onLight.680` `#7a4a00` | `yellow.onDark.680` `#e59306` | `#ffdd89` (`yellow.onLight.120`) |
| `status.warning.filledText` | `yellow.onLight.50` `#fffbf1` | `yellow.onDark.50` `#1d0f01` | `#693f01` (`yellow.onLight.830`) |
| `status.warning.filledAdornment` | `yellow.onLight.50` `#fffbf1` | `yellow.onDark.50` `#1d0f01` | `#8a5601` (`yellow.onLight.560`) |
| `status.warning.filledHoverBackground` | `yellow.onLight.830` `#693f01` | `yellow.onDark.830` `#f9a308` | `#ffe9ae` (`yellow.onLight.110`) |
| `status.warning.filledPressBackground` | `yellow.onLight.1000` `#583400` | `yellow.onDark.1000` `#fbbc3b` | `#ffc84d` (`yellow.onLight.140`) |
| `status.warning.outlineStrongBorder` | `yellow.onLight.830` `#693f01` | `yellow.onDark.830` `#f9a308` | `#9c6201` (`yellow.onLight.460`) |
| `status.warning.outlineText` | `yellow.onLight.1000` `#583400` | `yellow.onDark.1000` `#fbbc3b` | `#7a4a00` (`yellow.onLight.680`) |
| `status.info.main` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | `#2f5dba` (`blue.onLight.560`) |
| `status.info.bright` | `blue.onLight.1000` `#1c3a75` | `blue.onDark.1000` `#b7c9eb` | `#89a6e1` (`blue.onLight.220`) |
| `status.info.muted` | `blue.onLight.310` `#638ad9` | `blue.onDark.310` `#3766c4` | `#cbd9f1` (`blue.onLight.130`) |
| `status.info.filledBackground` | `blue.onLight.460` `#3a6acb` | `blue.onDark.460` `#6086d2` | `#2f5dba` (`blue.onLight.560`) |
| `status.info.filledText` | `blue.onLight.50` `#f7f7fa` | `blue.onDark.50` `#0a1324` |  |
| `status.info.filledAdornment` | `blue.onLight.140` `#bed0ee` | `blue.onDark.140` `#1d3566` | `#f7f7fa` (`blue.onLight.50`) |
| `status.info.filledHoverBackground` | `blue.onLight.560` `#2f5dba` | `blue.onDark.560` `#7495d8` | `#507bd3` (`blue.onLight.370`) |
| `status.info.filledPressBackground` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | `#638ad9` (`blue.onLight.310`) |
| `status.info.outlineStrongBorder` | `blue.onLight.830` `#22458c` | `blue.onDark.830` `#a0b6e4` | `#2f5dba` (`blue.onLight.560`) |
| `status.info.outlineText` | `blue.onLight.1000` `#1c3a75` | `blue.onDark.1000` `#b7c9eb` | `#2f5dba` (`blue.onLight.560`) |
| `status.neutral.main` | `gray.onLight.560` `#685d72` | `gray.onDark.contrasts.560` `#959497` |  |
| `status.neutral.bright` | `gray.onLight.1000` `#3a3343` | `gray.onDark.contrasts.1000` `#c8c7ca` | `#ada3b2` (`gray.onLight.220`) |
| `status.neutral.muted` | `gray.onLight.310` `#92879a` | `gray.onDark.contrasts.310` `#6a696c` | `#d3ced6` (`gray.onLight.140`) |
| `status.neutral.filledBackground` | `gray.onLight.120` `#e1dee4` | `gray.onDark.contrasts.120` `#2c2b2e` |  |
| `status.neutral.filledText` | `gray.onLight.1000` `#3a3343` | `gray.onDark.contrasts.1000` `#c8c7ca` | `#4e4556` (`gray.onLight.830`) |
| `status.neutral.filledAdornment` | `gray.onLight.830` `#4e4556` | `gray.onDark.contrasts.830` `#b6b5b8` | `#5c5164` (`gray.onLight.680`) |
| `status.neutral.filledHoverBackground` | `gray.onLight.190` `#b8b1bf` | `gray.onDark.contrasts.190` `#4b4a4d` | `#eae8ec` (`gray.onLight.110`) |
| `status.neutral.filledPressBackground` | `gray.onLight.220` `#ada3b2` | `gray.onDark.contrasts.220` `#545356` | `#c7c1cc` (`gray.onLight.160`) |
| `status.neutral.outlineStrongBorder` | `gray.onLight.830` `#4e4556` | `gray.onDark.contrasts.830` `#b6b5b8` | `#766a80` (`gray.onLight.460`) |
| `status.neutral.outlineText` | `gray.onLight.1000` `#3a3343` | `gray.onDark.contrasts.1000` `#c8c7ca` | `#5c5164` (`gray.onLight.680`) |
| `accent.lemon.fill` | `lemon.onLight.560` `#735e01` | `lemon.onDark.560` `#9e9813` |  |
| `accent.lemon.text` | `lemon.onLight.1000` `#473a01` | `lemon.onDark.1000` `#d6ce1a` | `#574601` (`lemon.onLight.830`) |
| `accent.graphite.fill` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` |  |
| `accent.graphite.text` | `graphite.onLight.1000` `#433751` | `graphite.onDark.1000` `#cac6ce` | `#52425f` (`graphite.onLight.830`) |
| `accent.pink.fill` | `pink.onLight.560` `#994c4c` | `pink.onDark.560` `#c2867a` |  |
| `accent.pink.text` | `pink.onLight.1000` `#5c2e2e` | `pink.onDark.1000` `#e1c3bd` | `#703838` (`pink.onLight.830`) |
| `accent.saffron.fill` | `saffron.onLight.560` `#914f20` | `saffron.onDark.560` `#cb8553` |  |
| `accent.saffron.text` | `saffron.onLight.1000` `#593114` | `saffron.onDark.1000` `#e5c2a9` | `#6b3a18` (`saffron.onLight.830`) |
| `accent.lime.fill` | `lime.onLight.560` `#546918` | `lime.onDark.560` `#84a138` |  |
| `accent.lime.text` | `lime.onLight.1000` `#33400e` | `lime.onDark.1000` `#b0d54e` | `#3e4d11` (`lime.onLight.830`) |
| `accent.blue.fill` | `blue.onLight.680` `#2850a1` | `blue.onDark.680` `#8ca7de` | `#2f5dba` (`blue.onLight.560`) |
| `accent.blue.text` | `blue.onLight.1000` `#1c3a75` | `blue.onDark.1000` `#b7c9eb` | `#22458c` (`blue.onLight.830`) |
| `accent.azure.fill` | `azure.onLight.560` `#1b6b6b` | `azure.onDark.560` `#29a6a6` |  |
| `accent.azure.text` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | `#144f4f` (`azure.onLight.830`) |
| `accent.lilac.fill` | `lilac.onLight.560` `#7a4e9b` | `lilac.onDark.560` `#9f8ead` | (no export var) |
| `accent.lilac.text` | `lilac.onLight.1000` `#4a3067` | `lilac.onDark.1000` `#cdc4d8` | (no export var) |
| `component.table.cellBackground` | `gray.onLight.100` `#f6f4f7` | `gray.onDark.contrasts.100` `#1d1c1f` | `#ffffff` (`shades.white`) |
| `component.table.cellBackgroundAlt` | `gray.onLight.130` `#dbd6dd` | `gray.onDark.contrasts.130` `#323134` | `#f6f4f7` (`gray.onLight.100`) |
| `component.table.cellHoverBackground` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | `#ebe9ee` (`graphite.onLight.110`) |
| `component.table.cellActiveBackground` | `graphite.onLight.190` `#bcafc4` | `graphite.onDark.190` `#4e4853` | `#e4dde7` (`graphite.onLight.120`) |
| `component.table.headerBackground` | `graphite.onLight.160` `#cbc0d1` | `graphite.onDark.160` `#433d47` | `#d5cddb` (`graphite.onLight.140`) |
| `component.table.footer` | `graphite.onLight.110` `#ebe9ee` | `graphite.onDark.110` `#28232c` |  |
| `component.topNav.solidBackground` | `shades.black` `#000000` | `shades.black` `#000000` | `#ffffff` (`shades.white`) |
| `component.topNav.contrastText` | `shades.white.transparent.50` `#ffffff80` | `shades.white.transparent.50` `#ffffff80` | `#00000080` (`shades.black.transparent.50`) |
| `component.topNav.adornment` | `lilac.onLight.460` `#8b5ba9` | `lilac.onDark.460` `#90809e` |  |
| `component.input.filled.background` | `graphite.onLight.110` `#ebe9ee` | `graphite.onDark.110` `#28232c` | `#f0eef3` (`graphite.onLight.105`) |
| `component.input.filled.contrastText` | `mauve.onLight.680` `#644a78` | `mauve.onDark.680` `#aaa1b2` |  |
| `component.input.filled.hoverBackground` | `graphite.onLight.120` `#e4dde7` | `graphite.onDark.120` `#342f39` | `#f6f3f8` (`graphite.onLight.100`) |
| `component.input.filled.pressBackground` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | `#e4dde7` (`graphite.onLight.120`) |
| `component.input.filled.adornment` | `mauve.onLight.460` `#826396` | `mauve.onDark.460` `#8b8293` | `#9272a4` (`mauve.onLight.370`) |
| `component.input.filled.valueText` | `graphite.onLight.1570` `#21172a` | `graphite.onDark.1570` `#f7f6f8` |  |
| `component.input.filled.placeholderText` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` |  |
| `component.input.outlined.background` | `shades.black.transparent.0` `#00000000` | `shades.black.transparent.0` `#00000000` | `#ffffff00` (`shades.white.transparent.0`) |
| `component.input.outlined.border` | `graphite.onLight.220` `#b2a1bb` | `graphite.onDark.220` `#57515c` | `#9884a4` (`graphite.onLight.310`) |
| `component.input.outlined.contrastText` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | `#604e6e` (`graphite.onLight.680`) |
| `component.input.outlined.valueText` | `graphite.onLight.1570` `#21172a` | `graphite.onDark.1570` `#f7f6f8` |  |
| `component.input.outlined.placeholderText` | `graphite.onLight.460` `#7b668b` | `graphite.onDark.460` `#89848e` |  |
| `component.input.outlined.adornment` | `mauve.onLight.460` `#826396` | `mauve.onDark.460` `#8b8293` | `#9e80ae` (`mauve.onLight.310`) |
| `component.input.outlined.activeBackground` | `graphite.onLight.100` `#f6f3f8` | `graphite.onDark.100` `#1e1922` |  |
| `component.input.outlined.hoverBorder` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | `#6d5a7d` (`graphite.onLight.560`) **export dark `#a7a2ac`** |
| `component.input.outlined.pressBorder` | `mauve.onLight.1300` `#332442` | `mauve.onDark.1300` `#e3e0e8` | `#52425f` (`graphite.onLight.830`) **export dark `#b8b4bc`** |
| `component.input.outlined.hoverContrastText` | `graphite.onLight.680` `#604e6e` | `graphite.onDark.680` `#a7a2ac` | `#644a78` (`mauve.onLight.680`) **export dark `#cac5d2`** |
| `component.input.textOnly.contrastText` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | `#604e6e` (`graphite.onLight.680`) |
| `component.input.textOnly.valueText` | `graphite.onLight.1570` `#21172a` | `graphite.onDark.1570` `#f7f6f8` |  |
| `component.input.textOnly.placeholderText` | `graphite.onLight.460` `#7b668b` | `graphite.onDark.460` `#89848e` |  |
| `component.input.textOnly.adornment` | `mauve.onLight.460` `#826396` | `mauve.onDark.460` `#8b8293` | `#9e80ae` (`mauve.onLight.310`) |
| `component.input.textOnly.focusBackground` | `graphite.onLight.100` `#f6f3f8` | `graphite.onDark.100` `#1e1922` | `#e7e3eb` (`graphite.onLight.115`) |
| `component.avatar.fill` | `pink.onLight.560` `#994c4c` | `pink.onDark.560` `#c2867a` |  |
| `component.avatar.contrastText` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` |  |
| `component.avatar.disabledFill` | `gray.onLight.220` `#ada3b2` | `gray.onDark.contrasts.220` `#545356` | `#b8b1bf` (`gray.onLight.190`) |
| `component.badge.contrastText` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` | `#21172a` (`graphite.onLight.1570`) |
| `component.tab.restText` | `graphite.onLight.560` `#6d5a7d` | `graphite.onDark.560` `#98939d` | (no export var) |
| `component.tab.selectedText` | `mauve.onLight.1570` `#22162f` | `mauve.onDark.1570` `#f7f6f8` | (no export var) |
| `component.tab.filledSelected` | `mauve.onLight.310` `#9e80ae` | `mauve.onDark.310` `#716679` | (no export var) |
| `component.tab.stripBackground` | `gray.onLight.120` `#e1dee4` | `gray.onDark.contrasts.120` `#2c2b2e` | (no export var) |
| `component.checkbox.border` | `mauve.onLight.830` `#563f67` | `mauve.onDark.830` `#bab3c0` | (no export var) |
| `component.checkbox.hoverBorder` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | (no export var) |
| `component.checkbox.checkedFill` | `mauve.onLight.1300` `#332442` | `mauve.onDark.1300` `#e3e0e8` | (no export var) |
| `component.checkbox.indeterminateFill` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | (no export var) |
| `component.checkbox.halo` | `graphite.onLight.140` `#d5cddb` | `graphite.onDark.140` `#3a343e` | (no export var) |
| `component.checkbox.glyph` | `gray.onLight.50` `#fafafb` | `gray.onDark.contrasts.50` `#131214` | (no export var) |
| `component.checkbox.disabledBorder` | `gray.onLight.190` `#b8b1bf` | `gray.onDark.contrasts.190` `#4b4a4d` | (no export var) |
| `component.switch.offBorder` | `mauve.onLight.680` `#644a78` | `mauve.onDark.680` `#aaa1b2` | (no export var) |
| `component.switch.offThumb` | `mauve.onLight.680` `#644a78` | `mauve.onDark.680` `#aaa1b2` | (no export var) |
| `component.switch.onTrack` | `violet.onLight.370` `#976dac` | `violet.onDark.370` `#80708b` | (no export var) |
| `component.switch.onThumb` | `lilac.onLight.1300` `#35214b` | `lilac.onDark.1300` `#e5e0eb` | (no export var) |
| `component.switch.disabledBorder` | `gray.onLight.190` `#b8b1bf` | `gray.onDark.contrasts.190` `#4b4a4d` | (no export var) |
| `component.switch.disabledTrack` | `graphite.onLight.220` `#b2a1bb` | `graphite.onDark.220` `#57515c` | (no export var) |
| `component.toggleButton.activatedFill` | `graphite.onLight.190` `#bcafc4` | `graphite.onDark.190` `#4e4853` | (no export var) |
| `component.toggleButton.activatedHoverFill` | `graphite.onLight.220` `#b2a1bb` | `graphite.onDark.220` `#57515c` | (no export var) |
| `component.toggleButton.activatedPressFill` | `graphite.onLight.260` `#a592b0` | `graphite.onDark.260` `#625c67` | (no export var) |
| `component.toggleButton.activatedText` | `mauve.onLight.1000` `#463458` | `mauve.onDark.1000` `#cac5d2` | (no export var) |
| `component.progress.primary` | `graphite.onLight.830` `#52425f` | `graphite.onDark.830` `#b8b4bc` | (no export var) |
| `component.progress.secondary` | `azure.onLight.1000` `#114242` | `azure.onDark.1000` `#68d9d9` | (no export var) |
| `component.progress.tertiary` | `lime.onLight.1000` `#33400e` | `lime.onDark.1000` `#b0d54e` | (no export var) |
| `component.progress.track` | `graphite.onLight.310` `#9884a4` | `graphite.onDark.310` `#6e6873` | (no export var) |
| `component.chip.defaultFill` | `gray.onLight.120` `#e1dee4` | `gray.onDark.contrasts.120` `#2c2b2e` | (no export var) |
| `component.chip.defaultText` | `gray.onLight.1000` `#3a3343` | `gray.onDark.contrasts.1000` `#c8c7ca` | (no export var) |
| `component.chip.disabledFill` | `gray.onLight.120` `#e1dee4` | `gray.onDark.contrasts.120` `#2c2b2e` | (no export var) |
| `component.chip.disabledText` | `gray.onLight.220` `#ada3b2` | `gray.onDark.contrasts.220` `#545356` | (no export var) |

## Appendix B — Non-colour upstream tokens

| Upstream token | Upstream default | Tecton value | Source | Notes |
|---|---|---|---|---|
| `--color-border` | `light-dark(#05365919, #F2F4F619)` | `light-dark(#e4dde7, #342f39)` | tecton-astryx | Divider subtle - the default Astryx border maps to Tecton's LOW emphasis rule. |
| `--color-border-emphasized` | `light-dark(#CCD3DB, #494D53)` | `light-dark(#b2a1bb, #57515c)` | tecton-astryx | Divider medium. 2.2:1 on body - fails 1.4.11 (inherited from the design, pinned by test). Use divider-strong where a boundary must be perceived. |
| `--focus-outline-color` | `var(--color-accent)` | `light-dark(#ff00aa, #ff52a8)` | tecton-astryx | The only role named in the raw token file ("460 (focus outline)"). Every control but Tab draws it. Re-pointed to the on-colour ink inside Banner severity fills (1.0-2.5:1 there). Light #ff00aa is 3.29:1 on body but 2.48:1 on inverted/near-white surfaces (Toast, light media scrim) - recorded deviation, no second focus hue exists. |
| `--focus-outline-width` | `2px` | `2px` | tecton-astryx | Measured on the button matrix. |
| `--focus-outline-style` | `solid` | `solid` | tecton-astryx |  |
| `--focus-outline-offset` | `3px` | `2px` | tecton-astryx | Upstream 3px. Buttons tighten to 1px via --button-focus-offset ("~1px outside the edge with ~1px gap"). |
| `--radius-none` | `0px` | `0px` | tecton-astryx | radius.0 |
| `--radius-inner` | `4px` | `2px` | tecton-astryx | radius.25 - dense controls (checkbox, menu row, kbd, select option row) |
| `--radius-element` | `8px` | `4px` | tecton-astryx | radius.50 - "default Tecton corner" (button, field, chip-like, code block, banner card, menu panel) |
| `--radius-container` | `12px` | `8px` | tecton-astryx | radius.100 - panels, cards, dialog, popover |
| `--radius-chat` | `28px` | `12px` | tecton-astryx | radius.150 - carried here for want of a slot (name drift) |
| `--radius-page` | `28px` | `16px` | tecton-astryx | radius.200 - carried here for want of a slot (name drift) |
| `--radius-full` | `9999px` | `9999px` | tecton-astryx | radius.round is 1000px in the source; 9999px equivalent in practice |
| `--spacing-0` | `0px` | `0px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-0-5` | `2px` | `2px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-1` | `4px` | `4px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-1-5` | `6px` | `6px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-2` | `8px` | `8px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-3` | `12px` | `12px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-4` | `16px` | `16px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-5` | `20px` | `20px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-6` | `24px` | `24px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-7` | `28px` | `28px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-8` | `32px` | `32px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-9` | `36px` | `36px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-10` | `40px` | `40px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-11` | `44px` | `44px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--spacing-12` | `48px` | `48px` | upstream-default | Kept. Tecton space.* is the same 4px grid (space.25=2px -> --spacing-0-5, space.75=6px -> --spacing-1-5). Tecton adds 56-144px steps Astryx lacks; not needed by components. |
| `--size-element-sm` | `28px` | `28px` | tecton-astryx | Tecton Button/TextField size = upstream value (agreement, not override). |
| `--size-element-md` | `32px` | `32px` | tecton-astryx | Tecton Button/TextField size = upstream value (agreement, not override). |
| `--size-element-lg` | `36px` | `36px` | tecton-astryx | No Tecton source; upstream 36px kept. |
| `--border-width` | `1px` | `1px` | tecton-astryx | Every Tecton border and divider is 1px. |
| `--duration-fast-min` | `130ms` | `130ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-fast` | `175ms` | `175ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-fast-max` | `230ms` | `230ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-medium-min` | `310ms` | `310ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-medium` | `410ms` | `410ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-medium-max` | `550ms` | `550ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-slow-min` | `730ms` | `730ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-slow` | `975ms` | `975ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--duration-slow-max` | `1300ms` | `1300ms` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--ease-standard` | `cubic-bezier(0.24, 1, 0.4, 1)` | `cubic-bezier(0.24, 1, 0.4, 1)` | upstream-default | No Tecton motion source; upstream kept (fidelity report: "Motion - not assessed"). |
| `--font-family-body` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | `Figtree, Helvetica, Arial, sans-serif` | tecton-astryx | Figtree stack as printed on the Tecton typography page. |
| `--font-family-heading` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | `Figtree, Helvetica, Arial, sans-serif` | tecton-astryx | Heading family = body family; heading weight 500. |
| `--font-family-code` | `"SF Mono", Monaco, Consolas, monospace` | `"IBM Plex Mono", Consolas, Monaco, monospace` | tecton-astryx | Also used for the Tecton data variants (tabular numerals). |
| `--font-size-4xs` | `0.375rem` | `0.375rem` | upstream-default | No Tecton equivalent; upstream kept, unreferenced by Tecton. |
| `--font-size-3xs` | `0.4375rem` | `0.4375rem` | upstream-default | No Tecton equivalent; upstream kept. |
| `--font-size-2xs` | `0.5rem` | `0.5rem` | upstream-default | No Tecton equivalent; upstream kept. |
| `--font-size-xs` | `0.625rem` | `0.625rem` | tecton-astryx | 10px tiny |
| `--font-size-sm` | `0.75rem` | `0.75rem` | tecton-astryx | 12px small |
| `--font-size-base` | `0.875rem` | `0.875rem` | tecton-astryx | 14px medium/body |
| `--font-size-lg` | `1.0625rem` | `1rem` | tecton-astryx | 16px large (upstream 17px) |
| `--font-size-xl` | `1.25rem` | `1.25rem` | tecton-astryx | 20px heading2 |
| `--font-size-2xl` | `1.5rem` | `1.5rem` | tecton-astryx | 24px heading1 |
| `--font-size-3xl` | `1.8125rem` | `2rem` | tecton-astryx | 32px display3 (upstream 29px) |
| `--font-size-4xl` | `2.1875rem` | `2.5rem` | tecton-astryx | 40px display2 (upstream 35px) |
| `--font-size-5xl` | `2.625rem` | `3rem` | tecton-astryx | 48px display1 (upstream 42px) |
| `--font-weight-normal` | `400` | `400` | tecton-astryx |  |
| `--font-weight-medium` | `500` | `500` | tecton-astryx |  |
| `--font-weight-semibold` | `600` | `500` | tecton-astryx | Tecton has no 600; semibold collapses to medium (visible: weight="semibold" == "medium"). |
| `--font-weight-bold` | `700` | `600` | tecton-astryx | Not a Tecton weight; kept at 600 so prose <strong> differs. Needs a 600 face loaded. |
| `--text-heading-1-size` | `var(--font-size-2xl)` | `var(--font-size-2xl)` | tecton-astryx | Tecton variant "heading1". |
| `--text-heading-1-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "heading1". |
| `--text-heading-1-leading` | `1.3333` | `1.25` | tecton-astryx | Tecton variant "heading1". |
| `--text-heading-2-size` | `var(--font-size-xl)` | `var(--font-size-xl)` | tecton-astryx | Tecton variant "heading2". |
| `--text-heading-2-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "heading2". |
| `--text-heading-2-leading` | `1.4` | `1.2` | tecton-astryx | Tecton variant "heading2". |
| `--text-heading-3-size` | `var(--font-size-lg)` | `var(--font-size-lg)` | tecton-astryx | Tecton variant "large". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-3-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "large". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-3-leading` | `1.4118` | `1.25` | tecton-astryx | Tecton variant "large". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-4-size` | `var(--font-size-base)` | `var(--font-size-base)` | tecton-astryx | Tecton variant "mediumStrong". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-4-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "mediumStrong". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-4-leading` | `1.4286` | `1.2857142857142858` | tecton-astryx | Tecton variant "mediumStrong". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-5-size` | `var(--font-size-sm)` | `var(--font-size-sm)` | tecton-astryx | Tecton variant "smallStrong". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-5-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "smallStrong". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-5-leading` | `1.6667` | `1.3333333333333333` | tecton-astryx | Tecton variant "smallStrong". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-6-size` | `var(--font-size-xs)` | `var(--font-size-xs)` | tecton-astryx | Tecton variant "tiny". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-6-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "tiny". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-heading-6-leading` | `1.6` | `1.4` | tecton-astryx | Tecton variant "tiny". Headings 3-6 are extrapolated (Tecton names 2 heading levels). |
| `--text-body-size` | `var(--font-size-base)` | `var(--font-size-base)` | tecton-astryx | Tecton variant "medium". |
| `--text-body-weight` | `var(--font-weight-normal)` | `var(--font-weight-normal)` | tecton-astryx | Tecton variant "medium". |
| `--text-body-leading` | `1.4286` | `1.2857142857142858` | tecton-astryx | Tecton variant "medium". |
| `--text-large-size` | `var(--font-size-lg)` | `var(--font-size-lg)` | tecton-astryx | Tecton variant "large". |
| `--text-large-weight` | `var(--font-weight-semibold)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "large". |
| `--text-large-leading` | `1.4118` | `1.25` | tecton-astryx | Tecton variant "large". |
| `--text-label-size` | `var(--font-size-base)` | `var(--font-size-base)` | tecton-astryx | Tecton variant "mediumStrong". |
| `--text-label-weight` | `var(--font-weight-medium)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "mediumStrong". |
| `--text-label-leading` | `1.4286` | `1.2857142857142858` | tecton-astryx | Tecton variant "mediumStrong". |
| `--text-code-size` | `var(--font-size-base)` | `var(--font-size-base)` | tecton-astryx | Tecton variant "mediumData". |
| `--text-code-weight` | `var(--font-weight-normal)` | `var(--font-weight-normal)` | tecton-astryx | Tecton variant "mediumData". |
| `--text-code-leading` | `1.4286` | `1.2857142857142858` | tecton-astryx | Tecton variant "mediumData". |
| `--text-supporting-size` | `var(--font-size-sm)` | `var(--font-size-sm)` | tecton-astryx | Tecton variant "small". |
| `--text-supporting-weight` | `var(--font-weight-normal)` | `var(--font-weight-normal)` | tecton-astryx | Tecton variant "small". |
| `--text-supporting-leading` | `1.6667` | `1.3333333333333333` | tecton-astryx | Tecton variant "small". |
| `--text-display-1-size` | `var(--font-size-5xl)` | `var(--font-size-5xl)` | tecton-astryx | Tecton variant "display1". |
| `--text-display-1-weight` | `var(--font-weight-normal)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "display1". |
| `--text-display-1-leading` | `1.2381` | `1.2083333333333333` | tecton-astryx | Tecton variant "display1". |
| `--text-display-2-size` | `var(--font-size-4xl)` | `var(--font-size-4xl)` | tecton-astryx | Tecton variant "display2". |
| `--text-display-2-weight` | `var(--font-weight-normal)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "display2". |
| `--text-display-2-leading` | `1.2571` | `1.2` | tecton-astryx | Tecton variant "display2". |
| `--text-display-3-size` | `var(--font-size-3xl)` | `var(--font-size-3xl)` | tecton-astryx | Tecton variant "display3". |
| `--text-display-3-weight` | `var(--font-weight-normal)` | `var(--font-weight-medium)` | tecton-astryx | Tecton variant "display3". |
| `--text-display-3-leading` | `1.2414` | `1.1875` | tecton-astryx | Tecton variant "display3". |

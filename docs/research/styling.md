# Styling research: how the Web Components should handle styles

**Status:** research (no implementation). Written 2026-09-29 for the plan in
`docs/plan/IMPLEMENTATION-PLAN.md` §5–6.
**Question:** how should Lit + TypeScript custom elements (mostly open shadow DOM) be styled and
themed so that they keep Astryx geometry and behavior but use the Tecton visual system (Figtree,
IBM Plex Mono, colors from `tecton.tokens.json`, Tecton radii)?
**Browser policy (from the brief):** Baseline *Widely available* features need no fallback.
*Newly available* and non-Baseline features follow the guide's fallback, or are feature-detected
and degrade gracefully. Baseline dates below come from the modern-web-guidance guides unless marked
"(MDN/web-features)". Those are my reading of external data and should be re-checked when the
code is written.

Semantic color assignment (which Tecton stop fills which role) is **not** decided here. See the
parallel research in `docs/research/tecton-theme.md` / `tecton-semantic-map.json`. This document
decides how those values reach components.

---

## 0. Summary

Keep Astryx's unprefixed token names as the public semantic API. Add Tecton-only roles as
`--tecton-*` and component internals as `--_<component>-*`. Resolve the Tecton palette at build
time. Ship one document-level `tokens.css` whose custom properties inherit into every shadow
root; it uses `color-scheme` + `light-dark()` with a generated fallback. Author component CSS as
`.css` files compiled into Lit `css` modules, with lint and fallback injection. Keep a small public
API: tokens, attributes, one `::part` per Astryx target, read-only `:state()`, and admitted
variables. Put shared modules in charge of focus, forced colors, motion and RTL. Self-host fonts
with metric-matched fallbacks. Give light-DOM components layered, tag-scoped sheets. The numbered
decisions with Baseline status are in §16.

---

## 1. Constraints we inherit

### 1.1 Platform facts about styling across shadow roots

| Fact | Consequence | Source |
| --- | --- | --- |
| Inherited properties (`color`, `font-*`, **all custom properties**) cross the shadow boundary. | Custom properties are the theming channel. | `styling-web-components` |
| A custom property **declared on `:host`** can only be overridden by rules that target that host element. | Never seed public tokens on `:host`. Read them with `var(--x, fallback)` or through a private alias. | `styling-web-components` |
| Rules from the outer (page) context that target the host beat `:host` rules. | `:host` rules are defaults. Box styles on `:host` get wiped by app resets. | Lit styles docs; owner's `CONVENTIONS.md` §5 |
| `::slotted()` reaches only top-level assigned nodes and loses to light-DOM rules. | Use it only for small adjustments (icon size, margins). | `styling-web-components` |
| `@layer` inside a shadow root is scoped to that root. | A component can order its own rules without coordinating with the page. | `styling-web-components` |
| `:host-context()` is Chromium-only; Firefox and Safari declined it. | Don't use it. Theme through inherited properties. | `styling-web-components` |
| `@property` inside a shadow root is **ignored in all engines** (CSSWG #10541). | Any registered property must be declared at document level. | Chrome "Author-defined CSS names and shadow DOM"; owner's `RESEARCH.md` |
| `@font-face` in a shadow root does not work in Chromium (crbug 41085401). | Fonts ship in a document stylesheet. | Chrome CSS-names article |
| `@keyframes` can only be referenced from the tree that defines them (in practice). | Shared keyframes are included in each shadow root's styles. | Chrome CSS-names article |
| Form controls don't inherit `font`. | Every shadow root resets `button, input, select, textarea { font: inherit; color: inherit }`. | `styling-web-components` |
| `light-dark()` resolves at computed-value time; inherited `<color>` properties carry only the resolved color. | Tokens stay unregistered. Re-specify `color`/`accent-color` wherever `color-scheme` changes. | `component-specific-light-dark-theme` |

### 1.2 What Astryx already defines (keep compatible)

Upstream (`/home/user/refs/astryx`, `packages/core/src/theme/tokens.stylex.ts`, "INV1: defineVars
declarations are canonical") has these token families:

| Family | Count | Examples | Tecton binding (owner's `tectonTheme.ts`) |
| --- | --- | --- | --- |
| color | 79 | `--color-accent`, `--color-on-accent`, `--color-neutral`, `--color-background-{body,surface,card,popover,muted,inverted}`, `--color-text-{primary,secondary,disabled,accent}`, `--color-icon-*`, `--color-{success,warning,error}[-muted]`, `--color-on-*`, `--color-border[-emphasized]`, `--color-overlay[-hover,-pressed]`, `--color-skeleton`, `--color-track`, `--color-shadow`, `--color-tint-hover`, 10 hue families × `{background,border,icon,text}` | all 79 set as `[light, dark]` pairs |
| spacing | 15 | `--spacing-0` … `--spacing-12` (px, 4px grid) | unchanged |
| size | 3 | `--size-element-{sm,md,lg}` = 28/32/36px | Tecton names sm 28, md 32 |
| border | 1 | `--border-width` | 1px |
| focus | 4 | `--focus-outline-{width,style,color,offset}` | 2px solid hot pink, offset 2px |
| radius | 7 | `--radius-{none,inner,element,container,page,chat,full}` | 0/2/4/8/16/12/9999px |
| shadow | 8 | `--shadow-{low,med,high}`, `--shadow-inset-{hover,selected,success,warning,error}` | soft drops; inset rings |
| motion | 10 | `--duration-{fast,medium,slow}[-min,-max]`, `--ease-standard` | unchanged |
| font family | 3 | `--font-family-{body,heading,code}` | Figtree / Figtree / IBM Plex Mono |
| font size / weight | 16 | `--font-size-{4xs…5xl}`, `--font-weight-{normal,medium,semibold,bold}` | Tecton 10–48px ladder; semibold → 500, bold → 600 |
| type scale | 42 | `--text-{heading-1…6,body,large,label,code,supporting,display-1…3}-{size,weight,leading}` | mapped to Tecton text variants (`typography.ts`) |
| domain: data viz / syntax | 56 / 14 | `--color-data-*`, `--color-syntax-*` | per `tecton-theme.md` |

Astryx conventions this port should keep:

- **Private component variables** with a leading underscore (`--_button-radius`, `--_card-ring`,
  `--_dropdown-menu-radius`: 25+ distinct names in core).
- A few **public component variables** that are listed in each component's `.doc.mjs`
  `theming.vars`. Button has `--button-focus-offset` and `--button-icon-only-aspect`.
- **Theming targets** (`astryx-button`, `selector-popup`, `checkbox-indicator`, …). The
  architecture record `component-theming-surface.md` says that a target "paints", that anatomy does
  not automatically become a target, and that new public variables must be "admitted, not
  inferred". These rules map directly onto a `::part()` policy (§6).
- **One focus ring for the whole system**, drawn from `utils/focusOutline.stylex.ts`. It is written
  as longhands so a variant can recolor it. `:focus-visible` is part of the ring and a theme cannot
  change it.
- **Color scheme through `color-scheme` + `light-dark()`.** `reset.css` maps `html[data-theme=light|dark]`
  to `color-scheme`, and a missing attribute means `light dark` (follow the system).

### 1.3 Lessons from the owner's earlier projects

- **`tecton-webcomponents`** (`CONVENTIONS.md` §5, `RESEARCH.md`,
  `REVIEW-modern-web-guidance.md`):
  - Put no box styles on `:host`; Tailwind preflight removes them. Use host attributes for
    variants, `:state()` for read-only states, and `hostStyles`/`focusRing()`/`motionSafe()`/
    `forcedColors()` shared modules.
  - Review findings to fix this time:
    - H4: the theme was light-only and ignored the system preference.
    - H5: a pinned theme island had no background, which gave about 1:1 contrast.
    - M7: `:state()` was used without feature detection.
    - M13: `light-dark()` and relative colors were used without fallbacks.
    - M18: scrollbar styling had no fallback or `prefers-contrast` handling.
    - Low: `--tec-focus-ring` was set only on `:root`, so dark islands got the light ring.
    - Low: no `font-size-adjust` or metric fallbacks.
  - The generated `cloak.css` listed every tag (374 lines). That works but is large.
- **`tecton-astryx`** (React):
  - Every color is a `[light, dark]` pair built from `palette.generated.ts`, with no free hex
    values. Dark is the reference and light is derived (`semantic.ts`).
  - Tecton-only roles live in `--tecton-*` local tokens.
  - A generated **token-coverage manifest** (260 names) fails the build on any change to the set.
    This protects micro-frontends where several versions share one page
    (`build-pipeline.md` step 6).
  - Tecton overrides had to fight upstream StyleX rules through `@layer astryx-theme`
    (`theme-audit.md`: ghost/toggle press fills, the ButtonGroup radius shorthand collapsing
    per-corner rules).
  - **In the WC port we own the component CSS**, so Tecton state fills belong in component styles
    that read tokens. They do not belong in a theme layer that overrides rules we also wrote.

---

## 2. Prior art: how other Web Component libraries theme, and what they regret

| Library | Token tiers & naming | Component-level API | Parts / states | Scheme switching | Observed regrets / lessons |
| --- | --- | --- | --- | --- | --- |
| **Web Awesome 3.14** (successor to Shoelace) | `--wa-*`: palette → semantic (`--wa-color-brand-fill-loud`, `--wa-color-surface-*`, `--wa-color-text-*`) → **component-group** tokens (`--wa-form-control-height`, `--wa-form-control-padding-inline`). Named cascade layers `wa-native, wa-base, wa-utilities, wa-color-palette, wa-color-variant, wa-theme, wa-theme-dimension, wa-theme-overrides`. | `wa-button` declares **no** public component custom properties in its manifest. Private `--_button-start-start-radius` etc. are set by the button group. | Parts `base, button, start, label, end, caret, spinner`. States `disabled, icon-button, link, loading`. `@layer wa-component` inside the shadow root. | Classes (`.wa-light`, `.wa-dark`, `.wa-invert`) that repeat every token block. No `light-dark()`. | Moved from Shoelace's many per-component variables to shared group tokens plus parts. The variable surface shrank. |
| **Spectrum WC 2nd-gen** | `token("name")` in source becomes `var(--swc-name)` at build (`@adobe/postcss-token`). Exposed `--swc-<component>-*`, private `--_swc-<component>-*`. | Expose a property only if the component itself changes it per variant/size/state, for CJK, or for WHCM. "Do not expose properties for consumer convenience alone." One property per CSS property, overridden in `:host([size])`, never one per size. | Internal wrapper `.swc-Button` carries all paint. `:host` is layout only. Draft internal layers `swc-host, swc-component, swc-variants, swc-states, swc-slots`. | Global token stylesheet. | Replaced the `--mod-*` indirection chain as "an extra indirection layer". Anti-patterns include visual styles on `:host`, `:where()` inside `:host()`, nested `&:dir(rtl)` on `:host()` (fails silently), and exposing variables "just in case". Source is `.css` compiled by `vite-plugin-lit-css`. Global light-DOM element CSS is **generated** from the shadow CSS. |
| **Material Web 2.5** | ref → sys (`--md-sys-color-*`, `--md-sys-shape-*`, `--md-sys-typescale-*`) → component (`--md-filled-button-*`). | About 42 component tokens on filled button alone. | Two parts on button (`focus-ring`, `ripple`). | Change sys tokens. | Very large token surface, few parts. The project is "in maintenance mode pending new maintainers". |
| **Carbon WC** | Carbon theme tokens as `--cds-*`. Themes (e.g. g100) are set by emitting all tokens on a subtree. | Compiled component CSS carries fallbacks in `var()`. | Some parts. | Emit a theme block on any element. | Proves that subtree themes by re-emitting tokens work. |
| **FAST / Fluent** | FAST `DesignToken` in JavaScript, emitted to CSS; "adaptive color" computed in JS. | JS API `setValueFor`. | — | JS. | Fluent's docs warn that color token properties must be treated as immutable in CSS: setting them in CSS breaks the adaptive system and "can lead to accessibility issues". Fluent WC v3 moved to plain CSS variables plus `setTheme()`. **Keep tokens in CSS, not JS.** |
| **Lion (ING)** | White-label, functional styles only, no variables. | Theme by **subclassing** and overriding `static styles`. | "Doesn't do anything special" for `::part`. | — | Extension-by-subclass is powerful but couples consumers to internals. Not suitable as our public API; possible as an internal escape hatch. |
| **Ionic 8** | `--ion-color-*` globals plus `.ion-color-*` classes. | Unprefixed host variables such as `--background` and `--color`. | Parts added in v5. | — | Generic unprefixed names are ambiguous across nested components. Each component has to re-declare them on `:host`, which blocks inheritance from ancestors. |

What most of them agree on:

- One inherited semantic token layer.
- A document stylesheet that delivers it.
- A deliberately small set of component variables and parts.
- A private `--_x` convention.
- Paint on an internal wrapper, not on `:host`.

Where they differ is scheme switching. Class-duplicated token blocks (Web Awesome) work everywhere
but double the CSS. `light-dark()` (Astryx) is smaller and handles nesting correctly but is only
Newly available. We generate both (§4.3).

---

## 3. Token tiers and naming

### 3.1 Tiers

```text
Tier 1  Primitive   tecton.tokens.json → normalized DTCG → build-time data (+ opt-in palette.css)
Tier 2  Semantic    Astryx portable names          --color-accent, --radius-element, --text-label-size
Tier 2b Semantic    Tecton theme-local roles       --tecton-color-action-primary-bg-hover, --tecton-color-table-stripe
Tier 3  Component   public, admitted, documented   --button-focus-offset, --button-icon-only-aspect
Tier 3p Component   private, in component CSS      --_button-radius, --_button-height, --_button-bg
```

This matches the four tiers in the `css` guide (§5 "Design Tokens and Theming"). The only change
is that "general UI tokens" (tier 3 there) fold into Astryx's semantic set, which already includes
surface, border, overlay and track roles.

**Tier 1: primitives are not runtime custom properties by default.** 1,820 color custom
properties on `:root` add up to about 60 KB of CSS that most pages never read, and they tempt
component authors to write palette paths. The React port already works this way: the semantic
tier holds resolved values, and traceability lives in the generator. Publish
`@…/tokens/palette.css` (`--tecton-<family>-<surface>-<stop>`, e.g.
`--tecton-violet-on-light-560`) only as an opt-in for application authors. Component CSS is
**linted** so it cannot reference it.

**Tier 2: Astryx names, unprefixed.** Reasons:

- The goal is Astryx compatibility.
- Astryx documents these as public CSS variable names ("Consumers may use its CSS
  custom-property name directly", `theme-tokens.md`).
- The owner's React theme already binds all 188 core names to Tecton values, so the semantic map
  exists.
- A page that mixes Astryx React and these WCs themes both from one `tokens.css`.

Cost: unprefixed names can collide with app variables. Tailwind v4's default theme defines
`--font-weight-{normal,medium,semibold,bold}` (400/500/600/700) with the **same names** as Astryx.
Tecton maps `semibold → 500` and `bold → 600`, so layer order matters. Upstream Astryx solves this
in `apps/example-vite-tailwind/src/index.css` by ordering
`@layer reset, theme, base, astryx-base, astryx-theme, components, utilities`, which places its
tokens above Tailwind's `theme` layer. Document the same for us (§4.1) and add the collision list
to the token-drift test.

**Tier 2b: `--tecton-*` for Tecton roles Astryx lacks.** Examples:

- The info and neutral status ladders.
- Lime.
- Placeholder ink.
- Strong divider.
- Table and top-nav surfaces.
- Filled/text-only input appearances.
- Outlined and text-only action variants.
- **Explicit per-state fills** such as
  `--tecton-color-action-{primary,secondary,tertiary,outlined}-{bg,text}-{hover,press}` and
  `--tecton-color-action-disabled-*`.

Tecton states are explicit fills, not composited overlays (`components.ts`: "Every Tecton button
state is an explicit fill, so the composited hover/pressed tint has to go"). These are semantic
roles shared by Button, ToggleButton, SegmentedControl, IconButton and similar, so they belong in
the theme, not in per-component variables. Astryx keeps these names out of its portable vocabulary
(INV8). We do the same: they ship in `tokens.css` but are documented as "Tecton theme-local".

**Tier 3: component public properties must pass an admission bar.** Take the rules from Astryx
INV10 and Spectrum's decision tree:

- Expose a property only if Astryx documents it (`theming.vars` in `.doc.mjs`), **or** the
  component itself varies it by variant/size/state **and** no token or part covers the need.
- Name it `--<component>-<css-property>` (Astryx style, e.g. `--button-focus-offset`). Use full
  property names (`background-color`, not `bg`).
- Never create one property per size or per variant. Use one property whose value changes under
  `:host([size])`.
- Record it with `@cssprop` in JSDoc. Undocumented means private.

**Tier 3p: private `--_<component>-*`.** Declare these on the **internal wrapper element**, not on
`:host`. Spectrum notes that `--_` names on `:host` are still part of the external surface. The
one sanctioned exception is **parent-to-child coupling inside the library**. ButtonGroup squares
interior corners by setting documented-internal `--_button-start-end-radius` (and similar) on
slotted buttons, which is Web Awesome's pattern. Those names are listed as `@internal` in the
manifest and covered by tests.

### 3.2 Naming rules (normative)

| Kind | Pattern | Example |
| --- | --- | --- |
| Portable semantic | Astryx name, verbatim | `--color-text-secondary`, `--shadow-inset-error` |
| Tecton local semantic | `--tecton-<category>-<role>[-<state>]` | `--tecton-color-action-primary-bg-hover` |
| Opt-in primitive | `--tecton-<family>-<surface>-<stop>` (+ `-a<alpha>` for alpha ladders) | `--tecton-hot-pink-on-dark-460` |
| Component public | `--<component>-<property>[-<state>]` | `--button-focus-offset` |
| Component private | `--_<component>-<property>` on the internal element | `--_button-bg` |
| Library-internal coupling | `--_<component>-<property>`, documented `@internal` | `--_button-start-end-radius` |
| Cascade layers | `tecton.<name>` | `tecton.tokens`, `tecton.light-dom` |
| Parts | Astryx target/anatomy name minus the component prefix, kebab | `button`, `label`, `popup`, `indicator` |
| Custom states | kebab | `loading`, `pressed`, `open`, `user-invalid` |

---

## 4. Theme delivery

### 4.1 One document-level stylesheet

`tokens.css` is generated. Its shape (abbreviated):

```css
@layer tecton.reset, tecton.tokens, tecton.light-dom;   /* order declared once, first */

@layer tecton.tokens {
  :where(:root) {
    color-scheme: light dark;                     /* follow the system (dark-mode guide) */
    --color-accent: #6b4ce0;                       /* light value: fallback path */
    --radius-element: 4px;
    --focus-outline-color: #ff00aa;
    /* … every Tier 2/2b name … */
    accent-color: var(--color-accent);
  }
  @media (prefers-color-scheme: dark) {
    :where(:root:not([data-theme="light"])) { --color-accent: #a38bff; /* dark values */ }
  }
  :where([data-theme="dark"])  { color-scheme: dark;  /* dark values */ }
  :where([data-theme="light"]) { color-scheme: light; /* light values */ }

  @supports (color: light-dark(red, red)) {
    :where(:root) { --color-accent: light-dark(#6b4ce0, #a38bff); /* … */ }
  }
}
```

The hex values above are placeholders; real values come from the semantic map.

- **Why the document and not `:host` defaults:** a token declared on each `:host` would override
  what the host inherits, which breaks subtree theming (§1.1). The guide says not to seed public
  properties on `:host`.
- **Why `:where(:root)` inside a layer:** zero specificity plus a layer lets any unlayered app rule
  or later layer override a token without `!important`.
- **The `data-theme` attribute is shared with Astryx.** Astryx's `reset.css` uses
  `html[data-theme="light"|"dark"]`, with a missing attribute meaning system. One switch then
  drives both libraries.
- **Entry points,** mirroring the React port's split (`build-pipeline.md` step 7):
  - `tokens.css`: tokens only.
  - `fonts.css`.
  - `light-dom.css`: table, prose and similar.
  - `cloak.css`: optional.
  - `tecton.css`: all of the above.

  Every file starts with the same `@layer` statement so load order never changes layer order.
- **Tailwind/app coexistence:** document the order
  `@layer theme, base, tecton.reset, tecton.tokens, tecton.light-dom, components, utilities;`,
  following Astryx's Tailwind example.
- **Multiple library versions on one page:** shadow-root component CSS is isolated per version.
  Token names are global. Adopt the React port's rules:
  - One `tokens.css` per page, supplied by the host.
  - A committed **token-set manifest** that fails the build when the set of emitted names changes
    unexpectedly.

### 4.2 When the theme stylesheet is not loaded

Forgetting `tokens.css` must not produce an unreadable UI. Options considered:

| Option | Verdict |
| --- | --- |
| Seed tokens on each `:host` | ✗ Breaks inheritance from ancestors (theme islands, app overrides). |
| `@property` with `initial-value` in the component | ✗ Ignored in shadow roots. Registering tokens as `<color>` also breaks `light-dark()`. |
| `CSS.registerProperty({syntax:'*', initialValue})` from JS | ✗ Global and one-shot, throws when a second library version registers, and isn't available before JS runs (SSR). |
| **Build-time fallback injection** | ✓ Source says `var(--color-accent)`. The component CSS compiler rewrites it to `var(--color-accent, #6b4ce0)` using the **light** Tecton value from the same generator. |

Choose build-time injection. Material and Carbon ship compiled fallbacks the same way. The cost
is about 30–40 bytes per reference, roughly 1–2 KB per component before compression.

Without the theme you get a correct light Tecton UI with system fonts. You don't get dark mode,
because nothing sets `color-scheme` and there are no `light-dark()` values. Docs should still say
`tokens.css` is required. The fallback is a safety net, not a mode.

### 4.3 Light/dark and per-subtree theming

- The generated CSS produces `light-dark(<light>, <dark>)` where supported. `light-dark()` has been
  Newly available since 2024-05-13 and becomes Widely available around 2026-11. Elsewhere, the
  guide's mandated fallback applies: light values, a `prefers-color-scheme: dark` override on
  `:root`, and `[data-theme]` blocks.
- **Nesting.** With `light-dark()`, a dark island inside a light page inside a dark page resolves
  correctly: `color-scheme` inherits, and each token re-resolves at its point of use because tokens
  are unregistered. In the fallback path only one level of `[data-theme]` island is reliable, since
  equal-specificity rules resolve by source order. That is acceptable degradation.
- **Theme-island rules** (`component-specific-light-dark-theme` guide; owner's H5 bug). Any element
  that switches scheme must also:
  - set a background (`--color-background-body` or a surface role), and
  - re-specify `color: var(--color-text-primary)` and `accent-color: var(--color-accent)`. Inherited
    `<color>` values arrive already resolved.

  Provide this as a theme element. Astryx has a `Theme` component and a `MediaTheme` for
  inverted/on-media surfaces. The port gets `<tct-theme mode="light|dark|system">`: its host sets
  `color-scheme`, `color` and `background-color`, and it does **not** use `display: contents`.
  Also provide a `[data-theme]` attribute rule for server-rendered pages. The Tecton
  `onDark`/`onLight` token overrides from `tectonTheme.ts` become generated
  `[data-media-theme="dark"|"light"]` blocks.
- **`color-scheme: only dark`** for surfaces that must never flip, per the guide.
- **Overlays** (menus, popovers, dialogs, toasts) stay in their DOM position and use the top layer
  (`<dialog>.showModal()`, `popover`). They keep inherited tokens, `dir` and `lang`. If a layer
  must be reparented (plan §5 "layers rendered outside their originating DOM scope"), the overlay
  manager copies the resolved `color-scheme`, `data-theme`, `dir` and `lang` onto the portal
  container and sets a background there.
- The **focus ring color is a token** (`--focus-outline-color`), so it switches with the island.
  This fixes the earlier project's "dark island shows the light ring" bug.
- A **scheme toggle** is an app concern. Document the guide's pattern:
  - `<meta name="color-scheme">`.
  - An inline pre-paint script.
  - A two-state control (system / opposite).
  - `data-theme` on `<html>`.

---

## 5. How each component authors its CSS

### 5.1 Source format: `.css` files compiled to Lit `css`

| Option | Pros | Cons |
| --- | --- | --- |
| `css\`\`` in `*.styles.ts` (owner's earlier project) | No build plugin; type-checked imports | No stylelint or CSS tooling; `unsafeCSS` temptations; hard to post-process |
| **`.css` files compiled to Lit `css` modules** (Spectrum gen2 via `vite-plugin-lit-css`) | Real CSS tooling: stylelint (logical properties, no hex, allowed `var()` names), Lightning CSS minify and syntax lowering, fallback injection (§4.2), generation of DSD `<style>` and light-DOM sheets from the same source | Needs a plugin in Vite, the tests and the docs build |
| Runtime CSS module scripts (`import s from './x.css' with {type:'css'}`) | Native; Lit accepts `CSSStyleSheet` in `static styles` | **Not Baseline:** Chromium 123 and Firefox 147 only, no Safari. Node can't import them, which breaks SSR and tests. Bundler support varies. |

**Recommendation:** author `<name>.css` next to `<name>.ts`. Compile it at build time
(`rollup-plugin-lit-css` 6.x / `vite-plugin-lit-css` 3.x, with Lightning CSS 1.33 as the transform
step) into an ES module exporting a Lit `CSSResult`. If CSS module scripts become Baseline later,
only the plugin output changes.

Lit then adopts one constructed `CSSStyleSheet` per module into every instance's shadow root
(`adoptedStyleSheets`, Baseline 2023-03, now Widely available). This is the "fastest at scale"
option in the `shadow-dom` guide. Lit's SSR emits the same text as `<style>` inside the DSD
template.

### 5.2 Shared style modules

These live in `packages/components/src/styles/` and are included in `static styles` in this order:

1. `base.css`. First in every component. It starts with the internal layer order and contains:
   - `:host { box-sizing: border-box }`
   - `:host([hidden]), [hidden] { display: none !important }`
   - `*, ::before, ::after { box-sizing: inherit }`
   - `button, input, select, textarea { font: inherit; color: inherit; letter-spacing: inherit; margin: 0 }`
   - `svg { flex-shrink: 0 }`

   A `*` reset is fine inside a shadow root. The guide's "no global resets" warning is about the
   document.
2. `focus-ring.css`. The standard ring (§8) as utility selectors (`.focus-ring:focus-visible`,
   `.focus-within-ring:has(:focus-visible)`), mirroring Astryx `focusVisible`/`focusWithin`.
3. `motion.css`. Shared `@keyframes` (these must be defined per shadow root) and the
   reduced-motion pattern (§9.3).
4. `sr-only.css`. The guide's `.visually-hidden:where(:not(:focus-within, :active))`.
5. `slotted-icon.css`. `::slotted(svg), ::slotted(tct-icon) { inline-size/block-size: var(--_icon-size) }`.
6. `scroll.css`. Scrollbar tokens (§10) for component-owned scroll containers.

### 5.3 Cascade layers inside the shadow root

Every component uses the same fixed order, declared at the top of `base.css`:

```css
@layer reset, component, state, a11y;
```

- `reset`: `base.css` rules.
- `component`: structure, variants (as custom-property updates) and sizes.
- `state`: hover, active, disabled, loading, invalid. These must beat variants no matter how
  specific the variant selectors are.
- `a11y`: `forced-colors`, `prefers-contrast` and reduced-motion overrides, which always win.

Rules for using the layers:

- If you use layers, **all** of a component's rules go in a layer. Unlayered rules beat every
  layer (Spectrum's rule).
- Layer names inside a shadow root don't interact with page layers, so no prefix is needed.
- Consumer `::part()` rules and host-targeting rules come from the outer context and win over all
  of these, as intended.

### 5.4 Selector conventions

- **`:host` is layout only.** It may set `display`, `vertical-align`, `position` (when a controller
  writes coordinates), `inline-size`/`flex` participation, inherited text properties, `opacity`
  and `cursor`. It must not set background, border, padding, radius, shadow or focus rings. Those
  go on an inner element with a `part`. This follows the owner's `CONVENTIONS.md` §5 and
  Spectrum's anti-pattern #1.
- **Variants and sizes are reflected attributes on the host,** read as `:host([variant="primary"]) .button`.
  Variant rules only **set private custom properties** on the inner element. Base rules consume
  them once. Spectrum explains that a custom property set on the consuming element beats one set
  on an ancestor, whatever the specificity. So set variant values on the same inner element the
  base rule reads.
- **Resolved values that come from context** (size inherited from a group, orientation, placement
  chosen by the positioning controller) are rendered as attributes on the internal element, e.g.
  `<button class="button" data-size=${resolvedSize}>`. Styles depend on what was rendered, which
  also keeps SSR deterministic.
- **Guard hover with `@media (hover: hover)`,** as both Astryx and Web Awesome do. Exclude
  disabled states with `:not(:disabled, [aria-disabled="true"])` instead of overriding them later
  (`css` guide, "Avoid overmatching").
- Keep specificity at or below one class. Wrap extra qualifiers in `:where()`. Don't put `:where()`
  inside `:host()` for custom-property updates (Spectrum anti-pattern #5).
- **Put every condition inside `:host(...)`.** For example `:host(:dir(rtl)[placement="start"])`.
  Never write nested `&:dir(rtl)` on a `:host()` rule; it fails silently (Spectrum anti-pattern #9).
- Use native CSS nesting only for descendants. Nesting has been Baseline since 2023-12 and is
  Widely available now (MDN/web-features). Lightning CSS can lower it if a target ever needs that.
- **No literals for design values.** Hex/rgb/hsl/oklch and px font sizes are forbidden in component
  CSS; stylelint enforces this. Structural literals (`0`, `100%`, `1 / 1`, `none`) are allowed.
  A named component geometry value with no semantic role, such as a switch thumb inset, is allowed
  when a comment names the design decision (Astryx `component-style-authoring.md` guidance).
- **No runtime color math where Tecton defines the color.** `color-mix()` has been Baseline since
  2023 and is now Widely available (MDN/web-features). Use it only for washes over user-supplied
  colors or for Astryx semantics that are defined as mixes. Relative color syntax (Newly
  available, 2024-09) and `contrast-color()` (Newly available, 2026-04) are only for user-supplied
  colors, with the guide's fallback (§10).

---

## 6. The component styling API

What we expose, in order of preference:

1. **Semantic tokens** (inherited). Change `--color-accent` on any ancestor and every component
   below follows.
2. **Attributes** for Astryx visual props: `variant`, `size`, `elevation`, `width`, and so on.
3. **`::part()`**, with one part per Astryx theming target or stable painting anatomy entry
   (`component-theming-surface.md` INV2–INV5). Button exposes `button` (its target) plus `icon`,
   `label` and `end` for its anatomy. A composite re-exports child parts with
   `exportparts="popup: selector-popup"` so Astryx's qualified target names survive. Parts are
   **semver-covered API**. Adding one is a minor change; removing or renaming one is a major
   change. Don't add a part to a wrapper that paints nothing (Astryx INV4, Spectrum).
4. **`:state()`**, read-only runtime states the component owns: `loading`, `pressed`, `open`,
   `checked`, `user-invalid`, `focus-visible-within`. The guide says to prefer these over
   synthetic reflected attributes. Two rules keep them safe:
   - **Internal CSS never depends on `:state()`.** Styles use host attributes and internal element
     attributes. `:state()` is Newly available since about 2024-05 (Chrome 125, Firefox 126,
     Safari 17.4; MDN/web-features), and the owner's M7 bug showed that unguarded
     `internals.states` throws in older engines.
   - The `toggleState()` helper feature-detects `CustomStateSet`, and states are documented with
     `@cssstate`.

   States are not serialized, so anything needed for first paint under SSR must be an attribute.
5. **Component custom properties** (§3.1 admission bar), documented with `@cssprop`. Keep all
   Astryx-documented ones, such as `--button-focus-offset` and `--button-icon-only-aspect`.
6. **Slotted content** belongs to the consumer:
   - `::slotted()` only sets icon sizing and removes stray margins.
   - Slotted text inherits `color`/`font` through the host.
   - Rich slotted content uses the light-DOM stylesheets (§11).
   - Never use `::slotted(...) !important` for aesthetics (guide).

Not offered:

- **Utility classes on hosts for component visuals.** Use variables or parts; utility classes are
  fine for host layout.
- **`:host-context()`.**
- **Lion-style subclassing as a documented theming path.** Subclassing works technically but is
  unsupported.

---

## 7. Sizes and density

- **Keep Astryx's standard `sm | md | lg` axis and its size cascade** (`component-size-cascade.md`).
  An explicit prop wins, then the nearest provider, then the component default. `null` resets.
  - Implement the cascade with `@lit/context` (runtime), **not** container style queries.
  - Style queries (`@container style(--density: compact)`) are Newly available since 2026-05-19,
    and the `design-token-reactivity` guide says they are "NOT RECOMMENDED … for core features".
    Size parity is a core feature.
- **Geometry comes from tokens.**
  - Heights: `--size-element-{sm,md,lg}` (Tecton 28/32, lg 36 kept from Astryx).
  - Padding and gaps: `--spacing-*`.
  - Type: `--text-*-{size,leading,weight}`.
  - Changes follow the plan's layout-safe spacing policy (`spacing-exceptions` records). Use named
    compatibility tokens such as `--tecton-space-table-row-dense` rather than one-off literals.
- **Touch targets:** `min-block-size`/`min-inline-size` of at least 24px (WCAG 2.5.8), with a
  larger hit area under `@media (pointer: coarse)` through padding or a pseudo-element, so the
  visual geometry stays the same (`css` guide §4).
- **Responsive component internals** use container queries (Widely available since 2023-02).
  Declare `container-type: inline-size` on an inner wrapper, not on `:host`, so it doesn't clash
  with consumer layout. Viewport-named breakpoints that Astryx takes from the theme (AppShell
  `sm…2xl`) stay as media queries plus theme metadata, for parity.

---

## 8. Focus ring standard

- **Tokens** (Astryx names, Tecton values from `tectonTheme.ts`):

  | Token | Value |
  | --- | --- |
  | `--focus-outline-color` | `light-dark(#ff00aa, #ff52a8)` (`hotPink.onLight/onDark.460 (focus outline)`, the only role the token file names explicitly) |
  | `--focus-outline-width` | `2px` |
  | `--focus-outline-style` | `solid` |
  | `--focus-outline-offset` | `2px` |
  | `--button-focus-offset` | `1px` (Tecton spec: "a hot-pink ring drawn ~1px outside the button edge") |
- **One implementation, in `focus-ring.css`.** It uses `outline-*` **longhands** on
  `:focus-visible`, so a variant can recolor the ring without restating width and style (Astryx's
  reason: "destructive buttons silently lost their red ring"). It uses `outline`, not
  `box-shadow`: outlines survive forced colors and follow `border-radius`, and the `css` guide
  says "Prefer outline". The trigger stays `:focus-visible`; themes can restyle the ring but not
  show it on pointer focus.
- **Where the ring goes.**
  - The ring goes on the internal focusable element: the native `<button>` or `<input>` in the
    shadow root.
  - Composites use `:has(:focus-visible)` on the painted wrapper (Astryx `focusWithin`).
  - Roving-tabindex hosts use `:host(:focus-visible)`.
  - The owner's earlier project found that hosts using `delegatesFocus` did not match
    `:focus-visible` in practice (`CONVENTIONS.md` §5). So the ring is never drawn from the host
    for delegated focus. Re-verify this per engine.
- **Contrast.** Measured with WCAG 2.x relative luminance:

  | Ring | Surface | Ratio |
  | --- | --- | --- |
  | `#ff00aa` | white | 3.60:1 |
  | `#ff00aa` | Tecton light body `#f6f4f7` | 3.29:1 |
  | `#ff52a8` | Tecton dark body `#1d1c1f` | 5.67:1 |

  The light ring passes WCAG 1.4.11 (3:1) **with little margin**. The offset keeps the ring on the
  surrounding surface, not on the control fill. Add every surface a focusable control can sit on
  (cards, popovers, status banners, table stripes, selected rows) to the contrast matrix (§14.3).
  Where a surface fails, set a local `--focus-outline-color` in that surface's rules. Don't fall
  back to a double ring unless that is designed.
- **Open design decision.** Astryx recolors the destructive button's ring to `--color-error`, but
  the Tecton spec only names hot pink. Record the choice as an explicit decision; the default
  proposal is hot pink everywhere, as in the Tecton spec.
- **Forced colors:** keep the outline and set `outline-color: Highlight` in the `a11y` layer.
  Forced colors override author colors anyway; this makes the intent explicit and matches the
  owner's shared module.

---

## 9. Forced colors, contrast preference, reduced motion

### 9.1 Forced colors (Windows High Contrast)

`forced-colors` has been Baseline since 2022 and is Widely available (MDN/web-features).

- **Check first, add later.** Native `<button>`, `<input>` and `<a>` in the shadow root already get
  system colors (Spectrum rule 1). Add overrides only for non-semantic painters: track fills,
  checkbox/radio indicators, switch thumbs, status dots, skeletons, selected rows and progress
  fills. Use the `a11y` layer and target internal selectors, not `:host`, so consumer overrides
  can't break them.
- Use **transparent borders, not `border: none`**, on anything whose edge carries meaning. Forced
  colors paint them. `box-shadow`, `background-image` and overlay tints disappear (`css` guide), so
  selection and state must also be shown through `outline`, a border, or system colors: `Highlight`
  plus `HighlightText` for selected, `GrayText` for disabled, `CanvasText`/`ButtonText`/`ButtonBorder`
  for edges, `LinkText` for links.
- Use `forced-color-adjust: none` **only** where color is the information: color swatches, chart
  series, syntax highlighting that users choose. Not for aesthetics.
- Treat forced colors as an environment, not a variant (Spectrum anti-pattern #7). No component
  variable is exposed for it.

### 9.2 `prefers-contrast: more`

Optional, per the `accessibility` guide: "only when warranted". Tecton has low-contrast accents
such as subtle dividers, `--color-icon-secondary` and scrollbars. Generate a
`@media (prefers-contrast: more)` token block in `tokens.css` that raises `--color-border`,
`--color-text-secondary` and the scrollbar thumb to their stronger Tecton steps. It is a token
change only; components need no code.

### 9.3 Reduced motion

- **Don't zero the duration tokens globally.** The `css` guide says not to apply global
  `animation-duration: 0.01ms`-style overrides because some animations get *more* jarring. A
  0-second transition also never fires `transitionend`, which hangs JavaScript that waits for exit
  animations. Handle it per component instead:
  - Movement (`translate`, `scale`, slide-in, press `scale(.98)`) only under
    `@media (prefers-reduced-motion: no-preference)`.
  - Opacity fades may remain, shortened.
  - Indeterminate spinners and progress **slow down instead of stopping**
    (`spinner` guide: `--_used-spinner-duration: 6s`).
  - Or use the guide's `--animation-reduced` pattern for keyframe animations.
- JavaScript paths (`scrollIntoView({behavior})`, WAAPI, carousel autoplay) read a shared
  `prefersReducedMotion()` helper and listen for `change` (owner's M14).
- Exit animations are awaited with `element.getAnimations()` plus a timeout, never bare
  `transitionend`.

---

## 10. Other modern CSS features: decisions

| Feature | Status (guide) | Decision |
| --- | --- | --- |
| `:focus-visible` | Widely (MDN/web-features) | Standard focus trigger (§8). |
| `:has()` | Baseline 2023-12, Widely now (MDN/web-features) | Use for `focusWithin`, `label:has(:checked)` patterns, empty-slot styling. Never nest `:has()`. |
| `@scope` | **Newly** 2025-12 (Firefox 146) | Light-DOM stylesheets only (§11), with a descendant-selector fallback. Not needed inside shadow roots. |
| Container size queries | Widely 2023-02 | Component-internal responsiveness (§7). |
| Container style queries | **Newly** 2026-05 | Not for core features (density, theme). Progressive extras only. |
| `@property` | **Newly** 2024-07; ignored in shadow roots | Only for animation targets (e.g. a progress-ring angle), declared at document level in `tokens.css` with a component-namespaced `--_` name. **Never** for tokens. |
| `light-dark()` / `color-scheme` | Newly 2024-05 / Widely | §4.3 with generated fallback. |
| `contrast-color()` | **Newly** 2026-04 | Only for **user-supplied** backgrounds (custom Tag/Avatar colors). Relative-color-syntax fallback, then a fixed ink. Tecton roles already name their on-colors (`--color-on-accent`). |
| Relative color syntax | **Newly** 2024-09 | Only as the `contrast-color()` fallback. No tint generation; Tecton has explicit ramps. |
| `color-mix()` | Widely (MDN/web-features) | Washes on user colors; `in oklab`, never `srgb` (`css` guide §8). |
| `field-sizing: content` | **Newly** 2026-06 | Progressive for auto-growing TextArea. Because Astryx behavior must be matched, feature-detect with `CSS.supports('field-sizing','content')` and keep a JS measuring fallback. Always pair with `max-block-size` (owner's Low finding). |
| `scrollbar-color` / `scrollbar-width` | **Newly** 2025-12 / 2024-12 | Component-owned scrollers only. Token pair `--tecton-color-scrollbar-{thumb,track}` (thumb at least 3:1 against the track). Legacy `::-webkit-scrollbar` inside `@supports not (scrollbar-color: auto)`. `prefers-contrast: more` override. Never animate `scrollbar-color` (WebKit flicker). Pair with `scrollbar-width` for macOS. |
| Anchor positioning | Guide data: "limited availability"; anchored container queries Chromium-only | Plan §5: feature-detect with a measured-positioning fallback. **Style arrows and placement from a `data-placement` attribute that the positioning controller writes**, so the same CSS works on both paths. Not from `@container anchored()`. |
| Popover / `<dialog>` | Popover **Newly** 2025-01 | Per plan. Never set `display` on a closed `[popover]`; style `:popover-open`. Use `:is(:popover-open, .\:popover-open)` if a polyfill is used. |
| `:dir()` | Widely now (Baseline 2023-12; MDN/web-features) | Mirroring of directional icons (§12). |
| Custom states `:state()` | Newly ~2024-05 (MDN/web-features) | Public read-only hook only (§6). |
| Constructable stylesheets | Widely (2023-03, MDN/web-features) | Lit uses them automatically; light-DOM adoption (§11). |
| CSS module scripts | Not Baseline (no Safari) | Not a runtime format (§5.1). |
| `@function` | Limited (Chromium) | Don't use. |
| `:host-context()` | Limited (Chromium only) | Don't use. |
| `accent-color` | Limited (Safari 26.2) | Set in `tokens.css` as progressive enhancement for native controls the app renders. |
| `text-wrap: balance/pretty` | — | Only where the Tecton/Astryx spec asks. Never on `*`, and not on boxed elements (`css` guide §7). |

---

## 11. Light-DOM components (tables, rich content)

The plan (§5 "Shadow DOM is a component-level decision") allows light DOM for native tables, rich
content and some collections. Styling them must not leak into the app.

- **One document-level stylesheet per light-DOM family** (`table.css`, `prose.css`), all in
  `@layer tecton.light-dom`, so any unlayered app rule wins.
- **Scope every selector to the component tag** with zero specificity:
  `:where(tct-table) :where(th)`. Add an **`@scope` donut** so a nested component's content is
  excluded, for example prose containing a code block or table that styles itself:

  ```css
  @layer tecton.light-dom {
    /* Fallback (pre-@scope engines): descendant scoping, no donut. */
    :where(tct-prose) :where(h2) { font: var(--text-heading-2-weight) var(--text-heading-2-size)/var(--text-heading-2-leading) var(--font-family-heading); }
    /* Enhancement: stop at nested library components and opt-out regions. */
    @scope (tct-prose) to (:is(tct-prose, tct-code-block, tct-table, [data-tct-unstyled])) {
      :where(h2) { font: var(--text-heading-2-weight) var(--text-heading-2-size)/var(--text-heading-2-leading) var(--font-family-heading); }
    }
  }
  ```

  Engines without `@scope` ignore the block. Engines with it apply both rules to the same
  elements; only the donut exclusion differs. (Real code would state the values once, through
  shared private variables.)
- **Delivery.**
  - Static: `light-dom.css` for SSR and no-JS pages.
  - Runtime: on first `connectedCallback`, the component adopts a shared `CSSStyleSheet` into
    `this.getRootNode()`, which can be the `Document` **or a `ShadowRoot`**, if it is not already
    there. This makes a light-DOM table inside another component's shadow root styled too. Adopt
    by appending (`root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]`), never by
    replacing. Declare the `@layer` order first so adoption order doesn't matter.
- **Generate the light-DOM sheet from the same `.css` source where possible.** Spectrum generates
  `global-button.css` from the shadow CSS by selector transformation and wraps it in its own
  layer. We should do the same for native-element "global styles" (a styled `<table>` without the
  custom element), if the docs need them.
- **Tables:** style `table/thead/tbody/tr/th/td` inside `tct-table` using Tecton table roles
  (`--tecton-color-table-{header,footer,stripe,row-hover,row-selected}`). Use logical borders and
  `text-align: start`. Row selection uses a border or outline as well as the fill, so it survives
  forced colors. Large tables: `content-visibility: auto` plus `contain-intrinsic-block-size` on
  row groups only if virtualization isn't used (`css` guide §9).
- **Rich content (prose/markdown):** type scale from `--text-*`, and `code, kbd, samp, pre` use
  `--font-family-code` with the mono `font-size-adjust` (§13). Use `overflow-wrap: anywhere` for
  URLs, `text-wrap: pretty` for paragraphs only, and a `[data-tct-unstyled]` opt-out.

---

## 12. RTL via logical properties

- **Logical properties and values only** for anything that should flip: `margin-inline-start`,
  `padding-block`, `inset-inline-end`, `border-start-end-radius`, `text-align: start`,
  `float: inline-start`. Use physical properties deliberately where flipping is wrong, and comment
  them (`css` guide §1: "would I want this to flip in RTL?"). Enforce with
  `stylelint-use-logical` plus an allow-comment.
- **Mirrored glyphs:** directional icons (chevrons, arrows, "back") use
  `:host(:dir(rtl)) .icon { scale: -1 1 }`. Put the condition inside `:host()`; never nest it
  (Spectrum #9). Astryx's icon registry decides which glyphs are directional.
- **ButtonGroup and SegmentedControl** corner squaring uses the logical corner properties, so the
  "first" button is correct in both directions (the same approach as Web Awesome's
  `--_button-start-start-radius` family).
- **Positioning:** placement names `start`/`end` map through the controller using
  `getComputedStyle(host).direction`, not `document.dir` (owner's `RESEARCH.md`). The arrow
  `data-placement` is written after flipping.
- Visual regression runs every component in both `dir="ltr"` and `dir="rtl"` (§14).

---

## 13. Fonts

Fixed decision: **Figtree** for UI, **IBM Plex Mono** for code, measured and tabular text.

- **Package:** a separate `fonts.css` entry. Figtree comes from `@fontsource-variable/figtree`
  5.3.0: one variable woff2 covering wght 300–900, about 20 KB for latin plus about 10 KB for
  latin-ext, split by `unicode-range`. IBM Plex Mono comes from `@fontsource/ibm-plex-mono` 5.3.0
  as static 400 and 500 files, with more weights only if the spec needs them. The owner's earlier
  project shipped Figtree 400/500/600 statics. One variable file replaces three and supports
  Tecton's 500 medium.
- **Declare our own `@font-face` rules with the family name `Figtree`,** pointing at the Fontsource
  files, so the token value `Figtree` works everywhere. Fontsource's variable package names the
  family "Figtree Variable". Keep `font-display: swap`, which is Fontsource's default. With
  metric-matched fallbacks, a swap causes almost no layout shift.
- **`@font-face` must be in the document,** because Chromium ignores it in shadow roots. The
  components never load fonts. The theme only names them, as the React port does ("Both families
  are the host application's to load").
- **Metric-matched fallbacks** (`visually-stable-font-fallbacks` guide). Values computed from
  `@capsizecss/metrics` 4.3.0, using capsize's method: `size-adjust` = ratio of average character
  widths, and overrides = metric ÷ `size-adjust`. Regenerate these at build time; don't copy them.

  ```css
  @font-face { font-family: "Figtree Fallback"; src: local("Arial");
    size-adjust: 100.72%; ascent-override: 94.32%; descent-override: 24.82%; line-gap-override: 0%; }
  @font-face { font-family: "IBM Plex Mono Fallback"; src: local("Courier New");
    size-adjust: 99.98%; ascent-override: 102.52%; descent-override: 27.51%; line-gap-override: 0%; }
  :root {
    --font-family-body: Figtree, "Figtree Fallback", Helvetica, Arial, sans-serif;
    --font-family-code: "IBM Plex Mono", "IBM Plex Mono Fallback", Consolas, Monaco, monospace;
  }
  ```

  `size-adjust` has been supported everywhere since Safari 17. Safari **ignores**
  `ascent-override`/`descent-override`/`line-gap-override` (WebKit bug 219735). Those descriptors
  are progressive.
- **`font-size-adjust`** is Newly available (2024-07). Use **numeric** aspect values equal to the
  primary face's x-height ratio:
  - `0.5` on body/UI contexts (Figtree x-height 500/1000).
  - `0.516` on code contexts (Plex Mono 516/1000).

  This leaves the loaded web font unchanged and normalizes any fallback. `from-font` would
  measure the *first available* font, which is the fallback while the web font is still loading,
  so it doesn't help during the swap. The numeric values also keep inline code visually matched in
  mixed text (`visually-stable-mixed-fonts`).
  - Set these values through `--font-size-adjust-body`/`--font-size-adjust-code` tokens applied on
    `:root` and on mono parts.
  - `font: inherit` on form controls inherits them correctly.
  - Without support, fonts render at their natural size (guide fallback: similar-metric fallbacks,
    which we have).
- **Numerals:** Plex Mono is tabular by default. For Figtree numeric readouts (tables, stats), use
  `font-variant-numeric: tabular-nums` through a `--tecton-font-numeric` role, where the Tecton
  spec wants aligned digits.
- **Performance guidance for apps and docs:** `<link rel="preload" as="font" type="font/woff2"
  crossorigin>` for Figtree latin only. The owner's earlier docs site didn't preload Plex Mono
  either; that was a Low finding.
- **Geometry tests** must run with fonts loaded **and** with fonts blocked. The plan (§6) requires
  font changes to trigger geometry regression tests.

---

## 14. FOUC, SSR/DSD, and testing

### 14.1 FOUC and `:not(:defined)`

- Optional `cloak.css`, generated from the manifest. It follows the `custom-elements` guide's
  **fail-open** pattern, scoped per tag:

  ```css
  :is(tct-button, tct-select, …):not(:defined) {
    opacity: 0;
    animation: tct-cloak-reveal 0.2s var(--tct-cloak-timeout, 2s) forwards;
  }
  @keyframes tct-cloak-reveal { to { opacity: 1; } }
  ```

  Content becomes visible even if a script never loads. Hide only what needs it; not `body`.
- **Reserve space to avoid layout shift:** the same file gives undefined hosts their final
  `display` and `min-block-size`, e.g. `tct-button:not(:defined) { display: inline-flex; min-block-size: var(--size-element-md) }`.
  The values come from each component's `:host` metadata.
- A server-rendered DSD page needs none of this for those instances (§14.2).

### 14.2 SSR / Declarative Shadow DOM

DSD has been Widely available since 2024-02.

- Component CSS is static and depends only on attributes, so the DSD output is a
  `<template shadowrootmode="open"><style>…</style>…` produced by Lit SSR (`@lit-labs/ssr` 4.1)
  from the same compiled CSS. The styles must be **inside** the template (`prerendering-custom-elements`).
- Lit SSR repeats the `<style>` per instance. Measure HTML weight on large pages. Compression
  handles most of it; the plan's early SSR vertical slice should record the numbers.
- The document stylesheets (`tokens.css`, `fonts.css`, `light-dom.css`) are ordinary `<link>`s,
  so SSR pages are themed before JavaScript runs.
- Nothing that affects first paint may come from `:state()`, a JS-measured class, or
  `adoptedStyleSheets` on the document. All of those are runtime-only.
- Set the scheme before paint: `data-theme` on `<html>` from the server, or the dark-mode guide's
  inline script.

### 14.3 Testing styles

Only Chromium is installed, so runs are Chromium-only now. The matrix is designed so WebKit and
Firefox can be added in CI.

1. **Visual regression** with Playwright `toHaveScreenshot`, per component ×
   {variant, size, state (rest/hover/active/focus-visible/disabled/loading/invalid)} ×
   {light, dark, dark island in light page} × {ltr, rtl} × {forced-colors active} ×
   {reduced motion}. Set `reducedMotion: 'reduce'` to freeze motion, await `document.fonts.ready`,
   use deterministic content, and **no broad masks** (plan §6). Keep two baselines, as the plan
   requires:
   - an upstream-like verification theme that uses Astryx default token values, which separates
     implementation defects from reskinning;
   - the approved Tecton baseline.
2. **Geometry tests** (layout-safe policy). Compare `getBoundingClientRect()` of each part against
   measurements taken from the upstream Astryx build with the verification theme, within a
   tolerance. Repeat with fonts blocked (`page.route('**/*.woff2', r => r.abort())`) to check the
   metric fallbacks.
3. **Contrast after alpha compositing.**
   - (a) Static: a generated fg-role × bg-role matrix from token metadata. Composite alpha
     foregrounds and washes over the actual backdrop chain before measuring WCAG 2.x ratios: 4.5:1
     text, 3:1 large text, icons, UI boundaries and the focus ring. Both modes. Reuse the owner's
     `contrast.ts` approach; `colorjs.io` 0.7 is an option for OKLCH-aware compositing. Tecton has
     630 alpha colors, and token numbers are identifiers, not contrast levels.
   - (b) Runtime: axe-core (`@axe-core/playwright` 4.13) `color-contrast` on every screenshot
     fixture. Treat axe "incomplete" results (overlaps, pseudo-elements, gradients) as failures to
     triage, not passes.
   - (c) Focus ring against every surface in the matrix (§8).
4. **Token drift tests.**
   - Palette and semantic output regenerated in memory and compared with committed files; the
     source `tecton.tokens.json` sha256 pinned.
   - Token-set manifest: the exact set of emitted names.
   - **Astryx coverage:** parse upstream `tokens.stylex.ts` `*Defaults` and fail if a portable name
     is missing from our theme, or if we emit an unknown non-`--tecton-` name.
   - A known-collision check against Tailwind v4 default theme names.
5. **CSS lint** (stylelint), per component source:
   - Every `var(--x)` is a known token, a documented `@cssprop` of that component, or a
     `--_<same-component>-*` private.
   - No color literals.
   - Logical properties only.
   - No `:host-context`.
   - No box properties on `:host`.
   - No nested `&` pseudo-classes on `:host()`.
   - `@media (forced-colors)` appears only inside `@layer a11y`.
6. **API surface tests** from the Custom Elements Manifest: every `part=` in templates is
   documented (`@csspart`) and vice versa, and the same for `@cssprop`/`@cssstate`. A snapshot
   diff of the public styling surface is reviewed like an API change.
7. **Emulation checks:** `emulateMedia({ forcedColors: 'active' })`, `colorScheme`,
   `reducedMotion`, `prefers-contrast` (via CDP). Also the no-`tokens.css` page, which must stay
   legible thanks to the §4.2 fallbacks, and a no-`light-dark()` run (override `CSS.supports` or
   test in an older engine in CI) for the fallback path.

---

## 15. Worked example: Button

Astryx Button has variants `primary | secondary | ghost | destructive`, default `secondary`. The
Tecton port adds `outlined` and `text-only` (owner's `components.ts`). Sizes are `sm | md | lg`
(heights 28/32/36), plus a loading state and icon-only. Theming target: `astryx-button`. Public
variables: `--button-focus-offset` and `--button-icon-only-aspect`.

`packages/components/src/button/button.css` (source; the build adds `var()` fallbacks and
minifies):

```css
@layer component {
  :host { display: inline-flex; vertical-align: middle; }   /* layout only */

  .button {
    /* Private aliases: each fallback appears exactly once. */
    --_height: var(--size-element-md);
    --_radius: var(--radius-element);
    --_bg: var(--color-neutral);
    --_fg: var(--color-text-primary);
    --_bg-hover: var(--tecton-color-action-secondary-bg-hover);
    --_bg-press: var(--tecton-color-action-secondary-bg-press);
    --_border: transparent;

    display: inline-flex; align-items: center; justify-content: center;
    gap: var(--spacing-2);
    inline-size: 100%;
    block-size: var(--_height);
    padding-inline: var(--spacing-3);
    border: var(--border-width) solid var(--_border);     /* transparent: visible in forced colors */
    border-start-start-radius: var(--_button-start-start-radius, var(--_radius));
    border-start-end-radius:   var(--_button-start-end-radius,   var(--_radius));
    border-end-start-radius:   var(--_button-end-start-radius,   var(--_radius));
    border-end-end-radius:     var(--_button-end-end-radius,     var(--_radius));
    background-color: var(--_bg);
    color: var(--_fg);
    font-size: var(--text-label-size);
    line-height: var(--text-label-leading);
    font-weight: var(--text-label-weight);
    white-space: nowrap;
    cursor: pointer;
  }
  .button[data-size="sm"] { --_height: var(--size-element-sm); }
  .button[data-size="lg"] { --_height: var(--size-element-lg); }
  :host([icon-only]) .button { aspect-ratio: var(--button-icon-only-aspect, 1 / 1); padding-inline: 0; }

  :host([variant="primary"]) .button {
    --_bg: var(--color-accent); --_fg: var(--color-on-accent);
    --_bg-hover: var(--tecton-color-action-primary-bg-hover);
    --_bg-press: var(--tecton-color-action-primary-bg-press);
  }
  :host([variant="outlined"]) .button {
    --_bg: transparent; --_fg: var(--tecton-color-action-outlined-text);
    --_border: var(--tecton-color-action-outlined-border);
    /* … hover/press roles … */
  }
  /* ghost, destructive, text-only: same shape */

  .label { overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
}

@layer state {
  @media (hover: hover) {
    .button:hover:not(:disabled, [aria-disabled="true"]) { background-color: var(--_bg-hover); }
  }
  .button:active:not(:disabled, [aria-disabled="true"]) { background-color: var(--_bg-press); }
  .button:is(:disabled, [aria-disabled="true"]) {
    background-color: var(--tecton-color-action-disabled-bg);
    color: var(--tecton-color-action-disabled-text);
    cursor: default;
  }
  .button:focus-visible {
    outline-width: var(--focus-outline-width);
    outline-style: var(--focus-outline-style);
    outline-color: var(--focus-outline-color);
    outline-offset: var(--button-focus-offset, var(--focus-outline-offset));
  }
  @media (prefers-reduced-motion: no-preference) {
    .button { transition: background-color var(--duration-fast) var(--ease-standard),
                          color var(--duration-fast) var(--ease-standard); }
    .button:active:not(:disabled, [aria-disabled="true"]) { scale: 0.98; }
  }
}

@layer a11y {
  @media (forced-colors: active) {
    .button:is(:disabled, [aria-disabled="true"]) { color: GrayText; border-color: GrayText; }
    .button:focus-visible { outline-color: Highlight; }
  }
}
```

`tokens.css` also sets the Tecton component default at the root, so an ancestor can override it:
`:where(:root) { --button-focus-offset: 1px; }`.

`button.ts` (excerpt):

```ts
import {html, LitElement, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {consume} from '@lit/context';
import base from '../styles/base.css';          // compiled to CSSResult by the build plugin
import focusRing from '../styles/focus-ring.css';
import styles from './button.css';
import {TctElement} from '../internal/tct-element.js';
import {sizeContext, type Size} from '../internal/size-context.js';

/**
 * @tag tct-button
 * @csspart button - The native button; Astryx target `astryx-button`.
 * @csspart label - The label wrapper.
 * @cssprop --button-focus-offset - Focus ring offset (Tecton default 1px).
 * @cssprop --button-icon-only-aspect - Aspect ratio for icon-only buttons.
 * @cssstate loading - The button is busy.
 */
export class TctButton extends TctElement {
  static override shadowRootOptions = {...LitElement.shadowRootOptions, delegatesFocus: true};
  static override styles = [base, focusRing, styles];

  @property({reflect: true}) variant: ButtonVariant = 'secondary';
  @property({reflect: true}) size?: Size;                 // explicit wins (Astryx INV3)
  @consume({context: sizeContext, subscribe: true}) groupSize?: Size | null;
  @property({type: Boolean, reflect: true, attribute: 'icon-only'}) iconOnly = false;
  @property({type: Boolean}) loading = false;

  protected override updated() { this.toggleState('loading', this.loading); } // feature-detected helper

  protected override render() {
    const size = this.size ?? this.groupSize ?? 'md';         // explicit → provider → default
    return html`<button part="button" class="button" data-size=${size}
        aria-disabled=${this.loading ? 'true' : nothing} …>
      <slot name="icon"></slot><span part="label" class="label"><slot></slot></span><slot name="end"></slot>
    </button>`;
  }
}
```

What a consumer can do, from least to most power:

```css
.promo      { --color-accent: var(--tecton-color-accent-lime); }   /* re-point a semantic role for a subtree */
.dense-bar  { --button-focus-offset: 0px; }                       /* admitted component property, inherits */
tct-button[size="lg"]::part(label) { letter-spacing: 0.01em; }    /* part: any property, semver-covered */
tct-button:state(loading) { cursor: progress; }                    /* read-only state hook */
```

ButtonGroup (library-internal) squares interior corners through the `@internal`
`--_button-*-radius` properties on its slotted buttons. Because those are logical corners, RTL is
correct automatically.

---

## 16. Recommendations

Status per the guides unless marked (MDN/web-features). "Fallback" states what degrades.

1. **Tier model: primitive (build-time) → Astryx-named semantic + `--tecton-*` local → admitted
   component public → `--_component` private** (§3). No Baseline dependency.
2. **Adopt Astryx's unprefixed token names verbatim** for all 188 core portable tokens plus the
   data and syntax domains. Put Tecton-only roles, including explicit per-state action fills, under
   `--tecton-*`. Document the Tailwind v4 `--font-weight-*` collision and the recommended layer
   order.
3. **Don't ship the 1,820 palette colors as runtime properties.** Offer `palette.css` opt-in and
   lint component CSS so it can't reference it.
4. **Token pipeline:**
   - Normalize `tecton.tokens.json` into a DTCG 2025.10-valid intermediate: object-form colors,
     split value-plus-children nodes such as `shades.white`, normalized names such as
     `460 (focus outline)` → `460`, with the original path kept in metadata.
   - Port the owner's `semantic.ts`/`localTokens.ts`/`tectonTheme.ts`/`typography.ts` pairs into a
     framework-free `packages/tokens` source.
   - Generate CSS, typed metadata, the manifest and the fallback map with a **small in-repo
     generator**. The outputs are bespoke: dual light-dark/fallback blocks, the manifest, the
     Astryx coverage check and the fallback map.
   - Keep the intermediate DTCG-valid so Style Dictionary v5.5 (DTCG 2025.10 object colors) or
     Terrazzo 2.7 (full DTCG incl. resolvers/modes) can replace the generator later.
5. **Deliver themes through a document-level `tokens.css`,** `@layer tecton.tokens` on
   `:where(:root)`. Never seed public tokens on `:host`. Ship entry points `tokens.css`,
   `fonts.css`, `light-dom.css`, `cloak.css` and `tecton.css`, all opening with the same `@layer`
   statement.
6. **Color modes:** `color-scheme: light dark` by default, `html[data-theme]` shared with Astryx,
   `light-dark()` values (**Newly** 2024-05). **Fallback:** a generated light base plus
   `prefers-color-scheme` and `[data-theme]` blocks, overridden by `light-dark()` inside `@supports`. Never register
   tokens as `<color>`.
7. **Per-subtree theming** via `<tct-theme>` / `[data-theme]` / `[data-media-theme]`, which always
   set background, `color` and `accent-color`. Overlays stay in place in the top layer; if
   reparented, they copy scheme, `dir` and `lang`.
8. **When `tokens.css` is missing, inject build-time light-value fallbacks** into every token
   `var()`. No Baseline dependency.
9. **Author `.css` files, compile them to Lit `css` modules** (`rollup-/vite-plugin-lit-css` +
   Lightning CSS). Lit adopts constructed sheets (**Widely** (MDN/web-features)), with `<style>`
   fallback built into Lit. Don't use runtime CSS module scripts (**not Baseline**, no Safari).
10. **Shared style modules** `base`, `focus-ring`, `motion`, `sr-only`, `slotted-icon`, `scroll`,
    and a fixed internal layer order `@layer reset, component, state, a11y` (**Widely**).
11. **Selector rules:**
    - `:host` for layout only; paint on an inner part.
    - Variants as host attributes that set private variables on the consuming element.
    - Resolved context values as internal `data-*` attributes.
    - Hover under `@media (hover: hover)`.
    - Specificity at most one class, using `:where()`.
    - Conditions inside `:host(...)`.
    - Nesting only for descendants (**Widely**, MDN/web-features).
12. **Public styling API:**
    - Tokens, then attributes, then `::part` (one per Astryx target; **Widely**), then `:state()`
      (**Newly**; internal CSS never depends on it, and `toggleState` is feature-detected), then
      admitted component variables, then `::slotted` for small adjustments only.
    - Everything is documented in the Custom Elements Manifest and snapshot-tested as API.
    - No `:host-context()` (**limited**).
13. **Sizes:** the Astryx `sm|md|lg` cascade via `@lit/context`. Not container style queries
    (**Newly** 2026-05, not for core). Container size queries (**Widely**) for internal
    responsiveness. 24px minimum targets and a coarse-pointer bump.
14. **Focus ring:**
    - Astryx `--focus-outline-*` tokens with Tecton values: hot pink `light-dark(#ff00aa, #ff52a8)`,
      2px, offset 2px, and `--button-focus-offset: 1px`.
    - Outline longhands on `:focus-visible` (**Widely**) from one shared module.
    - Contrast checked on every surface; the light ring has little margin (3.29–3.60:1).
    - `Highlight` under forced colors.
15. **Forced colors** (**Widely**): check native elements first; transparent borders; system colors
    for non-semantic painters in `@layer a11y`; `forced-color-adjust: none` only when color is the
    content.
16. **`prefers-contrast: more`:** an optional token-only block for dividers, secondary ink and
    scrollbar thumbs.
17. **Reduced motion:** per component, with motion only under `no-preference`. Spinners slow down
    instead of stopping. JS reads a shared helper. No global zero-duration tokens. Await
    `getAnimations()`, not `transitionend`.
18. **RTL:** logical properties everywhere (lint-enforced); `:host(:dir(rtl))` mirroring
    (**Widely** now, MDN/web-features); direction read from computed style.
19. **Fonts:**
    - A separate `fonts.css`: self-hosted Fontsource Figtree variable (declared as `Figtree`) and
      Plex Mono 400/500, `font-display: swap`, declared in the document.
    - Metric-matched `local()` fallbacks: `size-adjust` supported everywhere;
      `ascent/descent-override` **limited** (no Safari), progressive.
    - Numeric `font-size-adjust` 0.5 / 0.516 (**Newly** 2024-07). Fallback: unadjusted natural
      size.
20. **Light-DOM components:** layered (`tecton.light-dom`) tag-scoped `:where()` selectors, plus an
    `@scope` donut (**Newly** 2025-12; the fallback is descendant scoping without the donut).
    Delivered statically, and adopted at runtime into `getRootNode()` (document or shadow root).
21. **FOUC:** optional generated, fail-open, per-tag `:not(:defined)` cloak with space
    reservation. DSD SSR (**Widely**) with styles inside the template.
22. **Color helpers:**
    - `contrast-color()` (**Newly** 2026-04) and relative colors (**Newly** 2024-09) only for
      user-supplied colors, with the guide's RCS then fixed-ink fallback.
    - `color-mix(in oklab, …)` (**Widely**) for washes.
    - No runtime tint generation.
23. **Progressive extras:**
    - `field-sizing` (**Newly** 2026-06), with a JS fallback where Astryx behavior requires
      auto-grow.
    - `scrollbar-color/width` (**Newly**), with `@supports not` webkit fallback and
      `prefers-contrast`.
    - Anchor positioning (limited), behind the plan's measured fallback; style from `data-placement`.
    - `@property` (**Newly**; document-level only) solely for animation targets.
24. **Testing:**
    - Screenshot matrix (variants × states × schemes × islands × dir × forced-colors ×
      reduced-motion) against an Astryx-default verification theme and a Tecton baseline.
    - Geometry against upstream, with fonts loaded and blocked.
    - Composited contrast matrix plus axe (`incomplete` = fail).
    - Token-set manifest, palette sha, Astryx coverage and collision checks.
    - Stylelint token/logical/literal rules.
    - CEM styling-surface snapshot.

### Open questions for the owner

- Should `destructive` keep Astryx's red focus ring or use Tecton hot pink? (§8)
- Is a `prefers-contrast: more` Tecton token set wanted? Which stops?
- Is the `tct-` prefix final? It affects layer names, cloak and light-DOM selectors, but not token
  names.
- Should `palette.css` be published at all, or kept internal?

---

## Sources

**modern-web-guidance** (skill `2026_09_04-7de96777`, `npx -y modern-web-guidance@latest retrieve "<id>"`):

- **Web components:** `styling-web-components`, `shadow-dom`, `web-components`, `custom-elements`,
  `prerendering-custom-elements`, `accessible-web-components`.
- **Color and theming:** `dark-mode`, `component-specific-light-dark-theme`, `css`,
  `design-token-reactivity`, `usage-aware-component-variations`, `size-aware-styling`,
  `contrast-color`.
- **Fonts:** `visually-stable-font-fallbacks`, `visually-stable-mixed-fonts`,
  `share-web-fonts-across-origins`.
- **Browser UI:** `customize-scrollbar-color-and-thickness`,
  `adapt-scrollbar-to-contrast-preferences`, `form-fields-automatically-fit-contents`.
- **Positioning:** `position-aware-tooltips`, `resilient-context-menus-and-nested-dropdowns`.
- **Other:** `spinner`, `reduce-style-repetition`, `accessibility`, `brand-consistent-forms`.

**Web and library sources:**

- **Lit:**
  - https://lit.dev/docs/components/styles/ (via raw GitHub `lit/lit.dev` `site/docs/v3/components/styles.md`)
  - https://github.com/lit/lit/blob/main/packages/reactive-element/src/css-tag.ts
- **Web Awesome:**
  - https://webawesome.com/docs/customizing/
  - https://webawesome.com/docs/tokens/
  - https://blog.fontawesome.com/web-awesome-theming/
  - npm `@awesome.me/webawesome@3.14.0` (`layers.css`, `themes/default.css`, button styles, `custom-elements.json`)
- **Spectrum WC gen2:**
  - https://github.com/adobe/spectrum-web-components/tree/main/CONTRIBUTOR-DOCS/02_style-guide/01_css (component-css, custom-properties, anti-patterns, stylesheets)
  - https://opensource.adobe.com/spectrum-web-components/guides/styling-components
  - https://github.com/adobe/spectrum-web-components/pull/5855
- **Material Web:**
  - https://github.com/material-components/material-web/blob/main/docs/theming/README.md
  - https://github.com/material-components/material-web/discussions/5642
  - npm `@material/web@2.5.0`
- **Carbon WC:** https://github.com/carbon-design-system/carbon-web-components/blob/main/docs/styling.md
- **FAST and Fluent:**
  - https://fast.design/docs/1.x/design-systems/design-tokens
  - https://learn.microsoft.com/en-us/fluent-ui/web-components/getting-started/styling
  - https://learn.microsoft.com/en-us/fluent-ui/web-components/design-system/design-tokens
- **Lion:** https://lion-web.netlify.app/guides/principles/styling/
- **Ionic:**
  - https://ionicframework.com/docs/theming/css-shadow-parts
  - https://ionicframework.com/docs/v8/theming/basics
- **CSS names inside shadow roots:**
  - https://developer.chrome.com/docs/css-ui/css-names
  - https://shadow-dom-css.adobe.com/
  - https://github.com/w3c/csswg-drafts/issues/10541
  - https://issues.chromium.org/issues/41085401
  - https://github.com/tailwindlabs/tailwindcss/issues/15005
- **`@scope`:**
  - https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/146
  - https://web.dev/blog/web-platform-12-2025
- **CSS module scripts:**
  - https://web.dev/articles/css-module-scripts
  - https://bugzilla.mozilla.org/show_bug.cgi?id=1720570
- **Font metric overrides:**
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/ascent-override
  - https://bugs.webkit.org/show_bug.cgi?id=219735
- **Design tokens and tooling:**
  - https://www.designtokens.org/tr/2025.10/format/
  - https://styledictionary.com/info/dtcg/
  - https://github.com/style-dictionary/style-dictionary/releases
  - https://terrazzo.app/docs/
  - https://terrazzo.app/docs/reference/tokens/
  - https://github.com/penpot/penpot/issues/9305
- **npm versions checked on 2026-09-29:** lit 3.3.3, @lit-labs/ssr 4.1.0, style-dictionary 5.5.5,
  @terrazzo/cli 2.7.1, @fontsource-variable/figtree 5.3.0, @fontsource/ibm-plex-mono 5.3.0,
  @capsizecss/metrics 4.3.0, lightningcss 1.33.0, rollup-plugin-lit-css 6.0.1,
  vite-plugin-lit-css 3.1.0, @axe-core/playwright 4.13.0, colorjs.io 0.7.1.

**Local sources:**

- **Astryx** (`/home/user/refs/astryx`):
  - `packages/core/src/theme/tokens.stylex.ts`
  - `packages/core/src/utils/focusOutline.stylex.ts`
  - `packages/core/src/reset.css`
  - `packages/core/src/Button/{Button.tsx,Button.doc.mjs}`
  - `docs/architecture/{theme-tokens,component-theming-surface,component-style-authoring,component-size-cascade,theme-application}.md`
  - `apps/example-vite-tailwind/src/index.css`
- **Owner's React port** (`/home/user/rpkapps/tecton-astryx`):
  - `packages/react/src/theme/{tokens,localTokens,semantic,tectonTheme,typography,components}.ts`
  - `packages/react/src/theme/__tests__/contrast.ts`
  - `docs/engineering/build-pipeline.md`
  - `docs/design/theme-audit.md`
- **Owner's earlier WC project** (`/home/user/rpkapps/tecton-webcomponents`):
  - `docs/{CONVENTIONS,RESEARCH,REVIEW-modern-web-guidance}.md`
  - `packages/wc/src/internal/styles.ts`
  - `packages/wc/src/styles/{theme,tokens,cloak}.css`
  - `packages/wc/tokens/tecton.tokens.json`

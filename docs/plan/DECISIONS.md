# Decision log (orchestrator / reviewer)

Decisions made while reviewing agent output. The architecture and implementation must follow
these; changes need a new entry.

## D-001 — Source of truth for Tecton values (2026-09-29)

Two sources disagree on light mode (`docs/research/tecton-theme.md`):

- `tecton-webcomponents/packages/wc/tokens/tecton-tokens.css` is a **verbatim generated export of
  the Tecton design system (Tecton MUI v1.0)** with designed light *and* dark blocks and a type
  scale.
- `tecton-astryx` derived its light values by rule, believing no light design existed. Its dark
  values match the export on 158/161 roles.

**Decision:** the generated Tecton export is authoritative for Tecton role values in both modes
(and for typography where it defines them). `tecton-astryx` remains the reference for *which*
Tecton role binds to *which* Astryx semantic token and for per-component overrides. Where the
export corrects tecton-astryx (the 3 swapped text-field dark roles), the export wins. Accent-ink
tokens that fall below contrast under the export's light values must be rebound and the choice
recorded in the semantic map.

The raw palette (`tecton.tokens.json`) stays the primitive layer; the export's role values must
resolve to palette entries (flag any that don't).

## D-002 — Proposed values are labelled provisional

Data-viz colors, motion, breakpoints, z-index, letter-spacing, `--size-element-lg`, destructive
button and the six missing icons have no Tecton decision. Keep Astryx values (or the proposals in
`tecton-semantic-map.json`), mark them `provisional` in generated metadata and docs, and list them
in the docs' "differences / open items" page. They do not block implementation.

## D-003 — Fonts

Figtree (UI) and IBM Plex Mono (code/tabular), both OFL-1.1, self-hosted via an opt-in
`fonts.css` from `@fontsource-variable/figtree` + `@fontsource/ibm-plex-mono`. The font stack
lists `"Figtree Variable", Figtree` then metric-matched fallbacks. `@font-face` lives in document
CSS, never in shadow roots.

## D-004 — Icons

tecton-astryx's 131 icon glyphs have no recorded licence/provenance. Do not ship them until
provenance is confirmed. Build the icon system (registry + `tct-icon`) against an
open-licensed set whose names match (Material Symbols, Apache-2.0) as the default, with
the Tecton glyphs as a drop-in registry once cleared. Open question for the owner.

## D-005 — Styling open questions (2026-09-29)

Resolving the open questions in `docs/research/styling.md` §16:

- **Prefix:** `tct-` is final for tags and custom events.
- **Focus ring:** Tecton hot pink everywhere, including destructive buttons (Tecton defines only
  one focus role). Every surface a ring can sit on is contrast-checked; inverted surfaces (where
  pink fails 3:1) get a documented double-ring (pink + surface-contrast inner ring) fallback.
- **`prefers-contrast: more`:** deferred; not in v1 scope. Forced-colors support is required.
- **`palette.css`:** published as an opt-in asset; component CSS is linted so it never references
  palette variables.
- **Token names:** Astryx's unprefixed semantic names verbatim; Tecton-only roles under
  `--tecton-*`; component-private `--_<component>-*`.

## D-006 — Parity scope baseline (2026-09-29)

From `docs/research/astryx-inventory.md` (upstream package is `@astryxdesign/core`):

- **In scope, v1 denominator:** all 184 public core components (110 top-level, 67 subcomponents,
  7 providers), including the 84 public components not in the docs catalog, plus required
  hooks/utilities re-expressed as controllers or element APIs where they are part of the public
  developer capability.
- **Extension packages** (lab 56, charts 6, richtext 4, vega 1 — all `@canary`): tracked in the
  manifest as `experimental`, scheduled after core (plan phase 4). Not excluded, not in the v1
  core release gate.
- **Controlled-only upstream inputs:** the port supports both property-controlled and uncontrolled
  (attribute default) usage. Recorded as an approved API difference.
- **Locales:** 30 upstream catalogs (region-tagged, 370 messages) are the target set; the i18n
  guide's English-only statement is an upstream docs defect.
- **TabList:** keep upstream semantics (nav + `aria-current` by default, tabs pattern only in
  tablist mode).

## D-007 — External dependencies (owner-approved 2026-09-29)

Rule: no external library is added without owner approval. The owner approved this list:

- **Runtime:** `lit`, `@floating-ui/dom` (lazy positioning fallback only), `@internationalized/date`,
  `intl-messageformat`, `dompurify` (fallback when the native Sanitizer is unavailable),
  `@fontsource-variable/figtree`, `@fontsource/ibm-plex-mono`.
- **Dev/build only:** `typescript`, `vite`, `vitest` + `@vitest/browser` + Playwright provider,
  `playwright`, `@custom-elements-manifest/analyzer`, `astro` + `@astrojs/starlight`, `axe-core`,
  `eslint` (+ typescript-eslint), `stylelint`, `size-limit`, `capsize` (@capsizecss/*).

Anything else (including `@lit/context`, `@tanstack/*`, icon packages, Markdown parsers, syntax
highlighters) needs a new owner approval. Every non-lit runtime dependency stays behind an
internal module boundary so it can be swapped or removed.

### D-007a — Licence audit (2026-09-29, npm registry metadata)

Runtime tree, including transitive dependencies. All are permissive, with no copyleft obligations for consumers:

| Package (version) | Licence | Transitive deps |
| --- | --- | --- |
| lit 3.3.3 | BSD-3-Clause | lit-html, lit-element, @lit/reactive-element, @lit-labs/ssr-dom-shim (BSD-3-Clause); @types/trusted-types (MIT) |
| @floating-ui/dom 1.8.0 | MIT | @floating-ui/core, @floating-ui/utils (MIT) |
| @internationalized/date 3.12.4 | Apache-2.0 | @swc/helpers (Apache-2.0) |
| intl-messageformat 12.1.2 | BSD-3-Clause | @formatjs/* (MIT), tslib (0BSD) |
| dompurify 3.4.16 | MPL-2.0 OR Apache-2.0 | none. **We elect Apache-2.0.** |
| @fontsource-variable/figtree 5.3.0 | OFL-1.1 (font) | none |
| @fontsource/ibm-plex-mono 5.3.0 | OFL-1.1 (font) | none |

Dev-only packages: TypeScript, Playwright, Apache-2.0; Vite, Vitest (+ browser packages), CEM analyzer,
Astro, Starlight, ESLint, typescript-eslint, Stylelint, size-limit, Capsize, MIT; **axe-core
MPL-2.0**. MPL is file-level copyleft; axe is used only in tests and never bundled or modified, so no
obligation reaches consumers.

Requirements for the foundation work package:
- Add a CI licence check. The allowlist is MIT, BSD-2/3-Clause, Apache-2.0, ISC, 0BSD and OFL-1.1 (fonts), plus the
  explicit exceptions dompurify (Apache-2.0 election) and axe-core (dev-only). Any other licence fails the build.
- Ship a `THIRD-PARTY-NOTICES.md` with the runtime licences and the OFL font notices.

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

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

## D-008 — This library's own licence (owner, 2026-09-29)

For now the library is **unlicensed** (all rights reserved). Do not add a LICENSE file. Every
workspace `package.json` sets `"license": "UNLICENSED"` and `"private": true`, and nothing is published
to a registry. `THIRD-PARTY-NOTICES.md` is still required, because third-party licences still apply to what we
bundle. The upstream Astryx licence must be honoured wherever we adapt its code or docs. Record
the upstream licence and attribution in THIRD-PARTY-NOTICES.md.

## D-009 — Additional dependencies and icon set (owner, 2026-09-29)

The owner approved these dev-only packages. Transitive trees were checked and are all MIT/BSD/Apache/ISC:

- `prettier`, the formatter for every worktree;
- `@types/node`, types for the `tools/**` scripts;
- `@lit-labs/ssr`, used only for the WP-H SSR/DSD spike.

`@size-limit/file` counts as part of the approved `size-limit` tool (same project, MIT).

**Icons: Lucide replaces Material Symbols (supersedes D-004's default-set choice).** The owner asked
for Lucide. Checked: `lucide` 1.48.0 is ISC, with no dependencies. Its Feather-derived icons are
MIT (Cole Bemis), and both licences are on the allowlist. `@material-symbols/svg-400` is **not**
approved.

- `lucide` is a **dev/build-time source only**. `tools/icons/extract-lucide.ts` generates
  `IconDefinition` data modules (`@tecton-astryx/icons/lucide/<name>.js`, one per icon,
  tree-shakeable, gitignored build output).
- The **default set** keeps Astryx's role names (close, check, chevrons, status icons, calendar,
  clock, externalLink, menu, moreHorizontal, search, arrows, funnel, eyeSlash, viewColumns, copy,
  checkDouble, wrench, …). Each name maps to a Lucide glyph, which also covers the six roles missing
  from the Tecton glyph set. The port of the Astryx default glyphs is dropped.
- Lucide icons are stroke icons: `mode: 'stroke'`, 24×24 viewBox, stroke width 2 by default, and
  `--icon-stroke-width` is exposed.
- THIRD-PARTY-NOTICES carries the Lucide ISC licence and the Feather MIT notice.
- The Tecton glyph set is still a drop-in registry, pending provenance (D-004).

## D-010 — Browser support floor (owner, 2026-09-29)

ARCHITECTURE §1 / A-01 is confirmed.

- **Tier 1:** Chrome/Edge ≥ 137, Firefox ≥ 147, Safari ≥ 26.
- **Tier 2 (degraded):** Chrome ≥ 116, Firefox ≥ 125, Safari ≥ 17.

This is the project's recorded custom browser policy for modern-web-guidance.

## D-011 — Full parity for agentic AI coding support (owner, 2026-09-29)

The owner requires **all** of Astryx's AI coding-agent support. This supersedes the inventory's
"docs/reference capability only" reading of `@astryxdesign/cli`. Upstream surface to match (from
`packages/cli`, `apps/docsite/src/app/mcp`, `working-with-ai.doc.mjs`, `internal/vibe-tests`):

1. **Per-component agent metadata**, authored from the first component onward:
   - `keywords` (the search index);
   - a dense doc: a one-line description, dense usage, best practices as do/don't, and one-line
     property descriptions (upstream `docsDense`);
   - compound/related awareness (e.g. Table → its plugins).
2. **CLI** (`tct` bin in a new private `@tecton-astryx/cli` package). Commands:
   - `component` (list / detail / props / examples / source), `docs <topic>` (list / section), `discover`,
     `search`, and the equivalent of `hook` (controllers and utilities);
   - `doctor`, `gap-report`, and `layout` (grammar / check / expand);
   - `init --features agents` with `--agent claude|cursor|codex` and `--agent-docs-path`, which generates
     AGENTS.md, `.claude/CLAUDE.md` or `.cursorrules` blocks: component index, behavioural rules, CLI
     reference;
   - `upgrade` (stale-block detection plus `--apply`).

   Every command supports `--dense` (token-efficient) and `--json` (stable envelope, like upstream
   `./json`: `parseResponse`, `isError`, `assertResponse`).
3. **MCP server** exposing `search(query)` and `get(name)`: keyword index, compound awareness, about
   1.5K tokens per brief result, showcase examples. It ships as `tct mcp` (stdio) and as a docs-site
   HTTP route. It is in-house JSON-RPC unless the owner approves an MCP SDK; any SDK needs a licence
   check and approval first (D-007).
4. **`llms.txt`** plus JSON/Markdown reference output, generated from the CEM and docs.
5. **The "Working with AI" docs guide**, adapted to `tct` and Web Components.
6. **Agent-eval harness** equivalent to upstream `vibe-tests`: fixture prompts that check an agent
   produces correct `tct-*` code with the agent docs (internal, WP-H).

Out of scope, as per the plan: the templates library (so `template` commands and the template steps
of the agent workflow are deferred) and the playground. Upstream's non-agent CLI commands (`theme`,
`build`, `swizzle`, `integration`, `blog`) are tracked separately as a follow-up.

Consequences: CONVENTIONS §7 frontmatter gains `keywords` and a `dense` block, required for every
component including WP-F. A new work package, **WP-AI**, is added after WP-F, and the MCP server and
CLI read the same generated registry as the docs site.

## D-012 — No LGPL in the install tree; transitive dev-licence review (2026-09-29)

- `sharp`, an optional dependency of Astro, brings LGPL-3.0 `libvips` binaries. It is excluded with
  `ignoredOptionalDependencies` in `pnpm-workspace.yaml`, and the docs site must use Astro's
  passthrough image service (M6). The licence policy has no LGPL exception.
- The M1 install surfaced transitive **dev-only** licences not covered by D-007a. They are all
  permissive or file-level copyleft and never shipped: MIT-0 (@csstools ×3), BlueOak-1.0.0
  (common-ancestor-path, lru-cache, minimatch, sax), CC0-1.0 (mdn-data), Python-2.0 (argparse),
  MPL-2.0 (lightningcss + binary). They are tolerated as `pending-owner-review` by exact package and
  licence, and fail the build if they ever reach the shipped runtime tree.

## D-013 — Owner answers to the open questions (2026-09-29)

- **Q-01, licences:** approved. The owner's condition is free use in enterprise/commercial settings.
  All the tolerated dev-only licences meet it: MIT-0, BlueOak-1.0.0, CC0-1.0, Python-2.0 and MPL-2.0 are
  royalty-free, allow commercial use, and are never shipped. Mark them approved in
  `tools/licenses/policy.ts`. New licences still need review.
- **Q-02, icons:** use the owner's **Tecton domain icon set**: 18 oil & gas / subsurface glyphs, each with
  outlined and filled variants, from `rpkapps/tecton-webcomponents` branch
  `claude/busy-johnson-0wz57h`, `packages/wc/src/icons`. A copy is at `/home/user/refs/tecton-icons` with
  the source commit recorded. Provenance: supplied by the owner as part of Tecton.
  - Ship the set as `@tecton-astryx/icons/tecton/<name>.js`, registered by default under its kebab names
    (outlined) and `<name>-filled`.
  - Lucide stays the general-purpose set and the source for Astryx role names (D-009).
  - The larger 131-glyph tecton-astryx set is **not** used.
  - Glyphs that use `<g>`, `<defs>` or `<rect>` are converted to paths at build time where exact, and
    otherwise registered through the sanitised raw-SVG path (A§12). `colored` icons keep their colours.
- **Q-03 (top-nav text 4.0:1 light) and Q-04 (dark outlined input border):** accepted as designed. They
  stay in `contrast.allow.json` with "owner accepted (D-013)".
- **Q-05, `--color-border-emphasized` 2.2:1 (orchestrator decision):** allowed for decorative separation
  only. A component whose border is the sole indicator of a control boundary or of state (WCAG 1.4.11)
  must use a border token that measures ≥ 3:1 on its surface. Component review enforces this, and the
  contrast allowlist entry says so.
- **Q-06, provisional values:** "Use the Tecton palette/tokens throughout." Resolution:
  - Headings 3–6 are Tecton's own scale (large 16 / medium 14 / small 12 / tiny 10). They are
    Tecton-derived, not provisional.
  - Letter-spacing: Tecton specifies none (`design/components/button.md`), so `normal`. Not provisional.
  - Destructive button: Tecton has no destructive variant. Keep the Astryx `destructive` variant and style
    it only from Tecton `--tecton-color-status-error-*` roles. Tecton-derived.
  - Data-viz colours come from Tecton accent hues and status roles: palette-only, proposed mapping.
  - Shadows and elevation follow tecton-astryx: black-alpha shadows with palette-hued insets. Menus,
    popovers and panels follow Tecton's "no drop shadow; border plus recessed surface" per-component
    overrides.
  - Motion, breakpoints and z-index are not brand tokens and Tecton has none, so they keep Astryx values
    labelled `astryx-retained` rather than provisional.
  - **Rule:** every colour a component paints resolves to a Tecton token. No hex, rgb or hsl literals and
    no palette variables in component CSS (Stylelint), and the token build has no unresolved colours.
- **Q-07, MCP:** approved. Use `@modelcontextprotocol/sdk` 1.31.0 (MIT; tree of 91 packages, all
  MIT/ISC/BSD, checked 2026-09-29) as a dependency of the private `@tecton-astryx/cli` package only. It
  is never a dependency of the component packages.

## D-014 — Correction: CSS anchor positioning is not native in Safari 26 (2026-09-29)

Found by WP-D and confirmed against `web-features` (data behind Baseline): the `anchor-positioning`
feature is supported from **Safari 27 / iOS 27** and is not Baseline. ARCHITECTURE A-01/A-09 assumed Safari 26.
The support floor (D-010) is unchanged. Consequences:

- Positioning stays feature-detected (`features.anchorPositioning`, `features.implicitAnchor`). The lazy
  `@floating-ui/dom` fallback is therefore **also a Tier-1 code path in Safari 26**, not only a
  Tier-2 one. Placement fidelity is promised on both paths and tested on both: the Tier-2 run forces
  the fallback.
- Size budgets must count the fallback chunk for Safari 26 users. That chunk is lazy and never
  loads where the CSS path works.
- Docs and ARCHITECTURE wording is corrected: Chrome/Edge 137+ and Firefox 147+ position with CSS;
  Safari 26 positions with the fallback.
- Features listed in ARCHITECTURE §1.2 rule 2 ("available in every Tier-1 engine") must be checked
  against `web-features` data before a component depends on them natively. Any other mismatch
  found is fixed the same way.

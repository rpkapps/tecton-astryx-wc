# tecton-astryx-wc — Architecture (ARC-001, binding)

**Status:** binding for all implementation work. Written 2026-09-29 by the lead architect.
**Inputs:** `docs/plan/PROJECT-BRIEF.md`, `DECISIONS.md` (D-001…D-008), `IMPLEMENTATION-PLAN.md`,
`docs/research/*`. Where research offered options, this document picks one. A change to anything
here needs an orchestrator decision (new `D-xxx` entry), not a local deviation.

Companion documents: `docs/CONVENTIONS.md` (implementer checklist), `docs/plan/WORK-BREAKDOWN.md`
(work packages), `AGENTS.md` (repo rules for every agent).

Guide ids in brackets are modern-web-guidance guides (skill `2026_09_04-7de96777`),
e.g. `[mwg:form-associated-custom-elements]`.

---

## 0. Architecture decision register

| Id | Decision | One-line reason |
| --- | --- | --- |
| A-01 | Support floor = Chrome/Edge ≥ 137, Firefox ≥ 147, Safari/iOS ≥ 26 (§1). | First versions where Popover + `showPopover({source})` implicit anchors + CSS anchor positioning + ARIA element reflection + `:state()` + `requestClose()` all exist; this equals upstream Astryx's Tier 1 plus implicit anchors. |
| A-02 | pnpm workspace; packages `@tecton-astryx/{tokens,core,icons,locales,components,testing}`; all `private`, `UNLICENSED` (D-008). | Headless core (reusable by lab/charts) split from styled elements (Spectrum gen2 model). |
| A-03 | TypeScript **6.0.x** with `experimentalDecorators` + `useDefineForClassFields: false`. | typescript-eslint supports TS < 6.1 (TS 7 is not usable yet); legacy decorators are what the CEM analyzer (bundled TS 5.4) reads reliably. Verified in a throwaway spike. |
| A-04 | Component CSS authored as `*.styles.css`, compiled by an **in-house Vite plugin** into Lit `css` modules with build-time token fallbacks. | Real CSS tooling (stylelint) without an unapproved plugin (D-007). `.styles.css` avoids the Rolldown `preserveModules` name clash between `x.ts` and `x.css` (verified). |
| A-05 | Build = Vite 8 library mode (Rolldown, `preserveModules`) + `tsc --emitDeclarationOnly`. | One toolchain for dev, tests, docs and build; verified working. |
| A-06 | Shadow DOM is decided per family (§8). Relationship targets referenced from author light DOM are rendered as **owned light-DOM satellites**. | IDREFs never cross roots; element reflection only points outward (§8.2). |
| A-07 | Text fields: native `<input>` in the control's shadow root by default; opt-in author-slotted `<input slot="input">` mode for autofill-critical fields (§9.8). | Uniform, framework-safe default; a real escape hatch for password managers. |
| A-08 | One document-level layer stack; `<dialog>` for modals, `popover="manual"` for everything floating (§9.9). | Deterministic nesting across shadow roots; native top layer; no focus-trap code. |
| A-09 | Positioning: CSS anchor positioning via implicit anchors first; lazy `@floating-ui/dom` fallback only when the probe fails (§9.10). Virtual anchors (pointer) use a 0×0 fixed anchor element on the CSS path. | Matches upstream `useLayer`. **D-014:** Safari 26 lacks native anchor positioning, so there the lazy fallback is a Tier-1 path too; it never loads where the CSS path works. |
| A-10 | Context via an **in-house implementation of the Context Community Protocol** (`@tecton-astryx/core/context`). | `@lit/context` is not approved (D-007); the protocol is small and interoperable. |
| A-11 | Events: native `input`/`change`/`click` for native concepts; `tct-<x>-change` cancelable intent events; `tct-after-<x>-change` commit events only where the commit is asynchronous; one `Event` subclass per name (§7.6). | Platform `beforetoggle`/`toggle` model, Web Awesome typing model, no feedback loops. |
| A-12 | i18n: upstream's 30 catalogs (+ generated pseudo) shipped as `@tecton-astryx/locales`; ICU via `intl-messageformat` behind `core/i18n/format.ts`; locale = nearest `lang`. | D-006 locale target; approved dependency; one resolution mechanism. |
| A-13 | Icons: registry + `tct-icon`; default set = Astryx role names mapped to **Lucide** glyphs, generated at build time from the dev-only `lucide` package (D-009). The owner's Tecton domain icon set (18 glyphs, outlined and filled) ships in the default set (D-013 Q-02). | Owner chose Lucide (ISC/MIT); no runtime icon dependency. |
| A-14 | Every generated artifact is **gitignored** and produced by `pnpm generate`; only snapshots that act as API guards are committed, one file per component folder. | Parallel worktrees never conflict on generated files. |
| A-15 | Docs: Astro 7 + Starlight 0.42; component pages generated from CEM + `*.docs.md` + `examples/*.html` + `parity.json`; Starlight UI progressively replaced with our elements (WP-D). | Approved; search, sidebar and content collections for free; plan §8 docs-built-with-components satisfied incrementally. |
| A-16 | Tests: Vitest 5 browser mode + Playwright provider; local Chromium via `executablePath`; CI runs Chromium, Firefox, WebKit. | Approved; proven in the owner's previous project and the spike. |
| A-17 | SSR: v1 is **SSR-safe, not SSR-rendered** (§14). | Lit SSR is still labs; measure in WP-H before promising DSD output. |
| A-18 | Tooltip, field label/description/status are satellites implemented as small internal custom elements with their own shadow root (§8.2). | Same-tree IDREFs **and** encapsulated styles. |

---

## 1. Browser support floor and Baseline policy

### 1.1 Tiers

| Tier | Engines | Promise | Tested |
| --- | --- | --- | --- |
| **1 — supported** | Chrome/Edge ≥ 137 (desktop, Android), Firefox ≥ 147, Safari ≥ 26 (macOS, iOS/iPadOS) | Full fidelity: every documented behaviour, keyboard contract, form contract and placement. | CI: Playwright Chromium, Firefox, WebKit (current). Local: Chromium 141 (`/opt/pw-browsers/chromium`). Manual AT matrix per release. |
| **2 — degraded** | Engines with FACE + Popover + ElementInternals ARIA (Chrome ≥ 116, Firefox ≥ 125, Safari ≥ 17) | Renders, submits, is keyboard operable, never throws. Layers are positioned by the lazy Floating UI fallback. Cross-root ARIA relationships fall back to copied text. `:state()` hooks may not match. | Emulated in CI: one Chromium run with features forced off via `core/features` overrides (§15.5). |
| Below Tier 2 | — | Unsupported. No polyfills ship. Modules must still import without throwing. | Server-import test only. |

Rationale: Tier 1 is the first set in which Popover, `showPopover({source})` (implicit anchoring),
core CSS anchor positioning (Chrome/Edge and Firefox only; Safari 26 uses the positioning fallback, D-014), ARIA element reflection, `:state()`, `dialog.requestClose()` and
`light-dark()` are all native. It is upstream Astryx's Tier 1 (`browser-support.doc.mjs`, spec
AST-013) raised from Chrome 125 to 137 for implicit anchors.

### 1.2 Baseline policy (custom policy per the skill)

This is the project's recorded browser policy (also in `AGENTS.md`):

1. **Baseline Widely available**: use freely, no fallback.
2. **Available in every Tier-1 engine** (Newly available or better): use natively, **no polyfill**.
   APIs whose absence would throw or silently break a core feature go through `core/features.ts`
   detection so Tier 2 degrades instead of crashing (§9.5). Examples: Popover, element reflection,
   `internals.states`, `showPopover({source})`, `requestClose()`, `light-dark()`.
3. **Not in every Tier-1 engine**: progressive enhancement only, feature-detected, following the
   guide's fallback. Current list: `ariaNotify` (Safari 27), invoker commands (Safari 26.2),
   `CloseWatcher`, `<dialog closedby>`, `moveBefore()`/`connectedMoveCallback`,
   `hidden="until-found"`, Reference Target, scoped custom element registries, `popover="hint"`,
   `interestfor`, anchored container queries, CSS anchor positioning in Safari 26 and `@scope` in
   Chrome < 143 (D-014), `field-sizing`, `scrollbar-color` (Safari 26.2),
   `contrast-color()`, Sanitizer API, customizable `<select>`.
4. **Never used**: `:host-context()`, customized built-ins (`is=`), CSS module scripts at runtime,
   `@function`, the `overlay` property for exit animations.

Always search/retrieve the guide before relying on a feature; if the guide's data disagrees with
this list, the guide wins and the list is updated through the orchestrator.

---

## 2. Repository and packages

### 2.1 Layout

```text
tecton-astryx-wc/
  AGENTS.md  CLAUDE.md  THIRD-PARTY-NOTICES.md  README.md
  package.json               root, private; scripts only; all devDependencies live here
  pnpm-workspace.yaml        packages/*, apps/*, tools
  tsconfig.base.json         shared compiler options (A-03)
  vitest.config.ts           browser + node projects (§15)
  eslint.config.js  stylelint.config.js  .editorconfig
  .size-limit.js             programmatic, globs component folders (§18.4)
  .github/workflows/ci.yml
  packages/
    tokens/       @tecton-astryx/tokens      token inputs, generator, CSS + TS outputs, fonts
    core/         @tecton-astryx/core        headless runtime: base class, mixins, controllers,
                                             context, events, i18n, icons registry, security, date
    icons/        @tecton-astryx/icons       icon sets as data modules (default = Astryx port)
    locales/      @tecton-astryx/locales     30 upstream catalogs (+ pseudo) as lazy ES modules
    components/   @tecton-astryx/components  every public tct-* element, shared styles, define entries
    testing/      @tecton-astryx/testing     test utilities and standard suites (dev only)
    lab/ charts/ richtext/ vega/             extension packages, created by WP-X batches
  apps/
    docs/         Astro + Starlight site (private)
    integration/  framework harness apps (WP-I)
  tools/          @tecton-astryx/tools: generators, checks, Vite plugin, stylelint plugin, CEM plugins
  docs/           plan/, research/, ARCHITECTURE.md, CONVENTIONS.md
  reports/        generated (gitignored): parity, size, i18n, licences, a11y
```

Every `package.json` in the workspace has `"private": true` and `"license": "UNLICENSED"`
(D-008). There is no LICENSE file and nothing is published to a registry. The package structure,
`exports` maps and `sideEffects` still matter: apps consume the packages through the workspace,
tarballs or git, and the CDN bundle is a build artifact the owner can self-host.

### 2.2 Package responsibilities and dependencies

| Package | Depends on | Contains | Never contains |
| --- | --- | --- | --- |
| `tokens` | (dev) fontsource packages, capsize | inputs + hash lock, normaliser, generator, `dist/*.css`, `dist/tokens.{js,d.ts,json}` | runtime JS beyond token metadata |
| `core` | `lit`, `intl-messageformat`, `@floating-ui/dom` (lazy), `@internationalized/date`, `dompurify` (lazy), `@tecton-astryx/locales` | `TctElement`, `defineElement`, events, context protocol, controllers, mixins, i18n, icon registry, `features`, security, date | tag registrations, CSS files, component templates |
| `icons` | — | `IconDefinition` data modules; the default set; generated per-icon modules | components |
| `locales` | — | `src/catalogs/*.json` (copied from upstream, hash-locked), generated `dist/<tag>.js`, `dist/en/<namespace>.js`, `dist/pseudo.js`, alias table | runtime logic |
| `components` | `core`, `icons`, `locales`, `tokens` (CSS at build), `lit` | `src/<folder>/…` (§4), `src/styles/*.styles.css` shared modules, generated barrels, autoloader, CDN build | imports of `@floating-ui/dom`, `intl-messageformat`, `dompurify`, `@internationalized/date` (only through `core`) |
| `testing` | `core`, `axe-core`, `vitest` | fixtures, a11y helpers, form harness, standard suites | anything shipped |

WP-F declares **every approved runtime dependency** in the right `package.json` up front, so no later
work package edits a `package.json` or the lockfile.

### 2.3 Build and outputs

- **Source → dist:** Vite 8 library mode (`build.lib`, formats `es`), `rollupOptions.output`
  `{ preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].js' }`,
  externals = every bare import (`lit`, `@tecton-astryx/*`, approved deps). Target `es2023`, not
  minified (consumers minify). Declarations: `tsc -b --emitDeclarationOnly` per package.
- **CSS modules:** `tools/vite-plugin-tct-css.ts` (in-house, ~60 lines) transforms any
  `*.styles.css` import into `import {css} from 'lit'; export default css\`…\``. Steps: resolve
  nothing (no `@import` allowed in component CSS), inject token fallbacks (§5.5), escape backticks
  and `${`. The same plugin is used by the Vitest config, the docs site and the build.
  Every class declares `static override styles: CSSResultGroup = [...]` explicitly so emitted
  `.d.ts` files never reference a `.css` module.
- **Import specifiers:** relative imports use the `.js` extension; cross-package imports use package
  subpaths (never `../../core/src`). Inside the monorepo the custom export condition **`tct-source`**
  points subpaths at `src/*.ts`; Vite (`resolve.conditions`) and TypeScript (`customConditions`) enable
  it, so tests and docs run without a prior build.
- **Tools scripts** (`tools/**/*.ts`) run directly on Node 22 with type stripping
  (`node tools/x.ts`): erasable syntax only (no enums, namespaces, parameter properties or
  decorators), `.ts` extensions in their own relative imports. They never import package source;
  they read files as data (CEM, JSON, CSS, globbed paths).

### 2.4 `exports` maps (wildcards only: adding a component never edits them)

`@tecton-astryx/components`:

```jsonc
{
  "name": "@tecton-astryx/components", "private": true, "license": "UNLICENSED", "type": "module",
  "exports": {
    ".":                { "tct-source": "./src/generated/index.ts",  "types": "./dist/generated/index.d.ts",  "default": "./dist/generated/index.js" },
    "./define.js":      { "tct-source": "./src/generated/define-all.ts", "types": "./dist/generated/define-all.d.ts", "default": "./dist/generated/define-all.js" },
    "./autoloader.js":  { "tct-source": "./src/autoloader.ts", "types": "./dist/autoloader.d.ts", "default": "./dist/autoloader.js" },
    "./custom-elements.json": "./custom-elements.json",
    "./tecton.css":     "./dist/tecton.css",
    "./light-dom.css":  "./dist/light-dom.css",
    "./cloak.css":      "./dist/cloak.css",
    "./cdn/*":          "./dist/cdn/*",
    "./package.json":   "./package.json",
    "./*.js":           { "tct-source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" },
    "./*":              { "tct-source": "./src/*/define.ts", "types": "./dist/*/define.d.ts", "default": "./dist/*/define.js" }
  },
  "sideEffects": ["./dist/*/define.js", "./dist/generated/define-all.js", "./dist/autoloader.js", "./dist/cdn/**", "./src/*/define.ts", "**/*.css"]
}
```

| Specifier | Resolves to | Effect |
| --- | --- | --- |
| `@tecton-astryx/components/button` | `dist/button/define.js` | registers the family's tags (+ dependencies) and re-exports its classes |
| `@tecton-astryx/components/button/tct-button.js` | `dist/button/tct-button.js` | class only, no registration (scoped registries) |
| `@tecton-astryx/components/define.js` | generated | registers everything |
| `@tecton-astryx/components` | generated barrel | all classes and types, no registration |
| `@tecton-astryx/components/autoloader.js` | autoloader | lazy registration on sight |

`@tecton-astryx/core` exposes `"./*": {tct-source: "./src/*.ts", types, default}` (e.g.
`@tecton-astryx/core/controllers/layer.js`) plus a generated barrel `"."`; `sideEffects: false`.
`@tecton-astryx/tokens` exposes `./tokens.css`, `./palette.css`, `./fonts.css`, `./tecton.css`,
`./fonts/*`, `./tokens.js` (metadata), `./tokens.json`. `@tecton-astryx/locales` exposes `./*.js`
(`fr-FR.js`, `en/pagination.js`, `pseudo.js`) and `./aliases.js`.

### 2.5 Registration, autoloader, CDN

- Class modules are side-effect free. Registration happens only in `define.ts` via
  `defineElement(Ctor)` (§9.2), which also registers `Ctor.dependencies` (elements the class renders in
  its own shadow root).
- **Autoloader** (`src/autoloader.ts`, uses the generated `tag → folder` map): one
  `MutationObserver` on `document`, lazily `import()`s `./<folder>/define.js` for unseen `tct-*`
  tags, honours `<html data-tct-preload="button dialog">`, and exports `discover(root)` and
  `observe(root)` for application shadow roots. Elements our components render internally are
  defined through `dependencies`, so the autoloader never needs to watch our own shadow roots.
- **CDN bundle** (`dist/cdn/`): a second Vite build with code splitting and **no externals** (lit and
  approved deps bundled), one entry per `define.ts` + `autoloader.js` + `define.js`. Usage:
  `<script type="module" src=".../cdn/autoloader.js">` plus `<link rel="stylesheet" href=".../tecton.css">`.
  Self-hosted only (D-008).

### 2.6 Versioning

All packages share one version. The public API (tags, attributes, properties, methods, events with
flags, slots, parts, custom states, documented custom properties, token names) follows SemVer even
without publishing. API snapshots (§3) make every change visible in review. Deprecations keep an alias
for one major.

---

## 3. Parallel-safety rules and generated artifacts

**Rule: adding or changing a component edits only files inside its own component folder(s)**, plus new
files it is explicitly assigned in `packages/core/src/` (WORK-BREAKDOWN names them). Everything that
aggregates across components is derived from globs by `pnpm generate`.

| Artifact | Derived from | Location | Committed? |
| --- | --- | --- | --- |
| `exports` / `sideEffects` | wildcards (§2.4) | `package.json` | yes, static, never edited per component |
| Class barrel, define-all | glob `src/*/define.ts` (named re-exports; duplicate export names fail) | `components/src/generated/{index,define-all}.ts` | no |
| Autoloader map | CEM `tagName` × folder | `components/src/generated/autoloader-map.ts` | no |
| Core barrel | glob `core/src/**/*.ts` minus internals/tests | `core/src/generated/index.ts` | no |
| `HTMLElementTagNameMap` | `declare global` in each `tct-*.ts` | per class file | yes (source) |
| `GlobalEventHandlersEventMap` | `declare global` in each event file | `core/src/events/*.ts` | yes (source) |
| Custom Elements Manifest | analyzer + plugins over `components/src/*/tct-*.ts` and `core/src/events` | `components/custom-elements.json` | no |
| Per-component API snapshot | CEM slice for the folder's tags | `components/src/<folder>/__snapshots__/api.json` | **yes** (updated with `pnpm api:update`; `api:check` fails on drift) |
| Docs component pages | CEM + `*.docs.md` + `examples/` + `parity.json` | `apps/docs/src/content/docs/components/<category>/<folder>.mdx` | no |
| Docs sidebar | Starlight `autogenerate` per category directory | `apps/docs/astro.config.mjs` (static list of the 11 upstream categories) | yes, static |
| Tests | glob `packages/*/src/**/*.test.ts`, `*.node.test.ts`, `tools/**/*.test.ts` | — | — |
| Parity report | upstream manifest + every `parity.json` + test/doc presence | `reports/parity.{json,md}`, docs "Parity status" page | no |
| Size budgets | glob of `define.ts` + `parity.json.sizeBudgetKb` or complexity default | `.size-limit.js` computes at run time | — |
| `light-dom.css` | glob `components/src/*/*.light.css` | `components/dist/light-dom.css` | no |
| `cloak.css` | CEM tags + `@cloakDisplay` JSDoc | `components/dist/cloak.css` | no |
| Token outputs | `tokens/src/inputs/*` + bindings | `tokens/dist/*` | no |
| Token name snapshot | generator | `tokens/snapshots/token-names.json` | **yes** |
| English messages per namespace | `locales/src/catalogs/en.json` + glob `components/src/*/*.messages.json` | `locales/dist/en/<ns>.js` | no |
| i18n missing report | same + all catalogs | `reports/i18n-missing.json` | no |

Consequences:

- `pnpm generate` runs first in `dev`, `test`, `typecheck`, `build`, `docs:*` and `check`.
- **Never edit a generated file by hand.** Never commit one (`.gitignore` covers `**/generated/`,
  `**/dist/`, `custom-elements.json`, generated docs pages, `reports/`).
- Shared files that WP-F creates and later packages must not edit: root configs, `package.json`
  files, `pnpm-lock.yaml`, `tools/**`, `packages/core/src/**` files owned by another package,
  `packages/components/src/styles/**`, `packages/tokens/**`, `apps/docs/astro.config.mjs`.
  A work package that needs such a change records it under `requests` in its `parity.json` and in its
  hand-off report; the orchestrator applies it.

---

## 4. Component folder anatomy

One folder per **top-level upstream component or cycle group**, kebab-case (WORK-BREAKDOWN assigns
every folder). Subcomponents live in their parent's folder.

```text
packages/components/src/<folder>/
  tct-<name>.ts              one element class per file; subcomponents get their own tct-<sub>.ts
  tct-<name>.styles.css      shadow-root styles for that class (one per class that renders)
  tct-<name>.light.css       only for light-DOM families (§8): styles in @layer tecton.light-dom
  <folder>.types.ts          optional: exported string-literal unions + `as const` arrays
  <folder>.messages.json     optional: new English messages not in upstream catalogs (ids @tct.<folder>.<key>)
  <folder>.api.ts            optional: imperative module functions (toast(), openAlertDialog())
  define.ts                  the family's registration entry
  tct-<name>.test.ts         browser tests; more files allowed: tct-<name>.<topic>.test.ts
  <folder>.docs.md           authored documentation (frontmatter + required sections, §16.3)
  examples/<example-id>.html runnable examples (preview and displayed source)
  parity.json                parity record (schema tools/schemas/parity.schema.json)
  __snapshots__/api.json     committed public-API snapshot (generated; never hand-edited)
```

### 4.1 Contents

**`tct-<name>.ts`**

```ts
import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import styles from './tct-button.styles.css';
import {TctSpinner} from '../spinner/tct-spinner.js';
import type {ButtonVariant} from './button.types.js';

/**
 * Triggers an action. Prose goes before the first tag.
 *
 * @summary Triggers an action when activated.
 * @tag tct-button
 * @upstream Button
 * @slot - The label.
 * @slot icon - Leading icon.
 * @csspart button - The native button (Astryx target `astryx-button`).
 * @cssprop --button-focus-offset - Focus ring offset. Default 1px (Tecton).
 * @cssstate loading - A clickAction is pending.
 * @fires click - Native, retargeted from the inner button.
 * @cloakDisplay inline-flex
 */
export class TctButton extends TctElement {
  static override readonly tagName = 'tct-button';
  static override readonly dependencies = [TctSpinner];
  static override styles: CSSResultGroup = [base, focusRing, styles];
  /** Visual emphasis. */
  @property({reflect: true}) variant: ButtonVariant = 'secondary';
  // …
}

declare global {
  interface HTMLElementTagNameMap { 'tct-button': TctButton }
}
```

**`define.ts`** (the whole file):

```ts
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctButton} from './tct-button.js';
defineElement(TctButton);
export {TctButton};
```

Providers are defined before consumers (list them first). Named exports only, never `export *`.

**`parity.json`** (one record per upstream entry the folder implements):

```jsonc
{
  "$schema": "../../../../tools/schemas/parity.schema.json",
  "folder": "button",
  "workPackage": "WP-F",
  "entries": {
    "core.button": {
      "tag": "tct-button",
      "status": "implemented",            // not-started | in-progress | implemented | verified
      "upstream": {"name": "Button", "path": "packages/core/src/Button/Button.tsx", "commit": "ca632c6"},
      "api": [                              // one row per upstream prop/callback/slot/ref; all must be covered
        {"upstream": "variant", "kind": "prop", "target": "variant", "as": "attribute", "reflect": true, "default": "secondary"},
        {"upstream": "isDisabled", "kind": "prop", "target": "disabled", "as": "attribute"},
        {"upstream": "onClick", "kind": "event", "target": "click", "as": "native-event"},
        {"upstream": "clickAction", "kind": "prop", "target": "clickAction", "as": "property"},
        {"upstream": "xstyle", "kind": "prop", "as": "waived", "reason": "A-xstyle: use class/style/::part/custom properties"}
      ],
      "hooks": [{"upstream": "useButtonGroup", "target": "buttonGroupContext", "as": "context"}],
      "keyboard": [{"keys": "Enter, Space", "action": "Activates the button", "when": "not disabled"}],
      "form": {"formAssociated": true, "notes": "type=submit|reset submitter semantics (§9.7)"},
      "differences": [{"id": "BUTTON-01", "type": "approved-api-difference", "text": "…"}],
      "tests": {"render": true, "a11y": true, "api": true, "keyboard": true, "form": true, "events": true, "rtl": true, "forcedColors": true, "i18n": true},
      "provisional": [],
      "tokenRequests": [],
      "requests": [],
      "sizeBudgetKb": null
    }
  }
}
```

`tools/check-parity.ts` validates it: every upstream prop name in the manifest entry appears in
`api` (mapped or `waived` with a reason), every `target` exists in the CEM, statuses are consistent
with test and docs presence.

**`examples/<id>.html`**: an HTML fragment (no `<html>`/`<body>`), at most one
`<script type="module">` scoped by a root element id prefixed with the example id. The same file is the
rendered preview and the displayed source. Frontmatter-like first-line comment
`<!-- title: Variants; description: … -->`.

---

## 5. Token pipeline

### 5.1 Inputs (copied into `packages/tokens/src/inputs/`, hash-locked)

| File | Source | Role |
| --- | --- | --- |
| `tecton.tokens.json` | `tecton-webcomponents/packages/wc/tokens/` (sha256 `4731ddd0b9f362261c77fbd4531dfc4cc0d924406eeb5636a8442d4a951367f3`) | immutable primitives (1,820 colours) |
| `tecton-tokens.css` | `tecton-webcomponents/packages/wc/tokens/tecton-tokens.css` | **authoritative role values, light and dark, and typography where defined (D-001)** |
| `semantic-map.json` | `docs/research/tecton-semantic-map.json` | which Tecton role binds to which Astryx token; theme-local tokens; component tokens; typography; radius; spacing; sizing; focus; motion; breakpoints; z-index |
| `bindings.overrides.json` | authored (WP-F) | D-001 rebinds with reasons (e.g. `--color-text-accent` / `--color-icon-accent` → an ink role because the export's `action.primary.adornment` is 1.42:1 as ink) |
| `astryx-tokens.json` | extracted once from upstream `tokens.stylex.ts`, `dataTokens.ts`, `syntax/tokens.ts`, `onMediaTokens.ts` at `ca632c6` | upstream name inventory + defaults (coverage check, verification theme) |
| `tailwind-v4-theme-names.json` | snapshot | collision check |

`inputs.lock.json` records sha256 per input; `tokens:check` fails on mismatch.

### 5.2 Value resolution (D-001, D-002)

For every emitted semantic token and mode:

1. If `bindings.overrides.json` has an entry → use it (must name a palette path).
2. Else if the semantic map row has `exportAlt` → use the **export** value for that mode (the
   generator also parses `tecton-tokens.css` and asserts the export variable's value equals the palette
   path's value).
3. Else → the map's `light`/`dark` path (tecton-astryx derivation or upstream default).
4. Every value must resolve to a palette path or be a structural literal (lengths, `transparent`,
   durations). A colour that resolves to no palette path is an error unless allowlisted in
   `unresolved.allow.json` with a reason (D-001: "flag any that don't").
5. Status per token: `tecton-export`, `tecton-astryx`, `upstream-default`, **`astryx-retained`** or
   **`provisional`**. D-013 Q-06 settles what has no Tecton token: motion (10 tokens), breakpoints and
   z-index keep the Astryx values on purpose and are `astryx-retained`; headings 3-6 (Tecton's
   large/medium/small/tiny), letter-spacing (`normal`) and the destructive button (bound to
   `--tecton-color-status-error-*`, recorded in the token metadata) are Tecton-derived; only data-viz colours
   (a proposed mapping from palette colours), `--size-element-lg` and the pipeline-defined extras stay
   `provisional`. `provisional.json` holds the three groups.

### 5.3 Normalisation

- Palette names follow `tecton-theme.md` §2.3 exactly: `--tecton-palette-<segments>` (strip `(…)`
  annotations into metadata, `%` → `pct`, camelCase → kebab, lowercase, value-plus-children nodes emit
  their own value and children).
- The generator writes `dist/palette.manifest.json` (`name → sourcePath → value → $extensions →
  alias`) and fails on any collision, case-fold collision, or overlap with `--tecton-color-*` /
  `--color-*` names.

### 5.4 Outputs (`packages/tokens/dist/`, gitignored)

| File | Contents |
| --- | --- |
| `tokens.css` | Starts with `@layer tecton.reset, tecton.tokens, tecton.light-dom;`. Inside `@layer tecton.tokens`: `:where(:root)` with `color-scheme: light dark`, **light values** for every token (fallback path), `accent-color`; `@media (prefers-color-scheme: dark) { :where(:root:not([data-theme="light"])) {…dark} }`; `:where([data-theme="dark"])` / `:where([data-theme="light"])` blocks that also set `color-scheme`, `background-color`, `color`, `accent-color`; `@supports (color: light-dark(red, red)) { :where(:root) { --x: light-dark(<l>, <d>) … } }`; `[data-media-theme="dark"\|"light"]` blocks (onDark/onLight); non-colour tokens (spacing, size, radius, border, focus, shadow, motion, typography, font stacks, `--font-size-adjust-*`); Tecton component defaults (`--button-focus-offset: 1px`); document-level `@property` rules only for animation targets. Each declaration carries `/* <source path(s)> [provisional] */`. |
| `palette.css` | Opt-in: all 1,820 `--tecton-palette-*` on `:where(:root)` in `@layer tecton.tokens`. Component CSS may never reference it (lint). |
| `fonts.css` | `@font-face` for `"Figtree Variable"` (variable wght 300–900, latin + latin-ext, `unicode-range`) and `"IBM Plex Mono"` (400, 500), `font-display: swap`, files copied to `dist/fonts/` with their OFL licence; metric-matched fallback faces `"Figtree Fallback"` (local Arial) and `"IBM Plex Mono Fallback"` (local Courier New) with `size-adjust`/`ascent-override`/`descent-override`/`line-gap-override` **computed with Capsize at build time**. Stacks (D-003): `--font-family-body: "Figtree Variable", Figtree, "Figtree Fallback", Helvetica, Arial, sans-serif`; code: `"IBM Plex Mono", "IBM Plex Mono Fallback", Consolas, Monaco, monospace`. Never imported by components. |
| `tecton.css` | `tokens.css` + `fonts.css` + components' `light-dom.css` + `cloak.css` (assembled by the components build into `components/dist/tecton.css`; tokens only provides the first two). |
| `tokens.js` + `.d.ts` | `export const tokens: Record<TokenName, TokenMeta>` with `{name, category, light, dark, lightPath, darkPath, source, status, description}`; `type TokenName`; `tokenVar(name)`. |
| `tokens.json` | same data for docs and tools. |
| `fallbacks.json` | `token name → light value` for the CSS plugin (§5.5). |

### 5.5 Build-time fallbacks

The CSS plugin rewrites `var(--<token>)` (no fallback, name present in `fallbacks.json`) to
`var(--<token>, <light value>)`. Without `tokens.css` components render a legible light Tecton UI with
system fonts; this is a safety net, not a mode (styling.md §4.2).

### 5.6 Checks (`pnpm tokens:check`, part of `pnpm check`)

- Input hashes; 1,820 palette entries; zero collisions.
- Every export role value resolves to its stated palette path (D-001); the 3 swapped dark text-field
  roles take the export values.
- **Astryx coverage**: every upstream portable token name (258) is emitted; no emitted non-`--tecton-`
  name is unknown upstream.
- Token-name snapshot (`snapshots/token-names.json`) equals the emitted set.
- Tailwind v4 collision list equals the documented list (`--font-weight-*` etc.).
- **Contrast matrix** (static, in-house WCAG 2.x luminance with alpha compositing over the actual
  backdrop): text roles ≥ 4.5:1, icon/boundary roles and the focus ring ≥ 3:1 on every surface, both
  modes. Known design shortfalls live in `contrast.allow.json` with a reason (e.g.
  `--color-border-emphasized` 2.2:1). D-005 inverted-surface double ring is checked here.
- The **provisional** set (data-viz 56, `--size-element-lg`, the 7 pipeline extras) and the
  **astryx-retained** set (motion 10; non-tokens: breakpoints, z-index) are exact and disjoint (D-013); the
  Tecton-derived items are checked (headings 3-6 follow the export's large/medium/small/tiny sizes,
  letter-spacing is `normal` everywhere, the destructive button binds only emitted
  `--tecton-color-status-error-*` roles). Docs list all three groups on "Differences and open items".

---

## 6. Styling contract

Everything here restates `docs/research/styling.md` §16 as rules; that document explains the why.

### 6.1 Authoring

- One `tct-<name>.styles.css` per rendering class; no `@import`; no preprocessors.
- Every sheet's rules live in layers. `base.styles.css` begins with `@layer reset, component, state, a11y;`
  and each component sheet uses those four names only. Unlayered rules are forbidden (lint).
- Shared modules in `packages/components/src/styles/` (WP-F owns them):
  `base` (box-sizing, `[hidden]`, form-control `font: inherit`), `focus-ring` (`.focus-ring:focus-visible`,
  `.focus-within-ring:has(:focus-visible)` using outline longhands), `motion` (shared keyframes,
  reduced-motion helpers), `sr-only`, `slotted-icon`, `scroll` (scrollbar tokens with `@supports not`
  webkit fallback), `field` (field chrome: label, description, status, input box, sizes), `layer`
  (popover/dialog surface reset, enter/exit keyframes, `data-placement` arrow rules).
  Order in `static styles`: `base`, other shared modules, component sheet.

### 6.2 Host rules

- `:host` = **layout only**: `display`, `vertical-align`, `position` (only when a controller writes
  coordinates), sizing/flex participation, inherited text properties (`font-*`, `color`,
  `line-height`, `text-align`), `opacity`, `cursor`, `contain`. Never background, border, padding,
  margin, radius, shadow or outline (application resets such as Tailwind preflight beat `:host`).
  Paint lives on an inner element with a `part`.
- Every host sets `display` and honours `[hidden]` (from `base`).
- Variants and sizes: reflected host attributes read as `:host([variant="primary"]) .button { --_bg: … }`.
  Variant rules only set **private custom properties on the consuming inner element**; base rules
  consume them once.
- Context-resolved values (size from a provider, placement after a flip, orientation from a group) are
  rendered as `data-*` attributes on the inner element; CSS reads those.
- Conditions go inside `:host(...)`, e.g. `:host(:dir(rtl)[placement="start"])`; never nested `&:dir()`
  on a `:host()` rule; no `:where()` inside `:host()`.
- Hover rules only inside `@media (hover: hover)` and exclude disabled with
  `:not(:disabled, [aria-disabled="true"])`. Specificity ≤ one class (use `:where()`).

### 6.3 Public styling API (admission rules)

In order of preference: tokens → attributes → `::part()` → `:state()` → admitted component custom
properties → `::slotted()` small adjustments.

| Hook | Admission rule | Naming | Documented with |
| --- | --- | --- | --- |
| Part | One per Astryx theming target (`themingTargets` in the manifest) or stable painting anatomy entry. Never on a wrapper that paints nothing. Composites re-export child parts with `exportparts` so qualified target names survive (`exportparts="popup: selector-popup"`). | Astryx target name minus component prefix, kebab | `@csspart` |
| Custom state | Read-only runtime state the component owns (`loading`, `open`, `checked`, `user-invalid`, `highlighted`). Internal CSS **never** depends on `:state()`. | kebab | `@cssstate` |
| Component custom property | Only if Astryx documents it (`theming.vars`), or the component varies it by variant/size/state and no token or part covers the need. One property per CSS property, never per size. Read through a private alias `--_x: var(--button-x, <token>)`, never declared on `:host`. | `--<component>-<css-property>` | `@cssprop` |
| Private property | Declared on the inner element. Library-internal parent→child coupling (ButtonGroup corners) uses documented `@internal` `--_button-start-end-radius` etc. | `--_<component>-<prop>` | `@internal` only |
| Tecton-only semantic role | Only via the token pipeline; component WPs file `tokenRequests`. | `--tecton-color-*` | tokens docs |

No `:host-context()`, no utility-class visuals on hosts, no documented subclass theming.

### 6.4 Values

No colour literals (hex, rgb(), hsl(), oklch(), named colours; only `transparent`, `currentColor`, `inherit`, and
CSS system colours inside `@media (forced-colors: active)`), so every colour a component paints resolves to a
Tecton token (D-013 Q-06; `tct/no-color-literals`, also on `*.light.css`), no px font sizes, no palette variables, no unknown
custom properties (allowed: token set ∪ this component's `--<component>-*` `@cssprop`s ∪
`--_<component>-*` ∪ documented `@internal` coupling names). Structural literals (`0`, `100%`,
`1 / 1`, `none`) are fine; a named geometry literal needs a `/* design: … */` comment. `color-mix(in oklab, …)`
only for washes over user-supplied colours; `contrast-color()` only for user-supplied colours with the
guide's fallback.

### 6.5 Focus ring (D-005)

Tokens `--focus-outline-{color,width,style,offset}` (hot pink, 2px, solid, 2px) and
`--button-focus-offset: 1px`. One implementation (`focus-ring.styles.css`), outline **longhands** on
`:focus-visible`, drawn on the internal focusable element; composites use `:has(:focus-visible)` on
the painted wrapper; roving-tabindex hosts use `:host(:focus-visible)`. Never drawn from a
`delegatesFocus` host. Destructive buttons keep hot pink (D-005). Surfaces where pink fails 3:1
(inverted surfaces) set the documented double ring: pink outline plus an inner
`box-shadow: 0 0 0 1px var(--tecton-color-focus-inner)` defined by the tokens pipeline.

### 6.6 Forced colours, contrast, motion, RTL

- Forced colours (required): overrides only in `@layer a11y` inside `@media (forced-colors: active)`,
  targeting inner selectors; transparent (not absent) borders on edges that carry meaning; system
  colours (`Highlight`/`HighlightText` selected, `GrayText` disabled, `CanvasText`/`ButtonText`/`ButtonBorder`
  edges, `LinkText` links); focus ring `outline-color: Highlight`; `forced-color-adjust: none` only where
  colour is the content (swatches, chart series, user-chosen syntax colours).
- `prefers-contrast: more`: deferred (D-005).
- Reduced motion: movement only under `@media (prefers-reduced-motion: no-preference)`; fades may stay
  shortened; spinners/indeterminate progress slow down instead of stopping; no global duration zeroing;
  JS uses `prefersReducedMotion()` from core and awaits `getAnimations()` with a timeout, never bare
  `transitionend`.
- RTL: logical properties and values only (lint); physical ones need a `/* physical: … */` comment;
  directional glyphs mirror with `:host(:dir(rtl)) .icon { scale: -1 1 }` when the icon definition says
  `mirrorInRtl`.

### 6.7 Light-DOM component styling

Light-DOM families (§8) ship `tct-<name>.light.css`: every selector `:where(tct-x) :where(…)`, all in
`@layer tecton.light-dom`, plus an `@scope (tct-x) to (:is(tct-x, tct-code-block, tct-table, [data-tct-unstyled]))`
donut block. Delivery: static `light-dom.css` (SSR/no-JS) and at runtime
`adoptLightDomStyles(host, sheet)` from core, which appends a shared constructed sheet to
`host.getRootNode().adoptedStyleSheets` once (never replaces).

### 6.8 FOUC cloak

Optional generated `cloak.css`: `:is(<every public tag>):not(:defined) { opacity: 0; animation: tct-cloak-reveal .2s var(--tct-cloak-timeout, 2s) forwards }` (fail-open `[mwg:custom-elements]`), plus
per-tag `display` and `min-block-size` space reservation from each class's `@cloakDisplay` /
`@cloakMinBlockSize` JSDoc.

### 6.9 Documented coexistence

Recommended application layer order: `@layer theme, base, tecton.reset, tecton.tokens, tecton.light-dom, components, utilities;`
One `tokens.css` per page. `data-theme` on `<html>` is shared with Astryx React.

---

## 7. Element API contract

### 7.1 Naming

| Thing | Rule | Example |
| --- | --- | --- |
| Tag | `tct-` + kebab(upstream export name); exceptions `HStack→tct-hstack`, `VStack→tct-vstack`. Lab package: `tct-lab-` prefix; charts/richtext/vega: `tct-` (WORK-BREAKDOWN lists every tag). | `DropdownMenuCheckboxItem` → `tct-dropdown-menu-checkbox-item` |
| Internal helper tag | `tct-<folder>-<part>`, JSDoc `@internal`, excluded from public docs and parity | `tct-tooltip-surface` |
| Class | `Tct` + PascalCase | `TctDateRangeInput` |
| Upstream aliases (`ContextMenuItem`, `BreadcrumbMenuItem`, …) | No alias tags; the DropdownMenu item tags serve every menu; documented in the mapping | `tct-dropdown-menu-item` inside `tct-context-menu` |
| Attribute / property | kebab attribute, camelCase property | `close-label` / `closeLabel` |
| Custom event | `tct-` + kebab (§7.6) | `tct-open-change` |
| Part / state | kebab, no prefix | `part="label"`, `:state(user-invalid)` |

Never shadow global attributes/properties: `title`, `hidden`, `id`, `lang`, `dir`, `slot`, `part`,
`style`, `class`, `role`, `tabindex`, `inert`, `popover`, `autofocus`, `inputmode`, `enterkeyhint`,
`autocapitalize`, `translate`, `draggable`. Never use (or reflect) `align`, `valign`, `nowrap`,
`bgcolor`; do not reflect `width`/`height`. No public property may start with `on` (React 19 treats
function-valued `on*` props as listeners).

### 7.2 Upstream prop → WC mapping rules (normative)

| Upstream (React) | Web component |
| --- | --- |
| `isX` boolean | `x` boolean attribute (drop `is`): `isDisabled→disabled`, `isLoading→loading`, `isIconOnly→icon-only`, `isOpen→open`, `isLabelHidden→label-hidden` |
| `hasX` boolean | `has-x` (`hasHover→has-hover`); `hasAutoFocus→` native `autofocus` |
| boolean defaulting to `true` upstream | inverted name defaulting to false: `no-x` / `hide-x` (`hasDividers=true → no-dividers`) |
| `defaultX` (uncontrolled) | `x` **attribute** (the default) |
| `x` + `onXChange` (controlled) | `x` property (current) + cancelable `tct-x-change` intent event |
| `value` + `onChange` on value controls | `value` property/attribute (§7.4) + native `input` (every user edit) and `change` (commit) |
| `onClick`, `onFocus`, `onBlur`, `onKeyDown` … | native events on the host (retargeted), never re-dispatched |
| other `onFooBar` | `tct-foo-bar` event |
| async `fooAction` | `fooAction` property (`(event) => Promise<void>`); sets `:state(busy)` + `aria-busy`, dedupes re-entry |
| `children` | default slot |
| ReactNode content props (`icon`, `startContent`, `endContent`, `description` …) | named slot (`icon`, `start`, `end`, `description`); plus a string attribute when plain text is common (`description="…"`), never both required |
| `renderX(item)` render props | `renderX` property returning `TemplateResult \| Node \| string` (string = text, never HTML) |
| data props (`items`, `columns`, `data`, config objects) | property only (`attribute: false`), never JSON attributes |
| `title` | `heading` (+ `slot="heading"`) when it renders a heading; `label` when it names a control |
| `as` (polymorphic tag) | `as` enumerated attribute controlling the inner element or `internals.role` |
| `align` | `alignment` |
| `inputID`, `labelID`, `descriptionID` | `input-id`, `label-id`, `description-id` |
| `ref`, `*Ref` | element methods/getters (`focus()`, `control`, `anchorElement` property) |
| `xstyle`, `className`, `style`, `data-testid` | not mapped: `class`, `style`, `::part()`, custom properties, attributes on the host (approved difference A-xstyle) |
| `aria-*` props | host `aria-*` attributes, delegated (§9.6) |
| `size` (`sm/md/lg`) | reflected `size`, cascade explicit → provider → default (§9.18) |
| numeric/length props (`width`, `maxWidth`) | attribute (not reflected); number = px; applied through a private custom property |
| hooks, contexts, imperative hooks | controllers, context keys, element methods, or module functions (`toast()`), per WORK-BREAKDOWN |

Every row of an upstream component's props ends up in `parity.json.api`.

### 7.3 Attributes, properties, reflection, typing, defaults

- Scalars are attribute + property. Structured data and callbacks are properties only.
- HTML booleans: presence = true, default false, never `="false"`.
- Reflect only what CSS or consumers must observe: `variant`, `size`, `open`, `disabled`, `readonly`,
  `required`, `invalid`/`status`, `orientation`, `selected`/`checked` **only on non-form items**
  (tabs, options). Runtime-derived state is a custom state, not an attribute.
- `value`/`checked` on form controls are **not reflected**: the attribute is the default
  (`defaultValue`/`defaultChecked`), the property is the current value (native model).
- Enumerations are string-literal unions exported from `<folder>.types.ts` together with an
  `as const` array; invalid attribute values fall back to the default and, when
  `globalThis.tctDevMode === true`, warn once via `devWarn()`.
- Defaults equal upstream defaults unless Tecton requires otherwise (recorded as a difference).
- All public properties are Lit reactive properties (decorated), including accessors, so Lit restores
  values assigned before upgrade (§7.9).

### 7.4 Controlled vs uncontrolled (D-006)

Elements own their state by default, like native elements. "Controlled" usage = set the property,
listen to the event, and either set the property in the handler or `preventDefault()` the intent event.
**Property writes and attribute changes never emit intent events or `input`/`change`.** Upstream
controlled-only inputs therefore also work uncontrolled (approved difference, D-006).

### 7.5 Methods

Mirror native names: `focus(options)`, `blur()`, `click()`, `select()`, `show()`, `hide()`,
`toggle(force?)` (programmatic: no intent event; the commit event still fires), `requestClose(reason?)`
(user-equivalent: fires the intent event), `checkValidity()`, `reportValidity()`,
`setCustomValidity()`, `showPicker()` where upstream exposes an open-picker capability.

### 7.6 Events

| Rule | Detail |
| --- | --- |
| Native names for native concepts | Value controls: `input` on every user edit, `change` on commit (text fields: blur/Enter; discrete controls: each toggle fires `input` then `change`). Native `input` from an inner `<input>` is composed and retargets — never re-dispatch it. Native `change` is **not** composed — re-dispatch once from the host (`redispatchChange`). `click` from an inner `<button>` retargets — never emit another. Never re-dispatch `focus`/`blur`/`focusin`/`focusout`. |
| Intent events | `tct-<prop>-change`, `cancelable: true`, dispatched **before** the change, only for user- or dismissal-initiated changes and `requestClose()`. If not prevented the element applies the change synchronously. Fields carry the requested value and `reason`. |
| Commit events | `tct-after-<prop>-change`, not cancelable, only where the change settles asynchronously (animations, lazy content). Fire for every actual change, including programmatic ones (a notification, like native `toggle`). |
| Action events | `tct-<verb>` for non-state actions (`tct-remove`, `tct-clear`, `tct-page-change`). Cancelable when a default action follows. |
| Flags | All public events `bubbles: true, composed: true`. Internal coordination uses context or direct calls; if a DOM event is unavoidable it is `tct-internal-<x>`, `composed: false`, stopped at the owner, never documented. |
| Classes | One `Event` subclass per event name in `packages/core/src/events/<event-name>.ts`, payload as typed readonly fields (not `detail`), plus `declare global { interface GlobalEventHandlersEventMap { 'tct-open-change': TctOpenChangeEvent } }`. JSDoc tags `@eventName`, `@bubbles`, `@composed`, `@cancelable` feed the CEM. `new CustomEvent` / ad-hoc `new Event('tct-…')` outside `core/src/events` is a lint error. |
| Reuse | Reuse an existing class when semantics match; if the payload would differ, use a more specific name (`tct-token-remove`). Check `core/src/events/` before adding. |
| Reasons | `type ChangeReason = 'trigger' \| 'escape' \| 'outside' \| 'focus-out' \| 'close-watcher' \| 'close-button' \| 'selection' \| 'hover' \| 'timeout' \| 'keyboard' \| 'pointer' \| 'request'` |
| Non-form selection | Tabs, navigation segmented controls, accordions: `tct-value-change`, never `change`. |
| Declarative invokers | Overlay hosts accept `command` events `--show`, `--hide`, `--toggle` (feature-detected enhancement), and manage `aria-expanded` on the source themselves. |

Pre-built by WP-F: `TctOpenChangeEvent` (`open`, `reason`), `TctAfterOpenChangeEvent` (`open`),
`TctValueChangeEvent<T>` (`value`, `oldValue`, `reason`), `TctClearEvent`, `TctRemoveEvent<T>`
(`value`). Base class:

```ts
/** Base for every public library event: bubbles + composed by default. */
export abstract class TctEvent extends Event {
  constructor(type: string, init: {cancelable?: boolean} = {}) {
    super(type, {bubbles: true, composed: true, cancelable: init.cancelable ?? false});
  }
}
/**
 * @eventName tct-open-change
 * @bubbles @composed @cancelable
 * Fired before an element opens or closes because of the user; preventDefault() keeps the state.
 */
export class TctOpenChangeEvent extends TctEvent {
  static readonly eventName = 'tct-open-change';
  readonly open: boolean;
  readonly reason: ChangeReason;
  constructor(open: boolean, reason: ChangeReason) {
    super(TctOpenChangeEvent.eventName, {cancelable: true});
    this.open = open; this.reason = reason;
  }
}
declare global { interface GlobalEventHandlersEventMap { 'tct-open-change': TctOpenChangeEvent } }
```

### 7.7 Slots

- Default slot for children; named slots per §7.2. Slot presence is computed from non-whitespace
  nodes (`SlotController`, §9.18) and exposed as `:state(has-<slot>)` for consumers; internal layout
  must not need slot-presence to look right (SSR cannot know).
- Anchored overlays take their trigger as the **default-slot first element** when upstream wraps
  children (Tooltip, HoverCard, Popover, DropdownMenu) or via `slot="trigger"` when upstream has a
  separate trigger prop. IDREF `for`/`anchor` attributes resolve only in the same tree and are a
  secondary option.
- Compound components use light-DOM child elements discovered by `slotchange` +
  `assignedElements()` (or a filtered `MutationObserver` for deep descendants); shared state flows via
  context. Data-heavy widgets (Table, TreeList, PowerSearch results) use properties + renderer callbacks.

### 7.8 Localisable strings

Every user-visible or assistive string has an English default from the catalog and an optional
attribute override (`close-label`, `previous-label`), resolved by `LocaleController` (§9.15).

### 7.9 Lifecycle guarantees (tested by the standard suite)

Pre-upgrade property assignment is honoured; double import and two class versions do not throw;
define-after-parse upgrades existing markup; disconnect/reconnect and `moveBefore()` keep state
(`connectedMoveCallback` is a no-op by default so moves skip teardown); modules import in Node without
DOM globals; no DOM access in constructors or `render()`.

---

## 8. DOM strategy per family

### 8.1 Table

| Family (folders) | Strategy | Semantics |
| --- | --- | --- |
| Buttons & links: `button`, `icon-button`, `toggle-button`, `link`, `clickable-card` action | Open shadow, `delegatesFocus: true` | Native `<button>`/`<a href>` inside the shadow root; FACE host for `tct-button` (submitter semantics) |
| Text & static content: `text`, `heading`, `code`, `kbd`, `blockquote`, `citation`, `timer`, `timestamp`, `badge`, `token`, `status-dot`, `avatar`, `empty-state`, `skeleton`, `spinner`, `progress-bar`, `icon`, `divider`, `nav-icon`, `visually-hidden` | Open shadow with `<slot>` | Host is the semantic node via `ElementInternals` (`heading` + `ariaLevel`, `paragraph`, `separator`, `img`, `progressbar`, `status` only where upstream announces) or a native inner element (`<blockquote>`, `<code>`, `<kbd>`, `<time>`) |
| Layout: `stack`, `hstack`, `vstack`, `center`, `grid`, `aspect-ratio`, `section`, `card`, `form-layout`, `layout`, `scrollable-area`, `app-shell` | Open shadow; inner `part="base"` box holds flex/grid, padding, paint; default slot inside it | Landmarks via native inner elements where upstream renders them (`<section>`, `<header>`, `<main>`, `<nav>`, `<aside>`) |
| Groups and roving composites: `button-group`, `toggle-button-group`, `segmented-control`, `toolbar`, `tab-list`, `radio-list`, `checkbox-list` | Open shadow; items are author light-DOM children (slotted) | Group role on host via internals (`group`, `toolbar`, `radiogroup`, `tablist` in tablist mode); items carry host semantics via internals (`tab`, `radio`, …) and take roving tabindex (§9.11) where the pattern roves |
| Navigation groups: `breadcrumbs`, `pagination`, `stepper`, `outline`, `side-nav`, `top-nav`, `nav-heading-menu`, `tab-list` (default nav mode) | Open shadow; items are light-DOM children | Native `<nav>` landmark + list semantics inside the shadow root; links stay links with `aria-current`; no roving unless upstream roves (TabList nav mode does) |
| Value controls (field chrome): `text-input`, `text-area`, `number-input`, `file-input`, `date-input`, `date-range-input`, `date-time-input`, `time-input`, `selector`, `multi-selector`, `complex-selector`, `typeahead`, `tokenizer`, `input-group` | Open shadow, `delegatesFocus` when a single focus target; **label, description, status and native control all in the same shadow root**; opt-in `slot="input"` mode for `text-input`/`text-area` (A-07) | FACE host (§9.7); listbox/grid popups in the same shadow root; options are light-DOM children referenced by `ariaActiveDescendantElement` (shadow → outer tree, allowed) |
| Choice controls: `checkbox-input`, `switch`, `slider`, `radio-list` items, `selectable-card` | Open shadow; native `<input type=checkbox\|range>` where one exists, otherwise host internals | FACE host (radio group = FACE on the group) |
| `field` (standalone wrapper) | Open shadow for layout; label/description/status are **owned light-DOM satellites** (`tct-field-label`, `tct-field-description`, `tct-field-status`) | The field sets `aria-labelledby`/`aria-describedby` on the slotted control (same tree) |
| Anchored overlays: `tooltip`, `popover`, `hover-card`, `dropdown-menu`, `context-menu`, `more-menu`, `tab-menu`, breadcrumb menus, nav menus | Open shadow with a `popover="manual"` surface; **tooltips wrapping author content render their surface as a satellite** (`tct-tooltip-surface`) so the trigger's `aria-describedby` stays same-tree | Layer stack (§9.9) |
| Modal surfaces: `dialog`, `alert-dialog`, `bottom-sheet`, `lightbox`, `command-palette`, `mobile-nav` drawer | Open shadow with native `<dialog>` | `showModal()`; heading in the same root (`aria-labelledby`) |
| Collections: `item`, `list`, `tree-list`, `metadata-list`, `overflow-list`, menu items, selector options, `tab` | Items: light-DOM custom elements with their own shadow for visuals; semantics on the item host via internals | Parent owns the focus model |
| Tables: `table` + parts | **Light DOM**: `tct-table` renders a native `<table>` into its own light DOM from `columns`/`data`; public subcomponents map to native table elements and renderer outputs (WP-15 records the exact mapping; custom elements cannot live inside `<table>` markup because the parser foster-parents them) | Native table semantics |
| Rich content: `markdown` | **Light DOM** rendering of the parsed AST (Lit templates, never HTML strings), styled by `markdown.light.css` | Native elements |
| `code-block` | Open shadow | `<pre><code>`; CSS Custom Highlight API ranges |
| Chat: `chat-*` | Open shadow; messages are light-DOM children of the list | Log/feed semantics per upstream |
| Providers: `theme`, `media-theme`, `syntax-theme`, `size-provider`, `internationalization-provider`, `link-provider`, `layer-provider` | No shadow root (`createRenderRoot() { return this }`, render nothing); `display: contents` except `tct-theme`/`tct-media-theme` (`display: block`, paint background — theme-island rule) | Context providers (§9.4) |

### 8.2 Relationship rule and owned satellites

1. Keep every ID relationship inside **one tree** `[mwg:accessible-web-components]`. If both ends are in
   the component's shadow root, render them there.
2. A shadow-root element may point **outward** (to its host's tree or an ancestor tree) with ARIA
   element reflection (`ariaActiveDescendantElement`, `ariaLabelledByElements`, …). Never inward.
3. If author light-DOM content must reference something the component renders (a tooltip describing a
   slotted trigger, a field labelling a slotted native control), render that target as an **owned
   light-DOM satellite**: an internal custom element (own shadow root for styles, text content in its
   light DOM so it participates in name computation), created by `OwnedPartsController`, marked
   `data-tct-owned`, assigned to a named slot of the host, re-created if a framework removes it.
4. Where element reflection is missing (Tier 2), `AriaDelegateController` copies text into
   `aria-label` / `aria-description` on the inner control.
5. Reference Target (`shadowRootOptions.referenceTarget`, Chrome 152) is set as an enhancement on FACE
   controls so `<label for>`/`aria-*` aimed at the host resolve natively; nothing depends on it.

---

## 9. Core runtime: base classes, mixins, controllers

All signatures below are the contract; WP-F implements them in `packages/core/src/`. File names are
fixed so later packages can import them.

### 9.1 `TctElement` — `core/src/tct-element.ts`

```ts
export type TctElementConstructor = (new () => TctElement) & typeof TctElement;

export abstract class TctElement extends LitElement {
  /** The tag this class is registered under by defineElement(). */
  static readonly tagName: string;
  /** Elements rendered in this class's shadow root; defineElement registers them first. */
  static readonly dependencies: readonly TctElementConstructor[] = [];
  /** Library version, injected at build; used in duplicate-definition warnings. */
  static readonly version: string;
  static override shadowRootOptions: ShadowRootInit;   // mode 'open'
  static override styles: CSSResultGroup;

  /** ElementInternals, attached in the constructor (exactly once; never call attachInternals()). */
  protected readonly internals: ElementInternals;
  /** Dispatches a library event; returns false if a cancelable event was prevented. */
  protected dispatch(event: Event): boolean;
  /** Feature-detected custom state toggle (no-op without CustomStateSet). */
  protected toggleState(name: string, on: boolean): void;
  protected hasState(name: string): boolean;
  /** No-op so moveBefore() does not tear down (enhancement). */
  connectedMoveCallback(): void;
}
```

Rules: attach internals in the constructor; set default ARIA via `this.internals.role/aria*`
(never host `role`); no DOM reads in the constructor or `render()`.

### 9.2 `defineElement` — `core/src/define.ts`

```ts
/**
 * Registers ctor.dependencies (recursively, cycle-safe) and then ctor under ctor.tagName.
 * Same class already registered → no-op. Different class owns the tag → keep the first,
 * console.warn once naming both versions.
 */
export function defineElement(ctor: TctElementConstructor, registry?: CustomElementRegistry): void;
```

Never `@customElement`, never `customElements.define` elsewhere (lint). Never create internal children
with `document.createElement('tct-…')` or `new TctX()`: render them from templates in the shadow root so
scoped registries work. Scoped-registry recipe (documented): create a registry, call
`defineElement(Ctor, registry)`, attach it to the application's shadow root.

### 9.3 Events — `core/src/events/*.ts`

See §7.6. `core/src/events/tct-event.ts` holds `TctEvent` and `ChangeReason`.

### 9.4 Context — `core/src/context/`

In-house implementation of the Context Community Protocol (A-10): `context-request` event with
`{context, contextTarget, callback, subscribe}`; late-upgrading providers re-announce with
`context-provider` so consumers re-request.

```ts
export type Context<K, V> = K & {__context__: V};
export function createContext<V>(key: string | symbol): Context<typeof key, V>;
export class ContextProvider<C extends Context<unknown, unknown>> implements ReactiveController {
  constructor(host: ReactiveControllerHost & HTMLElement, options: {context: C; initialValue?: ContextType<C>});
  get value(): ContextType<C>;
  setValue(v: ContextType<C>, force?: boolean): void;   // notifies subscribers
}
export class ContextConsumer<C extends Context<unknown, unknown>> implements ReactiveController {
  constructor(host: ReactiveControllerHost & HTMLElement, options: {context: C; subscribe?: boolean; callback?: (v: ContextType<C>) => void});
  get value(): ContextType<C> | undefined;
}
```

**Context keys defined by WP-F** (so providers and consumers can be built in any order):
`sizeContext` (`'sm'|'md'|'lg'|null`), `formLayoutContext` (`{direction: 'vertical'|'horizontal-labels', optionality}`),
`fieldContext`, `inputGroupContext`, `buttonGroupContext` (`{size, orientation, position: 'first'|'middle'|'last'|'only'}`),
`linkContext` (`{navigate?(href, event): boolean}`), `layerContext` (the enclosing `LayerController`),
`interactiveRoleContext` (`boolean`), `layoutAreaContext`, `localeContext` (provider overrides),
`themeContext` (`{name, mode}`). Later WPs add family-private contexts in their own folders.

### 9.5 Features — `core/src/features.ts`

```ts
export const features: {
  readonly popover: boolean; readonly implicitAnchor: boolean /* probed lazily */;
  readonly anchorPositioning: boolean; readonly elementReflection: boolean;
  readonly customStates: boolean; readonly requestClose: boolean; readonly closeWatcher: boolean;
  readonly dialogClosedBy: boolean; readonly moveBefore: boolean; readonly ariaNotify: boolean;
  readonly invokerCommands: boolean; readonly hiddenUntilFound: boolean; readonly referenceTarget: boolean;
  readonly sanitizer: boolean; readonly fieldSizing: boolean; readonly lightDark: boolean;
};
/** Test hook: force a feature off (or on) for the current document; returns a restore function. */
export function overrideFeature(name: keyof typeof features, value: boolean): () => void;
export function prefersReducedMotion(): boolean;   // live via matchMedia
```

Every guarded API goes through `features`; direct `'x' in proto` checks elsewhere are a lint error.

### 9.6 ARIA delegation — `core/src/controllers/aria-delegate.ts`

Port of the earlier project's controller: mirrors host `aria-*` (list: label, labelledby, describedby,
description, details, errormessage, controls, owns, activedescendant, expanded, haspopup, pressed,
disabled, current, invalid, keyshortcuts, roledescription, autocomplete, busy) onto the inner control;
IDREF attributes are resolved in the host's tree scope and set as element references; syncs on connect,
host update, attribute mutation and `focusin`; host attributes stay the source of truth. Tier-2
fallback: text copy (§8.2).

```ts
export class AriaDelegateController implements ReactiveController {
  constructor(host: ReactiveControllerHost & HTMLElement, options: {
    target: () => Element | null | undefined;
    exclude?: readonly string[] | (() => readonly string[]);
    labels?: () => Element[];   // e.g. internals.labels, used when no aria-label(ledby)
  });
  sync(): void;
}
```

### 9.7 `FormControlMixin` — `core/src/mixins/form-control.ts`

```ts
export type FormValue = File | string | FormData | null;
export interface ValidationResult { flags: ValidityStateFlags; message: string }
export type Validator<E> = (el: E) => ValidationResult | null | undefined;

export declare class FormControl {
  static formAssociated: true;
  name: string; disabled: boolean; required: boolean; readonly: boolean; invalid: boolean;
  get value(): string; set value(v: string);           // current
  defaultValue: string;                                // the `value` attribute
  get isDisabled(): boolean;                           // disabled || fieldset-disabled
  get showInvalid(): boolean;                          // user-invalid timing (below)
  get validity(): ValidityState; get validationMessage(): string; get willValidate(): boolean;
  get form(): HTMLFormElement | null; get labels(): NodeList;
  checkValidity(): boolean; reportValidity(): boolean; setCustomValidity(message: string): void;
  syncFormState(): void;
  // hooks (protected)
  protected get formControl(): HTMLElement | null;              // inner native control, if any
  protected get validationAnchor(): HTMLElement | null;         // focusable anchor for setValidity
  protected get validators(): Validator<this>[];
  protected get ariaDelegationExclude(): readonly string[];
  protected get submitsOnEnter(): boolean;                      // single-line controls: true
  protected formValue(): FormValue;                             // submission value
  protected formState(): FormValue;                             // restore state
  protected formResetValue(): void;
  protected formRestoreState(state: FormValue, reason: 'restore' | 'autocomplete'): void;
  protected markInteracted(): void;
  protected redispatchChange(): void;
  formResetCallback(): void; formDisabledCallback(disabled: boolean): void;
  formStateRestoreCallback(state: FormValue, reason: 'restore' | 'autocomplete'): void;
}
export function FormControlMixin<T extends Constructor<TctElement>>(Base: T): Constructor<FormControl> & T;
```

FACE contract (each row is a test in `runFormControlSuite`, §15.3):

| Concern | Contract |
| --- | --- |
| Opt-in | `static formAssociated = true`; internals from `TctElement`. |
| Value | `setFormValue(formValue(), formState())`; multi-value controls return `FormData` with repeated `name` entries; nothing = `null`; files as `File`/`FormData`. |
| Validity | Mirror the inner control's `validity` flags when there is one; otherwise run `validators`; consumer `setCustomValidity` tracked separately; `invalid` attribute = custom error. **Always pass `validationAnchor`** (active/first enabled item for groups). |
| Displayed invalidity | `:state(user-invalid)` + `aria-invalid` on the inner control flip at the same moment: after user commit (`change`/blur), a real submission attempt, or `reportValidity()`. **Not** on `checkValidity()`/`form.checkValidity()`. Displayed message is frozen while the control has focus; announced politely once on first appearance. |
| Reset | `formResetCallback` → attribute default; clears interaction state. |
| Disabled | `formDisabledCallback` (fieldset); `isDisabled`; style `:host(:disabled)`. Transiently unavailable controls use `aria-disabled` + activation guard so focus is never dropped. |
| Read-only | `readonly` bars from validation: `setValidity({})`, `willValidate` false semantics documented. |
| Restore | `formStateRestoreCallback` for `restore` and `autocomplete`; tested per engine. |
| Labels | `internals.labels` → inner `ariaLabelledByElements`; label click focuses/activates the inner control. |
| Implicit submission | Enter (unmodified, `!isImeKeyEvent`) in a single-line control runs `submitImplicitly(form)`: activate the form's default button (first submit button in `form.elements`, native or `tct-button[type=submit]`; disabled → nothing), else `form.requestSubmit()` only when the form has exactly one field that blocks implicit submission (HTML rule). `enterkeyhint` passes through. |
| Submitter | `tct-button type=submit`: inserts a temporary hidden native `<button type=submit>` into the form carrying `name`/`value`/`formaction`/`formmethod`/`formenctype`/`formtarget`/`formnovalidate`, calls `form.requestSubmit(temp)`, removes it. `SubmitEvent.submitter` is the temporary button (documented difference); `FormData` contains the submitter entry. `type=reset` → `form.reset()`. |
| `form` attribute | Native FACE association; documented and tested. |
| Autofill | `name`, `autocomplete`, `inputmode`, `enterkeyhint` forwarded to the inner native input. |
| Events | `input`/`change` only on user action (§7.6); `invalid` fires natively on the host. |
| Observers | `observeControl(control, observer)` protocol (global-symbol WeakMap) so `tct-field`/`tct-input-group` follow a control's displayed state. |

### 9.8 Field chrome — `core/src/controllers/field-chrome.ts`

```ts
export interface FieldChromeState {
  label: string; labelHidden: boolean; description?: string;
  status?: {type: 'error' | 'warning' | 'success' | 'info'; message?: string};
  statusVariant: 'attached' | 'detached' | 'tooltip';
  required: boolean; optional: boolean; disabled: boolean; size: 'sm' | 'md' | 'lg';
}
export class FieldChromeController implements ReactiveController {
  constructor(host: TctElement, options: {
    mode: () => 'shadow' | 'light';          // light = satellites (slotted-input mode, tct-field)
    control: () => HTMLElement | null;       // element that receives labelledby/describedby
    state: () => FieldChromeState;
  });
  /** Shadow mode: returns the label/description/status template with same-root ids. */
  renderLabel(): TemplateResult; renderDescription(): TemplateResult; renderStatus(): TemplateResult;
  readonly labelId: string; readonly descriptionId: string; readonly statusId: string;
}
```

- **Default (shadow) mode**: `<label for=inner-input>` and description/status in the control's shadow
  root; the inner input gets `aria-describedby` ids from the same root.
- **Slotted-input mode** (`<tct-text-input><input slot="input" name="email" autocomplete="email"></tct-text-input>`):
  the author's `<input>` is the control, it submits itself (host `formValue()` returns `null`, validity
  mirrors the slotted input, anchor = the input); chrome is rendered as satellites and wired with
  `aria-labelledby`/`aria-describedby` ids in the light tree.
- `tct-field` uses the light mode around arbitrary slotted controls, honouring upstream `input-id`,
  `label-id`, `description-id`, `group-label` (renders a non-label group caption for radio/checkbox groups).
- The status message is announced through the Announcer (never `role=alert` bound to a live message).

### 9.9 Layers — `core/src/layer/`

```ts
export type LayerKind = 'modal' | 'dialog' | 'popover' | 'hint' | 'toast';
export type EscapeBehavior = 'close' | 'block' | 'none';
export interface LayerOptions {
  kind: LayerKind;
  surface: () => HTMLDialogElement | HTMLElement | null;   // <dialog> or [popover=manual]
  trigger?: () => HTMLElement | null;                       // aria-expanded owner, focus return target
  inside?: () => (EventTarget | null | undefined)[];        // extra inside elements for outside-press
  escape?: EscapeBehavior | (() => EscapeBehavior);         // default 'close'
  outsidePress?: boolean | ((e: PointerEvent) => boolean);  // default true except modal
  focusOut?: boolean;                                       // default false
  initialFocus?: 'auto' | 'surface' | 'first' | 'none' | (() => HTMLElement | null);
  returnFocus?: boolean | (() => HTMLElement | null);       // default true
  scrollLock?: boolean;                                     // default: kind === 'modal'
  exitAnimation?: () => Animation[] | Promise<unknown>;     // awaited before close/hidePopover
  /** Owner decides: typically dispatch TctOpenChangeEvent and hide() unless prevented. */
  onDismissRequest(reason: ChangeReason, event?: Event): void;
  onShown?(): void; onHidden?(): void;
}
export class LayerController implements ReactiveController {
  constructor(host: TctElement, options: LayerOptions);
  readonly isOpen: boolean; readonly isTopmost: boolean; readonly parent: LayerController | null;
  show(): Promise<void>;   // native show + register + focus + animation; emits nothing
  hide(): Promise<void>;   // exit animation + native hide + unregister + focus return; emits nothing
  /** For trigger clicks: ignores a request in the same gesture that just dismissed this layer. */
  toggleFromTrigger(event: Event): void;
}
```

Behaviour (ports upstream `layerStack.ts`/`useLayerDismissal.ts` invariants as tests):

- **One stack, one document `keydown` listener in the bubble phase.** Escape goes to the top-most layer
  only; content can claim it with `stopPropagation()`/`preventDefault()`; handled presses call
  `preventDefault()` (suppresses native `<dialog>` `cancel` and popover close requests). `'block'`
  consumes without closing. Composing Escapes (`isImeKeyEvent`) are claimed but ignored.
- **Order:** a layer whose host is inside another open layer's surface/host (composed tree: `parentNode`,
  `assignedSlot`, shadow `host`) is above it; otherwise later registration is on top. Modality is not a
  key. No DOM reparenting, so DOM containment is the logical nesting.
- **Outside press:** one capture-phase `pointerdown` listener; composed-path hit test from the top; closes
  every layer above the innermost layer containing the target; never closes a parent because of a press
  in its child. Gesture counter (pointerdown/keydown capture) prevents dismiss-then-reopen on the same
  gesture.
- **Close requests:** `<dialog>` `cancel` routed to `onDismissRequest('close-watcher')`; popover layers
  create a `CloseWatcher` when supported (Android back).
- **Modal:** `showModal()`; no focus trap code; scroll lock (ref-counted `overflow: hidden` +
  `scrollbar-gutter: stable` on `<html>`); `closedby="any"` light dismiss only when the component
  wants it, with the guide's JS fallback `[mwg:light-dismiss-a-dialog]`.
- **Top-layer persistence:** while a modal is open, the toaster region and announcer regions are moved
  into the top-most modal (`moveBefore()` when available, else move + re-show) and back on close
  `[mwg:persistent-top-layer-ui]`. On reconnect of an `open` host whose surface is no longer
  `:modal`/`:popover-open`, re-show.
- **Animation:** entry via `@starting-style` + `transition-behavior: allow-discrete`; exit via WAAPI
  awaited before `close()`/`hidePopover()` `[mwg:animate-to-from-top-layer]`; reduced motion respected.
- **Focus:** initial focus per option; return focus to `returnFocus()` → trigger → previously focused
  element, only if focus is inside the layer or on `<body>` at hide time; `focus({focusVisible})` when
  supported so pointer dismissals don't show a ring.
- **Trigger ARIA:** `aria-expanded`/`aria-haspopup` set on the trigger (delegated if it is a tct element);
  `aria-controls` only when the surface is in the trigger's tree.

### 9.10 Positioning — `core/src/layer/position.ts`

```ts
export type Placement = 'above' | 'below' | 'start' | 'end';          // upstream vocabulary
export type Alignment = 'start' | 'center' | 'end';
export interface PositionOptions {
  surface: () => HTMLElement | null;
  anchor: () => Element | {x: number; y: number} | null;              // point = virtual anchor
  placement: () => {placement: Placement; alignment: Alignment; offset?: string | number};
  matchAnchorWidth?: boolean | 'min';
  trackPlacement?: boolean;                                             // write actual data-placement
  strategy?: 'auto' | 'css' | 'js';                                     // tests only
}
export class PositionController implements ReactiveController {
  constructor(host: TctElement, options: PositionOptions);
  /** Called by LayerController.show(): passes {source: anchor} on the CSS path. */
  readonly showOptions: ShowPopoverOptions | undefined;
  update(): void;
}
```

- **CSS path** (default when `features.implicitAnchor`): `showPopover({source: anchor})`; inline
  `position-area` from logical placement/alignment; `position-try-fallbacks: flip-block` (above/below)
  or `flip-inline` (start/end) plus span fallbacks for centred alignments; clearance as margins on
  **both** edges of the axis (upstream #4803); `max-block-size`/`max-inline-size: 100%` clamps to the
  available area.
- **Virtual anchors** (context menu at pointer): a 0×0 `position: fixed` element owned by the
  controller at the point, used as `source` — still the CSS path.
- `implicitAnchor` is probed once (show an off-screen popover with a source, compare rects) and cached.
- **JS path** (Tier 2 or probe failure): `core/src/layer/floating.ts` is the **only** module that imports
  `@floating-ui/dom`, via dynamic `import()`: `computePosition` with `strategy: 'fixed'`, `offset`,
  `flip`, `shift`, `size`, `hide`, `arrow`, and `autoUpdate`; logical placements mapped with the host's
  computed direction.
- Both paths write `data-placement` (actual side after flips when `trackPlacement`) for arrow styling;
  never `@container anchored`.

### 9.11 `RovingTabindexController` — `core/src/controllers/roving-tabindex.ts`

```ts
export type Orientation = 'horizontal' | 'vertical' | 'both';
export interface RovingOptions<T extends HTMLElement> {
  items: () => T[];                                    // DOM order, disabled included
  orientation?: Orientation | (() => Orientation);     // default 'horizontal'
  wrap?: boolean;                                      // default true
  homeEnd?: boolean;                                   // default true
  pageSize?: number;                                   // PageUp/PageDown step, off by default
  isDisabled?: (item: T) => boolean;                   // default: disabled / aria-disabled=true
  focusDisabled?: boolean;                             // APG menus: disabled stays focusable
  focusTarget?: (item: T) => HTMLElement | null;       // wrapper items: focus the inner control
  caretGuard?: boolean;                                // leave arrows to text inputs mid-line
  activateOnFocus?: boolean | (() => boolean);
  onActivate?: (item: T, event: Event) => void;
  typeahead?: boolean | ((item: T) => string);
  boundary?: (item: T) => boolean;                     // nested menus
}
export class RovingTabindexController<T extends HTMLElement> implements ReactiveController {
  constructor(host: ReactiveControllerHost & HTMLElement, options: RovingOptions<T>);
  readonly active: T | null;
  setActive(item: T | null, options?: {focus?: boolean}): void;
  update(): void;                                      // after slotchange / item changes
}
```

Exactly one enabled item has `tabindex="0"`; arrows follow the host's **computed direction**; option
names align with Open UI `focusgroup`. Documented trap: `tabindex="-1"` on a shadow host removes its
slotted content from sequential navigation — use `focusTarget` for wrapper items.

### 9.12 `ActiveDescendantController` — `core/src/controllers/active-descendant.ts`

```ts
export interface ActiveDescendantOptions<T extends HTMLElement> {
  focusElement: () => HTMLElement | null;             // the input/listbox keeping DOM focus
  items: () => T[];
  isDisabled?: (item: T) => boolean;
  wrap?: boolean; homeEnd?: boolean; pageSize?: number;
  onHighlight?: (item: T | null, via: 'keyboard' | 'pointer' | 'programmatic') => void;
}
export class ActiveDescendantController<T extends HTMLElement> implements ReactiveController {
  constructor(host: ReactiveControllerHost & HTMLElement, options: ActiveDescendantOptions<T>);
  readonly highlighted: T | null;
  highlight(item: T | null, via?: 'keyboard' | 'pointer' | 'programmatic'): void;
  handleKeyDown(event: KeyboardEvent): boolean;        // true when consumed
}
```

Sets `focusElement.ariaActiveDescendantElement` (element reflection; Tier-2 fallback: id when both
are in one tree, else announce the option label); marks the item with `:state(highlighted)` and
`data-highlighted`; keyboard highlight scrolls into view, pointer highlight never scrolls.

### 9.13 `TypeaheadController` — `core/src/controllers/typeahead.ts`

```ts
export class TypeaheadController {
  constructor(options?: {resetMs?: number /* 750, upstream */; locale?: () => string | undefined});
  /** Returns the matched index or -1; true-printable keys only (Alt+letter allowed, Ctrl/Meta not, lone Space not). */
  match(event: KeyboardEvent, labels: ReadonlyArray<string | null>, currentIndex: number, isDisabled?: (i: number) => boolean): number;
  reset(): void;
}
```

Same-letter cycling, locale-aware `Intl.Collator` (`sensitivity: 'base'`), skips disabled.

### 9.14 IME — `core/src/utils/ime.ts`

```ts
/** Upstream isImeKeyEvent: e.isComposing === true || e.keyCode === 229. */
export function isImeKeyEvent(event: {isComposing?: boolean; keyCode?: number}): boolean;
export class ImeGuard implements ReactiveController {   // tracks compositionstart/end on a target
  constructor(host: ReactiveControllerHost & HTMLElement, target: () => EventTarget | null);
  readonly composing: boolean;
}
```

Every keydown command handler (Enter, Escape, arrows, Tab-commit) checks `isImeKeyEvent` first; no
character filtering during composition (normalise on `compositionend`).

### 9.15 Locale and messages — `core/src/i18n/`

```ts
export class LocaleController implements ReactiveController {
  constructor(host: TctElement, options?: {namespace?: string; defaults?: Record<string, string>});
  readonly locale: string;              // nearest [lang] crossing shadow roots, else navigator.language
  readonly dir: 'ltr' | 'rtl';          // getComputedStyle(host).direction
  /** `@astryx.<namespace>.<key>` (or full id); args formatted with ICU. Attribute overrides win. */
  t(key: string, args?: Record<string, unknown>, overrideAttribute?: string): string;
  collator(options?: Intl.CollatorOptions): Intl.Collator;
  numberFormat(options?: Intl.NumberFormatOptions): Intl.NumberFormat;
  dateTimeFormat(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;
}
export function registerTranslation(locale: string, messages: Record<string, string>): void;
export function loadLocale(locale: string): Promise<void>;       // dynamic import from @tecton-astryx/locales
export function setLocaleLoader(loader: ((tag: string) => Promise<Record<string, string>>) | null): void;
export function getLocaleDirection(locale: string): 'ltr' | 'rtl'; // Intl.Locale#getTextInfo with fallback list
export function formatMessage(pattern: string, args: Record<string, unknown> | undefined, locale: string): string; // i18n/format.ts
```

- Resolution order for a message: host override attribute → `tct-internationalization-provider`
  overrides (context) → registered/loaded catalog for the resolved tag (exact → base-language alias →
  `en`) → English default (the component statically imports
  `@tecton-astryx/locales/en/<namespace>.js` and passes it as `defaults`).
- The provider reflects `lang` (and `dir` when given) onto itself so CSS `:lang()`, our walk and `Intl`
  agree. Changes to `<html lang dir>` and provider values re-render subscribers; other ancestor changes
  are picked up on reconnect or `localeController.refresh()`.
- Catalogs: the 30 upstream files (370 ids) copied to `locales/src/catalogs/` with hashes; generated
  `pseudo` (D5); base-tag aliases (`fr → fr-FR`, `pt → pt-BR`, `zh → zh-CN`, `zh-Hant/zh-HK → zh-TW`,
  `nb/nn → no-NO`, …) in `aliases.js`. Missing locales are loaded on demand (`loadLocale` called by the
  controller, then `requestUpdate`).
- `format.ts` is the only module importing `intl-messageformat` (boundary); formatters are cached per
  `(locale, pattern)`.
- New messages: `<folder>.messages.json` (`@tct.<folder>.<key>`), merged into the English namespaces;
  untranslated ids fall back to English and are listed in `reports/i18n-missing.json`.

### 9.16 Announcer — `core/src/a11y/announcer.ts`

```ts
export function announce(message: string, options?: {politeness?: 'polite' | 'assertive'; element?: Element}): void;
export function clearAnnouncements(): void;
```

`element.ariaNotify(message, {priority})` when supported; otherwise one polite and one assertive
light-DOM live region per document (mounted empty on first use, debounced, cleared ~2 s after
speaking, moved into the top-most modal while one is open). Components never own live regions; no
empty `role=status` per spinner.

### 9.17 Ids — `core/src/utils/id.ts`

```ts
export function uniqueId(prefix?: string): string;   // `${prefix}-${seed}-${n}`, document-unique
export class IdController { constructor(host: ReactiveControllerHost, prefix: string); id(part: string): string; }
```

### 9.18 Other WP-F controllers and helpers

| Module | Signature (abridged) | Purpose / upstream |
| --- | --- | --- |
| `controllers/resize.ts` | `new ResizeController(host, {target, callback, box?})`; `observeResize(el, cb)` / `unobserveResize` | one shared `ResizeObserver` (upstream `sharedResizeObserver`) |
| `controllers/media-query.ts` | `new MediaQueryController(host, query)` → `.matches` | `useMediaQuery`; SSR-safe (false on server) |
| `controllers/interaction-modality.ts` | `getModality(): 'keyboard'\|'pointer'\|'virtual'` | upstream `interactionModality` |
| `controllers/hover-intent.ts` | `new HoverIntentController(host, {trigger, openDelay, closeDelay, touch: 'auto'\|'tap'\|'none', onOpen, onClose})` | Tooltip/HoverCard delays, WCAG 1.4.13 hoverable surfaces, upstream `useTouchTrigger` |
| `controllers/tooltip.ts` | `new TooltipController(host, {trigger, content, placement, mode: 'shadow'\|'satellite'})` | shared by `tct-tooltip` and every component with a built-in tooltip |
| `controllers/slot.ts` | `new SlotController(host, ...slotNames)` → `.has(name)` | non-whitespace slot presence; `:state(has-x)` |
| `controllers/size.ts` | `new SizeController(host, {explicit: () => size, fallback})` → `.value` | `sizeContext` cascade (explicit → provider → default) |
| `controllers/owned-parts.ts` | `new OwnedPartsController(host, {parts: [{slot, tag, init}]})` | satellites (§8.2) |
| `controllers/clickable-container.ts` | `new ClickableContainerController(host, {action: () => HTMLElement})` | `useClickableContainer`: whole-surface click, modifier/middle-click new tab, nested interactive safety (`INTERACTIVE_SELECTORS`) |
| `controllers/focus-trap.ts` | `new FocusTrapController(host, {container, active})` | `useFocusTrap` parity for **non-dialog** containers only; never inside `<dialog>`; Escape is not its job (D7) |
| `layer/scroll-lock.ts` | `lockScroll(): () => void` | ref-counted |
| `mixins/box-props.ts` | `BoxPropsMixin(Base)` adds `padding*`, `width`, `height`, `max-width`, `min-height` attributes → private custom properties on `part="base"` | Layout/Stack/Section/Center/ScrollableArea shared padding utilities (breaks the upstream Layout↔Stack cycle) |
| `styles/light-dom.ts` | `adoptLightDomStyles(host, sheet)` | §6.7 |
| `utils/dev.ts` | `devWarn(id, message)`, `devError` | once-per-id warnings when `globalThis.tctDevMode` |
| `utils/safe-url.ts` | `safeUrl(url, {allowData?})` | port of upstream blocked-scheme policy |
| `security/sanitize.ts` | `sanitizeHtml(html, {svg?}): DocumentFragment` | native Sanitizer (`setHTML`) when available, else lazy `dompurify` (only module importing it); used only where an API accepts consumer markup strings |
| `date/*` | owned by WP-13 | only module importing `@internationalized/date`; hosts the ported `plainDate*` API |

Controllers owned by later work packages (new files in `core/src/controllers/`): `grid-focus.ts`
(WP-13), `tree-focus.ts` (WP-5), `overflow.ts` (WP-5), `keyboard-hint.ts` (WP-3),
`adaptive-presentation.ts` (WP-4), `hotkeys.ts` (WP-18), `long-press.ts` (WP-6),
`scroll-overflow.ts` + `scrollable-area.ts` (WP-8), `streaming-text.ts` (WP-17).

---

## 10. Accessibility and keyboard standard

- Target WCAG 2.2 AA for documented examples and supported compositions, plus at least verified
  upstream behaviour; WAI-ARIA APG for pattern contracts. Never copy a known upstream a11y defect;
  record improvements as `differences` (`type: a11y-improvement`) with reproduction.
- Semantics: native element inside the shadow root when the component *is* a native control; host
  semantics via `ElementInternals` when the host is the semantic node; never a host `role` attribute;
  links stay `<a href>`.
- Focus model: `aria-activedescendant` only where DOM focus must stay in a text input (combobox,
  typeahead, command palette, tokenizer); roving tabindex elsewhere; `delegatesFocus` only with exactly
  one focus destination.
- Keyboard contracts follow plan §7's family table; each component lists its table in
  `parity.json.keyboard` (docs and tests read the same table). Home/End, PageUp/PageDown, typeahead,
  Escape (one layer per press), Enter/Space activation, Tab leaving composites, RTL-mirrored arrows.
- Disabled: FACE hosts get native disabled; transiently unavailable and "disabled with reason"
  controls use `aria-disabled` + guarded activation and stay focusable (upstream pattern); focus is never
  dropped to `<body>`.
- Visible, unobscured focus (§6.5); 24×24 CSS px minimum targets with a coarse-pointer hit-area bump;
  colour-independent state cues; 200 % text, 320 px reflow, text-spacing overrides survive.
- Announcements only via the Announcer; no speech flooding (debounced counts, streaming chat announces
  completion, not tokens).
- Tests: axe (violations fail; `incomplete` triaged), computed accessibility tree assertions
  (`axNode`/`axTree` over CDP in Chromium; `ariaSnapshot` cross-engine), keyboard tables. Manual AT
  matrix (NVDA+Chrome/Firefox, JAWS, VoiceOver macOS/iOS, TalkBack) per release, recorded in
  `docs/a11y/at-results/` (WP-H).

---

## 11. Internationalisation and RTL

- Direction from computed style of the host; arrow semantics mirror in RTL; logical CSS only.
- Dates/times: storage (ISO/PlainDate), display locale (`Intl`) and time zone are separate concerns
  `[mwg:support-global-calendar-systems]`, `[mwg:capture-location-agnostic-data]`,
  `[mwg:coordinate-global-events]`; implemented in `core/date` over `@internationalized/date` (WP-13).
- Numbers via `Intl.NumberFormat` with the resolved locale.
- 30 locales + pseudo (§9.15); test every component that has strings in `en`, `de-DE` (long strings)
  and `ar-SA` (RTL); the docs "Internationalization" guide uses real file names (D4) and states that 30
  catalogs ship (D3 fixed).

---

## 12. Icons (D-004, D-007, D-009, D-013)

- `core/src/icons/registry.ts`:

```ts
export interface IconDefinition {
  viewBox: string;                                   // e.g. '0 0 24 24'
  paths: ReadonlyArray<{d: string; fillRule?: 'evenodd' | 'nonzero'}>;
  mode: 'fill' | 'stroke';                           // stroke: strokeWidth from definition
  strokeWidth?: number;
  mirrorInRtl?: boolean;                             // chevrons, arrows
  colored?: boolean;                                 // carries colours of its own (D-013: strata)
  svg?: string;                                      // D-013 Q-02: optional raw SVG body, see below
}
export type IconLoader = () => Promise<IconDefinition>;
export function registerIcons(icons: Record<string, IconDefinition | IconLoader>, options?: {namespace?: string}): void;
export function getIcon(name: string): IconDefinition | IconLoader | undefined;
export function resetIcons(): void;
```

- `tct-icon name="close"` renders `<svg viewBox aria-hidden="true" focusable="false">` with `<path d>`
  from **Lit `svg` templates** (no `unsafeSVG`). A labelled icon (`label="…"`) gets `role=img` +
  `ariaLabel` via internals. Custom SVG: slot an `<svg>`; registering a raw SVG string goes through
  `sanitizeHtml(…, {svg: true})` once and is cloned.
- **`IconDefinition.svg`** (D-013 Q-02, the one addition to this shape): optional raw SVG body (inner markup, no
  `<svg>` wrapper) for glyphs that `paths` cannot express, i.e. per-shape colours. It goes through the same
  sanitiser once at registration and is cloned per instance, never trusted as-is; when present it replaces
  `paths` for rendering, and `paths` stays as the single-colour outline for renderers that ignore it. Generated
  bodies contain only `<path d fill fill-rule>` (no `<defs>`, ids, `url()`, `style`, `<foreignObject>`), so they
  survive the sanitiser unchanged. The Tecton `strata` glyph is the only user. Core's registry and `tct-icon`
  implement the field; `packages/icons/src/types.ts` mirrors it.
- **Default set** (`@tecton-astryx/icons/default.js`, registered as the lowest-priority layer by
  `tct-icon` on its first connect. It has no module side effect, and consumer registrations override it):
  upstream Astryx's role names (close, check, chevrons, status icons, calendar, clock, externalLink,
  menu, moreHorizontal, search, arrows, funnel, eyeSlash, viewColumns, copy, checkDouble, wrench, …)
  mapped to **Lucide** glyphs (D-009). Stroke icons: `mode: 'stroke'`, 24×24, stroke width 2, overridable
  through `--icon-stroke-width`.
  The default set also registers the **Tecton domain icons** (D-013 Q-02) as lazy loaders under their kebab
  names (`well`, `fault`, `seismic`, `strata`, …, outlined) and `<name>-filled`.
- **Full Lucide set**: `tools/icons/extract-lucide.ts` reads the dev-only `lucide` package and generates
  `@tecton-astryx/icons/lucide/<name>.js` data modules, one per icon, tree-shakeable and gitignored. It also
  generates a `lucide` registry helper. Notices: Lucide ISC + Feather MIT in THIRD-PARTY-NOTICES.
- **Tecton domain set** (D-013 Q-02, owner-supplied): 18 oil & gas / subsurface glyphs, each outlined and filled.
  The authored data is `packages/icons/src/tecton/glyphs/` (provenance in `packages/icons/src/tecton/README.md`);
  `tools/icons/extract-tecton.ts` generates `@tecton-astryx/icons/tecton/<name>.js` (exports `outlined`,
  `filled`, default = outlined) and `@tecton-astryx/icons/tecton.js` (`tectonIcons` loaders,
  `tectonIconNames`, `tectonIconMeta`). `<rect>` and simple `<g>` wrappers convert to paths exactly; 17 of the 18
  glyphs render pixel-identically to the original markup. `strata` (a CSS conic gradient through
  `<foreignObject>`) is re-expressed as a wedge fan in `svg` and is a bounded approximation. The 131-glyph
  tecton-astryx set is not used.

---

## 13. Security for content components

- No HTML-string sinks in library code: `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `document.write`, `unsafeHTML`, `unsafeSVG`, `Range#createContextualFragment` are lint errors
  outside `core/src/security/` → Trusted-Types compatible by construction `[mwg:trusted-types]`.
- Renderer callbacks return `TemplateResult | Node | string`; strings render as text.
- Markdown: port of upstream's in-house parser; AST → Lit templates; no raw HTML rendering (upstream
  does not render it); links/images through `safeUrl`; `rel="noopener noreferrer"` for external targets.
- Consumer markup strings (custom icon SVG, extension editors) go through `sanitizeHtml`
  (native Sanitizer, else lazy DOMPurify under its Apache-2.0 licence election, D-007a).
- Clipboard via the async Clipboard API only on user activation.
- WP-H runs the component suite once under `require-trusted-types-for 'script'` CSP.

---

## 14. SSR, DSD and registration safety

- v1 promise: every module imports in Node without DOM globals (Lit's DOM shim covers `customElements`
  in Node); no DOM work in constructors/`render()`; state derives from attributes; first paint never
  depends on `:state()` or JS-measured classes; components reuse an existing declarative shadow root.
- Test: `tools/ssr-import.node.test.ts` imports every built module in Node.
- WP-H spike renders Button, TextInput and Dialog with `@lit-labs/ssr` (pending approval, §19.3) and
  measures hydration, slot-dependent layout and FACE-before-upgrade; per-family SSR support is decided
  from that report.

---

## 15. Testing architecture

### 15.1 Runner

Root `vitest.config.ts` with two projects:

- **browser**: `include: ['packages/*/src/**/*.test.ts']`, `browser.enabled`, provider
  `playwright({launchOptions: {executablePath}})`, instances from `TCT_BROWSERS` (default `chromium`;
  CI `chromium,firefox,webkit`). `executablePath` = `$CHROMIUM_PATH`, else `/opt/pw-browsers/chromium`
  when it exists (the local build is Chromium 141 and does not match Playwright 1.63's expected
  revision, so the path is required), else Playwright's own. Never run `playwright install` locally.
  `setupFiles: ['packages/testing/src/setup.ts']`; `optimizeDeps.include` lists `lit`, `lit/*` subpaths
  and every approved runtime dep (a mid-run optimisation reloads the page). Uses the in-house CSS plugin.
- **node**: `*.node.test.ts` and `tools/**/*.test.ts` (token generator, parity, i18n, ssr-import).

`setup.ts` loads `tokens.css` + `fonts.css`, injects a Tailwind-preflight-equivalent reset (real apps
have one; components must render under it), and cleans fixtures after each test.

### 15.2 Utilities (`@tecton-astryx/testing`)

| Helper | Purpose |
| --- | --- |
| `fixture(template, {dir?, lang?, theme?})`, `settle(root)` | render and await every `tct-*` update (nested roots) |
| `expectAccessible(el, options?)` | axe-core; violations fail; `incomplete` returned for triage |
| `axNode(el)`, `axTree(el)` | Chromium computed accessibility tree via `cdp()` |
| `recordEvents(target, names)`, `expectEventCounts` | exact counts, flags (`bubbles`, `composed`, `cancelable`) |
| `pressKeys`, `deepActiveElement`, `tabSequence(root)` | keyboard helpers over `userEvent` |
| `formHarness(html)` → `{form, submit(), formData(), reset(), submitEvents}` | FACE contract checks |
| `emulateMedia({forcedColors, colorScheme, reducedMotion})` | CDP emulation |
| `withFeature(name, value, fn)` | wraps `overrideFeature` (Tier-2 paths) |
| `animationsFinished(el)`, `nextFrame`, `waitUntil` | timing |
| `openLayer(el)`, `layerStack()` | overlay assertions |

### 15.3 Standard suites (called from each component test file)

```ts
runElementSuite({tag, render, properties: {variant: 'primary'}, events: ['tct-open-change']});
// registration idempotence, pre-upgrade properties, reconnect/moveBefore keeps state,
// no events on property/attribute writes, default render axe, [hidden] works under preflight,
// host has no box styles (computed padding/border/background of :host are initial)
runFormControlSuite({tag, render, validValue, invalidSetup, multiValue?});   // every §9.7 row
runOverlaySuite({tag, render, open});   // one Escape per layer, nested Escape, outside press,
                                        // focus return, move while open, toast under modal
runKeyboardSuite({tag, render, table: parity.keyboard});   // rows reference named steps
```

### 15.4 Required test categories per component (DoD)

| Category | Minimum |
| --- | --- |
| Render & API | defaults; every attribute/property; reflection; every variant, size and state renders |
| A11y | axe clean in default + each state; role/name/state via `axNode` for interactive parts |
| Keyboard | every row of `parity.json.keyboard`, incl. RTL arrows |
| Form | `runFormControlSuite` for value controls; submitter/reset tests for buttons |
| Events | names, flags, counts, not on programmatic writes, intent cancelation keeps state |
| Overlay | `runOverlaySuite` for layer components |
| RTL | mirrored layout smoke (logical sides) + arrow semantics |
| Forced colours | renders; focus ring visible (`outline-style` not `none`); painters use system colours |
| Reduced motion | no transform/translate animations under `reduce` |
| i18n | strings from `de-DE` and `ar-SA`; attribute overrides win |
| Lifecycle | `runElementSuite` |

Visual regression (Vitest browser `toMatchScreenshot`, light/dark/dark-island × ltr/rtl ×
forced-colours × sizes/states, fonts loaded and blocked) and geometry comparison against upstream are
built by WP-H with CI-generated baselines; component WPs do not commit screenshots.

### 15.5 Parity and coverage reporting

`pnpm parity` builds `reports/parity.{json,md}` from the upstream manifest (184 core + 67 extension
entries) and all `parity.json` files: per entry status; API mapping coverage (mapped + waived /
upstream props); behaviour (test categories present); docs (required sections present);
theming (only tokens used, provisional list); keyboard and a11y. Waived rows remain disclosed gaps.
Code-coverage tooling is not proposed.

---

## 16. Documentation site

### 16.1 Stack

`apps/docs`: Astro 7 + Starlight 0.42, static output. Loads `@tecton-astryx/components/tecton.css`
and `define.js`; maps Starlight CSS variables (`--sl-color-*`, fonts) to our tokens so the shell is
Tecton-skinned from day one. Starlight UI components (Header, Sidebar, ThemeSelect, Search dialog,
Pagination, TableOfContents) are overridden with our elements as the relevant batches land (WP-D).

### 16.2 Generation

`tools/docs/generate-component-pages.ts` (run by `pnpm generate`) writes one MDX page per component
folder to `apps/docs/src/content/docs/components/<category>/<folder>.mdx` using: the CEM (API tables:
attributes/properties, methods, slots, events with flags, parts, states, custom properties, tokens used —
computed from the compiled CSS), `<folder>.docs.md` (authored sections), `examples/*.html` (rendered
by `<Example>`: live preview + source + copy button with announced status), and `parity.json`
(upstream mapping table, keyboard table, form semantics, differences, provisional badges). Categories =
the 11 upstream categories; the sidebar autogenerates per category directory. The generator fails when
a required authored section is missing.

### 16.3 Required page sections (plan §8), in order

Generated (G) or authored (A): Purpose (A) · When to use / alternatives (A) · Installation (G) ·
Anatomy (A) · Examples (A, from files) · Variants and states (A) · Responsive behaviour (A) ·
Attributes & properties (G) · Methods (G) · Slots (G) · Events (G, with bubbles/composed/cancelable) ·
Styling hooks: parts, states, custom properties (G) · Tokens (G) · Form semantics (A+G) ·
Keyboard interactions (G from `parity.json`) · Screen-reader expectations (A) · Localisation (A+G:
message ids) · Consumer responsibilities (A) · Differences from Astryx (G from mapping + `differences`) ·
Upstream mapping table (G).

### 16.4 Site pages

Foundations and guides mirror the 21 upstream topics (inventory §9.1): getting started, installation
(workspace/tarball/CDN self-host; no registry, D-008), browser support (§1), principles, colour,
typography, spacing/layout, shape (radii), elevation, motion, icons, illustrations, theming,
internationalisation, accessibility, styling & extension, migration (Astryx React → WC API
translation), all tokens (generated), working with AI (`llms.txt` + JSON/Markdown reference generated
from CEM + docs), differences & open items (generated: provisional tokens, D-002 list, waivers),
parity status (generated). Templates are deferred, playground excluded.

### 16.5 Docs-site accessibility gates

Skip link outside the sidebar and before it; one labelled `<nav>` per navigation region; `aria-current`
in sidebar and TOC; landmarks; search results count announced; code-copy status announced; system
colour scheme by default with a system/light/dark control; speculation rules for next-page prefetch;
`modulepreload` for render-blocking modules; view transitions as enhancement; route focus handled
(MPA). CI crawls every built page with Playwright + axe (`docs:a11y`) and a keyboard smoke (skip link,
sidebar, search).

---

## 17. Custom Elements Manifest

`@custom-elements-manifest/analyzer` with `litelement: true` over `components/src/*/tct-*.ts`,
`core/src/tct-element.ts`, `core/src/mixins/*.ts`, `core/src/events/*.ts`, and in-house plugins
(`tools/cem/`):

- `tct-public-api`: drop `#private`, `_underscored`, `private`/`protected`, `@internal` members and
  static plumbing (`styles`, `shadowRootOptions`, `formAssociated`, `dependencies`, `tagName`, `version`).
- `tct-hide-inherited`: `@hideInherited a, b - reason`.
- `tct-events`: resolve `@fires tct-x` to the event class JSDoc (`@eventName`, flags, fields).
- `tct-parity`: attach `x-tct-upstream` (mapping, keyboard, form, differences) from `parity.json`.
- `tct-internal-tags`: mark `@internal` classes so docs, parity and JSX types skip them.

Derived outputs: docs tables, API snapshots, autoloader map, cloak, JSX/Vue type generators (WP-I,
in-house), `llms.txt` + JSON/Markdown reference (WP-D). Drift test: every public member is documented,
every documented member exists, every upstream prop is mapped or waived.

---

## 18. Tooling

### 18.1 Lint

- **ESLint** (flat config) + typescript-eslint (type-aware). In-house rules via `no-restricted-syntax`
  / `no-restricted-imports` / a local plugin in `tools/eslint-plugin-tct/`: no `customElements.define`
  outside `core/src/define.ts`; no `@customElement`; no `new CustomEvent`/`new Event('tct-` outside
  `core/src/events`; no HTML sinks outside `core/src/security`; no `document.createElement('tct-`/`new Tct*()`;
  no direct imports of `@floating-ui/dom`, `intl-messageformat`, `@internationalized/date`, `dompurify`
  outside their boundary modules; no feature checks outside `core/features.ts`; no public `on*`
  properties; no `export *` in `define.ts`; no top-level DOM access in modules.
- **Stylelint** (approved) with an in-house plugin `tools/stylelint-plugin-tct/`: known custom
  properties only (token set, own `@cssprop`s, `--_<component>-*`, `@internal` coupling), no
  `--tecton-palette-*`, logical properties only (physical needs `/* physical: */`), no colour literals,
  no px font sizes, no `:host-context`, no box properties on `:host`, no nested pseudo-classes on
  `:host()`, every rule inside one of the four layers, `@media (forced-colors)` only inside `@layer a11y`,
  hover rules only inside `@media (hover: hover)`.

### 18.2 Format

`.editorconfig` now; Prettier is **pending approval** (§19.3). Until approved there is no `format`
step in `pnpm check`.

### 18.3 Scripts (root `package.json`)

| Script | Does |
| --- | --- |
| `pnpm generate` | tokens, locales, icons, CEM, barrels, autoloader map, docs pages |
| `pnpm lint` / `lint:css` | ESLint / Stylelint |
| `pnpm typecheck` | `tsc -b` over all packages and tools |
| `pnpm test` | Vitest (browser + node); `pnpm test <path>` for one folder |
| `pnpm build` | packages, then CDN bundle |
| `pnpm api:check` / `api:update` | per-folder API snapshots |
| `pnpm tokens:check` | §5.6 |
| `pnpm parity` | §15.5 report; `parity:check` validates schemas and coverage rules |
| `pnpm size` | size-limit over per-entry bundles (§18.4) |
| `pnpm licenses:check` | §18.6 |
| `pnpm docs:dev` / `docs:build` / `docs:a11y` | docs site |
| **`pnpm check`** | `generate → lint → lint:css → typecheck → tokens:check → api:check → parity:check → licenses:check → test → build → size → docs:build` (stops at first failure) |

### 18.4 Size budgets

`tools/size/build-entries.ts` bundles each `<folder>/define.js` with lit and core included (Vite, one
output per entry) into `reports/size/`; size-limit measures them (gzip). Budgets: `parity.json.sizeBudgetKb`
or by complexity S 12 kB, M 16 kB, L 22 kB, XL 30 kB (all including lit ≈ 7.6 kB min+gz measured for
lit + decorators); shared runtime (`core` base + define + events + context) ≤ 10 kB excluding lit.
Revised after WP-F measurements.

### 18.5 CI (GitHub Actions `.github/workflows/ci.yml`)

Node 22, pnpm 10 (corepack), cached store. Jobs:

1. `check` (ubuntu): install `--frozen-lockfile`, `pnpm check` with `TCT_BROWSERS=chromium`.
2. `browsers` (matrix `firefox`, `webkit`): `npx playwright install --with-deps <browser>` (CI only),
   `TCT_BROWSERS=<browser> pnpm test`.
3. `tier2`: Chromium run with `TCT_TIER2=1` (setup forces `implicitAnchor`, `elementReflection`,
   `customStates` off).
4. `docs`: `docs:build` + `docs:a11y`, upload the built site as an artifact.
5. `licenses`: `pnpm licenses:check` (also inside `check`).

No publish or release job (D-008). Artifacts: reports/, docs build, CDN bundle.

### 18.6 Licence check (D-007a, D-008)

`tools/licenses/check.ts` reads `pnpm licenses list --json` (built into pnpm; prod and dev) and fails on
any licence outside the allowlist: MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, 0BSD, OFL-1.1;
explicit exceptions: `dompurify` (Apache-2.0 election), `axe-core` (MPL-2.0, dev only, must not
appear in the prod tree) and the transitive dev-only licences approved under D-013 Q-01 (MIT-0, BlueOak-1.0.0,
CC0-1.0, Python-2.0, MPL-2.0; each pinned to an exact package and licence, never in the shipped tree; any new
licence still fails and needs review); our own workspace packages (`@tecton-astryx/*`, `UNLICENSED`, private).
It also verifies `THIRD-PARTY-NOTICES.md` lists every production dependency.
`THIRD-PARTY-NOTICES.md` records: runtime licences (lit, @floating-ui/*, @internationalized/date +
@swc/helpers, intl-messageformat + @formatjs/* + tslib, dompurify under Apache-2.0), OFL-1.1 notices for
Figtree and IBM Plex Mono, and the **upstream Astryx MIT licence and attribution** for adapted code
(icons, parser, tokenizer, hooks logic), catalogs and documentation text.

---

## 19. Dependency proposal (pending owner approval) — status after D-007

Rule (D-007, D-007a): nothing outside the approved list is installed. Every newly proposed dependency
needs a **licence check** (package and transitive tree against the §18.6 allowlist) before it goes to
the owner. Every non-lit runtime dependency sits behind one internal boundary module so it can be
swapped or removed.

### 19.1 Runtime dependencies (shipped to consumers)

| Package | Version | Licence | Cost (min+gz) | Why | No-dependency alternative | Status / boundary |
| --- | --- | --- | --- | --- | --- | --- |
| `lit` | 3.3.3 | BSD-3-Clause | ≈ 7.6 kB with decorators (measured) | element base, templates, reactive properties | hand-written custom elements (large, error-prone) | **Approved** (D-007) |
| `@floating-ui/dom` | 1.8.0 | MIT | ≈ 5 kB (est.), lazy | positioning when CSS anchor positioning/implicit anchors are unavailable (Tier 2) | in-house measured flip/shift/size (~250 lines) | **Approved**, lazy fallback only; boundary `core/layer/floating.ts` |
| `@internationalized/date` | 3.12.4 | Apache-2.0 | tree-shaken, ≈ 6–15 kB (est.) for date components only | calendar maths, calendar systems, time zones | port upstream's Gregorian-only `plainDate*` utilities | **Approved**; boundary `core/date/` (WP-13) |
| `intl-messageformat` | 12.1.2 | BSD-3-Clause | ≈ 10–12 kB (est.) incl. parser | ICU plural/select/number in the 370 upstream messages (upstream dependency) | in-house subset formatter | **Approved**; boundary `core/i18n/format.ts` |
| `dompurify` | 3.4.16 | Apache-2.0 (elected) | ≈ 8–9 kB (est.), lazy | sanitising consumer markup where the native Sanitizer is missing | require native Sanitizer only | **Approved** fallback; boundary `core/security/sanitize.ts` |
| `@fontsource-variable/figtree` | 5.3.0 | OFL-1.1 | font asset, ≈ 20 kB woff2 latin | Figtree (D-003) | none | **Approved**; files copied into `tokens/dist/fonts` |
| `@fontsource/ibm-plex-mono` | 5.3.0 | OFL-1.1 | ≈ 15 kB per weight | IBM Plex Mono (D-003) | none | **Approved** |
| `@lit/context` | 1.1.6 | BSD-3-Clause | ≈ 1–1.5 kB (est.) | context protocol | in-house protocol implementation (A-10) | **Not requested** — in-house |

### 19.2 Dev/build dependencies

| Package | Version | Licence | Install size (unpacked) | Why | No-dependency alternative | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `typescript` | **6.0.3** | Apache-2.0 | 24 MB | language (A-03) | — | **Approved** (pin 6.0.x, not 7.x) |
| `vite` | 8.3.1 | MIT | 2.4 MB (+ rolldown) | dev server, library build, CDN build, docs | — | **Approved** |
| `vitest`, `@vitest/browser`, `@vitest/browser-playwright` | 5.0.2 | MIT | 2.7 MB | test runner, browser mode | — | **Approved** |
| `playwright` | 1.63.0 | Apache-2.0 | 5.1 MB (+ browsers in CI) | browser automation | — | **Approved** |
| `@custom-elements-manifest/analyzer` | 0.11.0 | MIT | 9.9 MB (bundles TS 5.4) | CEM | in-house TS-API analyzer | **Approved** |
| `astro`, `@astrojs/starlight` | 7.3.5, 0.42.4 | MIT | 3.0 MB, 1.2 MB | docs site | plain Astro + own layout | **Approved** |
| `axe-core` | 4.13.0 | MPL-2.0 (dev only) | 3.1 MB | a11y assertions | — | **Approved** (D-007a exception) |
| `eslint`, `typescript-eslint` | 10.11.0, 8.71.0 | MIT | 2.9 MB | lint | tsc + grep checks | **Approved** |
| `stylelint` | 17.15.0 | MIT | 1.0 MB | CSS lint + in-house plugin | lightningcss visitor checks | **Approved** |
| `size-limit` (+ `@size-limit/file` plugin) | 14.1.0 | MIT | 43 kB | budgets | node:zlib script | **Approved**; confirm the `@size-limit/file` plugin is covered by the approval |
| `@capsizecss/metrics`, `@capsizecss/core` | 4.3.0, 4.1.3 | MIT | 27 MB (metrics) | font fallback metrics (§5.4) | hard-coded numbers from styling.md §13 | **Approved** |
| `vite-plugin-lit-css`, `lightningcss` (direct) | 3.1.0, 1.33.0 | MIT, MPL-2.0 | — | CSS→Lit | in-house plugin (A-04) | **Not requested** |
| `stylelint-use-logical`, `eslint-plugin-lit`, `eslint-plugin-wc` | — | — | — | lint rules | in-house rules | **Not requested** |
| `@wc-toolkit/jsx-types`, `colorjs.io`, `@oddbird/popover-polyfill`, `@tanstack/*`, Markdown parsers, syntax highlighters, `@changesets/cli` | — | — | — | — | in-house generator / contrast maths / floor covers Popover / port upstream / no publishing | **Not requested** |

### 19.3 Formerly pending: resolved by D-009

Approved (dev only): `prettier`, `@types/node`, `@lit-labs/ssr` (WP-H spike only), `lucide` (build-time icon
source), `@size-limit/file`. **Not approved:** `@material-symbols/svg-400`. The original proposal follows for the record.

#### Original proposal

| Package | Version | Licence (tree) | Cost | Why | Alternative | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `prettier` | 3.9.9 | MIT (no deps) | 10 MB, dev | one format for ~20 parallel worktrees; fewer noisy diffs | `.editorconfig` + review discipline | Approve (dev) |
| `@types/node` | 22.20.4 | MIT (+ `undici-types` MIT) | dev types | typecheck `tools/**` scripts | run tools untyped via Node type stripping | Approve (dev) |
| `@material-symbols/svg-400` | 0.47.5 | Apache-2.0 | 13 MB, dev only; generated glyph data shipped with NOTICE | D-004 default icon set source | vendor a curated SVG subset with Apache-2.0 NOTICE | Approve as dev-only extraction source |
| `@lit-labs/ssr` | 4.1.0 | BSD-3-Clause (+ lit family; parse5, @parse5/tools, node-fetch, enhanced-resolve: MIT) | dev only | WP-H SSR/DSD spike | skip the spike; keep "SSR-safe" only | Approve for the spike only |

Licence checks for these four were done from registry metadata; the transitive trees must be re-checked
with `pnpm licenses list` in a throwaway install before the owner signs off.

---

## 20. Items the orchestrator should double-check

1. **Support floor A-01** overrides the brief's default skill policy with a custom policy (native use of
   Newly-available features present in every Tier-1 engine, no polyfills). Confirm with the owner.
2. **Text-field strategy A-07** (shadow input default + slotted-input opt-in): verify autofill and
   password managers manually in Safari/Firefox/Chrome during WP-F; if the default fails badly, the
   fallback is making slotted-input the documented default for `type=password|email` fields.
3. **Icons A-13**: D-004's Material Symbols default is blocked by D-007 until its source is approved;
   v1 ships the upstream Astryx default set.
4. **TypeScript 6.0.x** instead of the latest 7.x (typescript-eslint peer range).
5. **Tooltip/field satellites** mutate the host's light DOM (owned children); framework hydration
   (React SSR) must be checked in WP-I.
6. `SubmitEvent.submitter` is a temporary native button, not the `tct-button` host (platform limit).

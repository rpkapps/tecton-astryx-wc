# Work breakdown (ARC-001)

Work packages for parallel implementation in separate git worktrees. Binding design:
`docs/ARCHITECTURE.md` ("A§n" below). Implementer checklist: `docs/CONVENTIONS.md`.

**Coverage:** all **184** `@astryxdesign/core` public components (D-006: 110 top-level, 67
subcomponents, 7 providers) are assigned exactly once below (WP-F + WP-1…WP-18), verified by script
against `docs/research/astryx-parity-manifest.json`. The **67** extension-package entries
(`@canary`: lab 56, charts 6, richtext 4, vega 1) are assigned to WP-X1…WP-X8, scheduled after core.
Complexity (Cx) S/M/L/XL comes from the manifest; "points" weight S=1, M=2, L=3, XL=5.

---

## 1. Rules for every work package

1. **Install only owner-approved dependencies** (D-007, A§19). No work package after WP-F edits any
   `package.json` or `pnpm-lock.yaml`.
2. One work package = one branch `wp/<id>-<slug>` in its own worktree, based on the current `main`.
   Rebase before hand-off; `pnpm check` must pass (Chromium locally).
3. Touch only: your component folders (listed per WP), the new `packages/core/src/…` files your WP is
   assigned, new event files in `packages/core/src/events/` (check for an existing class first), and
   docs pages assigned to you. Everything else is shared (A§3): put change requests in
   `parity.json.requests` and the hand-off report.
4. **Never edit or commit generated files** (A§3 table). Commit per-folder API snapshots.
5. Inside your shadow roots render other `tct-*` elements only from WP-F or from work packages already
   merged into `main` (declare them in `static dependencies`). Otherwise use internal markup; layout
   elements are never needed inside a shadow root.
6. Cross-family coupling goes through the context keys WP-F defines (A§9.4): `sizeContext`,
   `formLayoutContext`, `fieldContext`, `inputGroupContext`, `buttonGroupContext`, `linkContext`,
   `layerContext`, `interactiveRoleContext`, `layoutAreaContext`, `localeContext`, `themeContext`. This
   is why several upstream "dependsOn" edges (Button→ButtonGroup/Link/Layout, Field→FormLayout,
   TextInput→InputGroup, Stack/Section→Layout) do **not** create scheduling dependencies.
7. Definition of Done: CONVENTIONS §3 for every entry. Hand-off report: CONVENTIONS §10.
8. modern-web-guidance search/retrieve before implementing each behaviour; cite guide ids.

## 2. Schedule and concurrency

| Wave | Work packages (run concurrently within a wave) | Starts when |
| --- | --- | --- |
| 0 | **WP-F** Foundation + vertical slice | now |
| 1 | WP-1 Layout primitives & static text · WP-2 Content & status · WP-3 Actions & disclosure · WP-4 Overlay surfaces · WP-5 Collections & rows · (WP-D docs starts) | WP-F merged |
| 2 | WP-6 Menus (needs 1, 4, 5) · WP-7 Basic form controls (needs 5) · WP-8 Layout & app frame (needs 1) · WP-9 Chat messages (needs 1, 2) | its dependencies merged |
| 3 | WP-10 In-page navigation (3, 4, 6) · WP-11 Selectors & pagination (4, 5, 7) · WP-12 Typeahead & tokenizer (4, 5, 7) · WP-13 Date & time (3, 4, 7) · WP-14 Navigation frame (4, 8) · WP-15 Table (2, 6, 7) · WP-16 Chat composer & layout (4, 9) · (WP-I integration starts) | its dependencies merged |
| 4 | WP-17 Rich content & media (3, 5, 7, 15) · WP-18 Command palette & PowerSearch (5, 11, 12, 13, 15) · (WP-H hardening) | its dependencies merged |
| 5 | WP-X1…WP-X8 extension packages | core release gate reached (or earlier by orchestrator decision) |

A wave-2/3 package may start as soon as **its** listed dependencies are merged; waves are the latest
start, not a barrier.

| WP | Entries | Points | Depends on (merged) |
| --- | --- | --- | --- |
| WP-F | 17 | 30 (+ platform) | — |
| WP-1 | 16 | 17 | F |
| WP-2 | 14 | 18 | F |
| WP-3 | 10 | 18 | F |
| WP-4 | 8 | 22 | F |
| WP-5 | 10 | 16 | F |
| WP-6 | 9 | 18 | F, 1, 4, 5 |
| WP-7 | 12 | 25 | F, 5 |
| WP-8 | 10 | 19 | F, 1 |
| WP-9 | 8 | 13 | F, 1, 2 |
| WP-10 | 10 | 23 | F, 3, 4, 6 |
| WP-11 | 5 | 17 | F, 4, 5, 7 |
| WP-12 | 5 | 18 | F, 4, 5, 7 |
| WP-13 | 6 | 23 | F, 3, 4, 7 |
| WP-14 | 12 | 28 | F, 4, 8 |
| WP-15 | 7 | 13 (+ 12 plugins) | F, 2, 6, 7 |
| WP-16 | 7 | 17 | F, 2, 4, 9 |
| WP-17 | 8 | 22 | F, 3, 5, 7, 15 |
| WP-18 | 10 | 21 | F, 5, 11, 12, 13, 15 |
| **Total** | **184** | | |

---

## 3. WP-F — Foundation and reference vertical slice (one engineer, sequential milestones)

**Goal:** everything every later package relies on, proven end to end by a vertical slice that exercises
forms, overlays, focus return, nested Escape, naming, the event contract and docs generation.

**Install only owner-approved dependencies (see ARCHITECTURE.md §Dependency proposal, A§19).** Declare
every approved runtime dependency in the owning `package.json` now (A§2.2) so no later package touches a
manifest or the lockfile. D-009 also approves `prettier`, `@types/node`, `@lit-labs/ssr` (used only by the WP-H spike, but declared
now) and `lucide` (build-time icon source), all dev-only. Install them in WP-F M1. `@material-symbols/svg-400`
is **not** approved.

The orchestrator may review after each milestone; each milestone ends with `pnpm check` green for what
exists so far.

### M1 — Workspace, tooling, CI

- pnpm workspace (A§2.1): root `package.json` (private, `UNLICENSED`, scripts A§18.3), every package's
  `package.json` (`private: true`, `license: "UNLICENSED"`, `exports`/`sideEffects` per A§2.4,
  `tct-source` condition), `tsconfig.base.json` (A-03) + project references, `.editorconfig`,
  `.gitignore` (A§3).
- `tools/vite-plugin-tct-css.ts` (A§2.3), used by build, Vitest and docs.
- ESLint flat config + `tools/eslint-plugin-tct/` rules; Stylelint config + `tools/stylelint-plugin-tct/`
  rules (A§18.1).
- `tools/schemas/parity.schema.json`, `tools/check-parity.ts`, `tools/generate.ts` orchestration.
- **Licence allowlist check** `tools/licenses/check.ts` (A§18.6: MIT, BSD-2/3-Clause, Apache-2.0,
  ISC, 0BSD, OFL-1.1; exceptions dompurify (Apache-2.0 election) and axe-core (dev only); our
  `@tecton-astryx/*` UNLICENSED private packages accepted) wired into `pnpm check` and CI.
- **`THIRD-PARTY-NOTICES.md`**: runtime licences, OFL-1.1 font notices, upstream Astryx MIT licence and
  attribution for adapted code, catalogs and docs text (D-007a, D-008). No LICENSE file (D-008).
- `.github/workflows/ci.yml` (A§18.5): check, browser matrix, tier2, docs, licences. **No publish or
  release job.**

### M2 — Tokens and fonts (`packages/tokens`)

- Copy inputs + `inputs.lock.json` (A§5.1); normaliser, resolver (A§5.2, D-001 export-first, overrides
  file with the accent-ink rebinds), generator for `tokens.css`, `palette.css`, `fonts.css` (Capsize
  metrics), `tokens.{js,d.ts,json}`, `fallbacks.json`, `[data-media-theme]` blocks, provisional and
  astryx-retained status (D-002, D-013).
- `tokens:check` (A§5.6) incl. contrast matrix with `contrast.allow.json`, token-name snapshot,
  Astryx coverage (258 names), Tailwind collision list.

### M3 — Core runtime (`packages/core`)

Files (fixed paths, A§9): `tct-element.ts`, `define.ts`, `features.ts`, `events/{tct-event,tct-open-change,tct-after-open-change,tct-value-change,tct-clear,tct-remove}.ts`,
`context/*` (protocol + all context keys of A§9.4), `controllers/{aria-delegate,roving-tabindex,active-descendant,typeahead,field-chrome,owned-parts,resize,media-query,interaction-modality,hover-intent,tooltip,slot,size,clickable-container,focus-trap}.ts`,
`mixins/{form-control,box-props}.ts`, `forms/{implicit-submit,submitter,validators}.ts`,
`layer/{stack,layer-controller,position,floating,scroll-lock,top-layer-host,gesture}.ts`,
`i18n/{locale-controller,format,registry,direction}.ts`, `a11y/announcer.ts`, `icons/registry.ts`,
`security/sanitize.ts`, `styles/light-dom.ts`, `utils/{id,ime,dev,safe-url}.ts`.

- `packages/locales`: copy the 30 upstream catalogs with hashes, generate per-locale modules, English
  namespace modules, pseudo locale, alias table (A§9.15).
- `packages/icons`: `tools/icons/extract-lucide.ts` generates Lucide data modules; default set = Astryx role
  names mapped to Lucide glyphs (A§12, D-009); `tools/icons/extract-tecton.ts` converts the owner's Tecton
  domain icons (`packages/icons/src/tecton/glyphs`, D-013 Q-02) and the default set registers them.

### M4 — Test harness (`packages/testing`)

`setup.ts`, utilities and the four standard suites (A§15.2–15.3); root `vitest.config.ts` (browser +
node projects, `executablePath` logic, `TCT_BROWSERS`, `TCT_TIER2`); port the upstream
`Layer/layerDismissalInvariants.test.tsx` and `layerDismissalFamilies.test.tsx` cases as core tests;
turn every High/Medium finding of the earlier project's review (CONVENTIONS §9) into a test.

### M5 — Vertical slice components

Shared styles `packages/components/src/styles/*.styles.css` (A§6.1). Components:

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-icon` | Icon | `icon/` | `Icon/Icon.tsx` | M | — |
| `tct-text` | Text | `text/` | `Text/Text.tsx` | M | — |
| `tct-heading` | Heading | `heading/` | `Heading/Heading.tsx` | S | — |
| `tct-visually-hidden` | VisuallyHidden | `visually-hidden/` | `VisuallyHidden/VisuallyHidden.tsx` | S | — |
| `tct-spinner` | Spinner | `spinner/` | `Spinner/Spinner.tsx` | S | — |
| `tct-button` | Button | `button/` | `Button/Button.tsx` | M | ButtonGroup (WP-3), Layout (WP-8), Link (WP-2) |
| `tct-field` | Field | `field/` | `Field/Field.tsx` | M | FormLayout (WP-1) |
| `tct-field-label` | FieldLabel (sub of Field) | `field/` | `Field/FieldLabel.tsx` | S | FormLayout (WP-1) |
| `tct-input-clear-button` | InputClearButton (sub of Field) | `field/` | `Field/InputClearButton.tsx` | S | — |
| `tct-field-status` | FieldStatus | `field-status/` | `FieldStatus/FieldStatus.tsx` | S | — |
| `tct-text-input` | TextInput | `text-input/` | `TextInput/TextInput.tsx` | M | InputGroup (WP-7) |
| `tct-dialog` | Dialog | `dialog/` | `Dialog/Dialog.tsx` | L | Layout (WP-8) |
| `tct-dialog-header` | DialogHeader (sub of Dialog) | `dialog/` | `Dialog/DialogHeader.tsx` | S | Layout (WP-8) |
| `tct-tooltip` | Tooltip | `tooltip/` | `Tooltip/Tooltip.tsx` | M | — |
| `tct-theme` | Theme (provider) | `theme/` | `theme/Theme.tsx` | XL | MediaTheme (WP-1) |
| `tct-size-provider` | SizeProvider (provider) | `size-provider/` | `SizeContext/SizeContext.ts` | S | — |
| `tct-internationalization-provider` | InternationalizationProvider (provider) | `internationalization-provider/` | `i18n/InternationalizationProvider.tsx` | M | — |

Slice-specific requirements:

- `tct-button`: FACE (submit/reset submitter semantics), `href` renders `<a>` with `linkContext`
  navigation, `clickAction` busy state + dedupe, `loading`, `icon-only` (label required: `label`
  attribute → accessible name + built-in tooltip via `TooltipController` in shadow mode), disabled vs
  `aria-disabled` "disabled with reason", sizes via `sizeContext`, ButtonGroup corner variables.
- `tct-text-input`: shadow mode and slotted-input mode (A§9.8), `type` text/email/password/search/tel/url,
  clear button (`tct-input-clear-button`, `tct-clear` event), start/end adornments, status/description,
  `formLayoutContext` horizontal labels, `inputGroupContext` participation, IME-safe Enter.
- `tct-field`: standalone wrapper with satellites; `input-id`/`label-id`/`description-id`/`group-label`.
- `tct-dialog`: `<dialog>` + `showModal()`, `heading`/`slot="heading"`, `tct-dialog-header`, close button,
  `purpose="required"` (Escape `block`), intent/commit events, `openDialog()` imperative API
  (`useImperativeDialog`), `command` invokers, re-show after move.
- `tct-tooltip`: wraps its trigger (default slot), satellite surface, hover/focus/touch policy,
  hoverable, Escape via stack, `aria-describedby` wiring through AriaDelegate.
- `tct-theme` (`mode`, `theme` token-override object; theme-island rule), `tct-size-provider`,
  `tct-internationalization-provider` (`locale`, `dir`, `messages`, `overrides`; reflects `lang`).
- `tct-icon`, `tct-text` (types incl. Tecton custom types, truncation with tooltip `useTruncation`),
  `tct-heading` (levels via internals), `tct-visually-hidden`, `tct-spinner` (progressbar semantics, slows
  under reduced motion), `tct-field-status` (announced via Announcer).

Hooks/utilities mapped in WP-F (`parity.json.hooks`): `useLayer`, Layer subpath API
(`useLayerDismissal`, `LayerDepthProvider`, `useTouchTrigger`, `isActionTrigger`, `layerAnimations`),
`useFocusTrap`, `useAnnounce`, `useListFocus`, `useTypeahead`, `useMediaQuery`, `useMergedRefs`
(waived: n/a), `useInteractiveRole` + `InteractiveRoleContext`, `useClickableContainer` +
`INTERACTIVE_SELECTORS`, `useInputContainer`, `useInputStatusIcon`, `useScrollLock`, `useDevWarning`,
`useIndicatorFocusRing`, `useEntryAnimation`, `useTooltip`, `useImperativeDialog`, `useIcon`,
`registerIcons`/`getIcon`/`getIconRegistry`/`getExtendedIcon`/`resetIcons`/`renderIconSlot`, `useSize` +
`SizeContext`, `useTranslator`, `useLocale`, `useCollator`, `useDirection`, `getLocaleDirection`,
`useTheme`, `useThemeName`, `ThemeContext`, `InternationalizationContext`, `useTruncation`,
`isImeKeyEvent`, Field style exports (`inputWrapperStyles` … → waived: CSS parts/tokens).

### M6 — Metadata, docs, packaging

- CEM analyzer config + plugins (A§17); API snapshots (`api:update`/`api:check`).
- Generators: barrels, define-all, autoloader map, cloak, light-dom.css, docs pages (A§16.2), parity
  report (A§15.5), i18n-missing report.
- `apps/docs`: Astro + Starlight shell, Tecton-skinned (A§16.1), `<Example>` and API table components,
  generated pages for the slice, stub pages for all 21 foundation/guide topics (WP-D fills them),
  "Parity status" and "Differences and open items" generated pages, docs a11y crawl (`docs:a11y`).
- Autoloader + CDN build (A§2.5); size budgets (A§18.4); server-import test (A§14).

### Acceptance criteria (all automated unless noted)

1. `pnpm install --frozen-lockfile && pnpm check` passes locally (Chromium) and in CI (Chromium);
   the Firefox/WebKit CI jobs run (failures triaged into issues, none in the slice's contract tests).
2. `pnpm licenses:check` passes; `THIRD-PARTY-NOTICES.md` lists every production dependency and the
   Astryx attribution; no LICENSE file; every `package.json` is `private` + `UNLICENSED`.
3. `pnpm tokens:check`: input hashes, 1,820 palette names without collisions, 258 Astryx names covered,
   D-001 export values used (spot-check `--color-accent` light = `#644a78`), contrast matrix with
   allowlist only, D-002 provisional set exact.
4. Form contract (Chromium): a `<form>` containing `tct-text-input name=a required`,
   `tct-field` wrapping a native `<input name=b>`, and `tct-button type=submit name=go value=1`:
   Enter in the text input submits exactly once with `FormData` `{a, b, go=1}`; empty required field
   blocks submit, focuses the text input and shows `:state(user-invalid)` + `aria-invalid` only then;
   `form.checkValidity()` does not show errors; reset restores attribute defaults; `<fieldset disabled>`
   disables both; `form=` association works from outside the form; label click focuses; slotted-input
   mode submits the author's input exactly once (no double entry).
5. Overlay contract: a `tct-dialog` opened by a `tct-button` contains a `tct-text-input` whose clear
   button has a `tct-tooltip`, plus a nested `tct-dialog`. Escape closes tooltip → nested dialog →
   dialog, one per press; focus returns to the opener each time; outside press on the backdrop follows
   the dialog's policy; the tooltip never closes the dialog; a toast-like announcer message is spoken
   while the modal is open; moving an open dialog with `moveBefore` keeps it modal (Chromium).
6. Naming contract: `axNode` shows correct role/name/description for the text input (shadow mode label,
   description, status), the slotted native input inside `tct-field`, the tooltip trigger
   (`description` = tooltip text), and the dialog (`name` = heading). Tier-2 run (features off) still
   exposes the same names via text fallback.
7. Event contract: exact counts: typing "ab" → 2 `input`, blur → 1 `change` (composed, from the host);
   one `click` per activation (no duplicates); `tct-open-change` cancelable (preventDefault keeps the
   dialog open), `tct-after-open-change` after the exit animation; no events on property writes.
8. Positioning: tooltip placed by CSS anchor positioning in Chromium without importing the Floating UI
   module (asserted); with `implicitAnchor` forced off it is placed by Floating UI; RTL `start`
   placement flips side.
9. Registration: double import no-throw, different-class warning once, pre-upgrade properties honoured,
   define-after-parse upgrade, server import of every built module in Node.
10. i18n: `lang="de-DE"` loads the German catalog lazily and re-renders the dialog close label;
    `ar-SA` sets RTL; `tct-internationalization-provider` overrides win; pseudo locale renders.
11. Docs: `pnpm docs:build` produces pages for every slice component with all A§16.3 sections;
    `pnpm docs:a11y` passes; the example previews use the real components.
12. `pnpm parity` reports the 17 slice entries `implemented` with 100 % API rows mapped or waived.
13. `pnpm size` passes the initial budgets; measured numbers recorded in the hand-off for budget
    revision.
14. Manual (reported, not blocking): autofill/password-manager check of shadow vs slotted-input mode in
    Chrome, Firefox and Safari if available (A§20 item 2).

---

## 4. Component work packages (core)

Each table lists tag ↔ upstream name (kind), folder, upstream path under
`/home/user/refs/astryx/packages/core/src/`, complexity and upstream dependencies that live in other
packages. Subcomponents are listed with their parent. Every package's generic acceptance is the DoD;
the bullets add package-specific criteria.

### WP-1 — Layout primitives & static text (wave 1)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-stack` | Stack | `stack/` | `Stack/Stack.tsx` | S | Layout (WP-8) |
| `tct-stack-item` | StackItem (sub of Stack) | `stack/` | `Stack/StackItem.tsx` | S | — |
| `tct-hstack` | HStack | `hstack/` | `HStack/HStack.tsx` | S | — |
| `tct-vstack` | VStack | `vstack/` | `VStack/VStack.tsx` | S | — |
| `tct-center` | Center | `center/` | `Center/Center.tsx` | S | Layout (WP-8) |
| `tct-grid` | Grid | `grid/` | `Grid/Grid.tsx` | S | — |
| `tct-grid-span` | GridSpan (sub of Grid) | `grid/` | `Grid/GridSpan.tsx` | S | — |
| `tct-aspect-ratio` | AspectRatio | `aspect-ratio/` | `AspectRatio/AspectRatio.tsx` | S | — |
| `tct-divider` | Divider | `divider/` | `Divider/Divider.tsx` | S | — |
| `tct-form-layout` | FormLayout | `form-layout/` | `FormLayout/FormLayout.tsx` | S | — |
| `tct-section` | Section | `section/` | `Section/Section.tsx` | S | Layout (WP-8) |
| `tct-card` | Card | `card/` | `Card/Card.tsx` | S | Layout (WP-8) |
| `tct-kbd` | Kbd | `kbd/` | `Kbd/Kbd.tsx` | S | — |
| `tct-code` | Code | `code/` | `Code/Code.tsx` | S | — |
| `tct-blockquote` | Blockquote | `blockquote/` | `Blockquote/Blockquote.tsx` | S | — |
| `tct-media-theme` | MediaTheme (provider) | `media-theme/` | `theme/MediaTheme.tsx` | M | — |

- **Owns (core):** `core/src/theme/*` — port of upstream theme utilities (`defineTheme`,
  `generateThemeCSS`, `generateOnMediaCSS`, `generateAdaptationCSS`, `generateThemeRules(Split)`,
  `registerTheme`/`getRegisteredTheme(s)`/`resetThemes`, `expand*Scale`, token defaults,
  `DEFAULT_WIDTH_BREAKPOINTS`, `WIDTH_BREAKPOINT_NAMES`) emitting our token names; wires
  `tct-theme`'s `theme` property to a `DefinedTheme` (edit `theme/` folder granted).
- **Hooks/utilities:** `stack`, `stackItem` (map to attributes/`BoxPropsMixin` or waive with reason),
  `FormLayoutContext`, theme utilities above.
- **Risks:** children must be flex/grid items of the inner `part="base"` box through the default slot;
  `Divider` decorative vs `separator` semantics; `MediaTheme` must re-point focus ink on inverted
  surfaces (D-005 double ring); theme utilities must produce CSS equal to the token pipeline for the
  Tecton theme.
- **Acceptance:** golden test: `generateThemeCSS(tectonTheme)` ≡ generated `tokens.css` token set;
  `tct-form-layout direction="horizontal-labels"` changes `tct-text-input` layout through context;
  `tct-media-theme mode="dark"` recolours descendants incl. the focus ring; Section landmarks/dividers
  match upstream.

### WP-2 — Content & status (wave 1)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-badge` | Badge | `badge/` | `Badge/Badge.tsx` | S | — |
| `tct-skeleton` | Skeleton | `skeleton/` | `Skeleton/Skeleton.tsx` | S | — |
| `tct-status-dot` | StatusDot | `status-dot/` | `StatusDot/StatusDot.tsx` | S | Tooltip (WP-F) |
| `tct-progress-bar` | ProgressBar | `progress-bar/` | `ProgressBar/ProgressBar.tsx` | M | Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-empty-state` | EmptyState | `empty-state/` | `EmptyState/EmptyState.tsx` | S | — |
| `tct-citation` | Citation | `citation/` | `Citation/Citation.tsx` | S | Icon (WP-F) |
| `tct-timer` | Timer | `timer/` | `Timer/Timer.tsx` | S | Text (WP-F) |
| `tct-link` | Link | `link/` | `Link/Link.tsx` | M | Icon (WP-F), Text (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-link-provider` | LinkProvider (provider) | `link/` | `Link/LinkProvider.tsx` | S | — |
| `tct-avatar` | Avatar | `avatar/` | `Avatar/Avatar.tsx` | M | Tooltip (WP-F) |
| `tct-avatar-status-dot` | AvatarStatusDot (sub of Avatar) | `avatar/` | `Avatar/AvatarStatusDot.tsx` | S | — |
| `tct-avatar-group` | AvatarGroup | `avatar/` | `AvatarGroup/AvatarGroup.tsx` | M | VisuallyHidden (WP-F) |
| `tct-avatar-group-overflow` | AvatarGroupOverflow (sub of AvatarGroup) | `avatar/` | `AvatarGroup/AvatarGroupOverflow.tsx` | S | — |
| `tct-nav-icon` | NavIcon | `nav-icon/` | `NavIcon/NavIcon.tsx` | S | — |

- **Hooks/utilities:** `useLinkComponent`, `useLinkify` (module function `linkify()` returning
  templates), `useAvatarGroup`, `resolveSize`, `LinkProvider`.
- **Risks:** `Timer` must update text without a Lit render per tick (upstream purpose) and format
  durations per `[mwg:format-human-readable-durations]`; `ProgressBar` indeterminate under reduced
  motion; Avatar user colours need `contrast-color()` with fallback; `LinkProvider` interception must
  ignore modified/middle clicks.
- **Acceptance:** SPA navigation through `tct-link-provider` with no document navigation; ProgressBar
  value text localised; Timer spy shows zero `update()` calls per tick; AvatarGroup `max` overflow
  count has an accessible name.

### WP-3 — Actions & disclosure (wave 1)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-icon-button` | IconButton | `icon-button/` | `IconButton/IconButton.tsx` | S | Button (WP-F) |
| `tct-button-group` | ButtonGroup | `button-group/` | `ButtonGroup/ButtonGroup.tsx` | M | — |
| `tct-toggle-button` | ToggleButton | `toggle-button/` | `ToggleButton/ToggleButton.tsx` | M | Button (WP-F) |
| `tct-toggle-button-group` | ToggleButtonGroup | `toggle-button/` | `ToggleButton/ToggleButtonGroup.tsx` | M | — |
| `tct-segmented-control` | SegmentedControl | `segmented-control/` | `SegmentedControl/SegmentedControl.tsx` | M | Tooltip (WP-F) |
| `tct-segmented-control-item` | SegmentedControlItem (sub of SegmentedControl) | `segmented-control/` | `SegmentedControl/SegmentedControlItem.tsx` | S | — |
| `tct-toolbar` | Toolbar | `toolbar/` | `Toolbar/Toolbar.tsx` | M | Layout (WP-8), Section (WP-1) |
| `tct-collapsible` | Collapsible | `collapsible/` | `Collapsible/Collapsible.tsx` | M | Icon (WP-F) |
| `tct-collapsible-group` | CollapsibleGroup (sub of Collapsible) | `collapsible/` | `Collapsible/CollapsibleGroup.tsx` | M | — |
| `tct-banner` | Banner | `banner/` | `Banner/Banner.tsx` | M | Button (WP-F), Icon (WP-F), Layout (WP-8) |

- **Owns (core):** `controllers/keyboard-hint.ts` (`useKeyboardHint`).
- **Hooks/utilities:** `useButtonGroup`, `useCollapsible`, `useKeyboardHint`.
- **Risks:** ButtonGroup corner squaring via logical per-corner `--_button-*-radius` (RTL) and the
  size cascade; SegmentedControl semantics chosen per upstream (radio group vs navigation) and FACE when
  named; ToggleButtonGroup single/multiple; Toolbar roving over heterogeneous children (`focusTarget`);
  Collapsible `hidden="until-found"` only when supported (earlier project H3); Banner filled emphasis
  re-points text/icon/focus tokens (focus contrast on filled surfaces).
- **Acceptance:** RTL corner test; roving keyboard tables; find-in-page reveals collapsed content where
  supported; Banner dismiss returns focus sensibly; keyboard hint shown once.

### WP-4 — Overlay surfaces (wave 1)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-popover` | Popover | `popover/` | `Popover/Popover.tsx` | L | Button (WP-F) |
| `tct-hover-card` | HoverCard | `hover-card/` | `HoverCard/HoverCard.tsx` | M | — |
| `tct-overlay` | Overlay | `overlay/` | `Overlay/Overlay.tsx` | M | — |
| `tct-bottom-sheet` | BottomSheet | `bottom-sheet/` | `BottomSheet/BottomSheet.tsx` | XL | Layout (WP-8) |
| `tct-bottom-sheet-switcher` | BottomSheetSwitcher | `bottom-sheet/` | `BottomSheet/BottomSheetSwitcher.tsx` | L | — |
| `tct-alert-dialog` | AlertDialog | `alert-dialog/` | `AlertDialog/AlertDialog.tsx` | M | Button (WP-F), Dialog (WP-F), Heading (WP-F), Layout (WP-8), Stack (WP-1), Text (WP-F) |
| `tct-toast` | Toast | `toast/` | `Toast/Toast.tsx` | L | Button (WP-F), Icon (WP-F) |
| `tct-layer-provider` | LayerProvider (provider) | `toast/` | `Layer/LayerProvider.tsx` | M | — |

- **Owns (core):** `controllers/adaptive-presentation.ts` (`useAdaptivePresentation`,
  `utils/inputPresentation` policy: `popover | bottom-sheet | adaptive`, adaptive =
  `(max-width: 768px) and (pointer: coarse)`).
- **Hooks/utilities:** `usePopover`, `useHoverCard`, `useOverlay`, `useContainerReveal`, `useToast` →
  `toast()`/`dismissToast()` module functions, `useImperativeAlertDialog` → `openAlertDialog()`,
  `LayerProvider` toast config.
- **Risks:** BottomSheet (XL): drag with snap points plus a single-pointer non-drag alternative
  (WCAG 2.5.7) and keyboard resize; modal vs non-modal; Toast stack in the top layer
  (`popover=manual`, sibling spacing fallback), pause on hover/focus, close button always for
  non-expiring toasts, toasts under an open modal (moved into it); AlertDialog non-light-dismissable;
  HoverCard touch policy and hoverable surface (WCAG 1.4.13).
- **Acceptance:** `runOverlaySuite` for every layer; a toast action is clickable while a dialog is
  modal; adaptive presentation switches under emulated coarse pointer.

### WP-5 — Collections & rows (wave 1)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-item` | Item | `item/` | `Item/Item.tsx` | M | Link (WP-2) |
| `tct-check-indicator` | CheckIndicator | `indicator/` | `Indicator/CheckIndicator.tsx` | S | Icon (WP-F) |
| `tct-checkbox-indicator` | CheckboxIndicator | `indicator/` | `Indicator/CheckboxIndicator.tsx` | S | — |
| `tct-radio-indicator` | RadioIndicator | `indicator/` | `Indicator/RadioIndicator.tsx` | S | — |
| `tct-list` | List | `list/` | `List/List.tsx` | M | — |
| `tct-list-item` | ListItem (sub of List) | `list/` | `List/ListItem.tsx` | M | — |
| `tct-overflow-list` | OverflowList | `overflow-list/` | `OverflowList/OverflowList.tsx` | M | — |
| `tct-metadata-list` | MetadataList | `metadata-list/` | `MetadataList/MetadataList.tsx` | S | — |
| `tct-metadata-list-item` | MetadataListItem (sub of MetadataList) | `metadata-list/` | `MetadataList/MetadataListItem.tsx` | S | — |
| `tct-tree-list` | TreeList | `tree-list/` | `TreeList/TreeList.tsx` | L | Icon (WP-F), Link (WP-2) |

- **Owns (core):** `controllers/tree-focus.ts` (`useTreeFocus`), `controllers/overflow.ts`
  (`useOverflow`, `computeOverflow`), `indicators/registry.ts` (`defaultIndicators`, `getIndicator`,
  `useIndicator`, `indicatorScope`).
- **Risks:** `Item` is the universal row (static / button / link via `ClickableContainerController`,
  nested interactive end content, density, line clamps) reused by menus, selectors and lists — freeze its
  API early; List semantics via internals (`list`/`listitem`); TreeList APG tree with lazy children and
  focus recovery on filter; OverflowList measurement without loops; MetadataList semantics decision
  (`term`/`definition` roles vs rendered `<dl>`) recorded as a difference.
- **Acceptance:** TreeList APG keyboard incl. typeahead and RTL; OverflowList "+N" named and stable
  under resize; Item nested button activation does not trigger the row.

### WP-6 — Menus (wave 2; needs WP-1, WP-4, WP-5)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-dropdown-menu` | DropdownMenu | `dropdown-menu/` | `DropdownMenu/DropdownMenu.tsx` | XL | BottomSheet (WP-4), Button (WP-F), Divider (WP-1), Heading (WP-F), Icon (WP-F), Item (WP-5), List (WP-5), Popover (WP-4), Section (WP-1), Spinner (WP-F) |
| `tct-dropdown-menu-item` | DropdownMenuItem (sub of DropdownMenu) | `dropdown-menu/` | `DropdownMenu/DropdownMenuItem.tsx` | M | Icon (WP-F), Item (WP-5) |
| `tct-dropdown-menu-divider` | DropdownMenuDivider (sub of DropdownMenu) | `dropdown-menu/` | `DropdownMenu/DropdownMenuDivider.tsx` | S | Divider (WP-1) |
| `tct-dropdown-menu-checkbox-item` | DropdownMenuCheckboxItem (sub of DropdownMenu) | `dropdown-menu/` | `DropdownMenu/DropdownMenuCheckboxItem.tsx` | S | Icon (WP-F), Item (WP-5) |
| `tct-dropdown-menu-radio-group` | DropdownMenuRadioGroup (sub of DropdownMenu) | `dropdown-menu/` | `DropdownMenu/DropdownMenuRadioGroup.tsx` | S | — |
| `tct-dropdown-menu-radio-item` | DropdownMenuRadioItem (sub of DropdownMenu) | `dropdown-menu/` | `DropdownMenu/DropdownMenuRadioItem.tsx` | S | Icon (WP-F), Item (WP-5) |
| `tct-dropdown-menu-sub-menu` | DropdownMenuSubMenu (sub of DropdownMenu) | `dropdown-menu/` | `DropdownMenu/DropdownMenuSubMenu.tsx` | L | Icon (WP-F), Item (WP-5), Spinner (WP-F) |
| `tct-more-menu` | MoreMenu | `more-menu/` | `MoreMenu/MoreMenu.tsx` | S | Icon (WP-F) |
| `tct-context-menu` | ContextMenu | `context-menu/` | `ContextMenu/ContextMenu.tsx` | L | Button (WP-F), Heading (WP-F), Icon (WP-F) |

- **Owns (core):** `controllers/long-press.ts` (`useLongPress`).
- **Hooks/utilities:** `useDropdownMenuContext`, `DropdownMenuContext`; upstream aliases
  `BreadcrumbMenu*`/`ContextMenu*` documented as served by the same tags.
- **Risks:** menu roles (`menu`, `menuitem`, `menuitemcheckbox`, `menuitemradio`), roving with
  disabled items focusable, typeahead, submenus (hover intent, arrow keys mirrored in RTL), adaptive
  bottom-sheet presentation, ContextMenu at pointer (virtual anchor, CSS path), Shift+F10 / ContextMenu
  key, long-press on touch, async items with spinner.
- **Acceptance:** submenu Escape closes only the submenu and focuses its parent item; context menu at
  pointer in Chromium never imports the Floating UI module; menu item activation fires once.

### WP-7 — Basic form controls (wave 2; needs WP-5)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-checkbox-input` | CheckboxInput | `checkbox-input/` | `CheckboxInput/CheckboxInput.tsx` | M | Field (WP-F), FieldStatus (WP-F), Spinner (WP-F), Tooltip (WP-F) |
| `tct-checkbox-list` | CheckboxList | `checkbox-input/` | `CheckboxList/CheckboxList.tsx` | M | Field (WP-F), List (WP-5), Tooltip (WP-F) |
| `tct-checkbox-list-item` | CheckboxListItem (sub of CheckboxList) | `checkbox-input/` | `CheckboxList/CheckboxListItem.tsx` | M | Item (WP-5), List (WP-5) |
| `tct-radio-list` | RadioList | `radio-list/` | `RadioList/RadioList.tsx` | M | Field (WP-F), Tooltip (WP-F) |
| `tct-radio-list-item` | RadioListItem (sub of RadioList) | `radio-list/` | `RadioList/RadioListItem.tsx` | M | Field (WP-F), Item (WP-5), Tooltip (WP-F) |
| `tct-switch` | Switch | `switch/` | `Switch/Switch.tsx` | M | Field (WP-F), FieldStatus (WP-F), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-slider` | Slider | `slider/` | `Slider/Slider.tsx` | L | Field (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-text-area` | TextArea | `text-area/` | `TextArea/TextArea.tsx` | M | Field (WP-F), Icon (WP-F), Spinner (WP-F), Tooltip (WP-F) |
| `tct-input-group` | InputGroup | `input-group/` | `InputGroup/InputGroup.tsx` | M | Field (WP-F) |
| `tct-input-group-text` | InputGroupText (sub of InputGroup) | `input-group/` | `InputGroup/InputGroupText.tsx` | S | — |
| `tct-number-input` | NumberInput | `number-input/` | `NumberInput/NumberInput.tsx` | L | Field (WP-F), Icon (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-file-input` | FileInput | `file-input/` | `FileInput/FileInput.tsx` | M | Field (WP-F), Icon (WP-F), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |

- **Hooks/utilities:** `useInputGroup`, `RadioListContext`.
- **Risks:** CheckboxInput ↔ CheckboxList cycle (one folder, group context); indeterminate; RadioList
  FACE on the group with validation anchor (earlier project H6); Switch `role=switch` FACE; Slider
  multi-thumb, Page/Home/End, localised value text, range `FormData`; TextArea auto-grow (`field-sizing`
  detected + JS fallback, `max-block-size`) and slotted-textarea mode; InputGroup one ring for addons
  (control observers); NumberInput locale parsing, steppers, IME full-width digits; FileInput drag and
  drop plus keyboard, files in `FormData`.
- **Acceptance:** every control passes `runFormControlSuite`; NumberInput parses `1.234,5` in `de-DE`;
  FileInput submits the chosen files; RadioList required blocks submit and focuses the first radio.

### WP-8 — Layout & app frame (wave 2; needs WP-1)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-layout` | Layout | `layout/` | `Layout/Layout.tsx` | L | Stack (WP-1) |
| `tct-layout-content` | LayoutContent (sub of Layout) | `layout/` | `Layout/LayoutContent.tsx` | S | — |
| `tct-layout-header` | LayoutHeader (sub of Layout) | `layout/` | `Layout/LayoutHeader.tsx` | S | — |
| `tct-layout-footer` | LayoutFooter (sub of Layout) | `layout/` | `Layout/LayoutFooter.tsx` | S | — |
| `tct-layout-panel` | LayoutPanel (sub of Layout) | `layout/` | `Layout/LayoutPanel.tsx` | M | — |
| `tct-scrollable-area` | ScrollableArea | `scrollable-area/` | `ScrollableArea/ScrollableArea.tsx` | M | — |
| `tct-resize-handle` | ResizeHandle | `resize-handle/` | `Resizable/ResizeHandle.tsx` | L | — |
| `tct-app-shell` | AppShell | `app-shell/` | `AppShell/AppShell.tsx` | L | SideNav (WP-14), TopNav (WP-14) |
| `tct-mobile-nav` | MobileNav | `mobile-nav/` | `MobileNav/MobileNav.tsx` | M | Button (WP-F), Heading (WP-F), Icon (WP-F) |
| `tct-mobile-nav-toggle` | MobileNavToggle (sub of MobileNav) | `mobile-nav/` | `MobileNav/MobileNavToggle.tsx` | S | Button (WP-F), Icon (WP-F) |

- **Owns (core):** `controllers/scrollable-area.ts` (`useScrollableArea`, scroll-keyboard delegation),
  `controllers/scroll-overflow.ts` (`useScrollOverflow`), `controllers/resizable.ts` (`useResizable`,
  `percent`).
- **Hooks/utilities:** `useAppShellMobile`, `AppShellMobileContext` (defined in `app-shell/`, consumed
  by WP-14), `LayoutAreaContext`, `LayoutDividerContext`, `container`, `overlayPaddingReset`,
  `edgeCompSlot`, `EDGE_COMP_ATTR`.
- **Risks:** ScrollableArea focusable only while overflowing; ResizeHandle `role=separator` with
  values, keyboard and non-drag alternative; AppShell breakpoints (media queries per upstream), skip
  link; MobileNav drawer as `<dialog>`.
- **Acceptance:** skip link focuses main; ResizeHandle keyboard operable with announced value; MobileNav
  opens under 768 px and returns focus.

### WP-9 — Chat messages (wave 2; needs WP-1, WP-2)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-chat-message` | ChatMessage | `chat-message/` | `Chat/ChatMessage.tsx` | M | — |
| `tct-chat-message-bubble` | ChatMessageBubble (sub of ChatMessage) | `chat-message/` | `Chat/ChatMessageBubble.tsx` | S | — |
| `tct-chat-message-metadata` | ChatMessageMetadata (sub of ChatMessage) | `chat-message/` | `Chat/ChatMessageMetadata.tsx` | S | Icon (WP-F) |
| `tct-chat-tokenized-text` | ChatTokenizedText (sub of ChatMessage) | `chat-message/` | `Chat/ChatTokenizedText.tsx` | M | Badge (WP-2) |
| `tct-chat-system-message` | ChatSystemMessage | `chat-system-message/` | `Chat/ChatSystemMessage.tsx` | S | Divider (WP-1) |
| `tct-chat-tool-calls` | ChatToolCalls | `chat-tool-calls/` | `Chat/ChatToolCalls.tsx` | M | Badge (WP-2), Icon (WP-F), Spinner (WP-F), VisuallyHidden (WP-F) |
| `tct-chat-message-list` | ChatMessageList (sub of ChatLayout) | `chat-message-list/` | `Chat/ChatMessageList.tsx` | M | Spinner (WP-F) |
| `tct-chat-layout-scroll-button` | ChatLayoutScrollButton (sub of ChatLayout) | `chat-message-list/` | `Chat/ChatLayoutScrollButton.tsx` | M | Button (WP-F), Icon (WP-F) |

- **Hooks/utilities:** `useChatStreamScroll`, `useChatNewMessages`.
- **Risks:** streaming updates must not steal focus or flood speech (announce completion, not tokens);
  stick-to-bottom with reduced motion; new-message affordance; tool-call status with spinner.
- **Acceptance:** 200 streamed chunks → one announcement per completed message; the scroll button
  appears when scrolled up and moves focus sensibly.

### WP-10 — In-page navigation (wave 3; needs WP-3, WP-4, WP-6)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-tab-list` | TabList | `tab-list/` | `TabList/TabList.tsx` | L | Icon (WP-F), Layout (WP-8) |
| `tct-tab` | Tab (sub of TabList) | `tab-list/` | `TabList/Tab.tsx` | M | Layout (WP-8), Link (WP-2) |
| `tct-tab-menu` | TabMenu (sub of TabList) | `tab-list/` | `TabList/TabMenu.tsx` | M | DropdownMenu (WP-6), Icon (WP-F), Popover (WP-4) |
| `tct-breadcrumbs` | Breadcrumbs | `breadcrumbs/` | `Breadcrumbs/Breadcrumbs.tsx` | M | — |
| `tct-breadcrumb-item` | BreadcrumbItem (sub of Breadcrumbs) | `breadcrumbs/` | `Breadcrumbs/BreadcrumbItem.tsx` | L | DropdownMenu (WP-6), Icon (WP-F), Link (WP-2), Popover (WP-4) |
| `tct-stepper` | Stepper | `stepper/` | `Stepper/Stepper.tsx` | L | Icon (WP-F), IconButton (WP-3) |
| `tct-step` | Step (sub of Stepper) | `stepper/` | `Stepper/Step.tsx` | M | Icon (WP-F), VisuallyHidden (WP-F) |
| `tct-outline` | Outline | `outline/` | `Outline/Outline.tsx` | L | Link (WP-2) |
| `tct-nav-heading-menu` | NavHeadingMenu | `nav-heading-menu/` | `NavMenu/NavHeadingMenu.tsx` | M | — |
| `tct-nav-heading-menu-item` | NavHeadingMenuItem (sub of NavHeadingMenu) | `nav-heading-menu/` | `NavMenu/NavHeadingMenuItem.tsx` | S | Icon (WP-F), Link (WP-2), Text (WP-F) |

- **Hooks/utilities:** `useTabListContext`, `useStepperContext`, `useOutlineFromDOM`,
  `useNavHeadingMenuContext`, `useNavHeadingCloseContext`, `NavHeadingMenuContext`,
  `NavHeadingCloseContext`. (`useOutlineFromMarkdown`/`parseOutlineFromMarkdown` → WP-17.)
- **Risks:** TabList keeps upstream semantics (D-006: `nav` + `aria-current` by default, APG tabs only in
  tablist mode, manual activation option), overflow into TabMenu, keyboard hint; Breadcrumbs collapse
  into a menu; Outline scrollspy correctness (earlier project M19) with `aria-current`.
- **Acceptance:** tablist-mode APG with panels; nav mode keeps links; Outline highlights the right
  section on load and when scrolling up.

### WP-11 — Selectors & pagination (wave 3; needs WP-4, WP-5, WP-7)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-selector` | Selector | `selector/` | `Selector/Selector.tsx` | XL | BottomSheet (WP-4), Divider (WP-1), Field (WP-F), Heading (WP-F), Icon (WP-F), InputGroup (WP-7), Item (WP-5), Popover (WP-4), Section (WP-1), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-selector-option` | SelectorOption (sub of Selector) | `selector/` | `Selector/SelectorOption.tsx` | S | Icon (WP-F), Item (WP-5) |
| `tct-multi-selector` | MultiSelector | `multi-selector/` | `MultiSelector/MultiSelector.tsx` | XL | Badge (WP-2), CheckboxInput (WP-7), Divider (WP-1), Field (WP-F), Icon (WP-F), InputGroup (WP-7), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-complex-selector` | ComplexSelector | `complex-selector/` | `ComplexSelector/ComplexSelector.tsx` | L | Field (WP-F), Icon (WP-F), Popover (WP-4), Spinner (WP-F) |
| `tct-pagination` | Pagination | `pagination/` | `Pagination/Pagination.tsx` | L | Button (WP-F), Icon (WP-F), NumberInput (WP-7), Text (WP-F) |

- **Owns (core):** `controllers/combobox.ts` (`useCombobox`, `useMultiCombobox`,
  `useSelectedItemOffset`).
- **Hooks/utilities:** Selector utils subpath, `generatePageRange`.
- **Risks:** select-only combobox APG with active descendant, grouped sections, optional search, async
  loading/empty/error (AST-001) announced once; adaptive bottom sheet; FACE single and multi
  (`FormData` repeated names); MultiSelector select-all; ComplexSelector dialog-popover shell;
  Pagination i18n (16 messages) and page-size/jump controls.
- **Acceptance:** combobox APG table; multi-value submission; selection announced once; Pagination
  keyboard and labels in `de-DE`.

### WP-12 — Typeahead & tokenizer (wave 3; needs WP-4, WP-5, WP-7)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-typeahead` | Typeahead | `typeahead/` | `Typeahead/Typeahead.tsx` | XL | Field (WP-F), Icon (WP-F), InputGroup (WP-7), Popover (WP-4), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-typeahead-item` | TypeaheadItem (sub of Typeahead) | `typeahead/` | `Typeahead/TypeaheadItem.tsx` | S | — |
| `tct-base-typeahead` | BaseTypeahead (sub of Typeahead) | `typeahead/` | `Typeahead/BaseTypeahead.tsx` | XL | Icon (WP-F), Popover (WP-4), Spinner (WP-F) |
| `tct-token` | Token | `token/` | `Token/Token.tsx` | M | Icon (WP-F), Link (WP-2) |
| `tct-tokenizer` | Tokenizer | `tokenizer/` | `Tokenizer/Tokenizer.tsx` | XL | Field (WP-F), Icon (WP-F), OverflowList (WP-5), Spinner (WP-F), Tooltip (WP-F) |

- **Hooks/utilities:** `createStaticSource`, Typeahead utils subpath.
- **Risks:** editable combobox with debounced async sources and cancellation (stale results must never
  win), IME safety, min query length, result counts announced; Token removable/clickable/link;
  Tokenizer inline overflow (OverflowList), Backspace removal, paste splitting, FACE multi-value.
- **Acceptance:** stale-result race test; IME Enter never selects; Tokenizer submits repeated entries.

### WP-13 — Date & time (wave 3; needs WP-3, WP-4, WP-7)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-calendar` | Calendar | `calendar/` | `Calendar/Calendar.tsx` | XL | Button (WP-F), Icon (WP-F) |
| `tct-date-input` | DateInput | `date-input/` | `DateInput/DateInput.tsx` | XL | BottomSheet (WP-4), Button (WP-F), Field (WP-F), Icon (WP-F), IconButton (WP-3), InputGroup (WP-7), Popover (WP-4), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-date-range-input` | DateRangeInput | `date-range-input/` | `DateRangeInput/DateRangeInput.tsx` | L | Field (WP-F), Icon (WP-F), Popover (WP-4), Spinner (WP-F), Tooltip (WP-F) |
| `tct-date-time-input` | DateTimeInput | `date-time-input/` | `DateTimeInput/DateTimeInput.tsx` | XL | BottomSheet (WP-4), Button (WP-F), Field (WP-F), Icon (WP-F), IconButton (WP-3), Popover (WP-4), SegmentedControl (WP-3), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-time-input` | TimeInput | `time-input/` | `TimeInput/TimeInput.tsx` | L | BottomSheet (WP-4), Button (WP-F), Field (WP-F), Icon (WP-F), InputGroup (WP-7), Spinner (WP-F), Tooltip (WP-F), VisuallyHidden (WP-F) |
| `tct-timestamp` | Timestamp | `timestamp/` | `Timestamp/Timestamp.tsx` | M | HoverCard (WP-4), Icon (WP-F), IconButton (WP-3), Text (WP-F) |

- **Owns (core):** `core/src/date/*` — the only module importing `@internationalized/date`; ports
  upstream `plainDate*`, `isSameDay`, `isDateInRange`, `getWeekNumber`, `parseDateInput`, `dateToISO`,
  `parseISO`, `isLocaleDayFirst`, `formatSharedDate`, `DATE_FORMAT_*`; `controllers/grid-focus.ts`
  (`useGridFocus`).
- **Hooks/utilities:** `useCalendarDays`, `useCalendarConstraints`, `useCalendarNavigation`,
  Calendar utils subpath.
- **Risks:** Calendar, DateInput, DateTimeInput and TimeInput share helpers (one package by design);
  segment editing vs text parsing, locale formats, time zones and storage/display separation, APG grid,
  constraints and unavailable dates, range selection, picker presentation (popover / bottom sheet;
  deprecated `nativePicker` mapped), ISO serialisation for FACE.
- **Acceptance:** grid keyboard incl. PageUp/PageDown and RTL; values submit as ISO strings;
  `he-IL`/`ar-SA` rendering; min/max validation with user-invalid timing.

### WP-14 — Navigation frame (wave 3; needs WP-4, WP-8)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-side-nav` | SideNav | `side-nav/` | `SideNav/SideNav.tsx` | XL | AppShell (WP-8), Button (WP-F), Icon (WP-F), MobileNav (WP-8) |
| `tct-side-nav-collapse-button` | SideNavCollapseButton (sub of SideNav) | `side-nav/` | `SideNav/SideNavCollapseButton.tsx` | S | AppShell (WP-8), Button (WP-F), Icon (WP-F) |
| `tct-side-nav-heading` | SideNavHeading (sub of SideNav) | `side-nav/` | `SideNav/SideNavHeading.tsx` | L | Icon (WP-F), Link (WP-2), Popover (WP-4), Tooltip (WP-F) |
| `tct-side-nav-item` | SideNavItem (sub of SideNav) | `side-nav/` | `SideNav/SideNavItem.tsx` | L | AppShell (WP-8), Icon (WP-F), Link (WP-2), Popover (WP-4), Tooltip (WP-F) |
| `tct-side-nav-section` | SideNavSection (sub of SideNav) | `side-nav/` | `SideNav/SideNavSection.tsx` | M | VisuallyHidden (WP-F) |
| `tct-top-nav` | TopNav | `top-nav/` | `TopNav/TopNav.tsx` | L | AppShell (WP-8), Divider (WP-1), MobileNav (WP-8) |
| `tct-top-nav-heading` | TopNavHeading (sub of TopNav) | `top-nav/` | `TopNav/TopNavHeading.tsx` | M | Icon (WP-F), Link (WP-2), Popover (WP-4) |
| `tct-top-nav-item` | TopNavItem (sub of TopNav) | `top-nav/` | `TopNav/TopNavItem.tsx` | S | AppShell (WP-8), Link (WP-2) |
| `tct-top-nav-menu` | TopNavMenu (sub of TopNav) | `top-nav/` | `TopNav/TopNavMenu.tsx` | L | AppShell (WP-8), Icon (WP-F), Link (WP-2), Popover (WP-4) |
| `tct-top-nav-mega-menu` | TopNavMegaMenu (sub of TopNav) | `top-nav/` | `TopNav/TopNavMegaMenu.tsx` | L | Grid (WP-1), Icon (WP-F), Popover (WP-4) |
| `tct-top-nav-mega-menu-item` | TopNavMegaMenuItem (sub of TopNavMegaMenu) | `top-nav/` | `TopNav/TopNavMegaMenuItem.tsx` | S | AppShell (WP-8), Link (WP-2) |
| `tct-top-nav-mega-menu-featured-card` | TopNavMegaMenuFeaturedCard (sub of TopNavMegaMenu) | `top-nav/` | `TopNav/TopNavMegaMenuFeaturedCard.tsx` | S | Link (WP-2) |

- **Hooks/utilities:** `useSideNavCollapse`, `useSideNavRenderMode`, `useTopNavRenderMode`,
  `SideNavRenderContext`, `TopNavRenderContext` (deprecated SideNav collapse props mapped in the
  migration guide).
- **Risks:** render modes shared with AppShell; collapsed SideNav flyouts and names; TopNav menus as
  disclosure navigation (upstream `navigation-destinations` family), mega menus anchored to the nav
  (implicit anchor on the nav element), light-mode top-nav contrast (export values, D-001).
- **Acceptance:** disclosure navigation keyboard; collapsed items named with tooltips; mega menu
  positioning in LTR/RTL; mobile collapse into MobileNav.

### WP-15 — Table (wave 3; needs WP-2, WP-6, WP-7)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-table` | Table | `table/` | `Table/Table.tsx` | XL | ContextMenu (WP-6), EmptyState (WP-2), Icon (WP-F), Text (WP-F) |
| `tct-table-header` | TableHeader (sub of Table) | `table/` | `Table/TableHeader.tsx` | S | — |
| `tct-table-body` | TableBody (sub of Table) | `table/` | `Table/TableBody.tsx` | S | — |
| `tct-table-footer` | TableFooter (sub of Table) | `table/` | `Table/TableFooter.tsx` | S | — |
| `tct-table-row` | TableRow (sub of Table) | `table/` | `Table/TableRow.tsx` | M | — |
| `tct-table-cell` | TableCell (sub of Table) | `table/` | `Table/TableCell.tsx` | S | ContextMenu (WP-6), Icon (WP-F) |
| `tct-table-header-cell` | TableHeaderCell (sub of Table) | `table/` | `Table/TableHeaderCell.tsx` | M | ContextMenu (WP-6), Icon (WP-F) |

- **Plugins (public hooks → table plugin controllers):** `useTableSortable`(+`State`),
  `useTableSelection`(+`State`), `useTablePagination`, `useTableColumnSettings`(+`State`),
  `useTableColumnResize`, `useTableStickyColumns`, `useTableGroupedRows`, `useTableRowIndex`,
  `useTableRowStatus`, `useTableRowExpansion`, `useTableTreeData`, `useTableTreeState`,
  `useBaseTablePlugins`, `TableContext`; utils `paginateData`, `resolveContextActions`, `proportional`,
  `pixel`, `generateColumns`, `resolveColumnWidths`, `DEFAULT_MIN_COLUMN_WIDTH`. (Filtering → WP-18.)
- **Risks:** largest single component (upstream ≈ 22 k lines incl. tests). Light-DOM native table
  rendered from `columns`/`data`; mapping of TableRow/TableCell/… to native elements and renderer outputs
  (A§8.1) recorded as an approved substitution; plugin architecture as controllers; sticky columns and
  resize in RTL; selection with CheckboxInput; row context menus; performance (10 k rows, INP ≤ 200 ms,
  `[mwg:break-up-long-tasks]`); grid keyboard navigation only in interactive modes.
- **Acceptance:** static tables expose native table semantics (no `grid` role); sort state announced;
  10 k-row sort within budget; column resize keyboard operable.

### WP-16 — Chat composer & layout (wave 3; needs WP-2, WP-4, WP-9)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-chat-composer` | ChatComposer | `chat-composer/` | `Chat/ChatComposer.tsx` | L | Badge (WP-2), Button (WP-F), HoverCard (WP-4), Icon (WP-F), Popover (WP-4) |
| `tct-chat-composer-input` | ChatComposerInput (sub of ChatComposer) | `chat-composer/` | `Chat/ChatComposerInput.tsx` | XL | Badge (WP-2), Button (WP-F), HoverCard (WP-4), Popover (WP-4) |
| `tct-chat-composer-drawer` | ChatComposerDrawer (sub of ChatComposer) | `chat-composer/` | `Chat/ChatComposerDrawer.tsx` | M | Badge (WP-2) |
| `tct-chat-composer-token-element` | ChatComposerTokenElement (sub of ChatComposer) | `chat-composer/` | `Chat/ChatComposerInput.tsx` | S | Badge (WP-2), Button (WP-F), HoverCard (WP-4), Popover (WP-4) |
| `tct-chat-send-button` | ChatSendButton (sub of ChatComposer) | `chat-composer/` | `Chat/ChatSendButton.tsx` | S | Button (WP-F), Icon (WP-F) |
| `tct-chat-dictation-button` | ChatDictationButton (sub of ChatComposer) | `chat-composer/` | `Chat/ChatDictationButton.tsx` | M | Button (WP-F), Icon (WP-F) |
| `tct-chat-layout` | ChatLayout | `chat-layout/` | `Chat/ChatLayout.tsx` | L | Button (WP-F), ChatLayoutScrollButton (WP-9), ChatMessage (WP-9), ChatMessageBubble (WP-9), ChatMessageList (WP-9), Icon (WP-F) |

- **Hooks/utilities:** `useChatPasteAsToken`, `useChatComposerTokens`, `useChatLayoutContext`,
  `useChatComposerContext`, `useSpeechRecognition`, `useChatDictation`.
- **Risks:** ChatComposerInput (XL) inline tokens inside an editable surface (decide contenteditable vs
  textarea+overlay; document), IME-safe Enter-to-send, `enterkeyhint="send"`, paste-as-token,
  dictation via Web Speech API (feature-detected), attachments drawer.
- **Acceptance:** IME composition Enter never sends; tokens delete as a unit and are named for screen
  readers; Shift+Enter inserts a newline.

### WP-17 — Rich content & media (wave 4; needs WP-3, WP-5, WP-7, WP-15)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-code-block` | CodeBlock | `code-block/` | `CodeBlock/CodeBlock.tsx` | L | Icon (WP-F), IconButton (WP-3) |
| `tct-syntax-theme` | SyntaxTheme (provider) | `syntax-theme/` | `theme/syntax/SyntaxTheme.tsx` | M | — |
| `tct-markdown` | Markdown | `markdown/` | `Markdown/Markdown.tsx` | XL | Blockquote (WP-1), CheckboxList (WP-7), Citation (WP-2), Link (WP-2), List (WP-5), Table (WP-15) |
| `tct-clickable-card` | ClickableCard | `clickable-card/` | `ClickableCard/ClickableCard.tsx` | M | Card (WP-1), Link (WP-2) |
| `tct-selectable-card` | SelectableCard | `selectable-card/` | `SelectableCard/SelectableCard.tsx` | M | Card (WP-1) |
| `tct-carousel` | Carousel | `carousel/` | `Carousel/Carousel.tsx` | L | Button (WP-F), Icon (WP-F) |
| `tct-thumbnail` | Thumbnail | `thumbnail/` | `Thumbnail/Thumbnail.tsx` | M | Button (WP-F), Icon (WP-F), Skeleton (WP-2), Spinner (WP-F), Tooltip (WP-F) |
| `tct-lightbox` | Lightbox | `lightbox/` | `Lightbox/Lightbox.tsx` | L | Icon (WP-F), IconButton (WP-3), Layout (WP-8) |

- **Owns (core):** `controllers/streaming-text.ts` (`useStreamingText`).
- **Hooks/utilities:** CodeBlock `tokenize`, `tokenizeAsync`, `tokenizeStreaming`, `flatTokensToLines`,
  `SYNC_TOKENIZE_THRESHOLD`, highlight-range helpers, `TOKEN_TYPES`; Markdown `parseMarkdown`,
  `parseMarkdownAst`, `parseMarkdownIncremental`, `createIncrementalState`, `parseInline`,
  `parseInlineAst`, `visitMarkdownNodes`, Markdown plugins/remark subpaths; `useSyntaxTheme`,
  `defineSyntaxTheme`, `syntaxTokenDefaults` and the 12 presets; `useClipboard`, `useImageMode`,
  `useLightbox`. **Granted:** add the Markdown mode to `outline/` (`useOutlineFromMarkdown`,
  `parseOutlineFromMarkdown`) after WP-10 is merged.
- **Risks:** port upstream's in-house parser and tokenizer (no parser/highlighter dependency, D-007);
  incremental streaming parse; no raw HTML, `safeUrl` everywhere; CSS Custom Highlight API ranges in
  chunks; Carousel snap-state sync (commit on `scrollsnapchange` with fallback, earlier project M15/H9),
  end buttons keep focus (H8), autoplay respects reduced motion; ClickableCard with nested actions;
  SelectableCard FACE.
- **Acceptance:** an XSS corpus renders inert; streaming 10 k characters stays interactive;
  carousel announces one slide change per move.

### WP-18 — Command palette & PowerSearch (wave 4; needs WP-5, WP-11, WP-12, WP-13, WP-15)

| Tag | Upstream (kind) | Folder | Upstream path (`packages/core/src/…`) | Cx | Upstream uses (other WP; via context or internal markup unless in "Depends on") |
| --- | --- | --- | --- | --- | --- |
| `tct-command-palette` | CommandPalette | `command-palette/` | `CommandPalette/CommandPalette.tsx` | L | Dialog (WP-F), Icon (WP-F), Kbd (WP-1), Layout (WP-8), Selector (WP-11), Spinner (WP-F) |
| `tct-command-palette-input` | CommandPaletteInput (sub of CommandPalette) | `command-palette/` | `CommandPalette/CommandPaletteInput.tsx` | M | Dialog (WP-F), Icon (WP-F), Spinner (WP-F) |
| `tct-command-palette-list` | CommandPaletteList (sub of CommandPalette) | `command-palette/` | `CommandPalette/CommandPaletteList.tsx` | M | — |
| `tct-command-palette-item` | CommandPaletteItem (sub of CommandPalette) | `command-palette/` | `CommandPalette/CommandPaletteItem.tsx` | S | Dialog (WP-F) |
| `tct-command-palette-group` | CommandPaletteGroup (sub of CommandPalette) | `command-palette/` | `CommandPalette/CommandPaletteGroup.tsx` | S | — |
| `tct-command-palette-empty` | CommandPaletteEmpty (sub of CommandPalette) | `command-palette/` | `CommandPalette/CommandPaletteEmpty.tsx` | S | — |
| `tct-command-palette-footer` | CommandPaletteFooter (sub of CommandPalette) | `command-palette/` | `CommandPalette/CommandPaletteFooter.tsx` | S | Kbd (WP-1) |
| `tct-power-search` | PowerSearch | `power-search/` | `PowerSearch/PowerSearch.tsx` | XL | Avatar (WP-2), Button (WP-F), DateInput (WP-13), DateRangeInput (WP-13), Icon (WP-F), NumberInput (WP-7), Popover (WP-4), Selector (WP-11), Stack (WP-1), TextInput (WP-F), TimeInput (WP-13), Token (WP-12), Tokenizer (WP-12), TreeList (WP-5), Typeahead (WP-12) |
| `tct-power-search-filter-editor` | PowerSearchFilterEditor (sub of PowerSearch) | `power-search/` | `PowerSearch/PowerSearchFilterEditor.tsx` | L | Button (WP-F), DateInput (WP-13), DateRangeInput (WP-13), Icon (WP-F), NumberInput (WP-7), Selector (WP-11), Stack (WP-1), TextInput (WP-F), TimeInput (WP-13), Tokenizer (WP-12), TreeList (WP-5), Typeahead (WP-12) |
| `tct-power-search-token` | PowerSearchToken (sub of PowerSearch) | `power-search/` | `PowerSearch/PowerSearchToken.tsx` | M | Token (WP-12) |

- **Owns (core):** `controllers/hotkeys.ts` (`useHotkeys`).
- **Hooks/utilities:** `useCommandPaletteContext`, `usePowerSearchConfig`, `resolveOperatorLabel`,
  `createPowerSearchConfig`, PowerSearch utils subpath; **Table filtering plugin** `useTableFiltering`,
  `useTableFilterState`, `toSearchFilters` (added to `table/` — granted after WP-15 is merged).
- **Risks:** palette = modal dialog + editable combobox (active descendant), `mod+k` not firing inside
  inputs unless allowed, async sources; PowerSearch (XL) editors reuse Selector, Typeahead, DateInput,
  NumberInput, Tokenizer, TreeList; 50 messages; time zones.
- **Acceptance:** palette opens on `mod+k`, restores focus on close; PowerSearch create/edit/remove a
  filter keyboard-only; Table filters driven by PowerSearch state.

---

## 5. Cross-cutting work packages

### WP-D — Documentation site content (from wave 1, one writer; needs WP-F)

Foundation and guide pages (A§16.4) mapped from the 21 upstream topics with section parity; migration
guide (Astryx React → WC translation table generated from all `parity.json`); tokens page (generated);
browser support page (A§1, full anchored-component list per inventory D11); internationalisation page
(30 catalogs, real file names — D3/D4 fixed); `llms.txt` and JSON/Markdown reference generator from CEM
+ docs; replace Starlight UI overrides with our elements as WP-8/WP-10/WP-11/WP-14/WP-18 land; docs a11y
gates (A§16.5). Acceptance: every upstream topic mapped (route + section table in the page front
matter), `docs:a11y` clean, keyboard smoke passes.

### WP-I — Framework integration (from wave 3; needs WP-F, WP-7)

`apps/integration/{vanilla,react19,vue3,angular,svelte5}` harnesses; in-house generators for JSX
intrinsic-element types and Vue `GlobalComponents` from the CEM; Angular `ControlValueAccessor`
directive generator for FACE controls. Tests: pre-upgrade properties, controlled usage via events,
form submission, React SSR import and hydration with satellites (A§20 item 5), lowercase vs custom
event binding. No new dependencies without approval (framework packages in these apps need owner
approval first — list them in the hand-off).

### WP-H — Hardening (from wave 4)

Visual regression harness (Vitest `toMatchScreenshot`, CI-generated baselines, matrix of styling.md
§14.3); geometry comparison against an upstream-like verification theme with fonts loaded and blocked;
runtime contrast triage (axe `incomplete`); Firefox/WebKit/Tier-2 triage; SSR/DSD spike (needs
`@lit-labs/ssr` approval, A§19.3); Trusted Types CSP run; large-data INP measurements; size-budget
revision; spacing-exceptions review (plan §6); manual AT matrix records.

---

### WP-AI — Agentic AI coding support (D-011; one engineer; from wave 1, needs WP-F)

Full parity with upstream Astryx's agent tooling (`/home/user/refs/astryx/packages/cli`,
`apps/docsite/src/app/mcp/route.ts`, `packages/cli/assets/docs/working-with-ai.doc.mjs`,
`internal/vibe-tests`).

- New private package `packages/cli` (`@tecton-astryx/cli`, bin `tct`). It reads one generated
  **agent registry** (`tools/generate` output: CEM + docs frontmatter `keywords`/`dense`/`related` +
  examples + tokens + docs topics). The docs site and the MCP route read the same registry.
- Commands: `component`, `docs`, `discover`, `search`, `controllers` (upstream `hook`), `doctor`,
  `gap-report`, `layout` (grammar/check/expand, ported to `tct-*` markup), `init --features agents`
  (`--agent claude|cursor|codex`, `--agent-docs-path`), and `upgrade` (stale-block detection + `--apply`).
  All support `--dense` and `--json`, with a stable JSON envelope API (`@tecton-astryx/cli/json`).
- MCP server: `search(query)` + `get(name)`, available as `tct mcp` (stdio) and as a docs-site route.
  Implement in-house JSON-RPC unless the owner approves an SDK.
- `llms.txt`, `llms-full.txt`, JSON/Markdown reference output; the "Working with AI" guide page.
- Tests port the upstream CLI contract tests that apply (exit codes, JSON contract, dense projection,
  init behaviour, upgrade file protection, MCP search/get).
- Grows with the batches: each later work package only adds frontmatter; WP-AI owns no component folders.
- Agent-eval harness (upstream vibe-tests equivalent) is delivered with WP-H.

## 6. Extension packages (after core; separate set)

Tags: lab → `tct-lab-*`; charts, richtext, vega → `tct-*` (A§7.1). Packages `@tecton-astryx/{lab,charts,richtext,vega}`
(private, UNLICENSED), created by the first WP that needs them (the orchestrator adds the package
scaffolding and approved dependencies first). Status in the parity report stays `experimental`
(D-006); not part of the v1 core release gate.

**Dependency blockers (D-007):** upstream lab and charts depend on `d3-array`, `d3-scale`, `d3-shape`
(ISC); richtext on `lexical` + `@lexical/*` (MIT); vega on `vega`/`vega-lite` (BSD-3-Clause) as peers.
None is approved. Default plan: in-house scale/shape utilities for charts (X4–X7), consumer-supplied
Vega runtime injected through a property (`tct-vega-chart`), and a licence-checked approval request for
Lexical before WP-X8 starts.

| WP | Scope | Depends on | Concurrency | Key risks |
| --- | --- | --- | --- | --- |
| WP-X1 | Lab small components | core W3 (Tooltip, Popover, Collapsible, chat) | with X2, X4, X7, X8 | InfoTip touch policy; emoji picker grid roving |
| WP-X2 | Lab composites | core W3/W4 (Selector, Tokenizer, Table, BottomSheet) | with X1, X4, X7, X8 | Tour spotlight in the top layer; TransferList dual listbox keyboard |
| WP-X3 | CodeEditor, Schedule | WP-13, WP-17 | after WP-17 | editable highlighting with IME; schedule grid a11y |
| WP-X4 | Lab Chart (SVG marks) | WP-F; in-house scales | with X1, X2, X7, X8 | replacing d3 scales/shapes; data-viz tokens provisional (D-002) |
| WP-X5 | Lab Chart GL/interaction + Radial | WP-X4 | after X4 | WebGL marks accessibility (data table alternative) |
| WP-X6 | Lab ThreeD + Sankey | WP-X4 | after X4 (with X5) | WebGL; keyboard exploration of 3-D data |
| WP-X7 | charts + vega | WP-F; in-house scales | with X1, X2, X4, X8 | config-model API vs lab JSX model (inventory D17) |
| WP-X8 | richtext | Lexical approval | after approval | Lexical in shadow DOM (selection APIs across roots) |

#### WP-X1

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-lab-info-tip` | InfoTip (lab, component) | `packages/lab/src/InfoTip/InfoTip.tsx` | S |
| `tct-lab-stat` | Stat (lab, component) | `packages/lab/src/Stat/Stat.tsx` | S |
| `tct-lab-circular-progress` | CircularProgress (lab, component) | `packages/lab/src/CircularProgress/CircularProgress.tsx` | S |
| `tct-lab-svg-icon` | SVGIcon (lab, component) | `packages/lab/src/SVGIcon/SVGIcon.tsx` | M |
| `tct-lab-chat-unread-divider` | ChatUnreadDivider (lab, component) | `packages/lab/src/Chat/ChatUnreadDivider.tsx` | S |
| `tct-lab-chat-typing-indicator` | ChatTypingIndicator (lab, component) | `packages/lab/src/Chat/ChatTypingIndicator.tsx` | S |
| `tct-lab-chat-reaction-bar` | ChatReactionBar (lab, component) | `packages/lab/src/Chat/ChatReactionBar.tsx` | M |
| `tct-lab-chat-emoji-picker` | ChatEmojiPicker (lab, component) | `packages/lab/src/Chat/ChatEmojiPicker.tsx` | M |
| `tct-lab-chat-reasoning` | ChatReasoning (lab, component) | `packages/lab/src/ChatReasoning/ChatReasoning.tsx` | M |

#### WP-X2

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-lab-drawer` | Drawer (lab, component) | `packages/lab/src/Drawer/Drawer.tsx` | L |
| `tct-lab-tour` | Tour (lab, component) | `packages/lab/src/Tour/Tour.tsx` | L |
| `tct-lab-tour-step` | TourStep (lab, sub of Tour) | `packages/lab/src/Tour/TourStep.tsx` | M |
| `tct-lab-list-input` | ListInput (lab, component) | `packages/lab/src/ListInput/ListInput.tsx` | L |
| `tct-lab-mobile-tokenizer` | MobileTokenizer (lab, component) | `packages/lab/src/MobileTokenizer/MobileTokenizer.tsx` | L |
| `tct-lab-transfer-list` | TransferList (lab, sub of TransferListSelector) | `packages/lab/src/TransferList/TransferList.tsx` | L |
| `tct-lab-transfer-list-selector` | TransferListSelector (lab, component) | `packages/lab/src/TransferList/TransferListSelector.tsx` | XL |
| `tct-lab-log-stream` | LogStream (lab, component) | `packages/lab/src/LogStream/LogStream.tsx` | L |

#### WP-X3

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-lab-code-editor` | CodeEditor (lab, component) | `packages/lab/src/CodeEditor/CodeEditor.tsx` | XL |
| `tct-lab-schedule` | Schedule (lab, component) | `packages/lab/src/Schedule/Schedule.tsx` | XL |

#### WP-X4

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-lab-chart` | Chart (lab, component) | `packages/lab/src/Chart/Chart.tsx` | XL |
| `tct-lab-chart-axis` | ChartAxis (lab, sub of Chart) | `packages/lab/src/Chart/ChartAxis.tsx` | M |
| `tct-lab-chart-grid` | ChartGrid (lab, sub of Chart) | `packages/lab/src/Chart/ChartGrid.tsx` | M |
| `tct-lab-chart-bar` | ChartBar (lab, sub of Chart) | `packages/lab/src/Chart/ChartBar.tsx` | M |
| `tct-lab-chart-line` | ChartLine (lab, sub of Chart) | `packages/lab/src/Chart/ChartLine.tsx` | M |
| `tct-lab-chart-area` | ChartArea (lab, sub of Chart) | `packages/lab/src/Chart/ChartArea.tsx` | M |
| `tct-lab-chart-error-bar` | ChartErrorBar (lab, sub of Chart) | `packages/lab/src/Chart/ChartErrorBar.tsx` | M |
| `tct-lab-chart-candlestick` | ChartCandlestick (lab, sub of Chart) | `packages/lab/src/Chart/ChartCandlestick.tsx` | M |
| `tct-lab-chart-dot` | ChartDot (lab, sub of Chart) | `packages/lab/src/Chart/ChartDot.tsx` | M |
| `tct-lab-chart-tooltip` | ChartTooltip (lab, sub of Chart) | `packages/lab/src/Chart/ChartTooltip.tsx` | M |
| `tct-lab-chart-legend` | ChartLegend (lab, sub of Chart) | `packages/lab/src/Chart/ChartLegend.tsx` | M |
| `tct-lab-chart-reference-line` | ChartReferenceLine (lab, sub of Chart) | `packages/lab/src/Chart/ChartReferenceLine.tsx` | M |

#### WP-X5

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-lab-chart-dot-gl` | ChartDotGL (lab, sub of Chart) | `packages/lab/src/Chart/ChartDotGL.tsx` | M |
| `tct-lab-chart-dot-gl-interactive` | ChartDotGLInteractive (lab, sub of Chart) | `packages/lab/src/Chart/ChartDotGLInteractive.tsx` | M |
| `tct-lab-chart-heatmap-gl` | ChartHeatmapGL (lab, sub of Chart) | `packages/lab/src/Chart/ChartHeatmapGL.tsx` | M |
| `tct-lab-chart-stream-gl` | ChartStreamGL (lab, sub of Chart) | `packages/lab/src/Chart/ChartStreamGL.tsx` | M |
| `tct-lab-chart-brush` | ChartBrush (lab, sub of Chart) | `packages/lab/src/Chart/ChartBrush.tsx` | M |
| `tct-lab-chart-zoom` | ChartZoom (lab, sub of Chart) | `packages/lab/src/Chart/ChartZoom.tsx` | M |
| `tct-lab-chart-select` | ChartSelect (lab, sub of Chart) | `packages/lab/src/Chart/ChartSelect.tsx` | M |
| `tct-lab-radial-chart` | RadialChart (lab, component) | `packages/lab/src/Radial/RadialChart.tsx` | L |
| `tct-lab-radial-grid` | RadialGrid (lab, sub of RadialChart) | `packages/lab/src/Radial/RadialGrid.tsx` | M |
| `tct-lab-radial-area` | RadialArea (lab, sub of RadialChart) | `packages/lab/src/Radial/RadialArea.tsx` | M |
| `tct-lab-radial-axis` | RadialAxis (lab, sub of RadialChart) | `packages/lab/src/Radial/RadialAxis.tsx` | M |
| `tct-lab-radial-slice` | RadialSlice (lab, sub of RadialChart) | `packages/lab/src/Radial/RadialSlice.tsx` | M |
| `tct-lab-radial-tooltip` | RadialTooltip (lab, sub of RadialChart) | `packages/lab/src/Radial/RadialTooltip.tsx` | M |

#### WP-X6

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-lab-threed-chart` | ThreeDChart (lab, component) | `packages/lab/src/ThreeD/ThreeDChart.tsx` | XL |
| `tct-lab-threed-scatter` | ThreeDScatter (lab, sub of ThreeDChart) | `packages/lab/src/ThreeD/ThreeDScatter.tsx` | M |
| `tct-lab-threed-scatter-gl` | ThreeDScatterGL (lab, sub of ThreeDChart) | `packages/lab/src/ThreeD/ThreeDScatterGL.tsx` | M |
| `tct-lab-threed-bar` | ThreeDBar (lab, sub of ThreeDChart) | `packages/lab/src/ThreeD/ThreeDBar.tsx` | M |
| `tct-lab-threed-grid` | ThreeDGrid (lab, sub of ThreeDChart) | `packages/lab/src/ThreeD/ThreeDGrid.tsx` | M |
| `tct-lab-threed-axis` | ThreeDAxis (lab, sub of ThreeDChart) | `packages/lab/src/ThreeD/ThreeDAxis.tsx` | M |
| `tct-lab-threed-surface` | ThreeDSurface (lab, sub of ThreeDChart) | `packages/lab/src/ThreeD/ThreeDSurface.tsx` | M |
| `tct-lab-sankey-chart` | SankeyChart (lab, component) | `packages/lab/src/Sankey/SankeyChart.tsx` | L |
| `tct-lab-sankey-link` | SankeyLink (lab, sub of SankeyChart) | `packages/lab/src/Sankey/SankeyLink.tsx` | M |
| `tct-lab-sankey-node` | SankeyNode (lab, sub of SankeyChart) | `packages/lab/src/Sankey/SankeyNode.tsx` | M |
| `tct-lab-sankey-label` | SankeyLabel (lab, sub of SankeyChart) | `packages/lab/src/Sankey/SankeyLabel.tsx` | M |
| `tct-lab-sankey-grid` | SankeyGrid (lab, sub of SankeyChart) | `packages/lab/src/Sankey/SankeyGrid.tsx` | M |

#### WP-X7

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-chart` | Chart (charts, component) | `packages/charts/src/Chart.tsx` | XL |
| `tct-chart-axis` | ChartAxis (charts, sub of Chart) | `packages/charts/src/ChartAxis.tsx` | M |
| `tct-chart-grid` | ChartGrid (charts, sub of Chart) | `packages/charts/src/ChartGrid.tsx` | M |
| `tct-chart-legend` | ChartLegend (charts, sub of Chart) | `packages/charts/src/ChartLegend.tsx` | M |
| `tct-chart-swatch` | ChartSwatch (charts, sub of Chart) | `packages/charts/src/ChartSwatch.tsx` | M |
| `tct-chart-tooltip` | ChartTooltip (charts, sub of Chart) | `packages/charts/src/ChartTooltip.tsx` | M |
| `tct-vega-chart` | VegaChart (vega, component) | `packages/vega/src/VegaChart.tsx` | L |

#### WP-X8

| Tag | Upstream (package, kind) | Upstream path | Cx |
| --- | --- | --- | --- |
| `tct-rich-text-view` | RichTextView (richtext, component) | `packages/richtext/src/RichTextView.tsx` | M |
| `tct-rich-text-editor` | RichTextEditor (richtext, component) | `packages/richtext/src/RichTextEditor.tsx` | XL |
| `tct-rich-text-editor-auto-link-plugin` | RichTextEditorAutoLinkPlugin (richtext, sub of RichTextEditor) | `packages/richtext/src/RichTextEditorAutoLinkPlugin.tsx` | M |
| `tct-rich-text-editor-toolbar` | RichTextEditorToolbar (richtext, sub of RichTextEditor) | `packages/richtext/src/RichTextEditorToolbar.tsx` | M |

---

## 7. Coverage check

`pnpm parity` fails if any manifest entry lacks a folder `parity.json` record once its work package is
merged. Counts by package: WP-F 17 · WP-1 16 · WP-2 14 · WP-3 10 · WP-4 8 · WP-5 10 · WP-6 9 · WP-7 12 ·
WP-8 10 · WP-9 8 · WP-10 10 · WP-11 5 · WP-12 5 · WP-13 6 · WP-14 12 · WP-15 7 · WP-16 7 · WP-17 8 ·
WP-18 10 = **184** core. Extensions: X1 9 · X2 8 · X3 2 · X4 12 · X5 13 · X6 12 · X7 7 · X8 4 = **67**.

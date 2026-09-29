# Conventions — implementer's checklist

This is the working contract for everyone who builds a component, controller or docs page.
`docs/ARCHITECTURE.md` is the binding design (it wins on conflict); this file tells you **what to do,
in what order, and what "done" means**. Section references like "A§9.7" point into ARCHITECTURE.md.

---

## 1. Before you write code

1. Read `AGENTS.md`, then A§0 (decision register), A§3 (parallel-safety), A§4 (folder anatomy),
   A§6 (styling), A§7 (API contract), A§8 (DOM strategy) and the A§9 sections for the controllers your
   component uses. Read your work package in `docs/plan/WORK-BREAKDOWN.md`.
2. Work only in your worktree/branch. Touch only your component folders and the new files your work
   package explicitly assigns to you (A§3). Never add a dependency (D-007).
3. **modern-web-guidance is mandatory** for every HTML/CSS/client-side JS decision:

   ```sh
   npx -y modern-web-guidance@latest search "<what you want to do>" --skill-version 2026_09_04-7de96777
   npx -y modern-web-guidance@latest retrieve "<id>[,<id>...]" > /tmp/<name>.md   # then read the file
   npx -y modern-web-guidance@latest list
   ```

   Search before implementing each behaviour (e.g. "dismiss a dialog with the back gesture",
   "error message announcement", "roving focus toolbar"); retrieve the guide; check your code against
   it before you hand off; cite the guide ids in the component's `parity.json` `differences`/notes or
   in code comments where the guide drove a non-obvious choice. Browser policy: A§1.

---

## 2. How to port an Astryx component (step by step)

### Step 1 — Read upstream (behavioural source of truth)

In `/home/user/refs/astryx/packages/core/src/<Name>/` (read-only):

- `<Name>.tsx` and same-folder helpers: props type, defaults, rendered elements, roles, `aria-*`,
  key handlers, state machine, async actions, context use, theming targets (`themeProps`), i18n ids.
- `<Name>.doc.mjs`: documented props, `theming.targets` / `theming.vars`, best practices,
  accessibility table, examples.
- `<Name>.spec.md` (if present) and the specs it references in `/home/user/refs/astryx/docs/specs/AST-*/`.
- `*.test.tsx`: every test name is a behaviour to reproduce; port them as test cases.
- Stories: `/home/user/refs/astryx/apps/storybook/stories/<Name>.stories.tsx` for composition examples.
- `docs/research/astryx-parity-manifest.json` entry (`props`, `events`, `slots`, `variants`,
  `states`, `keyboard`, `aria`, `dependsOn`, `themingTargets`, `notes`) and the inventory section.
- Tecton overrides: `docs/research/tecton-theme.md` §5 (radii), §7 (per-component overrides) and the
  owner's React theme `/home/user/rpkapps/tecton-astryx/packages/react/src/theme/components.ts`.

### Step 2 — Retrieve the guides

Search/retrieve modern-web-guidance for the pattern (dialog, popover, combobox, form control, tabs …).
Also read the APG pattern named in plan §7 for the family.

### Step 3 — Map the API (write `parity.json` first)

- Create the folder skeleton (A§4) and `parity.json` with `status: "in-progress"`.
- For **every** upstream prop, callback, slot/content prop, ref and hook of the entry, add one `api`
  row using the mapping rules in A§7.2. Nothing may be silently dropped: unmappable rows are
  `"as": "waived"` with a reason (the parity check fails otherwise).
- Decide: DOM strategy from the A§8.1 table (do not invent a new one), semantics placement, focus
  model, form association, events (reuse classes from `packages/core/src/events/`), parts (one per
  theming target), states, admitted custom properties, i18n message ids.
- Write the `keyboard` table (keys, action, condition) from upstream handlers + APG.
- Record differences (`approved-api-difference`, `a11y-improvement`, `tecton-visual`, `waiver`).

### Step 4 — Implement

- Class files, styles, `define.ts` exactly as in A§4.1. Use the core controllers; do not re-implement
  roving focus, typeahead, layering, positioning, form association, announcements, ids or locale.
- Styles: tokens only; variants set private properties; paint on inner parts; states in `@layer state`;
  forced colours in `@layer a11y`; logical properties (A§6).
- Strings through `LocaleController` with upstream message ids; attribute overrides for labels.
- Every public member gets JSDoc (A§4.1 tags). Undocumented = missing.

### Step 5 — Test

Write tests for every category in A§15.4 using the standard suites. Port upstream test cases.
Run `pnpm test packages/components/src/<folder>` until green in Chromium.

### Step 6 — Document

Write `<folder>.docs.md` (§7 below) and `examples/*.html` (one per variant group / state group /
composition from upstream docs and stories). Run `pnpm docs:dev` and look at the page.

### Step 7 — Verify and hand off

Run `pnpm api:update` (commit the snapshot), `pnpm check`. Set `status: "implemented"` in
`parity.json` (only the orchestrator sets `verified`). Write the hand-off report (§10).

---

## 3. Definition of Done (per component entry)

A component is done only when **every** box holds:

- [ ] **API mapping**: `parity.json.api` covers every upstream prop/callback/slot/ref (mapped or waived
      with reason); `pnpm parity:check` passes.
- [ ] **Anatomy & variants**: every variant, size, density, state and documented composition upstream
      supports renders and is covered by an example and a test.
- [ ] **Behaviour**: upstream state transitions, async actions (`*Action` props: busy state, dedupe),
      controlled and uncontrolled use (D-006) work.
- [ ] **Keyboard**: every row of the keyboard table works, incl. RTL, Home/End, typeahead, Escape (one
      layer per press) and Tab leaving composites.
- [ ] **Accessibility**: axe clean in every state; role/name/state verified with `axNode`; no ID
      relationship crosses a root; announcements through the Announcer only; focus never lost; 24×24
      targets.
- [ ] **Form** (value controls, buttons): `runFormControlSuite` passes (value, FormData, reset,
      fieldset disabled, restore, required/invalid, user-invalid timing, validation anchor, implicit
      submission, submitter, `form=` association, label activation, read-only).
- [ ] **Events**: names per A§7.6; flags documented; exact counts; none on programmatic writes; intent
      events cancelable and honoured.
- [ ] **Styling**: tokens only (stylelint clean); parts = theming targets; states documented;
      admitted custom properties only; forced-colours and reduced-motion handled; RTL via logical CSS.
- [ ] **i18n**: strings from catalogs; `de-DE` and `ar-SA` tests; overrides via attributes.
- [ ] **Docs**: `<folder>.docs.md` has every authored section (§7); examples cover variants, states,
      composition; the generated page builds without warnings.
- [ ] **Metadata**: JSDoc complete; CEM shows all attributes, properties, methods, slots, events, parts,
      states, custom properties; `__snapshots__/api.json` updated.
- [ ] **Size**: within budget (`pnpm size`).
- [ ] **parity.json**: `status: implemented`, `tests` flags true for each category that applies,
      `provisional`, `tokenRequests` and `requests` filled.
- [ ] `pnpm check` passes on your branch rebased onto `main`.

---

## 4. Code style

### TypeScript

- TS 6, `strict`, legacy decorators (`@property`, `@state`, `@query`), `useDefineForClassFields: false`,
  no `accessor` keyword.
- Relative imports end in `.js`; cross-package imports use package subpaths
  (`@tecton-astryx/core/controllers/layer.js`), never `../../../core/src`.
- One element class per file, named `Tct<Name>`, file `tct-<name>.ts`; `declare global` tag map at the
  bottom; `static override readonly tagName`; `static override readonly dependencies` for tags
  rendered in the shadow root; `static override styles: CSSResultGroup = [...]` typed explicitly.
- Member order: statics → public reactive properties (attributes first, then property-only) → public
  getters → public methods → protected hooks → private `#fields`/controllers → lifecycle → `render()`
  → private render helpers → event handlers (`#onKeyDown = (e: KeyboardEvent) => {…}`).
- Private state uses `#fields`; `@state()` only for reactive internal state; `_underscore` only when a
  subclass in the same package must reach it (and mark `@internal`).
- Enumerations: `export const BUTTON_VARIANTS = ['primary', …] as const; export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];` in `<folder>.types.ts`.
- No `any` in public signatures; no non-null assertions on DOM queries in lifecycle code that can run
  before render (guard instead).
- No DOM access in constructors or `render()`; DOM work in `firstUpdated`/`updated`/controllers.
- Feature checks only via `features` (A§9.5); direct imports of boundary dependencies are forbidden
  (A§18.1).
- Comments explain **why** (platform traps, upstream parity, guide ids), not what.

### Lit templates

- Bind attributes individually (Lit ignores a string in element position).
- `?attr=${bool}`, `.prop=${value}` for properties, `@event=${handler}` with stable handler
  references (`#onX = () => …`).
- `nothing` instead of empty strings for absent attributes; `live()` for input `value`/`checked`.
- `repeat()` with keys for collections that reorder.
- Never `unsafeHTML`/`unsafeSVG`; icons via `tct-icon` or core icon templates.

### JSDoc (read by the CEM analyzer)

Prose first, then `@summary`, `@tag`, `@upstream`, `@slot`, `@csspart`, `@cssprop`, `@cssstate`,
`@fires`, `@cloakDisplay`, `@cloakMinBlockSize`; property descriptions on each property; `@internal`
for anything not public; `@hideInherited a, b - reason` for inherited API a subclass ignores.

---

## 5. CSS style

- File `tct-<name>.styles.css`; four layers only (`reset`, `component`, `state`, `a11y`), everything
  inside a layer.
- Private aliases once at the top of the inner element rule:
  `--_bg: var(--button-background-color, var(--color-neutral));`.
- Variant/size rules set private properties only. State rules (`hover`, `active`, `disabled`, `loading`,
  `invalid`) live in `@layer state`.
- No colour literals, no px font sizes, no palette variables, no `:host-context`, no box styles on
  `:host`, logical properties only, hover inside `@media (hover: hover)`, motion inside
  `@media (prefers-reduced-motion: no-preference)`.
- Never `display` on a closed `[popover]`; style `:popover-open`.
- Placement-dependent styles read `[data-placement]` written by `PositionController`.
- Button/ToggleButton never set a `border-radius` shorthand (per-corner logical radii; ButtonGroup
  squares interior corners through `--_button-*-radius`).

---

## 6. Tests

- One `tct-<name>.test.ts` per element (split by topic if long: `.keyboard.test.ts`, `.form.test.ts`).
- Always start with `runElementSuite`; add `runFormControlSuite` / `runOverlaySuite` /
  `runKeyboardSuite` as applicable (A§15.3).
- Use `fixture()`, `userEvent` from `vitest/browser` (real input), `recordEvents` with exact counts,
  `axNode` for role/name/state, `expectAccessible` in every state.
- Test through the public API only (attributes, properties, events, keyboard, pointer); never reach
  into `#private` state; shadow-root queries only to locate parts for assertions.
- The browser test viewport is narrow; position explicitly when layout matters; await
  `animationsFinished()` before measuring overlays or running axe on them.
- Test names describe behaviour ("Escape closes the tooltip before the dialog").
- Port upstream test names as `it()` titles where the behaviour applies.

---

## 7. Documentation (`<folder>.docs.md` and examples)

### Frontmatter

```yaml
---
title: Button                       # display name (upstream displayName)
folder: button
category: Action                    # one of the 11 upstream categories
entries: [Button]                   # upstream names documented on this page (incl. subcomponents)
summary: Triggers an action when activated.
examples: [variants, sizes, icons, loading, disabled-with-reason, in-form]   # order on the page
---
```

### Required authored sections (H2, in this order; the generator fails when one is missing)

`## Purpose` · `## When to use` · `## Alternatives` · `## Anatomy` · `## Variants and states` ·
`## Responsive behaviour` · `## Form semantics` · `## Screen-reader expectations` · `## Localisation` ·
`## Consumer responsibilities`. Write "Not applicable." (with one sentence why) rather than omitting.
Sections for installation, API tables, events, styling hooks, tokens, keyboard, differences and the
upstream mapping are generated (A§16.3). Adapt upstream guidance to Web Components (attributes, slots,
events), keep upstream terminology, explain renamed APIs, never paste React snippets.

### Examples

- `examples/<id>.html`, first line `<!-- title: …; description: … -->`, HTML fragment only, one
  optional `<script type="module">` scoped to a root element whose `id` starts with the example id.
- Layout inside examples uses our layout elements once they exist; before that, plain inline
  `style="display:flex; gap: var(--spacing-2)"` (tokens only).
- Cover: every variant group, sizes, states (disabled, loading, invalid, read-only), RTL, long/localized
  labels, and the upstream doc/story compositions.

---

## 8. `parity.json` guide

Schema: `tools/schemas/parity.schema.json` (A§4.1). Rules:

- One `entries` key per upstream manifest id (`core.<kebab>`), including subcomponents in the folder.
- `api[].as` ∈ `attribute`, `property`, `slot`, `native-event`, `event`, `method`, `context`,
  `controller`, `module-function`, `css`, `waived`. `target` names the WC API.
- `hooks[]` for upstream hooks/contexts/utilities your work package owns (WORK-BREAKDOWN lists them).
- `status` ∈ `not-started`, `in-progress`, `implemented` (you), `verified` (orchestrator only).
- `tokenRequests[]`: `{name, reason, light?, dark?}` for semantic tokens you need; use a private
  `--_x` with a documented token fallback until the orchestrator integrates it.
- `requests[]`: any change you need in a shared file (A§3), with the exact diff you propose.
- `provisional[]`: values you used from D-002 provisional tokens.

---

## 9. Platform traps (each is a rule; most are regression tests)

| Trap | Rule |
| --- | --- |
| Inner `<input>` in a shadow root has no form owner; Enter never submits | FACE + `submitImplicitly` (A§9.7) |
| `showModal()` inerts toasts/live regions | layer stack moves them into the top modal (A§9.9) |
| Required group with no validation anchor can't be focused on submit | always supply `validationAnchor` |
| Error re-announced on every keystroke | freeze message while focused; Announcer, polite, once |
| Focused control becomes `disabled` → focus drops to body | `aria-disabled` + guard, or move focus first |
| Moving an open overlay closes it | `connectedMoveCallback`; re-show on reconnect |
| `:state()`/Popover used without detection | `toggleState` + `features` guards |
| Exit animation via `overlay` property | WAAPI then close |
| Android back doesn't close popovers | `CloseWatcher` via layer stack |
| IME Enter/Escape treated as a command | `isImeKeyEvent` first in every handler |
| `form.checkValidity()` marks fields interacted | only submission/`reportValidity()` flips user-invalid |
| `tabindex="-1"` on a shadow host hides its slotted content from Tab | roving `focusTarget` |
| Hosts never match `:focus-visible` with `delegatesFocus` | ring on the inner element |
| Box styles on `:host` erased by app resets | paint on inner parts |
| `align` attribute becomes `text-align` in Chrome | use `alignment` |
| `change` is not composed | `redispatchChange()` once; never re-dispatch `input`/focus events |
| Whitespace fills the default slot | `SlotController` ignores whitespace |
| `anchor-name` is tree-scoped | implicit anchors via `showPopover({source})` |
| `@font-face`/`@property` ignored in shadow roots | document-level only (tokens) |
| Public `on*` properties hijacked by React 19 | never name a property `on…` |

---

## 10. Hand-off report (paste into your final message)

```text
WP-<id> <title> — hand-off
Branch: <branch>   Base: <main sha>   pnpm check: PASS (chromium)
Entries: <n implemented>/<n assigned>   (list any not done and why)
Core files added: <paths>
Differences recorded: <ids>   Waivers: <ids>   Provisional values used: <list>
Token requests: <list>        Shared-file requests: <list>
Guides consulted: <mwg ids>
Known risks / follow-ups: <list>
```

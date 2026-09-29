# What makes a production-grade Web Component library in 2026, and what we should adopt

_Research input for ARC-001 (element/API, Shadow DOM, form, overlay/focus and browser-support
decisions). Researched 2026-09-28/29. Scope: everything except the visual/theming system, which is
covered in `docs/research/styling.md`. Styling appears here only where it forms part of the public
API contract._

**Method.** Three kinds of evidence:

1. **modern-web-guidance** (skill version `2026_09_04-7de96777`). Guides are cited by id in
   brackets, e.g. `[mwg:form-associated-custom-elements]`.
2. **Mature libraries and ecosystem sources**: published npm packages inspected directly (Web
   Awesome 3.14.0 `dist/`), the Spectrum Web Components (SWC) contributor docs, the WICG
   proposals, Lit docs (Context7), and web search. Several documentation hosts (MDN,
   developer.chrome.com, web-features explorer, lit.dev) are blocked by this environment's proxy,
   so browser data comes from the **`web-features` 3.40.0 npm package (published 2026-09-28)**. That
   package is the data source behind Baseline and behind the guides' own support notes.
3. **The owner's earlier attempt**, `rpkapps/tecton-webcomponents`: `docs/RESEARCH.md`,
   `docs/CONVENTIONS.md`, `docs/REVIEW-modern-web-guidance.md` and `packages/wc/src/internal/`.

Browser policy assumed (from the brief/skill): Baseline **Widely available** needs no fallback.
**Newly available** or non-Baseline features must follow the guide's fallback or be
feature-detected and degrade gracefully.

---

## 1. Executive summary

A good Web Component library in 2026 is defined less by its rendering library than by **how
faithfully its elements behave like built-in HTML elements**:

- they can be used from markup, script and every framework;
- they submit, reset and validate inside a `<form>`;
- they take part in the accessibility tree across shadow boundaries;
- they layer in the top layer instead of fighting over z-index;
- they fire the events native elements would fire, once, and only for user action;
- they are described by machine-readable metadata that drives the docs, types and wrappers.

The mature libraries have converged on the same answers. Most of their public regrets come from
not doing one of the things above early enough:

- Shoelace used `formdata` events instead of ElementInternals, and `sl-change` fired on
  programmatic changes.
- SWC's 1st gen used an inheritance-heavy focus model.
- Material Web depended on a single corporate team and is now in maintenance mode.

Our position:

- **Lit 3 + TypeScript on standard custom elements is still the right base.** Every major library
  surveyed that isn't Stencil- or FAST-based uses Lit. Lit is at 3.3.3; there is no Lit 4.
- **Split behaviour from rendering.** Use a headless *core* of controllers and abstract base
  classes, with concrete styled elements on top. This is the Spectrum gen2 model.
- **Make the platform do the work:**
  - form-associated custom elements (FACE) for every value-bearing control;
  - `ElementInternals` for default semantics and custom states;
  - `<dialog>`/`popover` for layering;
  - element-reference ARIA for cross-root relationships.
- **Positioning:** CSS anchor positioning, anchored implicitly via `showPopover({source})`, as the
  primary strategy, with a measured Floating UI fallback.
- **Registration:** unregistered class exports plus explicit, idempotent `define` entry points.
  This keeps scoped registries and multi-version pages possible.
- **Shadow DOM is decided per component, not globally.**
- **The Custom Elements Manifest is the single API source** for docs tables, JSX/Vue types,
  optional React wrappers and agent-readable docs.
- **Carry forward the earlier project's hard-won internals.** Its code review (§3) found real bugs;
  most of them are platform traps any new library will hit again unless the traps are designed in
  as test cases from the start.

---

## 2. What the mature libraries teach

| Library (npm version, 2026-09) | Base | What it got right | What it regrets / re-architected |
| --- | --- | --- | --- |
| **Web Awesome** 3.14.0 (Shoelace successor; Shoelace 2.20.1 sunset) | Lit | FACE form controls, including an implicit-submission shim (`submitOnEnter`: single field → `form.requestSubmit()`, otherwise the default submit button). Native `input`/`change` events; `wa-` events only for non-native concepts. One typed `Event` subclass per event name, shipped in `dist/events/*`, augmenting `GlobalEventHandlersEventMap`. `:state()` states and parts documented per component. Per-component modules plus an autoloader (MutationObserver → dynamic `import()` of `components/<name>/<name>.js`). `llms.txt` and Agent Skills shipped inside the npm package. Optional Lit SSR (`webawesome.ssr-loader.js`, `@lit-labs/ssr`). | Shoelace's `formdata`-event forms and inconsistent `sl-change` (fired on programmatic changes) were replaced wholesale. SSR required API concessions: `with-start`/`with-end` attributes exist "only for SSR" because the server can't see slotted content. The autoloader only watches the document, not shadow roots. |
| **Spectrum Web Components** 1.12 (1st gen) → `@adobe/spectrum-wc` 2.0.0-beta.3 (gen2) | Lit | gen2 **Core** holds abstract non-rendering base classes, controllers and mixins that define the API and behaviour. **SWC** holds concrete rendering classes that add styles, templates and registration. Focus is handled by three opt-in primitives (`delegatesFocus`, `DisabledMixin`, `FocusgroupNavigationController`, aligned to Open UI `focusgroup`). 1st gen and gen2 can run side by side on one page. Style guides are written "for humans and AI agents". | gen2 exists to escape 1st-gen structural debt: a separate Spectrum CSS project, custom tool chains, and a `Focusable` inheritance chain. Disruptive changes are channelled into a new generation rather than dripped into minors. Caution: its focus guide re-dispatches `focus`/`blur` from the host. Native focus events are already composed and retarget to the host, so this risks duplicate events. Don't copy it. |
| **Material Web** 2.5.0 | Lit | Early ElementInternals form controls; focus-ring and ripple primitives. | **Maintenance mode** since 2024: the team was reassigned and the roadmap abandoned. The lesson is about ownership and scope, not technology. A design-system WC library needs a funded owner and a scope it can finish. |
| **Carbon Web Components** 2.64.0 | Lit | Lives in the Carbon monorepo next to `@carbon/react`, kept in sync. `cds-` prefix. Generated React wrappers. Ships a second build, `es-custom/`, with the prefix rewritten to `cds-custom-` for collision-prone hosts. | Moving the WC repo into the main monorepo was itself a fix for drift between the React and WC implementations. This is directly relevant to an "Astryx-compatible" port. |
| **Lion** (ING) 0.21.1 | Lit | White-label, behaviour-first. `ScopedElementsMixin` (`@open-wc/scoped-elements`) so internal sub-elements use the right version. | Explicit lessons: "not everything has to be a Web Component" and "not everything needs to be in the shadow DOM, especially for ARIA relations". Form controls keep their native inputs in the light DOM. |
| **FAST / Fluent UI WC** (`@microsoft/fast-element` 3.0.3, `@fluentui/web-components` 3.1.3) | FAST | fast-element 3 adds declarative `<f-template>` templates with opt-in hydration of prerendered DOM (`enableHydration()`). | Fluent WC v3 had a long beta, and the FAST community is small. The SSR story arrived only in a new major. |
| **Ionic** (`@ionic/core` 9.0.5, Stencil 4.45) | Stencil | Lazy-loading and framework output targets built into the compiler. | Source is locked into a compiler and a JSX/VDOM model. With React 19 and CEM-generated types, the output-target advantage has shrunk. |
| **Vaadin** 25.3 | Lit (ex-Polymer) | Field components slot a **native `<input slot="input">` into the light DOM**. This was adopted in v22 because autofill, password managers and label/ARIA relations failed with the input in shadow DOM. | The whole field family was re-architected after years of shadow-DOM input problems. |
| **Open UI** (not a library) | — | Upstreams patterns so libraries can delete code: customizable `<select>`, `popover`, invokers, `interestfor`, `focusgroup`. | Most of these are still not Baseline (§4). Design our APIs to *align* with them, not to *depend* on them. |

**Cross-cutting conclusions**

1. **Form participation and event semantics are where libraries break compatibility.**
   Shoelace → Web Awesome broke both. Get them right in v1.
2. **Behaviour/rendering separation pays off** when a design system is re-skinned or ported, as
   we are doing with Astryx → Tecton. SWC gen2 formalises it.
3. **Light DOM is a legitimate, deliberate choice** for autofill-critical inputs, ARIA-heavy
   relationships, tables and rich content (Vaadin, Lion). It is not a failure of encapsulation.
4. **Metadata is a product.** Web Awesome ships `custom-elements.json`, JSX types, VS Code/
   JetBrains data, `llms.txt` and Agent Skills from one source.
5. **SSR is optional and costly.** Only Web Awesome (via Lit labs SSR) and FAST 3 offer it, and
   both needed API concessions or a new major.

---

## 3. Lessons from the owner's earlier attempt (`tecton-webcomponents`)

That project was a full Lit library (~80 components, `tec-` prefix) with an Astro docs site and a
thorough guidance review. Its conclusions largely match the industry, and its internals are
valuable. What to **keep**, **fix** and **change**:

### Keep (proven in that codebase)

- **`defineElement(tag, ctor, registry = customElements)`**: idempotent; warns once when a
  *different* class owns the tag. Registration lives only in `define.ts`, and class modules are
  side-effect free.
- **Base element** with `emit()` (bubbles + composed by default, returns `!defaultPrevented`),
  lazily attached `internals`, and `toggleState()`.
- **`FormControlMixin`**:
  - native `value`-attribute-is-default semantics;
  - validity mirrored from an inner native control;
  - reset/restore/disabled callbacks;
  - `:state(user-invalid)` timing;
  - `validators` for controls with no inner native control;
  - `redispatchChange`, because native `change` is not composed;
  - the "control observer" protocol for field wrappers.
- **`AriaDelegateController`**: host `aria-*` is mirrored to the inner control, and IDREF
  attributes are resolved in the host's scope and set as element references.
- **`PopupController` / `DismissController`**: a shared layer stack; Escape closes only the
  top-most layer; composed-path-aware outside press; focus restore.
- **`RovingFocusController`, `ListNavigationController`, `Typeahead`**: including the
  documented trap that `tabindex="-1"` on a shadow host removes its slotted content from sequential
  focus navigation.
- **Test utilities**: `axNode`/`axTree` read Chrome's computed accessibility tree over CDP,
  `expectAccessible` (axe), `recordEvents`, and `animationsFinished`.
- **Conventions that saved bugs:**
  - no box styles on `:host` (app resets beat `:host`);
  - never reflect `align`/`width`/`height`/`valign`/`nowrap` (legacy presentational hints);
  - hosts never match `:focus-visible`, so use `:host(:state(focus-visible))`;
  - never set `display` on a closed `[popover]`.

### Fix: failures that review found, which must become day-one test cases

| Finding in the old review | Root cause (platform trap) | Rule for the new library | Guide |
| --- | --- | --- | --- |
| H1: Enter never submits the form | An inner `<input>` in a shadow root has no form owner. A custom `type=submit` host is not a native submitter. | Form-control core implements implicit submission. Submit-button host implements submitter semantics (`requestSubmit(nativeSubmitter)` or `click()` of the default button). Test both directions. | `forms`, `ime-safe-enter-submit` |
| H2: toasts inert under a modal | `showModal()` inerts everything outside the dialog, top layer or not. | The overlay manager moves the announcer/toaster into the top-most modal while one is open (`moveBefore` when available). Announce via `ariaNotify` where supported. | `persistent-top-layer-ui`, `accessibility` §8 |
| H6: required radio group can't be focused on blocked submit | `setValidity(flags, msg, anchor)` needs a focusable anchor. | Every FACE supplies a validation anchor (the active/first enabled item). | `form-associated-custom-elements` |
| H7: errors re-announced on every keystroke | `role=alert` bound to a live `validationMessage`. | Freeze the shown message while focused. Polite announcement on first appearance only. Sync `aria-invalid` with the visual user-invalid moment. | `accessible-error-announcement`, `validate-input-after-interaction` |
| H8: focus dropped to `<body>` | A focused control became `disabled`. | Use `aria-disabled` + activation guard for transiently unavailable controls, or move focus first. | `accessibility` §5 |
| M1: moving an open overlay breaks it | Removal/re-insertion resets top-layer state. | Implement `connectedMoveCallback` (enhancement). On reconnect, re-`showModal()`/`showPopover()` if `open` but not `:modal`/`:popover-open`. | `persistent-top-layer-ui`, `move-dom-element-without-losing-state` |
| M2/M7: Popover and `:state()` used without detection | Both are only Newly available. | Feature-detect (or declare the support floor, §4). Guard `internals.states`. | `declarative-dialog-popover-control`, `custom-elements` |
| M3: exit animation relies on `overlay` | `overlay` is Chromium-only. | Animate out with WAAPI, then close/hide. | `animate-to-from-top-layer` |
| M4: Android back doesn't close menus | Only `keydown` Escape was handled. | Use `CloseWatcher` when available, routed to the same dismiss reason. | `platform-controls-dismiss-dialog` |
| M5: IME Enter picks an option | Missing the Safari `keyCode === 229` check. | One shared `isComposingEnter(e)` helper used by every Enter handler. | `ime-safe-enter-submit` |
| M6: `form.checkValidity()` marked every field "interacted" | The `invalid` event was treated as a submit attempt. | Only a real submission or `reportValidity()` flips user-invalid. | `validate-input-after-interaction` |

### Change: decisions that don't transfer to this project

- **"Shadow DOM always"** (old CONVENTIONS §3) becomes a per-component decision (plan §5 and
  §10 below). Astryx has Table, Markdown, Code, Chat and layout primitives where light DOM is
  better.
- **Floating UI as the only positioner** becomes CSS anchor positioning first, Floating UI as
  fallback. Core anchor positioning is now in all three engines (§4), and upstream Astryx already
  positions layers with `popover` + CSS anchor positioning (`packages/core/src/Layer/useLayer.tsx`).
- **Prefix.** Don't reuse `tec-`. The two Tecton libraries could plausibly meet on one page, and
  a different prefix (plan: `tct-`) avoids a guaranteed tag collision with the earlier library.
- **Event typing.** The old library avoided `HTMLElementEventMap` augmentation because
  per-component declarations clashed. Adopt Web Awesome's fix: **one event class per library-unique
  event name**, declared once.
- **Tailwind preset / shadcn vocabulary.** That was specific to the old component set. The API
  vocabulary now comes from Astryx (plan §5).

---

## 4. Browser-support facts that shape the architecture

Source: `web-features` 3.40.0 (2026-09-28); guide fallback notes in brackets. "Newly" = Baseline
newly available; "Widely" = Baseline widely available; "Limited" = not Baseline.

| Feature | Status | Engines | Architectural consequence |
| --- | --- | --- | --- |
| Autonomous custom elements, Shadow DOM, `<slot>`, `delegatesFocus` | Widely | all | Base. |
| Constructed stylesheets (`adoptedStyleSheets`) | Widely (2023) | all | Lit's shared `css` sheets. |
| Declarative Shadow DOM | Widely (Aug 2026) | all | SSR is possible without polyfill `[mwg:prerendering-custom-elements]`. |
| Form-associated custom elements, `ElementInternals.labels` | Widely (2023) | all | Every value control is a FACE `[mwg:form-associated-custom-elements]`. |
| ARIA *attribute* reflection, `ElementInternals.role`/`aria*` strings | Widely (2023) | all | Default semantics via internals `[mwg:accessible-web-components]`. |
| ARIA *element* reflection (`ariaLabelledByElements`, `ariaActiveDescendantElement`, also on internals) | Newly (2025; Chrome 135 last) | all | Cross-root references (shadow → outer scope only). Needs detection + `aria-label` fallback. The guide still says "verify before relying". |
| `:state()` / `ElementInternals.states` | Newly (May 2024; Widely ≈ Nov 2026) | all | Public state styling hook. Guard access. |
| `:user-valid` / `:user-invalid` | Widely (May 2026) | all | Native inputs only. Not reliably wired for FACE, so expose `:state(user-invalid)` `[mwg:form-associated-custom-elements]`. |
| `:dir()` | Widely (Jun 2026) | all | Direction-aware styling across roots. |
| `<dialog>`, `inert` | Widely | all | Modals, sheets, drawers. |
| `dialog.requestClose()` | Newly (May 2025) | all | Cancelable programmatic close through `cancel`. |
| `<dialog closedby>` | Limited | Chrome 134, Firefox 141; **no Safari** | Light-dismiss needs a JS fallback `[mwg:light-dismiss-a-dialog]`. |
| Popover API; `showPopover({source})` | Newly (Jan 2025); `source` Chrome 137 / Firefox 144 / Safari 26 | all | Top layer for every floating surface. Guide says conditionally polyfill (`@oddbird/popover-polyfill`) or declare a floor. |
| `popover="hint"` | Limited | Chrome 151, Firefox 153; **no Safari** | Tooltip coordination stays in our layer manager. |
| Invoker commands (`command`/`commandfor`) | Newly (Dec 2025) | all | Support custom `--show`/`--hide`/`--toggle` commands on overlay hosts `[mwg:custom-button-actions]`. ID references only work in one tree. |
| Interest invokers (`interestfor`) | Limited | Chrome 142 only | Don't depend on it. Own hover/focus delay logic `[mwg:interest-triggered-tooltips]`. |
| CSS anchor positioning, core (`anchor-name`, `anchor()`, `position-area`, `position-try-fallbacks`) | Core keys in all engines: Chrome 125–129, **Firefox 147**, Safari 26. **Aggregate feature Limited** (only `position-visibility: anchors-valid/-visible` is Safari 27-only). | all (core) | Primary positioner, feature-detected, with a Floating UI fallback. Guides treat it as non-Baseline and mandate a fallback. |
| Implicit anchor from `showPopover({source})` / `commandfor` | Chrome 137, Firefox 147, Safari 26 | all | **Solves anchor-name tree-scoping across shadow roots**: anchor by element reference, not by name. |
| Anchor-position container queries (`container-type: anchored`) | Limited | Chrome 143 only | Arrow-flip styling as an enhancement `[mwg:position-aware-tooltips]`. |
| Customizable `<select>` (`appearance: base-select`) | Limited | Chrome 135, Safari 27; **no Firefox** | Only as an enhancement of a *native* select. Astryx Selector stays a custom combobox `[mwg:branded-select-styling]`. |
| Scoped custom element registries | Limited | Chrome 146, Safari 26; Firefox Nightly only (Interop 2026 focus) | Keep classes unregistered so this works; don't require it. |
| Reference Target (`shadowrootreferencetarget`, `ShadowRoot.referenceTarget`) | Limited | **Chrome 152 only**; Firefox in progress; Safari behind flag | Progressive enhancement only (`<label for>`, `aria-*`, `commandfor` to the host). |
| `moveBefore()` / `connectedMoveCallback` | Limited | Chrome 133, Firefox 144; no Safari | Enhancement for state-preserving moves. |
| `CloseWatcher` | Limited | Chrome 126, Firefox 149; no Safari | Enhancement for platform back/close. |
| `ariaNotify()` | Newly (Sep 2026; Safari 27) | all current | Announcer primitive, with a live-region fallback. |
| `focusgroup` | Not Baseline (Chromium shipping/trialling; Gecko defer; WebKit no signal) | — | Align controller options with it; keep JS roving focus. |
| `hidden="until-found"` | Limited | Chrome 102, Firefox 148; no Safari | Collapsible/tab panels: detect, else plain `hidden` `[mwg:search-hidden-content]`. |
| CSS module scripts (`import … with {type:'css'}`) | Limited | Chrome 123, Firefox 147; no Safari | Keep styles in JS (`css` tagged templates) for now. |
| Trusted Types | Newly (Feb 2026) | all | Markdown/Code/HTML-rendering components must be TT-compatible `[mwg:trusted-types]`. |
| Sanitizer API | Limited | Chrome 146, Firefox 148; no Safari | Sanitize with DOMPurify fallback `[mwg:sanitize-untrusted-html]`. |

**Recommendation: write down a support floor.** The skill suggests documenting a policy once the
project shows cues like these. A realistic floor for a 2026 design system is "current and previous
major of Chrome/Edge, Firefox, Safari (macOS/iOS)". That floor makes Popover, ARIA element
reflection, `:state()`, `requestClose` and `showPopover({source})` safe natively. Under the
default skill policy they would each need fallbacks. The architect should decide and record it in
`CLAUDE.md`/`AGENTS.md`, with the per-feature fallbacks above for anything below the floor.

---

## 5. Element naming, registration, collisions, multiple versions

**Naming**

- Tag prefix: short and unique, used for every tag and every custom event. Plan provisional:
  `tct-`. Tags are the kebab-case Astryx name (`Selector` → `tct-selector`,
  `DateRangeInput` → `tct-date-range-input`). Subcomponents get their own tag only when they carry
  semantics or styling (old CONVENTIONS §2 rule).
- Classes: `Tct` + PascalCase. Declare `HTMLElementTagNameMap` for every tag.
- Don't shadow global attributes/properties: `title`, `hidden`, `lang`, `dir`, `slot`, `part`,
  `id`, `style`, `role`, `tabindex` `[mwg:custom-elements]`.
  - `title` matters for Astryx: Dialog/Card/Section "title" props map to a `heading`/`label`
    attribute or a `heading` slot. A `title` attribute on a host shows a native tooltip.

**Registration**

- Class modules are **side-effect free** and export unregistered classes.
- Each family has a `define` entry that registers its tags idempotently. Providers are defined
  before consumers. The entry imports the define entries of families it renders.
- A root entry registers everything (convenience).
- `package.json` `sideEffects` lists only define entries and CSS.
- Duplicate-definition policy:
  - same class → no-op;
  - different class → keep first, warn once naming both versions (embed a `version` static).
- **Never** register in a Lit `@customElement` decorator inside the class module. Web Awesome
  does, which makes its class modules non-tree-shakable registration side effects.

**Multiple versions on one page.** Offer four tiers, in order of preference:

1. **Singleton by default.** `lit` and our package are deduped by the consumer. The define-time
   warning makes accidental duplication visible.
2. **Scoped registries** (Chrome 146, Safari 26, Firefox Nightly) for micro-frontends and
   embeds. The consumer creates a `CustomElementRegistry`, defines our unregistered classes in it,
   and attaches it to their shadow root (`attachShadow({ customElementRegistry })` /
   `registry.initialize(root)`). For our own shadow roots to create internal child elements from
   the right registry:
   - render internal children through Lit templates in the shadow root, never with
     `document.createElement`;
   - never construct children with `new TctX()` (constructors resolve only against the global
     registry per the WICG proposal);
   - keep an escape hatch such as `@lit-labs/scoped-registry-mixin` for components that must
     define private sub-elements.
3. **Prefix-rewritten build** (Carbon's `es-custom/` approach) only if a customer needs it before
   scoped registries reach Firefox. Lit's static templates make a *runtime* prefix option costly,
   so this would be a build-time transform.
4. **iframes** for full isolation (the WICG proposal's own alternative).

Test cases (plan §5 asks for them): double import, two versions, define-after-parse upgrade,
pre-upgrade property assignment, reconnect/move, and server import safety (module evaluation
without `window`).

---

## 6. Attributes, properties, reflection and typing

**Rules**

1. **Scalar configuration** → attribute + property. Kebab-case attributes, camelCase properties.
   Booleans follow HTML: presence = true; never `="false"`; default false. So the negative form
   goes in the name, e.g. `hide-close`, never `show-close="false"`.
2. **Structured data and callbacks** → property only (`attribute: false`). Never JSON attributes.
   Covers Astryx `items`, `columns`, `renderX` callbacks and formatter functions.
3. **Reflect only what CSS or consumers must observe**: `variant`, `size`, `open`, `disabled`,
   `invalid`, `orientation`.
   - Don't reflect runtime-derived state: use custom states `[mwg:custom-elements]`.
   - Don't reflect `value`/`checked`. As on native inputs, the attribute is the *default* and the
     property is the *current* value; `defaultValue` mirrors the attribute.
4. **Source of truth in JS fields**; attributes are serialised views `[mwg:custom-elements]`.
5. **Pre-upgrade properties**: Lit restores instance properties set before upgrade for reactive
   properties. Any hand-written accessor must do the same ("upgrade property" pattern). Test it:
   React/Vue set properties before lazy definitions load.
6. **Controlled vs uncontrolled.**
   - Elements own their state by default, as native elements do.
   - "Controlled" usage means cancelling the intent event (§7) or setting the property in the
     change handler.
   - Property writes must never emit events. This prevents feedback loops (plan §5).
7. **Localizable strings** are attributes with English defaults (`close-label`, `remove-label`).
   An optional locale registry supplies them in bulk (§17).
8. **Typing.**
   - String-literal unions for enumerations, exported as `*.types.ts` constants (SWC gen2 pattern)
     so docs and validators share them.
   - Declare `HTMLElementTagNameMap`.
   - Use standard decorators with `accessor`, or `experimentalDecorators`, consistently. Verify in
     the POC that the CEM analyzer reads the chosen form.
   - In dev builds only, validate enum attributes and warn on unknown values (SWC gen2 has a debug
     validation layer).

**Astryx prop → WC mapping**: follow the old CONVENTIONS §4 table (`isDisabled` → `disabled`,
`defaultValue` → `value` attribute, `onChange` → native `change`, `onOpenChange` → cancelable
intent event + `open`, and so on). Maintain the plan's per-prop mapping table in metadata (§15) so
docs can show "Astryx prop → attribute/property/slot/event".

---

## 7. Events

| Rule | Detail |
| --- | --- |
| **Native names for native concepts** | Value controls fire `input` (continuous) and `change` (commit), only on user action `[mwg:form-associated-custom-elements]`. Native `input` from an inner `<input>` is already composed and retargets to the host. Native `change` is **not** composed, so re-dispatch it from the host exactly once. Don't add a second `input`. Buttons: the inner `<button>`'s `click` already retargets. Don't emit another. |
| **Never re-dispatch focus/blur** | `focus`/`blur`/`focusin`/`focusout` are composed and retarget to the host. Moving focus within one shadow root correctly produces no host focus events. Re-dispatching (as SWC gen2's focus guide suggests) produces duplicates. Test event counts. |
| **Prefixed names for library concepts** | `tct-` + kebab-case (`tct-open-change`, `tct-select`, `tct-remove`, `tct-sort-change`). Web Awesome's lesson: no prefixed duplicate of a native event. |
| **Intent vs commit** | *Intent* events fire before the state change, are `cancelable`, and carry `reason` (`"trigger" \| "escape" \| "outside" \| "focus-out" \| "programmatic-request"`). *Commit* events fire after the state (and animation) settles. Model on the platform's `beforetoggle`/`toggle` pairing (`ToggleEvent` with `oldState`/`newState`). |
| **Bubbling / composition** | Public events `bubbles: true, composed: true`. Internal coordination events (item → parent) are *not* composed and are stopped at the owning host, so they never leak as API. Document per event: bubbles, composed, cancelable, detail. Plan §5 requires this. |
| **Non-form selection** | Tabs, accordion, segmented control used for navigation fire `tct-value-change`, not `change`. A `change` would be indistinguishable from `change` events bubbling out of form controls inside the panels (old CONVENTIONS §4). |
| **Typed event classes** | One `class TctOpenChangeEvent extends Event` per event name, exported from `…/events`, augmenting `GlobalEventHandlersEventMap` once (Web Awesome pattern). Payload lives on typed fields, not `detail`. That gives better DX in TS and in React 19 handlers. |
| **Declarative invokers** | Overlay hosts listen for the `command` event with custom commands `--show`/`--hide`/`--toggle`, so `<button commandfor="dlg" command="--show">` works without JS where the host and button share a tree (Newly available) `[mwg:custom-button-actions]`. The `command` event does not bubble. Custom commands carry no ARIA, so the host still sets `aria-expanded` on the source. |

---

## 8. Content: slots vs properties, compound components

- **Slots** for author content that can hold markup: labels with markup, icons, start/end
  adornments, footers, actions. A string attribute shortcut exists only where plain text is
  common (`label="…"` *or* `slot="label"`, the Web Awesome convention). Offer both only when both
  are common.
- **Light-DOM child elements** for compound components with modest item counts:
  `<tct-selector><tct-option>`, `<tct-tab-list><tct-tab>`, `<tct-menu-item>`.
  - The parent discovers children with `slotchange` + `assignedElements()`, or a filtered
    `MutationObserver` for deep descendants.
  - Shared state travels via `@lit/context` (providers defined first).
  - Items carry their own semantics through `ElementInternals` (`role="option"`,
    `ariaSelected`).
- **Properties + renderer callbacks or `<template>`** for data-heavy widgets: Table, TreeList,
  virtualized lists, PowerSearch results. DOM children don't scale there. Astryx render props
  (`renderItem`, `renderCell`) become typed callback properties returning Lit templates *or* DOM
  nodes. Document the security contract: output is trusted markup, never string HTML.
- **Slot pitfalls to design around** `[mwg:shadow-dom]`:
  - whitespace text fills the default slot, so compute `has-*` states from non-whitespace nodes;
  - `::slotted()` reaches top-level nodes only;
  - DOM order, not slot order, drives `:first-child`;
  - `slotchange` is the upgrade signal.
  - SSR cannot know slot occupancy. Web Awesome needed `with-start`/`with-end` hints. Prefer
    designs where an empty slot costs nothing visually (e.g. `:host(:has-slotted)` is only
    Firefox, so rely on a gap-free layout rather than slot-presence classes where possible).
- **Triggers for anchored overlays**: `slot="trigger"` on the overlay host, or a `for`/`anchor`
  IDREF to an element in the *same* tree (Web Awesome popover pattern). IDs across roots don't
  resolve, so the trigger slot is the robust default.

---

## 9. Styling hooks as public API (contract only; see styling.md)

Everything consumers can style is **public API**. It is versioned and documented in the CEM
(`@csspart`, `@cssprop`, `@cssstate`, `@slot`):

- **Parts**: a few high-level parts per component (`base`, `label`, `control`, `popup`, `icon`),
  with `exportparts` through nested components `[mwg:styling-web-components]`. Renaming a part is
  a breaking change. Web Awesome keeps deprecated part aliases for a major.
- **Custom states**: `:state(open|checked|invalid|user-invalid|disabled|loading|focus-visible|has-*)`,
  read-only to consumers `[mwg:custom-elements]`.
- **Component custom properties**: a documented, constrained set (`--tct-dialog-width`) using the
  private-alias pattern (`--_x: var(--tct-x, fallback)`), never seeded on `:host`
  `[mwg:styling-web-components]`.
- **Avoid `:host-context()`**: it is Chromium-only `[mwg:styling-web-components]`.
- **`:host` rules**: `display`, sizing and inherited text only. Box styles go on a part
  (old CONVENTIONS §5).

---

## 10. Shadow DOM vs light DOM: the per-component decision

| Choose | When | Astryx examples |
| --- | --- | --- |
| **Open shadow root** (`delegatesFocus` if exactly one inner focus target) | Encapsulated controls whose semantics are satisfied by native elements inside one root, or by host internals. | Button, IconButton, ToggleButton, Switch, CheckboxInput, Badge, Avatar, Spinner, ProgressBar, Tooltip, Popover, Dialog, Toast, Tabs (host-semantics items), Slider |
| **Shadow root, but the native input slotted from light DOM** (Vaadin pattern) or **light-DOM rendering** | Text-entry fields where autofill, password managers, `autocomplete` tokens and `<label for>` must work today. Safari autofill and third-party password managers remain unreliable for inputs inside shadow roots. | TextInput (password/email/address/OTP contexts), possibly NumberInput, DateInput segments. **Spike in POC-001** (plan §9). |
| **Light DOM (no shadow root)** or shadow root with light-DOM content ownership | Content the author owns and styles, native table semantics, long rich text, and relationships many external IDs point into. | Table (native `<table>` in light DOM), Markdown, CodeBlock output, Heading/Text/Blockquote, layout primitives (Stack/HStack/Grid/Layout/Center: often CSS classes or light-DOM hosts), MetadataList |
| **Plain CSS / native element, no custom element** | Purely presentational, or a native element suffices `[mwg:web-components]`. | Divider, VisuallyHidden, Kbd, possibly AspectRatio. Consider CSS utility classes over elements. |

- Default to `mode: 'open'`.
- Never use customized built-ins (`is=`): Safari won't ship them `[mwg:web-components]`.
- Light-DOM components need scoped CSS: `@scope` (Newly, Mar 2026) or prefixed class names in
  a layered global stylesheet. Coordinate with styling.md.

---

## 11. Accessibility across shadow roots

**Semantics placement.**

- Native elements inside the shadow root when the component *is* a native control
  (`<button>`, `<input>`, `<dialog>`, `<a>`).
- `ElementInternals` default semantics when the host itself is the semantic node: options, tabs,
  menu items, tree items, rows, switch. Consumers can still override with attributes
  `[mwg:accessible-web-components]`.
- Never sprout `role` attributes on hosts.
- Links stay `<a href>`. Don't turn navigation into `role=tab`/`button` (plan §7 table).

**Relationships**

1. Keep each composite widget's IDREF relationships **inside one tree scope**
   `[mwg:web-components]` (MANDATORY).
2. For shadow → outer references use **element reflection**. Examples:
   - `input.ariaActiveDescendantElement = slottedOption`;
   - `input.ariaLabelledByElements = [...internals.labels]`;
   - `ariaDescribedByElements` → an error/description element in the host's tree.

   Allowed: references into the same or an ancestor scope. Not allowed: into a deeper shadow root.
   Newly available (2025), so feature-detect and fall back to copying the text into `aria-label` /
   `aria-description`. The old review flagged dialog names missing that fallback.
3. **Host ARIA delegation**: authors and other components set `aria-*` on the host. The component
   mirrors it to the inner semantic node, resolving IDREFs in the host's scope (keep
   `AriaDelegateController`).
4. **`<label for>` → FACE host**: `internals.labels` returns the labels. Because the host is not
   the semantic node, point the inner control's `ariaLabelledByElements` at them. Label
   *activation* (click) must forward to the inner control; test Safari. Where Reference Target
   exists (Chrome 152), set `shadowRoot.referenceTarget` to the inner control as an enhancement,
   so `for`, `aria-labelledby`, `aria-describedby` and `commandfor` aimed at the host resolve
   natively.
5. **`delegatesFocus` does not solve naming** (plan §5). Use it only when there is exactly one
   focus destination (SWC gen2 rule). Not for combobox, multi-thumb slider or roving groups.
6. **Focus models**:
   - `aria-activedescendant` (element reflection) only where DOM focus must stay in a text
     input (combobox, typeahead, command palette, tokenizer);
   - roving `tabindex` elsewhere (tabs, toolbar, menu, radio list, tree, segmented control).
   - Align the roving controller's options with Open UI `focusgroup`, as SWC gen2 does, so a
     future native path is a swap.
7. **Announcements**: one announcer per document. Use `ariaNotify()` when available (Newly, Sep
   2026). Otherwise use one polite + one assertive light-DOM live region, debounced, and moved
   into the top-most modal while one is open `[mwg:accessibility §8]`. No live regions inside
   component shadow roots; no empty `role=status` per spinner (old M10).
8. **Disabled semantics**:
   - FACE hosts get native `disabled` behaviour (`:disabled`, `formDisabledCallback`, fieldset
     propagation).
   - Non-form hosts and transiently unavailable actions use `aria-disabled` + guarded activation
     so focus is not lost (SWC `DisabledMixin` rationale; old H8).
   - The distinction is pattern-specific (plan §7).

**Testing a11y** (§16): axe for regressions, computed-accessibility-tree assertions for
name/role/state through shadow roots, and the manual AT matrix (plan §7).

---

## 12. Form-associated custom elements: the full contract

Baseline Widely (2023) `[mwg:form-associated-custom-elements]`. Each value-bearing Astryx
component (TextInput, TextArea, NumberInput, CheckboxInput, CheckboxList, RadioList, Switch,
Selector, MultiSelector, Typeahead, Tokenizer, Slider, Date/Time/DateRange inputs, FileInput,
SegmentedControl-as-input) is a FACE with:

| Concern | Contract |
| --- | --- |
| Opt-in | `static formAssociated = true`. One `attachInternals()` per element (base class owns it). |
| Value | `setFormValue(value, state)`. `FormData` for multi-value controls (repeated `name` entries), `null` for nothing. Files via `File`/`FormData`. Separate the *submission value* from the *restore state*. |
| Validity | `setValidity(flags, message, anchor)`: mirror the inner native control's `validity` when there is one; otherwise use validators. **Always pass a focusable anchor** (old H6). `setCustomValidity()` for consumers is separate from internal validators (Web Awesome tracks both). |
| Displayed invalidity | `:state(user-invalid)` flips after user commit (`change`/blur), a submit attempt or `reportValidity()`. Not on `checkValidity()` (old M6). `aria-invalid` set at the same moment `[mwg:accessible-error-announcement]`. Don't rely on `:user-invalid` matching FACE hosts. |
| Reset | `formResetCallback` → back to the `value`/`checked` *attribute* default; clears user-invalid. |
| Disabled | `formDisabledCallback` (includes `<fieldset disabled>`). Expose `isDisabled`; style `:host(:disabled)`. |
| Restore | `formStateRestoreCallback(state, reason)`, reason `restore` (bfcache/history) or `autocomplete`. Engines differ, so test per engine. |
| Labels | `internals.labels` + label-click forwarding + inner `ariaLabelledByElements` (§11). |
| Implicit submission | Enter in a single-line control (unmodified, not composing, `keyCode !== 229`) runs the HTML algorithm: default submit button's activation, or `form.requestSubmit()` when there is no submit button (Web Awesome's `submitOnEnter` is a working reference). `enterkeyhint` pass-through. |
| Submitter | `tct-button type=submit`: `form.requestSubmit()` with a submitter, or a temporary native submit button inserted in the light DOM so `formaction`/`formmethod`/`name=value` submitter semantics and the `SubmitEvent.submitter` field work. Test `FormData` submitter entries. |
| Form attribute | Support `form="id"` association (native FACE behaviour) and document it. |
| Read-only | `readonly` is not in the FACE constraint model. Implement the "barred from validation" behaviour manually (`willValidate` false → `setValidity({})`). |
| Autofill | Forward `autocomplete`, `inputmode`, `enterkeyhint` and `name` to the inner native input. For autofill-critical fields, use the light-DOM input variant (§10). |
| Events | `input`/`change` only on user action; `invalid` fires natively on the host. |

Fallback: the guide's hidden-input pattern is only for engines without FACE, which are below any
realistic floor.

---

## 13. Focus and overlay management

**One hierarchical layer manager** (plan §5) owns:

- the parent/child layer stack;
- top-most Escape and CloseWatcher handling;
- composed-path outside-press dismissal;
- modal inertness, scroll lock, initial focus and return focus;
- re-show after moves, exit animations and cleanup.

Upstream Astryx has the same concept (`Layer/layerStack.ts`, `useLayerDismissal.ts`,
`layerDismissalInvariants.test.tsx`). Port its invariants as tests.

| Surface | Mechanism | Notes |
| --- | --- | --- |
| Dialog, AlertDialog, BottomSheet, Lightbox, modal sheets | Native `<dialog>` in the shadow root + `showModal()` | No hand-rolled focus trap `[mwg:accessibility §11]`. Close through `requestClose()`/`cancel` so it is cancelable (intent event). Light-dismiss via `closedby="any"` where supported, else the guide's click-outside fallback `[mwg:light-dismiss-a-dialog]`. AlertDialog is non-light-dismissable. |
| Popover, DropdownMenu, MoreMenu, ContextMenu, HoverCard, Selector/Typeahead listbox, Tooltip, Toast stack | `popover="manual"` element in the shadow root, shown with `showPopover({ source: trigger })` | `manual` + our stack gives deterministic nesting across shadow roots (`auto` nesting depends on DOM/source ancestry). `source` also supplies the implicit anchor (§4). `hint` only as an enhancement for tooltips. |
| Non-modal drawers/panels | `inert` on the rest of the page, or `dialog.show()` | `[mwg:html §6]` |
| Positioning | **PositionController, two strategies.** (1) CSS: implicit anchor + `position-area` (logical keywords) + `position-try-fallbacks: flip-block, flip-inline` `[mwg:resilient-context-menus-and-nested-dropdowns]`. (2) JS: `@floating-ui/dom` 1.8 (`strategy: fixed`, flip/shift/size/arrow/hide) when anchor positioning is unsupported or the case needs a **virtual anchor** (context menu at pointer, text selection) or measured available-size clamping. | Feature-detect with `CSS.supports('anchor-name: --a')` and `source`-option support. Arrow placement via anchored container queries is Chromium-only, so compute the side in JS or hide the arrow `[mwg:position-aware-tooltips]`. Plan §5 requires the measured fallback; Astryx itself degrades positioning in a lower tier. |
| Animation | `@starting-style` + `transition-behavior` (Newly 2024) for entry. Exit via WAAPI before `close()`/`hidePopover()`, not `overlay` (Chromium-only) `[mwg:animate-to-from-top-layer]`. | Reduced motion respected. |
| Moves | `connectedMoveCallback` (no teardown on `moveBefore`). On plain reconnect, re-show if `open`. | `[mwg:persistent-top-layer-ui]` |

**Focus rules**

- Initial focus: an explicit `autofocus`/first tabbable/container, per pattern.
- Return focus to the invoker unless it's gone; then to a documented fallback.
- A nested layer must not close its parent.
- Opening from a pointer must not show a focus ring.
- Never focus-trap inside a native modal.
- Popovers with `role=dialog` either trap *with* `aria-modal` or don't trap at all (old review,
  "Low").

---

## 14. SSR, Declarative Shadow DOM, hydration

- **Status.**
  - DSD is Widely available (Aug 2026).
  - Lit SSR is `@lit-labs/ssr` 4.1.0, **still labs**. It supports shadow-DOM Lit components only,
    with no async component work. Client hydration needs `lit-element-hydrate-support.js` loaded
    before `lit`.
  - Web Awesome ships an optional SSR loader on it; FAST 3 has opt-in hydration.
  - Upstream Astryx tests "server-safe components" (`serverSafeComponents.test.ts`), so server
    rendering is part of the parity surface to consider.
- **v1 requirement: SSR-safe, not SSR-rendered.**
  - Every module imports on the server without touching `window`/`document`.
  - No DOM access in constructors or `render()`; DOM work goes in `firstUpdated`/`updated`/
    `connectedCallback`.
  - State derives from attributes.
  - Components reuse an existing `shadowRoot` (DSD) instead of re-rendering
    `[mwg:prerendering-custom-elements]`.
- **Early vertical slice (plan §5/§9):** render Button + TextInput + Dialog through
  `@lit-labs/ssr` inside the docs build. Measure:
  - hydration mismatches;
  - slot-dependent layout (the Web Awesome `with-*` problem);
  - FACE behaviour before upgrade;
  - React 19 SSR, which renders only primitive props as attributes and omits objects/functions.

  Decide per component family whether SSR output is supported.
- **FOUC**: ship an opt-in `defined.css` that hides only listed tags while `:not(:defined)`. It
  **fails open**: opacity 0 plus a delayed reveal animation, not `visibility: hidden`
  `[mwg:custom-elements]`. The old project's html-class + timeout cloak worked but was more
  machinery than necessary.

---

## 15. Packaging, loading, tree-shaking, metadata

**Package outputs**

- Unbundled ESM, one module per source file (`tsc` or a bundler with `preserveModules`), plus
  `.d.ts`.
- `exports` subpaths:
  - `@x/components/<family>`: registers the family;
  - `@x/components/<family>/<module>.js`: classes only, no registration;
  - `@x/events`, `@x/define` (register all);
  - CSS, `custom-elements.json`, JSX/Vue types.
- `sideEffects: ["**/define.js", "*.css"]`.
- `lit`, `@lit/context` and `@floating-ui/dom` as dependencies (deduped).
- Keep heavy optional engines out of leaf imports: calendar systems, table core, Markdown
  parser, syntax highlighter.
- Locales loaded on demand.

**CDN build**: an esbuild/Vite build with code splitting, plus an **autoloader** (MutationObserver
over the document; opt-in `data-tct-preload`). Web Awesome's loader is a good reference.
Improvement: also observe shadow roots our own components create, and expose `discover(root)`
for app shadow roots.

**Custom Elements Manifest as the API source of truth**

- `@custom-elements-manifest/analyzer` 0.11 with the Lit plugin, or the wc-toolkit generator.
  JSDoc required: `@summary`, `@slot`, `@csspart`, `@cssprop`, `@cssstate`, `@fires`,
  `@property`, `@tag`, `@since`, `@deprecated`.
- Extend the manifest (custom fields) with authored metadata the CEM can't express:
  - Astryx prop mapping;
  - keyboard contract;
  - form semantics;
  - event bubbles/composed/cancelable flags;
  - a11y notes;
  - Baseline requirements.

  Keep it in per-component metadata files merged at build (plan §8: "a CEM alone does not
  capture all interaction semantics").
- Generate from it:
  - docs API tables;
  - `custom-elements-jsx.d.ts` (`@wc-toolkit/jsx-types` 1.8);
  - Vue `GlobalComponents` types;
  - VS Code / JetBrains data;
  - optional React wrappers (`@wc-toolkit/react-wrappers`);
  - **`llms.txt` + Agent Skills** (Web Awesome and SWC both ship agent docs, and plan §8 keeps
    agent-readable reference in scope).
- **Drift tests**: every public member is documented, every documented member exists, every
  Astryx prop is mapped or explicitly waived.

**Versioning**

- SemVer where the public API = tags + attributes + properties + methods + events (names and
  flags) + slots + parts + states + public custom properties.
- Deprecate with aliases for one major (Web Awesome keeps `base` → `button` part aliases).
- Changesets per package.
- Channel disruptive changes into a new generation rather than minors (SWC lesson).

---

## 16. Framework interop

| Framework | Status in 2026 | What we ship |
| --- | --- | --- |
| **React 19** | 100% on custom-elements-everywhere. Props matching an instance property are set as properties, others as attributes. `on*` function props attach listeners with the event name as written. SSR renders primitives only. | Generated JSX intrinsic-element types (props, typed `on<event>` handlers). Docs for `ref`-free usage. **Avoid public properties whose names start with `on`** (React treats function-valued `on*` props as listeners; react#29659). Optional generated wrappers for React 18 and idiomatic `onOpenChange` names. Test lowercase `oninput`/`onchange` vs custom event casing in the integration app. |
| **Vue 3** | Works with `compilerOptions.isCustomElement`. Properties via `.prop`/auto-detection, events via `@tct-open-change`. | `GlobalComponents` types. A documented `:value` + `@input` pattern (don't promise `v-model` on custom elements without testing). Optional tiny directive. |
| **Angular** | `CUSTOM_ELEMENTS_SCHEMA`. | A small generated `ControlValueAccessor` directive for FACE controls (reactive forms), plus typings. |
| **Svelte 5 / Solid / plain HTML** | Native property/event binding. | Types from the CEM. |

- Keep a framework-integration test app (plan's `apps/integration`) per framework. It covers
  pre-upgrade property assignment, controlled usage, SSR import and form submission.
- Adapters stay thin and generated, never a second implementation.

---

## 17. i18n and RTL

- **Direction**:
  - logical properties throughout;
  - `:host(:dir(rtl))` for icon mirroring (Widely, Jun 2026);
  - keyboard arrow semantics read the *computed* direction of the host
    (`getComputedStyle(host).direction`), never `document.dir`.
- **Locale resolution**: `LocaleController` walks `closest('[lang]')` and crosses shadow roots
  via `getRootNode().host`. It observes `<html lang dir>` changes and exposes the resolved locale
  for `Intl.*`. Astryx has an `InternationalizationProvider`; map it to an optional
  `<tct-locale-provider>` using `@lit/context`, which also carries message overrides. DOM `lang`/
  `dir` stay the primary mechanism.
- **Messages**: English defaults, per-component label attributes, and a
  `registerTranslation(locale, messages)` registry (Web Awesome/Shoelace localize pattern). Lazy
  locale bundles. `@lit/localize` (0.12.2, last release 2024) is not needed for a component
  library.
- **Dates/numbers**: `Intl` + `@internationalized/date`/`number`. Calendar systems,
  location-agnostic dates and time zones follow `[mwg:support-global-calendar-systems]`,
  `[mwg:capture-location-agnostic-data]` and `[mwg:coordinate-global-events]`. Keep storage,
  display locale and time-zone responsibilities distinct (plan §5).
- **IME**: one helper for composition-safe Enter (`isComposing` + `keyCode 229`), and no
  character filtering mid-composition (old M9) `[mwg:ime-safe-enter-submit]`.

---

## 18. Testing strategy

| Layer | Tool | Notes |
| --- | --- | --- |
| Component behaviour | **Vitest 5 browser mode + `@vitest/browser-playwright`** (Playwright 1.63) | Browser mode has been stable since Vitest 4. One runner for unit and browser tests. The old project proved it with Lit. `@web/test-runner` 1.0.0 (Jul 2026) remains viable but has less momentum. Run Chromium locally (this environment has only Chromium). **CI must run Firefox and WebKit.** |
| Accessibility regression | axe-core 4.13 in each component test. Name/role/state assertions against the computed accessibility tree: CDP (Chromium) via the old `axNode`/`axTree`, plus Playwright `ariaSnapshot()` for cross-engine checks. | axe traverses open shadow roots but can't prove flattened-tree semantics or keyboard contracts. |
| Keyboard contracts | Real keyboard via Playwright/`userEvent` per APG pattern table (plan §7). | Generated from the authored keyboard metadata so docs and tests share one table. |
| Forms | A dedicated form harness covering every §12 row: `FormData`, reset, fieldset, restore (bfcache), Enter, submitter, `form=`, label click, validity focus. | Cross-engine; restore behaviour differs by engine. |
| Overlays | A nested-layer fixture (Selector in Dialog with Tooltip; plan §10). Asserts one Escape per layer, return focus, outside press, move while open, toast under modal. | Port Astryx `layerDismissalInvariants` cases. |
| Registration/lifecycle | Double define, two versions, define-after-parse, pre-upgrade props, move/reconnect, server import (Node, no DOM). | §5 |
| Visual regression | Playwright screenshots: light/dark, LTR/RTL, forced-colors (`forcedColors: 'active'`), reduced motion, sizes. Pairwise combination strategy (plan §10). | Covered by styling.md. |
| Framework integration | React 19 / Vue / Angular apps with Playwright e2e. | §16 |
| Manual AT | NVDA+Chrome/Firefox, JAWS, VoiceOver macOS/iOS, TalkBack (plan §7). Record versions. | Automated scans are not a conformance claim. |

---

## 19. Performance budgets

The plan says to set measured budgets after the prototypes. Proposed *initial guard-rails* to
validate in POC-001, enforced with size-limit in CI:

- **Shared runtime** (`lit` + `@lit/context` + base/internals): target ≤ 10 kB min+gz, loaded
  once. Lit itself is ~5–6 kB.
- **Leaf component own code** (Button, Badge, Switch): ≤ 3–4 kB min+gz each. **Form control with
  field chrome**: ≤ 8 kB. **Overlay core** (layer manager + position controller, excluding
  Floating UI): ≤ 6 kB.
  - Floating UI (~3 kB) loads only on the JS fallback path (dynamic import after feature
    detection).
- **No locale, calendar, table core, Markdown parser or highlighter in any import that doesn't
  need it.** Tested by bundle-analysis assertions on per-component entries.
- **Runtime**:
  - no layout thrash on open (read, then write);
  - `content-visibility`/virtualization for large collections `[mwg:defer-rendering-heavy-content]`;
  - long filter/sort work yields `[mwg:break-up-long-tasks]` (old M12);
  - typeahead filtering debounced;
  - INP per interaction under 200 ms on representative large datasets (plan §10).
- **Styles**: one constructed sheet per component class, shared across instances
  `[mwg:shadow-dom]`. Avoid deep nested shadow trees for simple leaves.

---

## 20. Documentation site

- **Astro + Starlight** (0.42) for the public docs, as in the old project:
  - static by default, MDX;
  - custom elements work in `.astro`/MDX with no hydration framework;
  - one HTML file per example serves as both preview and displayed source (old CONVENTIONS §8,
    which worked well).

  Eleventy (Web Awesome's choice, 3.1) is an equally sound static option. Astro wins on existing
  owner experience and component-authored layouts.
- **API tables, keyboard tables, form-semantics and Astryx-mapping sections are generated** from
  the CEM + authored metadata (§15). Docs pages follow the plan §8 section list.
- **Storybook 10** (`@storybook/web-components-vite`) is optional, as an internal workbench and
  fixture host with CEM-driven controls (`@wc-toolkit/storybook-helpers`). Don't make it the
  public docs, and don't let it become a second source of examples. If the Vitest fixtures and
  docs examples cover the workbench role, skip it (plan excludes the playground product).
- **Docs quality gates** reuse the old review's findings:
  - skip link outside the sidebar;
  - `aria-current` in the TOC;
  - search results announced;
  - system theme default;
  - speculation rules for next-page prefetch;
  - `modulepreload` for the render-blocking graph;
  - view transitions as an enhancement.

---

## 21. Open risks and questions for ARC-001

1. **Support floor.** Declaring "current + previous majors" removes most fallbacks (Popover,
   element reflection, `:state()`, `source`). Keeping the default skill policy means feature
   detection and conditional polyfills in the overlay core. Decide first.
2. **Text-entry fields: shadow vs slotted light-DOM input.** Affects every field-family API
   (`slot="input"`). Needs an autofill/password-manager/VoiceOver spike before Phase 2.
3. **SSR scope**: which families promise DSD output. Depends on the POC measurement.
4. **Anchor positioning parity**: whether CSS-first matches Astryx placement semantics (logical
   placements, clearance on both edges, multi-anchor `anchor-name` lists) in Firefox 147+ and
   Safari 26, or whether Floating UI must stay primary for some surfaces.
5. **Scoped-registry readiness**: Lit's support is still a labs mixin. Validate that nested
   internal components render from a scoped registry before advertising multi-version support.
6. **Reference Target** could simplify labelling/`commandfor` if WebKit/Gecko ship. Track
   Interop; design so adopting it is additive.

---

## Recommendations

Tags: **[W]** Baseline Widely available; **[N]** Newly available (follow guide fallback or
feature-detect unless the support floor covers it); **[L]** Limited, enhancement only;
**[—]** process/tooling.

1. **Adopt Lit 3 + TypeScript with a core/components split.** Headless `core`: abstract base
   classes, reactive controllers, mixins (form, focus, layers, collections, locale). Concrete
   `components`: templates, styles, registration (Spectrum gen2 model). [—]
2. **Write down a browser support floor** before ARC-001 closes, and record it in
   `CLAUDE.md`/`AGENTS.md` per the skill. Recommended: current + previous major of Chrome/Edge,
   Firefox and Safari; everything below follows the §4 fallbacks. [—]
3. **Use `tct-` for all tags and custom events** (not the earlier `tec-`). Name tags after
   Astryx components. Never shadow global attributes; map Astryx `title` props to
   `heading`/`label`. [W]
4. **Keep class modules side-effect free.** Register through idempotent `define` entries
   (same class = no-op; different class = keep first, warn once with versions). Declare
   `sideEffects` and per-family `exports` subpaths. [W]
5. **Design for scoped registries without requiring them.** Export unregistered classes, create
   internal children only through shadow-root-scoped templates (never `new X()` or
   `document.createElement`), and document the scoped-registry recipe. [L: Chrome 146, Safari
   26, Firefox Nightly]
6. **Attributes for scalars, properties for data and callbacks.**
   - Reflect only styling-relevant state.
   - `value`/`checked` attributes are defaults, not reflections.
   - Boolean attributes are HTML booleans.
   - Pre-upgrade property assignment is tested. [W]
7. **Expose runtime state as `:state()` custom states**, guarded by feature detection, and never
   as synthetic reflected attributes. [N: widely ≈ Nov 2026]
8. **Adopt the event contract (§7).**
   - Native `input`/`change` only on user action, never duplicated; `change` re-dispatched once
     because it isn't composed. Never re-dispatch focus/blur.
   - `tct-` events for library concepts, as a cancelable intent event plus a commit event (with
     `reason`).
   - Composed + bubbling for public events; non-composed internal events.
   - One typed `Event` subclass per name, augmenting `GlobalEventHandlersEventMap`. [W]
9. **Support declarative invokers on overlay hosts** (`command` event with `--show`/`--hide`/
   `--toggle`), managing `aria-expanded` ourselves. [N: Dec 2025]
10. **Decide Shadow DOM per component with the §10 matrix.**
    - Open shadow roots for encapsulated controls.
    - Light DOM for tables, rich content and layout.
    - A spike on slotted light-DOM `<input>` for autofill-critical fields.
    - No customized built-ins. [W]
11. **Put semantics in native inner elements or `ElementInternals` default ARIA.**
    - Keep IDREF relationships within one tree.
    - Use ARIA element reflection for shadow → outer references, with an `aria-label` text
      fallback.
    - Delegate host `aria-*` to the inner control. [W for attribute reflection / N for element
      reflection]
12. **Treat Reference Target as a progressive enhancement** (set `referenceTarget` to the inner
    control when supported). Never depend on it. [L: Chrome 152 only]
13. **Make every value-bearing control a FACE with the full §12 contract**, including implicit
    Enter submission, submitter semantics, validation anchor, `:state(user-invalid)` timing,
    reset, restore, fieldset-disabled, label activation, and `form=` association. Each row is a
    test. [W]
14. **Build one hierarchical layer manager.**
    - Native `<dialog>` + `showModal()` for modals (no JS focus trap).
    - `popover="manual"` + `showPopover({source})` for floating surfaces.
    - Escape/CloseWatcher on the top layer only; composed-path outside press; return focus.
    - Re-show after moves; WAAPI exit animations.

    [W dialog; N popover/`requestClose`/`source`; L `closedby`, CloseWatcher, `hint`,
    `moveBefore`]
15. **Position with CSS anchor positioning first** (implicit anchor, logical `position-area`,
    `position-try-fallbacks`), feature-detected. Fall back to a lazily imported
    `@floating-ui/dom` for unsupported engines, virtual anchors and measured size clamping.
    [L as an aggregate; core in Chrome 125+, Firefox 147+, Safari 26+]
16. **Use a single announcer**: `ariaNotify()` when available, else light-DOM polite/assertive
    live regions. Moved into the top-most modal while one is open; debounced; no per-component
    live regions. [N: Sep 2026]
17. **Carry over the earlier project's internals as the starting point**, rewritten against the
    new API: `defineElement`, base element, `FormControlMixin`, `AriaDelegateController`,
    Popup/Dismiss controllers, roving/list navigation, typeahead, locale, test utils. Turn every
    High/Medium finding in its review into a regression test on day one. [—]
18. **Make components SSR-safe in v1** (import-safe, no DOM in constructor/render, reuse an
    existing shadow root). Run a Lit-SSR/DSD vertical slice in Phase 1 before promising SSR for
    any family. Ship a fail-open `:not(:defined)` stylesheet. [W DSD; Lit SSR is labs]
19. **Ship unbundled per-component ESM plus a code-split CDN build and an autoloader** that also
    covers component-created shadow roots. Keep heavy optional engines and locales out of leaf
    imports. [W]
20. **Make the Custom Elements Manifest (+ authored metadata) the single API source.** Generate
    docs tables, JSX/Vue types, IDE data, optional React wrappers, `llms.txt` and Agent Skills
    from it. Fail CI on drift between code, manifest, docs and the Astryx mapping. [—]
21. **Framework interop via types, not wrappers.**
    - React 19 natively with generated JSX types, and no public `on*` properties.
    - Optional generated React-18 wrappers.
    - Vue `GlobalComponents` types.
    - An Angular `ControlValueAccessor` directive.
    - A per-framework integration test app. [—]
22. **i18n/RTL.**
    - Logical properties and `:dir()`.
    - Computed-direction-aware keyboard handling.
    - A `LocaleController` that crosses shadow roots.
    - An optional `<tct-locale-provider>` mirroring Astryx's provider.
    - `registerTranslation` + label attributes; `Intl` + `@internationalized/*`.
    - One IME-safe Enter helper.

    [W `:dir()`]
23. **Testing:**
    - Vitest 5 browser mode + Playwright (Chromium locally; Chromium, Firefox and WebKit in CI).
    - axe + computed-accessibility-tree assertions.
    - Keyboard tables generated from metadata.
    - Dedicated form, overlay-nesting, registration and framework harnesses.
    - Forced-colors/RTL/reduced-motion runs; the manual AT matrix per release. [—]
24. **Enforce size budgets from the first component** (size-limit in CI). Revise the §19
    guard-rails after POC-001 rather than inventing final numbers now. [—]
25. **Docs:**
    - Astro + Starlight, with HTML example files that are both preview and source.
    - Generated reference sections.
    - Storybook only as an optional internal fixture workbench.
    - The earlier review's docs-site findings as acceptance criteria. [—]
26. **Security for content components** (Markdown, Code, custom renderers):
    - Trusted-Types-compatible rendering;
    - native Sanitizer where available, DOMPurify fallback;
    - renderer callbacks return templates/nodes, never HTML strings.

    [N Trusted Types; L Sanitizer]
27. **Governance:**
    - The API is SemVer'd, including parts, states, events and custom properties.
    - Deprecations keep aliases for one major.
    - Disruptive changes go into a new generation.
    - Name an owner for the WC library explicitly. Material Web's maintenance mode is the
      cautionary tale. [—]

---

## Sources

**modern-web-guidance guide ids** (skill version `2026_09_04-7de96777`):

- Core: `web-components`, `custom-elements`, `shadow-dom`, `accessible-web-components`,
  `form-associated-custom-elements`, `prerendering-custom-elements`, `styling-web-components`.
- Overlays: `declarative-dialog-popover-control`, `custom-button-actions`,
  `interest-triggered-tooltips`, `position-aware-tooltips`,
  `resilient-context-menus-and-nested-dropdowns`, `light-dismiss-a-dialog`,
  `platform-controls-dismiss-dialog`, `persistent-top-layer-ui`,
  `move-dom-element-without-losing-state`, `animate-to-from-top-layer`.
- Forms: `forms`, `accessible-error-announcement`, `validate-input-after-interaction`,
  `required-field-feedback`, `ime-safe-enter-submit`, `branded-select-styling`.
- General: `html`, `accessibility`, `search-hidden-content`, `conditional-async-dependencies`.
- Security: `trusted-types`, `sanitize-untrusted-html`.
- Performance and dates: `defer-rendering-heavy-content`, `break-up-long-tasks`,
  `support-global-calendar-systems`, `capture-location-agnostic-data`, `coordinate-global-events`.

**Browser data**

- `web-features` 3.40.0 npm package (2026-09-28), `data.json` statuses and per-compat-key support.
  Explorer: https://web-platform-dx.github.io/web-features-explorer/
- Scoped registries: https://web-platform-dx.github.io/web-features-explorer/features/scoped-custom-element-registries/ ;
  https://developer.chrome.com/blog/scoped-registries ;
  https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Scoped-Custom-Element-Registries.md ;
  https://github.com/web-platform-tests/interop/issues/1027 ;
  https://webkit.org/blog/17818/announcing-interop-2026/
- Reference Target: https://developer.chrome.com/release-notes/152 ;
  https://meyerweb.com/eric/thoughts/2025/12/19/targeting-by-reference-in-the-shadow-dom/
- focusgroup: https://developer.chrome.com/blog/focusgroup-rfc ;
  https://adrianroselli.com/2026/07/focusgroup-tests.html

**Libraries**

- Web Awesome: `@awesome.me/webawesome` 3.14.0 npm package (`dist/llms.txt`, `dist/events`,
  `dist/webawesome.loader.js`, `dist/webawesome.ssr-loader.js`, form-submit chunk).
  https://webawesome.com/docs/resources/migrating-from-shoelace/ ;
  https://webawesome.com/docs/ssr/ ;
  https://blog.fontawesome.com/how-does-web-awesome-stack-up-against-shoelace/ ;
  https://github.com/shoelace-style/shoelace
- Spectrum Web Components:
  https://github.com/adobe/spectrum-web-components/blob/main/CONTRIBUTOR-DOCS/README.md ;
  `…/03_project-planning/01_objectives-and-strategy.md` ;
  `…/01_contributor-guides/14_focus-management.md` ;
  `…/02_style-guide/02_typescript/README.md` ;
  https://github.com/adobe/spectrum-web-components/pull/6660
- Material Web: https://github.com/material-components/material-web/discussions/5642 ;
  https://9to5google.com/2024/06/25/material-web-components/
- Carbon: https://medium.com/carbondesign/carbon-web-components-v2-full-release-40fc25c73bef ;
  https://github.com/carbon-design-system/carbon-web-components
- Lion: https://lion.js.org/guides/principles/scoped-elements/ ;
  https://medium.com/ing-blog/ing-open-sources-lion-a-library-for-performant-accessible-flexible-web-components-22ad165b1d3d
- FAST/Fluent: https://github.com/microsoft/fast/tree/main/packages/fast-element ;
  https://github.com/microsoft/fluentui/blob/master/packages/web-components/README.md
- Vaadin slotted input: https://github.com/vaadin/web-components/issues/84 ;
  https://github.com/vaadin/web-components/issues/2758
- Shadow DOM/a11y/autofill: https://nolanlawson.com/2022/11/28/shadow-dom-and-accessibility-the-trouble-with-aria/ ;
  https://nolanlawson.com/2023/12/30/shadow-dom-and-the-problem-of-encapsulation/ ;
  https://www.dashlane.com/blog/shadow-dom-better-autofill
- npm versions checked 2026-09-28: lit 3.3.3, @lit-labs/ssr 4.1.0, @lit/context 1.1.6,
  @material/web 2.5.0, @adobe/spectrum-wc 2.0.0-beta.3, @carbon/web-components 2.64.0,
  @lion/ui 0.21.1, @microsoft/fast-element 3.0.3, @fluentui/web-components 3.1.3,
  @ionic/core 9.0.5, @stencil/core 4.45.1, @vaadin/button 25.3.0, vitest 5.0.2,
  playwright 1.63.0, axe-core 4.13.0, @web/test-runner 1.0.0,
  @custom-elements-manifest/analyzer 0.11.0, @wc-toolkit/jsx-types 1.8.2,
  @floating-ui/dom 1.8.0, @storybook/web-components-vite 10.6.0, @astrojs/starlight 0.42.4,
  @11ty/eleventy 3.1.6.

**Frameworks and tooling**

- Lit (via Context7 `/websites/lit_dev`): https://lit.dev/docs/ssr/overview/ ;
  https://lit.dev/docs/ssr/client-usage/ ; https://lit.dev/docs/ssr/authoring/ ;
  https://lit.dev/docs/components/shadow-dom/ ;
  https://www.npmjs.com/package/@lit-labs/scoped-registry-mixin
- React 19: https://react.dev/blog/2024/12/05/react-19 ;
  https://custom-elements-everywhere.com/ ;
  https://github.com/facebook/react/issues/29659
- Custom Elements Manifest: https://custom-elements-manifest.open-wc.org/analyzer/getting-started/ ;
  https://github.com/wc-toolkit ;
  https://daverupert.com/2025/10/custom-elements-manifest-killer-feature/
- Vitest browser mode: https://vitest.dev/guide/browser/ ;
  https://vitest.dev/guide/browser/component-testing

**Local**

- `/home/user/tecton-astryx-wc/docs/plan/PROJECT-BRIEF.md`, `IMPLEMENTATION-PLAN.md` §5, 7, 8, 10.
- `/home/user/rpkapps/tecton-webcomponents/docs/RESEARCH.md`, `CONVENTIONS.md`,
  `REVIEW-modern-web-guidance.md`; `packages/wc/src/internal/` (`define.ts`,
  `tecton-element.ts`, `form-control.ts`, `aria.ts`, `popup.ts`, `dismiss.ts`).
- `/home/user/refs/astryx/packages/core/src/Layer/` (`useLayer.tsx`, `layerHost.ts`,
  `anchorName.ts`, `layerStack.ts`), `serverSafeComponents.test.ts`.

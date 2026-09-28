# Astryx-compatible Web Components with a Tecton visual system

**Planning review:** September 26, 2026  
**Deliverables:** Component library and documentation  
**Excluded:** Playground product  
**Deferred:** Templates library and template-generation workflows  
**Status:** Implementation proposal informed by source/documentation review and a complete parse of the uploaded token file. This is not a completed runtime, visual, keyboard, or assistive-technology audit.

## 1. Product contract

Build a framework-independent implementation of Astryx's public component capabilities and documentation, with Tecton colors, fonts and border radii. Adopt Tecton spacing only where validated against the intended layout. Retain or improve accessibility, including predictable keyboard navigation.

This is a behavior-compatible port, not a React wrapper and not an approximate visual recreation. Preserve component anatomy, variants, state transitions, composition, responsive behavior, content guidance and public extension capabilities. Translate React-specific APIs into idiomatic custom-element attributes, properties, slots, methods, events and controllers. Document every translation.

The only intentional differences are Tecton visual tokens, approved layout-safe spacing changes, the Web Components API surface, and documented accessibility improvements. Do not drop a component because it is difficult, experimental, or resembles a template. App Shell, Chat Layout, Form Layout, Layout and similar reusable components remain included. Multi-component examples and integration fixtures also remain included; page-template distribution does not.

A component does not reach parity merely because its default appearance exists. Each applicable variant, state, interaction, form behavior, responsive presentation and documented composition must be represented and verified.

## 2. What this review established, and what it did not

### Astryx reference surface

The component catalog exposes **99 showcase entries across 11 categories**. The homepage advertises more than 170 components; neither count is a suitable final parity denominator. Public compound members and supporting APIs need separate enumeration. ContextMenu is one concrete supplemental discovery: it appears in browser-support documentation and has a component detail page, but is absent from the retrieved 99-entry catalog. [S1, S2, S7, S8]

The supplied Storybook URL returned its application shell, but its stories and index could not be extracted during this review. The `/mui/` path alone does not establish which component implementation or version it represents. Record its build separately and reconcile it with the Astryx source; do not silently substitute the MUI component catalog. Individual Astryx detail pages also returned mostly client-rendered shells, so this plan does not claim a complete prop-by-prop inspection. [S3]

Astryx's installation guide documents React 19+ and StyleX; the new core package should not carry those runtime requirements. The documentation/source organization exposes typed component documentation and reference topics that can seed the port's manifest. [S4, S5, S15]

There is version/content drift in the retrieved references. For example, the v0.5 release notes describe 30 locale catalogs, while the internationalization guide still contains an English-only statement. Preserve this as an unresolved upstream discrepancy and inspect the catalogs in the frozen source before deciding the target locale set. Do not replace a source conflict with an unsupported assumption. [S6, S9]

### Tecton upload

A complete JSON traversal of `tecton.tokens.json` found:

| Finding | Result |
| --- | --- |
| Token-bearing objects | 1,820 |
| Token types | All `color` |
| Top-level structure | `foundational.color` |
| Opaque / alpha-bearing hex colors | 1,190 / 630 |
| `onDark` / `onLight` / unscoped token paths | 814 / 796 / 210 |
| Alias references | None |
| Font, typography, radius, spacing tokens | Not supplied |
| Semantic role-to-palette layer | Not supplied |

The file explicitly names hot-pink focus-outline colors: `#ff00aa` for `onLight` and `#ff52a8` for `onDark`. That supports a proposed focus-color mapping, not an assumption that those colors pass contrast against every component surface. The accompanying audit JSON records the source SHA-256, counts and importer concerns. [F1]

**Missing inputs are not blockers to architecture or behavior work, but they are blockers to final Tecton-theme sign-off.** Obtain the authoritative font families, available weights and metrics, font delivery assets/source, border-radius scale, spacing scale, and semantic color-role assignments. Until supplied, any temporary Astryx geometry or typography must be explicitly labeled provisional—not presented as Tecton.

## 3. Freeze an auditable parity manifest

Establish a versioned baseline before production component implementation. Snapshot the exact Astryx release and commit, the documentation revision, the supplied Storybook build, and the token-file hash. Source revisions found in this planning review are evidence, not an approved release baseline.

Create the inventory from the union of the two requested reference surfaces, supplemented by the public package exports, typed component docs, public subcomponents, providers and documented utilities required to use them. Record stable and experimental components separately without silently excluding either. Inspect exposed extension packages, including chart/editor packages where relevant to the reference surface; do not count a package as excluded simply because it is outside `core`.

The seed file provided with this plan deliberately sets `complete: false`. It contains all 99 observed catalog entries, known supplemental discoveries and fields requiring expansion. Null requirements mean unknown—not not-applicable or complete.

Each required capability should have:

- Stable requirement ID; upstream package, export, release/commit, docs section and story IDs; evidence status.
- Variants, sizes/densities, states, anatomy, public subcomponents, composition and responsive conditions.
- Upstream API to attributes/properties/slots/events/methods/controller mapping, including defaults and event timing.
- Form, accessibility, keyboard, locale, theme and browser obligations.
- Implementation owner, dependency links, test IDs, documentation status, approved differences and verification result.

Maintain separate coverage figures for component/API, behavior, documentation, theming, keyboard and accessibility. Compute verified required capabilities divided by all required capabilities in the approved manifest. A waived gap remains a disclosed gap; it cannot produce an unqualified full-parity claim. Only the authorized exclusions and approved equivalent substitutions leave the denominator.

When sources disagree, open a discrepancy record with both observations. Use current approved upstream specifications where available, but verify their status against the frozen release. Reconcile implementation, stories and docs explicitly; never copy a known accessibility defect simply because it exists upstream.

## 4. Seed catalog, preserving Astryx's organization

The following is the retrieved catalog, not the full exported API inventory. [S1]

| Category | Catalog entries |
| --- | --- |
| Action (10) | Button; Button Group; Dropdown Menu; Icon Button; Link; More Menu; Segmented Control; Toggle Button; Toggle Button Group; Toolbar |
| Chat (6) | Chat Composer; Chat Layout; Chat Message; Chat Message Metadata; Chat System Message; Chat Tool Calls |
| Container (5) | Card; Carousel; Clickable Card; Collapsible; Selectable Card |
| Content (15) | Avatar; Avatar Group; Blockquote; Citation; Code; Code Block; Empty State; Heading; Icon; Kbd; Markdown; Text; Thumbnail; Timestamp; Token |
| Feedback & Status (6) | Badge; Banner; Progress Bar; Skeleton; Spinner; Status Dot |
| Form Controls (21) | Calendar; Checkbox Input; Complex Selector; Date Input; Date Range Input; Date Time Input; Field; File Input; Multi Selector; Number Input; Power Search; Radio List; Selector; Slider; Switch; Text Area; Text Input; Time Input; Tokenizer; Typeahead; Typeahead Item |
| Layout (10) | App Shell; Aspect Ratio; Divider; Form Layout; Grid; Layout; Resize Handle; Scrollable Area; Section; Stack |
| Navigation (10) | Breadcrumbs; Outline; Pagination; Side Nav; Stepper; Tab List; Top Nav; Top Nav Mega Menu; Top Nav Mega Menu Featured Card; Top Nav Menu |
| Overlay (10) | Bottom Sheet; Bottom Sheet Switcher; Command Palette; Dialog; Hover Card; Lightbox; Overlay; Popover; Toast; Tooltip |
| Table & List (5) | List; Metadata List; Overflow List; Table; Tree List |
| Utility (1) | VisuallyHidden |

Public children, plugins, layout helpers, context/provider capabilities and supplemental discoveries must be added. Examples already observed include ContextMenu, CheckboxList, Step, VStack, Theme and InternationalizationProvider. These are not substitutes for a full export scan. [S4, S6, S8, S9, S14]

## 5. Recommended implementation architecture

### Core technology and package boundaries

Use **Lit + TypeScript**, standard custom elements, CSS custom properties and native HTML semantics. Lit supplies a standard Web Components model with reactive rendering and scoped styles; framework consumers should not need a React runtime or a knowledge of Lit templates. This technology choice is a recommendation, not a requirement found in the user's sources. [S10]

Suggested structure; package names and `tct-` prefix are provisional:

```text
packages/
  tokens/              original inputs, normalization, semantic bindings, theme CSS
  primitives/          focus, overlays, collections, form, locale and announcement logic
  components/          public custom elements and documented subcomponents
  metadata/            element manifest, behavior contracts, docs and migration maps
  adapters/            thin host-framework integration where required by consumers
apps/
  docs/                documentation rendered with the new components
  storybook/           development examples and verification fixtures
  integration/         realistic composition and browser/form test harnesses
```

Keep CSS generation independent of the component runtime. Publish per-component imports, an explicit registration entry point, TypeScript declarations and versioned theme/metadata assets. Avoid pulling the whole library, every locale or all foundational palettes into a button import. Test registration collisions, pre-upgrade property assignment, reconnect behavior and server import safety. Validate server rendering/hydration in an early vertical slice rather than assuming a React SSR implementation transfers unchanged.

### Public Web Components contract

Map scalar configuration to attributes/properties, structured data and callbacks to typed properties, children/rendered content to slots or documented renderer interfaces, and notifications to DOM events. Specify which events bubble, cross shadow boundaries, are cancelable, and report user intent versus committed state. Prevent duplicate native-plus-custom event notifications. Lit documents the distinction between bubbling and crossing shadow boundaries. [S11]

For every interactive component, define externally owned versus internally owned state. Property updates must not generate feedback loops. Specify initial/default state, reset behavior, controlled updates, removal/reinsertion, asynchronous loading and cancellation. Keep native link semantics and button activation semantics where applicable rather than implementing every interactive surface as a generic role-bearing element.

Preserve developer capabilities, not JSX syntax. Maintain a mapping table for every upstream public prop, slot/render hook, method, event and extension point. APIs with no Web Components analogue need an explicit equivalent design, not an omission.

### Shadow DOM is a component-level decision

Use open Shadow DOM for encapsulated controls when it preserves composition and accessibility. Do not impose it on all components. Native tables, rich content and collections may be better implemented with carefully scoped light DOM or shared semantic ownership.

Prototype accessible naming and relationships before standardizing a component base class. Test external labels, descriptions, errors, slotted rich labels, `aria-controls`, active-descendant references, IDs, nested elements and accessible-tree output. Do not assume string ID references cross arbitrary shadow roots or that `delegatesFocus` solves labeling. Choose a verified same-root/native/ElementInternals arrangement for each semantic pattern. Lit's Shadow DOM guidance and the HTML custom-elements standard are implementation references, not proof of assistive-technology interoperability. [S12, S13]

### Shared primitives

Build shared controllers for logical focus order, roving tabindex, active descendants, typeahead, RTL-aware collection movement, IME protection, form association, stable IDs, announcements, locale resolution and asynchronous state.

Build one hierarchical overlay manager. It owns parent/child layers, topmost Escape handling, pointer dismissal, modal inertness, scroll locking, initial focus, return focus and cleanup. Handle native dismissal events without triggering a second close or reopening on the same gesture. Preserve theme, direction and locale for layers rendered outside their originating DOM scope. Native top-layer placement and DOM reparenting are different operations; test the actual strategy.

Use platform dialog/popover capabilities where the chosen browser matrix and semantics support them. Feature-detect anchor positioning and provide a measured-positioning fallback for supported browsers that need it. Astryx explicitly documents degraded positioning in a lower supported tier; retaining correct placement is a useful proposed improvement, not a claim that upstream keyboard navigation is defective. [S7]

### Native form integration

For each input family, choose a verified native-control or form-associated custom-element strategy. ElementInternals provides the platform hooks for custom-element form values and validity; implementation still needs a complete form contract. [S13]

Test `name`, value serialization, repeated names/multi-values, form association, `FormData`, required/invalid state, reset, disabled fieldsets, read-only behavior, browser restoration, autocomplete, focus on invalid fields and label activation. Cover Enter submission, submitter semantics and validation ordering explicitly. An internal shadow-root button does not justify assuming outer-form submission is already correct. Keep date/time storage, locale display and timezone responsibilities distinct.

## 6. Tecton theming without layout regression

### Three-layer token model

```text
Immutable Tecton source primitives
  -> approved semantic roles for each color mode
  -> component roles, dimensions and state tokens
```

Do not directly scatter palette paths or hex literals throughout component styles. Generate a deterministic source-path-to-CSS-name manifest, semantic theme CSS and typed token metadata. Preserve original identifiers and metadata. Detect normalization collisions, unresolved references, missing mode mappings and accidental drift in generated outputs.

The upload includes keys containing punctuation and nodes such as `shades.white` that carry both a value and nested transparent tokens. Normalize into the build tool's supported schema without dropping those descendants. Preserve Figma publishing metadata; decide public token exposure separately from source preservation. The token export resembles a design-token interchange structure, but this plan does not assume it is already valid for every DTCG compiler. [F1]

### Semantic bindings

Map all upstream roles: body/surface/card/popover backgrounds; primary/secondary/disabled text and icons; action and on-action colors; success/warning/error/info states; borders; focus; selection; hover/pressed overlays; skeletons; tracks; shadows; syntax and categorical colors where used. Astryx's token reference is an inventory input, not the new palette. [S16]

Do not guess that a particular Tecton hue is the primary accent. Only the focus-outline naming supplies an explicit role in the provided data. Obtain semantic assignments or approve a clearly marked proposed mapping. Preserve alpha colors and calculate contrast after compositing on actual backgrounds. Token numbers are identifiers, not measured contrast ratios.

### Typography and radius

Apply the authoritative Tecton font families and border-radius mappings when supplied. Confirm required weights, italics, numeral behavior, fallback metrics, line heights, letter spacing and font-load behavior. Decide whether “fonts” also changes the type-size scale; do not silently replace all control metrics without a mapping. Font changes must trigger geometry regression tests even when spacing is unchanged.

Retain each component's anatomy: a pill, circular avatar, nested card and connected button group need role-aware radii, not a single radius replacement. Record special cases explicitly. Radius changes remain Tecton-driven; spacing exceptions are not a blanket permission to keep old branding.

### Layout-safe spacing policy

Start from a measured Astryx structural baseline. Apply Tecton spacing first to low-risk gaps and padding, then review dense controls, table rows, list virtualization, calendar cells, tabs, toolbar overflow, popover anchors and bottom-sheet geometry individually. Preserve size relationships, hit targets, alignment, content access and documented responsive behavior.

Accept a change only when representative content, all required states, long/localized labels, narrow containers, zoom and font loading show no new clipping, overlap, inaccessible overflow or unusable interaction. When wrapping is intentional, document it rather than treating every pixel difference as a failure.

Maintain `spacing-exceptions` records with component/variant, original value, attempted Tecton value, retained value, reason, evidence and owner. Use named compatibility tokens rather than hardcoded one-off patches. Preserve motion/easing, breakpoints, elevation and interaction geometry unless the requested token changes require a reviewed adjustment; these were not requested as wholesale redesign axes.

Keep an upstream-like verification theme for separating implementation defects from intended rebranding, and an approved Tecton regression baseline for shipping. Do not hide all visual differences with broad screenshot masks.

## 7. Accessibility and keyboard standard

Target **WCAG 2.2 AA for the library's documented examples and supported compositions**, plus at least the verified upstream behavior. Use the WAI-ARIA APG for pattern-specific implementation guidance; APG patterns are not themselves a WCAG certification. Product authors retain responsibilities for page content, workflow and correct composition. [S17, S18]

Source review shows recent Astryx improvements already cover a shared Escape stack, IME-safe input, grouped keyboard navigation and several focus behaviors. Preserve these rather than labeling them absent. Build the improvement backlog from reproducible gaps in the chosen baseline. [S6, S19]

### Proposed keyboard contracts

| Family | Contract and validation target |
| --- | --- |
| Buttons, links and clickable cards | Native activation expectations; no duplicate host/internal tab stops; nested actions remain independently usable; visible focus; disabled behavior distinguishes disabled from read-only. |
| Toolbar, Button Group, Segmented Control | Use the correct toolbar/group/radio/tab semantics for the actual purpose. Where composite navigation applies, use one entry tab stop, predictable arrows and appropriate Home/End behavior. Disabled-item behavior is pattern-specific, not a universal skip rule. |
| Tabs and navigation | For actual tab panels: arrows, Home/End, correct panel relationships and manual activation when panel loading would make automatic activation disruptive. Route links remain links; do not label every navigation strip as a tablist. |
| Selector, Typeahead, Multi Selector | Define editable versus select-only behavior, opening, active option, selection commitment, Escape and Tab. Preserve text-editing shortcuts and IME composition. Announce loading, result counts, empty states and selection changes without duplicate speech. |
| Dropdown, More and Context menus | Keyboard opening, typeahead, arrows, submenu movement, cancellation and focus return. Test Shift+F10/context-menu-key access where a context menu is exposed. |
| Dialogs, sheets and popovers | Correct initial focus, modal containment only where appropriate, one Escape per active layer, reliable return focus, and a documented safe path through non-dismissible flows. A nested layer must not close its parent accidentally. |
| Calendar/date/time controls | Keyboard access to dates, periods and time choices; unavailable-date semantics; locale-aware announcements; manual-entry and validation behavior matching the source contract. |
| Table, lists and trees | Preserve native reading/navigation for static tables. Add grid-style arrow navigation only for a true interactive grid. Verify tree expansion, selection, row actions and focus recovery when data is filtered or virtualized. |
| Resize, drag, sliders and carousel | Equivalent keyboard operation plus a single-pointer non-drag alternative where required. Keep handles discoverable, values announced and focused items visible. |
| Chat, Markdown and code | No focus theft during streaming or tool updates; operable actions and attachments; announced status without token-by-token speech flooding; input composition must not accidentally send a message. |

The tabs, combobox and dialog patterns provide specific starting contracts. Review every variant rather than treating this table as a universal keyboard handler. [S20, S21, S22]

### Visual and assistive requirements

Verify text contrast (normally 4.5:1, with the large-text exception), applicable non-text contrast (3:1), color-independent state cues, visible/unobscured focus, 200% text resizing, reflow at the relevant 400% zoom/320 CSS-pixel condition and text-spacing overrides. Preserve legitimate two-dimensional content exceptions while keeping its controls usable. Meet applicable 24-by-24 CSS-pixel target-size requirements or a valid exception; aim for larger touch targets where they do not compromise the component contract. A 2 CSS-pixel focus outline is a proposed house rule; do not misstate the AAA Focus Appearance criterion as AA. Test forced colors and reduced motion. [S17]

Run manual assistive tests for NVDA with Chrome/Firefox on Windows, JAWS with a supported Windows browser, VoiceOver with Safari on macOS/iOS, and TalkBack with Chrome on Android as applicable to the agreed matrix. Record exact versions and results. Automated accessibility scanners do not establish complete accessibility. [S23]

Track upstream version, reproduction, environment, observed behavior, expected contract, planned change, test IDs and documentation for every proposed improvement. This planning review has not established live keyboard defects.

## 8. Documentation parity

Inventory every source docs topic and section; maintain a source-to-target route/section mapping. Reimplement consumer guidance using Web Components conventions rather than copying React-only snippets. Keep original conceptual organization and terminology where useful, and explain renamed APIs.

Cover getting started, installation, browser support, principles, colors, typography, spacing/layout, radii, elevation, motion, icons/illustrations, theming, internationalization, accessibility, styling/extension, migration and all component references. Preserve documented authoring/integration and agent-readable reference capabilities where they form part of the requested docs surface. A template-specific workflow is marked deferred; a component composition example is not. Do not add unrelated scaffolding products to the critical path, and do not silently remove source documentation because its original delivery channel was a CLI. [S4, S5, S15, S16]

Every component page should explain purpose, alternatives, anatomy, variants/states, responsive behavior, runnable examples, installation, attributes/properties, methods, slots, events, styling hooks, tokens, form semantics, keyboard interactions, screen-reader expectations, localization, consumer responsibilities and differences from Astryx.

Generate the element API tables from a Custom Elements Manifest, then combine them with authored behavioral contracts and examples. A CEM alone does not capture all interaction semantics. Reuse metadata for searchable HTML, Markdown/JSON reference output and framework integration types. Test that public APIs and docs cannot drift independently. [S24]

Build the documentation interface with the new components. Include accessible search, skip links, landmarks, current-page indication, deep links, code-copy status feedback, theme/mode selection and route focus management. Audit the docs' own keyboard navigation. Storybook's Web Components support is suitable for development examples and automated fixtures; using it internally does not require shipping the excluded playground product. [S25]

## 9. Delivery phases and exit gates

Phases are dependency groups, not a reduced-scope MVP. Documentation, accessibility and testing travel with every component rather than being postponed to the last phase. Validate complex behavior early even when complete production implementation comes later.

| Phase | Work | Exit gate |
| --- | --- | --- |
| 0 — Baseline and scope | Freeze revisions; expand the seed; capture stories/docs/exports; inspect approved specs; log source conflicts, token gaps and asset provenance. | Every discovered item classified; parity denominator approved; missing inputs visible and owned. |
| 1 — Platform and risk prototypes | Repository/build, token normalization, semantic theme skeleton, element metadata, forms, overlays and focus architecture. Prototype Button + Field/Text Input + searchable Selector inside Dialog, plus a table/tree/virtualization focus case. | Cross-browser form submission/reset, naming, nested Escape, focus return, event boundaries and geometry validated for the chosen architecture. |
| 2 — Foundations and basic components | Content, layout, actions, basic feedback, basic inputs and reusable collection/overlay primitives. | Each delivered item has API/behavior/theme/docs coverage and passing component acceptance tests. |
| 3 — Selection, navigation and overlays | Advanced selectors, calendars/date/time, Tokenizer, Power Search, command/menu systems, sheets, navigation and overflow behavior. | Required keyboard, adaptive presentation, locale, nested-layer and responsive scenarios pass. |
| 4 — Data, content and advanced composition | Full Table/List/Tree capabilities and plugins; Chat family; Markdown/code; remaining complex containers; any included editor/chart/extension components. | Documented extension points and all recorded composed scenarios work, including async/error/empty/large-data cases. |
| 5 — Full docs and release hardening | Close remaining inventory; finalize Tecton metrics; run accessibility and browser matrix; audit docs; validate packages, server integration, security and performance. | No undisclosed required-capability gaps; supported matrix passes; approved differences and consumer obligations published. |

Recommended ownership: technical lead for the contracts and shared architecture; design-system engineer(s) for implementations; a Tecton design owner for semantic and geometry approval; accessibility specialist for contract and assistive testing; documentation/quality owner for source mapping and release evidence. One person may hold multiple roles, but none of these responsibilities should disappear.

**Critical path:** scope freeze -> form/focus/overlay architecture -> final typography and semantic theme -> complex component verification -> complete docs and release gates. Missing typography/radius/spacing inputs can block final theme approval without stopping earlier behavior work. Do not commit a delivery date based only on the 99 showcase cards; estimate after expanding required scenarios and measuring the prototype work.

## 10. Verification and release definition

Use unit tests for state machines/token generation, browser interaction tests for component behavior, accessibility scans, accessible-name/role assertions, visual regression, documented composition tests and manual keyboard/screen-reader sessions. Playwright is the proposed cross-browser test runner; pair its browser automation with actual Safari/mobile/assistive-device testing where required. [S23]

For each relevant component, test supported light/dark modes, sizes, densities, pointer types, all important states, LTR/RTL, locale changes, long labels, font loading/fallback, reduced motion, forced colors, narrow/wide containers and nesting. Use a deliberate combination strategy: all defined states and high-risk combinations, then pairwise coverage for the remaining dimensions—not an unbounded Cartesian product.

Candidate integration fixtures include Selector inside Dialog with Tooltip, form validation inside a sheet, table row menus with selection and resizing, responsive App Shell with nested navigation, and streaming Chat with attachments and tool calls. These are test fixtures, not deferred templates.

Protect Markdown/HTML and URL rendering, custom renderers and content slots against unsafe injection. Verify cleanup, stale async results, listener leaks, virtualized focus, layout shifts and performance on representative large datasets. Set measured bundle and interaction budgets after the prototypes; do not invent a universal budget before the target capabilities are known.

Release requires: complete in-scope API and scenario coverage; complete docs mapping; approved Tecton semantic/type/radius values and spacing exceptions; no unresolved failures of the agreed accessibility contract; all supported browser/assistive scenarios passing; per-component imports and metadata validated; and no playground/template features accidentally added to the parity denominator. Disclosed unresolved gaps mean a partial release, not “full parity.”

## 11. Immediate implementation backlog

1. **PAR-001:** Freeze the upstream release/commit, docs and supplied Storybook build; reconcile the `/mui/` reference.
2. **PAR-002:** Expand `astryx-parity-seed.json` into the authoritative exports/stories/docs/scenarios manifest.
3. **TOK-001:** Obtain missing Tecton typography, radii, spacing and semantic bindings; preserve original input files and hashes.
4. **TOK-002:** Build normalized token output with collision, schema, mode and generated-output tests.
5. **ARC-001:** Approve element/API, Shadow DOM, form, overlay/focus and browser-support architecture decisions.
6. **POC-001:** Ship the risk-validation slice into the test harness—not a production parity claim.
7. **DOC-001:** Create the component-page schema, source route mapping and metadata-driven docs shell.
8. **A11Y-001:** Establish keyboard contracts, assistive-test records and the upstream-gap ledger.

## Evidence and reference register

References support source observations or technical foundations; implementation choices and acceptance gates above are proposals.

- **F1:** User-supplied `tecton.tokens.json`; exact input hash and computed results in `tecton-token-audit.json`.
- **S1:** Astryx component catalog — https://astryx.atmeta.com/components
- **S2:** Astryx homepage — https://astryx.atmeta.com/
- **S3:** User-supplied Storybook — https://storybook-static-kappa-roan.vercel.app/mui/?path=/story/welcome--welcome
- **S4:** Getting Started — https://astryx.atmeta.com/docs/getting-started
- **S5:** Astryx CLI documentation — https://astryx.atmeta.com/docs/cli
- **S6:** Astryx v0.5.0 release article — https://astryx.atmeta.com/blog/astryx-v0-5-0
- **S7:** Browser Support — https://astryx.atmeta.com/docs/browser-support
- **S8:** ContextMenu detail header — https://astryx.atmeta.com/components/ContextMenu
- **S9:** Internationalization — https://astryx.atmeta.com/docs/internationalization
- **S10:** Lit overview — https://lit.dev/docs/
- **S11:** Lit events — https://lit.dev/docs/components/events/
- **S12:** Lit Shadow DOM — https://lit.dev/docs/components/shadow-dom/
- **S13:** HTML custom elements and form association — https://html.spec.whatwg.org/multipage/custom-elements.html
- **S14:** Group metadata, retrieved from GitHub — https://github.com/facebook/astryx/blob/main/packages/core/groups.doc.mjs
- **S15:** Reference documentation organization, retrieved from GitHub — https://github.com/facebook/astryx/blob/main/packages/cli/assets/docs/README.md
- **S16:** All Tokens — https://astryx.atmeta.com/docs/tokens
- **S17:** WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- **S18:** WAI-ARIA APG keyboard interface — https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- **S19:** Astryx v0.6.0 release article — https://astryx.atmeta.com/blog/astryx-v0-6-0
- **S20:** APG Tabs — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- **S21:** APG Combobox — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- **S22:** APG Modal Dialog — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **S23:** Playwright accessibility testing — https://playwright.dev/docs/accessibility-testing
- **S24:** Custom Elements Manifest — https://custom-elements-manifest.open-wc.org/
- **S25:** Storybook Web Components + Vite — https://storybook.js.org/docs/get-started/frameworks/web-components-vite

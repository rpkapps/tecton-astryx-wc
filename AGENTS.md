# Instructions for every agent working in this repository

`tecton-wc` is a framework-independent Web Components implementation (Lit + TypeScript) of
the upstream design system's public components and documentation (reference checkout below),
re-skinned with the Tecton visual system. Tags and events use the `tct-` prefix.

## Read first

1. `docs/plan/PROJECT-BRIEF.md` — goal, fixed owner decisions, reference material.
2. `docs/plan/DECISIONS.md` — binding decisions (D-001 … ). They override everything else.
3. `docs/ARCHITECTURE.md` — the binding architecture (decision register in §0).
4. `docs/CONVENTIONS.md` — implementer checklist, porting procedure, Definition of Done.
5. `docs/plan/WORK-BREAKDOWN.md` — your work package: scope, folders, owned core files, dependencies.

## modern-web-guidance is mandatory

For all HTML, CSS and client-side JS work (components, controllers, docs site), search and retrieve
the relevant guide **before** implementing, then check your code against it:

```sh
npx -y modern-web-guidance@latest search "<what you want to do>" --skill-version 2026_09_04-7de96777
npx -y modern-web-guidance@latest retrieve "<id>[,<id>...]" > /tmp/<name>.md   # then read the file
npx -y modern-web-guidance@latest list
```

Skill instructions: `/home/user/refs/modern-web-guidance/skills/modern-web-guidance/SKILL.md`.
If `~/.npm` is not writable, set `NPM_CONFIG_CACHE=/tmp/npm-cache`. Cite guide ids
(`[mwg:<id>]`) in `parity.json` notes or code comments where a guide drove a decision.

## Browser support policy (ARCHITECTURE §1)

- **Tier 1 (supported, CI-tested):** Chrome/Edge ≥ 137, Firefox ≥ 147, Safari/iOS ≥ 26.
- **Tier 2 (degraded, must not throw):** Chrome ≥ 116, Firefox ≥ 125, Safari ≥ 17.
- Baseline Widely available: use freely. Features present in every Tier-1 engine: use natively,
  no polyfills, but guard APIs whose absence throws through `@tecton-wc/core/features.js`.
  Features missing from any Tier-1 engine (`ariaNotify`, invoker commands, `CloseWatcher`,
  `closedby`, `moveBefore`, `hidden="until-found"`, Reference Target, scoped registries,
  `popover="hint"`, `interestfor`, anchored container queries, `field-sizing`, `scrollbar-color`,
  `contrast-color()`, Sanitizer API): progressive enhancement only, feature-detected, with the guide's
  fallback. Never: `:host-context()`, customized built-ins, runtime CSS module scripts, `overlay` for
  exit animations.

## Dependencies and licences

- **No external library is added without owner approval** (D-007). The approved list and the pending
  proposals are in ARCHITECTURE §19. Work packages never edit `package.json` files or
  `pnpm-lock.yaml`; WP-F declares every approved dependency up front.
- Non-lit runtime dependencies are used only through their boundary modules in `packages/core`
  (`layer/floating.ts`, `i18n/format.ts`, `date/`, `security/sanitize.ts`).
- Any newly proposed dependency needs a licence check (package + transitive tree against the
  allowlist in ARCHITECTURE §18.6) before it goes to the owner.
- The library itself is unlicensed (D-008): no LICENSE file; every `package.json` is
  `"private": true, "license": "UNLICENSED"`; nothing is published. Keep `THIRD-PARTY-NOTICES.md`
  current, including the upstream (MIT) attribution for adapted code and docs.

## Layout

```text
packages/tokens      @tecton-wc/tokens      token inputs → tokens.css, palette.css, fonts.css, metadata
packages/core        @tecton-wc/core        base class, define, events, context, controllers, mixins, i18n
packages/icons       @tecton-wc/icons       icon data (default set = upstream role names on Lucide)
packages/locales     @tecton-wc/locales     30 upstream catalogs + pseudo
packages/components  @tecton-wc/components  src/<folder>/ per component family (ARCHITECTURE §4)
packages/testing     @tecton-wc/testing     fixtures, a11y helpers, standard suites
packages/cli         @tecton-wc/cli         the tct command (agent docs, search, layout, init/upgrade) and MCP server
apps/docs            Astro + Starlight docs site
tools/               generators, checks, Vite/ESLint/Stylelint/CEM plugins
docs/                plan/, research/, ARCHITECTURE.md, CONVENTIONS.md
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | install (never change the lockfile in a work package) |
| `pnpm generate` | regenerate every derived artifact (runs automatically before test/build/docs/check) |
| `pnpm test` / `pnpm test packages/components/src/<folder>` | Vitest browser (Chromium) + node tests |
| `pnpm lint` / `pnpm lint:css` / `pnpm typecheck` | ESLint / Stylelint / `tsc -b` |
| `pnpm api:update` / `pnpm api:check` | per-folder API snapshots |
| `pnpm parity` / `pnpm parity:check` | parity report / schema + coverage rules |
| `pnpm tokens:check`, `pnpm size`, `pnpm licenses:check` | token drift, size budgets, licence allowlist |
| `pnpm examples:check` | examples use layout components, no hand-written layout/surface CSS (CONVENTIONS §7) |
| `pnpm docs:dev` / `pnpm docs:build` / `pnpm docs:a11y` | docs site |
| **`pnpm check`** | everything above in order; must pass before hand-off |

Environment: Node 22, pnpm 10. Only Chromium is installed locally (`/opt/pw-browsers/chromium`,
Chromium 141, `PLAYWRIGHT_BROWSERS_PATH` set); the test config passes it as `executablePath`.
**Never run `playwright install` locally.** CI also runs Firefox and WebKit.

**Browser for tests on your own machine (Windows, macOS, Linux):** the browser tests and the docs
accessibility crawl use `CHROMIUM_PATH` when it is set, so an installed Chrome or Edge (137 or newer)
works without downloading Playwright's build. Windows PowerShell:
`$env:CHROMIUM_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"` (Edge:
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`); `setx CHROMIUM_PATH "<path>"` keeps
it. Clones made before `.gitattributes` existed have CRLF files: run `git rm -r --cached -q .` then
`git reset --hard` once (discards uncommitted changes) to check everything out with LF.

## Naming (D-015)

Nothing that ships or renders names the upstream design system. Use `@tecton-wc/*` for packages and
imports, `@tct.<namespace>.<key>` for message ids (the locales generator maps the upstream catalogs;
they stay byte-identical), `/vendor/tecton-wc/` in guides, and the token statuses `tecton-binding` and
`retained-default`. In docs, JSDoc (it feeds the manifest), CSS descriptions and user-facing strings say
"upstream", never the design system's name; `parity.json`, tests, planning docs and non-doc code comments
may keep neutral upstream references. `pnpm docs:public-check` is absolute: it scans generated pages,
`llms.txt`, the registry, the Custom Elements Manifest, every `package.json` and `dist/`, and fails on any
mention (authored guides are still only reported).

**After merging the rename into a branch, run `node tools/codemods/d015-rename.ts`** (add `--dry-run` to
preview). It rewrites the old package scope, message ids, vendor path and token status ids in the files
your branch added, skips the upstream catalogs, `docs/plan/` and `docs/research/`, is idempotent, and
prints what it changed. Then `pnpm install --offline` (workspace-only lockfile change) and `pnpm check`.

## Generated files

Never edit or commit generated files: `**/generated/**`, `**/dist/**`, `custom-elements.json`,
generated docs pages under `apps/docs/src/content/docs/components/`, `reports/**`. They come from
`pnpm generate` (ARCHITECTURE §3). The only committed derived files are API guards:
`packages/components/src/<folder>/__snapshots__/api.json` and
`packages/tokens/snapshots/token-names.json` — update them with their scripts, never by hand.

## Parallel worktree rules

- One work package = one branch `wp/<id>-<slug>` in its own worktree, based on current `main`.
- Edit only your component folders, the `packages/core/src/…` files your work package is assigned,
  new event files in `packages/core/src/events/` (reuse an existing class if one fits), and docs pages
  assigned to you.
- Adding a component never requires editing a shared file: exports maps use wildcards; barrels,
  autoloader map, CEM, docs navigation, test discovery and the parity report are generated from folders.
- Need a change in a shared file (configs, `tools/`, shared styles, tokens, another package's folder)?
  Record it in your folder's `parity.json` `requests` (and `tokenRequests` for tokens) and in your
  hand-off report. The orchestrator applies it.
- Render other `tct-*` elements inside your shadow roots only if they come from WP-F or an already
  merged work package.
- Rebase onto `main` and run `pnpm check` before hand-off. Do not commit or push unless your task says
  so. Hand-off report format: CONVENTIONS §10.

## Reference material (read-only — never modify)

- `/home/user/refs/astryx` — upstream Astryx at `ca632c6` (behavioural source of truth).
- `/home/user/rpkapps/tecton-astryx` — owner's React Tecton theme (bindings, per-component overrides).
- `/home/user/rpkapps/tecton-webcomponents` — owner's earlier WC project (lessons, internals).
- `/home/user/refs/modern-web-guidance` — the guidance skill.

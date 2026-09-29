# tecton-wc

A framework-independent Web Components implementation (Lit + TypeScript) of the public components and
documentation of an MIT-licensed upstream design system, re-skinned with the Tecton visual system
(colours, fonts, radii). Tags and events use the `tct-` prefix. Packages are `@tecton-wc/*`.

Status: 166 of the 184 core upstream components are implemented, with their docs pages, examples and
tests; the extension tier is not started (`pnpm parity` writes the current report to
`reports/parity.md`). The library is private and unlicensed for now (all rights reserved); nothing is
published. Third-party and upstream (MIT) notices are in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## Requirements

- Node 22 (22.18 or newer, for native TypeScript type stripping) and pnpm 10 (`corepack enable`).
- A browser only for the commands that run one (`pnpm test`, `pnpm build:smoke`, `pnpm docs:a11y`,
  `pnpm check`). Point `CHROMIUM_PATH` at an installed Chrome or Edge 137 or newer, for example in
  PowerShell `$env:CHROMIUM_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"`
  (`setx CHROMIUM_PATH "<path>"` keeps it). Without it, `/opt/pw-browsers/chromium` is used when present.
  Never run `playwright install` locally; CI installs its own browsers. Installing, building and
  previewing the docs need no browser.

## Getting started

```sh
pnpm install --frozen-lockfile
pnpm dev            # docs site with live reload while you edit (http://localhost:4321)
pnpm preview        # build the docs site and serve it as deployed, /mcp included (Ctrl+C stops it)
pnpm build          # build every package into its dist/ (Node only)
pnpm check          # everything CI runs for Chromium, stops at the first failure
```

`pnpm preview --no-build` serves the last build without rebuilding; `--port <n>` and `--host <address>`
change where it listens (`--host 0.0.0.0` to open it from another device).

## Commands

| Command                                     | Purpose                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm generate`                             | regenerate every derived artifact (runs automatically before most commands) |
| `pnpm test` / `pnpm test <path>`            | Vitest: browser (Chromium) + node projects                                  |
| `pnpm lint` / `pnpm lint:css`               | ESLint (with the in-house `tct` plugin) / Stylelint                         |
| `pnpm format` / `pnpm format:check`         | Prettier                                                                    |
| `pnpm typecheck`                            | `tsc -b` over all packages, plus the tools                                  |
| `pnpm tokens:check`                         | token drift, contrast and coverage checks                                   |
| `pnpm api:update` / `pnpm api:check`        | per-folder public-API snapshots                                             |
| `pnpm parity` / `pnpm parity:check`         | parity report / schema and coverage rules for every `parity.json`           |
| `pnpm size`                                 | size-limit budgets                                                          |
| `pnpm licenses:check`                       | licence allowlist and third-party notices                                   |
| `pnpm build`                                | package and CDN builds                                                      |
| `pnpm build:smoke`                          | loads the built CDN bundle in Chromium (needs a browser; `build` does not)  |
| `pnpm dev` (`docs:dev`) / `docs:build` / `docs:a11y` | docs site: live-reload dev server / static build / accessibility crawl |
| `pnpm preview` (`docs:preview`)             | builds the docs site and serves it at http://localhost:4321 (`--no-build` reuses the last build) |
| `pnpm docs:mcp`                             | the built site's live `/mcp` endpoint, over HTTP with the MCP SDK client    |
| `pnpm check`                                | every check and build above, in order (not `dev` or `preview`)              |

Commands that belong to later milestones print a `skip:` message until their inputs exist.
`TCT_BROWSERS=chromium,firefox,webkit` selects the browser engines for `pnpm test`; `TCT_TIER2=1` runs the
Tier-2 (features forced off) emulation.

## Layout

```text
packages/tokens      design tokens and fonts
packages/core        headless runtime: base class, events, context, controllers, i18n
packages/icons       icon sets (default: upstream role names mapped to Lucide)
packages/locales     the 30 upstream message catalogs
packages/components  every tct-* element, one folder per component family
packages/testing     test utilities and standard suites
apps/docs            Astro + Starlight documentation site
tools/               generators, checks, Vite plugin, ESLint and Stylelint plugins
docs/                plan, research, architecture and conventions
```

## Documentation

- [`AGENTS.md`](AGENTS.md): rules for everyone (and every agent) working in this repository.
- [`docs/plan/PROJECT-BRIEF.md`](docs/plan/PROJECT-BRIEF.md) and [`docs/plan/DECISIONS.md`](docs/plan/DECISIONS.md):
  goal and binding decisions.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): the binding architecture.
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md): implementer checklist, porting procedure, Definition of Done.
- [`docs/plan/WORK-BREAKDOWN.md`](docs/plan/WORK-BREAKDOWN.md): work packages and milestones.

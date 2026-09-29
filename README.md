# tecton-wc

A framework-independent Web Components implementation (Lit + TypeScript) of the public components and
documentation of an MIT-licensed upstream design system, re-skinned with the Tecton visual system
(colours, fonts, radii). Tags and events use the `tct-` prefix. Packages are `@tecton-wc/*`.

Status: foundation work in progress (workspace, tooling and CI are in place; tokens, core runtime, test
harness, the vertical-slice components and the docs site follow). The library is private and unlicensed
for now (all rights reserved); nothing is published. Third-party and upstream (MIT) notices are in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## Requirements

- Node 22 (22.18 or newer, for native TypeScript type stripping) and pnpm 10 (`corepack enable`).
- Locally, tests use the Chromium at `/opt/pw-browsers/chromium` (or `$CHROMIUM_PATH`). Never run
  `playwright install` locally; CI installs its own browsers.

## Getting started

```sh
pnpm install --frozen-lockfile
pnpm check          # everything CI runs for Chromium, stops at the first failure
```

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
| `pnpm docs:dev` / `docs:build` / `docs:a11y` | documentation site                                                          |
| `pnpm check`                                | all of the above, in order                                                  |

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

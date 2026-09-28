# Project brief (read this first — every agent)

**Goal.** Build a framework-independent Web Components implementation of the Astryx design
system's public component capabilities and documentation, re-skinned with the Tecton visual
system (colors, fonts, border radii). Full product contract: `docs/plan/IMPLEMENTATION-PLAN.md`.

## Fixed decisions from the product owner

- **Fonts:** Figtree (UI text) and IBM Plex Mono (code / measured / tabular text).
- **Stack (from the plan, accepted):** Lit + TypeScript, standard custom elements, CSS custom
  properties, native HTML semantics. Excluded: playground product. Deferred: templates library.
- **Modern web guidance is mandatory** for all HTML/CSS/client-side JS work. Before implementing
  a feature, search and retrieve the relevant guide, then check your code against it:

  ```sh
  npx -y modern-web-guidance@latest search "<what you want to do>" --skill-version 2026_09_04-7de96777
  npx -y modern-web-guidance@latest retrieve "<id>[,<id>...]" > /tmp/<name>.md   # then read the file
  npx -y modern-web-guidance@latest list
  ```

  Skill instructions: `/home/user/refs/modern-web-guidance/skills/modern-web-guidance/SKILL.md`.
  Default browser policy (from the skill): Baseline *Widely available* features need no fallback;
  *Newly available* / non-Baseline features must follow the guide's fallback or be
  feature-detected and degrade gracefully.

## Reference material on disk (read-only — never modify these)

| Path | What it is |
| --- | --- |
| `/home/user/refs/astryx` | Upstream Astryx source (facebook/astryx, main @ `ca632c6594b03aa3933ce9b35d1f6128fbad7a47`, 2026-09-28). `packages/core/src/<Component>/` holds each React component, its docs (`*.doc.mjs`/mdx), stories and tests. `docs/` and `apps/` hold the doc site. This is the behavioral source of truth. |
| `/home/user/rpkapps/tecton-astryx` | Owner's earlier **React** project: Astryx re-themed as Tecton. `packages/react/src/theme/` (semantic.ts, typography.ts, components.ts, tokens.ts, localTokens.ts, icons.ts, palette.generated.ts) holds already-worked-out Tecton semantic color roles, type scale, radii (`--radius-inner` 2px, `--radius-element` 4px, `--radius-container` 8px, `--radius-full`) and per-component overrides. `design/` holds Tecton component design specs; `docs/design/` fidelity and theme audits. **This is the best available source for Tecton decisions.** |
| `/home/user/rpkapps/tecton-webcomponents` | Owner's earlier **Web Components** project (Lit, `tec-` prefix, its own component set, not Astryx-compatible). `docs/RESEARCH.md`, `docs/CONVENTIONS.md`, `docs/REVIEW-modern-web-guidance.md` are lessons learned; `packages/wc/src/internal` has reusable ideas. Reuse ideas, not wholesale code. |
| `.../tecton-webcomponents/packages/wc/tokens/tecton.tokens.json` | The Tecton token file (sha256 `4731ddd0…367f3`, identical to `tecton-astryx/tokens/tecton.tokens.json`). 1,820 color tokens, `foundational.color`, onLight/onDark. |
| `/home/user/refs/modern-web-guidance` | The modern-web-guidance skill (Google Chrome). |

## Environment facts

- Node 22, pnpm 10.33 available. Only Chromium is installed (`/opt/pw-browsers`,
  `PLAYWRIGHT_BROWSERS_PATH` set) — never run `playwright install`.
- Repo: `/home/user/tecton-astryx-wc`. Do not commit or push unless your task says so.

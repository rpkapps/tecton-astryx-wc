# Orchestrator state (live working notes; the orchestrator keeps this current)

Integration branch: `claude/lucid-noether-86bwd4` (main checkout `/home/user/tecton-astryx-wc`).
Merge protocol:
1. Review the diff.
2. `git merge --no-ff <sha|branch>`.
3. `set -o pipefail; pnpm check` must pass on the merged tree.
4. Push.
5. Tell the dependent streams to `git merge claude/lucid-noether-86bwd4`.
6. Remove the worktree when a stream is finished.

Orchestrator review probes: `packages/testing/src/core/orchestrator-probes.test.ts` (committed). The
temporary button probes are at `<scratchpad>/button-probes.test.ts`. To run them, copy them into
`packages/components/src/zz-orch/`, run them, then delete that folder.

## Running streams (Sonnet, one worktree each under `.claude/worktrees/agent-<id>`)

Machine: 4 cores, shared. Keep about 7 concurrent engineers at most.

| Stream | Agent id | Status |
| --- | --- | --- |
| WP-8 layout and app frame | a627274cd9f0fda52 | Running. Told about the rename, codemod and typed-host rule. |
| WP-9 chat messages | a4474048d684578af | Running. Told the same. |
| WP-11 selectors and pagination | abea70a11591a3e22 | Running. |
| WP-15 table | ad313baf75515edcf | Running. |
| WP-AI (`@tecton-wc/cli`, MCP, guides) | ad1cc289aef6c2d4d | Running. Authorised to add `@modelcontextprotocol/sdk` 1.31.0 (D-013). |
| Examples migration C (overlay, popover, toast, tooltip, progress-bar, skeleton, status-dot, timer, toolbar) + hover-card test timing | a082276d3e2201244 | Running. |
| Examples migration D (segmented-control, size-provider, spinner, text, text-input, theme, toggle-button, tree-list, visually-hidden) + the slotted-native-input bug in `tct-field` | a4eb5bd7d8fe8730e | Running. |

Merged: WP-F, WP-1 to WP-7, WP-D reconciliation, the D-015 rename, wave-1 fix-ups, and examples migrations A and B.
After migrations C and D merge, add `examples:check` to the `pnpm check` STEPS.

Root-cause fixes made by the orchestrator (do not regress):
- Typed lint: `tct/typed-host-controller`. Fields initialised with `new X(this, …)` are annotated, which
  fixes the circular-inference `any`. Typecheck runs before lint.
- docs:a11y waits for scroll-region state (example previews and Expressive Code blocks) instead of a fixed delay.
- Subprocess and module-loading tests have realistic timeouts. Clicking a disabled control uses `force`.
- `examples:check` sets `exitCode`, so a large report is not truncated.

Follow-ups (unassigned):
- `tct-theme` `theme` property: wire it to a `DefinedTheme`.
- `generateThemeCSS` uses `@scope` with no fallback; `@scope` is not native in every Tier-1 engine (D-014).
- Core requests from WP-6: a `clamp` option in `layer/position.ts` (menus use an `!important` override
  until then), and a `renderIndicator` helper in the indicator registry.
- The WP-7 checkbox toggles when its description is clicked; check this against upstream.
- `--font-size-adjust-*` tokens are unused, and the `data-tct-unstyled` opt-out is unimplemented (both from the WP-D report).
- WP-7 parity requests: global attributes as parity targets (`tools/lib/parity.ts`).
- Size budgets: form controls and menus are 70–82 kB. Tackle in the performance WP (lazy ICU parser).

## Orchestrator queue (in order)

1. Wave 3 as capacity frees: WP-10 (3, 4, 6), WP-12 (4, 5, 7), WP-13 (3, 4, 7), WP-14 (4, 8; after WP-8),
   WP-16 (2, 4, 9; after WP-9). Then wave 4: WP-17 (after 15), WP-18 (after 11, 12, 13, 15), WP-I, WP-H.
2. Performance WP: lazy ICU parser and lazy truncation tooltip; replace the provisional size budgets.
3. The follow-ups above, bundled into fix-up engineers.

## Next actions

- **WP-AI** (D-011: `tct` CLI, MCP via `@modelcontextprotocol/sdk` (approved), llms.txt, init
  agents): start once M6 has merged the agent registry.
- **Wave 2** (WORK-BREAKDOWN §2): WP-6 menus (needs 1, 4, 5), WP-7 basic form controls (needs 5), WP-8 app
  frame (needs 1), WP-9 chat messages (needs 1, 2). Start each as soon as its dependencies merge.
- **Docs reconciliation pass**: WP-D pages used target APIs. Re-verify them against the real components once
  wave 1 and M6 have merged, and switch the fenced examples to `<Example>`.
- **Flaky test watch**: one `pnpm check` run failed at "test" (after merging bed17fa); four later runs all
  passed. Suspected CPU contention from parallel agents; not confirmed. Log the failing test name if
  it happens again.
- **Keep the `web-features` check (D-014)**: confirm any "native in Tier 1" assumption before relying on it.
- **Owner-facing**: `docs/plan/OPEN-QUESTIONS.md` (Q-01…Q-07 resolved in D-013). Latin-only font subsets
  for non-Latin locales (Figtree has no Cyrillic/Greek). Tell the owner at the next summary.

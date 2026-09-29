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

| Stream | Agent id | Status / waiting on |
| --- | --- | --- |
| WP-7 basic form controls | ae829a7c68f66a548 | Running. Told that the layout components merged and a rename codemod is coming. |
| Examples migration A (overflow-list, list, item, metadata-list, indicator, button, button-group, icon-button, collapsible, icon) | a20739f0eddf5105f | Running. |
| Examples migration B (bottom-sheet, dialog, hover-card, banner, field, field-status, i18n-provider, avatar, link, badge, citation, heading, nav-icon, empty-state) | aca15832d8e9916a1 | Running. |
| WP-D guides reconciliation (D-015 prose, dead links, real APIs, `<Example>`) | a0422133074a702cb | Running. |
| D-015 rename to `@tecton-wc/*`, `@tct.*` ids, codemod `tools/codemods/d015-rename.ts`, third-party notices page | a32e9d1ad7c2c92f4 | Running. |
| WP-6 menus | a1670232dc74bd9dc | Running. |
| WP-8 layout and app frame | a627274cd9f0fda52 | Running. |
| WP-9 chat messages | a4474048d684578af | Running. |

Merged: WP-F (M1–M6, slices A/B), WP-1, WP-2, WP-3, WP-4, WP-5, and the wave-1 fix-ups. Wave 1 is complete.
`pnpm check` was fully green at 5533370, the first time since wave 1 began. The lint flake was fixed at its root: typecheck now runs before lint.

Follow-ups noted at review:
- WP-1 did not wire `tct-theme`'s `theme` property to a `DefinedTheme`; the core theme utilities exist.
- WP-4's alert-dialog size budgets are explicit in parity.json and move to the performance WP.
- Stack, hstack, vstack and card budgets were raised by ScrollFocusController (15 kB); review in the performance WP.

## Orchestrator queue (in order)

1. Examples migration (715 declarations in 24 folders, listed by `node tools/check-examples.ts`).
   Split into 3 engineers by folder once capacity frees up. Then add `examples:check` to the
   `pnpm check` STEPS.
2. Merge the rename as soon as it lands, and tell every stream to merge it and run the codemod.
3. WP-AI after the rename (creates `packages/cli` = `@tecton-wc/cli`; MCP SDK approved).
4. Wave 3 as dependencies merge: WP-10 (3,4,6), WP-11 (4,5,7), WP-12 (4,5,7), WP-13 (3,4,7),
   WP-14 (4,8), WP-15 (2,6,7), WP-16 (2,4,9). Then wave 4: WP-17, WP-18, WP-I, WP-H.
5. Performance WP: lazy ICU parser and lazy truncation tooltip; remove provisional size budgets.

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

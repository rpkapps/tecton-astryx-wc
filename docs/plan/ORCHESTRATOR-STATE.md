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

The original wave-1 agents were stopped by the owner on 2026-09-29; replacements resumed the same
worktrees (the old ids live on only as worktree directory names).

| Stream | Agent id | Worktree | Status / waiting on |
| --- | --- | --- | --- |
| WP-1 layout primitives & static text | a1afeefa92cab3d5f | agent-acded57bd1ca4753e | Resumed. Priority: layout recipes for the examples migration. |
| WP-2 content & status | af36d3808bd5519a6 | agent-a3ee263248691897a | Resumed; tooltip, dialog, providers now merged. |
| WP-4 overlay surfaces | a86b7f259ce8499ef | agent-ac379c35b2b1eb75d | Resumed; AlertDialog on the real tct-dialog. |
| M6 docs site: D-015 public text + docs:a11y | adac51d71c6a610e2 | agent-ab361e81d23c847ee | Resumed; the local 48 commits are not pushed until docs:a11y is green. |
| WP-7 basic form controls | ae829a7c68f66a548 | (own) | Started 2026-09-29. |

Merged: WP-F M1–M6, slices A and B, WP-3, WP-5, D-015 text.

## Orchestrator queue (in order)

1. Merge WP-1 first → add the examples lint rule (no layout properties in example `style=`), then
   the examples migration pass (task: 142/158 examples use inline layout CSS; split by folder,
   screenshot before/after, light and dark).
2. D-015 package-scope rename `@tecton-astryx/*` → `@tecton-wc/*` and shipped message ids
   `@astryx.*` → `@tct.*` (upstream locale catalogs stay byte-identical; map in the generator), token
   status id `tecton-astryx`, `/vendor/tecton-astryx/` paths. Do it in a quiet window after the
   wave-1 merges; streams then merge and update their imports.
3. WP-AI (after the rename; creates `packages/cli` = `@tecton-wc/cli`, MCP SDK approved).
4. Wave 2: WP-6 (1,4,5), WP-8 (1), WP-9 (1,2) as their dependencies merge.
5. Performance WP: lazy ICU parser + lazy truncation tooltip, remove provisional size budgets.

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

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

| Stream | Agent id | Status / waiting on |
| --- | --- | --- |
| WP-F M5a slice A (styles, icon, text, heading, spinner, button, visually-hidden, theme, size-provider, i18n-provider) | abc9ea6dbf1c367fb | Merged so far: styles, icon, text, heading, layer and typography styles, button, spinner. **Owes the tct-button form-bridge fix** (Enter in a native input does not use tct-button as the default submitter; with 2 text fields nothing happens). Then docs/parity and the providers. |
| WP-F M5b slice B (field, field-status, text-input, dialog, tooltip; owns `styles/field.styles.css`) | af749f906c2c855bf | Asked to commit tct-tooltip and tct-dialog early and notify. |
| WP-F M6 (CEM, API snapshots, generators, agent registry, build/CDN, size, Astro docs site) | ab361e81d23c847ee | Told that WP-D owns `apps/docs/src/content/docs/guides/`. |
| WP-1 layout primitives | acded57bd1ca4753e | Running. |
| WP-2 content & status | a3ee263248691897a | 6/10 done. Waits on tct-tooltip (B) and the provider pattern (A). |
| WP-3 actions & disclosure | a34a46febba69f09a | 7/10 done. Finishing IconButton, ToggleButton and Banner now that Button has landed. Shared requests to review at hand-off: base `[hidden]:not([hidden=until-found])`; tct-button `data-tct-edge-comp`; `keyboardHintStyles` location. |
| WP-4 overlay surfaces | ac379c35b2b1eb75d | Popover done. Waits on tct-dialog (B) for AlertDialog. |
| WP-5 collections & rows | a600f0be0a37778ec | Waits on tct-link (WP-2) for Item. |

Finished and merged: research (4 Opus agents), architecture (Opus), M1, M2 (tokens/fonts/icons), M3/M4
(core/locales/testing), D-013 follow-ups, WP-D docs guides.

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

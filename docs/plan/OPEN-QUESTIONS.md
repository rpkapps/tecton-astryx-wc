# Open questions for the owner

Items that need a decision from the owner or a designer. None of them blocks implementation, but they
block final sign-off. The orchestrator keeps this list current.

**Q-01 … Q-07 were resolved on 2026-09-29; see D-013.** New questions are added below.

| Id | Question | Context / current handling |
| --- | --- | --- |
| Q-01 | Can the transitive dev-only licences (MIT-0, BlueOak-1.0.0, CC0-1.0, Python-2.0, MPL-2.0 lightningcss) be approved? | D-012. The build tolerates them with a warning, and they fail the build if they ever reach the shipped tree. |
| Q-02 | Are the 131 Tecton icon glyphs (tecton-astryx) cleared to ship? | D-004 / D-009. Lucide is the default until the Tecton glyphs are cleared. |
| Q-03 | Top-nav text in light mode is 4.0:1 in the Tecton export (black 50% on white), below the 4.5:1 AA minimum. Change the design value or accept? | In `contrast.allow.json`; the component currently uses the export value. |
| Q-04 | The dark-mode outlined input border is 2.2–2.4:1 on the page, below the 3:1 non-text minimum. Change the design value or accept? | In `contrast.allow.json`. The light value passes. |
| Q-05 | `--color-border-emphasized` is 2.2:1 in both modes (Tecton design). Is it used for meaningful UI boundaries? | In `contrast.allow.json`. It is decorative until a component depends on it for meaning. |
| Q-06 | Provisional values (D-002: data-viz colours, motion, breakpoints, z-index, letter-spacing, the destructive button, headings 3–6 extrapolated): does Tecton have values for these? | Marked provisional in token metadata and the docs. |
| Q-07 | MCP server: in-house JSON-RPC (default), or approve an MCP SDK? | D-011. |

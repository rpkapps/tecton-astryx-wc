---
title: Chat Tool Calls
folder: chat-tool-calls
category: Chat
entries: [ChatToolCalls]
summary: The tool and function calls of an AI response, with a live status, a collapsible summary and expandable detail.
examples: [single, group, expanded, statuses, result-detail, streaming, in-message, rtl]
keywords: [tool, function, call, invocation, llm, agent, bash, edit, read, search, status, running, error, complete, diff, stats, chat]
dense:
  description: tool/function call display from an LLM response; one call inline, several collapse into a summary with the latest call at the surface
  usage: Set calls to the array the LLM API returns ({name, status, target, duration, node, additions, deletions, stats, errorMessage, key, resultDetail}). One call renders inline; several collapse behind a header (expanded, tct-expanded-change). Use it inside an assistant message.
  bestPractices:
    - {do: true, text: 'Include a target on every call: a file path, a command or a search query.'}
    - {do: true, text: 'Show a duration on completed calls so users see which ones were slow.'}
    - {do: true, text: 'Set label when the automatic "{count} tool calls" does not say what the calls were.'}
    - {do: true, text: 'Provide resultDetail (a diff, output) for calls that produce output.'}
    - {do: true, text: 'Set a key on each call while streaming so rows keep their identity and an open detail stays open.'}
    - {do: false, text: 'Omit status: it defaults to complete, which misleads for calls that are running or failed.'}
    - {do: false, text: 'Show tool calls outside a chat message; they belong inside an assistant message.'}
    - {do: false, text: 'Wrap individual calls; the component chooses single or grouped layout from the array length.'}
  properties:
    calls: the tool calls, in order (property only)
    label: summary label of an expanded group; unset, "{count} tool calls"
    expanded: whether the group is expanded; the attribute is the initial state
    tct-expanded-change: fired before a user toggle of the group applies; cancelable
related: [chat-message, chat-message-list, badge, spinner]
---

## Purpose

`tct-chat-tool-calls` shows what an AI agent did: the tools it called, on what, how long each took, and whether
it worked. A single call is a single line; several calls fold into a summary of the latest call with a count, and
the header opens the full list. A call can carry a result (a diff, command output) that opens inline.

## When to use

- Inside an assistant message, wherever the agent should show its work: file reads and edits, shell commands,
  searches, API calls.
- While the agent is running: update `calls` as each call starts, finishes or fails.

## Alternatives

- `tct-chat-message-bubble` for what the assistant says.
- `tct-list` or `tct-metadata-list` for a static list that is not the record of an agent's actions.
- `tct-progress-bar` for one long operation with a known extent.

## Anatomy

- **Group header** (`part="header"`, several calls): a button with the latest call (or the summary label when
  expanded), the count and a chevron.
- **Call** (`part="call"`): one **row** (`part="row"`) with a **status** mark (`part="status"`: a spinner, a check or an error
  mark, plus hidden status text), the tool **name** in the code font, an optional node badge, the **target**, diff
  stats, custom stats and the duration.
- **Detail** (`part="detail"`): the `resultDetail` of a call, shown under its row when opened.

## Variants and states

A call is `pending`, `running`, `complete` (the default) or `error`. Pending and running show a spinner; complete a
check in the success ink; error an error mark in the error ink, with the message as a native tooltip. The
duration shows only when the call is complete. The group is collapsed or expanded (`expanded`, `:state(expanded)`);
collapsed rows are `inert`. A row with `resultDetail` is a disclosure with its own chevron.

## Responsive behaviour

Rows are one line: the tool name and target are clipped with an ellipsis (the target gives way first) and the
node badge, stats and duration keep their size. Nothing wraps, so a narrow message column still reads as a list
of single lines. The group opens with a height animation when motion is allowed, and instantly under reduced
motion.

## Form semantics

Not applicable.

## Screen-reader expectations

- Every row carries hidden status text: "Pending", "Running", "Complete", "Failed", or "Error: {message}".
- The group header is a button with `aria-expanded` and `aria-controls`. Its name includes the count ("3 tool
  calls"), and collapsed rows are removed from the tab order and the accessibility tree.
- A row with `resultDetail` is a button with `aria-expanded`; the detail follows it.
- Updating `calls` while a response streams never moves focus and never speaks. A call that fails is announced once,
  politely ("run_tests: Error: 2 tests failed"); calls that arrive already failed (history) are not.

## Localisation

The status words, the error pattern and the "{count} tool calls" summary are localised (30 catalogs). Tool
names, targets, durations, node names and `label` are yours: format durations for the reader's locale. Rows are one
line in every language; long text is clipped with an ellipsis.

## Consumer responsibilities

- Set `status` on every call, and `key` on streaming calls.
- Provide `errorMessage` for failed calls: it is what a screen reader hears.
- Keep `resultDetail` accessible: it is your content, with your semantics.
- Format durations and localise `label`.

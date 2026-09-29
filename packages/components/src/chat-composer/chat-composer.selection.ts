/**
 * Selection helpers for the composer's editable surface (port of upstream `chatComposerSelection`),
 * made shadow-root aware: the editable lives in the input's shadow root, and `window.getSelection()`
 * there reports a range retargeted to the shadow host. Reading goes through
 * `Selection.getComposedRanges({shadowRoots})` (Chrome 137, Firefox 142, Safari 17: every Tier-1
 * engine), then the Chromium-only `ShadowRoot.getSelection()` and finally `getRangeAt(0)`, each accepted
 * only when it really lies inside the editable. Writing uses `setBaseAndExtent`, which takes nodes of
 * any tree. [mwg:shadow-dom]
 *
 * What a bare `focus()` does to the selection is engine- and state-dependent (Chromium puts the caret at
 * offset 0 of the draft, which is where ArrowUp means "recall history"), so the composer never infers the
 * caret from it:
 * - {@link placeCaretAtEnd} states the caret outright (the shell's click-to-focus);
 * - {@link getSelectionRange} + {@link restoreSelectionRange} let the imperative `focus()` keep a caret or
 *   selection the user already had (read *before* focusing);
 * - {@link ensureCaretInside} is the weaker fallback for callers that only need *a* valid range.
 */

interface SelectableRoot {
  getSelection?(): Selection | null;
}

const documentSelection = (): Selection | null => document.getSelection();

const toRange = (source: {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}): Range => {
  const range = document.createRange();
  range.setStart(source.startContainer, source.startOffset);
  range.setEnd(source.endContainer, source.endOffset);
  return range;
};

const isInside = (
  editable: HTMLElement,
  range: {startContainer: Node; endContainer: Node} | undefined | null,
): boolean =>
  range !== undefined &&
  range !== null &&
  editable.contains(range.startContainer) &&
  editable.contains(range.endContainer);

/** The current selection range when it lies inside `editable`, as a fresh `Range`; otherwise `null`. */
export function getSelectionRange(editable: HTMLElement): Range | null {
  const selection = documentSelection();
  if (!selection) return null;
  const root = editable.getRootNode();
  if (root instanceof ShadowRoot && typeof selection.getComposedRanges === 'function') {
    // Two spellings across engines: the standard options dictionary, and the earlier variadic form.
    for (const argument of [{shadowRoots: [root]}, root]) {
      try {
        const [range] = selection.getComposedRanges(argument as GetComposedRangesOptions);
        if (isInside(editable, range)) return toRange(range!);
      } catch {
        // This engine spells it the other way (or the selection is elsewhere): try the next form.
      }
    }
  }
  const scoped = (root as SelectableRoot).getSelection?.();
  for (const candidate of [scoped, selection]) {
    if (candidate && candidate.rangeCount > 0) {
      const range = candidate.getRangeAt(0);
      if (isInside(editable, range)) return toRange(range);
    }
  }
  return null;
}

/** Makes `range` the current selection again (works for ranges inside a shadow tree). */
export function restoreSelectionRange(range: Range): void {
  documentSelection()?.setBaseAndExtent(
    range.startContainer,
    range.startOffset,
    range.endContainer,
    range.endOffset,
  );
}

/** Selects everything inside `editable`. */
export function selectAll(editable: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(editable);
  restoreSelectionRange(range);
}

/**
 * Collapses the selection to the very end of `editable`, replacing whatever it held. Unconditional: the
 * caret a `focus()` leaves at the start of the draft is overwritten, which is the point.
 */
export function placeCaretAtEnd(editable: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  restoreSelectionRange(range);
}

/**
 * Ensures the selection has a range inside `editable` and returns it: the existing one (including the
 * start-of-draft caret a `focus()` leaves), else a caret at the end.
 */
export function ensureCaretInside(editable: HTMLElement): Range {
  const existing = getSelectionRange(editable);
  if (existing) return existing;
  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  restoreSelectionRange(range);
  return range;
}

/**
 * Inserts plain text at the selection (replacing a selected range), scoped to `editable`, and leaves
 * a caret after it. `\n` stays a newline: the editable is `white-space: pre-wrap`.
 */
export function insertTextAtCursor(editable: HTMLElement, text: string): void {
  const range = ensureCaretInside(editable);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  // A newline at the very end of a `pre-wrap` block draws no line of its own, and the engine keeps the caret
  // before it: a trailing `<br>` is the placeholder that makes the empty last line (and the caret on it)
  // real. The serialiser ignores it.
  if (text.endsWith('\n') && !hasContentSibling(node, 'end') && node.parentNode === editable) {
    editable.append(document.createElement('br'));
  }
  // Inside the inserted text (not after it in the parent): what typing would leave, and what trigger
  // detection reads.
  range.setStart(node, node.length);
  range.collapse(true);
  restoreSelectionRange(range);
}

// ---------------------------------------------------------------------------------- boundaries

function isAtNodeEdge(node: Node, offset: number, edge: 'start' | 'end'): boolean {
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    return edge === 'start' ? offset === 0 : offset === (node.nodeValue?.length ?? 0);
  }
  return edge === 'start' ? offset === 0 : offset === node.childNodes.length;
}

function hasContentSibling(node: Node, edge: 'start' | 'end'): boolean {
  for (
    let sibling = edge === 'start' ? node.previousSibling : node.nextSibling;
    sibling;
    sibling = edge === 'start' ? sibling.previousSibling : sibling.nextSibling
  ) {
    // Elements (a token, a <br>) are a content boundary even without text; empty text nodes are not.
    if (
      sibling.nodeType === Node.ELEMENT_NODE ||
      (sibling.nodeType === Node.TEXT_NODE && sibling.nodeValue !== '')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a range boundary sits at an edge of `editable` without materialising the content around it.
 * Chromium puts a caret at the start of a non-empty editable at the first text node's offset 0, a
 * different boundary point from the editable's child offsets, so `compareBoundaryPoints` cannot be used.
 */
function isBoundaryAtEdge(
  editable: HTMLElement,
  container: Node,
  offset: number,
  edge: 'start' | 'end',
): boolean {
  if (!editable.contains(container) || !isAtNodeEdge(container, offset, edge)) return false;
  for (let node: Node | null = container; node && node !== editable; node = node.parentNode) {
    if (hasContentSibling(node, edge)) return false;
  }
  return true;
}

/** Whether the selection starts at the very beginning of the draft (history recall's ArrowUp). */
export function isSelectionAtStart(editable: HTMLElement): boolean {
  const range = getSelectionRange(editable);
  return (
    range !== null && isBoundaryAtEdge(editable, range.startContainer, range.startOffset, 'start')
  );
}

/** Whether the selection ends at the very end of the draft (history recall's ArrowDown). */
export function isSelectionAtEnd(editable: HTMLElement): boolean {
  const range = getSelectionRange(editable);
  return range !== null && isBoundaryAtEdge(editable, range.endContainer, range.endOffset, 'end');
}

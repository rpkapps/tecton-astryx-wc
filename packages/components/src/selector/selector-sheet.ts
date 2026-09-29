let sheetElements: Promise<unknown> | undefined;

/**
 * Loads and registers the elements of the bottom-sheet presentation the first time a selector resolves
 * to it. A selector that stays a popover never pays for them: the sheet stack is a large share of the
 * size. Until they are defined the sheet is hidden (`:not(:defined)`), so nothing flashes.
 */
export function loadSelectorSheetElements(): Promise<unknown> {
  sheetElements ??= import('./selector-sheet.define.js');
  return sheetElements;
}

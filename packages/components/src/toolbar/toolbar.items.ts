/**
 * What a toolbar roves over: the focusable leaves of its slotted content, in flat-tree order. Upstream
 * matches `button, input, [tabindex]` anywhere below the toolbar; here "anywhere" includes the open
 * shadow roots of the toolbar's children (a `tct-button` keeps its `<button>` there), so the walk goes
 * through shadow roots and slots. A host that delegates focus is not an item (its inner control is);
 * a host with its own `tabindex` (a segment) is one leaf and is not descended into.
 */
const NATIVE =
  'button, a[href], input:not([type="hidden"]), select, textarea, summary, [contenteditable]:not([contenteditable="false"])';

/**
 * Composites that run their own roving tabindex. The toolbar leaves them alone: two controllers writing
 * `tabindex` on the same items would leave two tab stops. They keep their own stop and their own arrows.
 */
const OWN_ROVING = 'tct-segmented-control, tct-tab-list';

export function focusableLeaves(container: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: Element): void => {
    if (node.hasAttribute('hidden') || (node as HTMLElement).inert) return;
    if (node.matches(OWN_ROVING)) return;
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedElements({flatten: true});
      for (const child of assigned.length > 0 ? assigned : [...node.children]) visit(child);
      return;
    }
    const delegates = node.shadowRoot?.delegatesFocus === true;
    if (!delegates && (node.matches(NATIVE) || node.hasAttribute('tabindex'))) {
      if (node instanceof HTMLElement && node.checkVisibility()) out.push(node);
      return;
    }
    const children = node.shadowRoot ? [...node.shadowRoot.children] : [...node.children];
    for (const child of children) visit(child);
  };
  visit(container);
  return out;
}

/** Elements under `root` (through open shadow roots) that expose `updateComplete`, for "everything rendered". */
export function updatables(root: Element): Promise<unknown>[] {
  const pending: Promise<unknown>[] = [];
  const visit = (node: Element): void => {
    const update = (node as Partial<{updateComplete: Promise<unknown>}>).updateComplete;
    if (update) pending.push(update);
    for (const child of node.shadowRoot?.children ?? []) visit(child);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return pending;
}

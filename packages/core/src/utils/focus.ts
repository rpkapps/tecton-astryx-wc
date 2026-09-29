/**
 * Focus utilities that understand shadow DOM and slots (the flat tree): the deepest focused
 * element, containment as rendered, what is tabbable inside a container, and where focus lands
 * for wrapper elements. Shared by the layer stack, roving focus, focus trap and overlays.
 *
 * Trap to remember: `tabindex="-1"` on a shadow host removes its whole flat subtree from
 * sequential navigation, so roving items focus an inner control (`focusTargetOf`).
 */

/** The focused element, looking through open shadow roots. */
export function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let element: Element | null = root.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  return element;
}

/** The flat-tree parent of `node`: its assigned slot, else its parent, else its shadow root's host. */
export function flatParent(node: Node): Node | null {
  const slot = (node as Element | Text).assignedSlot;
  if (slot) return slot;
  if (node.parentNode instanceof ShadowRoot) return node.parentNode.host;
  return node.parentNode;
}

/**
 * Whether `node` is `container` or is rendered inside it (following slot assignment and shadow
 * hosts). Use instead of `contains()` whenever slotted content or shadow roots are involved.
 */
export function containsFlat(
  container: Node | null | undefined,
  node: Node | null | undefined,
): boolean {
  if (!container || !node) return false;
  for (let current: Node | null = node; current; current = flatParent(current)) {
    if (current === container) return true;
  }
  return false;
}

/**
 * True when focus rests on nothing in particular (no active element, `<body>` or the root element).
 * Overlays return focus to their trigger only when this holds or focus is inside the closing layer,
 * so a dismissing click on another control is never fought (upstream `isFocusDetached`).
 */
export function isFocusDetached(doc: Document = document): boolean {
  const active = doc.activeElement;
  return !active || active === doc.body || active === doc.documentElement;
}

function isHiddenAnchor(element: Element): boolean {
  return (
    (element.localName === 'a' || element.localName === 'area') &&
    !element.hasAttribute('href') &&
    !element.hasAttribute('tabindex')
  );
}

/** Whether `element` can receive focus by Tab right now (rendered, enabled, not inert, tabindex >= 0). */
export function isTabbable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
  const focusable = element as HTMLElement;
  if (focusable.tabIndex < 0 || isHiddenAnchor(element)) return false;
  if (element.matches(':disabled') || focusable.inert) return false;
  if (element.localName === 'input' && (element as HTMLInputElement).type === 'hidden')
    return false;
  // Hosts that delegate focus are not tab stops themselves; their inner control is.
  if (element.shadowRoot?.delegatesFocus) return false;
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility({visibilityProperty: true})
    : true;
}

/**
 * Every tabbable element rendered inside `container`, in flat-tree order: light children, shadow
 * roots (through their slots) and slotted content. Radio groups are not collapsed.
 */
export function getTabbables(container: Element | ShadowRoot): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: Element): void => {
    if ((node as HTMLElement).inert) return;
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedElements({flatten: true});
      for (const child of assigned.length > 0 ? assigned : [...node.children]) visit(child);
      return;
    }
    if (isTabbable(node)) out.push(node);
    const children = node.shadowRoot ? [...node.shadowRoot.children] : [...node.children];
    for (const child of children) visit(child);
  };
  const roots = container instanceof ShadowRoot ? [...container.children] : [container];
  for (const root of roots) visit(root);
  return out;
}

const FOCUSABLE =
  'button, a[href], input:not([type=hidden]), select, textarea, [tabindex], [contenteditable]';

/**
 * The element that actually takes focus for `element`: the native control inside a host that
 * delegates focus (recursively), `element` itself when it is focusable, else the first focusable
 * light child (a wrapper around a slotted trigger). `null` when nothing is focusable yet.
 *
 * Put a roving `tabindex` on this element rather than on a wrapper host: a host with a negative
 * `tabindex` takes its whole flat subtree out of the Tab order.
 */
export function focusTargetOf(element: Element): HTMLElement | null {
  const root = element.shadowRoot;
  if (root?.delegatesFocus) {
    for (const child of root.querySelectorAll('*')) {
      const inner =
        child.matches(FOCUSABLE) || child.shadowRoot?.delegatesFocus ? focusTargetOf(child) : null;
      if (inner) return inner;
    }
    return null;
  }
  if (element.matches(FOCUSABLE)) return element as HTMLElement;
  for (const child of element.children) {
    const inner = focusTargetOf(child);
    if (inner) return inner;
  }
  return null;
}

/** Focuses the first tabbable element in `container`, else `container` itself; returns the target. */
export function focusFirst(container: HTMLElement, options: FocusOptions = {}): HTMLElement {
  const target = getTabbables(container)[0] ?? container;
  target.focus(options);
  return target;
}

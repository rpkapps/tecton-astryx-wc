/**
 * Finds the messages under a conversation container in document order, following slots: the container
 * a scroll controller is given is usually an element of a layout's shadow tree, and the messages are
 * light-DOM children of a message list that is slotted into it, so a plain `querySelectorAll` from
 * the container sees none of them. A slot contributes its assigned elements; a message is not searched
 * for nested messages.
 */
export function findMessages(root: Element, selector: string): Element[] {
  const found: Element[] = [];
  const childrenOf = (element: Element): readonly Element[] =>
    element instanceof HTMLSlotElement
      ? element.assignedElements({flatten: true})
      : [...element.children];
  const visit = (element: Element): void => {
    if (element.matches(selector)) {
      found.push(element);
      return;
    }
    for (const child of childrenOf(element)) visit(child);
  };
  for (const child of childrenOf(root)) visit(child);
  return found;
}

/** The last message under `root`, or `null`. */
export function findLastMessage(root: Element, selector: string): Element | null {
  return findMessages(root, selector).at(-1) ?? null;
}

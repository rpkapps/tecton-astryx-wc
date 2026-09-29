/**
 * The plain text of chat content as a listener would want it read (light DOM only), used to announce a
 * settled message once (`tct-chat-message-list`). Elements that render their words in a shadow root
 * expose them as `announcementText` (`tct-chat-tokenized-text` does, so a mention is read by its label
 * and not by its serialized value). Hidden content and content in a named slot (a sender name, an
 * avatar, metadata, an icon) are skipped: they introduce or decorate the words, they are not the words.
 */

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

interface HasAnnouncementText {
  readonly announcementText?: unknown;
}

function collect(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent ?? '');
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  if (
    SKIPPED.has(element.tagName) ||
    element.hasAttribute('hidden') ||
    element.hasAttribute('slot') ||
    element.getAttribute('aria-hidden') === 'true'
  ) {
    return;
  }
  const own = (element as Element & HasAnnouncementText).announcementText;
  const parts: string[] = [];
  if (typeof own === 'string') parts.push(own);
  else for (const child of element.childNodes) collect(child, parts);
  // A block-level element ends a phrase, so "one" and "two" in two paragraphs are two words.
  const inline = getComputedStyle(element).display.startsWith('inline');
  out.push(inline ? parts.join('') : ` ${parts.join('')} `);
}

/** Whitespace-normalised text of `node` and its descendants, skipping hidden content. */
export function chatPlainText(node: Node): string {
  const parts: string[] = [];
  collect(node, parts);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

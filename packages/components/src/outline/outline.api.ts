/**
 * Outline items from a document's headings (upstream `useOutlineFromDOM`), as a module function and a
 * watcher. Headings need an `id` to be linkable; those without one, and empty ones, are skipped.
 */
import type {OutlineItem} from './outline.types.js';

/** The `h1`..`h6` elements of `container` as outline items, in document order. */
export function collectOutlineItems(container: ParentNode | null | undefined): OutlineItem[] {
  if (!container) return [];
  return [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .map((heading) => ({
      id: heading.id,
      label: heading.textContent?.trim() ?? '',
      level: Number(heading.tagName.slice(1)),
    }))
    .filter((item) => item.id !== '' && item.label !== '');
}

/**
 * Calls `onChange` with the current items now and after every change to the container's headings (added,
 * removed, retitled, or re-`id`ed). Returns a function that stops watching.
 */
export function watchOutlineItems(
  container: Node,
  onChange: (items: OutlineItem[]) => void,
): () => void {
  const read = (): void => {
    onChange(collectOutlineItems(container as ParentNode));
  };
  read();
  if (typeof MutationObserver === 'undefined') return () => undefined;
  const observer = new MutationObserver(read);
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['id'],
  });
  return () => {
    observer.disconnect();
  };
}

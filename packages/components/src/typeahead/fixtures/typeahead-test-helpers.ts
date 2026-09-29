/**
 * Helpers shared by the typeahead, base-typeahead and tokenizer tests: sources you control, the announcer
 * spy, and reads of the combobox from the outside (options, active descendant, expanded state).
 */
import {cdp, userEvent} from 'vitest/browser';
import {vi} from 'vitest';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepQueryAll} from '@tecton-wc/testing/fixture.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import type {SearchableItem, SearchSource} from '../typeahead.types.js';

export const FRUITS: SearchableItem[] = [
  {id: 'apple', label: 'Apple'},
  {id: 'apricot', label: 'Apricot'},
  {id: 'banana', label: 'Banana'},
  {id: 'blueberry', label: 'Blueberry'},
  {id: 'cherry', label: 'Cherry'},
];

/** A pending `search()` call of {@link controlledSource}. */
export interface PendingSearch {
  readonly query: string;
  resolve(items: SearchableItem[]): void;
  reject(error?: unknown): void;
}

/** A source whose searches stay pending until the test settles them, in any order. */
export function controlledSource(): {
  source: SearchSource;
  calls: PendingSearch[];
  cancel: ReturnType<typeof vi.fn>;
  bootstrap: ReturnType<typeof vi.fn>;
} {
  const calls: PendingSearch[] = [];
  const cancel = vi.fn();
  const bootstrap = vi.fn((): SearchableItem[] => []);
  return {
    calls,
    cancel,
    bootstrap,
    source: {
      search: (query: string) =>
        new Promise<SearchableItem[]>((resolve, reject) => {
          calls.push({query, resolve, reject});
        }),
      bootstrap,
      cancel,
    },
  };
}

/** Records every announcement through the (native) `ariaNotify` path, so tests count messages exactly. */
export function spyAnnouncements(): {messages: string[]; restore(): void} {
  const messages: string[] = [];
  const restoreFeature = overrideFeature('ariaNotify', true);
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'ariaNotify');
  Object.defineProperty(Element.prototype, 'ariaNotify', {
    configurable: true,
    writable: true,
    value(message: string): void {
      messages.push(message);
    },
  });
  return {
    messages,
    restore() {
      restoreFeature();
      if (original) Object.defineProperty(Element.prototype, 'ariaNotify', original);
      else delete (Element.prototype as unknown as Record<string, unknown>).ariaNotify;
    },
  };
}

/** The `[role=option]` rows in a shadow root, in order (the empty message included). */
export function optionsOf(host: Element): HTMLElement[] {
  return [...(host.shadowRoot?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
}

/** The text of a node including what its descendants render in their shadow roots (default row content does). */
export function deepText(node: Node): string {
  if (node instanceof Element && node.shadowRoot) {
    // What the element renders itself, then what it was given (slotted content): one reading order.
    return [...node.shadowRoot.childNodes, ...node.childNodes].map(deepText).join(' ');
  }
  if (node instanceof Element && node.localName === 'style') return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  return [...node.childNodes].map(deepText).join(' ');
}

/** The trimmed, whitespace-collapsed text of a row. */
export function textOf(node: Node | null | undefined): string {
  return node ? deepText(node).replace(/\s+/g, ' ').trim() : '';
}

/** The labels of the real result rows (not the empty message). */
export function optionLabels(host: Element): string[] {
  return optionsOf(host)
    .filter((option) => option.classList.contains('option'))
    .map((option) => textOf(option));
}

/** The combobox input in a shadow root. */
export function comboboxOf(host: Element): HTMLInputElement {
  return host.shadowRoot!.querySelector<HTMLInputElement>('input[role="combobox"]')!;
}

/** The id of the active descendant, through element reflection or the attribute (Tier 2). */
export function activeDescendantId(input: HTMLInputElement): string | null {
  return input.ariaActiveDescendantElement?.id ?? input.getAttribute('aria-activedescendant');
}

/** The option row the input currently points at, or `null`. */
export function activeOption(host: Element): HTMLElement | null {
  const id = activeDescendantId(comboboxOf(host));
  return id ? host.shadowRoot!.getElementById(id) : null;
}

/** Clicks the input and types `text` with the real keyboard. */
export async function typeInto(host: Element, text: string): Promise<void> {
  const input = comboboxOf(host);
  if (host.shadowRoot!.activeElement !== input) await userEvent.click(input);
  await userEvent.keyboard(text);
}

/** Waits until the popup of `host` is open and shows at least one option. */
export async function whenOpen(host: Element & {open: boolean}): Promise<void> {
  await waitUntil(() => host.open && optionsOf(host).length > 0, 'the result popup opens');
}

/**
 * Waits until every finite animation and transition in `element`'s subtree, shadow roots included, has
 * finished: colour is measured on the settled state, not on the first frame of a transition (an axe run
 * during one reads a colour halfway between the two).
 */
export async function motionDone(element: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(element.parentElement ?? element, () => true)
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
}

interface CdpDomNode {
  backendNodeId: number;
  attributes?: string[];
  children?: CdpDomNode[];
  shadowRoots?: CdpDomNode[];
  contentDocument?: CdpDomNode;
}

function findByAttribute(node: CdpDomNode, name: string, value: string): CdpDomNode | undefined {
  const attributes = node.attributes ?? [];
  for (let i = 0; i < attributes.length; i += 2) {
    if (attributes[i] === name && attributes[i + 1] === value) return node;
  }
  for (const child of [
    ...(node.shadowRoots ?? []),
    ...(node.children ?? []),
    ...(node.contentDocument ? [node.contentDocument] : []),
  ]) {
    const hit = findByAttribute(child, name, value);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Chromium only: forces pseudo-classes (`active`, ...) on `element` through the DevTools protocol, so the
 * pressed state can be measured without holding a real mouse button. Returns the function that lifts them.
 */
export async function forcePseudoState(
  element: Element,
  states: readonly ('active' | 'hover' | 'focus' | 'focus-visible')[],
): Promise<() => Promise<void>> {
  const session = cdp();
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const token = `fp${Math.random().toString(36).slice(2)}`;
  element.setAttribute('data-force-pseudo', token);
  try {
    const {root} = (await session.send('DOM.getDocument', {depth: -1, pierce: true})) as {
      root: CdpDomNode;
    };
    const found = findByAttribute(root, 'data-force-pseudo', token);
    if (!found) throw new Error('forcePseudoState: element not found in the DOM snapshot');
    const {nodeIds} = await session.send('DOM.pushNodesByBackendIdsToFrontend', {
      backendNodeIds: [found.backendNodeId],
    });
    const nodeId = nodeIds[0]!;
    await session.send('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: [...states]});
    return async () => {
      await session.send('CSS.forcePseudoState', {nodeId, forcedPseudoClasses: []});
    };
  } finally {
    element.removeAttribute('data-force-pseudo');
  }
}

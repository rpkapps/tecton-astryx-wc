/**
 * `ScrollableAreaController` (A§9.18, upstream `useScrollableArea`): axis-aware scroll behaviour for a
 * viewport and its content box, without inserting structure. It measures which of the requested
 * logical axes really scroll (through writing mode and direction), publishes stable per-axis edge
 * state, owns the keyboard path into the scroller, and applies overscroll chaining and the
 * clip / hidden / auto overflow pair on the viewport.
 *
 * Keyboard access (WCAG 2.1.1) is the reason it exists: a scroll container whose content has nothing
 * focusable cannot be scrolled from the keyboard in every engine, so the viewport takes a tab stop
 * while it is effectively scrollable and gives it back the moment it is not.
 *
 * | `keyboardAccess.owner`  | Tab stop | Semantics written | Overflow written |
 * | ----------------------- | -------- | ----------------- | ---------------- |
 * | `content`               | none: the content brings its own | none | yes |
 * | `viewport`              | the viewport while an axis scrolls | `role` (group or region) and `aria-label` | yes |
 * | `content-or-viewport`   | as `viewport`, but forward Tab lands on the first link or button inside | as `viewport` | yes |
 * | `implicit`              | the viewport, while its own CSS makes it scroll and nothing inside is tabbable | none (anonymous region) | no (its CSS owns it) |
 *
 * `implicit` is the generalisation of the stack and card scroll-focus rule for regions that have no
 * name of their own (layout content and panels, cards, stacks).
 *
 * The viewport and content are elements of the host's shadow root. Slotted content is light DOM, so
 * pass `slot` and the controller looks through it: assigned elements are observed for size and
 * mutations, and searched (through nested shadow roots) for the first tabbable.
 *
 * ```ts
 * #scroll = new ScrollableAreaController(this, {
 *   viewport: () => this.renderRoot.querySelector('.viewport'),
 *   content: () => this.renderRoot.querySelector('.content'),
 *   slot: () => this.renderRoot.querySelector('slot'),
 *   axis: () => this.axis,
 *   keyboardAccess: () => ({owner: 'viewport', label: this.label}),
 * });
 * ```
 * Guides: [mwg:accessibility] (keyboard and focus, scrollable regions), [mwg:css-layout] (overflow
 * tracking), [mwg:scrollability-affordance-hints]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {containsFlat, deepActiveElement, flatParent, getTabbables} from '../utils/focus.js';
import {observeResize} from './resize.js';

export type ScrollAxis = 'inline' | 'block' | 'both';
export type ScrollOverscroll = 'allow' | 'contain';
export type ScrollStickyContainment = 'when-scrollable' | 'always';
export type ScrollViewportRole = 'group' | 'region';

export type ScrollKeyboardAccess =
  | {readonly owner: 'content'}
  | {readonly owner: 'viewport'; readonly label: string; readonly role?: ScrollViewportRole}
  | {
      readonly owner: 'content-or-viewport';
      readonly label: string;
      readonly role?: ScrollViewportRole;
    }
  | {
      readonly owner: 'implicit';
      /** `tabindex` while the viewport is not a tab stop (a skip-link target keeps `-1`). */
      readonly idleTabindex?: '-1';
    };

export interface ScrollAxisState {
  /** The axis was requested, its overflow is scroll-capable and its geometry exceeds 1px. */
  readonly isScrollable: boolean;
  /** Scrolled to the logical start edge (or nothing to scroll). */
  readonly atStart: boolean;
  /** Scrolled to the logical end edge (or nothing to scroll). */
  readonly atEnd: boolean;
}

export interface ScrollableAreaState {
  readonly inline: ScrollAxisState;
  readonly block: ScrollAxisState;
}

/** Geometric tolerance, in CSS px. */
export const SCROLL_OVERFLOW_TOLERANCE = 1;

// ---------------------------------------------------------------------------------------- geometry

export type PhysicalScrollAxis = 'x' | 'y';

export interface LogicalAxisMapping {
  inline: PhysicalScrollAxis;
  block: PhysicalScrollAxis;
  inlineReversed: boolean;
  blockReversed: boolean;
}

/** Maps the logical axes onto the physical ones for a writing mode and direction. */
export function getLogicalAxisMapping(writingMode: string, direction: string): LogicalAxisMapping {
  const mode = writingMode.toLowerCase();
  const vertical = mode.startsWith('vertical') || mode.startsWith('sideways');
  const rtl = direction === 'rtl';
  if (!vertical) return {inline: 'x', block: 'y', inlineReversed: rtl, blockReversed: false};
  // sideways-lr runs its natural inline direction bottom to top; the other vertical modes run top to
  // bottom, and `direction` reverses each.
  return {
    inline: 'y',
    block: 'x',
    inlineReversed: mode === 'sideways-lr' ? !rtl : rtl,
    blockReversed: mode.endsWith('-rl'),
  };
}

const scrollCapable = (overflow: string): boolean =>
  overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';

const INACTIVE: ScrollAxisState = {isScrollable: false, atStart: true, atEnd: true};
const INITIAL: ScrollableAreaState = {inline: INACTIVE, block: INACTIVE};

/** Hidden, disconnected and zero-size viewports are unknown rather than fitting. */
function measurable(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  return (
    element.isConnected &&
    style.display !== 'none' &&
    element.clientWidth > 0 &&
    element.clientHeight > 0
  );
}

/** Whether the logical axis has more content than the viewport shows; `null` while unmeasurable. */
export function measureLogicalOverflow(
  element: HTMLElement,
  axis: 'inline' | 'block',
  mapping: LogicalAxisMapping,
): boolean | null {
  if (!measurable(element, getComputedStyle(element))) return null;
  const physical = mapping[axis];
  const client = physical === 'x' ? element.clientWidth : element.clientHeight;
  const content = physical === 'x' ? element.scrollWidth : element.scrollHeight;
  return content - client > SCROLL_OVERFLOW_TOLERANCE;
}

/** Effective scroll state of one logical axis; `null` while unmeasurable. */
export function measureLogicalScrollAxis(
  element: HTMLElement,
  axis: 'inline' | 'block',
  mapping: LogicalAxisMapping,
): ScrollAxisState | null {
  const style = getComputedStyle(element);
  if (!measurable(element, style)) return null;
  const physical = mapping[axis];
  const x = physical === 'x';
  const max =
    (x ? element.scrollWidth : element.scrollHeight) -
    (x ? element.clientWidth : element.clientHeight);
  const overflow = x ? style.overflowX : style.overflowY;
  if (!scrollCapable(overflow) || max <= SCROLL_OVERFLOW_TOLERANCE) return INACTIVE;
  const offset = x ? element.scrollLeft : element.scrollTop;
  const reversed = mapping[`${axis}Reversed`];
  const logical = Math.min(max, Math.max(0, reversed ? Math.abs(offset) : offset));
  return {
    isScrollable: true,
    atStart: logical <= SCROLL_OVERFLOW_TOLERANCE,
    atEnd: logical >= max - SCROLL_OVERFLOW_TOLERANCE,
  };
}

// ---------------------------------------------------------------------------------------- registry

const owners = new WeakMap<HTMLElement, ScrollableAreaState>();

/** The state an element registered as a scroll owner, if it is one. */
export function getRegisteredScrollOwnerState(
  element: HTMLElement,
): ScrollableAreaState | undefined {
  return owners.get(element);
}

/** The nearest ancestor (through slots and shadow roots) that owns an effective scroll on `axis`. */
export function findNearestScrollOwner(
  element: Element,
  axis: 'inline' | 'block',
): HTMLElement | null {
  for (let node = flatParent(element); node; node = flatParent(node)) {
    if (node instanceof HTMLElement && owners.get(node)?.[axis].isScrollable === true) return node;
  }
  return null;
}

// ----------------------------------------------------------------------- keyboard delegation

// Structural roles may contain ordinary links and buttons. Unknown or interactive roles are
// excluded until their navigation contract is proven.
const PASSIVE_ROLES = new Set([
  'article',
  'banner',
  'complementary',
  'contentinfo',
  'definition',
  'directory',
  'document',
  'figure',
  'form',
  'generic',
  'group',
  'heading',
  'list',
  'listitem',
  'main',
  'navigation',
  'none',
  'note',
  'paragraph',
  'presentation',
  'region',
  'section',
  'status',
  'table',
  'term',
]);

/**
 * Custom elements that are composites: their host carries the role through `ElementInternals`, which
 * is not readable from outside, so they are recognised by tag.
 */
const COMPOSITE_HOSTS =
  /^tct-(?:tab-list|toolbar|list|tree-list|radio-list|checkbox-list|segmented-control|toggle-button-group|button-group|dropdown-menu|context-menu|more-menu|tab-menu|selector|multi-selector|complex-selector|typeahead|tokenizer|slider|carousel|table|command-palette|power-search|date-input|date-range-input|date-time-input|time-input|calendar|resize-handle)$/;

/**
 * The link or button a forward Tab into the viewport may hand focus to, or `null` when the viewport
 * keeps the tab stop. Conservative on purpose: only the first sequential target counts, and only a
 * native link or button outside navigation-key-owning surfaces (composite roles, editable content,
 * `aria-activedescendant`, nested scroll owners, popup triggers). A positive `tabindex` orders before
 * the zero-index viewport, so it is never skipped over.
 */
function firstDelegationTarget(
  viewport: HTMLElement,
  roots: readonly Element[],
): HTMLElement | null {
  const tabbables = roots.flatMap((root) => getTabbables(root));
  if (tabbables.some((element) => element.tabIndex > 0)) return null;
  const first = tabbables.find((element) => element !== viewport);
  if (
    first?.tabIndex !== 0 ||
    !first.matches('a[href], button') ||
    first.matches('[aria-disabled="true"], [aria-haspopup]:not([aria-haspopup="false"])') ||
    !containsFlat(viewport, first)
  ) {
    return null;
  }
  for (let node: Node | null = first; node && node !== viewport; node = flatParent(node)) {
    if (!(node instanceof HTMLElement)) continue;
    const role = node.getAttribute('role')?.trim().toLowerCase();
    const nativeRole =
      node === first &&
      ((role === 'button' && first.localName === 'button') ||
        (role === 'link' && first.localName === 'a'));
    if (
      node.getAttribute('aria-hidden') === 'true' ||
      (role && !nativeRole && !PASSIVE_ROLES.has(role)) ||
      node.hasAttribute('aria-activedescendant') ||
      node.isContentEditable ||
      COMPOSITE_HOSTS.test(node.localName) ||
      owners.has(node)
    ) {
      return null;
    }
    // Native scroll owners that have not adopted the controller are respected too.
    const style = getComputedStyle(node);
    if (
      (scrollCapable(style.overflowX) && node.scrollWidth > node.clientWidth + 1) ||
      (scrollCapable(style.overflowY) && node.scrollHeight > node.clientHeight + 1)
    ) {
      return null;
    }
  }
  return first;
}

/**
 * Focus-time delegation for the `content-or-viewport` owner: a forward Tab into the overflowing
 * viewport moves on to the first link or button inside, so keyboard users are not made to stop on a
 * scroller that also has an action. Native scrolling stays untouched: arrows and Page keys keep
 * scrolling the browser's way. Reverse traversal from the delegated first child skips the viewport.
 * Pointer and programmatic focus never delegate. Attached only while an axis is effective.
 *
 * @returns a function that detaches everything.
 */
export function attachScrollKeyboardDelegation(
  viewport: HTMLElement,
  contentRoots: () => readonly Element[],
): () => void {
  const doc = viewport.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => undefined;
  let entry: KeyboardEvent | null = null;
  let delegated: HTMLElement | null = null;
  let timer: number | undefined;
  let restoreTabStop: (() => void) | undefined;

  const reset = (): void => {
    entry = null;
    win.clearTimeout(timer);
    restoreTabStop?.();
    restoreTabStop = undefined;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    reset();
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey) return;
    // Keep the event itself: `focus()` during keydown is programmatic (nonzero eventPhase), whereas
    // native Tab focus follows the completed dispatch.
    entry = event;
    if (
      event.shiftKey &&
      delegated &&
      containsFlat(viewport, delegated) &&
      deepActive(viewport) === delegated
    ) {
      const previous = viewport.getAttribute('tabindex');
      viewport.tabIndex = -1;
      restoreTabStop = () => {
        if (viewport.getAttribute('tabindex') !== '-1') return;
        if (previous === null) viewport.removeAttribute('tabindex');
        else viewport.setAttribute('tabindex', previous);
      };
    }
    // A cancelled Tab, focus leaving the document or a held key must not leave stale keyboard
    // intent for a later pointer or programmatic focus.
    timer = win.setTimeout(reset, 0);
  };

  const onFocusIn = (event: FocusEvent): void => {
    const keyboardEntry = entry;
    reset();
    const target = event.target instanceof Node ? event.target : null;
    if (target !== viewport) {
      if (!target || !containsFlat(viewport, target)) delegated = null;
      return;
    }
    delegated = null;
    if (
      keyboardEntry === null ||
      keyboardEntry.shiftKey ||
      keyboardEntry.defaultPrevented ||
      keyboardEntry.eventPhase !== 0
    ) {
      return;
    }
    const next = firstDelegationTarget(viewport, contentRoots());
    if (!next) return;
    delegated = next;
    // Let native focus reveal the action; scrolling stays browser-owned.
    next.focus();
    if (deepActive(viewport) !== next) delegated = null;
  };

  const onPointer = (): void => {
    reset();
  };

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('keyup', onPointer, true);
  doc.addEventListener('pointerdown', onPointer, true);
  viewport.addEventListener('focusin', onFocusIn);
  // Focus that moves between children of the viewport is tracked too.
  win.addEventListener('blur', onPointer);
  return () => {
    reset();
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('keyup', onPointer, true);
    doc.removeEventListener('pointerdown', onPointer, true);
    viewport.removeEventListener('focusin', onFocusIn);
    win.removeEventListener('blur', onPointer);
  };
}

/** The deepest focused element of the viewport's document. */
function deepActive(viewport: HTMLElement): Element | null {
  return deepActiveElement(viewport.ownerDocument);
}

// --------------------------------------------------------------------------------------- controller

export interface ScrollableAreaOptions {
  /** The scroll container (an element of the host's shadow root). */
  viewport: () => HTMLElement | null | undefined;
  /** The real content box inside the viewport, observed together with it. */
  content: () => HTMLElement | null | undefined;
  /** The slot whose assigned (light DOM) elements are the content: observed and searched too. */
  slot?: () => HTMLSlotElement | null | undefined;
  /** Requested logical axes (default `block`). */
  axis?: () => ScrollAxis;
  keyboardAccess: () => ScrollKeyboardAccess;
  /** Whether effective axes pass scroll gestures to ancestors at an edge (default `allow`). */
  overscroll?: () => ScrollOverscroll;
  /** Whether a fitting viewport deliberately remains a sticky containing boundary (default `when-scrollable`). */
  stickyContainment?: () => ScrollStickyContainment;
  /** Called after the published state changed (the host has been asked to update already). */
  onChange?: (state: ScrollableAreaState) => void;
}

const statesEqual = (a: ScrollableAreaState, b: ScrollableAreaState): boolean =>
  a.inline.isScrollable === b.inline.isScrollable &&
  a.inline.atStart === b.inline.atStart &&
  a.inline.atEnd === b.inline.atEnd &&
  a.block.isScrollable === b.block.isScrollable &&
  a.block.atStart === b.block.atStart &&
  a.block.atEnd === b.block.atEnd;

const requested = (axis: ScrollAxis, which: 'inline' | 'block'): boolean =>
  axis === which || axis === 'both';

const MUTATION_ATTRIBUTES = ['class', 'dir', 'hidden', 'style'];

export class ScrollableAreaController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: ScrollableAreaOptions;
  #viewport: HTMLElement | null = null;
  #content: HTMLElement | null = null;
  #slot: HTMLSlotElement | null = null;
  #stops: (() => void)[] = [];
  #contentStops: (() => void)[] = [];
  #mutations: MutationObserver | undefined;
  #delegation: (() => void) | undefined;
  #frame: number | undefined;
  #state: ScrollableAreaState = INITIAL;
  #tabStopApplied = false;
  #owned: string | undefined;

  constructor(host: ReactiveControllerHost, options: ScrollableAreaOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** Stable per-axis effective state (the same object while nothing changed). */
  get state(): ScrollableAreaState {
    return this.#state;
  }

  /** Whether at least one requested axis really scrolls. */
  get isScrollable(): boolean {
    return this.#state.inline.isScrollable || this.#state.block.isScrollable;
  }

  /** Re-measures now, for a host that changed something the observers cannot see. */
  update(): void {
    this.#evaluate();
  }

  hostConnected(): void {
    this.#bind();
  }

  hostUpdated(): void {
    this.#bind();
    this.#evaluate();
  }

  hostDisconnected(): void {
    this.#unbind();
  }

  // ------------------------------------------------------------------------------------ observation

  #bind(): void {
    const viewport = this.#options.viewport() ?? null;
    const content = this.#options.content() ?? null;
    const slot = this.#options.slot?.() ?? null;
    if (viewport === this.#viewport && content === this.#content && slot === this.#slot) return;
    this.#unbind();
    this.#viewport = viewport;
    this.#content = content;
    this.#slot = slot;
    if (!viewport) return;

    this.#stops.push(observeResize(viewport, this.#schedule));
    if (content) this.#stops.push(observeResize(content, this.#schedule));
    viewport.addEventListener('scroll', this.#schedule, {passive: true});
    viewport.addEventListener('transitionend', this.#schedule);
    viewport.addEventListener('animationend', this.#schedule);
    content?.addEventListener('load', this.#schedule, true);
    content?.addEventListener('transitionend', this.#schedule);
    content?.addEventListener('animationend', this.#schedule);
    slot?.addEventListener('slotchange', this.#onSlotChange);
    window.addEventListener('resize', this.#schedule);
    window.visualViewport?.addEventListener('resize', this.#schedule);
    document.fonts?.addEventListener?.('loadingdone', this.#schedule);
    void document.fonts?.ready.then(this.#schedule);

    // Geometry can change without a resize (a class, `dir`, `hidden` or `style` flip on the box or an
    // ancestor); content edits change it through childList and characterData.
    if (typeof MutationObserver !== 'undefined') {
      const mutations = new MutationObserver(this.#schedule);
      mutations.observe(viewport, {attributes: true, attributeFilter: MUTATION_ATTRIBUTES});
      if (content) {
        mutations.observe(content, {
          attributes: true,
          attributeFilter: MUTATION_ATTRIBUTES,
          characterData: true,
          childList: true,
          subtree: true,
        });
      }
      for (let node = flatParent(viewport); node; node = flatParent(node)) {
        if (node instanceof Element) {
          mutations.observe(node, {attributes: true, attributeFilter: MUTATION_ATTRIBUTES});
        }
      }
      this.#mutations = mutations;
    }
    this.#observeSlotted();
  }

  #unbind(): void {
    for (const stop of this.#stops) stop();
    for (const stop of this.#contentStops) stop();
    this.#stops = [];
    this.#contentStops = [];
    this.#mutations?.disconnect();
    this.#mutations = undefined;
    this.#delegation?.();
    this.#delegation = undefined;
    if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
    this.#frame = undefined;
    const viewport = this.#viewport;
    if (viewport) {
      viewport.removeEventListener('scroll', this.#schedule);
      viewport.removeEventListener('transitionend', this.#schedule);
      viewport.removeEventListener('animationend', this.#schedule);
      this.#content?.removeEventListener('load', this.#schedule, true);
      this.#content?.removeEventListener('transitionend', this.#schedule);
      this.#content?.removeEventListener('animationend', this.#schedule);
      this.#slot?.removeEventListener('slotchange', this.#onSlotChange);
      window.removeEventListener('resize', this.#schedule);
      window.visualViewport?.removeEventListener('resize', this.#schedule);
      document.fonts?.removeEventListener?.('loadingdone', this.#schedule);
      owners.delete(viewport);
      // Give the tab stop back: a disconnected viewport must not keep one it was lent.
      if (this.#tabStopApplied) this.#restoreTabindex(viewport);
    }
    this.#viewport = null;
    this.#content = null;
    this.#slot = null;
    this.#tabStopApplied = false;
  }

  /** The content grows and shrinks on its own: watch what is slotted as well as the box. */
  #observeSlotted(): void {
    for (const stop of this.#contentStops) stop();
    this.#contentStops = [];
    for (const element of this.#slotted()) {
      this.#contentStops.push(observeResize(element, this.#schedule));
      this.#mutations?.observe(element, {
        attributes: true,
        attributeFilter: MUTATION_ATTRIBUTES,
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  /** The elements the content consists of: the assigned elements of the slot, else the content box. */
  #slotted(): Element[] {
    if (this.#slot) return this.#slot.assignedElements({flatten: true});
    return this.#content ? [this.#content] : [];
  }

  readonly #onSlotChange = (): void => {
    this.#observeSlotted();
    this.#schedule();
  };

  /** Observers coalesce into one measurement per frame. */
  readonly #schedule = (): void => {
    if (this.#frame !== undefined || !this.#viewport) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      this.#evaluate();
    });
  };

  // -------------------------------------------------------------------------------- measurement

  #evaluate(): void {
    const viewport = this.#viewport;
    if (!viewport) return;
    const access = this.#options.keyboardAccess();
    if (access.owner === 'implicit') {
      this.#evaluateImplicit(viewport, access);
      return;
    }

    const axis = this.#options.axis?.() ?? 'block';
    const style = getComputedStyle(viewport);
    const mapping = getLogicalAxisMapping(style.writingMode, style.direction);
    const overflowOf = (which: 'inline' | 'block'): boolean | null =>
      requested(axis, which) ? measureLogicalOverflow(viewport, which, mapping) : false;
    const stateOf = (which: 'inline' | 'block'): ScrollAxisState | null =>
      requested(axis, which) ? measureLogicalScrollAxis(viewport, which, mapping) : INACTIVE;
    const inlineOverflow = overflowOf('inline');
    const blockOverflow = overflowOf('block');
    const inline = stateOf('inline');
    const block = stateOf('block');

    // Unknown (hidden, detached, zero-size) keeps the last valid state until a bounded signal
    // remeasures; the presentation still follows the options.
    if (inlineOverflow === null || blockOverflow === null || inline === null || block === null) {
      this.#apply(viewport, access, axis, mapping, this.#lastOverflow);
      return;
    }
    this.#lastOverflow = {inline: inlineOverflow, block: blockOverflow};
    const next: ScrollableAreaState = {inline, block};
    const changed = !statesEqual(this.#state, next);
    // Equal state keeps the previous object, so consumers can compare by identity.
    if (changed) this.#state = next;
    owners.set(viewport, this.#state);
    this.#apply(viewport, access, axis, mapping, this.#lastOverflow);
    // Delegation exists only while an axis is effective.
    this.#syncDelegation(viewport, access);
    if (changed) {
      this.#host.requestUpdate();
      this.#options.onChange?.(this.#state);
    }
  }

  #lastOverflow: {inline: boolean; block: boolean} = {inline: false, block: false};

  /** Presentation: the overflow pair, chaining, edge attributes and the keyboard path. */
  #apply(
    viewport: HTMLElement,
    access: Exclude<ScrollKeyboardAccess, {owner: 'implicit'}>,
    axis: ScrollAxis,
    mapping: LogicalAxisMapping,
    overflow: {inline: boolean; block: boolean},
  ): void {
    const state = this.#state;
    const sticky = this.#options.stickyContainment?.() ?? 'when-scrollable';
    const overscroll = this.#options.overscroll?.() ?? 'allow';

    const requestedOn = (physical: PhysicalScrollAxis): boolean =>
      (requested(axis, 'inline') && mapping.inline === physical) ||
      (requested(axis, 'block') && mapping.block === physical);
    const overflowingOn = (physical: PhysicalScrollAxis): boolean =>
      (overflow.inline && mapping.inline === physical) ||
      (overflow.block && mapping.block === physical);
    const overflowingX = overflowingOn('x');
    const overflowingY = overflowingOn('y');
    const containsSticky = overflowingX || overflowingY || sticky === 'always';
    const scrollsX = sticky === 'always' ? requestedOn('x') : overflowingX;
    const scrollsY = sticky === 'always' ? requestedOn('y') : overflowingY;
    // A fitting viewport clips without capturing native sticky; excess geometry activates the pair.
    viewport.style.overflowX = containsSticky ? (scrollsX ? 'auto' : 'hidden') : 'clip';
    viewport.style.overflowY = containsSticky ? (scrollsY ? 'auto' : 'hidden') : 'clip';

    const contain = (which: 'inline' | 'block'): 'contain' | 'auto' =>
      overscroll === 'contain' && state[which].isScrollable ? 'contain' : 'auto';
    const setOverscroll = (which: 'inline' | 'block'): void => {
      if (!requested(axis, which)) return;
      const property = mapping[which] === 'x' ? 'overscrollBehaviorX' : 'overscrollBehaviorY';
      viewport.style[property] = contain(which);
    };
    setOverscroll('inline');
    setOverscroll('block');

    viewport.dataset.scrollAxis = axis;
    const flag = (name: string, on: boolean): void => {
      if (on) viewport.setAttribute(name, 'true');
      else viewport.removeAttribute(name);
    };
    flag('data-scrollable-inline', state.inline.isScrollable);
    flag('data-scrollable-block', state.block.isScrollable);
    flag('data-scroll-inline-start', state.inline.atStart);
    flag('data-scroll-inline-end', state.inline.atEnd);
    flag('data-scroll-block-start', state.block.atStart);
    flag('data-scroll-block-end', state.block.atEnd);

    // Keyboard path. `content` leaves semantics and tab stops to the content.
    if (access.owner === 'content') {
      if (this.#tabStopApplied) this.#restoreTabindex(viewport);
      return;
    }
    viewport.setAttribute('role', access.role ?? 'group');
    viewport.setAttribute('aria-label', access.label);
    if (this.isScrollable) {
      this.#takeTabStop(viewport, '0');
    } else if (deepActive(viewport) === viewport) {
      // Losing overflow while focused never moves or blurs focus: the viewport stays focusable by
      // script, without a tab stop.
      this.#takeTabStop(viewport, '-1');
    } else if (this.#tabStopApplied) {
      this.#restoreTabindex(viewport);
    }
  }

  #takeTabStop(viewport: HTMLElement, value: '0' | '-1'): void {
    if (!this.#tabStopApplied && this.#owned === undefined) {
      this.#owned = viewport.getAttribute('tabindex') ?? '';
    }
    this.#tabStopApplied = true;
    if (viewport.getAttribute('tabindex') !== value) viewport.setAttribute('tabindex', value);
  }

  #restoreTabindex(viewport: HTMLElement): void {
    const previous = this.#owned;
    this.#owned = undefined;
    this.#tabStopApplied = false;
    if (previous) viewport.setAttribute('tabindex', previous);
    else viewport.removeAttribute('tabindex');
  }

  /**
   * `implicit`: the viewport's own CSS makes it scroll. While it really overflows and nothing inside
   * is tabbable it takes a tab stop; otherwise it is left as the idle value.
   */
  #evaluateImplicit(
    viewport: HTMLElement,
    access: Extract<ScrollKeyboardAccess, {owner: 'implicit'}>,
  ): void {
    const style = getComputedStyle(viewport);
    const scrolls = /auto|scroll/.test(`${style.overflowX} ${style.overflowY}`);
    const overflows =
      viewport.scrollHeight > viewport.clientHeight + SCROLL_OVERFLOW_TOLERANCE ||
      viewport.scrollWidth > viewport.clientWidth + SCROLL_OVERFLOW_TOLERANCE;
    const ownStop = getTabbables(viewport).some((element) => element !== viewport);
    const wanted = scrolls && overflows && !ownStop;
    const next = wanted ? '0' : (access.idleTabindex ?? null);
    if (next === null) {
      if (viewport.hasAttribute('tabindex')) viewport.removeAttribute('tabindex');
    } else if (viewport.getAttribute('tabindex') !== next) {
      viewport.setAttribute('tabindex', next);
    }
    const state: ScrollableAreaState = {
      inline: wanted ? {isScrollable: true, atStart: true, atEnd: true} : INACTIVE,
      block: INACTIVE,
    };
    if (!statesEqual(this.#state, state)) {
      this.#state = state;
      this.#host.requestUpdate();
      this.#options.onChange?.(state);
    }
  }

  #syncDelegation(viewport: HTMLElement, access: ScrollKeyboardAccess): void {
    const wanted = access.owner === 'content-or-viewport' && this.isScrollable;
    if (wanted && !this.#delegation) {
      this.#delegation = attachScrollKeyboardDelegation(viewport, () => this.#slotted());
    } else if (!wanted && this.#delegation) {
      this.#delegation();
      this.#delegation = undefined;
    }
  }
}

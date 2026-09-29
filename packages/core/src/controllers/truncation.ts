/**
 * Truncation detection (A§9.18, port of upstream `useTruncation`): is the text of an element with
 * `max-lines` currently cut off, and what is its full text (for the tooltip)?
 *
 *  - one line: `scrollWidth > offsetWidth` of the clamping element;
 *  - several lines: `-webkit-line-clamp` reports the clamped `scrollHeight`, so the real content
 *    height is measured with a `Range` over the host's own (light DOM) content and compared with the
 *    clamped box.
 *
 * Re-measures when the clamping element resizes (through the shared observer, so hundreds of table
 * cells cost one `ResizeObserver`) and when the host's content changes (text edits do not resize a
 * clamped box). The host re-renders only when the answer changes.
 *
 * ```ts
 * #truncation = new TruncationController(this, {
 *   target: () => this.renderRoot.querySelector('.text'),
 *   maxLines: () => this.maxLines,
 * });
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {observeResize} from './resize.js';

export interface TruncationControllerOptions {
  /** The element that clamps the text (`overflow: hidden`, `-webkit-line-clamp`); null before first render. */
  target: () => HTMLElement | null | undefined;
  /** Maximum lines before truncation; 0 or less turns detection off. */
  maxLines: () => number;
}

type Host = ReactiveControllerHost & HTMLElement;

// Sub-pixel layout: a full N-line block can measure a fraction of a pixel taller than its clamp box.
const TOLERANCE = 1;

export class TruncationController implements ReactiveController {
  readonly #host: Host;
  readonly #options: TruncationControllerOptions;
  #stopResize: (() => void) | undefined;
  #observed: HTMLElement | undefined;
  #mutations: MutationObserver | undefined;
  #isTruncated = false;
  #fullText = '';

  constructor(host: Host, options: TruncationControllerOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** Whether the text is currently cut off. */
  get isTruncated(): boolean {
    return this.#isTruncated;
  }

  /** The full text content (whitespace collapsed), for the tooltip. Empty while not truncating. */
  get fullText(): string {
    return this.#fullText;
  }

  /** Measures now (after slot or content changes the controller cannot see). */
  measure(): void {
    const element = this.#options.target();
    const lines = this.#options.maxLines();
    if (!element || !(lines > 0)) {
      this.#set(false, '');
      return;
    }
    const text = (this.#host.textContent ?? '').replace(/\s+/g, ' ').trim();
    let truncated: boolean;
    if (lines === 1) {
      truncated = element.scrollWidth > element.offsetWidth;
    } else {
      let contentHeight = element.scrollHeight;
      try {
        const range = document.createRange();
        range.selectNodeContents(this.#host);
        contentHeight = range.getBoundingClientRect().height;
      } catch {
        // Fall back to scrollHeight where ranges cannot be measured.
      }
      truncated = contentHeight - element.offsetHeight > TOLERANCE;
    }
    this.#set(truncated, text);
  }

  hostConnected(): void {
    this.#sync();
  }

  hostUpdated(): void {
    this.#sync();
    this.measure();
  }

  hostDisconnected(): void {
    this.#stopResize?.();
    this.#stopResize = undefined;
    this.#observed = undefined;
    this.#mutations?.disconnect();
    this.#mutations = undefined;
  }

  #sync(): void {
    const element = this.#options.maxLines() > 0 ? this.#options.target() : null;
    if (element === (this.#observed ?? null)) return;
    this.#stopResize?.();
    this.#stopResize = undefined;
    this.#mutations?.disconnect();
    this.#mutations = undefined;
    this.#observed = element ?? undefined;
    if (!element) return;
    this.#stopResize = observeResize(element, () => {
      this.measure();
    });
    this.#mutations = new MutationObserver(() => {
      this.measure();
    });
    this.#mutations.observe(this.#host, {childList: true, characterData: true, subtree: true});
  }

  #set(truncated: boolean, text: string): void {
    if (truncated === this.#isTruncated && text === this.#fullText) return;
    this.#isTruncated = truncated;
    this.#fullText = text;
    this.#host.requestUpdate();
  }
}

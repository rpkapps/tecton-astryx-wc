import {html, nothing, render, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-astryx/core/layer/layer-controller.js';
import {registerTopLayerPersistent} from '@tecton-astryx/core/layer/top-layer-host.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import type {ToastDismissReason} from '@tecton-astryx/core/events/tct-toast-dismiss.js';
import type {TctToastHideEvent} from '@tecton-astryx/core/events/tct-toast-hide.js';
import {containsFlat, deepActiveElement, getTabbables} from '@tecton-astryx/core/utils/focus.js';
import {uniqueId} from '@tecton-astryx/core/utils/id.js';
import defaultMessages from '@tecton-astryx/locales/en/toast.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import {TctToast} from './tct-toast.js';
import styles from './tct-toast-viewport.styles.css';
import {
  TOAST_POSITIONS,
  type ToastContent,
  type ToastInset,
  type ToastOptions,
  type ToastPosition,
} from './toast.types.js';

/** A toast held by a viewport. */
export interface ToastEntry {
  id: string;
  options: ToastOptions;
  createdAt: number;
}

/** No transition end within this long after a toast started to exit: remove it anyway. */
const EXIT_FALLBACK_MS = 1500;

/** Flattens toast content to the text a screen reader should hear. */
export function toastText(content: ToastContent | undefined): string {
  if (content === undefined || content === null) return '';
  if (typeof content === 'string') return content.trim();
  if (typeof content === 'number') return String(content);
  if (content instanceof Node) return (content.textContent ?? '').replace(/\s+/g, ' ').trim();
  // A template: render it off-document and read its text.
  const scratch = document.createElement('div');
  render(content, scratch);
  return (scratch.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The toaster: a top-layer, stacked, region-labelled container for `tct-toast` rows. It is an
 * internal element (raised by `toast()` and hosted by `tct-layer-provider`, or created lazily on
 * `document.body`). The host itself is the `popover="manual"` layer, so it can be moved atomically
 * into the top-most open modal and back (`registerTopLayerPersistent`): a toast action stays
 * clickable while a dialog is modal `[mwg:persistent-top-layer-ui]`.
 *
 * Stack: at most `max-visible` rows, the newest nearest the configured screen edge, eight pixels apart
 * and none at the edge; entering and dismissed rows open and collapse. `uniqueId` de-duplicates.
 * F6 moves focus into the newest toast and dismissing a focused toast hands focus to a neighbour or back
 * to where it was. New toasts are spoken once through the announcer.
 *
 * @internal
 * @tag tct-toast-viewport
 * @csspart stack - The column of toast rows.
 * @cloakDisplay contents
 */
export class TctToastViewport extends TctElement {
  static override readonly tagName = 'tct-toast-viewport';
  static override readonly dependencies = [TctToast];
  static override styles: CSSResultGroup = [base, motion, styles];

  /** Which edge and side of the screen the stack sits on. `start`/`end` are logical. */
  @property({reflect: true}) position: ToastPosition = 'bottom-end';
  /** Maximum number of visible toasts. */
  @property({type: Number, attribute: 'max-visible'}) maxVisible = 5;
  /** Inset of the stack from the screen edges, in px. */
  @property({attribute: false}) inset: ToastInset | undefined;
  /** Keeps the stack out of the top layer (inside a dialog that already is one). */
  @property({type: Boolean, attribute: 'no-top-layer', reflect: true}) noTopLayer = false;

  /** The toasts held, oldest first (including those beyond `max-visible`). */
  get entries(): readonly ToastEntry[] {
    return this.#toasts;
  }

  /** Adds a toast, honouring `uniqueId` and its collision behaviour. Speaks it once. */
  addToast(entry: ToastEntry): void {
    const {uniqueId: key, collisionBehavior = 'overwrite'} = entry.options;
    if (
      key &&
      collisionBehavior === 'ignore' &&
      this.#toasts.some((t) => t.options.uniqueId === key)
    )
      return;
    const text = toastText(entry.options.body);
    if (text) announce(text, {politeness: entry.options.type === 'error' ? 'assertive' : 'polite'});
    if (key && this.#toasts.some((t) => t.options.uniqueId === key)) {
      this.#toasts = this.#toasts.map((t) => (t.options.uniqueId === key ? entry : t));
    } else {
      this.#toasts = [...this.#toasts, entry];
    }
    this.requestUpdate();
  }

  /** Starts hiding a toast (as if dismissed): its `onHide` fires once and the row collapses. */
  removeToast(id: string, reason: ToastDismissReason): void {
    const entry = this.#toasts.find((t) => t.id === id);
    if (!entry) return;
    const row = this.#row(id);
    if (row) {
      const toast = row.querySelector<TctToast>('tct-toast');
      // Through the toast, so its cancelable dismiss event and its once-only hide event stay the one path.
      if (toast) {
        toast.dismiss(reason);
        return;
      }
    }
    // Not rendered (evicted by max-visible): drop it.
    this.#beginExit(entry, reason);
  }

  /** The toast with this `uniqueId`, if any. */
  findByUniqueId(uniqueKey: string): ToastEntry | undefined {
    return this.#toasts.find((t) => t.options.uniqueId === uniqueKey);
  }

  // -------------------------------------------------------------------------------- internals

  readonly #locale = new LocaleController(this, {namespace: 'toast', defaults: defaultMessages});
  readonly #id = uniqueId('tct-toast-viewport');
  #toasts: ToastEntry[] = [];
  #exiting = new Set<string>();
  #fallbackTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #home: ParentNode | null = null;
  #stopPersisting: (() => void) | undefined;
  #persisting = false;
  #previousFocus: HTMLElement | null = null;
  /** `target` is a toast id, or the literal `restore` (back to where focus was). */
  #handoff: {id: string; target: string} | undefined;

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'toast',
    surface: () => (this.noTopLayer ? null : this),
    escape: 'none',
    outsidePress: false,
    initialFocus: 'none',
    returnFocus: false,
    onDismissRequest: () => undefined,
  });

  get #visible(): ToastEntry[] {
    const max = Math.max(1, Math.floor(this.maxVisible) || 5);
    return this.#toasts.slice(-max);
  }

  get #reversed(): boolean {
    return this.position.startsWith('top');
  }

  #row(id: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[data-toast-id="${CSS.escape(id)}"]`);
  }

  // ------------------------------------------------------------------------------ exit + focus

  #beginExit(entry: ToastEntry, reason: ToastDismissReason): void {
    if (this.#exiting.has(entry.id)) return;
    this.#exiting.add(entry.id);
    entry.options.onHide?.(reason);
    const row = this.#row(entry.id);
    if (row && containsFlat(row, deepActiveElement())) {
      const index = this.#toasts.findIndex((t) => t.id === entry.id);
      const next = this.#toasts[index + 1] ?? this.#toasts[index - 1];
      this.#handoff = {id: entry.id, target: next ? next.id : 'restore'};
    }
    if (!row) {
      this.#remove(entry.id);
      return;
    }
    this.#fallbackTimers.set(
      entry.id,
      setTimeout(() => {
        this.#remove(entry.id);
      }, EXIT_FALLBACK_MS),
    );
    this.requestUpdate();
  }

  #remove(id: string): void {
    clearTimeout(this.#fallbackTimers.get(id));
    this.#fallbackTimers.delete(id);
    if (!this.#toasts.some((t) => t.id === id)) return;
    this.#exiting.delete(id);
    this.#toasts = this.#toasts.filter((t) => t.id !== id);
    this.requestUpdate();
    void this.updateComplete.then(() => {
      this.#restoreFocus(id);
    });
  }

  /** Focus that was in a dismissed toast goes to a remaining one, else back to where it was, never to <body>. */
  #restoreFocus(removedId: string): void {
    const handoff = this.#handoff;
    if (handoff?.id !== removedId) return;
    this.#handoff = undefined;
    if (handoff.target !== 'restore') {
      const next = this.#row(handoff.target);
      const focusable = next ? (getTabbables(next)[0] ?? null) : null;
      if (focusable) {
        focusable.focus();
        return;
      }
    }
    const previous = this.#previousFocus;
    this.#previousFocus = null;
    if (previous?.isConnected) previous.focus();
    else this.focus();
  }

  readonly #onHide = (event: TctToastHideEvent, entry: ToastEntry): void => {
    event.stopPropagation();
    this.#beginExit(entry, event.reason);
  };

  readonly #onRowTransitionEnd = (event: TransitionEvent, entry: ToastEntry): void => {
    const row = event.currentTarget as HTMLElement;
    if (event.target !== row || event.propertyName !== 'grid-template-rows') return;
    if (this.#exiting.has(entry.id)) this.#remove(entry.id);
    else row.toggleAttribute('data-settled', true);
  };

  /** F6 (the landmark-navigation key) moves focus into the newest toast. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'F6' || this.#toasts.length === 0) return;
    const active = deepActiveElement();
    if (active && containsFlat(this, active)) return;
    event.preventDefault();
    if (active instanceof HTMLElement) this.#previousFocus = active;
    const rows = this.renderRoot.querySelectorAll<HTMLElement>('[data-toast-id]');
    const newest = rows[rows.length - 1];
    const target = newest ? (getTabbables(newest)[0] ?? null) : null;
    if (target) target.focus();
    else this.focus();
  };

  // ------------------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    this.#home ??= this.parentNode;
    document.addEventListener('keydown', this.#onKeyDown);
    // Reachable while a modal dialog is open: the modal takes this element in, and gives it back.
    // Moving it into a modal disconnects and reconnects it (without moveBefore), which re-enters
    // here: the flag is set before registering so the nested call does not register twice.
    if (!this.#persisting) {
      this.#persisting = true;
      this.#stopPersisting = registerTopLayerPersistent(this, {
        home: () => (this.#home?.isConnected ? this.#home : document.body),
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.#onKeyDown);
    // A move between parents disconnects and reconnects in one task: only a real removal stops persisting.
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.#stopPersisting?.();
      this.#stopPersisting = undefined;
      this.#persisting = false;
    });
    for (const timer of this.#fallbackTimers.values()) clearTimeout(timer);
    this.#fallbackTimers.clear();
  }

  protected override willUpdate(): void {
    const has = this.#toasts.length > 0;
    // The landmark exists only while there is something in it; an empty region is noise.
    this.internals.role = has ? 'region' : null;
    this.internals.ariaLabel = has ? this.#locale.t('viewport') : null;
    if (has) this.tabIndex = -1;
    else this.removeAttribute('tabindex');
    this.toggleAttribute('data-open', has);
  }

  protected override updated(changed: PropertyValues<this>): void {
    const has = this.#toasts.length > 0;
    if (!this.noTopLayer) {
      if (has && !this.#layer.isOpen) void this.#layer.show();
      else if (!has && this.#layer.isOpen) void this.#layer.hide();
    }
    if (changed.has('inset') || changed.has('position')) this.#applyInset();
  }

  #applyInset(): void {
    const {inset} = this;
    const set = (name: string, value: number | undefined): void => {
      if (value) this.style.setProperty(name, `${value}px`);
      else this.style.removeProperty(name);
    };
    set('--_toast-inset-top', inset?.top);
    set('--_toast-inset-bottom', inset?.bottom);
    set('--_toast-inset-start', inset?.start);
    set('--_toast-inset-end', inset?.end);
  }

  // --------------------------------------------------------------------------------- render

  override render() {
    const position = TOAST_POSITIONS.includes(this.position) ? this.position : 'bottom-end';
    const reversed = this.#reversed;
    return html`<div class="stack" part="stack" data-position=${position} id=${this.#id}>
      ${repeat(
        this.#visible,
        (entry) => entry.id,
        (entry) => this.#renderRow(entry, reversed),
      )}
    </div>`;
  }

  #renderRow(entry: ToastEntry, reversed: boolean) {
    const o = entry.options;
    const exiting = this.#exiting.has(entry.id);
    const renderContent = o.renderContent;
    const autoHide = o.autoHide ?? (o.type ?? 'info') !== 'error';
    const duration = autoHide ? (o.autoHideDuration ?? 5000) : 0;
    return html`<div
      class="row"
      data-toast-id=${entry.id}
      ?data-exiting=${exiting}
      data-edge=${reversed ? 'top' : 'bottom'}
      @transitionend=${(event: TransitionEvent) => {
        this.#onRowTransitionEnd(event, entry);
      }}
    >
      <div class="row-inner">
        <tct-toast
          type=${o.type ?? 'info'}
          swipe-edge=${reversed ? 'start' : 'end'}
          .autoHideDuration=${duration}
          ?exiting=${exiting}
          .renderContent=${
            renderContent
              ? (props: Parameters<typeof renderContent>[0]) =>
                  renderContent({...props, body: o.body, endContent: o.endContent})
              : undefined
          }
          @tct-toast-hide=${(event: TctToastHideEvent) => {
            this.#onHide(event, entry);
          }}
          >${o.body}${
            o.endContent === undefined
              ? nothing
              : html`<span slot="end" class="end-content">${o.endContent}</span>`
          }</tct-toast
        >
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-toast-viewport': TctToastViewport;
  }
}

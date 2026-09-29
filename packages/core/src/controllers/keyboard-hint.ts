/**
 * `KeyboardHintController` (upstream `useKeyboardHint`, WP-3): the ephemeral "← → to navigate" hint that
 * teaches sighted keyboard users that arrow keys move focus inside a roving-tabindex composite
 * (`tct-toolbar`, `tct-segmented-control`, `tct-button-group`-like widgets, tab lists).
 *
 * Behaviour (ports `useKeyboardHint` and its tests):
 *  - shown once per instance when focus enters the composite from OUTSIDE by keyboard (the focused
 *    element matches `:focus-visible`), anchored below the focused item;
 *  - dismissed for good by the first arrow key, by the timeout (`dismissAfterMs`, 3000), or when focus
 *    leaves the composite; it never comes back for that instance;
 *  - focus moving between items while it is visible re-anchors it;
 *  - `aria-hidden`, `pointer-events: none`, never takes focus, never touches Escape or outside presses
 *    (the layer is `escape: 'none'`), so it can never steal a keystroke from a dialog.
 *
 * The host renders the surface with `controller.render()` (last child of its template) and includes
 * {@link keyboardHintStyles} in `static styles`:
 *
 * ```ts
 * #hint = new KeyboardHintController(this, {orientation: () => this.orientation});
 * static override styles = [base, keyboardHintStyles, styles];
 * render() { return html`<div class="toolbar"><slot></slot>${this.#hint.render()}</div>`; }
 * ```
 *
 * The surface is a `popover="manual"` element in the host's own shadow root, positioned with the shared
 * `PositionController` (implicit anchor on the CSS path), so overflow containers never clip it.
 * Guides: [mwg:interest-triggered-tooltips] [mwg:position-aware-tooltips] [mwg:accessibility]
 */
import {css, html, type CSSResult, type ReactiveController, type TemplateResult} from 'lit';
import defaults from '@tecton-astryx/locales/en/keyboardHint.js';
import {LocaleController} from '../i18n/locale-controller.js';
import {LayerController} from '../layer/layer-controller.js';
import {PositionController} from '../layer/position.js';
import type {TctElement} from '../tct-element.js';
import {containsFlat, deepActiveElement} from '../utils/focus.js';

export type KeyboardHintOrientation = 'horizontal' | 'vertical' | 'both';

export interface KeyboardHintOptions {
  /** Which arrows the composite answers to; controls the glyphs shown. Default `'horizontal'`. */
  orientation?: KeyboardHintOrientation | (() => KeyboardHintOrientation);
  /** Milliseconds before the hint dismisses itself. Default 3000. */
  dismissAfterMs?: number;
  /** Suppress the hint (a disabled or read-only widget). Default enabled. */
  enabled?: boolean | (() => boolean);
}

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const GLYPHS: Record<KeyboardHintOrientation, readonly {key: string; glyph: string}[]> = {
  horizontal: [
    {key: 'left', glyph: '←'},
    {key: 'right', glyph: '→'},
  ],
  vertical: [
    {key: 'up', glyph: '↑'},
    {key: 'down', glyph: '↓'},
  ],
  both: [
    {key: 'left', glyph: '←'},
    {key: 'right', glyph: '→'},
    {key: 'up', glyph: '↑'},
    {key: 'down', glyph: '↓'},
  ],
};

/** Selector of the hint surface inside the host's shadow root. */
const SURFACE = '[data-tct-keyboard-hint]';

/**
 * Styles of the hint surface. Tokens only; Tecton popovers carry a border and no drop shadow
 * (D-013 Q-06). Include after `base` in the host's `static styles`.
 */
export const keyboardHintStyles: CSSResult = css`
  @layer component {
    .keyboard-hint {
      position: fixed;
      inset: auto;
      margin: 0;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-element);
      padding-block: var(--spacing-1);
      padding-inline: var(--spacing-2);
      background: var(--color-background-popover);
      color: var(--color-text-secondary);
      font-size: var(--text-supporting-size);
      line-height: var(--text-supporting-leading);
      white-space: nowrap;
      pointer-events: none;
      opacity: 1;
      transition: opacity var(--duration-fast) var(--ease-standard);
    }

    @starting-style {
      .keyboard-hint:popover-open {
        opacity: 0;
      }
    }

    .keyboard-hint-keys {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    .keyboard-hint-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 1.5em;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-inner);
      padding-inline: var(--spacing-0-5);
      font: inherit;
      color: var(--color-text-primary);
    }

    .keyboard-hint-label {
      margin-inline-start: var(--spacing-1);
    }
  }
`;

export class KeyboardHintController implements ReactiveController {
  readonly #host: TctElement;
  readonly #options: KeyboardHintOptions;
  readonly #locale: LocaleController;
  readonly #layer: LayerController;
  readonly #position: PositionController;
  #anchor: HTMLElement | null = null;
  #visible = false;
  #dismissed = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #generation = 0;

  constructor(host: TctElement, options: KeyboardHintOptions = {}) {
    this.#host = host;
    this.#options = options;
    this.#locale = new LocaleController(host, {namespace: 'keyboardHint', defaults});
    this.#position = new PositionController(host, {
      surface: () => this.#surface(),
      anchor: () => this.#anchor,
      placement: () => ({placement: 'below', alignment: 'start', offset: 'var(--spacing-2)'}),
    });
    this.#layer = new LayerController(host, {
      kind: 'hint',
      surface: () => this.#surface(),
      // Never part of Escape handling, outside presses or focus return: it is a hint, not a layer.
      escape: 'none',
      outsidePress: false,
      returnFocus: false,
      initialFocus: 'none',
      position: this.#position,
      onDismissRequest: () => {
        this.dismiss();
      },
      onNativeClose: () => {
        this.#visible = false;
      },
    });
    host.addController(this);
  }

  /** Whether the hint is on screen right now. */
  get isVisible(): boolean {
    return this.#visible;
  }

  /** Whether the hint was dismissed for good (it never shows again for this instance). */
  get isDismissed(): boolean {
    return this.#dismissed;
  }

  /** Hides the hint and prevents it from showing again on this instance. */
  dismiss(): void {
    this.#dismissed = true;
    this.#hide();
  }

  hostConnected(): void {
    this.#host.addEventListener('focusin', this.#onFocusIn);
    this.#host.addEventListener('focusout', this.#onFocusOut);
    this.#host.addEventListener('keydown', this.#onKeyDown);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener('focusin', this.#onFocusIn);
    this.#host.removeEventListener('focusout', this.#onFocusOut);
    this.#host.removeEventListener('keydown', this.#onKeyDown);
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  /** The hint surface; render it as the last child of the composite's template. */
  render(): TemplateResult {
    const orientation = this.#orientation();
    return html`<span
      class="keyboard-hint"
      part="keyboard-hint"
      popover="manual"
      aria-hidden="true"
      data-tct-keyboard-hint
      ><span class="keyboard-hint-keys"
        >${GLYPHS[orientation].map(
          ({key, glyph}) => html`<kbd class="keyboard-hint-key" data-key=${key}>${glyph}</kbd>`,
        )}</span
      ><span class="keyboard-hint-label">${this.#locale.t('toNavigate')}</span></span
    >`;
  }

  // ---------------------------------------------------------------------------------- internals

  #orientation(): KeyboardHintOrientation {
    const option = this.#options.orientation ?? 'horizontal';
    return typeof option === 'function' ? option() : option;
  }

  #enabled(): boolean {
    const option = this.#options.enabled ?? true;
    return typeof option === 'function' ? option() : option;
  }

  #surface(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(SURFACE);
  }

  #show(anchor: HTMLElement): void {
    if (this.#dismissed || !this.#enabled()) return;
    this.#anchor = anchor;
    const generation = ++this.#generation;
    this.#visible = true;
    void this.#layer.show();
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      // Timed out: same as a dismissal, the hint has taught what it can.
      if (generation === this.#generation) this.dismiss();
    }, this.#options.dismissAfterMs ?? 3000);
  }

  #hide(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#generation++;
    if (!this.#visible) return;
    this.#visible = false;
    void this.#layer.hide().then(() => {
      this.#anchor = null;
    });
  }

  readonly #onFocusIn = (event: FocusEvent): void => {
    if (this.#dismissed || !this.#enabled()) return;
    const target = event.composedPath()[0];
    if (!(target instanceof HTMLElement)) return;
    if (this.#visible) {
      // Focus moved between the composite's items while the hint is up: follow it.
      if (target !== this.#anchor && containsFlat(this.#host, target)) {
        const wasVisible = this.#layer.hide();
        this.#visible = false;
        void wasVisible.then(() => {
          if (!this.#dismissed && this.#host.isConnected) this.#show(target);
        });
      }
      return;
    }
    // Only keyboard focus (a pointer click needs no hint) that enters from outside the composite.
    if (!target.matches(':focus-visible')) return;
    const from = event.relatedTarget;
    if (from instanceof Node && containsFlat(this.#host, from)) return;
    this.#show(target);
  };

  readonly #onFocusOut = (event: FocusEvent): void => {
    if (!this.#visible) return;
    const to = event.relatedTarget;
    // Retargeting hides which inner control receives focus; a deep focus check is authoritative.
    if (to instanceof Node && containsFlat(this.#host, to)) return;
    queueMicrotask(() => {
      const active = deepActiveElement();
      if (active && active !== document.body && containsFlat(this.#host, active)) return;
      this.dismiss();
    });
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (this.#visible && ARROW_KEYS.has(event.key)) this.dismiss();
  };
}

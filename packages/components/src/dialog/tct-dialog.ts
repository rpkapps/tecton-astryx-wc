import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {features, prefersReducedMotion} from '@tecton-wc/core/features.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {oneOf, lengthConverter, toCssLength} from '../field/field-utils.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import {installCommandFallback, type CommandLikeEvent} from './dialog.commands.js';
import {dialogContext, type DialogContextValue, type DialogHeaderLike} from './dialog.context.js';
import {
  DIALOG_PADDINGS,
  DIALOG_PURPOSES,
  DIALOG_VARIANTS,
  type DialogPadding,
  type DialogPosition,
  type DialogPurpose,
  type DialogVariant,
} from './dialog.types.js';
import {TctDialogHeader} from './tct-dialog-header.js';
import styles from './tct-dialog.styles.css';

/** `padding` step to spacing token (`1.5` is `--spacing-1-5`). */
const spacingToken = (step: DialogPadding): string =>
  `var(--spacing-${String(step).replace('.', '-')})`;

const cssDuration = (element: Element, token: string, fallback: number): number => {
  const raw = getComputedStyle(element).getPropertyValue(token).trim();
  const ms = raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : fallback;
};

/**
 * A modal dialog on the native `<dialog>` element (`showModal()`), which gives it the top layer, an
 * inert page behind it, and a backdrop, with no portal, z-index or focus-trap code. Use it for a
 * flow that needs a decision before the user goes on.
 *
 * `open` is the state. Escape, a press on the backdrop, the close button and `requestClose()` ask to
 * close it with a cancelable `tct-open-change` (`reason`: `escape`, `outside`, `close-button`,
 * `close-watcher`, `request`) and close it unless you prevent the event; writing `open` never emits it.
 * `tct-after-open-change` fires once the change settled, after the entry or exit animation. To control
 * a dialog, listen, `preventDefault()` and set `open` yourself.
 *
 * `purpose` says what may dismiss it: `required` nothing (a mandatory flow: `role="alertdialog"`, no
 * Escape, no backdrop press, no close button), `form` Escape only, `info` Escape and the backdrop.
 * Nested dialogs close one per Escape press, innermost first, and focus returns to the element that
 * opened each one. The heading names the dialog, and takes focus when it opens, unless an element of
 * yours has `autofocus`.
 *
 * Give it a `heading` (and optionally a `subtitle`), or compose `<tct-dialog-header>` yourself. Open it
 * with `open`, `show()`, a declarative invoker (`<button commandfor="dlg" command="--show">`) or, without
 * markup, `openDialog()` from `@tecton-wc/components/dialog/dialog.api.js`. [mwg:light-dismiss-a-dialog]
 * [mwg:platform-controls-dismiss-dialog] [mwg:declarative-dialog-popover-control] [mwg:animate-to-from-top-layer]
 * [mwg:persistent-top-layer-ui] [mwg:move-dom-element-without-losing-state]
 *
 * @summary Modal dialog with dismissal purposes, nested layers and focus return.
 * @tag tct-dialog
 * @upstream Dialog
 * @slot - The dialog content.
 * @slot heading - A heading element of your own (an `<h2>`), instead of the `heading` text.
 * @csspart dialog - The `<dialog>` surface, or its inline stand-in.
 * @csspart content - The padded content box inside the surface.
 * @cssprop --dialog-padding - Padding of the dialog content. Default the spacing step 4 (the `padding` attribute wins).
 * @cssstate open - The dialog is open.
 * @fires tct-open-change - The user or a close request asks to open or close it; cancelable, carries `open` and `reason`.
 * @fires tct-after-open-change - The change settled (after the animation); carries `open`.
 * @cloakDisplay contents
 */
export class TctDialog extends TctElement {
  static override readonly tagName = 'tct-dialog';
  static override readonly dependencies = [TctDialogHeader];
  static override styles: CSSResultGroup = [base, focusRing, motion, styles];

  /** Whether the dialog is open. The attribute opens it initially. */
  @property({type: Boolean, reflect: true}) open = false;

  /**
   * Renders the content inline, without the `<dialog>`, backdrop, modal behaviour or autofocus. For
   * documentation previews and showcases only: it does not trap focus or answer Escape.
   */
  @property({type: Boolean, reflect: true}) inline = false;

  /**
   * Preferred width of a standard dialog, clamped to the viewport with a gutter. A number is px, a
   * string a CSS length. Ignored by `fullscreen`.
   */
  @property({converter: lengthConverter}) width: number | string = 400;

  /** Maximum height of a standard dialog; taller content scrolls. Ignored by `fullscreen`. Default `75dvh`. */
  @property({converter: lengthConverter, attribute: 'max-height'}) maxHeight: number | string =
    '75dvh';

  /** Static position on screen (centred by default). Logical `start` and `end` mirror in RTL. Ignored by `fullscreen`. */
  @property({attribute: false}) position: DialogPosition | undefined;

  /** `standard` (default) or `fullscreen`. */
  @property({reflect: true}) variant: DialogVariant = 'standard';

  /** What may dismiss it: `required` nothing, `form` Escape only, `info` (default) Escape and the backdrop. */
  @property({reflect: true}) purpose: DialogPurpose = 'info';

  /** Padding of the content as a step of the spacing scale (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). */
  @property({type: Number}) padding: DialogPadding | undefined;

  /** The title. A shorthand for `<tct-dialog-header heading="…">` as the first child; it names the dialog. */
  @property() heading = '';

  /** A subtitle under the heading. */
  @property() subtitle = '';

  /** Hides the close button of the `heading` shorthand (a `required` dialog has none anyway). */
  @property({type: Boolean, attribute: 'no-close-button'}) noCloseButton = false;

  readonly #slots = new SlotController(this, 'heading');
  readonly #provider = new ContextProvider(this, {context: dialogContext, initialValue: null});
  #contextValue: DialogContextValue | null = null;
  #header: DialogHeaderLike | null = null;
  /** The element that opened the dialog through a declarative invoker (it gets `aria-expanded`). */
  #invoker: HTMLElement | null = null;
  #transition: Promise<void> = Promise.resolve();
  #lastAfter: boolean | undefined;
  /** The dialog has started opening at least once (so a close that outruns the entry still settles). */
  #opened = false;
  #warned = false;

  readonly #aria = new AriaDelegateController(this, {
    target: () => this.#surface,
    // The heading names the dialog unless the author gave it an aria-label or aria-labelledby.
    labels: () => {
      const heading = this.#header?.headingElement;
      return heading ? [heading] : [];
    },
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'modal',
    surface: () => this.#surface,
    trigger: () => this.#invoker,
    escape: () => (this.purpose === 'required' ? 'block' : 'close'),
    // A press on the backdrop dismisses an informational dialog only: a form would lose the user's input.
    outsidePress: () => this.purpose === 'info',
    initialFocus: () => this.#initialFocus(),
    exitAnimation: () => this.#exitAnimations(),
    onDismissRequest: (reason) => {
      this.#requestChange(false, reason);
    },
    onNativeClose: () => {
      // Closed from inside (`<form method="dialog">`, `close()`): the state follows the surface.
      this.open = false;
      this.#announce(false);
    },
  });

  /** The `<dialog>` element (null inline and before the first render). */
  get #surface(): HTMLDialogElement | null {
    return this.renderRoot?.querySelector<HTMLDialogElement>('dialog.dialog') ?? null;
  }

  /** Whether the dialog is showing as a modal right now (the layer is on the stack). */
  get isOpen(): boolean {
    return this.#layer.isOpen;
  }

  /** Opens the dialog without a `tct-open-change` (programmatic). Resolves when the change settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#transition;
  }

  /** Closes the dialog without a `tct-open-change` (programmatic). Resolves when the change settled. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#transition;
  }

  /** Toggles the dialog, or sets it with `force`, without a `tct-open-change`. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /**
   * Asks to close as the user would: fires a cancelable `tct-open-change` (reason `request` unless
   * given) and closes unless it is prevented. It is an explicit action, so a `required` dialog (which
   * Escape, the backdrop and a close button cannot dismiss) answers it too.
   */
  requestClose(reason: ChangeReason = 'request'): void {
    this.#requestChange(false, reason);
  }

  // ------------------------------------------------------------------------------- lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    installCommandFallback();
    this.addEventListener('command', this.#onCommand as EventListener);
    this.addEventListener('submit', this.#onSubmit);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('command', this.#onCommand as EventListener);
    this.removeEventListener('submit', this.#onSubmit);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('purpose') || changed.has('inline') || this.#contextValue === null) {
      this.#contextValue = {
        inline: this.inline,
        purpose: oneOf(this.purpose, DIALOG_PURPOSES, 'info'),
        register: (header) => {
          this.#header = header;
          this.requestUpdate();
        },
        unregister: (header) => {
          if (this.#header !== header) return;
          this.#header = null;
          this.requestUpdate();
        },
        requestClose: (reason) => {
          this.requestClose(reason);
        },
      };
      this.#provider.setValue(this.#contextValue);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.toggleState('open', this.open && !this.inline);
    if (changed.has('open') || changed.has('inline')) this.#follow();
    this.#aria.sync();
    if (this.open && !this.inline && !this.#warned) this.#warnIfUnnamed();
  }

  override render() {
    const variant = oneOf(this.variant, DIALOG_VARIANTS, 'standard');
    const purpose = oneOf(this.purpose, DIALOG_PURPOSES, 'info');
    const position = variant === 'standard' ? this.position : undefined;
    const padding = DIALOG_PADDINGS.find((step) => step === this.padding);
    const style = styleMap({
      '--_width': toCssLength(this.width),
      '--_max-height': toCssLength(this.maxHeight),
      '--_padding': padding === undefined ? undefined : spacingToken(padding),
      '--_top': position?.top === undefined ? undefined : toCssLength(position.top),
      '--_bottom': position?.bottom === undefined ? undefined : toCssLength(position.bottom),
      '--_start': position?.start === undefined ? undefined : toCssLength(position.start),
      '--_end': position?.end === undefined ? undefined : toCssLength(position.end),
    });
    const content = html`<div class="inner" part="content">
      ${
        this.heading || this.#slots.has('heading')
          ? html`<tct-dialog-header
              heading=${this.heading}
              subtitle=${this.subtitle}
              ?no-close-button=${this.noCloseButton}
              >${this.#slots.has('heading') ? html`<slot name="heading" slot="title"></slot>` : nothing}</tct-dialog-header
            >`
          : nothing
      }
      <slot></slot>
    </div>`;

    // Inline mode (documentation previews): the same box without the dialog behaviour.
    if (this.inline) {
      return this.open
        ? html`<div
            class="dialog inline"
            part="dialog"
            data-variant=${variant}
            ?data-positioned=${position !== undefined}
            style=${style}
          >
            ${content}
          </div>`
        : nothing;
    }
    return html`<dialog
      class="dialog focus-ring"
      part="dialog"
      data-variant=${variant}
      data-purpose=${purpose}
      ?data-positioned=${position !== undefined}
      style=${style}
      aria-modal="true"
      role=${ifDefined(purpose === 'required' ? 'alertdialog' : undefined)}
    >
      ${content}
    </dialog>`;
  }

  // ---------------------------------------------------------------------------------- behaviour

  /** Follows the state: shows or hides the layer. Inline dialogs have none. */
  #follow(): void {
    if (this.inline) {
      if (this.#layer.isOpen) void this.#layer.hide();
      return;
    }
    if (this.open) {
      this.#opened = true;
      this.#setDirection();
      this.#transition = this.#layer.show().then(() => {
        if (this.open) this.#announce(true);
      });
    } else if (this.#layer.isOpen) {
      this.#transition = this.#layer.hide().then(() => {
        if (!this.open) this.#announce(false);
      });
    } else {
      this.#announce(false);
    }
  }

  /** The user (or a close request) asks for a change; the owner may veto with `preventDefault()`. */
  #requestChange(open: boolean, reason: ChangeReason): void {
    if (open === this.open) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  /** `tct-after-open-change` once per actual settled change, programmatic ones included. */
  #announce(open: boolean): void {
    if (this.#lastAfter === undefined && !open && !this.#opened) {
      this.#lastAfter = false; // The initial closed state is not a change.
      return;
    }
    if (this.#lastAfter === open) return;
    this.#lastAfter = open;
    this.dispatch(new TctAfterOpenChangeEvent(open));
  }

  /** `--show`, `--hide` and `--toggle` from a declarative invoker (`commandfor`/`command`). */
  readonly #onCommand = (event: CommandLikeEvent): void => {
    const source = event.source instanceof HTMLElement ? event.source : null;
    switch (event.command) {
      case '--show':
      case 'show-modal':
        this.#invoker = source;
        this.#requestChange(true, 'trigger');
        break;
      case '--hide':
      case 'close':
      case 'request-close':
        this.#requestChange(false, 'trigger');
        break;
      case '--toggle':
        this.#invoker = source;
        this.#requestChange(!this.open, 'trigger');
        break;
    }
  };

  /**
   * `<form method="dialog">` in the content closes its nearest ancestor `<dialog>`, but ours is in a shadow
   * root, so the platform finds none: the form's submission is the user's request to close.
   */
  readonly #onSubmit = (event: SubmitEvent): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.method !== 'dialog') return;
    event.preventDefault();
    this.requestClose('request');
  };

  /**
   * Where focus goes on open: an `autofocus` element of yours, else the heading, else the dialog itself.
   * A target that has not rendered yet (a dialog that is open from the start, before its header or field
   * has had its first update) cannot take focus, so it is focused as soon as it can, if focus is idle.
   */
  #initialFocus(): HTMLElement | null {
    const own = this.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
    const heading = own ? null : (this.#header?.headingElement ?? null);
    // A heading of your own may not be focusable yet: focusable by script, never a tab stop.
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    const target = own ?? heading;
    const owner = (own ?? this.#header) as unknown as {
      hasUpdated?: boolean;
      updateComplete?: Promise<unknown>;
    } | null;
    if (target && owner?.hasUpdated === false && owner.updateComplete) {
      void owner.updateComplete.then(() => {
        const active = deepActiveElement();
        const idle = active === this.#surface || active === null || active === document.body;
        if (this.open && this.#layer.isOpen && idle) target.focus({preventScroll: true});
      });
      return null;
    }
    return target;
  }

  /** The offset of the opener from the viewport centre: the dialog enters from, and leaves to, that side. */
  #setDirection(): void {
    const surface = this.#surface;
    if (!surface) return;
    const opener = this.#invoker ?? deepActiveElement();
    let x = 0;
    let y = 16; // design: upstream's 16px rise from below when there is no opener to point at
    if (opener && opener !== document.body && opener.isConnected) {
      const rect = opener.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - innerWidth / 2;
      const dy = rect.top + rect.height / 2 - innerHeight / 2;
      const distance = Math.hypot(dx, dy) || 1;
      x = Math.round((dx / distance) * 16);
      y = Math.round((dy / distance) * 16);
    }
    surface.style.setProperty('--_dir-x', `${x}px`);
    surface.style.setProperty('--_dir-y', `${y}px`);
  }

  /** Exit: a fade, plus the reverse of the entry movement unless motion is reduced; the backdrop fades too. */
  #exitAnimations(): Animation[] {
    const surface = this.#surface;
    if (!surface) return [];
    const duration = cssDuration(surface, '--duration-medium', 410);
    const still = prefersReducedMotion();
    const animations = [
      surface.animate(
        still
          ? [{opacity: 1}, {opacity: 0}]
          : [
              {opacity: 1, transform: 'translate(0, 0) scale(1)'},
              {
                opacity: 0,
                transform: 'translate(var(--_dir-x, 0px), var(--_dir-y, 16px)) scale(0.95)',
              },
            ],
        {duration: still ? duration / 2 : duration, easing: 'cubic-bezier(0.24, 1, 0.4, 1)'},
      ),
    ];
    if (features.popover) {
      try {
        animations.push(
          surface.animate([{opacity: 1}, {opacity: 0}], {
            duration: still ? duration / 2 : duration,
            pseudoElement: '::backdrop',
          }),
        );
      } catch {
        // Engines that cannot animate the backdrop simply drop it when the dialog closes.
      }
    }
    return animations;
  }

  /** Development guardrail: an open modal has to have a name. Once per element. */
  #warnIfUnnamed(): void {
    if (
      this.hasAttribute('aria-label') ||
      this.hasAttribute('aria-labelledby') ||
      this.#header?.headingElement
    ) {
      return;
    }
    this.#warned = true;
    devWarn(
      'dialog:unnamed',
      'An open <tct-dialog> has no accessible name. Add a heading, a <tct-dialog-header heading="…">, or aria-label / aria-labelledby.',
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dialog': TctDialog;
  }
}

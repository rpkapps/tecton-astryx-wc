import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import chat from '@tecton-wc/locales/en/chat.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {
  getModality,
  trackInteractionModality,
} from '@tecton-wc/core/controllers/interaction-modality.js';
import {TctChatSubmitEvent} from '@tecton-wc/core/events/tct-chat-submit.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {containsFlat} from '@tecton-wc/core/utils/focus.js';
import base from '../styles/base.styles.css';
import {TctIcon} from '../icon/tct-icon.js';
import {warnInvalidValue} from '../text/text.types.js';
import {CHAT_DENSITIES} from '../chat-message/chat-message.types.js';
import {chatComposerContext, type ChatComposerContextValue} from './chat-composer.context.js';
import {
  CHAT_COMPOSER_ELEVATIONS,
  CHAT_COMPOSER_STATUS_POSITIONS,
  CHAT_COMPOSER_STATUS_TYPES,
  type ChatComposerDensity,
  type ChatComposerElevation,
  type ChatComposerInputControl,
  type ChatComposerStatusPosition,
  type ChatComposerStatusType,
} from './chat-composer.types.js';
import {TctChatComposerInput} from './tct-chat-composer-input.js';
import {TctChatSendButton} from './tct-chat-send-button.js';
import styles from './tct-chat-composer.styles.css';

/** Elements whose focus in the body counts as "focus in the editor" for the keyboard ring. */
const EDITOR_SELECTOR =
  'textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], ' +
  'input:not([type]), input[type="text"], input[type="search"], input[type="email"], ' +
  'input[type="url"], input[type="tel"], input[type="password"]';

/** What a click on the body must leave alone: controls, and the editable itself. */
const INTERACTIVE_SELECTOR =
  'button, a, [role="button"], [contenteditable="true"], [contenteditable="plaintext-only"], ' +
  '[data-tct-token], tct-button, tct-icon-button, tct-chat-send-button, tct-chat-dictation-button';

const isStatusType = (value: unknown): value is ChatComposerStatusType =>
  (CHAT_COMPOSER_STATUS_TYPES as readonly unknown[]).includes(value);

/**
 * The shell of a chat composer: it arranges an optional drawer, an optional header, the input, a footer
 * with actions and the send button, and a status strip, in one raised (or bordered) rounded surface, and
 * owns the draft they share. With no slots it is a complete composer: a `tct-chat-composer-input` and a
 * `tct-chat-send-button` inside the body, ready to use.
 *
 * **Slots.** `drawer` (a `tct-chat-composer-drawer`), `header-actions` and `header-context` (icon buttons;
 * context such as a token meter), `input` (replaces the default input: another `tct-chat-composer-input`
 * with triggers, or your own), `footer-actions`, `send-actions` (a dictation button) and `send-button`.
 * Use `size="md"` buttons in the footer slots: they match the send button's height, and they follow the
 * shell's concentric corner radius.
 *
 * **The draft.** `value` is the draft (the attribute is the initial one); the input and the send button
 * read and write it through {@link chatComposerContext}, so a custom input works the same way. Sending (Enter in
 * the input, or the send button) fires the cancelable `tct-chat-submit` with the trimmed draft and clears
 * the draft unless it was prevented; a blank draft or a disabled composer never submits. While a
 * response is running set `stop-shown`: the send button becomes Stop and fires `tct-chat-stop`.
 *
 * **Status.** `status-type` (`error` or `warning`) with `status-message` shows a tinted strip above or
 * below the body (`status-position`). The message is announced once through the shared announcer when it
 * appears or changes (assertively for an error), never through a live region of the strip itself.
 *
 * **Focus.** A click on the body's empty space focuses the input, with the caret after the draft. The
 * keyboard focus ring is drawn around the whole body while the editor has keyboard focus; pointer focus
 * draws none. `disabled` dims the body and blocks the pointer, but the Stop action stays operable.
 *
 * @summary The message-entry shell of a chat: draft, input, actions, send button and status.
 * @tag tct-chat-composer
 * @upstream ChatComposer
 * @slot drawer - A collapsible drawer above the body (`tct-chat-composer-drawer`): attachments, context chips.
 * @slot header-actions - Actions at the start of the header (attach, mention); icon-only `size="sm"` buttons.
 * @slot header-context - Contextual information at the end of the header (a context-window meter).
 * @slot input - Replaces the default `tct-chat-composer-input`.
 * @slot footer-actions - Actions at the start of the footer; `size="md"` buttons.
 * @slot send-actions - Actions before the send button (a dictation button); `size="md"` buttons.
 * @slot send-button - Replaces the default `tct-chat-send-button`.
 * @csspart base - The root that holds the drawer, the body and the status strip (theme target `chat-composer`).
 * @csspart body - The raised or bordered surface.
 * @csspart header - The header row.
 * @csspart input - The box around the input slot.
 * @csspart footer - The footer row.
 * @csspart status - The status strip.
 * @cssprop --chat-composer-radius - Outer corner radius of the body; inner buttons derive theirs concentrically. Default `--radius-chat`.
 * @cssprop --chat-composer-padding - Padding of the body, used in the concentric radius. Default `--spacing-3`.
 * @fires {TctChatSubmitEvent} tct-chat-submit - The user submitted a non-blank draft; cancelable (keeps the draft).
 * @fires {TctChatStopEvent} tct-chat-stop - Stop was activated on the send button while `stop-shown` is set (bubbles up from the send button).
 * @fires input - Native `input` from the input, retargeted: after every edit of the draft (bubbles up from the input).
 * @cloakDisplay block
 */
export class TctChatComposer extends TctElement {
  static override readonly tagName = 'tct-chat-composer';
  static override readonly dependencies = [TctChatComposerInput, TctChatSendButton, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /**
   * The draft. The attribute is the initial draft; the property is the current one, kept in step with the
   * input. Writing it replaces the draft without firing events. Cleared after a submit that was not prevented.
   */
  @property() value = '';

  /** Placeholder of the default input. Default: the localised "Type a message…". */
  @property() placeholder: string | undefined;

  /** Disables the composer: the input is not editable, the send state cannot be activated. Stop still works. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Shows Stop instead of Send: a response is running. Upstream `isStopShown`. */
  @property({type: Boolean, reflect: true, attribute: 'stop-shown'}) stopShown = false;

  /** Spacing of the body: `compact`, `balanced` (default) or `spacious`. Compact tightens the padding. */
  @property({reflect: true}) density: ChatComposerDensity = 'balanced';

  /** Resting elevation: `low` (default, raised, deepening on hover and focus) or `none` (flat with a border). */
  @property({reflect: true}) elevation: ChatComposerElevation = 'low';

  /** Severity of the status strip: `error` or `warning`. Unset: no strip. (Upstream `status.type`.) */
  @property({reflect: true, attribute: 'status-type'}) statusType: ChatComposerStatusType | undefined;

  /** Text of the status strip (upstream `status.message`). */
  @property({attribute: 'status-message'}) statusMessage: string | undefined;

  /** Which side of the body the status strip sits on: `bottom` (default) or `top`. */
  @property({reflect: true, attribute: 'status-position'})
  statusPosition: ChatComposerStatusPosition = 'bottom';

  @state() private keyboardFocus = false;

  readonly #locale: LocaleController = new LocaleController(this, {defaults: chat});
  readonly #slots: SlotController = new SlotController(
    this,
    'header-actions',
    'header-context',
    'input',
    'send-button',
  );
  #inputControl: ChatComposerInputControl | null = null;
  #lastAnnounced = '';
  #context: ChatComposerContextValue = {
    value: '',
    setValue: (value) => {
      this.#setValue(value);
    },
    submit: (value) => this.#submit(value),
    placeholder: '',
    disabled: false,
    stopShown: false,
    canSend: false,
    registerInput: (control) => {
      this.#inputControl = control;
    },
  };
  readonly #provider: ContextProvider<typeof chatComposerContext> = new ContextProvider<
    typeof chatComposerContext
  >(this, {context: chatComposerContext, initialValue: this.#context});

  #setValue(value: string): void {
    if (value !== this.value) this.value = value;
  }

  /** Trims, ignores a blank draft or a disabled composer, asks with `tct-chat-submit`, clears the draft. */
  #submit(value: string): boolean {
    const text = value.trim();
    if (text === '' || this.disabled) return false;
    if (!this.dispatch(new TctChatSubmitEvent(text))) return false;
    this.#setValue('');
    return true;
  }

  get #placeholder(): string {
    return this.placeholder ?? this.#locale.t('@tct.chat.composer.placeholder');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The keyboard ring needs to know whether focus arrived by keyboard: tracking starts before the first press.
    trackInteractionModality();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('density')) {
      warnInvalidValue('tct-chat-composer', 'density', this.density, CHAT_DENSITIES);
    }
    if (changed.has('elevation')) {
      warnInvalidValue('tct-chat-composer', 'elevation', this.elevation, CHAT_COMPOSER_ELEVATIONS);
    }
    if (changed.has('statusPosition')) {
      warnInvalidValue(
        'tct-chat-composer',
        'status-position',
        this.statusPosition,
        CHAT_COMPOSER_STATUS_POSITIONS,
      );
    }
    const next: ChatComposerContextValue = {
      ...this.#context,
      value: this.value,
      placeholder: this.#placeholder,
      disabled: this.disabled,
      stopShown: this.stopShown,
      canSend: this.value.trim().length > 0 && !this.disabled,
    };
    const previous = this.#context;
    if (
      next.value !== previous.value ||
      next.placeholder !== previous.placeholder ||
      next.disabled !== previous.disabled ||
      next.stopShown !== previous.stopShown ||
      next.canSend !== previous.canSend
    ) {
      this.#context = next;
      this.#provider.setValue(next);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('statusType') || changed.has('statusMessage')) this.#announceStatus();
  }

  /** The status strip is text, not a live region: the announcer speaks it once when it appears or changes. */
  #announceStatus(): void {
    const message = isStatusType(this.statusType) ? (this.statusMessage ?? '') : '';
    const key = `${this.statusType ?? ''}:${message}`;
    if (key === this.#lastAnnounced) return;
    this.#lastAnnounced = key;
    if (message !== '') {
      announce(message, {politeness: this.statusType === 'error' ? 'assertive' : 'polite'});
    }
  }

  override render(): TemplateResult {
    const elevation = (CHAT_COMPOSER_ELEVATIONS as readonly string[]).includes(this.elevation)
      ? this.elevation
      : 'low';
    const hasHeader = this.#slots.has('header-actions') || this.#slots.has('header-context');
    return html`<div
      class="base"
      part="base"
      data-density=${(CHAT_DENSITIES as readonly string[]).includes(this.density)
        ? this.density
        : 'balanced'}
      ?data-disabled=${this.disabled}
      ?data-stop=${this.stopShown}
    >
      ${this.statusPosition === 'top' ? this.#renderStatus('top') : nothing}
      <slot name="drawer"></slot>
      <div
        class="body"
        part="body"
        data-elevation=${elevation}
        ?data-keyboard-focus=${this.keyboardFocus}
        @click=${this.#onBodyClick}
        @pointerdown=${this.#onBodyPointerDown}
        @focusin=${this.#onFocusIn}
        @focusout=${this.#onFocusOut}
      >
        ${
          hasHeader
            ? html`<div class="header" part="header">
                <div class="header-start"><slot name="header-actions"></slot></div>
                <div class="header-end"><slot name="header-context"></slot></div>
              </div>`
            : nothing
        }
        <div class="input-area" part="input">
          <slot name="input"
            >${this.#slots.has('input') ? nothing : html`<tct-chat-composer-input></tct-chat-composer-input>`}</slot
          >
        </div>
        <div class="footer" part="footer">
          <div class="footer-start"><slot name="footer-actions"></slot></div>
          <div class="footer-end">
            <slot name="send-actions"></slot>
            <slot name="send-button"
              >${this.#slots.has('send-button') ? nothing : html`<tct-chat-send-button></tct-chat-send-button>`}</slot
            >
          </div>
        </div>
      </div>
      ${this.statusPosition !== 'top' ? this.#renderStatus('bottom') : nothing}
    </div>`;
  }

  #renderStatus(position: 'top' | 'bottom'): TemplateResult | typeof nothing {
    const type = this.statusType;
    if (!isStatusType(type)) return nothing;
    return html`<div class="status" part="status" data-type=${type} data-position=${position}>
      <tct-icon name=${type} size="md" color=${type}></tct-icon>
      ${this.statusMessage ?? nothing}
    </div>`;
  }

  // ---------------------------------------------------------------------------------- events

  /** A click on the body's empty space focuses the input (never a click on a control or the editable). */
  readonly #onBodyClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    const body = event.currentTarget as HTMLElement;
    for (const node of path) {
      if (node === body) break;
      if (node instanceof Element && node.matches(INTERACTIVE_SELECTOR)) return;
    }
    // The registered control works for any input shape; the query is the fallback for a bare custom input.
    if (this.#inputControl) {
      this.#inputControl.focus();
      return;
    }
    this.querySelector<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"], textarea')?.focus();
  };

  readonly #onBodyPointerDown = (): void => {
    this.keyboardFocus = false;
  };

  readonly #onFocusIn = (event: FocusEvent): void => {
    const origin = event.composedPath()[0];
    this.keyboardFocus =
      origin instanceof Element && origin.matches(EDITOR_SELECTOR) && getModality() === 'keyboard';
  };

  readonly #onFocusOut = (event: FocusEvent): void => {
    const body = event.currentTarget as HTMLElement;
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !containsFlat(body, next)) this.keyboardFocus = false;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-composer': TctChatComposer;
  }
}

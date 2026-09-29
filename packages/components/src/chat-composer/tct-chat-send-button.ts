import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/chatSendButton.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctChatSendEvent} from '@tecton-wc/core/events/tct-chat-send.js';
import {TctChatStopEvent} from '@tecton-wc/core/events/tct-chat-stop.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {warnInvalidValue} from '../text/text.types.js';
import base from '../styles/base.styles.css';
import {TctButton} from '../button/tct-button.js';
import {chatComposerContext} from './chat-composer.context.js';
import {CHAT_COMPOSER_BUTTON_SIZES, type ChatComposerButtonSize} from './chat-composer.types.js';
import styles from './tct-chat-send-button.styles.css';

/** A boolean attribute that is `undefined` (unset) without it, so "not given" and "false" differ. */
const optionalBoolean = {
  fromAttribute: (value: string | null): boolean | undefined => (value === null ? undefined : true),
  toAttribute: (value: boolean | undefined): string | null => (value ? '' : null),
};

/**
 * The send button of a chat composer: a primary icon button that sends the draft, which becomes a
 * secondary Stop button while a response is running. Inside `tct-chat-composer` it needs no
 * configuration: it is enabled while there is something to send, shows Stop while the composer's
 * `stop-shown` is set, and a click submits the draft. The composer renders one by default; put yours in
 * the composer's `send-button` slot to customise, or use it on its own.
 *
 * Activating it in the send state fires the cancelable `tct-chat-send` (its default action inside a
 * composer is to submit the draft, and `preventDefault()` replaces that with your own handling); in the
 * stop state it fires `tct-chat-stop`. The stop state stays enabled while the composer is disabled, so a
 * running response can always be stopped. The native `click` still bubbles as usual.
 *
 * @summary The send button of a chat composer, which becomes Stop while a response streams.
 * @tag tct-chat-send-button
 * @upstream ChatSendButton
 * @slot send-icon - Replaces the send arrow.
 * @slot stop-icon - Replaces the stop square.
 * @csspart button - The button (a `tct-button`).
 * @fires {TctChatSendEvent} tct-chat-send - The send state was activated; cancelable (replaces the composer's own submit).
 * @fires {TctChatStopEvent} tct-chat-stop - The stop state was activated.
 * @fires click - Native click on the button, retargeted; one per activation.
 * @cloakDisplay inline-flex
 * @cloakMinBlockSize var(--size-element-md)
 */
export class TctChatSendButton extends TctElement {
  static override readonly tagName = 'tct-chat-send-button';
  static override readonly dependencies = [TctButton];
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Shows the Stop state. Unset: the composer's `stop-shown`, else the send state. Setting it, even
   * without a composer, wins over the composer.
   */
  @property({attribute: 'stop-shown', converter: optionalBoolean}) stopShown: boolean | undefined;

  /**
   * Disables the send state. Unset: disabled while the composer has nothing to send; without a
   * composer the button is enabled. Assigning `false` forces it enabled. The stop state is never disabled.
   */
  @property({converter: optionalBoolean}) disabled: boolean | undefined;

  /** Size of the button: `sm` or `md` (default), the height of the composer's footer row. */
  @property({reflect: true}) size: ChatComposerButtonSize = 'md';

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'chatSendButton',
    defaults: english,
  });
  readonly #slots: SlotController = new SlotController(this, 'send-icon', 'stop-icon');
  readonly #composer: ContextConsumer<typeof chatComposerContext> = new ContextConsumer<
    typeof chatComposerContext
  >(this, {context: chatComposerContext, subscribe: true});

  /** Whether the button is showing Stop right now. */
  get #stopping(): boolean {
    return this.stopShown ?? this.#composer.value?.stopShown ?? false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('size')) {
      warnInvalidValue('tct-chat-send-button', 'size', this.size, CHAT_COMPOSER_BUTTON_SIZES);
    }
  }

  override render(): TemplateResult {
    const stopping = this.#stopping;
    const composer = this.#composer.value;
    const disabled = !stopping && (this.disabled ?? (composer ? !composer.canSend : false));
    const size = (CHAT_COMPOSER_BUTTON_SIZES as readonly string[]).includes(this.size)
      ? this.size
      : 'md';
    const iconSlot = stopping ? 'stop-icon' : 'send-icon';
    const custom = this.#slots.has(iconSlot);
    return html`<tct-button
      class="button"
      part="button"
      variant=${stopping ? 'secondary' : 'primary'}
      size=${size}
      label=${this.#locale.t(stopping ? 'stop' : 'send')}
      icon=${custom ? '' : stopping ? 'stop' : 'arrowUp'}
      icon-only
      ?disabled=${disabled}
      @click=${this.#onClick}
      >${custom ? html`<slot name=${iconSlot} slot="icon"></slot>` : ''}</tct-button
    >`;
  }

  readonly #onClick = (): void => {
    if (this.#stopping) {
      this.dispatch(new TctChatStopEvent());
      return;
    }
    if (this.dispatch(new TctChatSendEvent())) {
      const composer = this.#composer.value;
      composer?.submit(composer.value);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-send-button': TctChatSendButton;
  }
}

import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/chatLayoutScrollButton.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import {TctButton} from '../button/tct-button.js';
import styles from './tct-chat-layout-scroll-button.styles.css';
import type {TctChatMessageList} from './tct-chat-message-list.js';

/**
 * The floating "scroll to bottom" button of a chat: a round ghost button that fades in while the reader
 * is scrolled away from the newest message, and grows a text label (typically "New messages") when
 * something arrived below the fold. The layout shows it by default; pass your own or none to override.
 *
 * The button only reports the click: scrolling is yours (`ChatStreamScrollController.scrollToBottom()`),
 * and so is the `visible` flag (bind it to the scroll controller's `isScrolledUp` and to the new-message
 * flag). Hidden, it is not painted, not focusable and not in the accessibility tree, so it is reachable by
 * keyboard exactly while it is visible.
 *
 * **Focus.** Activating the button hides it, and a control that hides while it holds focus would drop
 * focus on the page. So when the button disappears with focus inside, focus moves on: to `focusTarget`,
 * else to the newest message of the nearest `tct-chat-message-list` (which is where the reader just
 * scrolled to), else nowhere it could be lost. A pointer user who never focused it is left alone.
 *
 * @summary A floating scroll-to-bottom button that grows a label for new messages.
 * @tag tct-chat-layout-scroll-button
 * @upstream ChatLayoutScrollButton
 * @csspart wrapper - The full-width row that centres the pill and keeps the gap above the composer.
 * @csspart pill - The painted pill (theme target `chat-layout-scroll-button`).
 * @csspart button - The button inside the pill.
 * @fires click - Native click on the button, retargeted to the host; one per activation.
 * @cloakDisplay block
 */
export class TctChatLayoutScrollButton extends TctElement {
  static override readonly tagName = 'tct-chat-layout-scroll-button';
  static override readonly dependencies = [TctButton];
  static override styles: CSSResultGroup = [base, styles];

  /** Whether the button is shown (upstream `isVisible`). Bind it to the reader being scrolled up. */
  @property({type: Boolean, reflect: true}) visible = false;

  /**
   * Text that widens the pill, for instance "New messages", to signal unread content below. Unset, the
   * button is an icon labelled "Scroll to bottom".
   */
  @property() label: string | undefined;

  /**
   * Where focus goes when the button hides while holding it: an element, or a function returning one.
   * Unset: the newest message of the nearest `tct-chat-message-list`.
   */
  @property({attribute: false}) focusTarget: HTMLElement | (() => HTMLElement | null) | null = null;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'chatLayoutScrollButton',
    defaults: english,
  });

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Before the render makes the pill inert: an inert focused element drops focus to the page.
    if (changed.has('visible') && !this.visible && changed.get('visible') === true) {
      if (this.matches(':focus-within')) this.#moveFocusAway();
    }
  }

  override render(): TemplateResult {
    const text = this.label || this.#locale.t('scrollToBottom');
    return html`<div class="wrapper" part="wrapper">
      <div
        class="pill"
        part="pill"
        ?data-visible=${this.visible}
        ?data-label=${Boolean(this.label)}
        ?inert=${!this.visible}
      >
        <tct-button
          class="button"
          part="button"
          variant="ghost"
          size="md"
          icon="chevronDown"
          label=${text}
          ?icon-only=${!this.label}
          >${this.label ?? ''}</tct-button
        >
      </div>
    </div>`;
  }

  #moveFocusAway(): void {
    const target = this.focusTarget;
    const wanted = typeof target === 'function' ? target() : target;
    if (wanted) {
      wanted.focus({preventScroll: true});
      return;
    }
    // The nearest list: the layout's own shadow root holds this button, and the list is its light DOM.
    const root = this.getRootNode();
    let scope: Element | null = root instanceof ShadowRoot ? root.host : this.parentElement;
    while (scope) {
      const list = scope.querySelector<TctChatMessageList>('tct-chat-message-list');
      if (list) {
        list.focusLatestMessage();
        return;
      }
      scope = scope.parentElement;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-layout-scroll-button': TctChatLayoutScrollButton;
  }
}

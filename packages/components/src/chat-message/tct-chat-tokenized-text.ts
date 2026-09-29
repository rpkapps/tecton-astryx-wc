import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import {TctBadge} from '../badge/tct-badge.js';
import {TctIcon} from '../icon/tct-icon.js';
import type {ChatToken} from './chat-message.types.js';
import {isCustomToken, splitTokens} from './chat-message.tokens.js';
import styles from './tct-chat-tokenized-text.styles.css';

/**
 * Message text with token values replaced by inline content: `@mentions`, `#tags` or `/commands` in
 * stored text become badges (or whatever a custom token renders). With no matching token the text
 * renders as it is, so it can wrap every message body unconditionally.
 *
 * The text is the `text` attribute, else the element's own text content (a streaming message can
 * keep appending to it). Everything is rendered through Lit templates: the text and any string a
 * custom token returns are text nodes, never HTML, so a message that contains markup shows it as
 * characters. Custom tokens may return a Lit template or a DOM node the caller built.
 *
 * The component is inline and inert: no role, no focus, no live region. A screen reader reads the
 * unmatched text and the token content in order; keep the message understandable without the tokens'
 * styling.
 *
 * @summary Message text with serialized token values shown as inline badges.
 * @tag tct-chat-tokenized-text
 * @upstream ChatTokenizedText
 * @csspart base - The inline root (theme target `chat-tokenized-text`).
 * @csspart token - The inline wrapper of one rendered token.
 * @cloakDisplay inline
 */
export class TctChatTokenizedText extends TctElement {
  static override readonly tagName = 'tct-chat-tokenized-text';
  static override readonly dependencies = [TctBadge, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** The message text with serialized token values in it. When unset the element's text content is used. */
  @property() text: string | undefined;

  /**
   * Token definitions, in match order. A structured token is `{value, label, variant?, icon?}` and
   * renders a badge; a custom token is `{value, render}`. Empty values are ignored.
   */
  @property({attribute: false}) tokens: readonly ChatToken[] | undefined;

  #observer: MutationObserver | undefined;

  /**
   * The text as displayed: token values replaced by their labels (a custom token contributes its
   * `value`). The message list reads this to announce the message the way it looks.
   */
  get announcementText(): string {
    return splitTokens(this.#source(), this.tokens ?? [])
      .map((part) =>
        typeof part === 'string'
          ? part
          : 'label' in part.token && part.token.label !== undefined
            ? part.token.label
            : part.token.value,
      )
      .join('');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Text set on the element itself can change in place (a stream appends to it).
    this.#observer ??= new MutationObserver(() => {
      this.requestUpdate();
    });
    this.#observer.observe(this, {childList: true, characterData: true, subtree: true});
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  override render(): TemplateResult {
    const parts = splitTokens(this.#source(), this.tokens ?? []);
    return html`<span class="base" part="base"
      >${parts.map((part) => (typeof part === 'string' ? part : this.#renderToken(part.token)))}</span
    >`;
  }

  #source(): string {
    return this.text ?? this.textContent;
  }

  #renderToken(token: ChatToken): TemplateResult {
    return html`<span class="token" part="token"
      >${
        isCustomToken(token)
          ? token.render()
          : html`<tct-badge variant=${token.variant ?? 'neutral'} label=${token.label ?? ''}
              >${
                token.icon ? html`<tct-icon slot="icon" name=${token.icon}></tct-icon>` : nothing
              }</tct-badge
            >`
      }</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-tokenized-text': TctChatTokenizedText;
  }
}

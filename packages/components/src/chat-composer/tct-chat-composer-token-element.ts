import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import chat from '@tecton-wc/locales/en/chat.js';
import chatComposer from '@tecton-wc/locales/en/chat-composer.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctChatTokenExpandEvent} from '@tecton-wc/core/events/tct-chat-token-expand.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import base from '../styles/base.styles.css';
import {TctBadge} from '../badge/tct-badge.js';
import {BADGE_VARIANTS, type BadgeVariant} from '../badge/badge.types.js';
import {TctButton} from '../button/tct-button.js';
import {isCustomToken} from '../chat-message/chat-message.tokens.js';
import {TctHoverCard} from '../hover-card/tct-hover-card.js';
import {TctIcon} from '../icon/tct-icon.js';
import type {ChatComposerToken} from './chat-composer.types.js';
import styles from './tct-chat-composer-token-element.styles.css';

const english = {...chat, ...chatComposer};

/** How many lines and characters a text holds. */
export function countText(text: string): {lines: number; chars: number} {
  return {lines: text.split('\n').length, chars: text.length};
}

/**
 * One inline token chip of a chat draft: a badge (`value`, `label`, `variant`, `icon`) or whatever a
 * custom token renders, as one atomic piece of text. `tct-chat-composer-input` creates them inside its
 * editable surface, and they can also be used on their own (a drawer of context chips, a story).
 *
 * The token names itself for assistive technology: the chip is an image (`role="img"`) whose name is the
 * label (else the value), so a screen reader reads "Ada Lovelace" where the chip sits in the draft, as
 * one unit. Set `expandable` for a long pasted text: the chip is labelled with how many lines and
 * characters it holds, hovering it previews the text in a hover card, and the card's Expand button asks
 * the input to dissolve the token into editable text (`tct-chat-token-expand`, cancelable). The card is a
 * pointer enhancement outside the image (an interactive control must not sit inside one); inside an input,
 * a keyboard user selects the chip (Shift+Arrow) and presses Enter to expand it.
 *
 * The token is inert: no focus stop of its own (inside the draft the caret steps over it and Backspace
 * or Delete removes it as a unit). A custom `render()` may return a string (text, never HTML), a Lit
 * template or a DOM node the caller built.
 *
 * @summary An inline token chip of a chat draft: a badge, or custom content, that is one unit.
 * @tag tct-chat-composer-token-element
 * @upstream ChatComposerTokenElement
 * @csspart base - The wrapper of the chip.
 * @csspart chip - The chip itself: the image that carries the name.
 * @csspart preview - The text preview in the card of an expandable token.
 * @fires {TctChatTokenExpandEvent} tct-chat-token-expand - When Expand is activated on an expandable token; cancelable.
 * @cloakDisplay inline-flex
 */
export class TctChatComposerTokenElement extends TctElement {
  static override readonly tagName = 'tct-chat-composer-token-element';
  static override readonly dependencies = [TctBadge, TctButton, TctHoverCard, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /**
   * The token to show: `{value, label?, variant?, icon?}` for a badge or `{value, render}` for custom
   * content. Wins over the `value`, `label`, `variant` and `icon` attributes.
   */
  @property({attribute: false}) token: ChatComposerToken | undefined;

  /** What the token becomes in the submitted text (attribute form of `token.value`). */
  @property() value = '';

  /** Badge text (attribute form of `token.label`). Default: the localised counts for an expandable token, else the value. */
  @property() label: string | undefined;

  /** Badge variant (attribute form of `token.variant`). */
  @property() variant: BadgeVariant | undefined;

  /** Registered icon name before the label (attribute form of `token.icon`). */
  @property() icon: string | undefined;

  /**
   * A long pasted text: labelled with its line and character counts, previewed in a hover card with an
   * Expand button.
   */
  @property({type: Boolean, reflect: true}) expandable = false;

  readonly #locale: LocaleController = new LocaleController(this, {defaults: english});
  readonly #metaId = uniqueId('tct-chat-token-meta');

  /** The token in effect: the `token` property, else the attributes. */
  get #effective(): ChatComposerToken {
    return (
      this.token ?? {
        value: this.value,
        label: this.label,
        variant: this.variant,
        icon: this.icon,
      }
    );
  }

  /** The name the token has for assistive technology: its label, else its counts or its value. */
  get accessibleName(): string {
    const token = this.#effective;
    if (isCustomToken(token)) return token.value;
    if (token.label) return token.label;
    return this.expandable ? this.#pastedLabel(token.value) : token.value;
  }

  #pastedLabel(text: string): string {
    return this.#locale.t('@tct.chat-composer.pastedText', countText(text));
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant') && this.variant && !BADGE_VARIANTS.includes(this.variant)) {
      this.variant = undefined;
    }
  }

  override render(): TemplateResult {
    const token = this.#effective;
    const name = this.accessibleName;
    if (isCustomToken(token)) {
      return html`<span class="base" part="base"
        ><span class="chip" part="chip" role="img" aria-label=${name}>${token.render()}</span></span
      >`;
    }
    const badge = html`<tct-badge
      variant=${token.variant ?? 'neutral'}
      label=${token.label || (this.expandable ? this.#pastedLabel(token.value) : token.value)}
      >${token.icon ? html`<tct-icon slot="icon" name=${token.icon}></tct-icon>` : nothing}</tct-badge
    >`;
    if (!this.expandable) {
      return html`<span class="base" part="base"
        ><span class="chip" part="chip" role="img" aria-label=${name}>${badge}</span></span
      >`;
    }
    // The chip names the token; the card previews it for the pointer. The card is the chip's sibling, never
    // its child (an image's children are presentational), and the chip is described by the counts, which
    // also stops the hover card copying the whole pasted text into `aria-description`.
    return html`<span class="base" part="base"
      ><tct-hover-card placement="above" alignment="start" hover-indication="never">
        <span
          class="chip"
          part="chip"
          role="img"
          aria-label=${name}
          aria-describedby=${this.#metaId}
          >${badge}</span
        >
        <div slot="content" class="card">
          <div class="preview" part="preview">${token.value}</div>
          <div class="footer">
            <span class="meta" id=${this.#metaId}>${this.#pastedLabel(token.value)}</span>
            <tct-button
              variant="ghost"
              size="sm"
              label=${this.#locale.t('@tct.chat.pastedText.expand')}
              @click=${this.#onExpand}
            ></tct-button>
          </div>
        </div>
      </tct-hover-card>
    </span>`;
  }

  readonly #onExpand = (): void => {
    this.dispatch(new TctChatTokenExpandEvent(this.#effective.value));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-composer-token-element': TctChatComposerTokenElement;
  }
}

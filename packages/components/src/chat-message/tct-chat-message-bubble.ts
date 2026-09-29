import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import {warnInvalidValue} from '../text/text.types.js';
import {chatMessageContext, type ChatMessageContextValue} from './chat-message.context.js';
import {
  CHAT_BUBBLE_GROUPS,
  CHAT_BUBBLE_VARIANTS,
  type ChatBubbleGroup,
  type ChatBubbleVariant,
} from './chat-message.types.js';
import styles from './tct-chat-message-bubble.styles.css';

/** A number is px; anything else is a CSS length used as is (`100%`). */
const toLength = (width: string): string =>
  /^\d+(\.\d+)?$/.test(width.trim()) ? `${width.trim()}px` : width;

/**
 * The chat bubble: a padded, rounded container that reads the sender and density from the enclosing
 * `tct-chat-message`, plus the sender `name` row above it and the `metadata` row below it, both
 * lined up with the bubble's text.
 *
 * Use bubbles the same way on one side of the conversation, and the `ghost` variant for content that
 * needs the same alignment without a visible boundary (an artifact card, attachments): add `width="100%"`
 * to let it span the whole message column. Put `name` on the first bubble of a message and `metadata`
 * on the last; without bubbles use the message's own `name` and `metadata`. A run of bubbles from one
 * sender takes `group="first|middle|last"`, which tightens the corners on the sender's side.
 *
 * The bubble is not a landmark and has no role: it is text in the reading order of its message.
 *
 * @summary The chat bubble with an optional name row above and metadata row below.
 * @tag tct-chat-message-bubble
 * @upstream ChatMessageBubble
 * @slot - The bubble content: text, rich text or any markup.
 * @slot name - Sender name above the bubble, aligned with its text; the `name` attribute is the plain-text form.
 * @slot metadata - Metadata below the bubble, aligned with its text; the `metadata` attribute is the plain-text form.
 * @csspart bubble - The painted bubble (theme target `chat-message-bubble`).
 * @csspart name - The sender name row.
 * @csspart metadata - The metadata row.
 * @cloakDisplay block
 */
export class TctChatMessageBubble extends TctElement {
  static override readonly tagName = 'tct-chat-message-bubble';
  static override styles: CSSResultGroup = [base, styles];

  /** `filled` (default) paints the sender colour; `ghost` keeps the padding and drops the fill. */
  @property({reflect: true}) variant: ChatBubbleVariant = 'filled';

  /**
   * Plain-text sender name above the bubble. The `name` slot takes markup. Use on the first bubble of
   * a message; without a bubble use the message's `name`.
   */
  @property() name = '';

  /**
   * Plain-text metadata below the bubble (a timestamp, say). The `metadata` slot takes markup, for
   * instance a `tct-chat-message-metadata`. Use on the last bubble of a message.
   */
  @property() metadata = '';

  /**
   * Position in a run of bubbles: `first` tightens the corner that faces the next bubble, `middle`
   * both, `last` the one facing the previous. Unset for a standalone bubble (full radius).
   */
  @property({reflect: true}) group: ChatBubbleGroup | undefined;

  /**
   * Width of the bubble: a number is px, a string is a CSS length (`100%`). Replaces the default cap
   * of `max(80%, 280px)`; with `variant="ghost"` it lets custom content span the message column.
   */
  @property() width: string | undefined;

  readonly #message: ContextConsumer<typeof chatMessageContext> = new ContextConsumer<
    typeof chatMessageContext
  >(this, {context: chatMessageContext, subscribe: true});
  readonly #slots: SlotController = new SlotController(this, 'name', 'metadata');
  #reported: ChatMessageContextValue | undefined;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#reported?.reportName(this, false);
    this.#reported = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant')) {
      warnInvalidValue('tct-chat-message-bubble', 'variant', this.variant, CHAT_BUBBLE_VARIANTS);
    }
    if (changed.has('group')) {
      warnInvalidValue('tct-chat-message-bubble', 'group', this.group, CHAT_BUBBLE_GROUPS);
    }
  }

  protected override updated(): void {
    // The message aligns its avatar with the bubble's text, so it needs to know a name row exists.
    const context = this.#message.value;
    if (context) {
      this.#reported = context;
      context.reportName(this, this.#hasName);
    }
  }

  override render(): TemplateResult {
    const context = this.#message.value;
    const variant = (CHAT_BUBBLE_VARIANTS as readonly string[]).includes(this.variant)
      ? this.variant
      : 'filled';
    const group =
      this.group !== undefined && (CHAT_BUBBLE_GROUPS as readonly string[]).includes(this.group)
        ? this.group
        : undefined;
    const width = this.width?.trim() ? toLength(this.width) : undefined;
    const hasMetadata = this.metadata !== '' || this.#slots.has('metadata');
    return html`<div
      class="stack"
      data-sender=${context?.sender ?? 'assistant'}
      data-density=${context?.density ?? 'balanced'}
    >
      ${
        this.#hasName
          ? html`<div class="name" part="name" data-chat-name>
              <slot name="name">${this.name}</slot>
            </div>`
          : nothing
      }
      <div
        class="bubble"
        part="bubble"
        data-variant=${variant}
        data-group=${group ?? nothing}
        style=${width === undefined ? nothing : `--_width: ${width}`}
      >
        <slot></slot>
      </div>
      ${
        hasMetadata
          ? html`<div class="metadata" part="metadata">
              <slot name="metadata">${this.metadata}</slot>
            </div>`
          : nothing
      }
    </div>`;
  }

  get #hasName(): boolean {
    return this.name !== '' || this.#slots.has('name');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-message-bubble': TctChatMessageBubble;
  }
}

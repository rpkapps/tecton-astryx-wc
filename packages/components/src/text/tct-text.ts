import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import layer from '../styles/layer.styles.css';
import typography from '../styles/typography.styles.css';
import styles from './tct-text.styles.css';
import {TruncationTooltip} from './truncation-tooltip.js';
import {
  TEXT_DISPLAYS,
  TEXT_ELEMENTS,
  TEXT_JUSTIFY,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  TEXT_WRAPS,
  TOOLTIP_PLACEMENTS,
  WORD_BREAKS,
  warnInvalidValue,
  type TextColor,
  type TextDisplay,
  type TextElement,
  type TextJustify,
  type TextSize,
  type TextType,
  type TextWeight,
  type TextWrap,
  type TooltipPlacement,
  type WordBreak,
} from './text.types.js';

/**
 * Themed body text with a semantic type, optional truncation and layout helpers.
 *
 * `type` sets size, weight and leading from the type scale; `size` overrides the size only. `max-lines`
 * truncates (one line with an ellipsis, several with a line clamp) and, when the text really is cut
 * off, shows the full text in a tooltip on hover. Prefer `type` alone; reach for `size` only for
 * metrics and callouts. For headings use `tct-heading`.
 *
 * `as` picks the semantics of the host: `p` is a paragraph, `h1`-`h3` are headings (level 1-3), and
 * `span`, `div` and `label` add no role (a `label` does not label a control across the shadow boundary:
 * use the label of `tct-field`).
 *
 * @summary Themed body text with semantic types, truncation with tooltip and layout helpers.
 * @tag tct-text
 * @upstream Text
 * @slot - The text.
 * @csspart text - The text box; carries the typography, truncation and layout.
 * @cloakDisplay inline
 */
export class TctText extends TctElement {
  static override readonly tagName = 'tct-text';
  static override styles: CSSResultGroup = [base, layer, typography, styles];

  /**
   * Semantic text type: `body` (default), `large`, `label`, `supporting`, `code`, `display-1..3`,
   * `inherit` (size, weight, leading and colour from the surrounding text), the Tecton types
   * `medium-strong`, `small-strong`, `tiny`, `large-data`, `medium-data`, `small-data`,
   * `action-medium`, `action-small`, or a custom string you style through `::part(text)`.
   */
  @property({reflect: true}) type: TextType = 'body';

  /** Font size override (keeps the type's weight and leading). Prefer `type` alone. */
  @property({reflect: true}) size: TextSize | undefined;

  /** Colour: `primary`, `secondary`, `disabled`, `placeholder`, `accent` or `inherit`. Default `secondary` for `supporting`, else `primary`. */
  @property({reflect: true}) color: TextColor | undefined;

  /** Font weight override: `normal`, `medium`, `semibold` or `bold`. */
  @property({reflect: true}) weight: TextWeight | undefined;

  /** `inline` (default) or `block`. Truncation and `has-capsize` force block. */
  @property({reflect: true}) display: TextDisplay = 'inline';

  /**
   * Maximum lines before truncation; 0 (default) means no truncation. When the text is cut off a
   * tooltip shows the full text on hover.
   */
  @property({type: Number, attribute: 'max-lines', reflect: true}) maxLines = 0;

  /** Turns the truncation tooltip off (upstream `hasTruncateTooltip={false}`). */
  @property({type: Boolean, attribute: 'no-truncate-tooltip'}) noTruncateTooltip = false;

  /** Where the truncation tooltip sits: `above` (default), `below`, `start` or `end`. */
  @property({attribute: 'truncate-tooltip-placement'})
  truncateTooltipPlacement: TooltipPlacement = 'above';

  /** Word breaking while truncating: `break-all` for one line, `break-word` otherwise, unless set. */
  @property({attribute: 'word-break', reflect: true}) wordBreak: WordBreak | undefined;

  /** Text wrapping: `wrap`, `nowrap`, `balance` or `pretty`. */
  @property({attribute: 'text-wrap', reflect: true}) textWrap: TextWrap | undefined;

  /** Alignment of the text: `start` (default), `center` or `end` (logical, follows the direction). */
  @property({reflect: true}) justify: TextJustify = 'start';

  /** Optical alignment: trims the leading above the cap height and below the baseline (forces block). */
  @property({type: Boolean, attribute: 'has-capsize', reflect: true}) hasCapsize = false;

  /** Strikethrough decoration. */
  @property({type: Boolean, attribute: 'has-strikethrough', reflect: true}) hasStrikethrough =
    false;

  /** Tabular numbers, so digits line up in columns. */
  @property({type: Boolean, attribute: 'has-tabular-numbers', reflect: true})
  hasTabularNumbers = false;

  /** Host semantics: `span` (default), `p` (paragraph), `div`, `label`, or `h1`-`h3` (headings). */
  @property() as: TextElement = 'span';

  readonly #tooltip = new TruncationTooltip(this, {
    target: () => this.shadowRoot?.querySelector<HTMLElement>('.text'),
    maxLines: () => this.#lines,
    disabled: () => this.noTruncateTooltip,
    placement: () => this.truncateTooltipPlacement,
  });

  get #lines(): number {
    return Number.isFinite(this.maxLines) && this.maxLines > 0 ? Math.floor(this.maxLines) : 0;
  }

  /** Whether the text is currently cut off by `max-lines`. */
  get truncated(): boolean {
    return this.#tooltip.isTruncated;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('type') || changed.has('as')) this.#applySemantics();
    this.#warnInvalid(changed);
  }

  /** Semantics of the host through ElementInternals (never a host role attribute). */
  #applySemantics(): void {
    const tag = TEXT_ELEMENTS.includes(this.as) ? this.as : 'span';
    if (tag === 'p') {
      this.internals.role = 'paragraph';
      this.internals.ariaLevel = null;
    } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      this.internals.role = 'heading';
      this.internals.ariaLevel = tag.slice(1);
    } else {
      this.internals.role = null;
      this.internals.ariaLevel = null;
    }
  }

  #warnInvalid(changed: PropertyValues): void {
    const check = (
      attribute: string,
      property: keyof this,
      value: string | undefined,
      allowed: readonly string[],
    ): void => {
      if (changed.has(property)) warnInvalidValue('tct-text', attribute, value, allowed);
    };
    check('size', 'size', this.size, TEXT_SIZES);
    check('weight', 'weight', this.weight, TEXT_WEIGHTS);
    check('display', 'display', this.display, TEXT_DISPLAYS);
    check('word-break', 'wordBreak', this.wordBreak, WORD_BREAKS);
    check('text-wrap', 'textWrap', this.textWrap, TEXT_WRAPS);
    check('justify', 'justify', this.justify, TEXT_JUSTIFY);
    check('as', 'as', this.as, TEXT_ELEMENTS);
    check(
      'truncate-tooltip-placement',
      'truncateTooltipPlacement',
      this.truncateTooltipPlacement,
      TOOLTIP_PLACEMENTS,
    );
  }

  #onSlotChange = (): void => {
    this.#tooltip.measure();
  };

  override render(): TemplateResult {
    const lines = this.#lines;
    return html`<span
        part="text"
        class="text"
        style=${styleMap(lines > 1 ? {'--_lines': String(lines)} : {})}
        ><slot @slotchange=${this.#onSlotChange}></slot></span
      >${this.#tooltip.renderSurface()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-text': TctText;
  }
}

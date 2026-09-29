import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import layer from '../styles/layer.styles.css';
import typography from '../styles/typography.styles.css';
import {
  TEXT_DISPLAYS,
  TEXT_JUSTIFY,
  TEXT_WEIGHTS,
  TEXT_WRAPS,
  TOOLTIP_PLACEMENTS,
  WORD_BREAKS,
  warnInvalidValue,
  type TextColor,
  type TextDisplay,
  type TextJustify,
  type TextWeight,
  type TextWrap,
  type TooltipPlacement,
  type WordBreak,
} from '../text/text.types.js';
import {TruncationTooltip} from '../text/truncation-tooltip.js';
import {HEADING_LEVELS, type HeadingLevel, type HeadingType} from './heading.types.js';
import styles from './tct-heading.styles.css';

/**
 * A semantic heading (h1 to h6) with themed sizing from the type scale and optional truncation.
 *
 * The host is the heading: `level` sets the semantic level and, unless `type` is set, the visual step
 * (heading 1 to 6 follow Tecton's 24, 20, 16, 14, 12 and 10 px scale). Use `accessibility-level` when the
 * document outline should differ from the visual level (a sidebar heading, a reused component). `type`
 * switches to the display scale for hero titles and data callouts while the level keeps the semantics.
 * Never skip levels in the outline.
 *
 * @summary A semantic h1 to h6 heading with themed sizing, display types and truncation with tooltip.
 * @tag tct-heading
 * @upstream Heading
 * @slot - The heading content.
 * @csspart text - The text box (Astryx target `astryx-heading`); carries the typography, truncation and layout.
 * @cloakDisplay block
 */
export class TctHeading extends TctElement {
  static override readonly tagName = 'tct-heading';
  static override styles: CSSResultGroup = [base, layer, typography, styles];

  /**
   * Heading level 1 to 6: the semantic level and, unless `type` is set, the visual step. Default 2
   * (upstream requires it; an invalid value falls back to 2).
   */
  @property({type: Number, reflect: true}) level: HeadingLevel = 2;

  /**
   * Display type: `display-1`, `display-2`, `display-3` (larger, lighter, tighter) or a custom string
   * you style through `::part(text)`. Overrides the visual step from `level`; the level keeps the semantics.
   */
  @property({reflect: true}) type: HeadingType | undefined;

  /** Font weight override: `normal`, `medium`, `semibold` or `bold`. */
  @property({reflect: true}) weight: TextWeight | undefined;

  /**
   * The level announced to assistive technology when the outline differs from the visual `level`
   * (upstream `accessibilityLevel`, exposed as `aria-level`).
   */
  @property({type: Number, attribute: 'accessibility-level'}) accessibilityLevel:
    HeadingLevel | undefined;

  /** Colour: `primary` (default), `secondary`, `disabled`, `placeholder`, `accent` or `inherit`. */
  @property({reflect: true}) color: TextColor = 'primary';

  /** `block` (default) or `inline`. Truncation and `has-capsize` force block. */
  @property({reflect: true}) display: TextDisplay = 'block';

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

  readonly #tooltip = new TruncationTooltip(this, {
    target: () => this.shadowRoot?.querySelector<HTMLElement>('.text'),
    maxLines: () => this.#lines,
    disabled: () => this.noTruncateTooltip,
    placement: () => this.truncateTooltipPlacement,
  });

  constructor() {
    super();
    // The heading role is a default on ElementInternals, never a host attribute [mwg:accessible-web-components].
    this.internals.role = 'heading';
    this.internals.ariaLevel = '2';
  }

  get #lines(): number {
    return Number.isFinite(this.maxLines) && this.maxLines > 0 ? Math.floor(this.maxLines) : 0;
  }

  /** The level in effect: `level` when it is 1 to 6, else 2. */
  get #level(): HeadingLevel {
    return HEADING_LEVELS.includes(this.level) ? this.level : 2;
  }

  /** Whether the text is currently cut off by `max-lines`. */
  get truncated(): boolean {
    return this.#tooltip.isTruncated;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('level') || changed.has('accessibilityLevel')) {
      const announced = this.accessibilityLevel;
      const level = HEADING_LEVELS.includes(announced!) ? announced! : this.#level;
      this.internals.ariaLevel = String(level);
    }
    this.#warnInvalid(changed);
  }

  #warnInvalid(changed: PropertyValues): void {
    if (changed.has('level') && !HEADING_LEVELS.includes(this.level)) {
      devWarn(`heading:level:${this.level}`, `<tct-heading level="${this.level}"> must be 1 to 6.`);
    }
    const check = (
      attribute: string,
      property: keyof this,
      value: string | undefined,
      allowed: readonly string[],
    ): void => {
      if (changed.has(property)) warnInvalidValue('tct-heading', attribute, value, allowed);
    };
    check('weight', 'weight', this.weight, TEXT_WEIGHTS);
    check('display', 'display', this.display, TEXT_DISPLAYS);
    check('word-break', 'wordBreak', this.wordBreak, WORD_BREAKS);
    check('text-wrap', 'textWrap', this.textWrap, TEXT_WRAPS);
    check('justify', 'justify', this.justify, TEXT_JUSTIFY);
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
    'tct-heading': TctHeading;
  }
}

import type {CSSResultGroup, PropertyValues, TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {html as staticHtml} from 'lit/static-html.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {BoxPropsMixin, SPACING_STEPS, type SpacingStep} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {ScrollFocusController} from './scroll-focus.js';
import {STACK_TAGS} from './stack-elements.js';
import {
  oneOf,
  resolveStackAlignment,
  STACK_ALIGNMENTS,
  STACK_CROSS_ALIGNMENTS,
  STACK_DIRECTIONS,
  STACK_ELEMENTS,
  STACK_MAIN_ALIGNMENTS,
  STACK_WRAPS,
  type StackAlignment,
  type StackCrossAlignment,
  type StackDirection,
  type StackElement,
  type StackMainAlignment,
  type StackWrap,
} from './stack.types.js';
import styles from './tct-stack.styles.css';

/**
 * Arranges its children in a horizontal or vertical flex layout with token-based spacing.
 *
 * The children are the flex items of an inner `part="base"` box (the default slot sits inside it),
 * so the stack behaves exactly like upstream's single root element: `gap`, alignment, wrapping,
 * padding and `scrollable` all act on the slotted children. Sizes (`width`, `height`, `max-width`,
 * `min-height`) size the host itself, so a percentage resolves against the stack's parent.
 * `hstack` and `vstack` are fixed-direction variants. Use `<tct-stack-item>` around a child to
 * control how that one child grows or aligns.
 *
 * `as` picks the element the box renders as (`nav`, `section`, `ul`, ...). `aria-*` attributes on
 * the host are mirrored onto that element when it is not a plain `div`, so
 * `<tct-stack as="nav" aria-label="Breadcrumb">` names the landmark.
 *
 * @summary Flex layout in a row or a column with token-based gap, alignment and padding.
 * @tag tct-stack
 * @upstream Stack
 * @slot - The stack's children, laid out as flex items.
 * @csspart base - The flex container that holds the children and the padding (theme target `stack`).
 * @cloakDisplay flex
 */
export class TctStack extends BoxPropsMixin(TctElement) {
  static override readonly tagName: string = 'tct-stack';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * Direction of the layout: `horizontal` flows items in the inline direction (left to right in
   * LTR), `vertical` top to bottom. Note the value is `horizontal`, not `row`.
   */
  @property({reflect: true}) direction: StackDirection = 'vertical';

  /**
   * Space between items, a spacing-scale step: 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8 or 10. Written as
   * an attribute it is a number: `gap="4"`.
   */
  @property({type: Number}) gap: SpacingStep | undefined;

  /**
   * Horizontal alignment. In a horizontal stack this is the main axis (`justify-content`:
   * start, center, end, between, around, evenly); in a vertical stack it is the cross axis
   * (`align-items`: start, center, end, stretch).
   */
  @property({attribute: 'h-align'}) hAlign: StackAlignment | undefined;

  /**
   * Vertical alignment. In a horizontal stack this is the cross axis (`align-items`); in a
   * vertical stack it is the main axis (`justify-content`).
   */
  @property({attribute: 'v-align'}) vAlign: StackAlignment | undefined;

  /**
   * Main-axis alias (`justify-content`). Resolves to `h-align` when horizontal and `v-align` when
   * vertical; an explicit `h-align` or `v-align` wins. Use `between`, not `space-between`.
   */
  @property() justify: StackMainAlignment | undefined;

  /**
   * Cross-axis alias (`align-items`; upstream `align`). The attribute is `alignment` because
   * browsers give an `align` attribute presentational meaning (`text-align`).
   */
  @property() alignment: StackCrossAlignment | undefined;

  /** Whether items wrap: `nowrap` (default), `wrap`, `wrap-reverse`. */
  @property({reflect: true}) wrap: StackWrap = 'nowrap';

  /**
   * The element the stack box renders as (upstream `as`): `div` (default), `section`, `article`,
   * `aside`, `nav`, `header`, `footer`, `main`, `ul`, `ol` or `li`. A list element gets
   * `role="list"` so list semantics survive `list-style: none` in Safari.
   */
  @property() as: StackElement = 'div';

  /**
   * Enables scrollable overflow (`overflow: auto`) on the stack box. When the stack is itself a
   * flex child that should scroll, wrap it in `<tct-stack-item size="fill" scrollable>`.
   */
  @property({type: Boolean, reflect: true}) scrollable = false;

  /** The direction actually used; fixed-direction subclasses override it. */
  protected get effectiveDirection(): StackDirection {
    return oneOf(STACK_DIRECTIONS, this.direction, 'direction') ?? 'vertical';
  }

  // Sizes go on the host (not part="base"): a percentage width or height must resolve against the
  // stack's parent, which the host is the child of.
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  // The element `aria-*` on the host is mirrored onto: a landmark or list, never a plain div.
  constructor() {
    super();
    ScrollFocusController.attach(this);
  }

  readonly #aria: AriaDelegateController = new AriaDelegateController(this, {
    target: () => {
      const inner = this.renderRoot.querySelector<HTMLElement>('[part~="base"]');
      return inner && inner.localName !== 'div' ? inner : null;
    },
  });

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('hAlign')) oneOf(STACK_ALIGNMENTS, this.hAlign, 'h-align');
    if (changed.has('vAlign')) oneOf(STACK_ALIGNMENTS, this.vAlign, 'v-align');
    if (changed.has('justify')) oneOf(STACK_MAIN_ALIGNMENTS, this.justify, 'justify');
    if (changed.has('alignment')) oneOf(STACK_CROSS_ALIGNMENTS, this.alignment, 'alignment');
    if (changed.has('wrap')) oneOf(STACK_WRAPS, this.wrap, 'wrap');
    if (changed.has('as')) oneOf(STACK_ELEMENTS, this.as, 'as');
    if (changed.has('gap') && this.gap !== undefined && !SPACING_STEPS.includes(this.gap)) {
      devWarn(`stack:gap:${String(this.gap)}`, `gap="${String(this.gap)}" is not a spacing step.`);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#aria.sync();
  }

  override render(): TemplateResult {
    const direction = this.effectiveDirection;
    const {main, cross} = resolveStackAlignment({
      direction,
      hAlign: this.hAlign,
      vAlign: this.vAlign,
      justify: this.justify,
      alignment: this.alignment,
    });
    const name = STACK_ELEMENTS.includes(this.as) ? this.as : 'div';
    const tag = STACK_TAGS[name];
    const wrap = STACK_WRAPS.includes(this.wrap) ? this.wrap : 'nowrap';
    const gap =
      this.gap !== undefined && SPACING_STEPS.includes(this.gap)
        ? `var(--spacing-${String(this.gap).replace('.', '-')})`
        : undefined;
    return staticHtml`<${tag}
      part="base"
      class="base focus-ring"
      role=${ifDefined(name === 'ul' || name === 'ol' ? 'list' : undefined)}
      data-direction=${direction}
      data-wrap=${wrap}
      data-main=${ifDefined(main)}
      data-cross=${ifDefined(cross)}
      ?data-scrollable=${this.scrollable}
      style=${styleMap({'--_gap': gap})}
    ><slot></slot></${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-stack': TctStack;
  }
}

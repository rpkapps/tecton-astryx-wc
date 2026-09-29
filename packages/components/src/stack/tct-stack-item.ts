import type {CSSResultGroup, PropertyValues, TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {html as staticHtml} from 'lit/static-html.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {ScrollFocusController} from './scroll-focus.js';
import {STACK_TAGS} from './stack-elements.js';
import {
  oneOf,
  STACK_ELEMENTS,
  STACK_ITEM_CROSS_ALIGN_SELF,
  STACK_ITEM_SIZES,
  type StackElement,
  type StackItemCrossAlignSelf,
  type StackItemSize,
} from './stack.types.js';
import styles from './tct-stack-item.styles.css';

/**
 * Controls how one child behaves inside a `tct-stack`, `tct-hstack` or `tct-vstack`.
 *
 * The host is the flex item (so `size` and `cross-align-self` act on it), and it always carries the
 * `min-width: 0` / `min-height: 0` reset that lets a flex child shrink and scroll.
 * `<tct-stack-item size="fill" scrollable>` is a complete scroll region: it grows to fill the stack
 * and scrolls its own overflow.
 *
 * @summary Wraps one child of a stack to make it fill the free space, align itself, or scroll.
 * @tag tct-stack-item
 * @upstream StackItem
 * @slot - The item's content.
 * @csspart base - The box that holds the content and scrolls (theme target `stack-item`).
 * @cloakDisplay flex
 */
export class TctStackItem extends TctElement {
  static override readonly tagName = 'tct-stack-item';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * Flex participation: `static` (default) uses the intrinsic size and neither grows nor shrinks;
   * `fill` grows to take the remaining space (items that fill share it evenly).
   */
  @property({reflect: true}) size: StackItemSize = 'static';

  /**
   * Cross-axis alignment for this item only (`align-self`), overriding the stack's own alignment:
   * `start`, `center`, `end` or `stretch`. In a vertical stack this is horizontal alignment.
   */
  @property({attribute: 'cross-align-self', reflect: true}) crossAlignSelf:
    StackItemCrossAlignSelf | undefined;

  /**
   * Enables scrollable overflow (`overflow: auto`) on the item. Combined with `size="fill"` it makes
   * a scroll region that fills the stack.
   */
  @property({type: Boolean, reflect: true}) scrollable = false;

  /**
   * The element the item box renders as: `div` (default), `section`, `article`, `aside`, `nav`,
   * `header`, `footer`, `main`, `ul`, `ol` or `li` (for example `li` inside `<tct-stack as="ul">`).
   */
  @property() as: StackElement = 'div';

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
    if (changed.has('size')) oneOf(STACK_ITEM_SIZES, this.size, 'size');
    if (changed.has('crossAlignSelf')) {
      oneOf(STACK_ITEM_CROSS_ALIGN_SELF, this.crossAlignSelf, 'cross-align-self');
    }
    if (changed.has('as')) oneOf(STACK_ELEMENTS, this.as, 'as');
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#aria.sync();
  }

  override render(): TemplateResult {
    const name = STACK_ELEMENTS.includes(this.as) ? this.as : 'div';
    const tag = STACK_TAGS[name];
    return staticHtml`<${tag}
      part="base"
      class="base focus-ring"
      role=${ifDefined(name === 'ul' || name === 'ol' ? 'list' : undefined)}
      ?data-scrollable=${this.scrollable}
    ><slot></slot></${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-stack-item': TctStackItem;
  }
}

import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {sizeContext, type ElementSize} from '@tecton-astryx/core/context/keys.js';
import {
  KeyboardHintController,
  keyboardHintStyles,
} from '@tecton-astryx/core/controllers/keyboard-hint.js';
import {RovingTabindexController} from '@tecton-astryx/core/controllers/roving-tabindex.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import styles from './tct-toolbar.styles.css';
import {focusableLeaves, updatables} from './toolbar.items.js';
import {
  TOOLBAR_DIVIDERS,
  TOOLBAR_GAPS,
  TOOLBAR_ORIENTATIONS,
  TOOLBAR_VARIANTS,
  type ToolbarDivider,
  type ToolbarGap,
  type ToolbarOrientation,
  type ToolbarVariant,
} from './toolbar.types.js';

/** `dividers="top bottom"` <-> `['top', 'bottom']`: a token list attribute, like `rel`. */
const dividersConverter = {
  fromAttribute: (value: string | null): ToolbarDivider[] =>
    (value ?? '')
      .split(/\s+/)
      .filter((token): token is ToolbarDivider =>
        (TOOLBAR_DIVIDERS as readonly string[]).includes(token),
      ),
  toAttribute: (value: readonly ToolbarDivider[]): string | null =>
    value.length > 0 ? value.join(' ') : null,
};

/**
 * A bar of contextual actions with start, optional centre and end areas, one Tab stop and arrow-key
 * navigation across every control inside it (buttons, inputs, tabs, selectors), like the APG toolbar
 * pattern. Set `size` once and the controls inside follow it.
 *
 * Use it for actions that belong to a region of the page (above a table, in a card header), not as a
 * page header or app-wide navigation.
 *
 * @summary A labelled toolbar with start, centre and end areas and roving arrow-key navigation.
 * @tag tct-toolbar
 * @upstream Toolbar
 * @slot start - Content aligned to the inline start.
 * @slot - Unslotted children: start content too.
 * @slot center - Content centred between start and end.
 * @slot end - Content aligned to the inline end.
 * @csspart toolbar - The bar that lays out the three areas (Astryx target `astryx-toolbar`).
 * @csspart surface - The outer chrome that paints the variant surface and the dividers.
 * @csspart keyboard-hint - The arrow-key hint shown once on first keyboard focus.
 * @cloakDisplay block
 */
export class TctToolbar extends TctElement {
  static override readonly tagName = 'tct-toolbar';
  static override styles: CSSResultGroup = [base, keyboardHintStyles, styles];

  /** Accessible name of the toolbar. Set it, or give the element an `aria-label`. */
  @property({reflect: true}) label = '';

  /** Toolbar size: sets the minimum height and is the default size of the controls inside. */
  @property({reflect: true}) size: ElementSize | undefined;

  /** Gap between items inside each area, as a step of the spacing scale (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). */
  @property({type: Number}) gap: ToolbarGap = 1;

  /** Which arrow keys move focus. */
  @property({reflect: true}) orientation: ToolbarOrientation = 'horizontal';

  /** Surface behind the toolbar. */
  @property({reflect: true}) variant: ToolbarVariant = 'transparent';

  /** Sides that draw a divider rule: any of `top`, `bottom`, `start`, `end` (attribute: space separated). */
  @property({converter: dividersConverter, reflect: true}) dividers: ToolbarDivider[] = [];

  readonly #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  readonly #sizeProvider = new ContextProvider(this, {context: sizeContext, initialValue: null});

  readonly #roving = new RovingTabindexController<HTMLElement>(this, {
    items: () => [...this.children].flatMap((child) => focusableLeaves(child)),
    orientation: () => this.#orientation(),
    wrap: true,
    // Arrow keys stay with a text field while the caret can still move; only at the edge do they leave it.
    caretGuard: true,
  });

  readonly #hint = new KeyboardHintController(this, {orientation: () => this.#orientation()});

  constructor() {
    super();
    this.internals.role = 'toolbar';
  }

  #orientation(): ToolbarOrientation {
    return this.orientation === 'vertical' ? 'vertical' : 'horizontal';
  }

  /** The gap step as a CSS-friendly key (`1.5` -> `1-5`); the stylesheet maps it to `--spacing-*` (no inline styles, CSP-safe). */
  #gapStep(): string {
    const step = TOOLBAR_GAPS.includes(this.gap) ? this.gap : 1;
    return String(step).replace('.', '-');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.#sizeProvider.setValue(this.#size.value);
    if (changed.has('orientation') && !TOOLBAR_ORIENTATIONS.includes(this.orientation)) {
      devWarn(
        'toolbar:orientation',
        `<tct-toolbar orientation="${this.orientation}"> is not one of ${TOOLBAR_ORIENTATIONS.join(', ')}; using "horizontal".`,
      );
    }
    if (changed.has('variant') && !TOOLBAR_VARIANTS.includes(this.variant)) {
      devWarn(
        'toolbar:variant',
        `<tct-toolbar variant="${this.variant}"> is not one of ${TOOLBAR_VARIANTS.join(', ')}; using "transparent".`,
      );
    }
    if (changed.has('gap') && !TOOLBAR_GAPS.includes(this.gap)) {
      devWarn(
        'toolbar:gap',
        `<tct-toolbar gap="${this.gap}"> is not a spacing step (${TOOLBAR_GAPS.join(', ')}); using 1.`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.internals.ariaLabel = this.label || null;
    this.internals.ariaOrientation = this.#orientation();
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'toolbar:label',
        '<tct-toolbar> needs a `label` (or aria-label): it is the accessible name of the toolbar.',
      );
    }
    void this.#settleItems();
  }

  /** Controls inside the toolbar render after it does; once they have, they can take `tabindex`. */
  async #settleItems(): Promise<void> {
    await Promise.all([...this.children].flatMap((child) => updatables(child)));
    this.#roving.update();
  }

  readonly #onSlotChange = (): void => {
    void this.#settleItems();
  };

  override render() {
    const dividers = this.dividers.filter((divider) => TOOLBAR_DIVIDERS.includes(divider));
    return html`<div
      class="surface"
      part="surface"
      data-variant=${TOOLBAR_VARIANTS.includes(this.variant) ? this.variant : 'transparent'}
      data-divider-top=${dividers.includes('top') ? '' : nothing}
      data-divider-bottom=${dividers.includes('bottom') ? '' : nothing}
      data-divider-start=${dividers.includes('start') ? '' : nothing}
      data-divider-end=${dividers.includes('end') ? '' : nothing}
    >
      <div
        class="toolbar"
        part="toolbar"
        data-size=${this.#size.value}
        data-orientation=${this.#orientation()}
        data-gap=${this.#gapStep()}
      >
        <div class="area start">
          <slot name="start" @slotchange=${this.#onSlotChange}></slot>
          <slot @slotchange=${this.#onSlotChange}></slot>
        </div>
        <div class="area center"><slot name="center" @slotchange=${this.#onSlotChange}></slot></div>
        <div class="area end"><slot name="end" @slotchange=${this.#onSlotChange}></slot></div>
        ${this.#hint.render()}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-toolbar': TctToolbar;
  }
}

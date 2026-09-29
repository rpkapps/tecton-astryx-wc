/**
 * Test-only composite (`tct-test-toolbar`): the smallest consumer of `RovingTabindexController`.
 * Items are its element children: native buttons, or `tct-test-chip` wrappers (a shadow host around a
 * native button), which exercises `focusTarget`.
 *
 *   <tct-test-toolbar orientation="horizontal" typeahead>
 *     <button>Bold</button><button>Italic</button><button disabled>Underline</button>
 *   </tct-test-toolbar>
 */
import {html, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {RovingTabindexController, type Orientation} from '@tecton-wc/core/controllers/roving-tabindex.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';

/** A wrapper item: `tabindex` must go on the inner button, never on the shadow host. */
export class TctTestChip extends TctElement {
  static override readonly tagName = 'tct-test-chip';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};

  @property({type: Boolean, reflect: true}) disabled = false;

  get button(): HTMLButtonElement | null {
    return this.renderRoot.querySelector('button');
  }

  override render() {
    return html`<button type="button" ?disabled=${this.disabled}><slot></slot></button>`;
  }
}

export class TctTestToolbar extends TctElement {
  static override readonly tagName = 'tct-test-toolbar';
  static override readonly dependencies = [TctTestChip];

  @property() orientation: Orientation = 'horizontal';
  @property({type: Boolean, attribute: 'no-wrap'}) noWrap = false;
  @property({type: Number, attribute: 'page-size'}) pageSize = 0;
  @property({type: Boolean}) typeahead = false;
  @property({type: Boolean, attribute: 'activate-on-focus'}) activateOnFocus = false;
  @property({type: Boolean, attribute: 'focus-disabled'}) focusDisabled = false;

  /** Text of every item activated through `onActivate`, in order. */
  readonly activated: string[] = [];

  roving!: RovingTabindexController<HTMLElement>;

  /** The controller is created on first connect so it can read the attributes that shape it. */
  override connectedCallback(): void {
    this.roving ??= new RovingTabindexController<HTMLElement>(this, {
      items: () =>
        [...this.children].filter((child): child is HTMLElement => child instanceof HTMLElement),
      orientation: () => this.orientation,
      wrap: !this.noWrap,
      pageSize: this.pageSize || undefined,
      typeahead: this.typeahead,
      focusDisabled: this.focusDisabled,
      activateOnFocus: () => this.activateOnFocus,
      focusTarget: (item) => (item instanceof TctTestChip ? item.button : item),
      isDisabled: (item) =>
        item instanceof TctTestChip ? item.disabled : item.hasAttribute('disabled'),
      onActivate: (item) => {
        this.activated.push(item.textContent.trim());
      },
    });
    super.connectedCallback();
  }

  /**
   * Wrapper items render their inner control after the toolbar does; once they have, the roving
   * controller can write `tabindex` on it (until then it deliberately writes nothing).
   */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    void this.#whenItemsRendered();
  }

  async #whenItemsRendered(): Promise<void> {
    await Promise.all(
      [...this.children].map((child) => (child as Partial<TctElement>).updateComplete),
    );
    this.roving.update();
  }

  override render() {
    return html`<slot
      @slotchange=${() => {
        void this.#whenItemsRendered();
      }}
    ></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-toolbar': TctTestToolbar;
    'tct-test-chip': TctTestChip;
  }
}

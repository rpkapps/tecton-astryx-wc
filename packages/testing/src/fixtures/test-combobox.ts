/**
 * Test-only combobox (`tct-test-combobox`): the smallest consumer of `ActiveDescendantController`.
 * DOM focus stays on the shadow `<input role="combobox">`; the light-DOM `[role=option]` children
 * are highlighted with arrow keys. The input and the options live in different trees, so this
 * exercises ARIA element reflection (Tier 1) and the announce fallback (Tier 2).
 *
 *   <tct-test-combobox><div role="option">Apple</div><div role="option" aria-disabled="true">Fig</div></tct-test-combobox>
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {
  ActiveDescendantController,
  type HighlightSource,
} from '@tecton-astryx/core/controllers/active-descendant.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';

export class TctTestCombobox extends TctElement {
  static override readonly tagName = 'tct-test-combobox';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};

  @property({type: Number, attribute: 'page-size'}) pageSize = 0;
  @property({type: Boolean, attribute: 'no-wrap'}) noWrap = false;

  /** Every highlight change, `text@via`, in order. */
  readonly highlights: string[] = [];
  /** Options the user chose with Enter. */
  readonly chosen: string[] = [];

  descendants!: ActiveDescendantController<HTMLElement>;

  get input(): HTMLInputElement {
    return this.renderRoot.querySelector('input')!;
  }

  get options(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  override connectedCallback(): void {
    this.descendants ??= new ActiveDescendantController<HTMLElement>(this, {
      focusElement: () => this.renderRoot.querySelector('input'),
      items: () => this.options,
      wrap: !this.noWrap,
      pageSize: this.pageSize || undefined,
      onHighlight: (item, via: HighlightSource) => {
        this.highlights.push(`${item?.textContent.trim() ?? 'none'}@${via}`);
      },
    });
    super.connectedCallback();
    this.addEventListener('pointermove', (event) => {
      const option = (event.target as Element).closest<HTMLElement>('[role="option"]');
      if (option) this.descendants.highlight(option, 'pointer');
    });
  }

  override render() {
    return html`<input
        role="combobox"
        aria-expanded="true"
        aria-controls="list"
        @keydown=${(event: KeyboardEvent) => {
          if (this.descendants.handleKeyDown(event)) return;
          if (event.key === 'Enter' && this.descendants.highlighted) {
            this.chosen.push(this.descendants.highlighted.textContent.trim());
          }
        }}
      />
      <div id="list" role="listbox"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-combobox': TctTestCombobox;
  }
}

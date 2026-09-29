import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import type {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {TctValueChangeEvent} from '@tecton-wc/core/events/tct-value-change.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctDropdownMenu} from '../dropdown-menu/tct-dropdown-menu.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import {tabListContext} from './tab-list.context.js';
import type {TabMenuOption} from './tab-list.types.js';
import tabStyles from './tct-tab.styles.css';
import styles from './tct-tab-menu.styles.css';

/**
 * A tab that opens a menu of extra tab options, for a curated group of views that would crowd the strip
 * ("More"). The trigger reads as a tab: it shows the selected option's label (and the selected
 * indicator) while one of its options is the tab list's value, and its own `label` otherwise. The menu is
 * the shared `tct-dropdown-menu`: a menu button (`aria-haspopup="menu"`, `aria-expanded`) whose surface
 * is a `role="menu"` of single-select `menuitemradio` rows. Enter, Space or ArrowDown open it and focus
 * the first row; arrows, Home and End rove; Escape or Tab closes it and focus returns to the trigger.
 * Choosing an option selects that tab value through the tab list (`tct-value-change`, cancelable).
 *
 * It is a stop of the tab list's roving tabindex like a tab, and belongs to the navigation pattern (a
 * tablist owns only tabs).
 *
 * @summary A tab that opens a menu of extra tab options.
 * @tag tct-tab-menu
 * @upstream TabMenu
 * @csspart trigger - The tab-like trigger button (upstream theming target `tab-menu`).
 * @csspart indicator - The selected-tab bar under the trigger.
 * @csspart menu - The painted menu surface (upstream theming target `tab-menu-dropdown`).
 * @csspart menu-heading - The menu's heading, showing `label`.
 * @cssstate selected - One of the options is the tab list's value.
 * @cssstate open - The menu is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens or closes the menu; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the menu opened or closed.
 * @cloakDisplay inline-flex
 */
export class TctTabMenu extends TctElement {
  static override readonly tagName = 'tct-tab-menu';
  static override readonly dependencies = [TctDropdownMenu, TctIcon];
  static override styles: CSSResultGroup = [base, tabStyles, styles];

  /** Text of the trigger while no option is selected, and the heading and name of the menu. Required. */
  @property() label = '';

  /** The menu's options: `{value, label, icon?}`. Each selects that tab value. */
  @property({attribute: false}) options: TabMenuOption[] = [];

  @state() private _open = false;

  readonly #context: ContextConsumer<typeof tabListContext> = new ContextConsumer<
    typeof tabListContext
  >(this, {context: tabListContext, subscribe: true});

  /** The focusable trigger (the strip's roving tabindex writes `tabindex` on it). */
  get control(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('.tab');
  }

  /** The option that is the tab list's value, if any. */
  get selectedOption(): TabMenuOption | undefined {
    const value = this.#context.value?.value ?? '';
    return value === '' ? undefined : this.options.find((option) => option.value === value);
  }

  /**
   * The menu's own disabled state does not exist: it is always a roving stop.
   * @internal
   */
  get disabled(): boolean {
    return false;
  }

  protected override willUpdate(): void {
    if (this.#context.value?.pattern === 'tabs') {
      devWarn(
        'tab-menu:tabs-pattern',
        '<tct-tab-menu> is not valid inside a tab list with pattern="tabs": a tablist owns only tabs. Use the navigation pattern.',
      );
    }
    if (!this.label) {
      devWarn(
        'tab-menu:label',
        '<tct-tab-menu> needs a `label`: it is the trigger text and the name of the menu.',
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('options') || changed.has('label')) this.#context.value?.refresh();
    this.toggleState('selected', this.selectedOption !== undefined);
    this.toggleState('open', this._open);
  }

  /** The radio group asks to change value: the tab list decides (a user choice, cancelable). */
  readonly #onValueChange = (event: TctValueChangeEvent): void => {
    event.stopPropagation();
    event.preventDefault();
    this.#context.value?.select(event.value, event.reason);
  };

  /** The dropdown's own events describe this menu; they bubble out unchanged. State follows the commit. */
  readonly #onAfterOpenChange = (event: Event): void => {
    this._open = (event as TctAfterOpenChangeEvent).open;
  };

  #renderTrigger(selected: TabMenuOption | undefined): TemplateResult {
    const context = this.#context.value;
    const text = selected?.label ?? this.label;
    return html`<button
      slot="trigger"
      type="button"
      class="tab trigger"
      part="trigger"
      data-tab-menu
      tabindex="-1"
      data-size=${context?.size ?? 'md'}
      data-layout=${context?.layout ?? 'hug'}
      data-selected=${selected ? '' : nothing}
      ?data-open=${this._open}
    >
      <span class="label-box"
        ><span class="label">${text}</span
        ><span class="label-sizer" aria-hidden="true">${text}</span></span
      >
      <tct-icon class="chevron" name="chevronDown" size="sm" color="inherit"></tct-icon>
      <span class="indicator" part="indicator" aria-hidden="true"></span>
    </button>`;
  }

  protected override render(): TemplateResult {
    const context = this.#context.value;
    const selected = this.selectedOption;
    return html`<tct-dropdown-menu
      class="menu"
      label=${this.label}
      size=${context?.size ?? 'md'}
      placement="below"
      alignment="start"
      exportparts="menu"
      @tct-after-open-change=${this.#onAfterOpenChange}
    >
      ${this.#renderTrigger(selected)}
      <span class="menu-heading" part="menu-heading" role="presentation">${this.label}</span>
      <tct-dropdown-menu-radio-group
        label=${this.label}
        .value=${context?.value === '' ? undefined : context?.value}
        @tct-value-change=${this.#onValueChange}
      >
        ${this.options.map(
          (option) =>
            html`<tct-dropdown-menu-radio-item
              value=${option.value}
              label=${option.label}
              icon=${option.icon ?? ''}
            ></tct-dropdown-menu-radio-item>`,
        )}
      </tct-dropdown-menu-radio-group>
    </tct-dropdown-menu>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tab-menu': TctTabMenu;
  }
}

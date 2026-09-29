import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from 'lit';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {dropdownMenuContext, type DropdownMenuContextValue} from './dropdown-menu.context.js';
import type {MenuSize} from './dropdown-menu.types.js';
import {slottedLabelText} from './menu-items.js';

/** What every menu row exposes to its controller. */
export interface MenuItemHost extends ReactiveControllerHost, HTMLElement {
  label: string;
  description: string;
  icon: string;
  disabled: boolean;
}

export interface MenuItemOptions {
  /** Whether activating the row also ends the menu (`no-close-on-select`, `close-on-select`). */
  closeOnSelect: () => boolean;
  /**
   * The row's own action, run for an accepted click before the menu closes (a checkbox toggles, a radio
   * selects). Not run for a disabled row.
   */
  activate?: (event: MouseEvent) => void;
  /**
   * Which clicks and pointer moves belong to this row. A submenu row hosts a flyout, whose rows' events
   * bubble through the host: they must not toggle the flyout or steal its highlight.
   */
  accepts?: (event: Event) => boolean;
  /** `destructive` recolours the icon and text. */
  destructive?: () => boolean;
}

export interface RowParts {
  /** Checkbox or radio indicator (slot `marker` of the inner row). */
  marker?: TemplateResult | typeof nothing;
  /** Trailing content beyond the author's `end` slot: the submenu caret or spinner. */
  end?: TemplateResult | typeof nothing;
}

/**
 * The behaviour every menu row shares (upstream `DropdownMenuItem`, `CheckboxItem`, `RadioItem` and the
 * `SubMenu` trigger row all compose `Item` the same way): menu context, single activation, disabled
 * guard, hover-follows-focus, and the painted row built on `tct-item`.
 *
 *  - **One activation path.** A click (pointer, `element.click()` from Enter/Space, assistive
 *    technology) is the only activation: a disabled row swallows it before any consumer listener runs
 *    (`stopImmediatePropagation`, registered first), so `click` fires exactly once and never on a
 *    disabled row.
 *  - **One highlight.** DOM focus is the highlight: a mouse moving over an enabled row focuses it
 *    (`preventScroll`: focusing an off-screen row would scroll it under the still pointer, whose next
 *    move focuses it again, a runaway scroll). Touch and pen have no hover and never move focus.
 */
export class MenuItemController implements ReactiveController {
  readonly #host: MenuItemHost;
  readonly #options: MenuItemOptions;
  readonly #context: ContextConsumer<typeof dropdownMenuContext>;
  readonly slots: SlotController;

  constructor(host: MenuItemHost, options: MenuItemOptions) {
    this.#host = host;
    this.#options = options;
    this.#context = new ContextConsumer(host, {context: dropdownMenuContext, subscribe: true});
    this.slots = new SlotController(host, 'label', 'description', 'icon', 'end');
    host.addController(this);
    // Registered first: it must run before any consumer's `click` listener on the same element.
    host.addEventListener('click', this.#onClick);
    host.addEventListener('pointermove', this.#onPointerMove);
  }

  hostConnected(): void {
    // Nothing to attach: the listeners live for the element's lifetime.
  }

  /** The enclosing menu's context (`null` outside a menu). */
  get menu(): DropdownMenuContextValue | null {
    return this.#context.value ?? null;
  }

  /** The row size, from the menu (`md` outside one). */
  get size(): MenuSize {
    return this.menu?.size ?? 'md';
  }

  /** Text for typeahead and names: the `label` attribute, else the text of `slot="label"`. */
  get menuLabel(): string {
    return this.#host.label.trim() || slottedLabelText(this.#host);
  }

  /** The painted row: `tct-item` with the row's icon, label, description and end content. */
  renderRow(parts: RowParts = {}): TemplateResult {
    const host = this.#host;
    const size = this.size;
    const destructive = this.#options.destructive?.() ?? false;
    const iconSlot = this.slots.has('icon');
    return html`<tct-item
      class="row"
      part="item"
      exportparts="item, item: dropdown-menu-item"
      density=${size === 'sm' ? 'compact' : 'balanced'}
      data-size=${size}
      ?data-destructive=${destructive}
      label=${host.label}
      description=${host.description}
    >
      ${parts.marker ?? nothing}
      ${
        iconSlot
          ? html`<slot name="icon" slot="start"></slot>`
          : host.icon
            ? html`<tct-icon
                slot="start"
                name=${host.icon}
                size="sm"
                color=${destructive ? 'error' : 'secondary'}
              ></tct-icon>`
            : nothing
      }
      ${this.slots.has('label') ? html`<slot name="label" slot="label"></slot>` : nothing}
      ${
        this.slots.has('description')
          ? html`<slot name="description" slot="description"></slot>`
          : nothing
      }
      ${this.slots.has('end') ? html`<slot name="end" slot="end"></slot>` : nothing}
      ${parts.end ?? nothing}
    </tct-item>`;
  }

  // ---------------------------------------------------------------------------------- internals

  readonly #onClick = (event: MouseEvent): void => {
    if (this.#options.accepts && !this.#options.accepts(event)) return;
    if (this.#host.disabled) {
      // Never reaches a consumer's listener, a parent, or the menu: a disabled row does nothing.
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    this.#options.activate?.(event);
    if (this.#options.closeOnSelect()) this.menu?.close('selection');
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (this.#options.accepts && !this.#options.accepts(event)) return;
    if (this.#host.disabled || event.pointerType !== 'mouse') return;
    if (deepActiveElement() !== this.#host) {
      this.#host.focus({preventScroll: true});
    }
  };
}

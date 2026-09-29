import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {TctValueChangeEvent} from '@tecton-astryx/core/events/tct-value-change.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import styles from './tct-collapsible-group.styles.css';
import {collapsibleGroupContext, type CollapsibleGroupContextValue} from './collapsible.context.js';
import {
  COLLAPSIBLE_CHEVRON_POSITIONS,
  COLLAPSIBLE_DENSITIES,
  COLLAPSIBLE_GROUP_TYPES,
  type CollapsibleChevronPosition,
  type CollapsibleDensity,
  type CollapsibleGroupType,
} from './collapsible.types.js';

const tokens = (value: string): string[] => value.split(/\s+/).filter(Boolean);

/**
 * Coordinates the `tct-collapsible` items below it (they need not be direct children: a card around
 * each item works). In `single` mode opening an item closes the others (an accordion); in `multiple`
 * mode items toggle independently. Each item takes part through its `value`.
 *
 * `value` (property) is the open item(s): a string for `single`, a string array for `multiple`. The
 * `value` attribute is the initial state (space separated for `multiple`). A user toggle fires the
 * cancelable `tct-value-change` before anything changes; writing `value` from code fires nothing.
 *
 * With `has-dividers` the group draws the accordion row chrome (hairlines between items, balanced
 * density) for bare collapsibles; without it the group adds no box of its own.
 *
 * @summary Accordion coordination for collapsibles: single or multiple open items, optional row chrome.
 * @tag tct-collapsible-group
 * @upstream CollapsibleGroup
 * @slot - `tct-collapsible` items, directly or nested in other content.
 * @fires tct-value-change - A user toggled an item; cancelable. `value` is the requested selection (string for `single`, `''` when none).
 * @cloakDisplay contents
 */
export class TctCollapsibleGroup extends TctElement {
  static override readonly tagName = 'tct-collapsible-group';
  static override styles: CSSResultGroup = [base, styles];

  /** `single`: one item open at a time (clicking the open item closes it). `multiple`: items toggle independently. */
  @property({reflect: true}) type: CollapsibleGroupType = 'single';

  /** Initial open item(s): one value, or several separated by spaces for `multiple`. */
  @property({attribute: 'value'}) defaultValue = '';

  /** Draw hairline dividers between items (a wrapper box appears; items get `balanced` density unless `density` says otherwise). */
  @property({type: Boolean, attribute: 'has-dividers', reflect: true}) hasDividers = false;

  /** Row density of the items: trigger and content block padding. Defaults to `balanced` with dividers, else none. */
  @property({reflect: true}) density: CollapsibleDensity | undefined;

  /** Chevron position of the items. An item's own `chevron-position` still wins. */
  @property({attribute: 'chevron-position', reflect: true}) chevronPosition:
    CollapsibleChevronPosition | undefined;

  #current: string[] | undefined;
  #lastKey = '';
  #context: CollapsibleGroupContextValue | undefined;
  readonly #provider = new ContextProvider(this, {
    context: collapsibleGroupContext,
    initialValue: null,
  });

  /**
   * The open item(s): a string for `single` (`''` when none), a string array for `multiple`. Until
   * written it follows the `value` attribute.
   */
  @property({attribute: false})
  get value(): string | string[] {
    const open = this.#open();
    return this.type === 'multiple' ? [...open] : (open[0] ?? '');
  }
  set value(value: string | string[] | null | undefined) {
    this.#current = value == null ? [] : Array.isArray(value) ? [...value] : tokens(value);
  }

  #open(): string[] {
    const list = this.#current ?? tokens(this.defaultValue);
    return this.type === 'multiple' ? list : list.slice(0, 1);
  }

  /** A user toggled `value`: ask, then apply. Find-in-page reveals cannot be vetoed, so they skip the ask. */
  readonly #toggle = (item: string, event?: Event): void => {
    const open = this.#open();
    const isOpen = open.includes(item);
    let next: string[];
    if (this.type === 'multiple') next = isOpen ? open.filter((v) => v !== item) : [...open, item];
    else next = isOpen ? [] : [item];
    if (event?.type !== 'beforematch') {
      const requested: string | string[] = this.type === 'multiple' ? next : (next[0] ?? '');
      if (
        !this.dispatch(new TctValueChangeEvent<string | string[]>(requested, this.value, 'trigger'))
      )
        return;
    }
    this.#current = next;
    this.requestUpdate('value');
  };

  #contextValue(): CollapsibleGroupContextValue {
    const density =
      this.density && COLLAPSIBLE_DENSITIES.includes(this.density)
        ? this.density
        : this.hasDividers
          ? 'balanced'
          : null;
    const chevron =
      this.chevronPosition && COLLAPSIBLE_CHEVRON_POSITIONS.includes(this.chevronPosition)
        ? this.chevronPosition
        : null;
    const open = this.#open();
    // A new object only when something the items read changed: each one re-renders every item.
    const key = JSON.stringify([open, this.hasDividers, density, chevron]);
    if (this.#context && key === this.#lastKey) return this.#context;
    this.#lastKey = key;
    const snapshot = new Set(open);
    this.#context = {
      isOpen: (item) => snapshot.has(item),
      toggle: this.#toggle,
      hasDividers: this.hasDividers,
      density,
      chevronPosition: chevron,
    };
    return this.#context;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('type') && !COLLAPSIBLE_GROUP_TYPES.includes(this.type)) {
      devWarn(
        'collapsible-group:type',
        `<tct-collapsible-group type="${this.type}"> is not one of ${COLLAPSIBLE_GROUP_TYPES.join(', ')}; using "single".`,
      );
    }
    this.#provider.setValue(this.#contextValue());
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-collapsible-group': TctCollapsibleGroup;
  }
}

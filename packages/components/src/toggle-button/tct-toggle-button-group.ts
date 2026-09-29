import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import type {ElementSize} from '@tecton-wc/core/context/keys.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import {TctValueChangeEvent} from '@tecton-wc/core/events/tct-value-change.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import styles from './tct-toggle-button-group.styles.css';
import {
  toggleButtonGroupContext,
  type ToggleButtonGroupContextValue,
} from './toggle-button.context.js';
import {
  TOGGLE_BUTTON_GROUP_ORIENTATIONS,
  TOGGLE_BUTTON_GROUP_TYPES,
  type ToggleButtonGroupOrientation,
  type ToggleButtonGroupType,
} from './toggle-button.types.js';

const tokens = (value: string): string[] => value.split(/\s+/).filter(Boolean);

/**
 * Groups `tct-toggle-button` children (identified by their `value`) for exclusive or multiple choice:
 * a labelled `role="group"` of independently focusable toggle buttons (each one is a Tab stop, like any
 * button; the group adds no roving focus). Use `tct-segmented-control` when the options are mutually
 * exclusive and always one of them applies; use `tct-button-group` for plain actions.
 *
 * `value` (property) is the pressed button(s): a string or `null` for `single` (clicking the pressed
 * button releases it), a string array for `multiple`. The `value` attribute is the initial state (space
 * separated for `multiple`). A user toggle fires the cancelable `tct-value-change` before anything
 * changes; writing `value` from code fires nothing.
 *
 * @summary A labelled group of toggle buttons with single or multiple selection.
 * @tag tct-toggle-button-group
 * @upstream ToggleButtonGroup
 * @slot - `tct-toggle-button` children.
 * @csspart group - The layout box that holds the buttons.
 * @fires tct-value-change - A user toggled a button; cancelable. `value` is the requested selection (string or null for `single`).
 * @cssstate disabled - The whole group is disabled.
 * @cloakDisplay inline-flex
 */
export class TctToggleButtonGroup extends TctElement {
  static override readonly tagName = 'tct-toggle-button-group';
  static override styles: CSSResultGroup = [base, styles];

  /** Accessible name of the group. Set it, or give the element an `aria-label`. */
  @property({reflect: true}) label = '';

  /** `single`: one pressed at a time, and pressing it again releases it. `multiple`: any number. */
  @property({reflect: true}) type: ToggleButtonGroupType = 'single';

  /** Initial pressed value(s): one value, or several separated by spaces for `multiple`. */
  @property({attribute: 'value'}) defaultValue = '';

  /** Layout axis. */
  @property({reflect: true}) orientation: ToggleButtonGroupOrientation = 'horizontal';

  /** Default size of the buttons; a button's own `size` wins. Unset follows an enclosing size provider, else `md`. */
  @property({reflect: true}) size: ElementSize | undefined;

  /** Disables every button. A member cannot re-enable itself, but a member may disable itself. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #size: SizeController = new SizeController(this, {
    explicit: () => this.size,
    fallback: 'md',
  });
  #current: string[] | undefined;
  #lastKey = '';
  #context: ToggleButtonGroupContextValue | undefined;
  readonly #provider: ContextProvider<typeof toggleButtonGroupContext> = new ContextProvider<
    typeof toggleButtonGroupContext
  >(this, {
    context: toggleButtonGroupContext,
    initialValue: null,
  });

  constructor() {
    super();
    this.internals.role = 'group';
  }

  /**
   * The pressed button(s): a string or `null` for `single`, a string array for `multiple`. Until
   * written it follows the `value` attribute.
   */
  @property({attribute: false})
  get value(): string | string[] | null {
    const pressed = this.#pressed();
    return this.type === 'multiple' ? [...pressed] : (pressed[0] ?? null);
  }
  set value(value: string | string[] | null | undefined) {
    this.#current = value == null ? [] : Array.isArray(value) ? [...value] : tokens(value);
  }

  #pressed(): string[] {
    const list = this.#current ?? tokens(this.defaultValue);
    return this.type === 'multiple' ? list : list.slice(0, 1);
  }

  /** A user activated `item`: ask, then apply (single: pressing the pressed one releases it). */
  readonly #toggle = (item: string): void => {
    const pressed = this.#pressed();
    const isPressed = pressed.includes(item);
    let next: string[];
    if (this.type === 'multiple')
      next = isPressed ? pressed.filter((v) => v !== item) : [...pressed, item];
    else next = isPressed ? [] : [item];
    const requested: string | string[] | null = this.type === 'multiple' ? next : (next[0] ?? null);
    if (
      !this.dispatch(
        new TctValueChangeEvent<string | string[] | null>(requested, this.value, 'trigger'),
      )
    )
      return;
    this.#current = next;
    this.requestUpdate('value');
  };

  #contextValue(): ToggleButtonGroupContextValue {
    const pressed = this.#pressed();
    const key = JSON.stringify([pressed, this.#size.value, this.disabled]);
    if (this.#context && key === this.#lastKey) return this.#context;
    this.#lastKey = key;
    const snapshot = new Set(pressed);
    this.#context = {
      isPressed: (item) => snapshot.has(item),
      toggle: this.#toggle,
      size: this.#size.value,
      disabled: this.disabled,
    };
    return this.#context;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('type') && !TOGGLE_BUTTON_GROUP_TYPES.includes(this.type)) {
      devWarn(
        'toggle-button-group:type',
        `<tct-toggle-button-group type="${this.type}"> is not one of ${TOGGLE_BUTTON_GROUP_TYPES.join(', ')}; using "single".`,
      );
    }
    if (
      changed.has('orientation') &&
      !TOGGLE_BUTTON_GROUP_ORIENTATIONS.includes(this.orientation)
    ) {
      devWarn(
        'toggle-button-group:orientation',
        `<tct-toggle-button-group orientation="${this.orientation}"> is not one of ${TOGGLE_BUTTON_GROUP_ORIENTATIONS.join(', ')}; using "horizontal".`,
      );
    }
    this.#provider.setValue(this.#contextValue());
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.internals.ariaLabel = this.label || null;
    this.toggleState('disabled', this.disabled);
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'toggle-button-group:label',
        '<tct-toggle-button-group> needs a `label` (or aria-label): it is the accessible name of the group.',
      );
    }
  }

  override render() {
    return html`<div
      class="group"
      part="group"
      data-orientation=${this.orientation === 'vertical' ? 'vertical' : 'horizontal'}
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-toggle-button-group': TctToggleButtonGroup;
  }
}

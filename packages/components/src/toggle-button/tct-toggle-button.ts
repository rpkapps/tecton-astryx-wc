import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctPressedChangeEvent} from '@tecton-astryx/core/events/tct-pressed-change.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {TctButton} from '../button/tct-button.js';
import {warnInvalidValue} from '../text/text.types.js';
import base from '../styles/base.styles.css';
import styles from './tct-toggle-button.styles.css';
import {toggleButtonGroupContext} from './toggle-button.context.js';
import {TOGGLE_BUTTON_ELEVATIONS, type ToggleButtonElevation} from './toggle-button.types.js';

/**
 * A button that toggles between pressed and released: a persistent on/off choice such as a formatting
 * option or a view mode. It is a ghost `tct-button` that exposes `aria-pressed`, and follows a
 * `tct-toggle-button-group` when it has a `value` and sits in one.
 *
 * Standalone it owns its state like a native control: `pressed` is the state (the attribute is the
 * initial one), a user toggle fires the cancelable `tct-pressed-change` before anything changes, and
 * unless prevented the button flips at once. `pressedChangeAction` (property) runs after that for
 * API-backed toggles: the button shows a spinner while it is pending, stays interruptible (a re-click
 * reverses the pending toggle), and reverts the state if the action rejects.
 *
 * Use it for toolbar actions, view-mode switches and formatting controls. For a setting that is
 * on or off, use a switch.
 *
 * @summary A ghost button that toggles between pressed and released, alone or in a group.
 * @tag tct-toggle-button
 * @upstream ToggleButton
 * @slot - Visible label text (replaces `label` as the visible text).
 * @slot icon - Icon shown before the label.
 * @slot pressed-icon - Icon shown instead of `icon` while pressed.
 * @csspart button - The inner `tct-button` (Astryx target `astryx-toggle-button`).
 * @fires tct-pressed-change - A user toggled the button; cancelable. Not fired for a group member (the group fires `tct-value-change`).
 * @cssstate pressed - The button is pressed.
 * @cloakDisplay inline-flex
 */
export class TctToggleButton extends TctElement {
  static override readonly tagName = 'tct-toggle-button';
  static override readonly dependencies = [TctButton];
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, styles];

  /** Accessible label. Visible text unless the default slot has content or `icon-only`; then it is the name and the tooltip. */
  @property() label = '';

  /**
   * Whether the button is pressed. The attribute is the initial state and reflects the current one.
   * Inside a group with a `value`, the group's state wins.
   */
  @property({type: Boolean, reflect: true}) pressed = false;

  /** Identifies the button in a `tct-toggle-button-group`. Without one it is standalone. */
  @property() value = '';

  /** Size `sm`, `md` or `lg`. Unset: the group's size, else the surrounding size, else `md`. */
  @property({reflect: true}) size: ElementSize | undefined;

  /** Resting shadow depth for a floating toggle (`none`, `low`, `med`, `high`). */
  @property({reflect: true}) elevation: ToggleButtonElevation = 'none';

  /** Disables the button. A disabled group also disables it, and a member cannot re-enable itself. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Shows the busy state (a spinner) and blocks activation. A pending `pressedChangeAction` does the same. */
  @property({type: Boolean, reflect: true}) loading = false;

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /** Registered icon name shown while pressed, for an outline-to-filled swap. Falls back to `icon`. */
  @property({attribute: 'pressed-icon'}) pressedIcon = '';

  /** A square icon-only button: `label` becomes the accessible name and the tooltip. */
  @property({type: Boolean, attribute: 'icon-only', reflect: true}) iconOnly = false;

  /** Tooltip text shown on hover and keyboard focus. With `disabled` it becomes the reason. */
  @property() tooltip = '';

  /**
   * Async action for API-backed toggles, called with the requested pressed state after the change.
   * While its promise is pending the button is busy and interruptible; if it rejects the previous
   * state is restored. Ignored for a group member.
   */
  @property({attribute: false}) pressedChangeAction:
    ((pressed: boolean) => void | Promise<void>) | undefined;

  readonly #group = new ContextConsumer(this, {context: toggleButtonGroupContext, subscribe: true});
  readonly #slots = new SlotController(this, 'default', 'icon', 'pressed-icon');
  /** Set when the intent event was prevented: the click must not run the pressed-change action. */
  #skipAction = false;

  constructor() {
    super();
    // `host.click()` and label activation start at the host and never pass through the inner button:
    // hand them to it, so there is one click per activation and the toggle logic runs once.
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] !== this) return;
      event.stopImmediatePropagation();
      this.shadowRoot?.querySelector<HTMLElement>('tct-button')?.click();
    });
  }

  /** Whether the group (not `pressed`) decides the state. */
  get #member(): boolean {
    return this.#group.value !== undefined && this.#group.value !== null && this.value !== '';
  }

  /** The effective pressed state: the group's for a member, else `pressed`. */
  get isPressed(): boolean {
    const group = this.#group.value;
    return this.#member && group ? group.isPressed(this.value) : this.pressed;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('elevation'))
      warnInvalidValue('tct-toggle-button', 'elevation', this.elevation, TOGGLE_BUTTON_ELEVATIONS);
    if (this.label === '' && !this.hasAttribute('aria-label') && !this.#slots.has('default')) {
      devWarn(
        'toggle-button:label',
        '<tct-toggle-button> needs a `label` (or visible text): it is the accessible name.',
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('pressed', this.isPressed);
  }

  /** The click reached the button (it was not blocked): toggle through the group or on its own. */
  readonly #onClick = (event: MouseEvent): void => {
    const group = this.#group.value;
    if (this.#member && group) {
      // A member's selection is group-owned; it has no button action of its own (see render).
      group.toggle(this.value, event);
      return;
    }
    const next = !this.pressed;
    if (!this.dispatch(new TctPressedChangeEvent(next, 'trigger'))) {
      this.#skipAction = true;
      return;
    }
    this.pressed = next;
  };

  /** Runs after the click when it was not cancelled: the async, API-backed part. */
  readonly #action = async (): Promise<void> => {
    if (this.#skipAction) {
      this.#skipAction = false;
      return;
    }
    const action = this.pressedChangeAction;
    if (!action) return;
    const requested = this.pressed;
    try {
      await action(requested);
    } catch (error) {
      // The optimistic change did not land: restore, unless a newer toggle already superseded it.
      if (this.pressed === requested) this.pressed = !requested;
      throw error;
    }
  };

  override render() {
    const group = this.#group.value;
    const member = this.#member;
    const pressed = this.isPressed;
    const size = this.size ?? (member ? group?.size : undefined);
    const disabled = this.disabled || (group?.disabled ?? false);
    const icon = pressed && this.pressedIcon !== '' ? this.pressedIcon : this.icon;
    const hasDefault = this.#slots.has('default');
    const usePressedSlot = pressed && this.#slots.has('pressed-icon');
    // Forward an icon slot only when it has content: an empty forwarded slot would count as icon content
    // in the inner button and reserve a gap.
    const forwardIcon = usePressedSlot || this.#slots.has('icon');
    return html`<tct-button
      class="button"
      part="button"
      variant="ghost"
      size=${ifDefined(size)}
      elevation=${this.elevation}
      label=${this.label}
      icon=${icon}
      tooltip=${this.tooltip}
      aria-pressed=${pressed ? 'true' : 'false'}
      ?icon-only=${this.iconOnly}
      ?disabled=${disabled}
      ?loading=${this.loading}
      interruptible
      data-pressed=${pressed ? '' : nothing}
      .clickAction=${!member && this.pressedChangeAction ? this.#action : undefined}
      @click=${this.#onClick}
      >${hasDefault ? html`<slot></slot>` : nothing}${
        forwardIcon
          ? html`<slot name=${usePressedSlot ? 'pressed-icon' : 'icon'} slot="icon"></slot>`
          : nothing
      }</tct-button
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-toggle-button': TctToggleButton;
  }
}

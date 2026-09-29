import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {
  sizeContext,
  type ButtonGroupContextValue,
  type ElementSize,
} from '@tecton-astryx/core/context/keys.js';
import {RovingTabindexController} from '@tecton-astryx/core/controllers/roving-tabindex.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {focusTargetOf} from '@tecton-astryx/core/utils/focus.js';
import base from '../styles/base.styles.css';
import styles from './tct-button-group.styles.css';
import {
  BUTTON_GROUP_ELEVATIONS,
  BUTTON_GROUP_ORIENTATIONS,
  type ButtonGroupElevation,
  type ButtonGroupOrientation,
} from './button-group.types.js';
import {ButtonGroupMemberContext, groupMembers} from './button-group.members.js';

/**
 * Joins related actions into one connected control: shared edges, rounded outer corners only, and a
 * single Tab stop with arrow-key navigation between the members (the APG roving tabindex technique).
 *
 * Members are light-DOM children (`tct-button`, `tct-icon-button`, `tct-toggle-button`, a menu
 * trigger). Each member learns its own place in the group (`first`, `middle`, `last`, `only`), the
 * orientation, the size and the disabled state through `buttonGroupContext`, and squares its interior
 * corners itself, so the group never reaches into a member's styles.
 *
 * @summary A connected group of related buttons; one Tab stop, arrows move between members.
 * @tag tct-button-group
 * @upstream ButtonGroup
 * @slot - The buttons of the group.
 * @csspart group - The layout box that holds the members and, when `elevation` is set, the shared shadow.
 * @cssstate disabled - The whole group is disabled.
 * @cloakDisplay inline-flex
 */
export class TctButtonGroup extends TctElement {
  static override readonly tagName = 'tct-button-group';
  static override styles: CSSResultGroup = [base, styles];

  /** Accessible name of the group: what its buttons act on. Set it, or give the element an `aria-label`. */
  @property({reflect: true}) label = '';

  /** Layout axis. Arrow keys follow it: left and right when horizontal, up and down when vertical. */
  @property({reflect: true}) orientation: ButtonGroupOrientation = 'horizontal';

  /**
   * Default size for the members; a member's own `size` wins. Without one the size comes from an
   * enclosing `tct-size-provider` or toolbar, else `md`.
   */
  @property({reflect: true}) size: ElementSize | undefined;

  /** Resting shadow depth. The connected buttons share one surface, so the shadow lifts them as a unit. */
  @property({reflect: true}) elevation: ButtonGroupElevation = 'none';

  /** Disables every member. A disabled member drops focus, so do not use it to show a pending action. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  readonly #sizeProvider = new ContextProvider(this, {context: sizeContext, initialValue: null});
  readonly #members = new ButtonGroupMemberContext(this);

  readonly #roving = new RovingTabindexController<HTMLElement>(this, {
    items: () => groupMembers(this),
    orientation: () => this.#resolvedOrientation(),
    wrap: true,
    focusTarget: (member) => focusTargetOf(member),
    isDisabled: (member) => this.disabled || isMemberDisabled(member),
    // A member that opens its own layer (a menu) keeps the arrow keys pressed inside it.
    boundary: () => true,
  });

  constructor() {
    super();
    this.internals.role = 'group';
  }

  /**
   * The group-level value handed to members through `buttonGroupContext` (`position` is added per member).
   * @internal
   */
  groupContext(): Omit<ButtonGroupContextValue, 'position'> {
    return {
      size: this.#size.value,
      orientation: this.#resolvedOrientation(),
      disabled: this.disabled,
    };
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Members (and any other sized child) follow the group's resolved size, like upstream's SizeProvider.
    this.#sizeProvider.setValue(this.#size.value);
    if (changed.has('orientation') && !BUTTON_GROUP_ORIENTATIONS.includes(this.orientation)) {
      devWarn(
        'button-group:orientation',
        `<tct-button-group orientation="${this.orientation}"> is not one of ${BUTTON_GROUP_ORIENTATIONS.join(', ')}; using "horizontal".`,
      );
    }
    if (changed.has('elevation') && !BUTTON_GROUP_ELEVATIONS.includes(this.elevation)) {
      devWarn(
        'button-group:elevation',
        `<tct-button-group elevation="${this.elevation}"> is not one of ${BUTTON_GROUP_ELEVATIONS.join(', ')}; using "none".`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.internals.ariaLabel = this.label || null;
    this.internals.ariaDisabled = this.disabled ? 'true' : null;
    this.toggleState('disabled', this.disabled);
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'button-group:label',
        '<tct-button-group> needs a `label` (or aria-label): it is the accessible name of the group.',
      );
    }
    this.#members.refresh();
    void this.#settleItems();
  }

  #resolvedOrientation(): ButtonGroupOrientation {
    return this.orientation === 'vertical' ? 'vertical' : 'horizontal';
  }

  /** Wrapper members render their inner control after the group does; then it can take `tabindex`. */
  async #settleItems(): Promise<void> {
    const pending: Promise<boolean>[] = [];
    for (const member of groupMembers(this)) {
      const update = (member as Partial<TctElement>).updateComplete;
      if (update) pending.push(update);
    }
    await Promise.all(pending);
    this.#roving.update();
    this.#members.refresh();
  }

  #onSlotChange = (): void => {
    this.#members.refresh();
    void this.#settleItems();
  };

  override render() {
    return html`<div
      class="group"
      part="group"
      data-orientation=${this.#resolvedOrientation()}
      data-elevation=${BUTTON_GROUP_ELEVATIONS.includes(this.elevation) ? this.elevation : 'none'}
    >
      <slot @slotchange=${this.#onSlotChange}></slot>
    </div>`;
  }
}

/** A member the group must skip: disabled, or exposing `aria-disabled` (roving skips both, like upstream). */
function isMemberDisabled(member: HTMLElement): boolean {
  return (
    member.hasAttribute('disabled') ||
    member.getAttribute('aria-disabled') === 'true' ||
    member.matches(':disabled')
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-button-group': TctButtonGroup;
  }
}

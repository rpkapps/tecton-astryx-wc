import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {features} from '@tecton-wc/core/features.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctIcon} from '../icon/tct-icon.js';
import focusRing from '../styles/focus-ring.styles.css';
import styles from './tct-collapsible.styles.css';
import {CollapsibleController} from './collapsible.controller.js';
import {
  COLLAPSIBLE_CHEVRON_POSITIONS,
  type CollapsibleChevronPosition,
} from './collapsible.types.js';

/**
 * Makes any content collapsible: a trigger row that is always visible and a content region that
 * shows and hides. The trigger is a real button with `aria-expanded` and `aria-controls` (both ends
 * live in the same shadow root), so it works with Enter and Space and is announced as a disclosure.
 *
 * Standalone it owns its state like `<details>` (starts collapsed; write `open` to start open). Inside a
 * `tct-collapsible-group`, give it a `value` and the group decides which items are open.
 *
 * Collapsed content stays findable: where the browser supports `hidden="until-found"`, browser find in
 * page opens the item and reveals the match; elsewhere it is hidden plainly.
 *
 * @summary A trigger and a region that shows and hides, with a chevron; a disclosure button.
 * @tag tct-collapsible
 * @upstream Collapsible
 * @slot - The content that collapses.
 * @slot trigger - Rich trigger content (replaces the `trigger` text).
 * @csspart collapsible - The root box.
 * @csspart trigger - The trigger button.
 * @csspart chevron - The disclosure chevron.
 * @csspart content - The content region; hidden until found while collapsed.
 * @csspart body - Padding and typography of the content, inside the region.
 * @fires tct-open-change - A user asked to open or close; cancelable. Not fired inside a group (the group fires `tct-value-change`).
 * @fires tct-after-open-change - The open state changed, for any reason (including code, a group, and find in page).
 * @cssstate open - The content is showing.
 * @cssstate disabled - The item cannot be toggled.
 * @cloakDisplay block
 */
export class TctCollapsible extends TctElement {
  static override readonly tagName = 'tct-collapsible';
  static override readonly dependencies = [TctIcon];
  // Not `base`: its `[hidden] { display: none !important }` would defeat hidden="until-found". The reset it
  // provides is repeated in the sheet, minus that rule (see requests in parity.json).
  static override styles: CSSResultGroup = [focusRing, styles];

  /** Trigger text. Use `slot="trigger"` for rich content; the slot wins when both are given. */
  @property() trigger = '';

  /**
   * Whether the content is showing. The attribute is the initial state and reflects the current one.
   * Inside a group with a `value`, the group's state wins.
   */
  @property({type: Boolean, reflect: true}) open = false;

  /**
   * Blocks toggling. The trigger uses `aria-disabled` (never native `disabled`, so it stays
   * perceivable) and leaves the tab order; content keeps its state.
   */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * Where the chevron sits: `end` points down when closed and up when open; `start` points into the
   * row and turns down when open (mirrored in right-to-left). Inside a group it defaults to the group's.
   */
  @property({attribute: 'chevron-position', reflect: true}) chevronPosition:
    CollapsibleChevronPosition | undefined;

  /** Identifies this item within a `tct-collapsible-group`. Required to take part in one. */
  @property() value = '';

  readonly #ids = new IdController(this, 'tct-collapsible');
  #lastOpen: boolean | undefined;

  readonly #state: CollapsibleController = new CollapsibleController(this, {
    value: () => this.value || undefined,
    open: () => this.open,
    setOpen: (open) => {
      this.open = open;
    },
    requestChange: (open) => this.dispatch(new TctOpenChangeEvent(open, 'trigger')),
  });

  /** Opens the content. Programmatic: fires no intent event (the after event still fires). */
  show(): void {
    this.open = true;
  }

  /** Closes the content. Programmatic: fires no intent event. */
  hide(): void {
    this.open = false;
  }

  /** Toggles, or sets the state with `force`. Programmatic: fires no intent event. */
  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
  }

  /** A user-equivalent close request: fires the cancelable `tct-open-change` and closes unless prevented. */
  requestClose(): void {
    if (this.#state.isOpen) this.#state.toggle();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('chevronPosition') &&
      this.chevronPosition !== undefined &&
      !COLLAPSIBLE_CHEVRON_POSITIONS.includes(this.chevronPosition)
    ) {
      devWarn(
        'collapsible:chevron-position',
        `<tct-collapsible chevron-position="${this.chevronPosition}"> is not one of ${COLLAPSIBLE_CHEVRON_POSITIONS.join(', ')}; using "end".`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const open = this.#state.isOpen;
    this.toggleState('open', open);
    this.toggleState('disabled', this.disabled);
    if (this.#lastOpen !== undefined && this.#lastOpen !== open) {
      // A notification for every actual change, whoever caused it (like the native `toggle` event).
      this.dispatch(new TctAfterOpenChangeEvent(open));
    }
    this.#lastOpen = open;
  }

  readonly #onTriggerClick = (event: MouseEvent): void => {
    if (this.disabled) return;
    this.#state.toggle(event);
  };

  /** The browser is about to reveal a find-in-page match inside collapsed content: open the item. */
  readonly #onBeforeMatch = (event: Event): void => {
    if (this.#state.isOpen) return;
    // Not vetoable: the browser reveals regardless, so only the commit event follows.
    const group = this.#state.group;
    if (this.#state.isGroupControlled && group) {
      group.toggle(this.value, event);
    } else {
      this.open = true;
    }
  };

  override render() {
    const open = this.#state.isOpen;
    const presentation = this.#state.presentation;
    const position =
      this.chevronPosition && COLLAPSIBLE_CHEVRON_POSITIONS.includes(this.chevronPosition)
        ? this.chevronPosition
        : (presentation.chevronPosition ?? 'end');
    const contentId = this.#ids.id('content');
    const chevron = html`<tct-icon
      class="chevron"
      part="chevron"
      name=${position === 'start' ? 'chevronRight' : 'chevronDown'}
      color="secondary"
      data-position=${position}
    ></tct-icon>`;
    return html`<div
      class="collapsible"
      part="collapsible"
      data-divided=${presentation.hasDividers ? '' : nothing}
      data-density=${presentation.density ?? nothing}
      data-open=${open ? '' : nothing}
    >
      <button
        type="button"
        class="trigger focus-ring"
        part="trigger"
        aria-expanded=${open ? 'true' : 'false'}
        aria-controls=${contentId}
        aria-disabled=${this.disabled ? 'true' : nothing}
        tabindex=${this.disabled ? '-1' : nothing}
        data-position=${position}
        data-density=${presentation.density ?? nothing}
        @click=${this.#onTriggerClick}
      >
        ${position === 'start' ? chevron : nothing}
        <span class="label"><slot name="trigger">${this.trigger}</slot></span>
        ${position === 'end' ? chevron : nothing}
      </button>
      <div
        class="content"
        part="content"
        id=${contentId}
        data-density=${presentation.density ?? nothing}
        hidden=${open ? nothing : features.hiddenUntilFound ? 'until-found' : ''}
        @beforematch=${this.#onBeforeMatch}
      >
        <div class="body" part="body" data-density=${presentation.density ?? nothing}>
          <slot></slot>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-collapsible': TctCollapsible;
  }
}

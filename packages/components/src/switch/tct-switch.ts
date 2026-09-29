import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import spinnerMessages from '@tecton-astryx/locales/en/spinner.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {indicatorScope} from '@tecton-astryx/core/indicators/registry.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {oneOf} from '../field/field-utils.js';
import {TctToggleControl} from '../checkbox-input/tct-toggle-control.js';
import toggleStyles from '../checkbox-input/tct-toggle-control.styles.css';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {
  SWITCH_LABEL_POSITIONS,
  SWITCH_LABEL_SPACINGS,
  type SwitchLabelPosition,
  type SwitchLabelSpacing,
} from './switch.types.js';
import styles from './tct-switch.styles.css';

/**
 * A switch: an on/off setting that takes effect as soon as it is changed ("Enable notifications", "Dark
 * mode"). It is a native checkbox with `role="switch"` in the shadow root, so it announces as a switch,
 * toggles with Space, and is form-associated: it submits `name=value` (`value` is `on` unless you set it)
 * only while on, resets, restores, validates (`required` means it must be on) and joins a `<fieldset
 * disabled>`. Clicking the label or the description toggles it.
 *
 * `checked` follows the native model: the `checked` attribute is the default that reset returns to, the
 * property is the current state. A user toggle fires the native `input` then `change`, once each; writing
 * `checked` fires nothing. To make it controlled, set `checked` from your `change` handler, or cancel the
 * `click` to keep the old state. `changeAction` runs after each toggle: the thumb shows a spinner and the
 * switch is busy (and cannot be toggled) until its promise settles; a rejection returns it to its previous
 * state. `label-position` puts the label before the track; `label-spacing="spread"` pushes label and track
 * to opposite ends. [mwg:form-associated-custom-elements] [mwg:accessible-web-components]
 * [mwg:validate-input-after-interaction]
 *
 * @summary A switch for on/off settings, with label, description and detached status.
 * @tag tct-switch
 * @upstream Switch
 * @csspart field - The whole field: the row and the status message.
 * @csspart row - The row holding the switch and its label.
 * @csspart control - The wrapper the native input sits over.
 * @csspart input - The native checkbox with `role="switch"` (invisible, over the track).
 * @csspart track - The painted track.
 * @csspart thumb - The moving thumb (a spinner shows in it while busy).
 * @csspart label - The label.
 * @csspart label-wrapper - The label and description block.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The state does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, on every toggle by the user; composed and retargeted from the inner input.
 * @fires change - Native, once per toggle by the user; dispatched once from the host.
 * @cloakDisplay block
 * @cloakMinBlockSize 1.5rem
 */
export class TctSwitch extends TctToggleControl {
  static override readonly tagName = 'tct-switch';
  static override styles: CSSResultGroup = [
    base,
    visuallyHidden,
    focusRing,
    motion,
    field,
    indicatorScope,
    toggleStyles,
    styles,
  ];

  /** Which side of the track the label sits on: `end` (default) or `start`. */
  @property({reflect: true, attribute: 'label-position'}) labelPosition: SwitchLabelPosition =
    'end';

  /** `hug` keeps track and label together (default); `spread` pushes them to opposite ends of the row. */
  @property({reflect: true, attribute: 'label-spacing'}) labelSpacing: SwitchLabelSpacing = 'hug';

  readonly #locale = new LocaleController(this, {
    namespace: 'spinner',
    defaults: spinnerMessages,
  });
  #announcedBusy = false;

  protected override get inputRole(): string {
    return 'switch';
  }

  protected override get spread(): boolean {
    return oneOf(this.labelSpacing, SWITCH_LABEL_SPACINGS, 'hug') === 'spread';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('labelPosition') && !SWITCH_LABEL_POSITIONS.includes(this.labelPosition)) {
      devWarn(
        `switch:label-position:${this.labelPosition}`,
        `label-position "${this.labelPosition}" is not one of ${SWITCH_LABEL_POSITIONS.join(', ')}.`,
      );
    }
    if (changed.has('labelSpacing') && !SWITCH_LABEL_SPACINGS.includes(this.labelSpacing)) {
      devWarn(
        `switch:label-spacing:${this.labelSpacing}`,
        `label-spacing "${this.labelSpacing}" is not one of ${SWITCH_LABEL_SPACINGS.join(', ')}.`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    // A busy switch says so once, politely (a live region created together with its text is not spoken).
    if (this.busy && !this.#announcedBusy) {
      announce(this.#locale.t('@astryx.spinner.loading'), {politeness: 'polite', element: this});
    }
    this.#announcedBusy = this.busy;
  }

  /** The side of the switch the label is on, narrowed to a known value. */
  protected override get labelSide(): 'start' | 'end' {
    return oneOf(this.labelPosition, SWITCH_LABEL_POSITIONS, 'end');
  }

  protected override renderIndicator(): TemplateResult {
    return html`<div
      class="track"
      part="track"
      aria-hidden="true"
      data-size=${this.fieldSize}
      ?data-checked=${this.checked}
      ?data-disabled=${this.isDisabled}
    >
      <div class="thumb" part="thumb" ?data-checked=${this.checked}>
        ${this.busy ? html`<tct-spinner size="sm" shade="inherit"></tct-spinner>` : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-switch': TctSwitch;
  }
}

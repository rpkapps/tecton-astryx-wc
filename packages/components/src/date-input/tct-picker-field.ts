import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctClearEvent} from '@tecton-wc/core/events/tct-clear.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {TctButton} from '../button/tct-button.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import layer from '../styles/layer.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {
  effectivePresentation,
  PICKER_PRESENTATIONS,
  PickerPresentationController,
  type LegacyNativePicker,
  type PickerSurface,
  type TimePresentation,
} from './picker-presentation.js';
import {PickerSurfaceController, renderPickerSurface} from './picker-surface.js';
import pickerSurfaceStyles from './picker-surface.styles.css';
import pickerFieldStyles from './tct-picker-field.styles.css';

let pickerSheet: Promise<unknown> | undefined;

/**
 * Loads and registers the element only the touch presentation renders (`tct-bottom-sheet`) the first time a
 * date or time field resolves to the sheet. A field that stays a popover never pays for it. Until it is
 * defined the sheet is hidden (`:not(:defined)`), so nothing flashes.
 */
export function loadPickerSheet(): Promise<unknown> {
  pickerSheet ??= import('./picker-sheet.define.js');
  return pickerSheet;
}

/**
 * The shared body of the date and time fields: what `tct-date-input`, `tct-date-time-input`,
 * `tct-date-range-input` and `tct-time-input` have in common beyond the outlined field box they inherit.
 *
 *  - **the picker state**: `open`, the cancelable `tct-open-change` intent event before a user opens or
 *    closes it, the commit `tct-after-open-change`, and `show()` / `hide()` / `toggle()` / `requestClose()`,
 *    for the anchored popover surface and the bottom sheet alike;
 *  - **the surface**: `presentation` (and the deprecated `native-picker`) resolved against the pointer and
 *    the viewport; the popover is a layer under the box, the sheet loads lazily;
 *  - **committing**: one path for a user's change (`input`, then `change`, then `changeAction`), which a
 *    disabled, read-only or busy field refuses;
 *  - **chrome**: the calendar toggle button, the clear button with `tct-clear`, the busy spinner.
 *
 * @internal
 * @summary Base of the date and time fields.
 */
export abstract class TctPickerField extends TctBoxControl {
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctBoxControl.dependencies,
    TctInputClearButton,
    TctButton,
  ];
  static override styles: CSSResultGroup = [
    TctBoxControl.styles,
    layer,
    visuallyHidden,
    pickerSurfaceStyles,
    pickerFieldStyles,
  ];

  /**
   * Whether the picker (the popover under the field, or the bottom sheet) is open. Writing it never fires
   * an event; a user opening or closing it fires the cancelable `tct-open-change` first.
   */
  @property({type: Boolean, reflect: true}) open = false;

  /**
   * Which surface collects the value: `popover`, `bottom-sheet`, `native` (the browser's own
   * `<input type="date|time">`), `adaptive-bottom-sheet` (popover, or bottom sheet on a compact touch
   * device) or `adaptive-native` (default: popover, or the browser's picker with a coarse pointer). A time
   * field also takes `text-input`. Unset, the default applies.
   */
  @property() presentation: TimePresentation | undefined;

  /**
   * Async action run after every user change, with the new value and the event. While its promise is
   * pending the field is busy (`:state(busy)`, a spinner and `aria-busy`) and refuses further changes.
   */
  @property({attribute: false}) changeAction:
    ((value: string, event: Event) => void | Promise<void>) | undefined;

  /** Opens the picker without an intent event; resolves once it settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the picker without an intent event; resolves once it is hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens or closes it (`force` picks the state) without an intent event. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: fires the cancelable `tct-open-change` and honours a cancel. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (this.open) this.requestOpen(false, reason);
  }

  // -------------------------------------------------------------------------------- internals

  #settled: Promise<void> = Promise.resolve();
  #pendingChange = false;
  #lastCloseReason: ChangeReason | undefined;
  #focusIntoPicker = true;
  #sheetReady = false;

  protected readonly presentationController: PickerPresentationController =
    new PickerPresentationController(
      this,
      () => this.presentationPolicy,
      () => this.pickerKind,
    );

  protected readonly picker: PickerSurfaceController = new PickerSurfaceController(this, {
    surface: () => this.renderRoot.querySelector<HTMLElement>('.picker'),
    anchor: () => this.box,
    trigger: () => this.toggleButton,
    inside: () => [this.box],
    initialFocus: () => (this.#focusIntoPicker ? (this.initialPickerFocus() ?? 'first') : 'none'),
    returnFocus: () =>
      // A toggle-button click returns to the button; Escape and a pick return to the field.
      this.#lastCloseReason === 'trigger' ? null : this.pickerReturnTarget,
    onDismissRequest: (reason) => {
      this.requestOpen(false, reason);
    },
    onOpenRequest: (reason) => {
      this.#focusIntoPicker = true;
      this.requestOpen(true, reason);
    },
    onNativeClose: () => {
      this.open = false;
    },
  });

  /** `date` or `time`: which policies and defaults apply. */
  protected abstract get pickerKind(): 'date' | 'time';

  /** The picker's content (a calendar, a time list). Rendered in the popover surface or the sheet. */
  protected abstract renderPickerContent(surface: 'popover' | 'sheet'): TemplateResult;

  /** Accessible name of the picker dialog. */
  protected abstract get dialogLabel(): string;

  /** Name of the toggle button: it opens the picker, or closes it while open. */
  protected abstract get toggleLabel(): string;

  /** Name of the visually hidden close button of the popover surface. */
  protected abstract get closeLabel(): string;

  /** Name of the clear button ("Clear Start date"). */
  protected abstract get clearLabel(): string;

  /** Id of the popover surface (`aria-controls` of the typed input, in the same tree). */
  protected get pickerId(): string {
    return this.ids.id('picker');
  }

  /** The icon of the toggle button. */
  protected get toggleIcon(): string {
    return 'calendar';
  }

  /** Where focus goes when the picker opens for the keyboard or the toggle: the calendar's tab stop, say. */
  protected initialPickerFocus(): HTMLElement | null {
    return null;
  }

  /** Called before the picker is shown: bring its content up to date (resolve when it has rendered). */
  protected preparePicker(): Promise<unknown> | void {
    // Nothing by default.
  }

  /** Where focus returns after the picker closes: the field's typed input, or its trigger. */
  protected get pickerReturnTarget(): HTMLElement | null {
    return this.formControl;
  }

  /** The painted box the popover is placed under. */
  protected get box(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.input-wrapper');
  }

  /** The toggle button, when the field renders one. */
  protected get toggleButton(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.toggle');
  }

  /** The deprecated `native-picker` of a field that has one. */
  protected get legacyNativePicker(): LegacyNativePicker | undefined {
    return undefined;
  }

  /** The policy in effect: `presentation`, else the deprecated `native-picker`, else the default. */
  protected get presentationPolicy(): TimePresentation {
    return effectivePresentation(this.presentation, this.legacyNativePicker, this.pickerKind);
  }

  /** The surface in effect now (see {@link resolveSurface}). */
  protected get surface(): PickerSurface {
    return this.presentationController.surface;
  }

  /** The field is not busy, disabled or read-only: a user change is accepted. */
  protected get canEdit(): boolean {
    return !this.isDisabled && !this.readonly && !this.busy;
  }

  /** Whether the picker can open now. */
  protected get canOpen(): boolean {
    return !this.isDisabled && !this.busy && !this.readonly;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('presentation') &&
      this.presentation !== undefined &&
      !(
        this.pickerKind === 'time' ? [...PICKER_PRESENTATIONS, 'text-input'] : PICKER_PRESENTATIONS
      ).includes(this.presentation as never)
    ) {
      // Falls back to the default through effectivePresentation.
      this.warnEnum('presentation', String(this.presentation));
    }
    if (this.surface === 'sheet' && !this.#sheetReady) {
      void loadPickerSheet().then(() => {
        this.#sheetReady = true;
        this.requestUpdate();
      });
    }
  }

  /** Warns (once, in dev) about an enumerated attribute value that is not one of the allowed values. */
  protected abstract warnEnum(name: string, value: string): void;

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('open', this.open);
    this.#syncPickerLayer(changed.get('open'));
  }

  /** Brings the popover layer in line with `open` and the resolved surface. */
  #syncPickerLayer(previousOpen: boolean | undefined): void {
    const wantLayer = this.open && this.surface === 'popover' && this.canOpen;
    if (wantLayer === this.picker.isOpen) {
      if (previousOpen !== undefined && previousOpen !== this.open && this.surface !== 'popover') {
        this.#settled = Promise.resolve();
      }
      return;
    }
    // The first update of a closed field is not a change.
    if (previousOpen === undefined && !this.open) return;
    const settled = wantLayer
      ? Promise.resolve(this.preparePicker()).then(() =>
          this.open ? this.picker.show() : undefined,
        )
      : this.picker.hide();
    this.#settled = settled.then(() => {
      if (this.open === this.picker.isOpen || this.surface !== 'popover') {
        this.dispatch(new TctAfterOpenChangeEvent(this.open));
      }
      this.#lastCloseReason = undefined;
    });
  }

  // ---------------------------------------------------------------------------------- open state

  /**
   * A user (or `requestClose()`) asks to open or close the picker: the cancelable intent event first, and
   * the change follows unless it was prevented. Opening needs a field that can take input.
   */
  protected requestOpen(open: boolean, reason: ChangeReason): void {
    if (open && !this.canOpen) return;
    if (!this.dispatch(new TctOpenChangeEvent(open, reason))) return;
    if (!open) this.#lastCloseReason = reason;
    this.open = open;
  }

  /** Opens the picker for the user: focus goes into it (`intoPicker`) or stays in the field. */
  protected openPicker(reason: ChangeReason, intoPicker: boolean): void {
    if (this.open) return;
    this.#focusIntoPicker = intoPicker;
    this.requestOpen(true, reason);
  }

  // ---------------------------------------------------------------------------------- committing

  /**
   * Applies a change the user made: sets the value, then `input` (and, with `commit`, the `change` that
   * follows it), then `changeAction`. Returns whether the value changed. A field that is disabled,
   * read-only or busy refuses.
   */
  protected commitValue(next: string, options: {commit?: boolean} = {}): boolean {
    if (!this.canEdit) return false;
    if (this.sanitize(next) === this.value) return false;
    this.value = next;
    this.syncFormState();
    const input = new Event('input', {bubbles: true, composed: true});
    this.dispatchEvent(input);
    this.#pendingChange = true;
    if (options.commit ?? true) this.settleChange();
    this.runChangeAction(this.value, input);
    this.requestUpdate();
    return true;
  }

  /** The value a raw string reads as (its own canonical form, or `''`), so an unchanged write is not a change. */
  protected abstract sanitize(value: string): string;

  /** Fires the `change` that follows the user's edits, once, when they are committed (blur, Enter, a pick). */
  protected settleChange(): void {
    if (!this.#pendingChange) return;
    this.#pendingChange = false;
    this.redispatchChange();
  }

  /** Forgets an edit in progress (form reset, a programmatic write). */
  protected forgetPendingChange(): void {
    this.#pendingChange = false;
  }

  /** Runs `changeAction` after a user change; busy while its promise is pending. */
  protected runChangeAction(value: string, event: Event): void {
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action(value, event));
    if (!settled) return;
    void settled.then(() => {
      this.settleAction();
    });
  }

  // ---------------------------------------------------------------------------------- rendering

  /** The calendar toggle button: the first button in the box, so it is the picker's trigger. */
  protected renderToggle(disabled = !this.canOpen): TemplateResult {
    return html`<button
      type="button"
      class="toggle focus-ring"
      part="toggle"
      ?disabled=${disabled && !this.showsDisabledMessage}
      aria-disabled=${disabled && this.showsDisabledMessage ? 'true' : nothing}
      aria-label=${this.toggleLabel}
      aria-expanded=${this.open ? 'true' : 'false'}
      aria-haspopup="dialog"
      @click=${this.onToggleClick}
    >
      <tct-icon name=${this.toggleIcon} size="sm" color="secondary" class="toggle-icon"></tct-icon>
    </button>`;
  }

  /** A press on the toggle: the picker opens with focus inside it, or closes. The native surface shows its own. */
  protected onToggleClick = (event: MouseEvent): void => {
    // The press is the toggle's own: the box must not also treat it as a press on the control (that
    // would activate the combobox and open the picker it just closed).
    event.stopPropagation();
    if (!this.canOpen) return;
    if (this.surface === 'native') {
      this.showNativePicker();
      return;
    }
    if (this.picker.layer.wasJustDismissed()) return;
    if (this.open) this.requestOpen(false, 'trigger');
    else {
      this.#focusIntoPicker = true;
      this.requestOpen(true, 'trigger');
    }
  };

  /** Opens the browser's own picker on the native surface. */
  protected showNativePicker(): void {
    const control = this.formControl;
    if (!(control instanceof HTMLInputElement)) return;
    // Focus is the whole mechanism on iOS (no showPicker for type=date); elsewhere showPicker opens it.
    control.focus();
    try {
      control.showPicker();
    } catch {
      // showPicker throws without user activation and in cross-origin frames: the focus above is the fallback.
    }
  }

  /** The clear button, shown while there is a value the user may clear. */
  protected renderClear(visible: boolean): TemplateResult | typeof nothing {
    if (!visible || !this.canEdit) return nothing;
    return html`<tct-input-clear-button
      label=${this.clearLabel}
      @click=${this.onClearClick}
    ></tct-input-clear-button>`;
  }

  protected onClearClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (!this.dispatch(new TctClearEvent())) return;
    this.clearValue();
    const control = this.formControl;
    if (!control || this.surface === 'native') return;
    // Keyboard: focus is restored synchronously, before the button leaves the DOM. Pointer: after the
    // button's own task, so touch browsers do not jump the page scroll (iOS Safari).
    if (event.detail === 0) control.focus();
    else requestAnimationFrame(() => control.focus({preventScroll: true}));
  };

  /** Clears the value for the user (`tct-clear` was not prevented). */
  protected abstract clearValue(): void;

  /**
   * The picker surface for the resolved presentation, placed after the box: the anchored popover layer
   * (always rendered on a popover surface: a top-layer element that costs nothing while closed), or the
   * bottom sheet once its element is loaded.
   */
  protected renderPickerSurface(): TemplateResult | typeof nothing {
    switch (this.surface) {
      case 'popover':
        return renderPickerSurface({
          label: this.dialogLabel,
          id: this.pickerId,
          closeLabel: this.closeLabel,
          onClose: () => {
            this.requestOpen(false, 'close-button');
          },
          content: this.renderPickerContent('popover'),
        });
      case 'sheet':
        return this.#sheetReady
          ? html`<tct-bottom-sheet
              class="sheet"
              part="sheet"
              height="hug"
              purpose="info"
              label=${this.dialogLabel}
              .open=${this.open}
              .finalFocusElement=${this.pickerReturnTarget}
              @tct-open-change=${this.#onSheetOpenChange}
              @tct-after-open-change=${this.#onSheetAfterOpenChange}
            >
              ${this.renderPickerContent('sheet')}
            </tct-bottom-sheet>`
          : nothing;
      default:
        return nothing;
    }
  }

  /** The sheet asks to close (Escape, scrim, swipe): ask ours, and let the answer drive the sheet. */
  readonly #onSheetOpenChange = (event: Event): void => {
    const request = event as TctOpenChangeEvent;
    event.stopPropagation();
    event.preventDefault();
    if (!request.open) this.requestOpen(false, request.reason);
  };

  readonly #onSheetAfterOpenChange = (event: Event): void => {
    event.stopPropagation();
    this.dispatch(new TctAfterOpenChangeEvent(this.open));
  };
}

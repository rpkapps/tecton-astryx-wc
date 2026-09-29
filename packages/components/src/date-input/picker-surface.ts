/**
 * The anchored surface of a date or time picker: a `popover="manual"` layer on the shared layer stack,
 * positioned under the field's box, that holds a calendar, a list of times or a preset list. It is what
 * upstream `usePopover` gives DateInput, DateRangeInput and DateTimeInput, and it exists here (rather
 * than `tct-popover`) for three reasons the pickers need:
 *
 *  - the field's own box, its input and its clear button, count as *inside*, so pressing the input while the
 *    picker is open neither dismisses nor re-opens it;
 *  - focus is placed by the field: into the calendar when the toggle button opened it, nowhere when the input
 *    did (the combobox keeps focus), and back on the input when it closes;
 *  - a listbox surface (`role="none"`, no close button, no focus trap) beside the dialog surface.
 *
 * The owner keeps the `open` state and raises the intent events: `onDismissRequest` (Escape, outside press,
 * a second click on the toggle) and `onOpenRequest` are where it dispatches `tct-open-change`, then calls
 * `show()` / `hide()`. Escape closes one layer per press through the shared stack; a calendar in range
 * mode keeps the Escape that cancels a pick in progress.
 */
import {html, nothing, type ReactiveController, type TemplateResult} from 'lit';
import {FocusTrapController} from '@tecton-wc/core/controllers/focus-trap.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {LayerController, type EscapeBehavior} from '@tecton-wc/core/layer/layer-controller.js';
import {
  PositionController,
  type Alignment,
  type Placement,
} from '@tecton-wc/core/layer/position.js';
import type {TctElement} from '@tecton-wc/core/tct-element.js';
import {getTabbables} from '@tecton-wc/core/utils/focus.js';

export interface PickerSurfaceOptions {
  /** The `[popover]` layer element in the owner's shadow root. */
  surface: () => HTMLElement | null;
  /** The element the surface is placed against: the field's painted box. */
  anchor: () => HTMLElement | null;
  /** The button that toggles the picker: gets `aria-expanded` and `aria-haspopup`. */
  trigger?: () => HTMLElement | null;
  /** Extra elements that count as inside for outside presses (the box, the input, the clear button). */
  inside?: () => (EventTarget | null | undefined)[];
  /** Placement against the anchor. Default below, start-aligned. */
  placement?: () => {placement: Placement; alignment: Alignment};
  /** `'min'` makes the surface at least as wide as the anchor. Default off. */
  matchAnchorWidth?: 'min' | false;
  /** `dialog` (default) or `listbox` for the value of `aria-haspopup` on the trigger. */
  haspopup?: 'dialog' | 'listbox';
  /** Escape behaviour (default `close`). */
  escape?: () => EscapeBehavior;
  /** Where focus goes on show: `'first'` (default: the first tabbable that is not the close button), `'none'`, or a chooser. */
  initialFocus?: () => 'first' | 'none' | HTMLElement | null;
  /** Where focus goes on hide. `null` leaves it where the browser put it. */
  returnFocus?: () => HTMLElement | null;
  /** Tab is contained in the surface while focus is inside it. Default `true` (a dialog surface). */
  trapFocus?: boolean;
  onDismissRequest: (reason: ChangeReason, event?: Event) => void;
  onOpenRequest?: (reason: ChangeReason, event?: Event) => void;
  /** The surface closed without `hide()` (the browser closed the popover). */
  onNativeClose?: () => void;
  onHidden?: () => void;
}

export class PickerSurfaceController implements ReactiveController {
  readonly layer: LayerController;
  readonly position: PositionController;
  readonly #options: PickerSurfaceOptions;

  constructor(host: TctElement, options: PickerSurfaceOptions) {
    this.#options = options;
    this.position = new PositionController(host, {
      surface: () => options.surface(),
      anchor: () => options.anchor(),
      placement: () => ({
        ...(options.placement?.() ?? {placement: 'below', alignment: 'start'}),
        offset: 'var(--spacing-1)',
      }),
      matchAnchorWidth: options.matchAnchorWidth ?? false,
      trackPlacement: true,
    });
    this.layer = new LayerController(host, {
      kind: 'popover',
      surface: () => options.surface(),
      trigger: options.trigger,
      inside: options.inside,
      haspopup: options.haspopup ?? 'dialog',
      escape: options.escape,
      initialFocus: () => this.#initialFocus(),
      returnFocus: options.returnFocus ?? true,
      exitAnimation: () => this.#exitAnimation(),
      position: this.position,
      onDismissRequest: options.onDismissRequest,
      onOpenRequest: options.onOpenRequest,
      onNativeClose: options.onNativeClose,
      onHidden: options.onHidden,
    });
    if (options.trapFocus !== false) {
      new FocusTrapController(host, {
        container: () => options.surface(),
        active: () => this.layer.isOpen,
      });
    }
    host.addController(this);
  }

  hostConnected(): void {
    // The layer and position controllers attach themselves.
  }

  get isOpen(): boolean {
    return this.layer.isOpen;
  }

  show(): Promise<void> {
    return this.layer.show();
  }

  hide(): Promise<void> {
    return this.layer.hide();
  }

  toggleFromTrigger(event: Event): void {
    this.layer.toggleFromTrigger(event);
  }

  /** Re-places the surface (its content changed size). */
  update(): void {
    this.position.update();
  }

  #initialFocus(): HTMLElement | null {
    const chosen = this.#options.initialFocus?.() ?? 'first';
    if (chosen === 'none') return null;
    if (chosen !== 'first') return chosen;
    const surface = this.#options.surface();
    if (!surface) return null;
    const close = surface.querySelector('.picker-close');
    const control = getTabbables(surface).find(
      (element) => !close?.contains(element) && element !== close,
    );
    return control ?? surface.querySelector<HTMLElement>('.picker-surface');
  }

  #exitAnimation(): Animation[] {
    const surface = this.#options.surface();
    if (!surface || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [surface.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: 'ease-in'})];
  }
}

export interface PickerSurfaceTemplate {
  /** Accessible name of the dialog. */
  label: string;
  /** `dialog` (default) or `none` for a listbox that owns its role. */
  role?: 'dialog' | 'none';
  /** Name of the close button (a dialog only); `undefined` renders none. */
  closeLabel?: string;
  onClose?: () => void;
  /** Extra class on the painted surface. */
  variant?: string;
  /** `id` of the painted surface (`aria-controls` of a combobox that is in the same tree). */
  id?: string;
  content: TemplateResult;
}

/**
 * The markup of a picker surface: the positioned popover layer and its painted box, plus the close button that
 * is revealed only when keyboard focus reaches it (`[mwg:accessible-web-components]`). Needs
 * `picker-surface.styles.css` and the `visually-hidden` module in the owner's styles, and `tct-button`.
 */
export function renderPickerSurface(options: PickerSurfaceTemplate): TemplateResult {
  const dialog = (options.role ?? 'dialog') === 'dialog';
  return html`<div
    class="picker layer-surface"
    part="picker"
    popover="manual"
    data-placement="below"
  >
    <div
      class="picker-surface"
      part="picker-surface"
      id=${options.id ?? nothing}
      data-variant=${options.variant ?? nothing}
      role=${dialog ? 'dialog' : nothing}
      aria-label=${dialog ? options.label : nothing}
      tabindex=${dialog ? '-1' : nothing}
    >
      ${options.content}
      ${
        dialog && options.closeLabel
          ? html`<div class="picker-close visually-hidden-focusable">
              <tct-button
                class="picker-close-button"
                part="picker-close-button"
                @click=${options.onClose}
              >
                ${options.closeLabel}
              </tct-button>
            </div>`
          : nothing
      }
    </div>
  </div>`;
}

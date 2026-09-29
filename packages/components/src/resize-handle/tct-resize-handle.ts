import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import handleMessages from '@tecton-wc/locales/en/resize-handle.js';
import resizableMessages from '@tecton-wc/locales/en/resizable.js';
import type {ResizableProps} from '@tecton-wc/core/controllers/resizable.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {features} from '@tecton-wc/core/features.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {pick} from '../layout/layout.types.js';
import base from '../styles/base.styles.css';
import {
  RESIZE_DIRECTIONS,
  RESIZE_KEYBOARD_LARGE_STEP,
  RESIZE_KEYBOARD_STEP,
  RESIZE_PILL_PLACEMENTS,
  RESIZE_POSITIONS,
  resolvePillSide,
  type ResizeDirection,
  type ResizePillPlacement,
  type ResizePosition,
} from './resize-handle.types.js';
import styles from './tct-resize-handle.styles.css';

/** Element that can be the region a handle drives (a `tct-layout-panel`). */
interface RegionOwner extends Element {
  readonly activeRegion?: ResizableProps;
}

const defaults = {...resizableMessages, ...handleMessages};

/**
 * A draggable separator between two resizable regions. It is a focusable `role="separator"` with the
 * current size (`aria-valuenow`), the bounds (`aria-valuemin`/`-max`) and a readable value
 * (`aria-valuetext`), and it resizes with the pointer or the keyboard. Put it right after a resizable
 * `tct-layout-panel` in the same slot (before an end panel, with `reversed`), or point it at a panel
 * with `for`; a region of your own (a `ResizableController`) goes in the `resizable` property.
 *
 * Keyboard: Arrow keys resize by 10 px (50 px with Shift), Home and End go to the minimum and maximum,
 * Enter collapses a collapsible region or expands it again. Arrows follow the direction of the text:
 * in RTL the right arrow makes a start panel narrower. A drag is never the only way to resize: the
 * keyboard does it, a double click collapses and expands a collapsible region, and the methods
 * `stepBy()`, `stepToMin()` and `stepToMax()` let you offer buttons (a single-pointer alternative
 * for WCAG 2.5.7). Every step is announced through the separator's value.
 *
 * The handle is a thin line (the divider, drawn with `has-divider`) with a wider invisible grab zone
 * over the grip pill, so it is easy to hit without taking layout space. The pill sits on the panel
 * side (`pill-placement="auto"`) and moves to the other side while the panel is collapsed. Slot your
 * own grip to replace the pill. `position="overlay"` positions the handle inside a parent panel's
 * bounds instead of in the flow.
 *
 * @summary Draggable, keyboard-operable separator between resizable regions.
 * @tag tct-resize-handle
 * @upstream ResizeHandle
 * @slot - A grip of your own, replacing the default pill.
 * @csspart base - The handle line: the divider, the focus ring and the container of the grab zone and the grip.
 * @csspart pill - The default grip pill.
 * @cssprop --resize-handle-hit-area - Size of the grab zone across the handle in `position="overlay"` mode. Default 16px.
 * @cssstate dragging - A drag is in progress.
 * @cloakDisplay flex
 */
export class TctResizeHandle extends TctElement {
  static override readonly tagName = 'tct-resize-handle';
  static override styles: CSSResultGroup = [base, styles];

  /** The axis it resizes along: `horizontal` (default, a vertical divider dragged sideways) or `vertical`. Must match the region's. */
  @property({reflect: true}) direction: ResizeDirection = 'horizontal';

  /** `inline` (default) puts it in the flow between its siblings; `overlay` positions it inside a parent panel's bounds. */
  @property({reflect: true}) position: ResizePosition = 'inline';

  /** Reverses the drag direction: for a handle that resizes a panel at the end (right, bottom) side. */
  @property({type: Boolean, reflect: true}) reversed = false;

  /** Makes the handle inert: it stays in the tree but takes no focus and no input. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Shows a 1px divider line through the handle. The line is the handle: it takes 1px of layout, with a wider invisible grab zone. */
  @property({type: Boolean, reflect: true, attribute: 'has-divider'}) hasDivider = false;

  /** Shows the pill only on hover and focus instead of at rest. Upstream `isAlwaysVisible` is `true` by default. */
  @property({type: Boolean, attribute: 'no-always-visible'}) noAlwaysVisible = false;

  /** Which side of the divider the pill sits on: `auto` (default), `start`, `end` or `center`. */
  @property({attribute: 'pill-placement'}) pillPlacement: ResizePillPlacement = 'auto';

  /** Accessible name of the separator. Defaults to "Resize handle" in the language of the page; name each handle when there are several ("Resize sidebar"). */
  @property() label = '';

  /**
   * The `id` of the resizable element (a `tct-layout-panel`) this handle drives. By default it drives
   * the resizable panel next to it: the one before it, else the one after it.
   */
  @property() for: string | undefined;

  /** A region of your own (a `ResizableController`) instead of a panel's. Property only. */
  @property({attribute: false}) resizable: ResizableProps | undefined;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'resize-handle',
    defaults,
  });
  readonly #slots: SlotController = new SlotController(this, 'default');
  #target: ResizableProps | undefined;
  #unsubscribe: (() => void) | undefined;
  #siblings: MutationObserver | undefined;
  #drag: {pointerId: number; start: number; rtl: number} | undefined;
  #dragging = false;
  #autoTabindex = false;

  /** The region this handle drives right now, or `undefined` when none is found (yet). */
  get region(): ResizableProps | undefined {
    return this.#resolve();
  }

  /** Resizes the region by `delta` px, as the keyboard does (positive grows it). A single-pointer alternative to dragging. */
  stepBy(delta: number): void {
    const region = this.#resolve();
    if (this.disabled || !region || !Number.isFinite(delta)) return;
    // The delta is in the direction of growth of the region, whichever side the handle is on.
    this.#nudge(region, delta);
  }

  /** Resizes the region to its minimum size, as the Home key does. */
  stepToMin(): void {
    const region = this.#resolve();
    if (this.disabled || !region) return;
    this.#nudge(region, region.minSize - region.size);
  }

  /** Resizes the region to its maximum size, as the End key does (nothing when it is unbounded). */
  stepToMax(): void {
    const region = this.#resolve();
    if (this.disabled || !region || region.maxSize === Infinity) return;
    this.#nudge(region, region.maxSize - region.size);
  }

  // ------------------------------------------------------------------------------- lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('dblclick', this.#onDoubleClick);
    this.addEventListener('focus', this.#onFocus);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.#onKeyDown);
    this.removeEventListener('dblclick', this.#onDoubleClick);
    this.removeEventListener('focus', this.#onFocus);
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#target = undefined;
    this.#siblings?.disconnect();
    if (this.#drag) this.#endDrag(false);
  }

  constructor() {
    super();
    // The host is the separator.
    this.internals.role = 'separator';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('direction') || changed.has('position') || changed.has('pillPlacement')) {
      pick(RESIZE_DIRECTIONS, this.direction, 'horizontal', 'direction');
      pick(RESIZE_POSITIONS, this.position, 'inline', 'position');
      pick(RESIZE_PILL_PLACEMENTS, this.pillPlacement, 'auto', 'pill-placement');
    }
  }

  protected override updated(): void {
    this.#bind();
    this.#syncSemantics();
    // A focusable separator is a tab stop unless the author says otherwise.
    if (this.disabled) {
      this.tabIndex = -1;
      this.#autoTabindex = true;
    } else if (!this.hasAttribute('tabindex') || this.#autoTabindex) {
      this.tabIndex = 0;
      this.#autoTabindex = true;
    }
    this.toggleState('dragging', this.#dragging);
    const region = this.#target;
    if (region && region.direction !== this.#direction) {
      devWarn(
        'resize-handle:direction',
        `direction="${this.#direction}" but its region resizes "${region.direction}". They must match: the region measures one axis and the handle drags the other.`,
      );
    }
  }

  get #direction(): ResizeDirection {
    return pick(RESIZE_DIRECTIONS, this.direction, 'horizontal', 'direction');
  }

  // ---------------------------------------------------------------------------------- region

  /** Finds the region: `resizable`, else the element named by `for`, else the neighbouring resizable panel. */
  #resolve(): ResizableProps | undefined {
    if (this.resizable) return this.resizable;
    const root = this.getRootNode() as Document | ShadowRoot;
    let owner: RegionOwner | null = null;
    if (this.for) {
      owner = root.getElementById(this.for);
    } else {
      const neighbours: (RegionOwner | null)[] = [
        this.previousElementSibling,
        this.nextElementSibling,
      ];
      owner = neighbours.find((candidate) => candidate?.activeRegion) ?? null;
    }
    return owner?.activeRegion;
  }

  /** Follows the region's changes (size, collapse) so the semantics and the pill stay current. */
  #bind(): void {
    const region = this.#resolve();
    if (region !== this.#target) {
      this.#unsubscribe?.();
      this.#target = region;
      this.#unsubscribe = region?.subscribe(() => {
        this.requestUpdate();
      });
    }
    // Siblings may arrive after the handle while the page parses: look again when they do.
    if (!region && this.parentElement && !this.for) {
      this.#siblings ??= new MutationObserver(() => {
        if (this.#resolve()) {
          this.#siblings?.disconnect();
          this.requestUpdate();
        }
      });
      this.#siblings.observe(this.parentElement, {childList: true});
    }
  }

  /** ARIA through the host's internals: role, orientation, value, bounds, readable value, name. */
  #syncSemantics(): void {
    const region = this.#target;
    const internals = this.internals;
    internals.role = 'separator';
    internals.ariaOrientation = this.#direction === 'horizontal' ? 'vertical' : 'horizontal';
    internals.ariaLabel = this.label || this.#locale.t('@tct.resizable.handle.label');
    internals.ariaDisabled = this.disabled ? 'true' : null;
    if (!region) {
      internals.ariaValueNow = null;
      internals.ariaValueMin = null;
      internals.ariaValueMax = null;
      internals.ariaValueText = null;
      return;
    }
    // A collapsed region's real size (0) is below aria-valuemin, which is invalid (WCAG 4.1.2): the
    // value is clamped to the minimum and the true state is announced through the value text.
    const now = region.collapsed ? Math.max(region.size, region.minSize) : region.size;
    internals.ariaValueNow = String(Math.round(now));
    internals.ariaValueMin = String(Math.round(region.minSize));
    internals.ariaValueMax = Number.isFinite(region.maxSize)
      ? String(Math.round(region.maxSize))
      : null;
    internals.ariaValueText = region.collapsed
      ? this.#locale.t('@tct.resizable.collapsed')
      : this.#locale.t('value', {size: Math.round(region.size)});
    // The separator controls the region: point at it when the reflection exists and both are in one tree.
    if (features.elementReflection && this.for) {
      const target = (this.getRootNode() as Document | ShadowRoot).getElementById?.(this.for);
      internals.ariaControlsElements = target ? [target] : null;
    }
  }

  // ------------------------------------------------------------------------------------ input

  /** Moves the region by `delta` px, positive when the region grows (already corrected for the handle's side). */
  #nudge(region: ResizableProps, delta: number): void {
    region.start('keyboard');
    region.move(delta);
    region.end();
  }

  /** Whether growing the region is the pointer moving towards the end of the text direction. */
  get #sign(): 1 | -1 {
    return this.reversed ? -1 : 1;
  }

  #rtl(): 1 | -1 {
    return this.#direction === 'horizontal' && getComputedStyle(this).direction === 'rtl' ? -1 : 1;
  }

  readonly #onFocus = (): void => {
    // The region may have appeared since the last update.
    this.#bind();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event) || this.disabled) return;
    const region = this.#resolve();
    if (!region) return;
    const step = event.shiftKey ? RESIZE_KEYBOARD_LARGE_STEP : RESIZE_KEYBOARD_STEP;
    const rtl = this.#rtl();
    const horizontal = this.#direction === 'horizontal';
    let delta: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        delta = step * (event.key === 'ArrowRight' && horizontal ? rtl : 1) * this.#sign;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        delta = -step * (event.key === 'ArrowLeft' && horizontal ? rtl : 1) * this.#sign;
        break;
      case 'Home':
        delta = region.minSize - region.size;
        break;
      case 'End':
        if (region.maxSize === Infinity) {
          // Nothing to jump to, but the key is still ours.
          event.preventDefault();
          return;
        }
        delta = region.maxSize - region.size;
        break;
      case 'Enter':
        event.preventDefault();
        if (region.collapsible) this.#toggleCollapse(region);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.#nudge(region, delta);
  };

  /** Collapses the region, or expands it back to its minimum. */
  #toggleCollapse(region: ResizableProps): void {
    region.start('keyboard');
    region.move(region.collapsed ? region.minSize : -region.size);
    region.end();
  }

  readonly #onDoubleClick = (): void => {
    const region = this.#resolve();
    if (this.disabled || !region?.collapsible) return;
    region.start('pointer');
    region.move(region.collapsed ? region.minSize : -region.size);
    region.end();
  };

  readonly #onPointerDown = (event: PointerEvent): void => {
    const region = this.#resolve();
    if (this.disabled || !region || this.#drag || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    // Take the pointer for the whole gesture: without capture the browser re-hit-tests every move,
    // and a frame under the drag path would swallow the rest of it into another document.
    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is no longer active cannot be captured; the drag simply runs uncaptured.
    }
    const horizontal = this.#direction === 'horizontal';
    this.#drag = {
      pointerId: event.pointerId,
      start: horizontal ? event.clientX : event.clientY,
      rtl: this.#rtl(),
    };
    this.#dragging = true;
    region.start('pointer');
    // Drag feedback lives on <body>: the pointer spends the drag over whatever the regions contain,
    // and the resize cursor has to hold there.
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    this.requestUpdate();
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const drag = this.#drag;
    const region = this.#target;
    if (drag?.pointerId !== event.pointerId || !region) return;
    const position = this.#direction === 'horizontal' ? event.clientX : event.clientY;
    region.move((position - drag.start) * drag.rtl * this.#sign);
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    if (this.#drag?.pointerId !== event.pointerId) return;
    this.#endDrag(true);
  };

  /** Serves `pointercancel` and `lostpointercapture`: an interrupted drag ends without a resize end. */
  readonly #onPointerCancel = (event: PointerEvent): void => {
    if (this.#drag?.pointerId !== event.pointerId) return;
    this.#endDrag(false);
  };

  #endDrag(completed: boolean): void {
    this.#drag = undefined;
    this.#dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const region = this.#target;
    if (completed) region?.end();
    else region?.cancel();
    this.requestUpdate();
  }

  // ------------------------------------------------------------------------------------ render

  override render(): TemplateResult {
    const region = this.#target ?? this.#resolve();
    const direction = this.#direction;
    const position = pick(RESIZE_POSITIONS, this.position, 'inline', 'position');
    const side = resolvePillSide(
      pick(RESIZE_PILL_PLACEMENTS, this.pillPlacement, 'auto', 'pill-placement'),
      this.reversed,
      region?.collapsed === true,
    );
    return html`<div
      class="handle"
      part="base"
      data-direction=${direction}
      data-position=${position}
      data-side=${side}
      ?data-divider=${this.hasDivider && position === 'inline'}
      ?data-dragging=${this.#dragging}
      ?data-resting-pill=${!this.noAlwaysVisible}
    >
      <div
        class="grab"
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerCancel}
        @lostpointercapture=${this.#onPointerCancel}
      ></div>
      ${this.#slots.has('default') ? html`<slot></slot>` : html`<div class="pill" part="pill"></div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-resize-handle': TctResizeHandle;
  }
}

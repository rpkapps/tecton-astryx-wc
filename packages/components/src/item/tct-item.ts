import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {linkContext} from '@tecton-astryx/core/context/keys.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {ClickableContainerController} from '@tecton-astryx/core/controllers/clickable-container.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {safeUrl} from '@tecton-astryx/core/utils/safe-url.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {itemDescriptionContext} from './item.context.js';
import {
  ITEM_ALIGNMENTS,
  ITEM_DENSITIES,
  ITEM_LAYOUTS,
  ITEM_ROOTS,
  type ItemAlignment,
  type ItemDensity,
  type ItemDescription,
  type ItemLayout,
  type ItemRoot,
  type ItemTarget,
} from './item.types.js';
import styles from './tct-item.styles.css';

/**
 * Roles on which WAI-ARIA permits `aria-selected`. On any other role (a `listitem`, a bare row) a
 * selected item is exposed through `aria-current` instead.
 * https://www.w3.org/TR/wai-aria-1.2/#aria-selected
 */
const ARIA_SELECTED_ROLES = new Set([
  'option',
  'tab',
  'row',
  'gridcell',
  'columnheader',
  'rowheader',
  'treeitem',
]);

const BLANK_TARGET_REL_TOKENS = ['noopener', 'noreferrer'] as const;

/** `rel` for a link: `target="_blank"` always carries `noopener noreferrer` (upstream `computeTargetAndRel`). */
function mergeRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (target !== '_blank') return rel;
  const tokens = rel?.split(/\s+/).filter(Boolean) ?? [];
  for (const token of BLANK_TARGET_REL_TOKENS) if (!tokens.includes(token)) tokens.push(token);
  return tokens.join(' ');
}

/** Same origin as the page: the only links a router may take over. */
function isInternalUrl(href: string): boolean {
  try {
    return new URL(href, document.baseURI).origin === location.origin;
  } catch {
    return false;
  }
}

function pick<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
  what: string,
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  devWarn(
    `item:${what}:${value}`,
    `<tct-item ${what}="${value}"> is not one of ${allowed.join(', ')}.`,
  );
  return fallback;
}

/** A positive integer line count, or `undefined` (no clamp). */
function lines(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : undefined;
}

/**
 * A universal row that unifies the "start content + label + description + end content" pattern: the
 * building block of list rows, menu items, contact rows, notifications and selector options.
 *
 * The row is one of four things. **Static** (default): plain content. **Button** (`pressable`) or
 * **link** (`href`): an invisible `<button>` or `<a>` carrying the label and description is the row's
 * one tab stop, and a click anywhere on the row surface is forwarded to it, so modifier and
 * middle-click behave like the real link. **Delegating** (`interactiveElement` or
 * `interactive-selector`): the row is an enlarged click target for a nested control (a checkbox in
 * `start`) that already owns the keyboard access and action; no second tab stop is added, and a click
 * on the control itself, or on any other nested interactive element, is left to that element.
 * **Role-managed**: when the host has an author `role` (a parent such as a menu or listbox owns the
 * keyboard access), no inner button or anchor is rendered and the host is the semantic node.
 *
 * Selection is exposed as `aria-selected` when the role permits it and as `aria-current` otherwise;
 * an `aria-current` attribute on the host always wins.
 *
 * @summary A universal row: start content, label, description, end content.
 * @tag tct-item
 * @upstream Item
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot marker - A marker rendered before the start content (list bullet or counter).
 * @slot start - Leading content: an icon, avatar or checkbox.
 * @slot end - Trailing content: a badge, a timestamp or an action button.
 * @csspart item - The painted row (Astryx target `astryx-item`).
 * @csspart marker - The marker wrapper.
 * @csspart start - The start content wrapper.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart end - The end content wrapper.
 * @cssstate has-start - The `start` slot has content.
 * @cssstate has-end - The `end` slot has content.
 * @cloakDisplay block
 */
export class TctItem extends TctElement {
  static override readonly tagName = 'tct-item';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** Primary text. Accepts plain text here, or rich content through `slot="label"`. */
  @property() label = '';

  /** Secondary text under the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /**
   * What the row is (upstream `as`): `li` exposes the host as a `listitem`; `div` and `span` are
   * generic. Purely semantic.
   */
  @property() as: ItemRoot = 'div';

  /** Vertical alignment of the start and end content. */
  @property({reflect: true}) alignment: ItemAlignment = 'center';

  /** Spacing: `compact` 4px, `balanced` 8px (default) or `spacious` 12px block padding. */
  @property({reflect: true}) density: ItemDensity = 'balanced';

  /** Maximum label lines before truncation with an ellipsis. Unset: a plain-text label is one line. */
  @property({type: Number, attribute: 'label-lines'}) labelLines: number | undefined;

  /** Maximum description lines before truncation with an ellipsis. */
  @property({type: Number, attribute: 'description-lines'}) descriptionLines: number | undefined;

  /**
   * How label and description sit together: `stacked` (description below) or `inline` (one line, the
   * description ellipsizes first, so the row fits a fixed-height host).
   */
  @property({reflect: true}) layout: ItemLayout = 'stacked';

  /**
   * Makes the row a button. Listen for the native `click` event on the item; a click on a nested
   * button or link in `start` or `end` bubbles as its own click, so check `event.target`.
   */
  @property({type: Boolean, reflect: true}) pressable = false;

  /** Makes the row a link (an invisible anchor). An unsafe URL renders a destination-less anchor. */
  @property() href: string | undefined;

  /** Link target. `_blank` always adds `noopener noreferrer`. Only used with `href`. */
  @property() target: ItemTarget | undefined;

  /** Link relationship tokens; `noopener noreferrer` are merged for `_blank`. */
  @property() rel: string | undefined;

  /** Highlighted appearance (hover or keyboard focus look), for a parent that owns the pointer. */
  @property({type: Boolean, reflect: true}) highlighted = false;

  /** Selected state: always the selected look; `aria-selected` where the role permits, else `aria-current`. */
  @property({type: Boolean, reflect: true}) selected = false;

  /** Disabled state. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * A nested control (a checkbox in `start`) that already provides the row's keyboard access and
   * action (upstream `interactiveRef`). Surface clicks are delegated to it; the row renders no
   * button or anchor, so it adds no second tab stop (WCAG 4.1.2). Mutually exclusive with
   * `pressable` and `href`.
   */
  @property({attribute: false}) interactiveElement: HTMLElement | null = null;

  /** Declarative form of `interactiveElement`: a selector resolved against the item's light DOM. */
  @property({attribute: 'interactive-selector'}) interactiveSelector = '';

  readonly #slots = new SlotController(this, 'marker', 'start', 'end', 'label', 'description');
  readonly #link = new ContextConsumer(this, {context: linkContext, subscribe: true});
  readonly #description = new ContextProvider(this, {
    context: itemDescriptionContext,
    initialValue: null,
  });

  constructor() {
    super();
    // Whole-surface clicks: forwarded to the row's action, or to the delegate control.
    new ClickableContainerController(this, {
      action: () => this.#action(),
      disabled: () => this.disabled,
    });
  }

  // `role` and `aria-current` are global attributes: observing them lets the row switch to
  // role-managed mode, pick `aria-selected` or `aria-current`, and yield to an author `aria-current`.
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'role', 'aria-current'];
  }

  /** @internal */
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'role' || name === 'aria-current') this.requestUpdate();
  }

  /** Whether the row delegates clicks to a nested control. */
  get #delegating(): boolean {
    return this.interactiveElement !== null || this.interactiveSelector !== '';
  }

  /** A parent owns the role and the keyboard access: the host is the semantic node. */
  get #roleManaged(): boolean {
    return this.hasAttribute('role');
  }

  /** The element a click on the row surface is forwarded to. */
  #action(): HTMLElement | null {
    if (this.#delegating) {
      return this.interactiveElement ?? this.querySelector<HTMLElement>(this.interactiveSelector);
    }
    if (this.#roleManaged) return null;
    return this.renderRoot?.querySelector<HTMLElement>('.action') ?? null;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const role = this.getAttribute('role');
    // Host semantics are ElementInternals defaults, so author attributes (role, aria-*) win.
    this.internals.role = this.as === 'li' ? 'listitem' : null;
    const permitsSelected = role !== null && ARIA_SELECTED_ROLES.has(role);
    this.internals.ariaSelected = this.selected && permitsSelected ? 'true' : null;
    // An author `aria-current` always wins over the selection default.
    this.internals.ariaCurrent =
      this.selected && !permitsSelected && !this.hasAttribute('aria-current') ? 'true' : null;
    this.internals.ariaDisabled = this.disabled ? 'true' : null;

    if (
      (changed.has('interactiveElement') || changed.has('interactiveSelector')) &&
      this.#delegating &&
      (this.pressable || this.href !== undefined)
    ) {
      devWarn(
        'item:delegation',
        '<tct-item> `interactive-element` is mutually exclusive with `pressable` and `href`: in ' +
          'delegation mode the row only forwards clicks to the nested control, so both are ignored.',
      );
    }
  }

  protected override updated(): void {
    // The controller marks its host a pressable container on connect; a row that is not interactive
    // must not stop an outer clickable container from proxying clicks that land on it.
    this.toggleAttribute('data-pressable-container', this.#isInteractive);
    this.toggleState('has-start', this.#slots.has('start'));
    this.toggleState('has-end', this.#slots.has('end'));
    this.#publishDescription();
  }

  get #isInteractive(): boolean {
    return this.pressable || this.href !== undefined || this.#delegating;
  }

  /** Publishes the rendered description to slotted controls (null: none rendered). */
  #publishDescription(): void {
    const slotted = this.querySelector<HTMLElement>(':scope > [slot="description"]');
    const text = slotted ? (slotted.textContent ?? '').trim() : this.description.trim();
    const next: ItemDescription | null = text === '' && !slotted ? null : {text, element: slotted};
    const current = this.#description.value;
    if (
      (current === null && next === null) ||
      (current !== null &&
        next !== null &&
        current.text === next.text &&
        current.element === next.element)
    ) {
      return;
    }
    this.#description.setValue(next);
  }

  /** Router hand-off for an unmodified primary click on a same-origin link. */
  readonly #onAnchorClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.target && this.target !== '_self') return;
    const href = this.href === undefined ? null : safeUrl(this.href, {allowData: true});
    if (!href || !isInternalUrl(href)) return;
    if (this.#link.value?.navigate?.(href, event)) event.preventDefault();
  };

  protected override render(): TemplateResult {
    const density = pick(this.density, ITEM_DENSITIES, 'balanced', 'density');
    const alignment = pick(this.alignment, ITEM_ALIGNMENTS, 'center', 'alignment');
    const layout = pick(this.layout, ITEM_LAYOUTS, 'stacked', 'layout');
    pick(this.as, ITEM_ROOTS, 'div', 'as');

    const inline = layout === 'inline';
    const labelLines = lines(this.labelLines);
    const descriptionLines = lines(this.descriptionLines);
    const hasDescription = this.description !== '' || this.#slots.has('description');
    const richLabel = this.#slots.has('label');
    const richDescription = this.#slots.has('description');

    // A plain-text label ellipsizes on one line by default; rich content controls its own wrapping.
    const labelTruncate =
      labelLines !== undefined
        ? labelLines === 1
          ? 'single'
          : 'multi'
        : richLabel
          ? undefined
          : 'single';
    // Inline rows are one line by definition, so the description always ellipsizes there.
    const descriptionTruncate =
      descriptionLines !== undefined
        ? descriptionLines === 1
          ? 'single'
          : 'multi'
        : richDescription && !inline
          ? undefined
          : 'single';

    const labelAndDescription = html`
      <span
        class="label"
        part="label"
        data-truncate=${ifDefined(labelTruncate)}
        style=${styleMap(labelLines && labelLines > 1 ? {'--_label-lines': String(labelLines)} : {})}
        ><slot name="label">${this.label}</slot></span
      >${
        hasDescription
          ? html`<span
              class="description"
              part="description"
              data-truncate=${ifDefined(descriptionTruncate)}
              style=${styleMap(
                descriptionLines && descriptionLines > 1
                  ? {'--_description-lines': String(descriptionLines)}
                  : {},
              )}
              ><slot name="description">${this.description}</slot></span
            >`
          : nothing
      }
    `;

    const roleManaged = this.#roleManaged;
    const delegating = this.#delegating;

    let content: TemplateResult;
    if (delegating || roleManaged) {
      // Keyboard access lives on the nested control (or the parent's role): no second tab stop.
      content = html`<span class="content">${labelAndDescription}</span>`;
    } else if (this.href !== undefined) {
      const href = safeUrl(this.href, {allowData: true});
      content = html`<a
        class="action"
        part="action"
        href=${ifDefined(href ?? undefined)}
        target=${ifDefined(this.target)}
        rel=${ifDefined(mergeRel(this.target, this.rel))}
        aria-disabled=${this.disabled ? 'true' : nothing}
        tabindex=${this.disabled ? '-1' : nothing}
        @click=${this.#onAnchorClick}
        >${labelAndDescription}</a
      >`;
    } else if (this.pressable) {
      content = html`<button class="action" part="action" type="button" ?disabled=${this.disabled}>
        ${labelAndDescription}
      </button>`;
    } else {
      content = html`<span class="content">${labelAndDescription}</span>`;
    }

    return html`<div
      class="base focus-within-ring"
      part="item"
      data-density=${density}
      data-alignment=${alignment}
      data-layout=${layout}
      ?data-interactive=${this.#isInteractive}
      ?data-highlighted=${this.highlighted}
      ?data-selected=${this.selected}
      ?data-disabled=${this.disabled}
      ?data-role-managed=${roleManaged}
    >
      ${
        this.#slots.has('marker')
          ? html`<span class="marker" part="marker"><slot name="marker"></slot></span>`
          : nothing
      }
      ${
        this.#slots.has('start')
          ? html`<span class="start" part="start"><slot name="start"></slot></span>`
          : nothing
      }
      ${content}
      ${
        this.#slots.has('end')
          ? html`<span class="end" part="end"><slot name="end"></slot></span>`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-item': TctItem;
  }
}

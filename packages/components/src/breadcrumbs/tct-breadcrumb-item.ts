import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import defaultMessages from '@tecton-wc/locales/en/breadcrumbs.js';
import {TctDropdownMenu} from '../dropdown-menu/tct-dropdown-menu.js';
import type {DropdownMenuOption} from '../dropdown-menu/dropdown-menu.types.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctLink} from '../link/tct-link.js';
import base from '../styles/base.styles.css';
import {breadcrumbsContext} from './breadcrumbs.context.js';
import {BREADCRUMB_MENU_SIZES, type BreadcrumbMenuSize} from './breadcrumbs.types.js';
import styles from './tct-breadcrumb-item.styles.css';

/** `current` is tri-state: absent is "let the trail decide", `current="false"` opts out, anything else is true. */
const currentConverter = {
  fromAttribute: (value: string | null): boolean | undefined =>
    value === null ? undefined : value !== 'false',
};

/**
 * One step of a `tct-breadcrumbs` trail: a link to an ancestor page (`href`), the current page, or a
 * menu. The host is the list item (`ElementInternals`); it renders the separator before its crumb (hidden
 * on the first item), so a trail needs no separator markup of its own.
 *
 * - **Link:** with `href` the crumb is a `tct-link` (client-side routers through `tct-link-provider`).
 * - **Action:** with neither `href` nor `menu` (and not current) it is a `<button>`; listen for `click`.
 * - **Current page:** `current` renders plain text with `aria-current="page"`. Without `current` anywhere,
 *   the trail marks the last item, keeping its link when it has one.
 * - **Menu:** `menu` (data rows, like `tct-dropdown-menu` `items`) or `slot="menu"` children
 *   (`tct-dropdown-menu-item`s) make the crumb a menu button with a chevron (`aria-haspopup="menu"`),
 *   for sibling pages. `menu` wins over `href`.
 *
 * @summary One crumb of a breadcrumb trail: a link, the current page, an action or a menu.
 * @tag tct-breadcrumb-item
 * @upstream BreadcrumbItem
 * @slot - The label.
 * @slot icon - Icon before the label (or set `icon`).
 * @slot menu - Menu rows (`tct-dropdown-menu-item`, dividers, sub menus) of a compound menu crumb.
 * @csspart item - The list item's painted row: separator and crumb (upstream theming target `breadcrumb-item`).
 * @csspart crumb - The crumb: the link, the button or the current-page text.
 * @csspart separator - The decorative separator before the crumb.
 * @csspart menu-trigger - The menu button of a menu crumb (upstream theming target `breadcrumb-item-menu-trigger`).
 * @csspart overflow-trigger - The ellipsis button that stands for collapsed crumbs.
 * @csspart menu - The menu surface (upstream theming target `breadcrumb-menu`).
 * @fires click - Native click on an action crumb or a link crumb.
 * @cloakDisplay flex
 */
export class TctBreadcrumbItem extends TctElement {
  static override readonly tagName = 'tct-breadcrumb-item';
  static override readonly dependencies = [TctLink, TctIcon, TctDropdownMenu];
  static override styles: CSSResultGroup = [base, styles];

  /** Destination of a link crumb. Omit it for the current page or an action. */
  @property() href: string | undefined;

  /**
   * Marks this item as the current page (`aria-current="page"`, plain text). Absent: the trail marks the
   * last item when no item is current. `current="false"` opts this item out of that automatic choice.
   */
  @property({converter: currentConverter}) current: boolean | undefined;

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /**
   * Data rows of a menu crumb, the shape of `tct-dropdown-menu` `items`: actions, dividers and sections.
   * Leave unset and use `slot="menu"` children for a compound menu.
   */
  @property({attribute: false}) menu: DropdownMenuOption[] | undefined;

  /** Size of the menu rows: `sm`, `md` or `lg`. Default: `sm` in a `supporting` trail, else `md`. */
  @property({attribute: 'menu-size'}) menuSize: BreadcrumbMenuSize | undefined;

  readonly #context: ContextConsumer<typeof breadcrumbsContext> = new ContextConsumer<
    typeof breadcrumbsContext
  >(this, {context: breadcrumbsContext, subscribe: true});
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<typeof linkContext>(
    this,
    {context: linkContext},
  );
  readonly #slots: SlotController = new SlotController(this, 'icon', 'menu');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'breadcrumbs',
    defaults: defaultMessages,
  });

  constructor() {
    super();
    this.internals.role = 'listitem';
  }

  /**
   * The item's text, for the menu of collapsed crumbs.
   * @internal
   */
  get labelText(): string {
    return this.#labelText();
  }

  #labelText(): string {
    return [...this.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE || (node as Element).slot === '')
      .map((node) => node.textContent ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  get #hasMenu(): boolean {
    return this.menu !== undefined || this.#slots.has('menu');
  }

  /** Whether this item is the current page: explicit, or the trail's automatic choice. */
  get #isExplicitCurrent(): boolean {
    return this.current === true;
  }

  get #isAutoCurrent(): boolean {
    return this.current === undefined && this.#context.value?.autoCurrent === this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const collapsed = this.#context.value?.collapsed ?? [];
    // The first collapsed item stands for all of them (an ellipsis menu); the others vanish.
    this.toggleAttribute('data-tct-collapsed', collapsed.includes(this) && collapsed[0] !== this);
    if (changed.has('menuSize') && this.menuSize && !BREADCRUMB_MENU_SIZES.includes(this.menuSize)) {
      devWarn(
        `breadcrumb-item:menu-size:${this.menuSize}`,
        `<tct-breadcrumb-item menu-size="${this.menuSize}"> is not one of ${BREADCRUMB_MENU_SIZES.join(', ')}.`,
      );
    }
    if (this.#hasMenu && (this.href !== undefined)) {
      devWarn(
        'breadcrumb-item:menu-href',
        '`menu` and `href` are mutually exclusive on <tct-breadcrumb-item>: `menu` takes precedence and `href` is ignored.',
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('current')) this.#context.value?.refresh();
  }

  /** Runs a collapsed crumb from the ellipsis menu: navigate like the link would, or click the action. */
  #openCollapsed(item: TctBreadcrumbItem, event: Event): void {
    if (item.href) {
      const href = safeUrl(item.href, {allowData: true});
      if (href === null) return;
      if (this.#router.value?.navigate?.(href, event as MouseEvent)) return;
      location.assign(href);
      return;
    }
    item.click();
  }

  get #menuSize(): BreadcrumbMenuSize {
    if (this.menuSize && BREADCRUMB_MENU_SIZES.includes(this.menuSize)) return this.menuSize;
    return this.#context.value?.variant === 'supporting' ? 'sm' : 'md';
  }

  #renderIcon(): TemplateResult | typeof nothing {
    if (this.#slots.has('icon')) {
      return html`<span class="icon-slot"><slot name="icon"></slot></span>`;
    }
    return this.icon
      ? html`<tct-icon class="icon" name=${this.icon} size="sm" color="inherit"></tct-icon>`
      : nothing;
  }

  #renderSeparator(): TemplateResult {
    const context = this.#context.value;
    const icon = context?.separatorIcon ?? '';
    const text = context?.separator ?? '/';
    return html`<span class="separator" part="separator" aria-hidden="true" data-slash=${text === '/' && !icon ? '' : nothing}
      >${icon ? html`<tct-icon name=${icon} size="xsm" color="inherit"></tct-icon>` : text}</span
    >`;
  }

  /** The ellipsis button standing for the collapsed crumbs, with the menu of them. */
  #renderOverflow(collapsed: readonly HTMLElement[]): TemplateResult {
    const items = collapsed as TctBreadcrumbItem[];
    const name = this.#locale.t('overflow', {count: items.length});
    const rows: DropdownMenuOption[] = items.map((item) => ({
      label: item.labelText,
      icon: item.icon || undefined,
      onClick: (event: Event) => {
        this.#openCollapsed(item, event);
      },
    }));
    return html`<tct-dropdown-menu
      class="menu"
      label=${name}
      size=${this.#menuSize}
      .items=${rows}
      exportparts="menu"
    >
      <button slot="trigger" type="button" class="crumb trigger" part="overflow-trigger" aria-label=${name} data-overflow>
        <tct-icon name="moreHorizontal" size="sm" color="inherit"></tct-icon>
      </button>
    </tct-dropdown-menu>`;
  }

  #renderMenu(current: boolean): TemplateResult {
    const compound = this.menu === undefined;
    const name = this.labelText;
    return html`<tct-dropdown-menu
      class="menu"
      label=${name}
      size=${this.#menuSize}
      .items=${this.menu}
      placement="below"
      alignment="start"
      exportparts="menu"
    >
      <button
        slot="trigger"
        type="button"
        class="crumb trigger"
        part="menu-trigger"
        aria-current=${ifDefined(current ? 'page' : undefined)}
        ?data-current=${current}
      >
        ${this.#renderIcon()}<slot></slot
        ><tct-icon class="chevron" name="chevronDown" size="xsm" color="inherit"></tct-icon>
      </button>
      ${compound ? html`<slot name="menu"></slot>` : nothing}
    </tct-dropdown-menu>`;
  }

  #renderCrumb(): TemplateResult {
    const explicit = this.#isExplicitCurrent;
    const auto = this.#isAutoCurrent;
    const current = explicit || auto;
    if (this.#hasMenu) return this.#renderMenu(current);
    if (explicit || (auto && this.href === undefined)) {
      return html`<span class="crumb" part="crumb" aria-current="page" data-current
        >${this.#renderIcon()}<slot></slot
      ></span>`;
    }
    if (this.href !== undefined) {
      return html`<tct-link
        class="crumb link"
        part="crumb"
        href=${this.href}
        color=${current ? 'primary' : 'secondary'}
        type="inherit"
        aria-current=${ifDefined(auto ? 'page' : undefined)}
        ?data-current=${current}
        >${this.#renderIcon()}<slot></slot
      ></tct-link>`;
    }
    return html`<button type="button" class="crumb button" part="crumb">${this.#renderIcon()}<slot></slot></button>`;
  }

  override render(): TemplateResult {
    const context = this.#context.value;
    const collapsed = context?.collapsed ?? [];
    const variant = context?.variant ?? 'default';
    let body: TemplateResult | typeof nothing;
    if (collapsed.includes(this)) {
      // The first collapsed item renders the ellipsis for all of them; the rest are hidden by the host.
      body = collapsed[0] === this ? this.#renderOverflow(collapsed) : nothing;
    } else {
      body = this.#renderCrumb();
    }
    return html`<span class="item" part="item" data-variant=${variant}
      >${this.#renderSeparator()}${body}</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-breadcrumb-item': TctBreadcrumbItem;
  }
}

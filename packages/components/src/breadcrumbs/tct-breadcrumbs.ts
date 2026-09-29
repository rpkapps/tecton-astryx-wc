import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import defaultMessages from '@tecton-wc/locales/en/breadcrumbs.js';
import base from '../styles/base.styles.css';
import {breadcrumbsContext, type BreadcrumbsContextValue} from './breadcrumbs.context.js';
import {BREADCRUMBS_VARIANTS, type BreadcrumbsVariant} from './breadcrumbs.types.js';
import styles from './tct-breadcrumbs.styles.css';
import type {TctBreadcrumbItem} from './tct-breadcrumb-item.js';

/**
 * A breadcrumb trail: a labelled `<nav>` landmark around an ordered list of `tct-breadcrumb-item`
 * children, with a decorative separator between them (the WAI-ARIA breadcrumb pattern). The current page
 * is marked `aria-current="page"`: an item with `current`, else the last item (opt an item out with
 * `current="false"`).
 *
 * Long trails collapse: with `max-items` the first item and the last `max-items - 1` stay, and the ones
 * between become one ellipsis button that opens a menu of the hidden crumbs. An item can also open a
 * menu of its own (`menu`), for sibling pages.
 *
 * @summary A navigation trail from the root to the current page; long trails collapse into a menu.
 * @tag tct-breadcrumbs
 * @upstream Breadcrumbs
 * @slot - `tct-breadcrumb-item` children.
 * @csspart base - The `<nav>` landmark (upstream theming target `breadcrumbs`).
 * @csspart list - The ordered list.
 * @cloakDisplay block
 */
export class TctBreadcrumbs extends TctElement {
  static override readonly tagName = 'tct-breadcrumbs';
  static override styles: CSSResultGroup = [base, styles];

  /** `default` (standard text) or `supporting` (smaller, secondary: dense UIs, sidebars). */
  @property({reflect: true}) variant: BreadcrumbsVariant = 'default';

  /** Accessible name of the landmark. Default: the localized "Breadcrumb". A host `aria-label` wins. */
  @property() label = '';

  /** Text between items. Decorative (`aria-hidden`); the default slash mirrors in right-to-left. */
  @property() separator = '/';

  /**
   * A registered icon name (`chevronRight`) used as the separator instead of `separator`. Directional
   * icons mirror in right-to-left by themselves.
   */
  @property({attribute: 'separator-icon'}) separatorIcon = '';

  /**
   * Collapses a longer trail: at most this many items stay visible (the first, and the last
   * `max-items - 1`); the ones between move into an ellipsis menu. 0 (default) never collapses;
   * values below 2 are treated as 2.
   */
  @property({type: Number, attribute: 'max-items'}) maxItems = 0;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'breadcrumbs',
    defaults: defaultMessages,
  });
  #lastContext: BreadcrumbsContextValue | undefined;
  #pending = false;

  readonly #refresh = (): void => {
    if (this.#pending) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      this.#provider.setValue(this.#contextValue());
    });
  };

  readonly #provider: ContextProvider<typeof breadcrumbsContext> = new ContextProvider<
    typeof breadcrumbsContext
  >(this, {
    context: breadcrumbsContext,
    initialValue: this.#contextValue(),
  });

  constructor() {
    super();
    new AriaDelegateController(this, {target: () => this.renderRoot.querySelector('nav')});
  }

  /** The trail's items, in order. */
  #items(): TctBreadcrumbItem[] {
    return [...this.children].filter(
      (child): child is TctBreadcrumbItem => child.localName === 'tct-breadcrumb-item',
    );
  }

  /** The current page by position: the last item, unless an item says so explicitly or opted out. */
  #autoCurrent(items: readonly TctBreadcrumbItem[]): HTMLElement | null {
    if (items.some((item) => item.current === true)) return null;
    const last = items.at(-1);
    return last && last.current === undefined ? last : null;
  }

  #collapsed(items: readonly TctBreadcrumbItem[]): TctBreadcrumbItem[] {
    if (this.maxItems <= 0 || !Number.isFinite(this.maxItems)) return [];
    const max = Math.max(2, Math.floor(this.maxItems));
    if (items.length <= max) return [];
    // First item, then the hidden run, then the last `max - 1` items.
    return items.slice(1, items.length - (max - 1));
  }

  #contextValue(): BreadcrumbsContextValue {
    const items = this.#items();
    const next: BreadcrumbsContextValue = {
      variant: BREADCRUMBS_VARIANTS.includes(this.variant) ? this.variant : 'default',
      separator: this.separator,
      separatorIcon: this.separatorIcon,
      autoCurrent: this.#autoCurrent(items),
      collapsed: this.#collapsed(items),
      refresh: this.#refresh,
    };
    const last = this.#lastContext;
    // Keep the identity while nothing changed: every change re-renders every item.
    if (
      last?.variant === next.variant &&
      last.separator === next.separator &&
      last.separatorIcon === next.separatorIcon &&
      last.autoCurrent === next.autoCurrent &&
      last.collapsed.length === next.collapsed.length &&
      last.collapsed.every((item, index) => item === next.collapsed[index])
    ) {
      return last;
    }
    this.#lastContext = next;
    return next;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant') && !BREADCRUMBS_VARIANTS.includes(this.variant)) {
      devWarn(
        `breadcrumbs:variant:${this.variant}`,
        `<tct-breadcrumbs variant="${this.variant}"> is not one of ${BREADCRUMBS_VARIANTS.join(', ')}; using "default".`,
      );
    }
    this.#provider.setValue(this.#contextValue());
  }

  readonly #onSlotChange = (): void => {
    this.#provider.setValue(this.#contextValue());
  };

  override render(): TemplateResult {
    return html`<nav
      class="root"
      part="base"
      aria-label=${this.label || this.#locale.t('label', undefined, 'label')}
      data-variant=${BREADCRUMBS_VARIANTS.includes(this.variant) ? this.variant : 'default'}
    >
      <ol class="list" part="list" role="list">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </ol>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-breadcrumbs': TctBreadcrumbs;
  }
}

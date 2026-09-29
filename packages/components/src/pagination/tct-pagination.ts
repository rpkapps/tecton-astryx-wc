import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {repeat} from 'lit/directives/repeat.js';
import paginationMessages from '@tecton-wc/locales/en/pagination.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import type {ElementSize} from '@tecton-wc/core/context/keys.js';
import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctPageChangeEvent} from '@tecton-wc/core/events/tct-page-change.js';
import {TctPageSizeChangeEvent} from '@tecton-wc/core/events/tct-page-size-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement, type TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctButton} from '../button/tct-button.js';
import {TctNumberInput} from '../number-input/tct-number-input.js';
import {TctSelector} from '../selector/tct-selector.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {TctText} from '../text/tct-text.js';
import {
  PAGINATION_SIZES,
  PAGINATION_VARIANTS,
  type PaginationChangeAction,
  type PaginationSize,
  type PaginationVariant,
} from './pagination.types.js';
import {
  DEFAULT_PAGE_SIZE,
  coercePageSize,
  coerceSiblingCount,
  coerceStep,
  generatePageRange,
  resolveTotalPages,
} from './pagination.utils.js';
import styles from './tct-pagination.styles.css';

/** `page-size-options="10, 25, 50"`: whitespace or comma separated whole numbers. */
const pageSizeOptionsConverter = {
  fromAttribute(value: string | null): number[] | undefined {
    if (value === null) return undefined;
    const sizes = value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((size) => Number.isFinite(size));
    return sizes.length > 0 ? sizes : undefined;
  },
};

/**
 * Controls for moving through pages of content: previous and next buttons around one of six
 * presentations (`variant`: page numbers, an item-range count, a "Page X of Y" readout, dots, an editable
 * page box, or nothing), and an optional page-size selector. It works with a known total (`total-items` or
 * `total-pages`) or with cursor paging (`has-more`, total unknown).
 *
 * It is a native `<nav>` landmark named by `label` (default "Pagination"). Page buttons are labelled "Go to
 * page N" and mark the current one with `aria-current="page"`. The dots are one tab stop (a radio-group-like
 * row): arrows move focus and the page together, Home and End jump to the ends. A user-driven page change
 * is announced politely as "Page N of M"; setting `page` from code never announces.
 *
 * It does not own the data. The user asks for a page with the cancelable `tct-page-change` event; unless it
 * is prevented the element applies `page` itself, so it works without any script. Choosing another page
 * size fires `tct-page-size-change`, applies it, and returns to page 1.
 *
 * @summary Previous, next and page controls for paged content, with an optional page-size selector.
 * @tag tct-pagination
 * @upstream Pagination
 * @csspart nav - The navigation landmark that holds everything.
 * @csspart page-size - The page-size selector.
 * @csspart controls - The row of previous, next and page controls.
 * @csspart first - The go-to-first-page button (`input` variant).
 * @csspart previous - The previous-page button.
 * @csspart next - The next-page button.
 * @csspart last - The go-to-last-page button (`input` variant).
 * @csspart page - A page-number button (`pages` variant).
 * @csspart ellipsis - The marker of omitted page numbers.
 * @csspart readout - The count or "Page X of Y" text.
 * @csspart dots - The group of page dots.
 * @csspart dot - One page dot.
 * @csspart input-group - The "Page [ n ] / N" group of the `input` variant.
 * @csspart input-label - The visible noun before the page box.
 * @csspart page-input - The editable page box.
 * @csspart input-total - The "/ N" text after the page box.
 * @fires tct-page-change - The user asked for another page; cancelable, and preventing it keeps the current page.
 * @fires tct-page-size-change - The user chose another page size; cancelable, and preventing it keeps the size.
 * @cssstate busy - A `changeAction` is pending.
 * @cssstate disabled - The paginator is disabled.
 * @cloakDisplay block
 */
export class TctPagination extends TctElement {
  static override readonly tagName = 'tct-pagination';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    TctButton,
    TctNumberInput,
    TctSelector,
    TctText,
  ];
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** The current page, 1-based. Changed by the user's actions (after `tct-page-change`) and by code. */
  @property({type: Number}) page = 1;

  /**
   * The number of items. The page count is derived from it and `page-size`, and it feeds the `count`
   * variant. When both this and `total-pages` are set, this wins. Zero or less renders nothing.
   */
  @property({type: Number, attribute: 'total-items'}) totalItems: number | undefined;

  /** The number of pages, when the item count is not known. Zero or less renders nothing. */
  @property({type: Number, attribute: 'total-pages'}) totalPages: number | undefined;

  /**
   * Cursor paging: more pages follow the current one, and the total is unknown. Enables the next button
   * when no total is set; the `pages`, `compact`, `dots` and first/last presentations need a total.
   */
  @property({type: Boolean, attribute: 'has-more'}) hasMore = false;

  /** Items per page. Coerced to a positive whole number; a non-finite value falls back to 10. */
  @property({type: Number, attribute: 'page-size'}) pageSize = DEFAULT_PAGE_SIZE;

  /**
   * The page sizes to offer in a selector before the controls (`10, 25, 50` as an attribute). Unset or empty
   * shows no selector.
   */
  @property({attribute: 'page-size-options', converter: pageSizeOptionsConverter})
  pageSizeOptions: number[] | undefined;

  /** What sits between previous and next: `pages`, `count`, `compact`, `dots`, `input` or `none`. */
  @property({reflect: true}) variant: PaginationVariant = 'pages';

  /** The noun before the editable box in the `input` variant (`Row`). Navigation is still by page. Default: the localized "Page". */
  @property({attribute: 'page-label'}) pageLabel = '';

  /** Leaves out the first and last buttons that flank previous and next in the `input` variant. */
  @property({type: Boolean, attribute: 'no-first-last'}) noFirstLast = false;

  /**
   * How many pages previous and next move per activation, clamped to the range. A value that is not a
   * whole number of at least 1 is 1. Above 1 the buttons are named for the stride ("Go forward 5 pages").
   */
  @property({type: Number}) step = 1;

  /** Page buttons on each side of the current page (`pages` variant). */
  @property({type: Number, attribute: 'sibling-count'}) siblingCount = 1;

  /** Size of the controls. Unset follows an enclosing size provider or toolbar, else `md`; `lg` is `md`. */
  @property({reflect: true}) size: PaginationSize | undefined;

  /** Disables every control. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** The accessible name of the navigation landmark. Default: the localized "Pagination". */
  @property() label = '';

  /**
   * Runs after the user changed the page (with the new page). While a returned promise is pending the
   * paginator is busy (`aria-busy`, `:state(busy)`) and further changes are not blocked; if it rejects and
   * the page is still the one that was asked for, the previous page is restored.
   */
  @property({attribute: false}) changeAction: PaginationChangeAction | undefined;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'pagination',
    defaults: paginationMessages,
  });
  readonly #size: SizeController<ElementSize> = new SizeController<ElementSize>(this, {
    explicit: () => this.size,
    fallback: 'md',
  });
  #pending = 0;

  /**
   * The dots are one tab stop; arrows move focus, and (selection follows focus, as a radio group)
   * ask for the page of the dot that received it [mwg:accessible-web-components].
   */
  readonly #roving: RovingTabindexController<HTMLButtonElement> =
    new RovingTabindexController<HTMLButtonElement>(this, {
      items: () => this.#dots(),
      orientation: 'horizontal',
      wrap: true,
      activateOnFocus: true,
      onActivate: (dot) => {
        this.#request(Number(dot.dataset.page), 'keyboard');
      },
    });

  // ------------------------------------------------------------------------------- derived values

  /** The page size the layout uses. */
  get #pageSize(): number {
    return coercePageSize(this.pageSize);
  }

  get #totalPages(): number | undefined {
    return resolveTotalPages(this.totalItems, this.totalPages, this.#pageSize);
  }

  /** The page shown: at least 1 (a `page` of 0 or a fraction is a caller mistake, not a crash). */
  get #currentPage(): number {
    return Number.isFinite(this.page) ? Math.max(1, Math.floor(this.page)) : 1;
  }

  get #buttonSize(): 'sm' | 'md' {
    return this.#size.value === 'sm' ? 'sm' : 'md';
  }

  #dots(): HTMLButtonElement[] {
    return [...(this.renderRoot?.querySelectorAll<HTMLButtonElement>('.dot') ?? [])];
  }

  /** Whether the paginator has nothing to show: no items, or no pages. */
  get #empty(): boolean {
    const total = this.#totalPages;
    return (
      (this.totalItems !== undefined && this.totalItems <= 0) || (total !== undefined && total <= 0)
    );
  }

  // ------------------------------------------------------------------------------------ lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('variant') &&
      !(PAGINATION_VARIANTS as readonly string[]).includes(this.variant)
    ) {
      devWarn(
        'tct-pagination:variant',
        `variant "${this.variant}" is not one of ${PAGINATION_VARIANTS.join(', ')}; nothing renders between previous and next.`,
      );
    }
    if (
      changed.has('size') &&
      this.size &&
      !(PAGINATION_SIZES as readonly string[]).includes(this.size)
    ) {
      devWarn('tct-pagination:size', `size "${this.size}" is not sm or md; md is used.`);
    }
  }

  protected override updated(): void {
    this.toggleState('busy', this.#pending > 0);
    this.toggleState('disabled', this.disabled);
    if (this.variant === 'dots') {
      // The current page's dot is the tab stop (the roving controller keeps the last focused one otherwise).
      const current = this.#dots().find((dot) => dot.getAttribute('aria-current') === 'page');
      if (current) this.#roving.setActive(current);
    }
  }

  // ------------------------------------------------------------------------------------ changes

  /**
   * The user asks for `next`. `tct-page-change` fires first; unless it is prevented the page changes, is
   * announced, and the change action runs. Returns whether the page was applied. A request for the current
   * page is ignored unless `always` (a page-size change asks for page 1 so a loader can rely on it).
   */
  #request(next: number, reason: ChangeReason, always = false): boolean {
    if (this.disabled) return false;
    const previous = this.#currentPage;
    if (next === previous && !always) return false;
    if (!this.dispatch(new TctPageChangeEvent(next, previous, reason))) return false;
    this.page = next;
    this.#announcePage(next);
    this.#runChangeAction(next, previous);
    return true;
  }

  #announcePage(page: number): void {
    const total = this.#totalPages;
    announce(
      total !== undefined
        ? this.#locale.t('pageOfTotal', {current: page, total})
        : this.#locale.t('pageAnnounce', {current: page}),
      {element: this},
    );
  }

  #runChangeAction(next: number, previous: number): void {
    const action = this.changeAction;
    if (!action) return;
    let result: void | Promise<void>;
    try {
      result = action(next);
    } catch {
      this.#restore(next, previous);
      return;
    }
    if (!result || typeof result.then !== 'function') return;
    this.#pending++;
    this.requestUpdate();
    void Promise.resolve(result).then(
      () => this.#settle(),
      () => {
        this.#settle();
        this.#restore(next, previous);
      },
    );
  }

  #settle(): void {
    this.#pending = Math.max(0, this.#pending - 1);
    this.requestUpdate();
  }

  /** A failed action puts the page back, unless something else has moved it on since. */
  #restore(next: number, previous: number): void {
    if (this.#currentPage === next) this.page = previous;
  }

  /** The target of a previous/next/first/last request, kept inside the known range. */
  #clamp(target: number): number {
    const lower = Math.max(target, 1);
    const total = this.#totalPages;
    return total !== undefined ? Math.min(lower, total) : lower;
  }

  #reasonOf(event: Event): ChangeReason {
    return event instanceof MouseEvent && event.detail === 0 ? 'keyboard' : 'pointer';
  }

  readonly #onPrevious = (event: Event): void => {
    if (this.#currentPage > 1) {
      this.#request(this.#clamp(this.#currentPage - coerceStep(this.step)), this.#reasonOf(event));
    }
  };

  readonly #onNext = (event: Event): void => {
    if (this.#hasNext) {
      this.#request(this.#clamp(this.#currentPage + coerceStep(this.step)), this.#reasonOf(event));
    }
  };

  readonly #onFirst = (event: Event): void => {
    if (this.#currentPage > 1) this.#request(1, this.#reasonOf(event));
  };

  readonly #onLast = (event: Event): void => {
    const total = this.#totalPages;
    if (this.#hasNext && total !== undefined) this.#request(total, this.#reasonOf(event));
  };

  get #hasNext(): boolean {
    const total = this.#totalPages;
    return total !== undefined ? this.#currentPage < total : this.hasMore;
  }

  /** The page box committed a page (Enter or leaving it). Its own `input`/`change` never leave the paginator. */
  readonly #onInputChange = (event: Event): void => {
    event.stopPropagation();
    const box = event.currentTarget as TctNumberInput;
    const next = box.valueAsNumber;
    if (Number.isFinite(next) && next !== this.#currentPage) this.#request(next, 'keyboard');
    // An empty, invalid or refused entry goes back to the page that is current.
    box.value = String(this.#currentPage);
  };

  readonly #stopInternal = (event: Event): void => {
    event.stopPropagation();
  };

  readonly #onPageSizeChange = (event: Event): void => {
    event.stopPropagation();
    const selector = event.currentTarget as TctSelector;
    const next = Number(selector.value);
    const previous = this.#pageSize;
    const revert = (): void => {
      selector.value = String(this.#pageSize);
    };
    if (!Number.isFinite(next) || next === previous) {
      revert();
      return;
    }
    if (!this.dispatch(new TctPageSizeChangeEvent(next, previous))) {
      revert();
      return;
    }
    this.pageSize = next;
    // A new size starts over at page 1; the request fires even from page 1 so a loader can rely on it.
    this.#request(1, 'selection', true);
  };

  // -------------------------------------------------------------------------------------- render

  protected override render(): TemplateResult | typeof nothing {
    if (this.#empty) return nothing;
    const t = (key: string, args?: Record<string, unknown>): string => this.#locale.t(key, args);
    const step = coerceStep(this.step);
    const previousLabel = step > 1 ? t('previousBy', {step}) : t('previous');
    const nextLabel = step > 1 ? t('nextBy', {step}) : t('next');
    const current = this.#currentPage;
    const total = this.#totalPages;
    const hasPrevious = current > 1;
    const hasNext = this.#hasNext;
    const showFirstLast = !this.noFirstLast && this.variant === 'input' && total !== undefined;
    const sizes = this.pageSizeOptions?.filter((size) => Number.isFinite(size));

    return html`<nav
      part="nav"
      class="nav"
      aria-label=${this.label || t('label')}
      aria-busy=${ifDefined(this.#pending > 0 ? 'true' : undefined)}
    >
      ${
        sizes && sizes.length > 0
          ? html`<tct-selector
              class="page-size"
              part="page-size"
              label=${t('itemsPerPage')}
              label-hidden
              size=${this.#buttonSize}
              ?disabled=${this.disabled}
              .options=${sizes.map(String)}
              .value=${String(this.#pageSize)}
              .width=${80}
              @input=${this.#stopInternal}
              @change=${this.#onPageSizeChange}
            ></tct-selector>`
          : nothing
      }
      <div class="controls" part="controls">
        ${
          showFirstLast
            ? this.#renderStep(
                'first',
                'chevronsLeft',
                t('first'),
                !hasPrevious || this.disabled,
                this.#onFirst,
              )
            : nothing
        }
        ${this.#renderStep(
          'previous',
          'chevronLeft',
          previousLabel,
          !hasPrevious || this.disabled,
          this.#onPrevious,
        )}
        ${this.#renderIndicator(t, current, total)}
        ${this.#renderStep('next', 'chevronRight', nextLabel, !hasNext || this.disabled, this.#onNext)}
        ${
          showFirstLast
            ? this.#renderStep(
                'last',
                'chevronsRight',
                t('last'),
                !hasNext || this.disabled,
                this.#onLast,
              )
            : nothing
        }
      </div>
    </nav>`;
  }

  /** An icon-only ghost button; its tooltip repeats the name while it can be used. Direction glyphs mirror in RTL by themselves. */
  #renderStep(
    name: 'first' | 'previous' | 'next' | 'last',
    icon: string,
    label: string,
    unavailable: boolean,
    onClick: (event: Event) => void,
  ): TemplateResult {
    return html`<tct-button
      class=${name}
      part=${name}
      variant="ghost"
      size=${this.#buttonSize}
      icon=${icon}
      icon-only
      label=${label}
      tooltip=${unavailable ? '' : label}
      ?disabled=${unavailable}
      @click=${onClick}
    ></tct-button>`;
  }

  #renderIndicator(
    t: (key: string, args?: Record<string, unknown>) => string,
    current: number,
    total: number | undefined,
  ): TemplateResult | typeof nothing {
    switch (this.variant) {
      case 'pages':
        return total === undefined ? nothing : this.#renderPages(t, current, total);
      case 'count':
        return this.totalItems === undefined ? nothing : this.#renderCount(t, current);
      case 'compact':
        return total === undefined
          ? nothing
          : html`<tct-text class="readout" part="readout" type="body" size="sm" color="secondary"
              >${t('pageOfTotal', {current, total})}</tct-text
            >`;
      case 'dots':
        return total === undefined ? nothing : this.#renderDots(t, current, total);
      case 'input':
        return this.#renderInput(t, current, total);
      default:
        return nothing;
    }
  }

  #renderPages(
    t: (key: string, args?: Record<string, unknown>) => string,
    current: number,
    total: number,
  ): TemplateResult {
    const range = generatePageRange(current, total, coerceSiblingCount(this.siblingCount));
    return html`${range.map((item) => {
      if (item === '...') {
        return html`<span class="ellipsis" part="ellipsis" aria-hidden="true">…</span>`;
      }
      const label = t('goToPage', {page: item});
      return html`<tct-button
        class="page"
        part="page"
        variant="ghost"
        size=${this.#buttonSize}
        aria-label=${label}
        aria-current=${ifDefined(item === current ? 'page' : undefined)}
        ?disabled=${this.disabled}
        @click=${(event: Event): void => {
          this.#request(item, this.#reasonOf(event));
        }}
        >${item}</tct-button
      >`;
    })}`;
  }

  #renderCount(
    t: (key: string, args?: Record<string, unknown>) => string,
    current: number,
  ): TemplateResult {
    const totalItems = this.totalItems ?? 0;
    const pageSize = this.#pageSize;
    const from = (current - 1) * pageSize + 1;
    const to = Math.min(current * pageSize, totalItems);
    return html`<tct-text class="readout" part="readout" type="body" size="sm" color="secondary"
      >${t('count', {from, to, total: totalItems})}</tct-text
    >`;
  }

  #renderDots(
    t: (key: string, args?: Record<string, unknown>) => string,
    current: number,
    total: number,
  ): TemplateResult {
    const pages = Array.from({length: total}, (_, index) => index + 1);
    return html`<div class="dots" part="dots" role="group" aria-label=${t('pageIndicators')}>
      ${repeat(
        pages,
        (page) => page,
        (page) =>
          html`<button
            type="button"
            class="dot focus-ring"
            part="dot"
            data-page=${page}
            aria-label=${t('goToPage', {page})}
            aria-current=${ifDefined(page === current ? 'page' : undefined)}
            ?disabled=${this.disabled}
            @click=${(event: Event): void => {
              this.#request(page, this.#reasonOf(event));
            }}
          ></button>`,
      )}
    </div>`;
  }

  /** "Page [ n ] / N": an editable box that needs a known total to bound it, so it is disabled without one. */
  #renderInput(
    t: (key: string, args?: Record<string, unknown>) => string,
    current: number,
    total: number | undefined,
  ): TemplateResult {
    const boxWidth =
      this.#buttonSize === 'sm' ? 'var(--size-element-sm)' : 'var(--size-element-md)';
    return html`<span class="input-group" part="input-group">
      <span class="input-label" part="input-label" aria-hidden="true"
        >${this.pageLabel || t('pageLabel')}</span
      >
      <tct-number-input
        class="page-input"
        part="page-input"
        label=${t('goToPageInput')}
        label-hidden
        size=${this.#buttonSize}
        min="1"
        integer-only
        .max=${total}
        .value=${String(current)}
        .width=${boxWidth}
        ?disabled=${this.disabled || total === undefined}
        @input=${this.#stopInternal}
        @change=${this.#onInputChange}
        @tct-enter=${this.#stopInternal}
      ></tct-number-input>
      ${
        total !== undefined
          ? html`<span class="input-total" part="input-total">${t('ofTotalPages', {total})}</span>`
          : nothing
      }
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-pagination': TctPagination;
  }
}

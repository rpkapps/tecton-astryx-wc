import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {repeat} from 'lit/directives/repeat.js';
import {html as staticHtml, literal, type StaticValue} from 'lit/static-html.js';
import inputMessages from '@tecton-wc/locales/en/input.js';
import multiSelectorExtraMessages from '@tecton-wc/locales/en/multi-selector.js';
import multiSelectorMessages from '@tecton-wc/locales/en/multiSelector.js';
import selectorMessages from '@tecton-wc/locales/en/selector.js';
import textInputMessages from '@tecton-wc/locales/en/textInput.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {
  AdaptivePresentationController,
  type AdaptivePresentation,
} from '@tecton-wc/core/controllers/adaptive-presentation.js';
import {
  ComboboxController,
  measureSelectedItemOffset,
} from '@tecton-wc/core/controllers/combobox.js';
import {getModality} from '@tecton-wc/core/controllers/interaction-modality.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctClearEvent} from '@tecton-wc/core/events/tct-clear.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {IndicatorController, indicatorScope} from '@tecton-wc/core/indicators/registry.js';
import type {IndicatorPosition} from '@tecton-wc/core/indicators/registry.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import type {Alignment, Placement} from '@tecton-wc/core/layer/position.js';
import type {Validator} from '@tecton-wc/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {containsFlat, getTabbables} from '@tecton-wc/core/utils/focus.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import type {FieldStatusVariant} from '../field/field.types.js';
import {oneOf} from '../field/field-utils.js';
import {TctCheckIndicator} from '../indicator/tct-check-indicator.js';
import {TctCheckboxIndicator} from '../indicator/tct-checkbox-indicator.js';
import {TctRadioIndicator} from '../indicator/tct-radio-indicator.js';
import {TctDivider} from '../divider/tct-divider.js';
import layer from '../styles/layer.styles.css';
import scrollbar from '../styles/scrollbar.styles.css';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import {loadSelectorSheetElements} from './selector-sheet.js';
import {
  buildPanel,
  filterOptionsByQuery,
  getSelectableOptions,
  type OptionEntry,
  type PanelModel,
  type SelectorRecord,
} from './selector-options.js';
import {
  OPTIONS_STATES,
  SELECTOR_ALIGNMENTS,
  SELECTOR_INDICATOR_POSITIONS,
  SELECTOR_PLACEMENTS,
  SELECTOR_PRESENTATIONS,
  SELECTOR_VARIANTS,
  type OptionsState,
  type SelectorOptionData,
  type SelectorOptionType,
  type SelectorPlacement,
  type SelectorPresentation,
  type SelectorRenderer,
  type SelectorVariant,
} from './selector.types.js';
import {TctSelectorOption} from './tct-selector-option.js';
import {TctSelectorValue} from './tct-selector-value.js';
import styles from './tct-select-base.styles.css';

/** The browser's own localized "Please select an item in the list." from a probe. */
function missingSelectionMessage(): string {
  const probe = document.createElement('select');
  probe.required = true;
  probe.append(new Option('', ''));
  return probe.validationMessage || 'Please select an item in the list.';
}

/** The indicator tags a row's mark can be drawn with (static literals: see `#renderMark`). */
const INDICATOR_LITERALS: Readonly<Record<string, StaticValue>> = {
  'tct-check-indicator': literal`tct-check-indicator`,
  'tct-checkbox-indicator': literal`tct-checkbox-indicator`,
  'tct-radio-indicator': literal`tct-radio-indicator`,
};

const DEFAULT_INDICATOR = {
  check: 'tct-check-indicator',
  checkbox: 'tct-checkbox-indicator',
} as const;

/** Waits until every custom element in the rows (and in their shadow roots) rendered, so the rows have their real height. */
async function settleRows(root: Element): Promise<void> {
  const pending: Promise<unknown>[] = [];
  const visit = (node: ParentNode): void => {
    for (const element of node.querySelectorAll('*')) {
      const updating = (element as Partial<{updateComplete: Promise<unknown>}>).updateComplete;
      if (updating) pending.push(updating);
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  visit(root);
  await Promise.all(pending);
  // Elements rendered by that first update settle in the next round.
  const again: Promise<unknown>[] = [];
  const revisit = (node: ParentNode): void => {
    for (const element of node.querySelectorAll('*')) {
      const updating = (element as Partial<{updateComplete: Promise<unknown>}>).updateComplete;
      if (updating) again.push(updating);
      if (element.shadowRoot) revisit(element.shadowRoot);
    }
  };
  revisit(root);
  await Promise.all(again);
}

/** Space of the pressed key on the trigger: `keyup` would click a button, so the press is finished there too. */
const SPACE = ' ';

/**
 * The shared body of `tct-selector` and `tct-multi-selector`: the select-only combobox. A trigger
 * button that shows the value opens a listbox in an anchored popover, or in a bottom sheet on a compact
 * touch device (`presentation`); DOM focus stays on the trigger (or, with `has-search`, on the search
 * field inside the popup) while the arrow keys move a highlight, exposed as `aria-activedescendant`.
 * The value submits with the form (one entry, or one per chosen value), takes part in validation, and
 * resets and restores like a native `<select>`.
 *
 * The panel is one model (`buildPanel`) for the rows on screen, the keyboard order and the announced
 * result count. Async option sources are described by `options-state` (`loading`, `error`): the options
 * given stay selectable in every state, and an empty panel says which it is, announced once.
 *
 * @internal
 * @summary Base of the selectors: field chrome, trigger, popup, search and async states.
 */
export abstract class TctSelectBase extends TctBoxControl {
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctBoxControl.dependencies,
    TctInputClearButton,
    TctDivider,
    TctSelectorOption,
    TctSelectorValue,
    TctCheckIndicator,
    TctCheckboxIndicator,
    TctRadioIndicator,
  ];
  static override styles: CSSResultGroup = [
    TctBoxControl.styles,
    indicatorScope,
    layer,
    scrollbar,
    styles,
  ];

  /** The options: strings, `{value, label?, description?, icon?, disabled?}`, `{type: 'divider'}` and `{type: 'section', title?, options}`. */
  @property({attribute: false}) options: SelectorOptionType[] = [];

  /** `input` is the bordered form field (default); `ghost` is the borderless toolbar trigger. */
  @property({reflect: true}) variant: SelectorVariant = 'input';

  /** Name of an icon shown at the start of the trigger. It wins over the chosen option's own icon. */
  @property({attribute: 'start-icon'}) startIcon = '';

  /** Shows a clear (x) button while there is a value. It fires `tct-clear` and returns focus to the trigger. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /** Shows a search field at the top of the list that filters the options; the count of matches is announced. */
  @property({type: Boolean, attribute: 'has-search'}) hasSearch = false;

  /** Placeholder of the search field. Default: the localized "Search…". */
  @property({attribute: 'search-placeholder'}) searchPlaceholder = '';

  /** Text of the panel when there are no options. Default: the localized "No options". Announced once. */
  @property({attribute: 'empty-text'}) emptyText = '';

  /** Text of the panel when a search matches nothing. Default: the localized "No results found". Announced with each search. */
  @property({attribute: 'empty-search-text'}) emptySearchText = '';

  /** Text of the panel while `options-state` is `loading` and there are no options. Default: the localized "Loading options". */
  @property({attribute: 'loading-text'}) loadingText = '';

  /** Text of the panel when `options-state` is `error` and there are no options. Default: the localized "Options could not be loaded". */
  @property({attribute: 'error-text'}) errorText = '';

  /**
   * The state of the option source: `ready` (default), `loading` or `error`. It is independent of
   * `loading` (the value being resolved or saved). Options that are given stay selectable in every
   * state; with none, the panel says loading or the error, announced once.
   */
  @property({attribute: 'options-state'}) optionsState: OptionsState = 'ready';

  /**
   * How the list appears: an anchored `popover` (default), a modal `bottom-sheet`, or `adaptive` (a sheet on
   * a compact touch device, a popover elsewhere).
   */
  @property({reflect: true}) presentation: SelectorPresentation = 'popover';

  /**
   * Which side of the trigger the popover opens on. Logical: `start` and `end` follow the direction.
   * Default `below`. `overlay` (single selector without search) draws the popover over the trigger so the
   * chosen option lines up with it, clamped to the viewport.
   */
  @property() placement: SelectorPlacement | undefined;

  /** Alignment of the popover along the placement axis. */
  @property() alignment: Alignment = 'start';

  /** Which edge of an option row carries the selection mark. The selector marks at the end, the multi-selector at the start. */
  @property({attribute: 'indicator-position'}) indicatorPosition: IndicatorPosition | undefined;

  /**
   * Renders the content of one option in the list: `(option) => html`…``. Return a template, a node or text
   * (text is never HTML). Compose it with `tct-selector-option`. The row keeps its role and state.
   */
  @property({attribute: false}) renderOption: SelectorRenderer | undefined;

  /** Whether the popup is open. Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;

  /** Opens the popup without an intent event; resolves once it settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the popup without an intent event; resolves once it is hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens or closes the popup (`force` picks the state) without an intent event. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: fires the cancelable `tct-open-change` and honours a cancel. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (this.open) this.#request(false, reason);
  }

  // ---------------------------------------------------------------------------- hooks

  /** Several values may be chosen (the popup stays open, options toggle). Constant per class. */
  protected get multiple(): boolean {
    return false;
  }
  /** Whether `value` is currently chosen. */
  protected abstract isChosen(value: string): boolean;
  /** Whether there is a value to clear. */
  protected abstract get hasSelection(): boolean;
  /** The trigger's content for the current value (or nothing: the base draws the placeholder). */
  protected abstract renderValueContent(): TemplateResult | typeof nothing;
  /** The user chose an enabled row (a click, Enter or Space). */
  protected abstract commitRecord(record: SelectorRecord): void;
  /** The user asked to clear (the clear button or Delete/Backspace on the trigger). */
  protected abstract clearSelection(): void;
  /** The message namespace: `selector` or `multiSelector`. */
  protected abstract get messageNamespace(): string;

  /** The edge a selection mark defaults to. */
  protected get defaultIndicatorPosition(): IndicatorPosition {
    return 'end';
  }
  /** Values listed first while the popup is open (multi-selector), or `undefined`. */
  protected get chosenFirst(): ReadonlySet<string> | undefined {
    return undefined;
  }
  /** The "Select all" row, or `undefined`. */
  protected get selectAllRow(): {label: string} | undefined {
    return undefined;
  }
  /** The indicator name a row's mark is resolved from (`check` for single, `checkbox` for multi). */
  protected get indicatorName(): 'check' | 'checkbox' {
    return 'check';
  }
  /** The state a row's mark draws. */
  protected markState(record: SelectorRecord): 'checked' | 'unchecked' | 'indeterminate' {
    return this.isChosen(record.value) ? 'checked' : 'unchecked';
  }
  /** Overrides the accessible name of a row (the partially selected "Select all"). */
  protected optionName(_record: SelectorRecord): string | undefined {
    return undefined;
  }
  /** Whether the row is drawn as chosen (`aria-selected`). */
  protected rowSelected(record: SelectorRecord): boolean {
    return this.isChosen(record.value);
  }
  /** The chosen option's icon and label, for the default trigger value of a single selector. */
  protected get selectedRecord(): SelectorRecord | undefined {
    return undefined;
  }

  // ------------------------------------------------------------------------ internals

  readonly #i18n: LocaleController = new LocaleController(this, {
    namespace: 'selector',
    defaults: {
      ...selectorMessages,
      ...multiSelectorMessages,
      ...multiSelectorExtraMessages,
      ...inputMessages,
      ...textInputMessages,
    },
  });
  readonly #presentation: AdaptivePresentationController = new AdaptivePresentationController(
    this,
    () => this.#policy,
  );
  readonly #indicator: IndicatorController = new IndicatorController(this, this.indicatorName);
  #query = '';
  #settled: Promise<void> = Promise.resolve();
  #exiting = false;
  #overlayOffset = 0;
  #overlayMeasured = false;
  #announcedState: string | null = null;
  #spaceDown = false;
  #sheetFocus: 'keyboard' | 'pointer' = 'pointer';
  #panelCache: {key: string; model: PanelModel} | undefined;
  #optionsRef: unknown;
  #optionsVersion = 0;
  /** Set for a popup that mounts open: not an open anyone asked for, so it must not take focus. */
  #mountedOpen = false;

  readonly #combo: ComboboxController<SelectorRecord> = new ComboboxController<SelectorRecord>(
    this,
    {
      focusElement: () => this.#focusElement(),
      optionElements: () => this.#optionElements(),
      records: () => this.#panel.records,
      selectedIndex: () => this.#panel.records.findIndex((record) => this.isChosen(record.value)),
      multiple: this.multiple,
      blocked: () => this.#blocked,
      isOpen: () => this.open,
      hasSearch: () => this.hasSearch,
      open: (reason) => this.#request(true, reason),
      close: (reason) => {
        this.#request(false, reason);
      },
      onSelect: (record) => {
        this.commitRecord(record);
      },
      onClear: () => {
        this.#clear();
      },
      hasValue: () => this.hasClear && this.hasSelection,
      onSearchSeed: (character) => {
        this.#appendQuery(character);
      },
      onTypeaheadSelect: (record) => {
        this.commitRecord(record);
        announce(record.label, {element: this});
      },
      locale: () => this.#i18n.locale,
    },
  );

  readonly #position: PositionController = new PositionController(this, {
    surface: () => this.#layerElement,
    anchor: () => this.#box,
    placement: () => ({
      placement: this.#placementValue,
      alignment: oneOf(this.alignment, SELECTOR_ALIGNMENTS, 'start'),
      offset: this.#overlayOffset > 0 ? -this.#overlayOffset : 'var(--spacing-1)',
    }),
    // At least as wide as the trigger.
    matchAnchorWidth: 'min',
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    trigger: () => this.formControl,
    haspopup: 'listbox',
    // The whole box (trigger, clear button, chevron) counts as inside: a press on it is not an outside press.
    inside: () => [this.#box],
    // DOM focus stays on the trigger, except with a search field, which takes it.
    initialFocus: () => (this.#mountedOpen || !this.hasSearch ? null : this.#searchInput),
    exitAnimation: () => this.#exitAnimation(),
    position: this.#position,
    onDismissRequest: (reason) => {
      this.#request(false, reason);
    },
    // `hidePopover()` or a browser close request ended it without us.
    onNativeClose: () => {
      this.open = false;
    },
    onShown: () => {
      void this.#measureOverlay();
    },
    onHidden: () => {
      this.#combo.reset();
    },
  });

  get #policy(): AdaptivePresentation {
    return SELECTOR_PRESENTATIONS.includes(this.presentation) ? this.presentation : 'popover';
  }

  /** Whether the touch sheet is showing (resolved by the presentation policy), and there is something to open. */
  get #usesSheet(): boolean {
    return this.#presentation.resolved === 'bottom-sheet';
  }

  get #blocked(): boolean {
    return this.isDisabled || this.readonly;
  }

  get #readOnlyShown(): boolean {
    return this.readonly && !this.isDisabled;
  }

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  get #box(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.input-wrapper');
  }

  get #searchInput(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('.search-input');
  }

  get #listbox(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.listbox');
  }

  get #placementValue(): Placement {
    return this.placement &&
      this.placement !== 'overlay' &&
      SELECTOR_PLACEMENTS.includes(this.placement)
      ? this.placement
      : 'below';
  }

  /** The popover overlays the trigger with the chosen option (upstream default, opt-in here). */
  get #overlay(): boolean {
    return this.placement === 'overlay' && !this.hasSearch && !this.multiple;
  }

  protected override get formControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('button.trigger');
  }

  /** Enter does not submit: it opens the list and chooses. */
  protected override get submitsOnEnter(): boolean {
    return false;
  }

  protected override get effectiveStatusVariant(): FieldStatusVariant {
    const variant = super.effectiveStatusVariant;
    return this.variant === 'ghost' && variant === 'attached' ? 'detached' : variant;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) =>
        field.required && !field.optional && !field.hasSelection
          ? {flags: {valueMissing: true}, message: missingSelectionMessage()}
          : null,
    ];
  }

  protected override get helperIds(): string[] {
    return [...super.helperIds, this.ids.id('read-only')];
  }

  /** The trigger takes focus (not the label's info button, which can come first in the tab order). */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** The localized message `key` of this selector's namespace. */
  protected message(key: string, args?: Record<string, unknown>): string {
    return this.#i18n.t(`@tct.${this.messageNamespace}.${key}`, args);
  }

  /** Any localized message by full id (`@tct.textInput.clearLabel`). */
  protected messageById(id: string, args?: Record<string, unknown>): string {
    return this.#i18n.t(id, args);
  }

  /** The locale the options are compared in. */
  protected get locale(): string {
    return this.#i18n.locale;
  }

  /** The option rows the panel shows now (filtered by the query), in keyboard order, without the select-all row. */
  protected get visibleRecords(): readonly SelectorRecord[] {
    return this.#panel.records.filter((record) => record.selectAll !== true);
  }

  /** Every option that can be chosen, in order (sections flattened). */
  protected get selectableOptions(): SelectorOptionData[] {
    return getSelectableOptions(this.options);
  }

  /** What the panel shows now (the query applies while the popup is open or animating out). */
  get #panel(): PanelModel {
    const live = this.open || this.#exiting;
    const query = live ? this.#query : '';
    const chosen = live ? this.chosenFirst : undefined;
    const selectAll = this.selectAllRow;
    if (this.options !== this.#optionsRef) {
      this.#optionsRef = this.options;
      this.#optionsVersion++;
    }
    const key = `${this.#optionsVersion}|${query}|${this.locale}|${chosen ? [...chosen].join('\u0001') : ''}|${selectAll?.label ?? ''}`;
    if (this.#panelCache?.key !== key) {
      this.#panelCache = {
        key,
        model: buildPanel(this.options, {
          query,
          locale: this.locale,
          selectedFirst: chosen,
          selectAll,
        }),
      };
    }
    return this.#panelCache.model;
  }

  // ------------------------------------------------------------------------ open state

  #request(open: boolean, reason: ChangeReason): boolean {
    if (open && this.#blocked) return false;
    if (open === this.open) return true;
    if (!this.dispatch(new TctOpenChangeEvent(open, reason))) return false;
    this.open = open;
    if (open) this.#sheetFocus = getModality() === 'pointer' ? 'pointer' : 'keyboard';
    return true;
  }

  #exitAnimation(): Animation[] {
    const layerElement = this.#layerElement;
    if (!layerElement || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [layerElement.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: 'ease-in'})];
  }

  /**
   * Overlay mode: pulls the popup up over the trigger so the chosen row sits on it. The rows are laid
   * out only after their content elements rendered, so the measurement waits for them (the list stays
   * invisible until then), then moves the popup once.
   */
  async #measureOverlay(): Promise<void> {
    if (!this.#overlay || this.#usesSheet) return;
    const listbox = this.#listbox;
    if (!listbox) return;
    await settleRows(listbox);
    if (!this.open || listbox !== this.#listbox) return;
    const option =
      listbox.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
      listbox.querySelector<HTMLElement>('[role="option"]');
    const offset = measureSelectedItemOffset(listbox, option, this.#box);
    this.#overlayMeasured = true;
    if (Math.abs(offset - this.#overlayOffset) >= 0.5) {
      this.#overlayOffset = offset;
      this.#position.update();
    }
    this.requestUpdate();
  }

  // ------------------------------------------------------------------ value operations

  #clear(): void {
    if (this.#blocked) return;
    if (!this.dispatch(new TctClearEvent())) return;
    this.#combo.resetTypeahead();
    this.clearSelection();
    this.formControl?.focus({preventScroll: true});
  }

  /**
   * The user changed the value: `input`, then `change` (a discrete commit, like a native `<select>`).
   * Called by the subclasses after they wrote the new value.
   */
  protected notifyChange(): void {
    this.syncFormState();
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
  }

  // ------------------------------------------------------------------------- search

  #appendQuery(character: string): void {
    this.#setQuery(this.#query + character);
  }

  #setQuery(next: string): void {
    this.#query = next;
    this.#combo.highlight(-1);
    this.#announceResults(next);
    this.requestUpdate();
  }

  /** Once per query change: the count of matches, or that nothing matched; never for an emptied query. */
  #announceResults(query: string): void {
    if (query.length === 0) return;
    const count = filterOptionsByQuery(this.selectableOptions, query, this.locale).length;
    announce(count === 0 ? this.#emptySearchAnnouncement : this.message('resultCount', {count}), {
      element: this,
    });
  }

  get #emptyAnnouncement(): string {
    return this.emptyText || this.message('empty');
  }

  get #emptySearchAnnouncement(): string {
    return this.emptySearchText || this.message('emptySearchResults');
  }

  /**
   * What an empty panel says, as a state key: `loading`, `error` or `empty` (`null`: nothing to say). The
   * panel is the only place the message is drawn and, being `role="presentation"`, the announcer is the
   * only route to assistive technology, so the key is announced once per arrival at the state.
   */
  #panelStateKey(): 'loading' | 'error' | 'empty' | null {
    if (!this.open || this.#query !== '') return null;
    if (this.#panel.records.length > 0) return null;
    if (this.optionsState === 'loading') return 'loading';
    if (this.optionsState === 'error') return 'error';
    return 'empty';
  }

  #panelMessage(state: 'loading' | 'error' | 'empty' | 'no-results'): string {
    switch (state) {
      case 'loading':
        return this.loadingText || this.messageById('@tct.selector.loading');
      case 'error':
        return this.errorText || this.messageById('@tct.selector.error');
      case 'no-results':
        return this.#emptySearchAnnouncement;
      default:
        return this.#emptyAnnouncement;
    }
  }

  #syncPanelAnnouncement(): void {
    const key = this.#panelStateKey();
    if (key === null) {
      this.#announcedState = null;
      return;
    }
    // A custom text is part of the key: a new message for the same state is a new thing to say.
    const spoken = `${key}:${this.#panelMessage(key)}`;
    if (this.#announcedState === spoken) return;
    this.#announcedState = spoken;
    announce(this.#panelMessage(key), {element: this});
  }

  // ------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('variant') && !SELECTOR_VARIANTS.includes(this.variant)) {
      devWarn(
        `${this.localName}:variant:${this.variant}`,
        `variant "${this.variant}" is not one of ${SELECTOR_VARIANTS.join(', ')}.`,
      );
    }
    if (changed.has('presentation') && !SELECTOR_PRESENTATIONS.includes(this.presentation)) {
      devWarn(
        `${this.localName}:presentation:${this.presentation}`,
        `presentation "${this.presentation}" is not one of ${SELECTOR_PRESENTATIONS.join(', ')}.`,
      );
    }
    if (changed.has('optionsState') && !OPTIONS_STATES.includes(this.optionsState)) {
      devWarn(
        `${this.localName}:options-state:${this.optionsState}`,
        `options-state "${this.optionsState}" is not one of ${OPTIONS_STATES.join(', ')}.`,
      );
    }
    if (
      changed.has('indicatorPosition') &&
      this.indicatorPosition &&
      !SELECTOR_INDICATOR_POSITIONS.includes(this.indicatorPosition)
    ) {
      devWarn(
        `${this.localName}:indicator-position:${this.indicatorPosition}`,
        `indicator-position "${this.indicatorPosition}" is not start or end.`,
      );
    }
    // The touch presentation's elements load the first time it is needed.
    if (this.#usesSheet) void loadSelectorSheetElements();
    // Caller policy: an open popup closes when the control stops being editable.
    if (this.open && this.#blocked) this.open = false;
    // The query outlives the close only for the exit animation, which keeps drawing the same rows.
    if (!this.open && !this.#exiting && this.#query !== '') this.#query = '';
  }

  protected override firstUpdated(): void {
    // Markup that mounts open is not an open anyone asked for: keep focus where it is.
    this.#mountedOpen = this.open;
    if (!this.hasAttribute('autofocus')) return;
    void this.updateComplete.then(() => {
      this.focus({preventScroll: true});
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('open', this.open);
    this.#syncLayer(changed.get('open'), changed.has('open'));
    this.#syncPanelAnnouncement();
    if (this.open && (changed.has('placement') || changed.has('alignment'))) {
      this.#position.update();
    }
    // A highlight left over from before the options changed points at nothing.
    if (this.open && this.#combo.highlightedIndex >= this.#panel.records.length) {
      this.#combo.highlight(-1);
    }
  }

  /** Brings the popover layer in line with `open` and the resolved presentation. */
  #syncLayer(previousOpen: boolean | undefined, openChanged: boolean): void {
    const wantLayer = this.open && !this.#usesSheet;
    if (wantLayer === this.#layer.isOpen) {
      // The sheet settles on its own; its `tct-after-open-change` finishes the exit and reports.
      if (openChanged && previousOpen !== undefined && this.#usesSheet) {
        this.#exiting = !this.open;
        this.#settled = Promise.resolve();
      }
      return;
    }
    // The first update of a closed selector is not a change.
    if (previousOpen === undefined && !this.open) return;
    if (wantLayer) {
      this.#exiting = false;
      this.#overlayOffset = 0;
      this.#overlayMeasured = false;
    } else {
      this.#exiting = true;
    }
    const settled = wantLayer ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      this.#mountedOpen = false;
      if (!wantLayer) {
        this.#exiting = false;
        this.requestUpdate();
      }
      if (this.open === this.#layer.isOpen || this.#usesSheet) {
        this.dispatch(new TctAfterOpenChangeEvent(this.open));
      }
    });
    if (wantLayer && this.hasSearch && !this.#mountedOpen) {
      void settled.then(() => {
        this.#combo.resync();
      });
    }
  }

  // ------------------------------------------------------------------------- rendering

  protected override render(): TemplateResult {
    return html`${this.renderFieldLayout(this.renderBoxWrapper(this.#renderContent()))}${this.#renderPopup()}`;
  }

  #renderContent(): TemplateResult {
    const status = this.effectiveStatus;
    const showClear = this.hasClear && this.hasSelection && !this.isDisabled && !this.readonly;
    const rendered = status ? this.renderStatusIcon() : nothing;
    const statusIcon =
      rendered !== nothing && this.effectiveStatusVariant === 'tooltip'
        ? html`<span class="status-adornment" @click=${this.#stopClick}>${rendered}</span>`
        : rendered;
    return html`
      ${
        this.startIcon
          ? html`<tct-icon
              class="start-icon"
              part="start-icon"
              name=${this.startIcon}
              size="sm"
              color="secondary"
            ></tct-icon>`
          : nothing
      }
      ${this.#renderTrigger()} ${this.renderBusy()}
      ${
        showClear
          ? html`<tct-input-clear-button
              label=${this.#clearLabel()}
              @click=${this.#onClearClick}
            ></tct-input-clear-button>`
          : nothing
      }
      ${
        statusIcon !== nothing
          ? statusIcon
          : this.#readOnlyShown
            ? nothing
            : html`<tct-icon
                class="chevron"
                part="indicator"
                name="chevronDown"
                size="sm"
                color="secondary"
                ?data-open=${this.open}
              ></tct-icon>`
      }
    `;
  }

  #clearLabel(): string {
    return this.messageById(
      this.multiple ? '@tct.multiSelector.clearAll' : '@tct.selector.clearLabel',
      {label: this.label},
    );
  }

  #renderTrigger(): TemplateResult {
    const inert = this.showsDisabledMessage;
    const readOnly = this.#readOnlyShown;
    const search = this.hasSearch && !readOnly;
    const popup = this.#usesSheet ? 'dialog' : 'listbox';
    const content = this.renderValueContent();
    return html`<button
      class="trigger"
      part="trigger"
      type="button"
      role=${ifDefined(search ? undefined : 'combobox')}
      aria-haspopup=${ifDefined(readOnly ? undefined : popup)}
      aria-expanded=${readOnly ? 'false' : String(this.open)}
      aria-controls=${ifDefined(
        !readOnly && this.open && !this.#usesSheet ? this.ids.id('listbox') : undefined,
      )}
      aria-readonly=${ifDefined(readOnly ? 'true' : undefined)}
      aria-required=${ifDefined(
        (this.required && !this.optional) || (!this.required && this.announcesRequired)
          ? 'true'
          : undefined,
      )}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-labelledby=${ifDefined(this.groupLabelId)}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      ?disabled=${this.isDisabled && !inert}
      @click=${this.#onTriggerClick}
      @keydown=${this.#onTriggerKeyDown}
      @keyup=${this.#onTriggerKeyUp}
      @pointerdown=${this.#onTriggerPointerDown}
    >
      ${
        content === nothing
          ? html`<span class="placeholder" part="placeholder">${this.#placeholder}</span>`
          : content
      }
    </button>`;
  }

  get #placeholder(): string {
    return this.placeholder || this.message(this.multiple ? 'selectPlaceholder' : 'placeholder');
  }

  #renderPopup(): TemplateResult {
    if (this.#usesSheet) return this.#renderSheet();
    const mounted = this.open || this.#exiting;
    return html`<div
      class="layer layer-surface"
      popover="manual"
      data-placement=${this.#placementValue}
    >
      <div
        class="surface"
        part="popup"
        data-size=${this.fieldSize}
        data-presentation="popover"
        data-variant=${this.variant}
      >
        ${mounted ? this.#renderPanel('popover') : nothing}
      </div>
    </div>`;
  }

  #renderSheet(): TemplateResult {
    return html`<div class="layer layer-surface" popover="manual"></div>
      <tct-bottom-sheet
        class="sheet"
        part="sheet"
        height="hug"
        purpose="info"
        label=${this.label}
        .open=${this.open && !this.#readOnlyShown}
        .finalFocusElement=${this.formControl}
        @tct-open-change=${this.#onSheetOpenChange}
        @tct-after-open-change=${this.#onSheetAfterOpenChange}
      >
        <div class="sheet-content" part="sheet-content" data-size=${this.fieldSize}>
          <tct-heading class="sheet-heading" level="3">${this.label}</tct-heading>
          ${this.open || this.#exiting ? this.#renderPanel('bottom-sheet') : nothing}
        </div>
      </tct-bottom-sheet>`;
  }

  /** The search row, the listbox and the message: the same content in the popover and in the sheet. */
  #renderPanel(presentation: 'popover' | 'bottom-sheet'): TemplateResult {
    const model = this.#panel;
    const searching = this.#query !== '';
    const state = this.#panelStateKey();
    const noResults = searching && model.records.length === 0;
    const sheet = presentation === 'bottom-sheet';
    return html`
      ${this.hasSearch ? this.#renderSearch() : nothing}
      <div
        class="listbox scrollbar"
        part="listbox"
        id=${this.ids.id('listbox')}
        role="listbox"
        aria-label=${this.label}
        aria-multiselectable=${ifDefined(this.multiple ? 'true' : undefined)}
        tabindex=${ifDefined(sheet && !this.hasSearch ? '0' : undefined)}
        ?hidden=${model.records.length === 0}
        data-overlay=${ifDefined(this.#overlay && !this.#overlayMeasured && this.open ? '' : undefined)}
        @keydown=${this.#onListboxKeyDown}
        @pointerdown=${this.#onListPointerDown}
      >
        ${this.#renderEntries(model)}
      </div>
      ${
        state !== null || noResults
          ? html`<div class="message" part="empty-state" role="presentation">
              ${this.#panelMessage(noResults ? 'no-results' : (state ?? 'empty'))}
            </div>`
          : nothing
      }
    `;
  }

  #renderSearch(): TemplateResult {
    const label = this.message('searchOptions');
    return html`<div class="search focus-within-ring" part="search">
        <tct-icon
          class="search-icon"
          name="search"
          size="sm"
          color="secondary"
          aria-hidden="true"
        ></tct-icon>
        <input
          class="search-input"
          type="text"
          role="combobox"
          aria-label=${label}
          aria-expanded=${String(this.open)}
          aria-controls=${this.ids.id('listbox')}
          aria-autocomplete="list"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder=${this.searchPlaceholder || this.message('searchPlaceholder')}
          .value=${live(this.#query)}
          @input=${this.#onSearchInput}
          @keydown=${this.#onSearchKeyDown}
        />
        ${
          this.#query
            ? html`<tct-input-clear-button
                label=${this.messageById('@tct.textInput.clearLabel', {label})}
                @click=${this.#onSearchClear}
                @keydown=${this.#onSearchClearKeyDown}
              ></tct-input-clear-button>`
            : nothing
        }
      </div>
      <tct-divider class="search-divider"></tct-divider>`;
  }

  #renderEntries(model: PanelModel): TemplateResult {
    return html`${repeat(
      model.entries,
      (entry) => (entry.kind === 'option' ? `option-${entry.record.value}` : entry.key),
      (entry) => {
        if (entry.kind === 'divider') {
          // A separator is not a permitted child of a listbox and carries nothing the options do not.
          return html`<tct-divider class="option-divider" aria-hidden="true"></tct-divider>`;
        }
        if (entry.kind === 'section') {
          return html`<div class="group" role="group" aria-label=${ifDefined(entry.title)}>
            ${
              entry.title
                ? html`<div class="group-heading" part="section-heading" aria-hidden="true">
                    ${entry.title}
                  </div>`
                : nothing
            }
            ${repeat(
              entry.entries,
              (inner) => inner.record.value,
              (inner) => this.#renderOptionRow(inner),
            )}
          </div>`;
        }
        return this.#renderOptionRow(entry);
      },
    )}`;
  }

  #renderOptionRow(entry: OptionEntry): TemplateResult {
    const {record, index} = entry;
    const selected = this.rowSelected(record);
    const position = this.indicatorPosition ?? this.defaultIndicatorPosition;
    const mark = this.#renderMark(record);
    const data = record.data;
    const content = record.selectAll
      ? html`<span class="option-label">${record.label}</span>`
      : this.renderOption
        ? this.renderOption(data)
        : html`<tct-selector-option
            label=${data.label ?? data.value}
            description=${ifDefined(data.description)}
            icon=${ifDefined(data.icon)}
          ></tct-selector-option>`;
    return html`<div
      class="option"
      part="option"
      id=${this.#optionId(index)}
      role="option"
      aria-selected=${String(selected)}
      aria-disabled=${ifDefined(record.disabled ? 'true' : undefined)}
      aria-label=${ifDefined(this.optionName(record))}
      data-size=${this.fieldSize}
      data-position=${position}
      ?data-selected=${selected}
      ?data-disabled=${record.disabled}
      ?data-select-all=${record.selectAll === true}
      @click=${() => {
        this.#combo.choose(index);
      }}
      @pointerenter=${() => {
        this.#combo.handlePointerEnter(index);
      }}
    >
      ${position === 'start' ? mark : nothing}
      <span class="option-content">${content}</span>
      ${position === 'end' ? mark : nothing}
    </div>`;
  }

  /**
   * The row's selection mark, resolved through the indicator registry (a theme may map `check` or
   * `checkbox` to another shipped indicator). Only the shipped indicator tags can be drawn: a tag has to
   * be a static literal (the lint rule `no-html-sinks` bans `unsafeStatic`), so any other tag falls back
   * to the default for the name.
   */
  #renderMark(record: SelectorRecord): TemplateResult {
    const tag = this.#indicator.tag ?? '';
    const name =
      INDICATOR_LITERALS[tag] ?? INDICATOR_LITERALS[DEFAULT_INDICATOR[this.indicatorName]]!;
    const state = this.markState(record);
    return html`<span class="mark-column" part="check"
      >${staticHtml`<${name}
        class="mark"
        state=${state}
        size="sm"
        ?disabled=${record.disabled}
      ></${name}>`}</span
    >`;
  }

  #optionId(index: number): string {
    return `${this.ids.id('listbox')}-item-${index}`;
  }

  #optionElements(): HTMLElement[] {
    return [...(this.#listbox?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  /** The element that keeps DOM focus and holds `aria-activedescendant`. */
  #focusElement(): HTMLElement | null {
    if (this.#usesSheet) {
      return this.hasSearch ? this.#searchInput : this.#listbox;
    }
    return this.hasSearch && this.open ? this.#searchInput : this.formControl;
  }

  // ------------------------------------------------------------------------------ events

  readonly #onTriggerClick = (): void => {
    if (this.#blocked) return;
    // The press that just dismissed the popup must not reopen it.
    if (!this.#usesSheet && this.#layer.wasJustDismissed()) return;
    this.#combo.handleTriggerClick();
  };

  readonly #onTriggerPointerDown = (): void => {
    this.#sheetFocus = 'pointer';
  };

  readonly #onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === SPACE) this.#sheetFocus = 'keyboard';
    const consumed = this.#combo.handleKeyDown(event, 'trigger');
    // A consumed Space is finished at keydown: some engines click a button on keyup.
    if (consumed && event.key === SPACE) this.#spaceDown = true;
  };

  readonly #onTriggerKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== SPACE || !this.#spaceDown) return;
    this.#spaceDown = false;
    event.preventDefault();
  };

  /** In the sheet the listbox itself keeps focus (there is no trigger to type on): it takes the keys. */
  readonly #onListboxKeyDown = (event: KeyboardEvent): void => {
    if (this.#usesSheet && !this.hasSearch) this.#combo.handleKeyDown(event, 'trigger');
  };

  /** Pressing an option must not take focus off the trigger (or the search field). */
  readonly #onListPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('[role="option"]')) event.preventDefault();
  };

  /** The click must not reach the box, whose handler would toggle the popup. */
  readonly #onClearClick = (event: Event): void => {
    event.stopPropagation();
    this.#clear();
  };

  /** A status button (the `tooltip` variant) reveals its message; it is not a press on the trigger. */
  readonly #stopClick = (event: Event): void => {
    event.stopPropagation();
  };

  // -- search

  readonly #onSearchInput = (event: Event): void => {
    // The native input event does not leave the popup: the query is not the value.
    event.stopPropagation();
    this.#setQuery((event.target as HTMLInputElement).value);
  };

  readonly #onSearchKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event)) return;
    if (event.key === 'Tab' && !event.shiftKey) {
      // With a query the clear button is the next tab stop; the popup stays open for it.
      if (this.#query !== '') return;
      this.#tabOut(event);
      return;
    }
    this.#combo.handleKeyDown(event, 'search');
  };

  /**
   * Forward Tab from inside the popup leaves the selector: closes it and focuses the tab stop after the
   * selector. The browser would continue from the popover's invoker (the box), which lands back on the
   * trigger, so the move is made here.
   */
  #tabOut(event: KeyboardEvent): void {
    event.preventDefault();
    this.#request(false, 'focus-out');
    const all = getTabbables(document.documentElement);
    const own = all.filter((element) => containsFlat(this, element));
    const last = own.at(-1);
    const next = last ? all[all.indexOf(last) + 1] : undefined;
    if (next) next.focus();
    else this.formControl?.focus({preventScroll: true});
  }

  readonly #onSearchClear = (): void => {
    this.#setQuery('');
    this.#searchInput?.focus({preventScroll: true});
  };

  /** Forward Tab from the clear button leaves the popup: nothing else in it takes a tab stop. */
  readonly #onSearchClearKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab' && !event.shiftKey) this.#tabOut(event);
  };

  // -- sheet

  readonly #onSheetOpenChange = (event: TctOpenChangeEvent): void => {
    // The sheet asks to close (Escape, scrim, swipe): ask ours, and let the answer drive the sheet.
    event.stopPropagation();
    event.preventDefault();
    if (!event.open) this.#request(false, event.reason);
  };

  readonly #onSheetAfterOpenChange = (event: Event): void => {
    event.stopPropagation();
    this.dispatch(new TctAfterOpenChangeEvent(this.open));
    if (!this.open) {
      this.#exiting = false;
      this.#combo.reset();
      this.requestUpdate();
      return;
    }
    const target = this.hasSearch ? this.#searchInput : this.#listbox;
    target?.focus({preventScroll: true});
    this.#combo.resync();
    if (this.#sheetFocus === 'keyboard' && !this.hasSearch && this.#combo.highlightedIndex < 0) {
      this.#combo.highlight(
        Math.max(
          0,
          this.#panel.records.findIndex((record) => this.isChosen(record.value)),
        ),
        'keyboard',
      );
    }
  };

  // ---------------------------------------------------------------------------- shared bits

  /** Visually hidden helper text (read-only state) that `aria-describedby` points at. */
  protected override renderHelpers(): TemplateResult {
    return html`${super.renderHelpers()}${
      this.#readOnlyShown
        ? html`<span class="visually-hidden" id=${this.ids.id('read-only')}
            >${this.messageById('@tct.input.readOnly')}</span
          >`
        : nothing
    }`;
  }
}

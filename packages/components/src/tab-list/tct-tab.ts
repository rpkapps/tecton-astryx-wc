import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {html as staticHtml, literal} from 'lit/static-html.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {features} from '@tecton-wc/core/features.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import base from '../styles/base.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import {tabListContext} from './tab-list.context.js';
import styles from './tct-tab.styles.css';

/** The passive attribute a tab puts on its host so a padded container can pull an edge tab to its edge. */
const EDGE_COMP_ATTR = 'data-tct-edge-comp';

/**
 * One tab of a `tct-tab-list`. It renders a native `<button>` (or an `<a href>` when it has a
 * destination) in its shadow root: under the navigation pattern the current tab carries
 * `aria-current="true"`; under the tabs pattern (`tct-tab-list pattern="tabs"`) it is `role="tab"`
 * with `aria-selected`, `aria-controls` pointing at the panel named by `panel-id`, and it never
 * navigates (an `href` is ignored there, with a development warning).
 *
 * The tab list owns the roving tabindex: it writes `tabindex` on the inner control ({@link control}),
 * so the strip is one Tab stop and the selected tab is the stop.
 *
 * @summary A single tab: a button or a link with a label, optional icons and trailing content.
 * @tag tct-tab
 * @upstream Tab
 * @slot icon - Icon shown when the tab is not selected (and when it is, unless `selected-icon` is set).
 * @slot selected-icon - Icon shown instead of `icon` while the tab is selected.
 * @slot end - Content after the label (a badge or a status dot).
 * @csspart tab - The native `<button>` or `<a>` (upstream theming target `tab`).
 * @csspart indicator - The bar that marks the selected tab (upstream theming target `tab-indicator`).
 * @csspart label - The visible label text.
 * @cssstate selected - This tab is the tab list's value.
 * @cssstate disabled - The tab cannot be selected.
 * @fires click - Native click, retargeted from the inner control; not fired while `disabled`.
 * @cloakDisplay inline-flex
 */
export class TctTab extends TctElement {
  static override readonly tagName = 'tct-tab';
  static override styles: CSSResultGroup = [base, slottedIcon, styles];

  /** Unique value of this tab; compared with the tab list's `value`. Required. */
  @property() value = '';

  /** Text of the tab; its accessible name when `label-hidden`. Required. */
  @property() label = '';

  /** Shows only the icon and end content; `label` stays the accessible name. */
  @property({type: Boolean, attribute: 'label-hidden', reflect: true}) labelHidden = false;

  /**
   * Destination. With it the tab renders an `<a>`, so a middle click or "open in new tab" works.
   * Ignored under the tabs pattern: a tab there swaps a panel in place and does not navigate.
   */
  @property() href: string | undefined;

  /**
   * Id of the panel this tab controls, wired as `aria-controls` under the tabs pattern. The panel is
   * an element of the same tree as the tab list, with this id and `role="tabpanel"`.
   */
  @property({attribute: 'panel-id'}) panelId: string | undefined;

  /** Disables the tab: it is skipped by arrow keys and cannot be selected (the link loses its `href`). */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #context: ContextConsumer<typeof tabListContext> = new ContextConsumer<
    typeof tabListContext
  >(this, {context: tabListContext, subscribe: true});
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<typeof linkContext>(
    this,
    {context: linkContext},
  );
  readonly #slots: SlotController = new SlotController(this, 'icon', 'selected-icon', 'end');

  /** The focusable native control (the strip's roving tabindex writes `tabindex` on it). */
  get control(): HTMLButtonElement | HTMLAnchorElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement | HTMLAnchorElement>('.tab');
  }

  /** Whether this tab is the tab list's value (false outside a tab list). */
  get selected(): boolean {
    const context = this.#context.value;
    return !!context && context.value !== '' && context.value === this.value;
  }

  /** The pattern of the enclosing strip. */
  get #pattern(): 'nav' | 'tabs' {
    return this.#context.value?.pattern ?? 'nav';
  }

  /** The panel this tab controls, when it can be found in the tab's own tree. */
  get #panel(): Element | null {
    if (!this.panelId) return null;
    const root = this.getRootNode();
    return root instanceof Document || root instanceof ShadowRoot
      ? root.getElementById(this.panelId)
      : null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Passive marker: a padded container may pull an edge tab to its content edge (upstream EDGE_COMP_ATTR).
    if (!this.hasAttribute(EDGE_COMP_ATTR)) this.setAttribute(EDGE_COMP_ATTR, '');
  }

  protected override willUpdate(): void {
    if (this.#pattern === 'tabs' && this.href !== undefined) {
      devWarn(
        `tab:href:${this.value}`,
        'href is ignored in a tab list with pattern="tabs": a tab swaps a panel in place rather than navigating. Drop the href, or use the navigation pattern.',
      );
    }
    if (this.#pattern === 'nav' && this.panelId !== undefined && this.#context.value) {
      devWarn(
        `tab:panel-id-nav:${this.value}`,
        'panel-id does nothing in a tab list with the navigation pattern: there is no panel to associate. Set pattern="tabs" on the tab list, or drop the panel-id.',
      );
    }
  }

  #lastControl: Element | null = null;

  protected override updated(): void {
    this.toggleState('selected', this.selected);
    this.toggleState('disabled', this.disabled);
    this.syncControls();
    // A new native control (a link became a button) has no tabindex yet: the strip places it.
    if (this.control !== this.#lastControl) {
      this.#lastControl = this.control;
      this.#context.value?.refresh();
    }
  }

  /**
   * `aria-controls` is an element reference: the panel lives outside this shadow root, in the tree of
   * the tab list (a shadow element may point outward, A§8.2). Called after every update and by the tab
   * list once its panels can exist.
   */
  syncControls(): void {
    const control = this.control;
    if (!control) return;
    const panel = this.#pattern === 'tabs' ? this.#panel : null;
    if (panel && features.elementReflection) {
      control.ariaControlsElements = [panel as HTMLElement];
      return;
    }
    if (control.ariaControlsElements) control.ariaControlsElements = null;
    if (this.#pattern === 'tabs' && !this.panelId) {
      devWarn(
        `tab:panel-id:${this.value}`,
        'a tab in a tab list with pattern="tabs" controls nothing: set panel-id to the id of the panel it opens, so assistive technology can associate the two.',
      );
    }
  }

  /** A click selects (the strip decides); a disabled tab does nothing however it is activated. */
  readonly #onClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const context = this.#context.value;
    const link = this.#isLink;
    if (link) this.#route(event);
    if (!context || event.defaultPrevented) return;
    // A keyboard activation of a native button arrives as a click with `detail === 0`.
    context.select(this.value, event.detail === 0 ? 'keyboard' : 'pointer');
  };

  get #isLink(): boolean {
    return this.href !== undefined && this.#pattern !== 'tabs';
  }

  /** Hands an unmodified primary click on an internal link to the router (`linkContext`). */
  #route(event: MouseEvent): void {
    const router = this.#router.value;
    const href = this.href ? safeUrl(this.href, {allowData: true}) : null;
    if (!router?.navigate || href === null) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      if (new URL(href, location.href).origin !== location.origin) return;
    } catch {
      return;
    }
    if (router.navigate(href, event)) event.preventDefault();
  }

  #renderIcon(): TemplateResult | typeof nothing {
    const selectedIcon = this.selected && this.#slots.has('selected-icon');
    const hasIcon = selectedIcon || this.#slots.has('icon');
    if (!hasIcon) return nothing;
    return html`<span class="icon-slot"
      ><slot name=${selectedIcon ? 'selected-icon' : 'icon'}></slot
    ></span>`;
  }

  override render(): TemplateResult {
    const context = this.#context.value;
    const pattern = this.#pattern;
    const selected = this.selected;
    const isTab = pattern === 'tabs';
    const isLink = this.#isLink;
    const tag = isLink ? literal`a` : literal`button`;
    const href = isLink && !this.disabled && this.href ? safeUrl(this.href, {allowData: true}) : null;
    const hasLabel = !this.labelHidden && this.label !== '';
    const ariaLabel = this.labelHidden ? this.label : null;

    return staticHtml`<${tag}
      class="tab"
      part="tab"
      type=${ifDefined(isLink ? undefined : 'button')}
      role=${ifDefined(isTab ? 'tab' : undefined)}
      href=${ifDefined(href ?? undefined)}
      aria-selected=${ifDefined(isTab ? String(selected) : undefined)}
      aria-current=${ifDefined(!isTab && selected ? 'true' : undefined)}
      aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
      aria-label=${ifDefined(ariaLabel ?? undefined)}
      tabindex="-1"
      data-size=${context?.size ?? 'md'}
      data-layout=${context?.layout ?? 'hug'}
      data-selected=${ifDefined(selected ? '' : undefined)}
      data-disabled=${ifDefined(this.disabled ? '' : undefined)}
      @click=${this.#onClick}
    >${this.#renderIcon()}${
      hasLabel
        ? html`<span class="label-box"
            ><span class="label" part="label">${this.label}</span
            ><span class="label-sizer" aria-hidden="true">${this.label}</span></span
          >`
        : nothing
    }${
      this.#slots.has('end') ? html`<span class="end"><slot name="end"></slot></span>` : nothing
    }<span class="indicator" part="indicator" aria-hidden="true"></span></${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tab': TctTab;
  }
}

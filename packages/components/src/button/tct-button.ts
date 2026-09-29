import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {html as staticHtml, literal} from 'lit/static-html.js';
import english from '@tecton-astryx/locales/en/button.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {AriaDelegateController} from '@tecton-astryx/core/controllers/aria-delegate.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TooltipController} from '@tecton-astryx/core/controllers/tooltip.js';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import {buttonGroupContext, linkContext} from '@tecton-astryx/core/context/keys.js';
import {installFormBridge} from '@tecton-astryx/core/forms/implicit-submit.js';
import {
  resetFormFromSubmitter,
  submitWithSubmitter,
  SUBMITTER,
} from '@tecton-astryx/core/forms/submitter.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {safeUrl} from '@tecton-astryx/core/utils/safe-url.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import {warnInvalidValue} from '../text/text.types.js';
import {
  BUTTON_ELEVATIONS,
  BUTTON_SIZES,
  BUTTON_TYPES,
  BUTTON_VARIANTS,
  type ButtonClickAction,
  type ButtonElevation,
  type ButtonSize,
  type ButtonType,
  type ButtonVariant,
} from './button.types.js';
import styles from './tct-button.styles.css';

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as {then?: unknown} | null | undefined)?.then === 'function';

/** A number is px; anything else is a CSS length used as is (`100%`). */
const toLength = (width: string): string =>
  /^\d+(\.\d+)?$/.test(width.trim()) ? `${width.trim()}px` : width;

/**
 * Triggers an action when activated: a native button in the shadow root, a link when `href` is set, and
 * a form submitter (`type="submit"`, `type="reset"`) even though the host is a custom element.
 *
 * **Naming.** The visible text is the default slot, else `label`. `label` is also the accessible name
 * whenever it differs from the visible text: icon-only buttons (`icon-only`, no visible text, plus the
 * built-in tooltip showing the label), loading buttons, and buttons whose slotted text differs from it.
 *
 * **Busy.** `loading` (or a pending `clickAction`) shows a spinner and blocks activation, announcing
 * once through the announcer. A busy button stays focusable (`aria-disabled` + a guard) so focus is never
 * dropped. A `clickAction` that returns a promise keeps the button busy until it settles, and a second
 * click is ignored (fire-once) unless `interruptible`.
 *
 * **Disabled.** `disabled` uses the native `disabled` attribute. With a `tooltip` it uses `aria-disabled`
 * instead, so keyboard users can still reach the tooltip that says why ("disabled with reason").
 *
 * **Forms.** The host is form-associated: `type="submit"` submits its form with the button's `name` and
 * `value` (and `form*` overrides) and Enter in a field of the form activates it; `type="reset"` resets.
 * `SubmitEvent.submitter` is a temporary native button, not this element (a platform limit).
 *
 * @summary Triggers an action when activated; also a link, a form submitter and an icon-only button.
 * @tag tct-button
 * @upstream Button
 * @slot - The visible label. Defaults to the `label` attribute.
 * @slot icon - Leading icon (or use the `icon` attribute for a registered icon name).
 * @slot end - Trailing content (badge, icon, chevron). Ignored when `icon-only`.
 * @csspart button - The native `<button>` (or `<a>` for a link). Astryx target `astryx-button`.
 * @csspart icon - The leading icon wrapper.
 * @csspart label - The label wrapper.
 * @csspart end - The trailing content wrapper.
 * @cssprop --button-focus-offset - Focus ring offset. Default 1px (Tecton).
 * @cssprop --button-icon-only-aspect - Aspect ratio of icon-only buttons. Default `1 / 1`.
 * @cssstate loading - The button is busy (`loading` or a pending `clickAction`).
 * @fires click - Native click, retargeted from the inner button; one per activation. Cancelable: the
 *   submit, reset, link and `clickAction` follow only when it is not prevented.
 * @cloakDisplay inline-flex
 * @cloakMinBlockSize var(--size-element-md)
 */
export class TctButton extends TctElement {
  static override readonly tagName: string = 'tct-button';
  static override readonly dependencies = [TctIcon, TctSpinner];
  static formAssociated = true;
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, focusRing, motion, layer, slottedIcon, styles];

  /** Visual emphasis: `primary`, `secondary` (default), `ghost`, `destructive`, `outlined`, `text-only`. */
  @property({reflect: true}) variant: ButtonVariant = 'secondary';

  /** Size `sm` (28px), `md` (32px) or `lg` (36px). Unset: the nearest size provider or button group, else `md`. */
  @property({reflect: true}) size: ButtonSize | undefined;

  /** Resting shadow depth for a floating button (`none`, `low`, `med`, `high`). Ignored inside a button group. */
  @property({reflect: true}) elevation: ButtonElevation = 'none';

  /** `button` (default), `submit` or `reset`. Ignored when the button is a link. */
  @property({reflect: true}) type: ButtonType = 'button';

  /** Name submitted with the form when this button submits it. */
  @property({reflect: true}) name = '';

  /** Value submitted with the form when this button submits it. */
  @property() value = '';

  /**
   * Accessible label. It is also the visible text unless the default slot has content, and the
   * `aria-label` of an icon-only, loading, or differently labelled button.
   */
  @property() label = '';

  /** Disables the button. With a `tooltip` it is `aria-disabled` instead, so it stays focusable. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * Shows the busy state: a spinner, `aria-busy`, and no activation. A pending `clickAction` does the
   * same. Loading does not dim the button; `disabled` does.
   */
  @property({type: Boolean, reflect: true}) loading = false;

  /**
   * Keeps the button interactive while a `clickAction` is pending: a re-click starts a fresh action
   * instead of being ignored. For actions that can be re-triggered, not for submit/save/pay.
   */
  @property({type: Boolean, reflect: true}) interruptible = false;

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /** A square icon-only button: the label becomes the accessible name and the tooltip. Needs an icon. */
  @property({type: Boolean, attribute: 'icon-only', reflect: true}) iconOnly = false;

  /** Width: a number is px, a string is a CSS length (`100%` for full width). Default: fits the content. */
  @property() width: string | undefined;

  /** Tooltip text shown on hover and keyboard focus. With `disabled` it becomes the reason. */
  @property() tooltip = '';

  /** Renders a link (`<a>`) with button styling. A disabled button never renders as a link. */
  @property() href: string | undefined;

  /** Link `target`. Only with `href`. */
  @property() target: string | undefined;

  /** Link `rel`. Only with `href`. */
  @property() rel: string | undefined;

  /** Submitter override: where to submit (`formaction`). */
  @property({attribute: 'formaction'}) formAction: string | undefined;

  /** Submitter override: `formmethod`. */
  @property({attribute: 'formmethod'}) formMethod: string | undefined;

  /** Submitter override: `formenctype`. */
  @property({attribute: 'formenctype'}) formEnctype: string | undefined;

  /** Submitter override: `formtarget`. */
  @property({attribute: 'formtarget'}) formTarget: string | undefined;

  /** Submitter override: skip validation on submit (`formnovalidate`). */
  @property({type: Boolean, attribute: 'formnovalidate'}) formNoValidate = false;

  /**
   * Async click action. Runs after the click (when it was not cancelled), and while the returned
   * promise is pending the button is busy and ignores further clicks (unless `interruptible`).
   */
  @property({attribute: false}) clickAction: ButtonClickAction | undefined;

  /** The host `aria-label`, tracked so a change re-renders the inner button. @internal */
  @property({attribute: 'aria-label'}) private _hostLabel: string | null = null;

  @state() private _pending = false;
  @state() private _fieldsetDisabled = false;

  readonly #locale = new LocaleController(this, {namespace: 'button', defaults: english});
  readonly #slots = new SlotController(this, 'default', 'icon', 'end');
  readonly #group = new ContextConsumer(this, {context: buttonGroupContext, subscribe: true});
  readonly #link = new ContextConsumer(this, {context: linkContext});
  readonly #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  #inFlight = false;
  #wasLoading = false;
  #appliedWidth: string | undefined;

  constructor() {
    super();
    new AriaDelegateController(this, {
      target: () => this.#control,
      // The component manages these on the inner control itself.
      exclude: () => [
        'aria-label',
        'aria-busy',
        'aria-disabled',
        ...(this.#tooltipText ? ['aria-describedby'] : []),
      ],
    });
    new TooltipController(this, {
      mode: 'shadow',
      trigger: () => this.#control,
      surface: () => this.shadowRoot?.querySelector<HTMLElement>('.tooltip-surface') ?? null,
      content: () => this.#tooltipText,
      placement: () => ({placement: 'above', alignment: 'center', offset: 'var(--spacing-1)'}),
      focusTrigger: 'auto',
      touchTrigger: 'auto',
      enabled: () => this.#tooltipText !== '',
    });
    // Clicks that start at the host itself (`host.click()`, label activation, dispatchEvent) never pass
    // through the inner control; clicks that do are handled there.
    this.addEventListener('click', this.#onHostClick);
  }

  /** Marks the element as a submit/reset button for its form (core form bridge). @internal */
  get [SUBMITTER](): true {
    return true;
  }

  /** The form this button belongs to (`form` attribute or the nearest ancestor form), or null. */
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  /** Whether the button is busy: `loading` is set or a `clickAction` is pending. */
  get busy(): boolean {
    return this.loading || this._pending;
  }

  /** Called by the platform when a `<fieldset disabled>` ancestor toggles. @internal */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
  }

  // ---------------------------------------------------------------------------- derived values

  get #control(): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>('.button') ?? null;
  }

  /** Disabled by the attribute, an ancestor fieldset or the button group. */
  get #disabled(): boolean {
    return this.disabled || this._fieldsetDisabled || (this.#group.value?.disabled ?? false);
  }

  /** No activation: disabled, or busy without `interruptible`. */
  get #blocked(): boolean {
    if (this.#disabled) return true;
    if (this.interruptible) return false;
    // `#inFlight` claims the fire-once slot at click time, before the busy state renders.
    return this.busy || (this.clickAction !== undefined && this.#inFlight);
  }

  /** Tooltip text: the explicit `tooltip`, else the label of an icon-only button. */
  get #tooltipText(): string {
    return this.tooltip || (this.iconOnly ? this.label : '');
  }

  /** Renders a link unless disabled or the URL is not allowed (`javascript:` and friends). */
  get #linkHref(): string | null {
    if (this.href === undefined || this.href === null || this.#disabled) return null;
    return safeUrl(this.href, {allowData: true});
  }

  /** The text of the default slot (the visible label when it is provided as content). */
  get #slottedText(): string {
    let text = '';
    for (const node of this.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
      else if (node instanceof Element && !node.hasAttribute('slot'))
        text += node.textContent ?? '';
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  // ------------------------------------------------------------------------------- lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    // Enter in a field of the form must find this element as the default submit button (A§9.7).
    installFormBridge();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant'))
      warnInvalidValue('tct-button', 'variant', this.variant, BUTTON_VARIANTS);
    if (changed.has('size')) warnInvalidValue('tct-button', 'size', this.size, BUTTON_SIZES);
    if (changed.has('elevation'))
      warnInvalidValue('tct-button', 'elevation', this.elevation, BUTTON_ELEVATIONS);
    if (changed.has('type')) warnInvalidValue('tct-button', 'type', this.type, BUTTON_TYPES);
    if (this.iconOnly && this.label === '' && this._hostLabel === null) {
      devWarn(
        'button:icon-only-label',
        '<tct-button icon-only> needs a `label`: it is the accessible name.',
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('width') && this.width !== this.#appliedWidth) {
      this.#appliedWidth = this.width;
      if (this.width) this.style.setProperty('--_button-width', toLength(this.width));
      else this.style.removeProperty('--_button-width');
    }
    const busy = this.busy;
    this.toggleState('loading', busy);
    if (busy && !this.#wasLoading) announce(this.#locale.t('loading'), {element: this});
    this.#wasLoading = busy;
  }

  // ------------------------------------------------------------------------------ activation

  /** Click on the inner control (mouse, touch, Enter, Space). */
  #onControlClick = (event: MouseEvent): void => {
    this.#activate(event);
  };

  /** Click that started at the host (`click()`, `<label for>`, synthetic events). */
  #onHostClick = (event: MouseEvent): void => {
    if (event.composedPath()[0] !== this) return;
    this.#activate(event);
  };

  #activate(event: MouseEvent): void {
    if (this.#blocked) {
      // aria-disabled and busy buttons are still enabled natively: swallow the click here.
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const link =
      this.#linkHref !== null && (event.currentTarget as HTMLElement | null)?.localName === 'a';
    if (link) this.#routeLink(event);
    if (this.clickAction && !this.interruptible) this.#inFlight = true; // claims the fire-once slot now
    // The activation behaviour (submit, reset, clickAction) runs once the event has finished dispatching,
    // so listeners on the host can still cancel it, exactly as with a native button.
    setTimeout(() => {
      this.#afterDispatch(event);
    }, 0);
  }

  /** Hands an unmodified primary click on an internal link to the router (`linkContext`). */
  #routeLink(event: MouseEvent): void {
    const context = this.#link.value;
    const href = this.#linkHref;
    if (!context?.navigate || href === null) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.target && this.target !== '_self') return;
    try {
      if (new URL(href, location.href).origin !== location.origin) return;
    } catch {
      return;
    }
    if (context.navigate(href, event)) event.preventDefault();
  }

  #afterDispatch(event: MouseEvent): void {
    const action = this.clickAction;
    if (event.defaultPrevented) {
      this.#inFlight = false;
      return;
    }
    if (action) {
      let result: void | Promise<void>;
      try {
        result = action(event);
      } catch (error) {
        this.#inFlight = false;
        throw error;
      }
      if (isThenable(result)) {
        this._pending = true;
        const settle = (): void => {
          this.#inFlight = false;
          this._pending = false;
        };
        result.then(settle, (error: unknown) => {
          settle();
          throw error; // surface as an unhandled rejection, like an async event handler
        });
      } else {
        this.#inFlight = false;
      }
    }
    if (this.#linkHref !== null) return; // links navigate natively
    const form = this.form;
    if (!form) return;
    if (this.type === 'submit') {
      submitWithSubmitter(form, {
        name: this.name || undefined,
        value: this.value,
        formAction: this.formAction,
        formMethod: this.formMethod,
        formEnctype: this.formEnctype,
        formTarget: this.formTarget,
        formNoValidate: this.formNoValidate,
      });
    } else if (this.type === 'reset') {
      resetFormFromSubmitter(form);
    }
  }

  /** aria-disabled buttons stay focusable but their activation keys are swallowed. */
  #onControlKeyDown = (event: KeyboardEvent): void => {
    if (this.#blocked && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // -------------------------------------------------------------------------------- render

  override render(): TemplateResult {
    const group = this.#group.value ?? null;
    const size = this.size ?? group?.size ?? this.#size.value;
    const busy = this.busy;
    const disabled = this.#disabled;
    const blocked = this.#blocked;
    const hasReason = this.tooltip !== '';
    // Native `disabled` only for an explicit, reason-less disabled button; every other blocked state
    // (busy, disabled with a reason) keeps the control focusable through aria-disabled + the guard.
    const nativeDisabled = disabled && !hasReason;
    const ariaDisabled = blocked && !nativeDisabled;
    const linkHref = this.#linkHref;
    const tag = linkHref !== null ? literal`a` : literal`button`;
    const hasChildren = this.#slots.has('default');
    const hasIcon = this.icon !== '' || this.#slots.has('icon');
    const hasEnd = this.#slots.has('end');
    const delayed = this._pending || this.interruptible;

    // aria-label when the label is the only name: icon-only, busy (the content is hidden), or when the
    // visible content differs from the label. A host `aria-label` wins.
    const differs = hasChildren && this.label !== '' && this.#slottedText !== this.label;
    const needsLabel = this.label !== '' && (this.iconOnly || busy || differs);
    const ariaLabel = this._hostLabel ?? (needsLabel ? this.label : null);

    return staticHtml`<${tag}
        class="button focus-ring"
        part="button"
        type=${ifDefined(linkHref === null ? 'button' : undefined)}
        href=${ifDefined(linkHref ?? undefined)}
        target=${ifDefined(linkHref !== null ? this.target : undefined)}
        rel=${ifDefined(linkHref !== null ? this.rel : undefined)}
        ?disabled=${nativeDisabled}
        aria-label=${ifDefined(ariaLabel ?? undefined)}
        aria-busy=${busy ? 'true' : nothing}
        aria-disabled=${ariaDisabled ? 'true' : nothing}
        data-size=${size}
        data-group=${ifDefined(group?.orientation)}
        data-position=${ifDefined(group?.position)}
        data-elevation=${group ? 'none' : this.elevation}
        data-disabled=${disabled ? '' : nothing}
        @click=${this.#onControlClick}
        @keydown=${this.#onControlKeyDown}
      >
        ${
          busy
            ? html`<span class="spinner-overlay" ?data-delayed=${delayed} aria-hidden="true"
                ><tct-spinner size="sm" shade="inherit"></tct-spinner
              ></span>`
            : nothing
        }
        <span class="content" ?data-loading=${busy} ?data-delayed=${busy && delayed} aria-hidden=${busy ? 'true' : nothing}>
          ${
            hasIcon
              ? html`<span class="icon-slot" part="icon"
                  ><slot name="icon"
                    >${this.icon ? html`<tct-icon name=${this.icon}></tct-icon>` : nothing}</slot
                  ></span
                >`
              : nothing
          }
          ${
            this.iconOnly
              ? nothing
              : html`<span class="label" part="label"
                  >${hasChildren ? html`<slot></slot>` : this.label}</span
                >`
          }
          ${
            !this.iconOnly && hasEnd
              ? html`<span class="end" part="end"><slot name="end"></slot></span>`
              : nothing
          }
        </span>
      </${tag}>${
        this.#tooltipText
          ? html`<div class="layer-surface tooltip-surface" popover="manual">
              ${this.#tooltipText}
            </div>`
          : nothing
      }`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-button': TctButton;
  }
}

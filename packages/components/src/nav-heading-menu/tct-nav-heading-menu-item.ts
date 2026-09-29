import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {html as staticHtml, literal} from 'lit/static-html.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import {TctText} from '../text/tct-text.js';
import {navHeadingMenuContext} from './nav-heading-menu.context.js';
import styles from './tct-nav-heading-menu-item.styles.css';

/**
 * One row of a `tct-nav-heading-menu`: an icon, a label and a description. With `href` the row is an
 * `<a role="menuitem">` (a real link: it opens in a new tab, and `tct-link-provider` can route it),
 * otherwise a `<div role="menuitem">` that fires `click`. Activating it (click, Enter or Space) runs the
 * click and then dismisses the heading popover the menu is in. A disabled row is announced as unavailable,
 * cannot be focused or activated, and is skipped by arrow keys and typeahead.
 *
 * The menu's roving tabindex writes `tabindex` on the inner control ({@link control}); the label is
 * truncated to one line, with a tooltip of the full text.
 *
 * @summary A row of a nav heading menu: a link or an action with an icon, label and description.
 * @tag tct-nav-heading-menu-item
 * @upstream NavHeadingMenuItem
 * @slot label - Rich label; overrides `label`.
 * @slot description - Rich description; overrides `description`.
 * @slot icon - Custom icon; overrides `icon`.
 * @csspart item - The painted row: the link or the action (upstream theming target `nav-heading-menu-item`).
 * @cssstate disabled - The row cannot be activated.
 * @fires click - Native click, once per activation. Not fired while `disabled`.
 * @cloakDisplay block
 */
export class TctNavHeadingMenuItem extends TctElement {
  static override readonly tagName = 'tct-nav-heading-menu-item';
  static override readonly dependencies = [TctText, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** Primary text (one line, truncated with a tooltip). Rich content goes through `slot="label"`. Required. */
  @property() label = '';

  /** Secondary text below the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /** Destination. With it the row is a link; without it, an action that fires `click`. */
  @property() href: string | undefined;

  /** Disables the row: not focusable, not activatable, skipped by arrow keys and typeahead. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #context: ContextConsumer<typeof navHeadingMenuContext> = new ContextConsumer<
    typeof navHeadingMenuContext
  >(this, {context: navHeadingMenuContext, subscribe: true});
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<typeof linkContext>(
    this,
    {context: linkContext},
  );
  readonly #slots: SlotController = new SlotController(this, 'label', 'description', 'icon');

  /** The focusable menuitem (the menu's roving tabindex writes `tabindex` on it). */
  get control(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.item');
  }

  /** The row's text, for typeahead. */
  get menuLabel(): string {
    return (
      this.label.trim() ||
      (this.querySelector(':scope > [slot="label"]')?.textContent ?? '').trim()
    );
  }

  protected override updated(): void {
    this.toggleState('disabled', this.disabled);
  }

  /** One activation path: a disabled row swallows the click; otherwise the click runs, then the menu closes. */
  readonly #onClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (this.href !== undefined) this.#route(event);
    // A consumer's click listener (on the host) runs after this one, so the close is deferred a microtask:
    // it sees the row still in the tree and any state its click set.
    queueMicrotask(() => {
      this.#context.value?.closeMenu();
    });
  };

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

  /** Space activates a menu item; a native anchor does not do it on its own. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' || event.defaultPrevented || this.disabled || this.href === undefined) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    this.control?.click();
  };

  #renderIcon(): TemplateResult | typeof nothing {
    if (this.#slots.has('icon')) return html`<span class="icon"><slot name="icon"></slot></span>`;
    return this.icon
      ? html`<tct-icon class="icon" name=${this.icon} size="sm" color="secondary"></tct-icon>`
      : nothing;
  }

  override render(): TemplateResult {
    const size = this.#context.value?.size ?? 'md';
    const isLink = this.href !== undefined;
    const tag = isLink ? literal`a` : literal`div`;
    const href = isLink && !this.disabled && this.href ? safeUrl(this.href, {allowData: true}) : null;
    return staticHtml`<${tag}
      class="item"
      part="item"
      role="menuitem"
      href=${ifDefined(href ?? undefined)}
      tabindex=${this.disabled ? nothing : '-1'}
      aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
      data-size=${size}
      ?data-disabled=${this.disabled}
      @click=${this.#onClick}
      @keydown=${this.#onKeyDown}
    >
      ${this.#renderIcon()}
      <span class="content">
        <tct-text type="body" max-lines="1" color="inherit"
          >${this.#slots.has('label') ? html`<slot name="label"></slot>` : this.label}</tct-text
        >${
          this.#slots.has('description') || this.description
            ? html`<tct-text type="supporting" max-lines="1" color="secondary"
                >${this.#slots.has('description') ? html`<slot name="description"></slot>` : this.description}</tct-text
              >`
            : nothing
        }
      </span>
    </${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-nav-heading-menu-item': TctNavHeadingMenuItem;
  }
}

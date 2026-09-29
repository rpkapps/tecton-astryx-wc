import {html, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import defaults from '@tecton-wc/locales/en/avatarGroup.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {avatarGroupContext} from './avatar.context.js';
import {resolveSize} from './avatar.types.js';
import styles from './tct-avatar-group-overflow.styles.css';

/**
 * The "+N" indicator at the end of an avatar group: it stands for the people who are not shown
 * individually. It takes the group's size and shape so it matches the avatars beside it.
 *
 * Non-interactive by default (`role="img"`, named "5 more"). Set `interactive` and listen for `click`
 * to make it a button, for example to open the full list; it then joins the group's single tab stop.
 * The visible text is "+N" (or your own content in the default slot); the accessible name is always the
 * localised count phrase.
 *
 * Guides: [mwg:accessible-web-components] [mwg:styling-web-components] [mwg:shadow-dom].
 *
 * @summary The "+N" overflow indicator of an avatar group.
 * @tag tct-avatar-group-overflow
 * @upstream AvatarGroupOverflow
 * @slot - Custom content instead of the default "+N" label.
 * @csspart base - The chip: a `<button>` when interactive, otherwise a plain element.
 * @fires click - Native click, retargeted from the inner button (only when `interactive`).
 * @cloakDisplay inline-flex
 */
export class TctAvatarGroupOverflow extends TctElement {
  static override readonly tagName = 'tct-avatar-group-overflow';
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** The number of people not shown; the label reads "+N" and the name "N more". Negative counts read as 0. */
  @property({type: Number}) count = 0;

  /**
   * Makes the indicator a `<button type="button">`; listen for `click`. Upstream renders a button when it
   * is given an `onClick`, which an element cannot observe, so the intent is an attribute.
   */
  @property({type: Boolean, reflect: true}) interactive = false;

  readonly #group = new ContextConsumer(this, {context: avatarGroupContext, subscribe: true});
  readonly #locale = new LocaleController(this, {namespace: 'avatarGroup', defaults});
  readonly #slots = new SlotController(this, 'default');
  #hadControl = false;

  /** The inner button when `interactive`, else `null`: what the group's roving tab stop focuses. */
  get control(): HTMLElement | null {
    return this.interactive ? this.renderRoot.querySelector<HTMLElement>('button') : null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Re-evaluate the group-owned tab stop after a move.
    this.requestUpdate();
  }

  protected override updated(): void {
    const control = this.control;
    if (this.#hadControl !== (control !== null)) {
      this.#hadControl = control !== null;
      this.#group.value?.refresh();
    }
    // A tab stop written by a group's roving controller must not outlive the group.
    if (control && !this.#group.value && control.hasAttribute('tabindex')) {
      control.removeAttribute('tabindex');
    }
  }

  override render(): TemplateResult {
    const group = this.#group.value;
    const size = group?.numericSize ?? resolveSize('md');
    const shape = group?.shape ?? 'circle';
    const count = Number.isFinite(this.count) ? Math.max(0, this.count) : 0;
    const label = this.#locale.t('overflow', {count});
    const content = this.#slots.has('default') ? html`<slot></slot>` : `+${count}`;
    const shared = {
      '--_size': `${size}px`,
      '--_overlap': `${-(group?.overlap ?? 0)}px`,
    };
    return this.interactive
      ? html`<button
          type="button"
          class="base focus-ring"
          part="base"
          data-shape=${shape}
          aria-label=${label}
          style=${styleMap(shared)}
        >
          ${content}
        </button>`
      : html`<span
          class="base"
          part="base"
          role="img"
          data-shape=${shape}
          aria-label=${label}
          style=${styleMap(shared)}
          >${content}</span
        >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-avatar-group-overflow': TctAvatarGroupOverflow;
  }
}

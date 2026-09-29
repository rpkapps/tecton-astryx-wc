import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/chat.js';
import drawerEnglish from '@tecton-wc/locales/en/chatComposerDrawer.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctCollapseChangeEvent} from '@tecton-wc/core/events/tct-collapse-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import {TctBadge} from '../badge/tct-badge.js';
import styles from './tct-chat-composer-drawer.styles.css';

const messages = {...english, ...drawerEnglish};

/**
 * A collapsible drawer above a chat composer for what belongs to the draft but is not text:
 * attachments, context chips, previews. Put it in the composer's `drawer` slot. With a `count` it can
 * collapse: a toggle row (a real button) sits at its top, and collapsed it shows a badge with the count
 * and the `label` instead of the content, which is removed from the tab order and the accessibility
 * tree (`inert`) until it expands. Without a `count` it is a plain container.
 *
 * The toggle is named "Collapse {label}" or "Expand {label}" and carries `aria-expanded` and
 * `aria-controls` for the content region (a disclosure). The drawer tucks its bottom corners behind the
 * composer body, so its top corners line up with the composer's outer radius.
 *
 * `collapsed` is the state, and its attribute the initial one; the user's toggle asks first with the
 * cancelable `tct-collapse-change`, so a page can own the state (prevent it and set `collapsed` yourself).
 * Property and attribute writes never fire it.
 *
 * @summary A collapsible drawer of attachments or context chips above a chat composer.
 * @tag tct-chat-composer-drawer
 * @upstream ChatComposerDrawer
 * @slot - The content: attachment thumbnails, context chips, previews.
 * @slot collapsed-summary - Replaces the default badge and label shown while collapsed.
 * @csspart base - The drawer surface (theme target `chat-composer-drawer`).
 * @csspart toggle - The toggle button row.
 * @csspart summary - The collapsed summary.
 * @csspart handle - The bar handle shown while expanded.
 * @csspart content - The content region.
 * @cssstate collapsed - The drawer is collapsed.
 * @fires {TctCollapseChangeEvent} tct-collapse-change - Before the user's toggle collapses or expands it; cancelable.
 * @cloakDisplay block
 */
export class TctChatComposerDrawer extends TctElement {
  static override readonly tagName = 'tct-chat-composer-drawer';
  static override readonly dependencies = [TctBadge];
  static override styles: CSSResultGroup = [base, focusRing, motion, styles];

  /** Total item count, shown in the collapsed badge. Without it the drawer does not collapse. */
  @property({type: Number}) count: number | undefined;

  /** Name of the drawer's content ("Attachments"): the collapsed label and the toggle's name. Default "Items". */
  @property() label: string | undefined;

  /** Whether the drawer is collapsed. The attribute is the initial state; the user's toggle changes it. */
  @property({type: Boolean, reflect: true}) collapsed = false;

  readonly #locale: LocaleController = new LocaleController(this, {defaults: messages});
  readonly #slots: SlotController = new SlotController(this, 'collapsed-summary');
  readonly #contentId = uniqueId('tct-chat-drawer');

  /** Whether the drawer can collapse: only with a `count`. */
  get #collapsible(): boolean {
    return this.count !== undefined && this.count !== null && !Number.isNaN(this.count);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('collapsed')) this.toggleState('collapsed', this.collapsed);
  }

  override render(): TemplateResult {
    const label = this.label || this.#locale.t('@tct.chat.composerDrawer.label');
    const collapsible = this.#collapsible;
    const collapsed = collapsible && this.collapsed;
    return html`<div class="base" part="base" ?data-collapsed=${collapsed}>
      ${
        collapsible
          ? html`<button
              class="toggle focus-ring"
              part="toggle"
              type="button"
              aria-expanded=${collapsed ? 'false' : 'true'}
              aria-controls=${this.#contentId}
              aria-label=${this.#locale.t(
                collapsed ? '@tct.chatComposerDrawer.expand' : '@tct.chatComposerDrawer.collapse',
                {label},
              )}
              @click=${this.#onToggle}
            >
              <span
                class="summary"
                part="summary"
                aria-hidden="true"
                inert
                ?data-hidden=${!collapsed}
              >
                ${
                  this.#slots.has('collapsed-summary')
                    ? html`<slot name="collapsed-summary"></slot>`
                    : html`<tct-badge variant="neutral" label=${String(this.count)}></tct-badge
                        ><span class="summary-label">${label}</span>`
                }
              </span>
              <span class="handle" part="handle" ?data-hidden=${collapsed}></span>
            </button>`
          : nothing
      }
      <div class="grid" id=${this.#contentId} ?inert=${collapsed}>
        <div class="content" part="content"><slot></slot></div>
      </div>
    </div>`;
  }

  /** A pointer click and a keyboard activation both arrive as `click`; `detail` tells them apart. */
  readonly #onToggle = (event: MouseEvent): void => {
    const next = !this.collapsed;
    // `detail` is 0 for a keyboard-activated click (Enter, Space) and a virtual one.
    const reason = event.detail === 0 ? 'keyboard' : 'pointer';
    if (this.dispatch(new TctCollapseChangeEvent(next, reason))) this.collapsed = next;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-composer-drawer': TctChatComposerDrawer;
  }
}

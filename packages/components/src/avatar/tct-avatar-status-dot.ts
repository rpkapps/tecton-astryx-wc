import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import {avatarContext, type AvatarContextValue} from './avatar.context.js';
import {AVATAR_STATUS_DOT_VARIANTS, type AvatarStatusDotVariant} from './avatar.types.js';
import styles from './tct-avatar-status-dot.styles.css';

type Tier = 'small' | 'medium' | 'large';

/**
 * Dot, border and icon sizes per avatar size tier (upstream `resolveStatusDotSize`): discrete tiers
 * rather than a ratio so the dot looks intentional at every size. The smallest tier draws no slotted
 * icon (there is no room); the built-in shape glyph still shows there.
 */
function tierFor(avatarSize: number): {dot: number; border: number; icon: number; tier: Tier} {
  if (avatarSize <= 36) return {dot: 10, border: 1, icon: 0, tier: 'small'};
  if (avatarSize <= 72) return {dot: 20, border: 2, icon: 12, tier: 'medium'};
  return {dot: 32, border: 4, icon: 18, tier: 'large'};
}

/** Glyph stroke per tier in px of the inner field: about field / 12, floored at 1px. */
const STROKE: Readonly<Record<Tier, number>> = {small: 1, medium: 1.5, large: 2};

/** Fraction of the inner field the minus bar spans, cap to cap. */
const MINUS_BAR_SPAN = 0.75;

/** The built-in shape per variant, so a status differs by shape and not only by colour (WCAG 1.4.1). */
const GLYPHS: Readonly<Partial<Record<AvatarStatusDotVariant, 'ring' | 'minus'>>> = {
  neutral: 'ring',
  error: 'minus',
};

/**
 * A status indicator that scales with the avatar it sits in. Each variant pairs a colour with a
 * distinct built-in shape (a filled dot, a ring, a barred dot) so status never relies on colour alone.
 *
 * Put it in the `status` slot of a `tct-avatar`: it reads the avatar size from context and reports its
 * `label` to the avatar, which composes it into the avatar's accessible name ("Jane Doe, Online"). Outside an
 * avatar it is a standalone `role="img"` with that label.
 *
 * Guides: [mwg:accessible-web-components] (role and name through `ElementInternals`)
 * [mwg:styling-web-components] [mwg:css] (forced colours).
 *
 * @summary A status dot that scales with its avatar and names itself into the avatar.
 * @tag tct-avatar-status-dot
 * @upstream AvatarStatusDot
 * @slot icon - Optional icon inside the dot (medium and large avatars); replaces the built-in glyph. Use a different icon per status.
 * @csspart base - The dot.
 * @csspart glyph - The built-in shape glyph.
 * @csspart icon - The wrapper of the slotted icon.
 * @cloakDisplay inline-flex
 */
export class TctAvatarStatusDot extends TctElement {
  static override readonly tagName = 'tct-avatar-status-dot';
  static override styles: CSSResultGroup = [base, slottedIcon, styles];

  /**
   * `success` is a filled dot (online, accepted); `neutral` a hollow ring (away, offline, pending);
   * `error` a dot with a minus bar (busy, do not disturb).
   */
  @property({reflect: true}) variant: AvatarStatusDotVariant = 'success';

  /**
   * Accessible label of the status ("Online", "John Doe is busy"). Inside an avatar it is composed
   * into the avatar's name; on its own the dot is a `role="img"` with this name.
   */
  @property() label: string | undefined;

  readonly #avatar = new ContextConsumer(this, {context: avatarContext, subscribe: true});
  readonly #slots = new SlotController(this, 'icon');
  #reportedTo: AvatarContextValue | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#report();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#withdraw();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('variant') &&
      !(AVATAR_STATUS_DOT_VARIANTS as readonly string[]).includes(this.variant)
    ) {
      devWarn(
        `avatar-status-dot:variant:${this.variant}`,
        `<tct-avatar-status-dot variant="${this.variant}"> is not one of ${AVATAR_STATUS_DOT_VARIANTS.join(', ')}; using "success".`,
      );
    }
    // Default semantics on ElementInternals so consumer attributes still override them.
    const named = this.label !== undefined && this.label !== '';
    this.internals.role = named ? 'img' : null;
    this.internals.ariaLabel = named ? (this.label ?? null) : null;
  }

  protected override updated(): void {
    this.#report();
  }

  /** Hands the label to the enclosing avatar (and re-hands it if the avatar changed). */
  #report(): void {
    const avatar = this.#avatar.value ?? undefined;
    if (this.#reportedTo && this.#reportedTo !== avatar) this.#withdraw();
    if (avatar) {
      avatar.reportStatusLabel(this, this.label);
      this.#reportedTo = avatar;
    }
  }

  #withdraw(): void {
    this.#reportedTo?.reportStatusLabel(this, undefined);
    this.#reportedTo = undefined;
  }

  override render(): TemplateResult {
    const {dot, border, icon, tier} = tierFor(this.#avatar.value?.size ?? 36);
    const showsIcon = icon > 0 && this.#slots.has('icon');
    const shape = showsIcon ? undefined : GLYPHS[this.variant];
    return html`<div
      class="dot"
      part="base"
      style=${styleMap({
        '--_dot-size': `${dot}px`,
        '--_dot-border': `${border}px`,
        '--_icon-size': `${icon}px`,
      })}
    >
      ${
        showsIcon
          ? html`<span class="icon-slot" part="icon" aria-hidden="true"
              ><slot name="icon"></slot
            ></span>`
          : nothing
      }
      ${shape ? this.#glyph(shape, dot - border * 2, STROKE[tier]) : nothing}
    </div>`;
  }

  /** The shape glyph as a stroked inline SVG in `currentcolor`; one user unit per px of the inner field. */
  #glyph(shape: 'ring' | 'minus', field: number, stroke: number): TemplateResult {
    const center = field / 2;
    return html`<svg
      class="glyph"
      part="glyph"
      data-shape=${shape}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 ${field} ${field}"
      width=${field}
      height=${field}
      fill="none"
    >
      ${
        shape === 'ring'
          ? html`<circle
              cx=${center}
              cy=${center}
              r=${(field - stroke) / 2}
              fill="none"
              stroke="currentcolor"
              stroke-width=${stroke}
            ></circle>`
          : html`<line
              x1=${(field * (1 - MINUS_BAR_SPAN)) / 2 + stroke / 2}
              y1=${center}
              x2=${(field * (1 + MINUS_BAR_SPAN)) / 2 - stroke / 2}
              y2=${center}
              stroke="currentcolor"
              stroke-width=${stroke}
              stroke-linecap="round"
            ></line>`
      }
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-avatar-status-dot': TctAvatarStatusDot;
  }
}

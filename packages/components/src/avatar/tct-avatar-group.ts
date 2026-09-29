import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';
import {
  accessibleText,
  resolveIdRefs,
  setAriaElements,
} from '@tecton-wc/core/controllers/aria-delegate.js';
import {features} from '@tecton-wc/core/features.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import defaults from '@tecton-wc/locales/en/avatarGroup.js';
import base from '../styles/base.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {avatarGroupContext} from './avatar.context.js';
import {
  AVATAR_SHAPES,
  resolveSize,
  sizeConverter,
  type AvatarShape,
  type AvatarSize,
} from './avatar.types.js';
import styles from './tct-avatar-group.styles.css';

/** Fraction of the avatar size that neighbours overlap (upstream `OVERLAP_RATIO`). */
const OVERLAP_RATIO = 0.25;

/** A group member that can be a tab stop: an interactive avatar or overflow indicator. */
interface AvatarItem extends HTMLElement {
  readonly control: HTMLElement | null;
}

/**
 * A stacked row of avatars with an optional "+N" overflow indicator. Children are `tct-avatar`s and at
 * most one `tct-avatar-group-overflow`; slice the list yourself and pass `count` for the rest. The group
 * sizes every member uniformly (its `size` and `shape` win over the members' own) and overlaps them by a
 * quarter of their size.
 *
 * When the group has interactive members (avatars with `href` or `interactive`, or an interactive
 * overflow) it is a single tab stop with roving arrow-key focus and a screen-reader hint ("Use arrow
 * keys to move between avatars"). A purely static facepile stays a plain, non-focusable `group`.
 *
 * The group's accessible name is "Avatars" (localised); set `aria-label` on the host to replace it.
 *
 * Guides: [mwg:accessible-web-components] (group role and description in one tree) [mwg:shadow-dom]
 * (slotted members) [mwg:styling-web-components].
 *
 * @summary A stacked row of avatars with an optional overflow count.
 * @tag tct-avatar-group
 * @upstream AvatarGroup
 * @slot - `tct-avatar` elements, optionally followed by one `tct-avatar-group-overflow`.
 * @csspart base - The row container with `role="group"`.
 * @cloakDisplay inline-flex
 */
export class TctAvatarGroup extends TctElement {
  static override readonly tagName = 'tct-avatar-group';
  static override styles: CSSResultGroup = [base, visuallyHidden, styles];

  /** `aria-label` overrides the default name and is read in `render()`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'aria-label', 'aria-describedby'];
  }

  /** Size of every member: a named size or pixels. Wins over the members' own `size`. */
  @property({converter: sizeConverter, reflect: true}) size: AvatarSize = 'md';

  /** Shape of every member and of the overflow indicator. Wins over the members' own `shape`. */
  @property({reflect: true}) shape: AvatarShape = 'circle';

  readonly #provider: ContextProvider<typeof avatarGroupContext> = new ContextProvider<
    typeof avatarGroupContext
  >(this, {
    context: avatarGroupContext,
    initialValue: null,
  });
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'avatarGroup',
    defaults,
  });
  readonly #ids: IdController = new IdController(this, 'tct-avatar-group');
  readonly #observer = new MutationObserver(() => {
    this.requestUpdate();
  });
  readonly #roving: RovingTabindexController<AvatarItem> = new RovingTabindexController<AvatarItem>(
    this,
    {
      items: () => this.#items(),
      orientation: 'horizontal',
      focusTarget: (item) => item.control,
    },
  );

  /** @internal Re-renders when the host `aria-label` or `aria-describedby` changes. */
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'aria-label' || name === 'aria-describedby') this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Members arriving or leaving change the tab stop and the hint; members turning interactive call
    // `refresh()` from the context after they render.
    this.#observer.observe(this, {childList: true});
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer.disconnect();
  }

  /** Interactive members in DOM order (the roving items). */
  #items(): AvatarItem[] {
    return [...this.children].filter(
      (child): child is AvatarItem =>
        (child as Partial<AvatarItem>).control !== undefined &&
        (child as AvatarItem).control !== null,
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('shape') && !(AVATAR_SHAPES as readonly string[]).includes(this.shape)) {
      devWarn(
        `avatar-group:shape:${this.shape}`,
        `<tct-avatar-group shape="${this.shape}"> is not one of ${AVATAR_SHAPES.join(', ')}; using "circle".`,
      );
    }
    if (changed.has('size') || changed.has('shape')) {
      const numericSize = resolveSize(this.size);
      this.#provider.setValue({
        size: this.size,
        shape: this.shape,
        overlap: Math.round(numericSize * OVERLAP_RATIO),
        numericSize,
        refresh: () => {
          this.requestUpdate();
        },
      });
    }
  }

  protected override updated(): void {
    this.#syncDescription();
  }

  /**
   * Description = the author's `aria-describedby` targets plus the keyboard hint, in one list: ids
   * only resolve within one tree, so the hint (in this shadow root) and the author's elements (outside)
   * are combined as element references, or as text where element reflection is missing (Tier 2).
   */
  #syncDescription(): void {
    const container = this.renderRoot.querySelector<HTMLElement>('[role="group"]');
    if (!container) return;
    const hint = this.renderRoot.querySelector<HTMLElement>(`#${CSS.escape(this.#ids.id('hint'))}`);
    const authored = resolveIdRefs(this, this.getAttribute('aria-describedby'));
    const elements = hint ? [...authored, hint] : authored;
    if (features.elementReflection) {
      container.removeAttribute('aria-description');
      setAriaElements(container, 'ariaDescribedByElements', elements.length > 0 ? elements : null);
    } else {
      const text = elements.map(accessibleText).filter(Boolean).join(' ');
      if (text) container.setAttribute('aria-description', text);
      else container.removeAttribute('aria-description');
    }
  }

  override render(): TemplateResult {
    const label = this.#locale.t('label', undefined, 'aria-label');
    const hasInteractive = this.#items().length > 0;
    return html`<div class="base" part="base" role="group" aria-label=${label}>
      <slot @slotchange=${this.#onSlotChange}></slot>
      ${
        hasInteractive
          ? html`<span class="visually-hidden" id=${this.#ids.id('hint')}
              >${this.#locale.t('keyboardHint')}</span
            >`
          : nothing
      }
    </div>`;
  }

  #onSlotChange = (): void => {
    this.requestUpdate();
    this.#roving.update();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-avatar-group': TctAvatarGroup;
  }
}

import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {safeUrl} from '@tecton-astryx/core/utils/safe-url.js';
import defaults from '@tecton-astryx/locales/en/citation.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {CITATION_VARIANTS, type CitationSource, type CitationVariant} from './citation.types.js';
import styles from './tct-citation.styles.css';

/**
 * An inline reference to a source: use it to attribute information in an AI answer, an article or
 * anywhere provenance matters. The `label` variant is a chip with the source title (and an optional
 * icon); the `number` variant is a compact superscript badge, like a footnote marker.
 *
 * With a safe `url` the citation is a link that opens in a new tab (`rel="noopener noreferrer"`,
 * role `doc-noteref`); without one it is a plain, non-interactive reference. Either way its accessible
 * name is "Citation 3: Source title" (localised), so the number and the title are both read.
 *
 * The source is the `source` property, or the flat attributes `source-title`, `source-url` and
 * `source-src` for declarative markup; a field set on `source` wins over its attribute. A node icon
 * goes in the `icon` slot.
 *
 * Guides: [mwg:accessible-web-components] (name inside the shadow root, `delegatesFocus`)
 * [mwg:styling-web-components] (parts) [mwg:security] (URL policy, `noopener`).
 *
 * @summary An inline reference to a source, as a title chip or a numbered badge.
 * @tag tct-citation
 * @upstream Citation
 * @slot icon - Source icon before the label (label variant only); wins over `source.src`.
 * @csspart base - The chip or badge: the link, or the plain element without a URL.
 * @csspart icon - The round wrapper of the source icon.
 * @csspart label - The source title, clipped with an ellipsis.
 * @cloakDisplay inline
 */
export class TctCitation extends TctElement {
  static override readonly tagName = 'tct-citation';
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** The cited source. Data property: an object with `title`, `url`, `src` and `icon`. */
  @property({attribute: false}) source: CitationSource | undefined;

  /** Source title (attribute form of `source.title`). */
  @property({attribute: 'source-title'}) sourceTitle: string | undefined;

  /** Source URL (attribute form of `source.url`). */
  @property({attribute: 'source-url'}) sourceUrl: string | undefined;

  /** Source image URL (attribute form of `source.src`). */
  @property({attribute: 'source-src'}) sourceSrc: string | undefined;

  /** The citation number shown in the badge and read in the accessible name. */
  @property({type: Number}) number: number | undefined;

  /** `label` shows a chip with the source title; `number` shows a numbered superscript badge. */
  @property({reflect: true}) variant: CitationVariant = 'label';

  @state() private imageFailed = false;

  readonly #slots = new SlotController(this, 'icon');
  readonly #locale = new LocaleController(this, {namespace: 'citation', defaults});

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant') && !CITATION_VARIANTS.includes(this.variant)) {
      devWarn(
        `citation:variant:${this.variant}`,
        `<tct-citation variant="${this.variant}"> is not one of ${CITATION_VARIANTS.join(', ')}; using "label".`,
      );
    }
    if (changed.has('source') || changed.has('sourceSrc')) this.imageFailed = false;
  }

  override render(): TemplateResult {
    const number = this.number ?? 0;
    const title = this.source?.title ?? this.sourceTitle ?? String(number);
    const url = this.source?.url ?? this.sourceUrl;
    const href = url ? (safeUrl(url, {allowData: true}) ?? undefined) : undefined;
    const name = this.#locale.t('label', {number, title});
    const isNumber = this.variant === 'number';
    const content = isNumber ? html`${number}` : this.#renderLabel(title);
    return href
      ? html`<a
          class="base focus-ring"
          part="base"
          href=${href}
          target="_blank"
          rel="noopener noreferrer"
          role="doc-noteref"
          aria-label=${name}
          title=${title}
          >${content}</a
        >`
      : html`<span class="base" part="base" role="img" aria-label=${name} title=${title}
          >${content}</span
        >`;
  }

  #renderLabel(title: string): TemplateResult {
    const image = this.source?.src ?? this.sourceSrc ?? this.source?.icon;
    const imageUrl = image ? (safeUrl(image) ?? undefined) : undefined;
    const slotted = this.#slots.has('icon');
    const showImage = !slotted && imageUrl !== undefined && !this.imageFailed;
    return html`${
        slotted || showImage
          ? html`<span class="icon" part="icon" aria-hidden="true"
              >${
                slotted
                  ? html`<slot name="icon"></slot>`
                  : html`<img src=${imageUrl!} alt="" @error=${this.#onImageError} />`
              }</span
            >`
          : nothing
      }<span class="label" part="label">${title}</span>`;
  }

  #onImageError = (): void => {
    this.imageFailed = true;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-citation': TctCitation;
  }
}

import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import dialogMessages from '@tecton-wc/locales/en/dialog.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {OwnedPartsController} from '@tecton-wc/core/controllers/owned-parts.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import {TctButton} from '../button/tct-button.js';
import base from '../styles/base.styles.css';
import {oneOf} from '../field/field-utils.js';
import {dialogContext, type DialogHeaderLike} from './dialog.context.js';
import {DIALOG_END_COMPENSATIONS, type DialogEndCompensation} from './dialog.types.js';
import styles from './tct-dialog-header.styles.css';

/**
 * Typography of the heading satellite, as inline custom-property references. The heading is an `h2` in
 * the light DOM (so the dialog, whose `<dialog>` lives in a shadow root, can name itself after it), and
 * an application reset such as `h2 { margin: 2rem }` reaches it; inline declarations beat those.
 */
const HEADING_STYLE =
  'margin:0;padding:0;outline:none;color:inherit;font-family:var(--font-family-heading, var(--font-family-body));' +
  'font-size:var(--text-heading-2-size);font-weight:var(--text-heading-2-weight);' +
  'line-height:var(--text-heading-2-leading);overflow-wrap:anywhere;';

/**
 * The header of a dialog: a heading, an optional subtitle, start and end content, and a close button.
 *
 * The heading names the dialog (the dialog reads it, unless you give the dialog its own `aria-label` or
 * `aria-labelledby`), and it takes focus when a modal dialog opens, so a screen-reader user hears where they are
 * (the heading is focusable with a script, never in the tab order). The close button asks the dialog to
 * close with a cancelable `tct-open-change`; a `required` dialog has none, because it cannot be closed.
 *
 * The heading is the `heading` text, rendered as an `<h2>` in your light DOM, or an element of your own
 * in `slot="title"` when the heading needs markup. Used on its own (outside a `tct-dialog`), the close
 * button fires `tct-open-change` from the header itself.
 *
 * @summary Title, subtitle, actions and close button of a dialog.
 * @tag tct-dialog-header
 * @upstream DialogHeader
 * @slot title - Your own heading element (an `<h2>` or similar) instead of the `heading` text.
 * @slot start - Content before the title (a back button).
 * @slot end - Content after the title, before the close button (action buttons).
 * @csspart header - The header row.
 * @csspart start - The start content.
 * @csspart title-block - The block holding the title and subtitle.
 * @csspart subtitle - The subtitle.
 * @csspart end - The end content and close button.
 * @csspart close-button - The close button, a `tct-button`.
 * @fires tct-open-change - The close button was pressed outside a `tct-dialog`; cancelable, `open` is `false`, reason `close-button`.
 * @cloakDisplay block
 */
export class TctDialogHeader extends TctElement implements DialogHeaderLike {
  static override readonly tagName = 'tct-dialog-header';
  static override readonly dependencies = [TctButton];
  static override styles: CSSResultGroup = [base, styles];

  /** The title (upstream `title`). Rendered as an `<h2>`; it names the dialog and takes focus when the dialog opens. */
  @property() heading = '';

  /** A subtitle under the title, in smaller, secondary text. */
  @property() subtitle = '';

  /**
   * Hides the close button. A dialog whose `purpose` is `required` has none anyway. Upstream shows it
   * only when an `onOpenChange` is passed; here it is the default, and this turns it off.
   */
  @property({type: Boolean, attribute: 'no-close-button'}) noCloseButton = false;

  /** Accessible name and tooltip of the close button. Defaults to "Close" in the language of the page. */
  @property({attribute: 'close-label'}) closeLabel = '';

  /**
   * Which edges of the end slot are pulled in to line its buttons up with the title. By default the
   * close button's edges are (block and inline); `inline`, `block` or `all` choose explicitly.
   */
  @property({attribute: 'end-content-edge-compensation'})
  endContentEdgeCompensation: DialogEndCompensation | undefined;

  /**
   * A themed border under the header. Without one the spacing collapses so the header flows into the
   * content. The default is no divider (a layout may state a default for its headers).
   */
  @property({type: Boolean, reflect: true, attribute: 'has-divider'}) hasDivider = false;

  readonly #dialog: ContextConsumer<typeof dialogContext> = new ContextConsumer<
    typeof dialogContext
  >(this, {
    context: dialogContext,
    subscribe: true,
    callback: (value) => {
      value?.register(this);
    },
  });
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'dialog',
    defaults: dialogMessages,
  });
  readonly #slots: SlotController = new SlotController(this, 'title', 'start', 'end');
  readonly #id = uniqueId('tct-dialog-title');
  readonly #parts: OwnedPartsController = new OwnedPartsController(this, {
    parts: [
      {
        slot: 'title',
        tag: 'h2',
        when: () => this.heading !== '' && !this.#authorTitle(),
        init: (element) => {
          element.id ||= this.#id;
          element.setAttribute('tabindex', '-1');
          element.style.cssText = HEADING_STYLE;
          if (element.textContent !== this.heading) element.textContent = this.heading;
        },
      },
    ],
  });

  /** The heading element that names the dialog: your `slot="title"` element, else the `<h2>` satellite. */
  get headingElement(): HTMLElement | null {
    return this.#authorTitle() ?? this.#parts.get('title') ?? null;
  }

  #authorTitle(): HTMLElement | null {
    const element = this.querySelector<HTMLElement>(
      ':scope > [slot="title"]:not([data-tct-owned])',
    );
    // A `tct-dialog` forwards its own heading slot here: the heading is what that slot holds.
    if (element instanceof HTMLSlotElement)
      return (element.assignedElements({flatten: true})[0] as HTMLElement | undefined) ?? null;
    return element;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dialog.value?.unregister(this);
  }

  protected override updated(changed: PropertyValues<this>): void {
    // The dialog names itself after the heading text, so it must hear when the text or the element changes.
    if (changed.has('heading')) this.#dialog.value?.register(this);
  }

  override render() {
    const context = this.#dialog.value;
    const showClose = !this.noCloseButton && context?.purpose !== 'required';
    const closeLabel = this.closeLabel || this.#locale.t('close', undefined, 'close-label');
    const compensation = this.endContentEdgeCompensation
      ? oneOf(this.endContentEdgeCompensation, DIALOG_END_COMPENSATIONS, 'all')
      : undefined;
    // Default: pull in the edges of the close button; explicit `inline`/`block`/`all` choose the axes.
    const block = compensation ? compensation === 'block' || compensation === 'all' : showClose;
    const inline = compensation ? compensation === 'inline' || compensation === 'all' : showClose;
    const hasEnd = showClose || this.#slots.has('end');
    return html`<div class="header" part="header">
      <div class="start" part="start" ?hidden=${!this.#slots.has('start')}>
        <slot name="start"></slot>
      </div>
      <div class="title-block" part="title-block">
        <slot name="title"></slot>
        ${
          this.subtitle
            ? html`<span class="subtitle" part="subtitle">${this.subtitle}</span>`
            : nothing
        }
      </div>
      <div
        class="end"
        part="end"
        ?hidden=${!hasEnd}
        ?data-compensate-block=${block}
        ?data-compensate-inline=${inline}
      >
        <slot name="end"></slot>
        ${
          showClose
            ? html`<tct-button
                class="close"
                part="close-button"
                variant="ghost"
                size="md"
                icon="close"
                icon-only
                label=${closeLabel}
                @click=${this.#onClose}
              ></tct-button>`
            : nothing
        }
      </div>
    </div>`;
  }

  readonly #onClose = (): void => {
    const dialog = this.#dialog.value;
    // Inside a dialog it asks the dialog (which raises its own tct-open-change); alone, the header does.
    if (dialog) dialog.requestClose('close-button');
    else this.dispatch(new TctOpenChangeEvent(false, 'close-button'));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dialog-header': TctDialogHeader;
  }
}

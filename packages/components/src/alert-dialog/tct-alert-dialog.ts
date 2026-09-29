import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {MediaQueryController} from '@tecton-wc/core/controllers/media-query.js';
import {TctActionEvent} from '@tecton-wc/core/events/tct-action.js';
import type {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import defaultMessages from '@tecton-wc/locales/en/alertDialog.js';
import {BUTTON_VARIANTS, type ButtonVariant} from '../button/button.types.js';
import {TctButton} from '../button/tct-button.js';
import {TctDialog} from '../dialog/tct-dialog.js';
import {lengthConverter, oneOf} from '../field/field-utils.js';
import {TctHeading} from '../heading/tct-heading.js';
import base from '../styles/base.styles.css';
import {TctText} from '../text/tct-text.js';
import styles from './tct-alert-dialog.styles.css';

/** Below this width the actions stack, the destructive one first (upstream `SMALL_SCREEN_QUERY`). */
const SMALL_SCREEN_QUERY = '(max-width: 640px)';

/**
 * A confirmation dialog for destructive or irreversible actions, on the WAI-ARIA alert dialog pattern:
 * `role="alertdialog"`, the heading names it, the description describes it, focus goes to Cancel (the
 * least destructive choice) and back to the opener when it closes. It cannot be dismissed by a press
 * outside; Escape and Cancel ask to close it with the cancelable `tct-open-change` (reason `escape` or
 * `close-button`), and the action button raises `tct-action` without closing anything: close it yourself
 * (`open = false`) when the work is done, and hold it open with `action-loading` until then.
 *
 * Above 640px the actions sit side by side; at 640px and below the destructive action is above Cancel
 * (visually and in the tab order) and both fill the width. Give the action a specific label ("Delete
 * project"), and say in the description what will happen. For a non-destructive question use `tct-dialog`.
 * Without markup, use `openAlertDialog()` from `@tecton-wc/components/alert-dialog/alert-dialog.api.js`.
 *
 * It is a `tct-dialog` (`purpose="form"` with `alert`: Escape asks to close, a press on the backdrop never
 * does, and the role is `alertdialog`) with the content and the footer of a confirmation. Escape and
 * platform close requests go through the dialog's own layer, so nested layers close one per press.
 * [mwg:platform-controls-dismiss-dialog] [mwg:light-dismiss-a-dialog]
 *
 * @summary A modal confirmation dialog for destructive or irreversible actions.
 * @tag tct-alert-dialog
 * @upstream AlertDialog
 * @slot - Optional extra content under the description (a "do not ask again" checkbox).
 * @csspart dialog - The `tct-dialog` element.
 * @csspart content - The heading, description and extra content.
 * @csspart footer - The Cancel and action buttons.
 * @cssstate open - The dialog is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Escape or Cancel asks to close it (reason `escape` or `close-button`); cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - An open or close settled, after the animation; every actual change.
 * @fires {TctActionEvent} tct-action - The user activated the action button. The dialog stays open.
 * @cloakDisplay contents
 */
export class TctAlertDialog extends TctElement {
  static override readonly tagName = 'tct-alert-dialog';
  static override readonly dependencies = [TctDialog, TctButton, TctHeading, TctText];
  static override styles: CSSResultGroup = [base, styles];

  /** Whether the dialog is open. Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;

  /** Renders the content inline, without the modal behaviour (a documentation preview; it is a `group`, not an alertdialog). */
  @property({type: Boolean, reflect: true}) inline = false;

  /** The question, as a level-2 heading; it names the dialog. (Upstream `title`.) */
  @property() heading = '';

  /** What will happen if the user confirms; it describes the dialog. */
  @property() description = '';

  /** Label of the Cancel button. Default: the localized "Cancel". */
  @property({attribute: 'cancel-label'}) cancelLabel: string | undefined;

  /** Label of the action button. Make it specific: "Delete project", not "OK". */
  @property({attribute: 'action-label'}) actionLabel = '';

  /** Variant of the action button: `destructive` (default), or any button variant. */
  @property({attribute: 'action-variant'}) actionVariant: ButtonVariant = 'destructive';

  /** Shows the spinner on the action button and blocks it; hold the dialog open with it until the work settles. */
  @property({type: Boolean, reflect: true, attribute: 'action-loading'}) actionLoading = false;

  /** Preferred width; a number is px, a string a CSS length. Clamped to the viewport by the dialog. Default 400. */
  @property({converter: lengthConverter}) width: number | string = 400;

  /** Opens the dialog without an intent event; resolves once the entry animation settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#dialog?.show();
  }

  /** Closes the dialog without an intent event; resolves once it is hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#dialog?.hide();
  }

  /** Opens or closes it (`force` picks the state) without an intent event. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: fires the cancelable `tct-open-change` and closes unless it is prevented. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (!this.open) return;
    if (this.dispatch(new TctOpenChangeEvent(false, reason))) this.open = false;
  }

  // -------------------------------------------------------------------------------- internals

  readonly #titleId = uniqueId('tct-alert-title');
  readonly #descriptionId = uniqueId('tct-alert-description');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'alertDialog',
    defaults: defaultMessages,
  });
  readonly #compact = new MediaQueryController(this, SMALL_SCREEN_QUERY);

  get #dialog(): TctDialog | null {
    return this.renderRoot.querySelector<TctDialog>('tct-dialog');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('actionVariant') && !BUTTON_VARIANTS.includes(this.actionVariant)) {
      devWarn(
        'tct-alert-dialog:variant',
        `Invalid action-variant "${this.actionVariant}"; falling back to destructive.`,
      );
    }
  }

  protected override updated(): void {
    this.toggleState('open', this.open && !this.inline);
    if (this.open && !this.inline) {
      if (!this.heading || !this.description || !this.actionLabel) {
        devWarn(
          'tct-alert-dialog:content',
          'tct-alert-dialog needs a `heading`, a `description` and an `action-label`.',
        );
      }
    }
  }

  /**
   * The inner dialog asked to close (Escape, or a platform close request): the intent event it raised
   * already bubbles out of this element (composed), so the owner can cancel it there. The state follows
   * once every listener has run, unless one prevented it.
   */
  readonly #onOpenChange = (event: TctOpenChangeEvent): void => {
    if (event.target !== this.#dialog || event.open) return;
    queueMicrotask(() => {
      if (!event.defaultPrevented) this.open = false;
    });
  };

  readonly #onCancel = (): void => {
    this.requestClose('close-button');
  };

  readonly #onAction = (): void => {
    this.dispatch(new TctActionEvent());
  };

  /** The inner dialog closed by itself (a native close): the state follows. */
  readonly #onAfterOpenChange = (event: TctAfterOpenChangeEvent): void => {
    const dialog = this.#dialog;
    if (event.target !== dialog || event.open || !dialog) return;
    if (!this.isUpdatePending && this.open && !dialog.open) this.open = false;
  };

  override render() {
    const compact = this.#compact.matches;
    const variant = oneOf(this.actionVariant, BUTTON_VARIANTS, 'destructive');
    const cancelLabel = this.cancelLabel ?? this.#locale.t('cancel', undefined, 'cancel-label');
    // Dialog focuses `data-autofocus` itself once it is showing: Cancel, the least destructive action,
    // stays the target even when the narrow order puts the destructive action above it.
    const cancel = html`<tct-button
      class="action"
      variant="ghost"
      label=${cancelLabel}
      data-autofocus
      @click=${this.#onCancel}
    ></tct-button>`;
    const action = html`<tct-button
      class="action"
      variant=${variant}
      label=${this.actionLabel}
      ?loading=${this.actionLoading}
      @click=${this.#onAction}
    ></tct-button>`;
    return html`<tct-dialog
      part="dialog"
      purpose="form"
      alert
      .open=${this.open}
      .inline=${this.inline}
      .width=${this.width}
      aria-labelledby=${this.#titleId}
      aria-describedby=${this.#descriptionId}
      @tct-open-change=${this.#onOpenChange}
      @tct-after-open-change=${this.#onAfterOpenChange}
    >
      <div
        class="content"
        part="content"
        role=${this.inline ? 'group' : nothing}
        aria-labelledby=${this.inline ? this.#titleId : nothing}
        aria-describedby=${this.inline ? this.#descriptionId : nothing}
      >
        <tct-heading level="2" id=${this.#titleId}>${this.heading}</tct-heading>
        <tct-text type="body" color="secondary" display="block" id=${this.#descriptionId}
          >${this.description}</tct-text
        >
        <slot></slot>
      </div>
      <div class="footer" part="footer" ?data-compact=${compact}>
        ${compact ? [action, cancel] : [cancel, action]}
      </div>
    </tct-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-alert-dialog': TctAlertDialog;
  }
}

import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import fileInputMessages from '@tecton-wc/locales/en/fileInput.js';
import inputMessages from '@tecton-wc/locales/en/input.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {TctClearEvent} from '@tecton-wc/core/events/tct-clear.js';
import {requiredValidator} from '@tecton-wc/core/forms/validators.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import type {FormValue, Validator} from '@tecton-wc/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import type {InputStatus} from '../field/field.types.js';
import {oneOf, NESTED_INTERACTIVE} from '../field/field-utils.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import {
  FILE_INPUT_MODES,
  acceptsFile,
  formatFileSize,
  type FileInputMode,
} from './file-input.types.js';
import styles from './tct-file-input.styles.css';

/** Files, or a `FileList`, or nothing: what the `files` property accepts. */
type FileSource = Iterable<File> | ArrayLike<File> | null | undefined;

/**
 * A file picker with its label, description and status: attachments, résumés, images. It is a form-associated
 * element that submits the chosen files in the form's `FormData` (one entry per file under `name`), like a
 * native `<input type="file">`. Two modes: `input` is a compact field that shows the chosen names, and
 * `dropzone` is a larger surface with a dashed border that also takes files dropped onto it.
 *
 * The visible surface is a real, visually hidden button that carries the role, name and ARIA (the name is
 * the label followed by the chosen file names), so the field is reached with Tab and opened with Enter or
 * Space; a hidden native file input opens the picker. `accept`, `max-size` and `max-files` are checked when
 * files are chosen or dropped: files that do not fit are left out and the reason shows as an error status.
 * `input` and `change` fire after every choice and removal, never for property writes; set `files` to
 * control it. `changeAction` receives the files and keeps the field busy while it uploads.
 * [mwg:form-associated-custom-elements] [mwg:accessible-web-components] [mwg:accessible-error-announcement]
 *
 * @summary File picker with input and dropzone modes, drag and drop, and validation of type, size and count.
 * @tag tct-file-input
 * @upstream FileInput
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the surface.
 * @csspart surface - The clickable surface inside the box.
 * @csspart control - The visually hidden button that carries the role, name and state.
 * @csspart icon - The upload icon.
 * @csspart text - The placeholder or the chosen file names.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a change, a submit attempt or `reportValidity()`, and at once for rejected files).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - `loading` is set or a `changeAction` is pending.
 * @cssstate dragover - Files are being dragged over the dropzone.
 * @fires input - Native, after files were chosen, dropped or removed by the user; composed.
 * @fires change - Native, once after `input`; composed and dispatched from the host.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the files.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctFileInput extends TctBoxControl {
  static override readonly tagName = 'tct-file-input';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctBoxControl.dependencies,
    TctInputClearButton,
  ];
  static override styles: CSSResultGroup = [TctBoxControl.styles, styles];

  /** Accepted types, in the `accept` attribute format: `image/*`, `.pdf,.doc`, `image/png,image/jpeg`. */
  @property() accept = '';

  /** Lets more than one file be chosen; `files` then holds all of them. */
  @property({type: Boolean, reflect: true}) multiple = false;

  /** Largest size of one file in bytes; a larger file is left out with an error status. */
  @property({type: Number, attribute: 'max-size'}) maxSize: number | undefined;

  /** With `multiple`, the largest number of files; the rest are left out with an error status. */
  @property({type: Number, attribute: 'max-files'}) maxFiles: number | undefined;

  /** `input` is a compact field; `dropzone` is a larger surface that also takes dropped files. */
  @property({reflect: true}) mode: FileInputMode = 'input';

  /**
   * Async action run after files were chosen or removed by the user, with the files. While its promise is
   * pending the field is busy (`:state(busy)`, a spinner and `aria-busy`).
   */
  @property({attribute: false}) changeAction:
    ((files: File[], event: Event) => void | Promise<void>) | undefined;

  /**
   * The chosen files (empty for none). Setting it replaces them without events or validation, like setting
   * `files` on a native file input; reads give a copy.
   */
  @property({attribute: false})
  get files(): File[] {
    return [...this.#files];
  }
  set files(value: FileSource) {
    this.#files = value ? Array.from(value) : [];
    this.#error = null;
    this.requestUpdate();
  }

  /**
   * The native `value` of a file input: the first file's name behind a fake path, or `""`. Only `""` can be
   * assigned (it clears the files).
   */
  @property({attribute: false})
  override get value(): string {
    const first = this.#files[0];
    return first ? `C:\\fakepath\\${first.name}` : '';
  }
  override set value(value: string) {
    if (value === '' || value === null || value === undefined) this.files = null;
    else {
      devWarn(
        'file-input:value',
        'A file input\u2019s value can only be set to an empty string; set `files` instead.',
      );
    }
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'fileInput',
    defaults: {...fileInputMessages, ...inputMessages},
  });
  #files: File[] = [];
  #error: string | null = null;
  #dragDepth = 0;

  // ------------------------------------------------------------------------------ mixin hooks

  /** The visually hidden button: the focus target, the label target and the ARIA carrier. */
  protected override get formControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('button.trigger');
  }

  /**
   * Every chosen file is one entry under `name`. With none chosen there is no entry at all (a native input
   * submits one empty file; a missing field is easier for a server to tell from a chosen one).
   */
  protected override formValue(): FormValue {
    if (!this.name || this.#files.length === 0) return null;
    const data = new FormData();
    for (const file of this.#files) data.append(this.name, file);
    return data;
  }

  /** A restored `File` or `FormData` state brings its files back (browsers that keep file state). */
  protected override formRestoreState(state: FormValue): void {
    if (state instanceof File) this.files = [state];
    else if (state instanceof FormData) {
      this.files = [...state.values()].filter((entry): entry is File => entry instanceof File);
    }
  }

  protected override formResetValue(): void {
    this.#files = [];
    this.#error = null;
    super.formResetValue();
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) =>
        field.required && !field.optional
          ? requiredValidator<TctFileInput>((input) => input.#files.length === 0, 'file')(field)
          : null,
    ];
  }

  /** Rejected files show as an error status and `aria-invalid`, without blocking the form. */
  override get showInvalid(): boolean {
    return super.showInvalid || this.#error !== null;
  }

  protected override get effectiveStatus(): InputStatus | undefined {
    if (!this.statusType && this.#error !== null) return {type: 'error', message: this.#error};
    return super.effectiveStatus;
  }

  protected override get helperIds(): string[] {
    return [...super.helperIds, this.ids.id('required')];
  }

  /** Focuses the button that carries the field. */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** Opens the file picker (as the click on the field does). Not while disabled or read-only. */
  showPicker(): void {
    if (this.isDisabled || this.readonly || this.busy) return;
    this.renderRoot.querySelector<HTMLInputElement>('input.native')?.click();
  }

  // ---------------------------------------------------------------------------------- derived

  get #names(): string {
    return this.#files.map((file) => file.name).join(', ');
  }

  get #blocked(): boolean {
    return this.isDisabled || this.readonly;
  }

  /** The chosen files are shown as required by text, since `aria-required` is not defined for a button. */
  get #conveysRequired(): boolean {
    return (this.required && !this.optional) || (!this.required && this.announcesRequired);
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('mode') && !FILE_INPUT_MODES.includes(this.mode)) {
      devWarn(
        `file-input:mode:${this.mode}`,
        `mode "${this.mode}" is not one of ${FILE_INPUT_MODES.join(', ')}.`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleAttribute('data-dragover', this.#dragDepth > 0);
    this.toggleState('dragover', this.#dragDepth > 0);
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    return this.renderFieldLayout(this.renderBoxWrapper(this.#renderSurface()));
  }

  protected override renderHelpers(): TemplateResult {
    return html`${super.renderHelpers()}${
      this.#conveysRequired
        ? html`<span class="visually-hidden" id=${this.ids.id('required')}
            >${this.#locale.t('@tct.fileInput.required')}</span
          >`
        : nothing
    }`;
  }

  get #placeholder(): string {
    return (
      this.placeholder ||
      this.#locale.t(
        this.multiple ? '@tct.fileInput.placeholderMultiple' : '@tct.fileInput.placeholder',
      )
    );
  }

  #renderSurface(): TemplateResult {
    const inert = this.showsDisabledMessage;
    const disabled = this.isDisabled;
    const hasFiles = this.#files.length > 0;
    const status = this.effectiveStatus;
    const mode = oneOf(this.mode, FILE_INPUT_MODES, 'input');
    const label = hasFiles
      ? this.#locale.t('@tct.fileInput.triggerWithFiles', {
          label: this.label,
          fileNames: this.#names,
        })
      : this.label;
    return html`<div
      class="surface"
      part="surface"
      data-mode=${mode}
      @click=${this.#onSurfaceClick}
      @dragenter=${this.#onDragEnter}
      @dragover=${this.#onDragOver}
      @dragleave=${this.#onDragLeave}
      @drop=${this.#onDrop}
    >
      <button
        type="button"
        class="trigger visually-hidden"
        part="control"
        ?disabled=${disabled && !inert}
        tabindex=${disabled && !inert ? -1 : 0}
        aria-disabled=${ifDefined(inert ? 'true' : undefined)}
        aria-label=${label}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        @click=${this.#onTriggerClick}
      ></button>
      <input
        class="native visually-hidden"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        ?multiple=${this.multiple}
        accept=${ifDefined(this.accept || undefined)}
        ?disabled=${disabled}
        @input=${this.#stopNativeInput}
        @change=${this.#onPick}
      />
      ${mode === 'dropzone' ? this.#renderDropzoneContent(hasFiles) : this.#renderCompactContent(hasFiles, status)}
      ${
        hasFiles && !disabled && !this.busy && !this.readonly
          ? html`<tct-input-clear-button
              label=${this.#locale.t('@tct.fileInput.clearLabel', {label: this.label})}
              @click=${this.#onClear}
            ></tct-input-clear-button>`
          : nothing
      }
    </div>`;
  }

  #renderDropzoneContent(hasFiles: boolean): TemplateResult {
    if (this.busy)
      return html`<tct-spinner size="md" part="spinner" aria-hidden="true"></tct-spinner>`;
    if (hasFiles) return html`<div class="text names" part="text">${this.#names}</div>`;
    return html`<tct-icon
        class="icon"
        part="icon"
        name="arrowUp"
        size="md"
        color="secondary"
      ></tct-icon>
      <span class="text placeholder" part="text"
        >${this.#dragDepth > 0 ? this.#locale.t('@tct.fileInput.dropHint') : this.#placeholder}</span
      >`;
  }

  #renderCompactContent(hasFiles: boolean, status: InputStatus | undefined): TemplateResult {
    const text = hasFiles ? this.#names : this.#placeholder;
    return html`<tct-icon
        class="icon"
        part="icon"
        name="arrowUp"
        size="sm"
        color="secondary"
      ></tct-icon>
      <span class="text ${hasFiles ? 'names' : 'placeholder'}" part="text">${text}</span>
      ${this.renderBusy()}${status ? this.renderStatusIcon() : nothing}`;
  }

  // ---------------------------------------------------------------------------------- events

  /** Enter and Space on the button (and a label click) fire a native click: open the picker. */
  readonly #onTriggerClick = (): void => {
    this.showPicker();
  };

  /** The surface is one big button: a click on it (not on the clear or status buttons) opens the picker. */
  readonly #onSurfaceClick = (event: MouseEvent): void => {
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest(NESTED_INTERACTIVE)) return;
    this.showPicker();
    this.formControl?.focus();
  };

  /** The picker input's own `input` event is not the field's: the field fires one after validating. */
  readonly #stopNativeInput = (event: Event): void => {
    event.stopPropagation();
  };

  readonly #onPick = (event: Event): void => {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    // Cleared so choosing the same file again fires again.
    input.value = '';
    this.#accept(chosen, event);
  };

  #hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  readonly #onDragEnter = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (this.#blocked || this.mode !== 'dropzone' || !this.#hasFiles(event)) return;
    this.#dragDepth++;
    this.requestUpdate();
  };

  readonly #onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.#blocked || this.mode !== 'dropzone' ? 'none' : 'copy';
    }
    if (this.#blocked || this.mode !== 'dropzone') return;
    if (this.#dragDepth === 0 && this.#hasFiles(event)) {
      this.#dragDepth = 1;
      this.requestUpdate();
    }
  };

  /** Moving over the surface's own children fires dragleave on it too: only a leave that exits ends it. */
  readonly #onDragLeave = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget as Node).contains(next)) return;
    if (this.#dragDepth === 0) return;
    this.#dragDepth = 0;
    this.requestUpdate();
  };

  readonly #onDrop = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.#dragDepth = 0;
    this.requestUpdate();
    if (this.#blocked || this.busy || this.mode !== 'dropzone') return;
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length > 0) this.#accept(dropped, event);
  };

  readonly #onClear = (event: MouseEvent): void => {
    event.stopPropagation();
    if (!this.dispatch(new TctClearEvent())) return;
    this.#error = null;
    this.#setFiles([], event);
    const trigger = this.formControl;
    if (!trigger) return;
    // Keyboard: focus is restored synchronously, before the button leaves the DOM. Pointer: after the
    // button's own task, so touch browsers do not jump the page scroll (iOS Safari).
    if (event.detail === 0) trigger.focus();
    else requestAnimationFrame(() => this.formControl?.focus({preventScroll: true}));
  };

  // ---------------------------------------------------------------------- validation and commit

  /** Checks type, size and count; the files that pass become the value and the first reason is the error. */
  #accept(chosen: File[], event: Event): void {
    if (this.#blocked) return;
    const errors: string[] = [];
    let valid = chosen;

    if (this.accept) {
      valid = valid.filter((file) => {
        if (acceptsFile(file, this.accept)) return true;
        errors.push(this.#locale.t('@tct.fileInput.errorInvalidType', {fileName: file.name}));
        return false;
      });
    }
    if (this.maxSize !== undefined && Number.isFinite(this.maxSize)) {
      const limit = this.maxSize;
      valid = valid.filter((file) => {
        if (file.size <= limit) return true;
        errors.push(
          this.#locale.t('@tct.fileInput.errorMaxSize', {
            fileName: file.name,
            maxSize: formatFileSize(limit, this.#locale.locale),
          }),
        );
        return false;
      });
    }
    if (
      this.multiple &&
      this.maxFiles !== undefined &&
      Number.isFinite(this.maxFiles) &&
      valid.length > this.maxFiles
    ) {
      errors.push(this.#locale.t('@tct.fileInput.errorMaxFiles', {maxFiles: this.maxFiles}));
      valid = valid.slice(0, this.maxFiles);
    }
    if (!this.multiple) valid = valid.slice(0, 1);

    this.#error = errors[0] ?? null;
    // A polite confirmation of what was attached; the error status announces itself.
    if (errors.length === 0 && valid.length > 0) {
      announce(
        valid.length === 1
          ? this.#locale.t('@tct.fileInput.fileSelected', {fileName: valid[0]?.name ?? ''})
          : this.#locale.t('@tct.fileInput.filesSelected', {count: valid.length}),
        {element: this},
      );
    }
    this.#setFiles(valid, event);
  }

  /** Replaces the files for the user: `input`, then `change`, then the change action. */
  #setFiles(next: File[], event: Event): void {
    const same =
      next.length === this.#files.length && next.every((file, i) => file === this.#files[i]);
    this.#files = next;
    this.syncFormState();
    this.requestUpdate();
    if (same) return;
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action([...next], event));
    if (!settled) return;
    void settled.then(() => {
      this.settleAction();
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-file-input': TctFileInput;
  }
}

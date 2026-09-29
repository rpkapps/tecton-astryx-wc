/**
 * Field chrome (A§9.8): the label, description and status of a form control, and the ARIA wiring
 * between them and the control.
 *
 * **Shadow mode** (default): `<label for>` (or a `<span>` group caption), description and status are
 * rendered in the control's own shadow root next to the native control, so every id relationship
 * stays inside one tree. `renderLabel/Description/Status()` return the templates; the controller
 * writes `aria-describedby` on the control and gives it an id for `label for`.
 *
 * **Light mode** (slotted-input mode of `tct-text-input`, and `tct-field` around an arbitrary
 * control): the chrome is rendered as owned light-DOM satellites (A§8.2) assigned to the host's
 * `label`, `description` and `status` slots, and wired with `aria-labelledby`/`aria-describedby`
 * ids in the light tree, where the author's control lives. Clicking a label satellite focuses the
 * control (the platform does that for a real `<label>`).
 *
 * The status message is announced through the Announcer, once when it appears or changes, never
 * through a `role=alert` bound to a live message (`[mwg:accessible-error-announcement]`).
 *
 * Markup contract for styling: `part="label|description|status|label-indicator"`, `data-hidden`,
 * `data-disabled`, `data-status-type="error|warning|success|info"`.
 * Guides: [mwg:required-field-feedback]
 */
import {html, nothing, type ReactiveController, type TemplateResult} from 'lit';
import fieldMessages from '@tecton-astryx/locales/en/field.js';
import {announce} from '../a11y/announcer.js';
import {VISUALLY_HIDDEN_STYLE} from '../a11y/visually-hidden.js';
import {ContextConsumer} from '../context/protocol.js';
import {formLayoutContext, type ElementSize} from '../context/keys.js';
import {LocaleController} from '../i18n/locale-controller.js';
import type {TctElement} from '../tct-element.js';
import {IdController} from '../utils/id.js';
import {OwnedPartsController} from './owned-parts.js';

export interface FieldChromeState {
  label: string;
  labelHidden: boolean;
  description?: string;
  status?: {type: 'error' | 'warning' | 'success' | 'info'; message?: string};
  statusVariant: 'attached' | 'detached' | 'tooltip';
  required: boolean;
  optional: boolean;
  disabled: boolean;
  size: ElementSize;
  /** The field names a group of controls: the caption is a `<span>` and the group takes `aria-labelledby`. */
  groupLabel?: boolean;
}

export interface FieldChromeOptions {
  /** `shadow`: templates in the control's shadow root; `light`: satellites (slotted control, `tct-field`). */
  mode: () => 'shadow' | 'light';
  /** The element that receives `aria-describedby` (and `aria-labelledby` in light or group mode). */
  control: () => HTMLElement | null;
  state: () => FieldChromeState;
  /** Satellite tags for light mode (registered by the component's `dependencies`). */
  tags?: {label?: string; description?: string; status?: string};
  /**
   * Author-chosen ids for the label, description and status elements (upstream `labelID`,
   * `descriptionID`, `messageID`). An empty result falls back to the generated id.
   */
  ids?: {
    label?: () => string | undefined;
    description?: () => string | undefined;
    status?: () => string | undefined;
  };
}

type PartName = 'label' | 'description' | 'status';

export class FieldChromeController implements ReactiveController {
  readonly #host: TctElement;
  readonly #options: FieldChromeOptions;
  readonly #ids: IdController;
  readonly #locale: LocaleController;
  readonly #layout: ContextConsumer<typeof formLayoutContext>;
  readonly #parts: OwnedPartsController;
  #announced = '';
  /** Tokens this controller put into aria-describedby / aria-labelledby, to remove them later. */
  readonly #managed = {describedby: new Set<string>(), labelledby: new Set<string>()};

  constructor(host: TctElement, options: FieldChromeOptions) {
    this.#host = host;
    this.#options = options;
    this.#ids = new IdController(host, 'tct-field');
    this.#locale = new LocaleController(host, {namespace: 'field', defaults: fieldMessages});
    this.#layout = new ContextConsumer(host, {context: formLayoutContext, subscribe: true});
    const tags = options.tags ?? {};
    this.#parts = new OwnedPartsController(host, {
      parts: (['label', 'description', 'status'] as const).map((name) => ({
        slot: name,
        tag: tags[name] ?? `tct-field-${name}`,
        when: () => options.mode() === 'light' && this.#has(name),
        init: (element: HTMLElement) => {
          this.#fillSatellite(name, element);
        },
      })),
    });
    host.addController(this);
  }

  /** The light-mode satellite for `name`, or `undefined` in shadow mode / while absent. */
  satellite(name: PartName): HTMLElement | undefined {
    return this.#parts.get(name);
  }

  /** Id of the label element. */
  get labelId(): string {
    return this.#options.ids?.label?.() || this.#ids.id('label');
  }
  /** Id of the description element. */
  get descriptionId(): string {
    return this.#options.ids?.description?.() || this.#ids.id('description');
  }
  /** Id of the status element. */
  get statusId(): string {
    return this.#options.ids?.status?.() || this.#ids.id('status');
  }
  /** Id given to the control in shadow mode (target of `label for`). */
  get controlId(): string {
    return this.#ids.id('control');
  }

  // ------------------------------------------------------------------------------ templates

  /** Shadow mode: the label (or group caption) with the required/optional indicator. */
  renderLabel(): TemplateResult {
    const state = this.#options.state();
    if (this.#options.mode() === 'light' || !state.label) return html``;
    const indicator = this.#indicator(state);
    const content = html`${state.label}${
      indicator
        ? html`<span part="label-indicator"><span aria-hidden="true"> ∙ </span>${indicator}</span>`
        : nothing
    }`;
    const hiddenStyle = state.labelHidden ? VISUALLY_HIDDEN_STYLE : nothing;
    return state.groupLabel
      ? html`<span
          id=${this.labelId}
          part="label"
          style=${hiddenStyle}
          ?data-hidden=${state.labelHidden}
          ?data-disabled=${state.disabled}
          >${content}</span
        >`
      : html`<label
          id=${this.labelId}
          for=${this.#options.control()?.id || this.controlId}
          part="label"
          style=${hiddenStyle}
          ?data-hidden=${state.labelHidden}
          ?data-disabled=${state.disabled}
          >${content}</label
        >`;
  }

  /** Shadow mode: the description, kept in the DOM (visually hidden with a hidden label) so `aria-describedby` works. */
  renderDescription(): TemplateResult {
    const state = this.#options.state();
    if (this.#options.mode() === 'light' || !state.description) return html``;
    return html`<div
      id=${this.descriptionId}
      part="description"
      style=${state.labelHidden ? VISUALLY_HIDDEN_STYLE : nothing}
      ?data-hidden=${state.labelHidden}
    >
      ${state.description}
    </div>`;
  }

  /** Shadow mode: the status message (not for the `tooltip` variant, where the control surfaces it). */
  renderStatus(): TemplateResult {
    const state = this.#options.state();
    if (this.#options.mode() === 'light' || !this.#hasStatus(state)) return html``;
    return html`<div id=${this.statusId} part="status" data-status-type=${state.status!.type}>
      ${state.status!.message}
    </div>`;
  }

  // ------------------------------------------------------------------------------- lifecycle

  hostUpdated(): void {
    this.#wireControl();
    this.#announceStatus();
  }

  hostDisconnected(): void {
    this.#announced = '';
  }

  // -------------------------------------------------------------------------------- internals

  #has(name: PartName): boolean {
    const state = this.#options.state();
    if (name === 'label') return Boolean(state.label);
    if (name === 'description') return Boolean(state.description);
    return this.#hasStatus(state);
  }

  #hasStatus(state: FieldChromeState): boolean {
    return Boolean(state.status?.message) && state.statusVariant !== 'tooltip';
  }

  /** "Required" / "Optional" only when it differs from the form's default (only the exception is marked). */
  #indicator(state: FieldChromeState): string | null {
    const defaultOptionality = this.#layout.value?.optionality;
    if (state.optional && defaultOptionality !== 'optional') return this.#locale.t('optional');
    if (state.required && defaultOptionality !== 'required') return this.#locale.t('required');
    return null;
  }

  #fillSatellite(name: PartName, element: HTMLElement): void {
    const state = this.#options.state();
    const text =
      name === 'label'
        ? state.label
        : name === 'description'
          ? (state.description ?? '')
          : (state.status?.message ?? '');
    element.id =
      name === 'label' ? this.labelId : name === 'description' ? this.descriptionId : this.statusId;
    element.setAttribute('data-part', name);
    if (name === 'status') element.setAttribute('data-status-type', state.status?.type ?? 'info');
    if (name === 'label') {
      // The satellite renders the "Required"/"Optional" indicator itself (its text lives in its own
      // shadow root, next to the label text that stays in the light DOM).
      const indicator = this.#indicator(state);
      if (indicator) element.setAttribute('indicator', indicator);
      else element.removeAttribute('indicator');
      element.toggleAttribute('data-disabled', state.disabled);
      element.removeEventListener('click', this.#onLabelClick);
      element.addEventListener('click', this.#onLabelClick);
    }
    const hidden = state.labelHidden && name !== 'status';
    element.toggleAttribute('data-hidden', hidden);
    element.style.cssText = hidden ? VISUALLY_HIDDEN_STYLE : '';
    // Text in the light DOM so the satellite participates in accessible name computation.
    if (element.textContent !== text) element.textContent = text;
  }

  readonly #onLabelClick = (): void => {
    const state = this.#options.state();
    if (state.disabled) return;
    this.#options.control()?.focus();
  };

  /** Ids on the control: `aria-describedby` always; `aria-labelledby` in light or group mode; `id` for `label for`. */
  #wireControl(): void {
    const control = this.#options.control();
    if (!control) return;
    const state = this.#options.state();
    const light = this.#options.mode() === 'light';

    // `label for` needs an id in the control's own root; a control that already has one keeps it.
    if (!light && !state.groupLabel) control.id ||= this.controlId;

    this.#syncTokens(control, 'aria-describedby', this.#managed.describedby, [
      state.description ? this.descriptionId : undefined,
      this.#hasStatus(state) ? this.statusId : undefined,
    ]);
    this.#syncTokens(
      control,
      'aria-labelledby',
      this.#managed.labelledby,
      light || state.groupLabel ? [state.label ? this.labelId : undefined] : [],
    );
  }

  /** Adds our tokens and removes stale ones while keeping tokens the author or other components own. */
  #syncTokens(
    control: HTMLElement,
    attribute: 'aria-describedby' | 'aria-labelledby',
    managed: Set<string>,
    wanted: readonly (string | undefined)[],
  ): void {
    const next = new Set(wanted.filter((id): id is string => Boolean(id)));
    const current = (control.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
    const kept = current.filter((token) => !managed.has(token) || next.has(token));
    const merged = [...kept, ...[...next].filter((id) => !kept.includes(id))];
    managed.clear();
    for (const id of next) managed.add(id);
    if (merged.length > 0) {
      const value = merged.join(' ');
      if (control.getAttribute(attribute) !== value) control.setAttribute(attribute, value);
    } else if (control.hasAttribute(attribute) && current.length > 0) {
      control.removeAttribute(attribute);
    }
  }

  #announceStatus(): void {
    const message = this.#options.state().status?.message ?? '';
    if (!message) {
      this.#announced = '';
      return;
    }
    if (message === this.#announced) return;
    this.#announced = message;
    announce(message, {politeness: 'polite', element: this.#host});
  }
}

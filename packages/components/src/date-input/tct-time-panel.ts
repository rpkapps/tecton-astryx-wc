import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import dateTimeInputMessages from '@tecton-wc/locales/en/dateTimeInput.js';
import {parseISOTime, type ParsedTime} from '@tecton-wc/core/date/time-parser.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {
  buildTimeColumns,
  composeTime,
  type HourFormat,
  type TimeColumn,
  type TimeUnit,
} from './time-columns.js';
import styles from './tct-time-panel.styles.css';

const COLUMN_LABELS: Record<TimeUnit, string> = {
  hour: '@tct.dateTimeInput.hourWheel',
  minute: '@tct.dateTimeInput.minuteWheel',
  second: '@tct.dateTimeInput.secondWheel',
  meridiem: '@tct.dateTimeInput.meridiemWheel',
};

/**
 * The time columns of the touch pickers: one listbox each for the hour, the minute, the second (with
 * `has-seconds`) and AM/PM (in the 12-hour format). A pick commits at once, clamped into `min`..`max`, and
 * options no time in that window can produce are disabled. Arrow Up and Down move within a column and pick,
 * Home and End go to its ends, Tab moves to the next column. With no `value` the columns show the current
 * time, and the first pick composes it with the other columns.
 *
 * Internal: the bottom sheets of `tct-time-input` and `tct-date-time-input` render it; it is not part of the
 * public API.
 *
 * @internal
 * @summary Hour, minute, second and AM/PM columns for picking a time on touch devices.
 * @tag tct-time-panel
 * @csspart panel - The row of columns.
 * @csspart column - One listbox of options.
 * @csspart option - An option of a column; `aria-selected` marks the picked one.
 * @fires change - Native, after a pick changed `value`; composed.
 */
export class TctTimePanel extends TctElement {
  static override readonly tagName = 'tct-time-panel';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** The time, `HH:MM` or `HH:MM:SS`, or `""` (the columns then show the current time). */
  @property() value = '';

  /** Whether there is a column for seconds. */
  @property({type: Boolean, attribute: 'has-seconds'}) hasSeconds = false;

  /** `12h` (with an AM/PM column) or `24h`. */
  @property({attribute: 'hour-format'}) hourFormat: HourFormat = '12h';

  /** Earliest time, `HH:MM[:SS]`; picks are clamped to it. */
  @property() min: string | undefined;

  /** Latest time, `HH:MM[:SS]`; picks are clamped to it. */
  @property() max: string | undefined;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'dateTimeInput',
    defaults: dateTimeInputMessages,
  });
  #now: ParsedTime = TctTimePanel.#readClock();
  #scrollPending = true;

  static #readClock(): ParsedTime {
    const now = new Date();
    return {hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds()};
  }

  /** What the columns show: the value, else the time the panel opened at. */
  get #time(): ParsedTime {
    return (this.value ? parseISOTime(this.value) : null) ?? this.#now;
  }

  #numbers(): (value: number, pad: boolean) => string {
    let format: Intl.NumberFormat;
    try {
      format = new Intl.NumberFormat(this.#locale.locale, {useGrouping: false});
    } catch {
      format = new Intl.NumberFormat('en', {useGrouping: false});
    }
    return (value, pad) =>
      pad && value < 10 ? `${format.format(0)}${format.format(value)}` : format.format(value);
  }

  #columns(): TimeColumn[] {
    return buildTimeColumns({
      time: this.#time,
      hasSeconds: this.hasSeconds,
      hourFormat: this.hourFormat === '24h' ? '24h' : '12h',
      min: this.min,
      max: this.max,
      formatNumber: this.#numbers(),
      meridiemLabels: {
        am: this.#locale.t('@tct.dateTimeInput.meridiemAM'),
        pm: this.#locale.t('@tct.dateTimeInput.meridiemPM'),
      },
    });
  }

  /** Scrolls the selected option of every column into the middle of it (the columns are taller than the panel shows). */
  scrollToSelection(): void {
    for (const column of this.renderRoot.querySelectorAll<HTMLElement>('.column')) {
      const selected = column.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!selected) continue;
      column.scrollTop = selected.offsetTop - (column.clientHeight - selected.offsetHeight) / 2;
    }
  }

  /** Focuses the selected option of the first column. */
  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus(options);
  }

  protected override updated(): void {
    // Centred once, when the panel opens: a pick keeps the option under the pointer where it is.
    if (!this.#scrollPending) return;
    this.#scrollPending = false;
    this.scrollToSelection();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The panel is "now" from the moment it opens.
    this.#now = TctTimePanel.#readClock();
    this.#scrollPending = true;
  }

  #pick(unit: TimeUnit, value: number): void {
    const next = composeTime(this.#time, unit, value, {
      hasSeconds: this.hasSeconds,
      hourFormat: this.hourFormat === '24h' ? '24h' : '12h',
      min: this.min,
      max: this.max,
    });
    if (next === this.value) return;
    this.value = next;
    this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeyEvent(event) || event.altKey || event.ctrlKey || event.metaKey) return;
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    const column = option?.closest<HTMLElement>('[role="listbox"]');
    if (!option || !column) return;
    const options = [...column.querySelectorAll<HTMLElement>('[role="option"]')].filter(
      (element) => element.getAttribute('aria-disabled') !== 'true',
    );
    const index = options.indexOf(option);
    let target: HTMLElement | undefined;
    switch (event.key) {
      case 'ArrowUp':
        target = options[Math.max(0, index - 1)];
        break;
      case 'ArrowDown':
        target = options[Math.min(options.length - 1, index + 1)];
        break;
      case 'Home':
        target = options[0];
        break;
      case 'End':
        target = options[options.length - 1];
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.#pickElement(option);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (!target) return;
    target.focus();
    this.#pickElement(target);
  };

  #pickElement(option: HTMLElement): void {
    const unit = option.closest<HTMLElement>('[role="listbox"]')?.dataset.unit as TimeUnit;
    this.#pick(unit, Number(option.dataset.value));
  }

  readonly #onClick = (event: MouseEvent): void => {
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    this.#pickElement(option);
  };

  #renderColumn(column: TimeColumn): TemplateResult {
    return html`<div
      class="column"
      part="column"
      role="listbox"
      data-unit=${column.unit}
      aria-label=${this.#locale.t(COLUMN_LABELS[column.unit])}
    >
      ${repeat(
        column.options,
        (option) => option.value,
        (option) =>
          html`<div
            class="option"
            part="option"
            role="option"
            data-value=${option.value}
            tabindex=${option.value === column.selected ? '0' : '-1'}
            aria-selected=${option.value === column.selected ? 'true' : 'false'}
            aria-disabled=${option.disabled ? 'true' : nothing}
          >
            ${option.label}
          </div>`,
      )}
    </div>`;
  }

  override render(): TemplateResult {
    return html`<div class="panel" part="panel" @keydown=${this.#onKeyDown} @click=${this.#onClick}>
      ${this.#columns().map((column) => this.#renderColumn(column))}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-time-panel': TctTimePanel;
  }
}

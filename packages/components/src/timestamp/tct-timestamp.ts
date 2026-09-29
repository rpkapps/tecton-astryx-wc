import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import timestampMessages from '@tecton-wc/locales/en/timestamp.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {
  formatInstant,
  formatInstantLines,
  formatRelativeTime,
  liveInterval,
  type InstantLine,
} from '@tecton-wc/core/date/instant.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import type {TextColor, TextSize, TextType, TextWeight} from '../text/text.types.js';
import {TctText} from '../text/tct-text.js';
import {
  DEFAULT_AUTO_THRESHOLD,
  TIMESTAMP_FORMATS,
  type TimestampFormat,
  type TimestampTooltipEntry,
} from './timestamp.types.js';
import styles from './tct-timestamp.styles.css';

let cardElements: Promise<unknown> | undefined;

/** Loads (once) the hover card and the copy buttons, the first time a timestamp shows a card. */
function loadCardElements(): Promise<unknown> {
  cardElements ??= import('./timestamp-card.define.js');
  return cardElements;
}

/** How long the copy button shows its check before it goes back to the copy icon. */
const COPY_FEEDBACK_MS = 1500;

/** A number is Unix time (seconds until year 2286, else milliseconds); a numeric attribute reads as a number. */
const valueConverter = {
  fromAttribute(value: string | null): string | number | undefined {
    if (value === null) return undefined;
    const trimmed = value.trim();
    return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : value;
  },
};

/** The moment `value` names, or `null` when it names none. */
function parseValue(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const isRelative = (format: TimestampFormat): boolean =>
  format === 'relative' || format === 'relative_short';

/**
 * A moment in time as text: a semantic `<time>` with the ISO 8601 `datetime`, read in the viewer's own time
 * zone and language. `value` is an ISO 8601 string, or Unix time (a number of seconds, or of milliseconds from
 * 10^12 on); it is the instant itself, so it says nothing of a zone or a calendar: `datetime` is always UTC,
 * and the zone is a choice of the reading. `format` picks the reading: relative ("2 hours ago", or the compact
 * "2h ago"), `auto` (relative for the last week, then date and time), a date, a time, or a machine shape
 * (`system_date_time`, `unix_seconds`). A relative reading has the full date, with the zone spelled out, as its
 * accessible name and can update by itself (`live`).
 *
 * A relative timestamp, or one with `tooltipEntries`, has a hover card (also on keyboard focus: the `<time>` is a tab stop
 * then) that reads the instant in the zones and formats you list, each optionally copyable; with no entries
 * it is one copyable line with the full date and time. Absolute formats have no card unless entries are set.
 * A value that names no moment renders nothing. [mwg:coordinate-global-events]
 * [mwg:capture-location-agnostic-data] [mwg:format-human-readable-durations] [mwg:accessible-web-components]
 *
 * @summary A moment in time as a `<time>`: relative, absolute or machine-readable, with a copyable zone card.
 * @tag tct-timestamp
 * @upstream Timestamp
 * @csspart text - The `tct-text` wrapper that carries the typography.
 * @csspart time - The `<time>` element holding the reading.
 * @csspart card - The hover card (only when the timestamp has one).
 * @csspart details - The definition list inside the card.
 * @csspart label - A label in the card.
 * @csspart value - A value in the card.
 * @csspart action - The cell of the copy button of a line.
 * @csspart copy-button - The copy button of a copyable line.
 * @cssstate card - The timestamp has a hover card.
 * @cloakDisplay inline
 */
export class TctTimestamp extends TctElement {
  static override readonly tagName = 'tct-timestamp';
  static override readonly dependencies = [TctText];
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * The moment: an ISO 8601 string (`2026-02-19T17:00:00Z`; one with no offset reads in the viewer's zone) or
   * Unix time as a number (seconds, or milliseconds from 10^12 on). The attribute reads a numeric string as
   * a number. A value that is not a date renders nothing.
   */
  @property({converter: valueConverter}) value: string | number | undefined;

  /**
   * How it reads: `relative`, `relative_short`, `auto` (default), `date`, `date_long`, `date_weekday`,
   * `date_time`, `time`, `system_date`, `system_date_time`, `system_time` or `unix_seconds`.
   */
  @property({reflect: true}) format: TimestampFormat = 'auto';

  /** Seconds after which `auto` stops being relative and reads as `date_time`. Default seven days. */
  @property({type: Number, attribute: 'auto-threshold'}) autoThreshold = DEFAULT_AUTO_THRESHOLD;

  /** Turns the hover card off. It is on by default for relative readings, and for any reading with `tooltipEntries`. */
  @property({type: Boolean, attribute: 'no-tooltip'}) noTooltip = false;

  /**
   * The lines of the hover card, in order: `{timezoneID, format, label, isCopyable}` each. `timezoneID` is an IANA
   * zone (`UTC`, `America/Los_Angeles`; prefer regions over abbreviations such as `EST`, which never observe
   * daylight saving), `local` or omitted for the viewer's own; an unknown zone falls back to it with a warning.
   * `format` is any absolute format or `full` (default). An empty array counts as none.
   */
  @property({attribute: false}) tooltipEntries: readonly TimestampTooltipEntry[] | undefined;

  /** Appends the time zone abbreviation to `date_time` and `time` (never to the `system_*` shapes). Visible text only. */
  @property({type: Boolean, attribute: 'timezone-shown'}) timezoneShown = false;

  /** Updates a relative reading as time passes (every second for the first minute, then less often). */
  @property({type: Boolean}) live = false;

  /** Semantic text type of the wrapper, as `tct-text`. Default `supporting`; `inherit` matches the surrounding text. */
  @property({reflect: true}) type: TextType = 'supporting';

  /** Font size override, as `tct-text`. */
  @property({reflect: true}) size: TextSize | undefined;

  /** Text colour, as `tct-text`. Default `secondary`; `inherit` matches the surrounding text. */
  @property({reflect: true}) color: TextColor = 'secondary';

  /** Font weight override, as `tct-text`. */
  @property({reflect: true}) weight: TextWeight | undefined;

  /** The inner `<time>` element (the upstream ref). It exists after the first render of a valid value. */
  get timeElement(): HTMLTimeElement | null {
    return this.renderRoot.querySelector<HTMLTimeElement>('time');
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'timestamp',
    defaults: timestampMessages,
  });
  /** What "now" is for a relative reading: when it connected or its value changed, then each live tick. */
  #now = new Date();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #copied: number | null = null;
  #copyTimer: ReturnType<typeof setTimeout> | undefined;
  #cardReady = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#now = new Date();
    if (this.hasUpdated) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
    clearTimeout(this.#copyTimer);
    this.#timer = undefined;
  }

  // ------------------------------------------------------------------------------------ derived

  get #date(): Date | null {
    return parseValue(this.value);
  }

  get #effectiveFormat(): TimestampFormat {
    const format = (TIMESTAMP_FORMATS as readonly string[]).includes(this.format)
      ? this.format
      : 'auto';
    const date = this.#date;
    if (format !== 'auto' || !date) return format;
    const diff = Math.round((this.#now.getTime() - date.getTime()) / 1000);
    const threshold = Number.isFinite(this.autoThreshold)
      ? this.autoThreshold
      : DEFAULT_AUTO_THRESHOLD;
    return Math.abs(diff) <= threshold ? 'relative' : 'date_time';
  }

  #text(date: Date, format: TimestampFormat): string {
    const locale = this.#locale.locale;
    switch (format) {
      case 'relative':
        return formatRelativeTime(date, this.#now, locale, 'long');
      case 'relative_short':
        return formatRelativeTime(date, this.#now, locale, 'narrow');
      case 'auto':
        return '';
      default:
        return formatInstant(date, format, locale, {timezoneShown: this.timezoneShown});
    }
  }

  get #entries(): readonly TimestampTooltipEntry[] | undefined {
    const entries = this.tooltipEntries;
    return entries !== undefined && entries.length > 0 ? entries : undefined;
  }

  /** Whether a card is attached: relative readings have one; absolute readings only when entries ask for it. */
  #showsCard(format: TimestampFormat): boolean {
    return !this.noTooltip && (isRelative(format) || this.#entries !== undefined);
  }

  // ------------------------------------------------------------------------------------ lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') && changed.get('value') !== undefined) this.#now = new Date();
    if (changed.has('value') && this.value !== undefined && this.value !== '' && !this.#date) {
      devWarn(
        `timestamp:value:${String(this.value)}`,
        `<tct-timestamp value=${JSON.stringify(this.value)}> is not a date. Rendering nothing.`,
      );
    }
    if (changed.has('format') && !(TIMESTAMP_FORMATS as readonly string[]).includes(this.format)) {
      devWarn(
        `timestamp:format:${this.format}`,
        `<tct-timestamp format="${this.format}"> is not one of ${TIMESTAMP_FORMATS.join(', ')}; using "auto".`,
      );
    }
    const date = this.#date;
    if (date && this.#showsCard(this.#effectiveFormat) && !this.#cardReady) {
      void loadCardElements().then(() => {
        this.#cardReady = true;
        this.requestUpdate();
      });
    }
  }

  protected override updated(): void {
    this.toggleState('card', this.#cardReady && this.#showsCardNow);
    this.#scheduleLive();
  }

  get #showsCardNow(): boolean {
    return this.#date !== null && this.#showsCard(this.#effectiveFormat);
  }

  #scheduleLive(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    const date = this.#date;
    if (!this.live || !date || !isRelative(this.#effectiveFormat)) return;
    const diff = Math.round((this.#now.getTime() - date.getTime()) / 1000);
    this.#timer = setTimeout(() => {
      this.#now = new Date();
      this.requestUpdate();
    }, liveInterval(diff));
  }

  // -------------------------------------------------------------------------------------- copying

  #copy(line: InstantLine, index: number): void {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    void clipboard?.writeText(line.value).then(
      () => {
        this.#copied = index;
        this.requestUpdate();
        announce(this.#locale.t('@tct.timestamp.copied'), {element: this});
        clearTimeout(this.#copyTimer);
        this.#copyTimer = setTimeout(() => {
          this.#copied = null;
          this.requestUpdate();
        }, COPY_FEEDBACK_MS);
      },
      () => {
        // A refused write (no permission, no secure context) is a silent no-op.
      },
    );
  }

  /** The card's open events describe the card, not the timestamp: they stay inside. */
  readonly #stop = (event: Event): void => {
    event.stopPropagation();
  };

  // ---------------------------------------------------------------------------------- rendering

  override render(): TemplateResult | typeof nothing {
    const date = this.#date;
    if (!date) return nothing;
    const format = this.#effectiveFormat;
    const locale = this.#locale.locale;
    const label = isRelative(format)
      ? formatInstant(date, 'full', locale, {timeZoneNameStyle: 'long'})
      : undefined;
    const card = this.#showsCard(format) && this.#cardReady;
    const time = html`<tct-text
      part="text"
      type=${this.type}
      size=${ifDefined(this.size)}
      color=${this.color}
      weight=${ifDefined(this.weight)}
      ><time
        class="focus-ring"
        part="time"
        datetime=${date.toISOString()}
        aria-label=${ifDefined(label)}
        tabindex=${ifDefined(this.#showsCard(format) ? '0' : undefined)}
        >${this.#text(date, format)}</time
      ></tct-text
    >`;
    return card ? this.#renderCard(date, time) : time;
  }

  #renderCard(date: Date, trigger: TemplateResult): TemplateResult {
    const locale = this.#locale.locale;
    const entries = this.#entries;
    const lines: InstantLine[] =
      entries === undefined
        ? [{value: formatInstant(date, 'full', locale), isCopyable: true}]
        : formatInstantLines(date, entries, locale);
    const labelled = lines.some((line) => line.label !== undefined && line.label !== '');
    const actions = lines.some((line) => line.isCopyable);
    return html`<tct-hover-card
      class="card"
      part="card"
      placement="above"
      focus-trigger="always"
      hover-indication="always"
      label=${this.#locale.t('@tct.timestamp.detailsLabel')}
      @tct-open-change=${this.#stop}
      @tct-after-open-change=${this.#stop}
      >${trigger}
      <dl
        slot="content"
        class="details"
        part="details"
        data-columns=${labelled ? (actions ? 'label-value-action' : 'label-value') : actions ? 'value-action' : 'value'}
      >
        ${lines.map((line, index) => this.#renderLine(line, index, labelled, actions))}
      </dl></tct-hover-card
    >`;
  }

  #renderLine(
    line: InstantLine,
    index: number,
    labelled: boolean,
    actions: boolean,
  ): TemplateResult {
    const copied = this.#copied === index;
    return html`<div class="row">
      ${labelled ? html`<dt class="label" part="label">${line.label ?? ''}</dt>` : nothing}
      <dd class="value" part="value">${line.value}</dd>
      ${
        actions
          ? html`<dd class="action" part="action">
              ${
                line.isCopyable
                  ? html`<tct-icon-button
                      part="copy-button"
                      variant="ghost"
                      size="sm"
                      icon=${copied ? 'check' : 'copy'}
                      tooltip=${this.#locale.t(copied ? '@tct.timestamp.copied' : '@tct.timestamp.copy')}
                      label=${
                        copied
                          ? this.#locale.t('@tct.timestamp.copied')
                          : this.#locale.t('@tct.timestamp.copyValue', {value: line.value})
                      }
                      @click=${() => {
                        this.#copy(line, index);
                      }}
                    ></tct-icon-button>`
                  : nothing
              }
            </dd>`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-timestamp': TctTimestamp;
  }
}

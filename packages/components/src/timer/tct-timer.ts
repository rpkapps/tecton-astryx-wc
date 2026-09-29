import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import type {TextColor, TextSize, TextType, TextWeight} from '../text/text.types.js';
import {TctText} from '../text/tct-text.js';
import {
  millisecondsUntilNextChange,
  readDuration,
  type TimerPart,
  type TimerReading,
} from './timer.format.js';
import {TIMER_FORMATS, type TimerFormat} from './timer.types.js';
import styles from './tct-timer.styles.css';

/**
 * Elapsed time of an operation in progress, as a `<time>` that counts by itself. It writes the changing text
 * and its ISO 8601 `datetime` straight into its own `<time>` node: the element never re-renders as time
 * passes, and one timer wakes once per visible change (every second, or every minute once `elapsed` passes an
 * hour). The reading is always derived from the clock, so a busy or throttled tab catches up on the next tick.
 *
 * `elapsed` is compact (`34s`, `2m 08s`, `1h 02m`); `clock` is a stopwatch (`2:08`, `1:02:33`). Digits and unit
 * letters follow the language of the element (`Intl.NumberFormat`). It is plain text in the reading order and
 * is not a live region: put `aria-live` on the element if a change must be announced.
 *
 * Guides: [mwg:format-human-readable-durations] (units and padding come from `Intl.NumberFormat` unit style,
 * which keeps the zero-padded shape of the upstream format in every locale; `Intl.DurationFormat` does not
 * pad the leading unit consistently across engines) [mwg:styling-web-components] (parts, inherited type).
 *
 * @summary An elapsed-time readout that updates itself without re-rendering.
 * @tag tct-timer
 * @upstream Timer
 * @csspart text - The `tct-text` wrapper that carries the typography.
 * @csspart time - The `<time>` element holding the reading.
 * @cloakDisplay inline
 */
export class TctTimer extends TctElement {
  static override readonly tagName = 'tct-timer';
  static override readonly dependencies = [TctText];
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Unix time in milliseconds when the measured operation began. Omit it to count from the moment the
   * timer connects. A non-finite value counts as omitted; a start in the future reads zero until it arrives.
   */
  @property({type: Number, attribute: 'start-time'}) startTime: number | undefined;

  /** `elapsed` (default): compact units that drop the seconds after an hour. `clock`: `m:ss` or `h:mm:ss`. */
  @property({reflect: true}) format: TimerFormat = 'elapsed';

  /** Semantic text type of the wrapper, as `tct-text`. Default `supporting`; `inherit` matches the surrounding text. */
  @property({reflect: true}) type: TextType = 'supporting';

  /** Font size override, as `tct-text`. */
  @property({reflect: true}) size: TextSize | undefined;

  /** Text colour, as `tct-text`. Default `secondary`; `inherit` matches the surrounding text. */
  @property({reflect: true}) color: TextColor = 'secondary';

  /** Font weight override, as `tct-text`. */
  @property({reflect: true}) weight: TextWeight | undefined;

  readonly #locale = new LocaleController(this);
  #mountTime: number | undefined;
  #timeout: ReturnType<typeof setTimeout> | undefined;
  #shownText: string | undefined;
  #shownDateTime: string | undefined;

  /** The inner `<time>` element (the upstream ref). It exists after the first render. */
  get timeElement(): HTMLTimeElement | null {
    return this.renderRoot.querySelector<HTMLTimeElement>('time');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#mountTime ??= Date.now();
    if (this.hasUpdated) this.#restart();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stop();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('format') && !(TIMER_FORMATS as readonly string[]).includes(this.format)) {
      devWarn(
        `timer:format:${this.format}`,
        `<tct-timer format="${this.format}"> is not one of ${TIMER_FORMATS.join(', ')}; using "elapsed".`,
      );
    }
  }

  /** Runs after every render (a property or the language changed), never because time passed. */
  protected override updated(): void {
    this.#restart();
  }

  override render(): TemplateResult {
    // The `<time>` has no template content: its text and `datetime` are written by `#tick`, so a render
    // never fights the clock for it.
    return html`<tct-text
      part="text"
      type=${this.type}
      size=${ifDefined(this.size)}
      color=${this.color}
      weight=${ifDefined(this.weight)}
      ><time part="time" datetime="PT0S"></time
    ></tct-text>`;
  }

  get #format(): TimerFormat {
    return this.format === 'clock' ? 'clock' : 'elapsed';
  }

  get #origin(): number {
    return typeof this.startTime === 'number' && Number.isFinite(this.startTime)
      ? this.startTime
      : (this.#mountTime ?? Date.now());
  }

  #stop(): void {
    if (this.#timeout !== undefined) clearTimeout(this.#timeout);
    this.#timeout = undefined;
  }

  #restart(): void {
    this.#stop();
    this.#tick();
  }

  readonly #tick = (): void => {
    const now = Date.now();
    const origin = this.#origin;
    const elapsed = Math.max(0, now - origin);
    this.#write(readDuration(elapsed, this.#format));
    this.#timeout = setTimeout(
      this.#tick,
      millisecondsUntilNextChange(now, origin, elapsed, this.#format),
    );
  };

  /** Writes only what changed, straight to the node. */
  #write(reading: TimerReading): void {
    const time = this.timeElement;
    if (!time) return;
    const text = this.#text(reading.parts);
    if (text !== this.#shownText || time.textContent !== text) {
      time.textContent = text;
      this.#shownText = text;
    }
    if (reading.dateTime !== this.#shownDateTime) {
      time.dateTime = reading.dateTime;
      this.#shownDateTime = reading.dateTime;
    }
  }

  /** `clock`: digits joined with `:`; `elapsed`: each unit as a narrow unit ("2m", "08s") joined with a space. */
  #text(parts: readonly TimerPart[]): string {
    const clock = this.#format === 'clock';
    return parts
      .map((part) => {
        const digits = part.padded ? 2 : 1;
        const format = clock
          ? this.#locale.numberFormat({minimumIntegerDigits: digits, useGrouping: false})
          : this.#locale.numberFormat({
              style: 'unit',
              unit: part.unit,
              unitDisplay: 'narrow',
              minimumIntegerDigits: digits,
              useGrouping: false,
            });
        return format.format(part.value);
      })
      .join(clock ? ':' : ' ');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-timer': TctTimer;
  }
}

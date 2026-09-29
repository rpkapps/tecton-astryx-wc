import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import english from '@tecton-wc/locales/en/chatDictationButton.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {warnInvalidValue} from '../text/text.types.js';
import base from '../styles/base.styles.css';
import {TctButton} from '../button/tct-button.js';
import {CHAT_COMPOSER_BUTTON_SIZES, type ChatComposerButtonSize} from './chat-composer.types.js';
import styles from './tct-chat-dictation-button.styles.css';

/**
 * What the dictation button reads and drives: a `ChatDictationController` or `SpeechRecognitionController`
 * (upstream `UseSpeechRecognitionReturn`), or anything shaped like one.
 */
export interface ChatDictationSource {
  /** Whether this engine can dictate at all. */
  readonly isSupported: boolean;
  /** Whether recognition is running. */
  readonly isListening: boolean;
  /** Calibrated microphone level, 0 to 1. */
  readonly volume: number;
  /** Calibrated frequency band levels, low to high, each 0 to 1. */
  readonly bands: readonly number[];
  /** Starts recognition, or stops it while it runs. */
  toggle(): void;
  /**
   * Calls the listener on every state change including the per-frame level; returns the unsubscribe
   * function. Without it the button re-renders only when its own properties change.
   */
  subscribe?(listener: () => void): () => void;
}

const BAR_COUNT = 5;
const BAR_MIN_SCALE = 0.08;
/** Level at which the meter starts to blend toward the error colour (clipping). */
const CLIPPING_LEVEL = 0.2;

/** Bar geometry per size, in px: width, gap, tallest height. */
const BAR_GEOMETRY: Record<ChatComposerButtonSize, {width: number; gap: number; height: number}> = {
  sm: {width: 2, gap: 1.5, height: 14},
  md: {width: 2.5, gap: 2, height: 18},
};

/**
 * The microphone button that starts and stops voice dictation in a chat composer (put it in the
 * composer's `send-actions` slot). It is driven by a dictation controller (`dictation`, a
 * `ChatDictationController`): an icon button named "Start dictation" while idle, and while listening
 * a live equalizer of the microphone level, named "Stop dictation", that blends toward the error colour
 * as the voice clips.
 *
 * Dictation depends on the Web Speech API, which not every engine has (Firefox does not). Where it is
 * unsupported the button hides itself (`display: none`, nothing is rendered or focusable), or with
 * `show-unsupported` stays visible and disabled; either way nothing throws. The equalizer bars are
 * decoration (`aria-hidden`), and their movement stops under `prefers-reduced-motion`.
 *
 * @summary A microphone button that toggles voice dictation and shows a live level meter.
 * @tag tct-chat-dictation-button
 * @upstream ChatDictationButton
 * @csspart base - The wrapper of the button and the equalizer (theme target `chat-dictation-button`).
 * @csspart bars - The equalizer, present while listening.
 * @csspart bar - One equalizer bar.
 * @csspart button - The button (a `tct-button`).
 * @cloakDisplay inline-flex
 */
export class TctChatDictationButton extends TctElement {
  static override readonly tagName = 'tct-chat-dictation-button';
  static override readonly dependencies = [TctButton];
  static override styles: CSSResultGroup = [base, styles];

  /** The dictation controller that supplies the state and receives the toggle; property only. */
  @property({attribute: false}) dictation: ChatDictationSource | undefined;

  /** Size of the button: `sm` or `md` (default). */
  @property({reflect: true}) size: ChatComposerButtonSize = 'md';

  /**
   * Keeps the button visible but disabled where dictation is unsupported. Default: it is hidden.
   * (Upstream `isHiddenWhenUnsupported`, which defaults to true.)
   */
  @property({type: Boolean, attribute: 'show-unsupported'}) showUnsupported = false;

  /** Accessible name. Default: the localised "Start dictation" / "Stop dictation". */
  @property() label: string | undefined;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'chatDictationButton',
    defaults: english,
  });
  #subscribed: ChatDictationSource | undefined;
  #unsubscribe: (() => void) | undefined;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#subscribed = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#follow();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('size')) {
      warnInvalidValue('tct-chat-dictation-button', 'size', this.size, CHAT_COMPOSER_BUTTON_SIZES);
    }
    if (changed.has('dictation')) this.#follow();
    // Hidden where unsupported: no box at all, so a flex row does not leave a gap for it.
    this.toggleAttribute('data-unsupported', this.#unsupportedHidden);
  }

  get #unsupportedHidden(): boolean {
    return !(this.dictation?.isSupported ?? false) && !this.showUnsupported;
  }

  /** Follows the controller's state, moving the subscription when `dictation` changes. */
  #follow(): void {
    if (this.#subscribed === this.dictation) return;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#subscribed = this.dictation;
    this.#unsubscribe = this.dictation?.subscribe?.(() => {
      this.requestUpdate();
    });
  }

  override render(): TemplateResult | typeof nothing {
    const dictation = this.dictation;
    if (this.#unsupportedHidden) return nothing;
    const listening = dictation?.isListening ?? false;
    const supported = dictation?.isSupported ?? false;
    const size = (CHAT_COMPOSER_BUTTON_SIZES as readonly string[]).includes(this.size)
      ? this.size
      : 'md';
    const name =
      this.label ?? this.#locale.t(listening ? 'stopDictation' : 'startDictation');
    return html`<span class="base" part="base">
      ${listening ? this.#renderBars(dictation!, size) : nothing}
      <tct-button
        class="button"
        part="button"
        variant="ghost"
        size=${size}
        label=${name}
        icon=${listening ? '' : 'microphone'}
        icon-only
        ?disabled=${!supported}
        @click=${this.#onClick}
      ></tct-button>
    </span>`;
  }

  #renderBars(dictation: ChatDictationSource, size: ChatComposerButtonSize): TemplateResult {
    const {width, gap, height} = BAR_GEOMETRY[size];
    // Quiet speech (0 to 10 %) maps to the full visual range.
    const levels = Array.from({length: BAR_COUNT}, (_, index) =>
      Math.min(Math.pow((dictation.bands[index] ?? 0) / 0.2, 0.5), 1),
    );
    const volume = dictation.volume;
    const clipping = volume >= CLIPPING_LEVEL;
    const strength = Math.round(Math.min((volume - CLIPPING_LEVEL) / 0.1, 1) * 100);
    return html`<span
      class="bars"
      part="bars"
      aria-hidden="true"
      style=${styleMap({gap: `${gap}px`, blockSize: `${height}px`})}
      >${levels.map((level) => {
        const scale = BAR_MIN_SCALE + level * (1 - BAR_MIN_SCALE);
        return html`<span
          class="bar"
          part="bar"
          style=${styleMap({
            inlineSize: `${width}px`,
            transform: `scaleY(${scale})`,
            backgroundColor: clipping
              ? `color-mix(in srgb, var(--color-accent), var(--color-error) ${strength}%)`
              : undefined,
          })}
        ></span>`;
      })}</span
    >`;
  }

  readonly #onClick = (): void => {
    this.dictation?.toggle();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-dictation-button': TctChatDictationButton;
  }
}

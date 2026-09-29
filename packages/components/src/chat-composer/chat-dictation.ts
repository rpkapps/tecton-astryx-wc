/**
 * `ChatDictationController`: the one controller an app creates for voice input to a chat composer
 * (upstream `useChatDictation`). It is a {@link SpeechRecognitionController} that also
 *
 * - shows the phrase being spoken as faded "ghost" text at the end of the input (`input`), replaces it
 *   with the final text plus a space when the phrase is complete, and never leaves ghost text behind;
 * - types the way people shout: sustained loud speech (a short rolling average of the level) turns the
 *   transcript to upper case (the upstream "caps lock" behaviour);
 * - optionally plays two soft cues on start and stop (`sounds`; silent on iOS).
 *
 * Where speech recognition is unsupported nothing here throws: `isSupported` is false, `start()` does
 * nothing, and the dictation button hides itself.
 *
 * ```ts
 * class MyChat extends LitElement {
 *   #dictation = new ChatDictationController(this, {
 *     input: () => this.renderRoot.querySelector('tct-chat-composer-input'),
 *   });
 *   render() {
 *     return html`<tct-chat-composer>
 *       <tct-chat-dictation-button slot="send-actions" .dictation=${this.#dictation}></tct-chat-dictation-button>
 *     </tct-chat-composer>`;
 *   }
 * }
 * ```
 *
 * Guides: [mwg:privacy] (microphone permission) [mwg:accessibility] (the ghost text is `aria-hidden`; only
 * the final text is ever in the accessible draft).
 */
import type {ReactiveControllerHost} from 'lit';
import type {ChatComposerInputHandle} from './chat-composer.types.js';
import {SpeechRecognitionController, type SpeechRecognitionOptions} from './speech-recognition.js';

export interface ChatDictationOptions extends SpeechRecognitionOptions {
  /** Plays soft audio cues on start and stop. Default `false`. */
  sounds?: boolean;
  /**
   * The composer input to dictate into (a `tct-chat-composer-input`, or anything with the handle's
   * methods). Without it the controller only reports transcripts through the callbacks.
   */
  input?: () => ChatComposerInputHandle | null | undefined;
}

/** Recent meter frames the rolling loudness average covers (about half a second). */
const HISTORY_FRAMES = 30;
/** Frames needed before the average counts. */
const HISTORY_MIN_FRAMES = 10;
/** Average level at which speech is transcribed in upper case. */
const CAPS_LEVEL = 0.15;

let cueContext: AudioContext | undefined;

function cueAudio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  // iOS mutes Web Audio unless the ringer is on, and a cue there is worse than none.
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return null;
  if (!cueContext || cueContext.state === 'closed') cueContext = new AudioContext();
  if (cueContext.state === 'suspended') void cueContext.resume().catch(() => {});
  return cueContext;
}

/** One soft "plop": a short sine with a quick pitch drop. Best effort. */
function playPlop(context: AudioContext, frequency: number, delay: number): void {
  try {
    const now = context.currentTime;
    const duration = frequency < 200 ? 0.18 : 0.06;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * 1.3, now + delay);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, now + delay + 0.01);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.93, now + delay + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.setValueAtTime(0.25, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.25 * 0.2, now + delay + duration * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration);
  } catch {
    // Audio cues are best effort.
  }
}

function playCue(frequencies: readonly [number, number]): void {
  const context = cueAudio();
  if (!context) return;
  playPlop(context, frequencies[0], 0);
  playPlop(context, frequencies[1], 0.07);
}

export class ChatDictationController extends SpeechRecognitionController {
  declare readonly options: ChatDictationOptions;
  #history: number[] = [];

  constructor(
    host: (ReactiveControllerHost & Partial<HTMLElement>) | null,
    options: ChatDictationOptions = {},
  ) {
    super(host, options);
  }

  // The composer's handle, read at use: the input may not exist when the controller is created.
  get #input(): ChatComposerInputHandle | null {
    return this.options.input?.() ?? null;
  }

  protected override transform(text: string): string {
    let result = super.transform(text);
    const history = this.#history;
    const average =
      history.length > 0 ? history.reduce((sum, level) => sum + level, 0) / history.length : 0;
    if (average >= CAPS_LEVEL && history.length >= HISTORY_MIN_FRAMES)
      result = result.toUpperCase();
    return result;
  }

  protected override measured(volume: number): void {
    this.#history.push(volume);
    if (this.#history.length > HISTORY_FRAMES) this.#history.shift();
  }

  protected override started(): void {
    if (this.options.sounds) playCue([392, 523]);
    // The ghost text appears with the first interim result; nothing to show before it.
    super.started();
  }

  protected override transcribed(transcript: string, isFinal: boolean): void {
    const input = this.#input;
    if (!input) {
      super.transcribed(transcript, isFinal);
      return;
    }
    if (isFinal) {
      input.clearInterimText?.();
      input.focus();
      input.insertText(`${transcript} `);
      this.options.onResult?.(transcript);
    } else {
      input.setInterimText?.(transcript);
    }
    this.options.onTranscript?.(transcript, isFinal);
  }

  protected override ended(): void {
    this.#history = [];
    if (this.options.sounds) playCue([523, 392]);
    this.#input?.clearInterimText?.();
    super.ended();
  }
}

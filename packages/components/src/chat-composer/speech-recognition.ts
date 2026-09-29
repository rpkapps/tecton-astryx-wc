/**
 * `SpeechRecognitionController`: voice to text over the Web Speech API (upstream `useSpeechRecognition`),
 * with a real-time microphone level for a volume meter. Headless: it drives no UI itself; the dictation
 * button (or any element) reads its state.
 *
 * The API is feature-detected on every read (`isSupported`): where `SpeechRecognition` does not exist
 * (Firefox, and any engine without it) `start()` does nothing and nothing throws, so a page can offer
 * dictation unconditionally and let the button hide itself. Recognition may send audio to a service; the
 * page owns the privacy story and the microphone permission prompt (raised by `getUserMedia` for the
 * level meter and by the recognizer itself).
 *
 * - Coarse state (`isListening`, `isSpeaking`, `interimTranscript`, `isSupported`) re-renders the host.
 * - The level (`volume`, `bands`, `rawBands`) changes every frame while listening and never re-renders
 *   the host: subscribe to it with {@link SpeechRecognitionController.subscribe} (the dictation button
 *   does), so a 60 fps meter costs one small element and not the whole page.
 * - Everything is released when the host disconnects (`abort()`, the microphone tracks, the frame loop).
 *
 * ```ts
 * class MyChat extends LitElement {
 *   #speech = new SpeechRecognitionController(this, {onResult: (text) => this.#draft.append(text)});
 *   render() { return html`<tct-chat-dictation-button .dictation=${this.#speech}></tct-chat-dictation-button>`; }
 * }
 * ```
 *
 * Guides: [mwg:privacy] (microphone access is a user-gesture, permission-gated capability) [mwg:break-up-long-tasks]
 * (the meter runs on animation frames, off the input path).
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import english from '@tecton-wc/locales/en/chat.js';
import {speechRecognitionConstructor, type SpeechRecognitionLike} from './chat-composer.platform.js';

/** How many frequency bands the meter reports. */
export const SPEECH_BAND_COUNT = 5;

const zeros = (): number[] => Array.from({length: SPEECH_BAND_COUNT}, () => 0);

export interface SpeechRecognitionOptions {
  /** BCP-47 language tag, or a function returning one. Default: the nearest `lang`, else the page's. */
  lang?: string | (() => string);
  /** Whether recognition continues until stopped. Default `true`. */
  continuous?: boolean;
  /** Whether interim results are reported. Default `true`. */
  interimResults?: boolean;
  /** Shared `AudioContext` for the level meter. Default: a lazy per-page singleton. */
  audioContext?: AudioContext;
  /** Transforms every transcript before it is reported. */
  transformTranscript?: (text: string) => string;
  /** Called with each interim or final transcript. */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Called with each final transcript. */
  onResult?: (transcript: string) => void;
  /** Called when recognition fails (`not-allowed`, `no-speech`, `network`, `start-failed`, ...). */
  onError?: (error: {error: string; message?: string}) => void;
  /** Called when recognition starts. */
  onStart?: () => void;
  /** Called when recognition ends (stopped, aborted or ended by the engine). */
  onEnd?: () => void;
  /** Called with the calibrated level on every meter frame while listening. */
  onVolume?: (volume: number) => void;
  /** The `no-speech` error text. Default: the localised "No speech was detected." (English). */
  noSpeechMessage?: string | (() => string);
}

// ------------------------------------------------------------------------------- volume meter

interface VolumeAnalyser {
  volume(): number;
  bands(count: number): number[];
  rawBands(count: number): number[];
  cleanup(): void;
}

/** Frames spent measuring the room's noise floor before the meter reports anything. */
const CALIBRATION_FRAMES = 60;
const VOICE_SPLITS = [3, 6, 11, 18];

let sharedAudioContext: AudioContext | undefined;

function defaultAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  if (sharedAudioContext.state === 'suspended') void sharedAudioContext.resume().catch(() => {});
  return sharedAudioContext;
}

async function createVolumeAnalyser(
  context: AudioContext | undefined,
): Promise<VolumeAnalyser | null> {
  try {
    const audio = context ?? defaultAudioContext();
    if (!audio || !navigator.mediaDevices?.getUserMedia) return null;
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const noiseFloor = new Float32Array(analyser.frequencyBinCount);
    let calibrated = 0;

    const calibrate = (): void => {
      analyser.getByteFrequencyData(data);
      calibrated++;
      for (let i = 0; i < data.length; i++) {
        const level = data[i]! / 255;
        if (level > noiseFloor[i]!) noiseFloor[i] = level;
      }
    };
    const clean = (i: number): number =>
      calibrated < CALIBRATION_FRAMES ? 0 : Math.max(0, data[i]! / 255 - noiseFloor[i]! * 1.1);
    const read = (): void => {
      analyser.getByteFrequencyData(data);
      if (calibrated < CALIBRATION_FRAMES) calibrate();
    };
    const split = (count: number, level: (i: number) => number): number[] => {
      const all = [...VOICE_SPLITS, data.length];
      const edges = count <= all.length ? all.slice(0, count) : all;
      const out: number[] = [];
      let start = 1;
      for (const end of edges) {
        let sum = 0;
        for (let i = start; i < end; i++) sum += level(i);
        out.push(sum / (end - start));
        start = end;
      }
      return out;
    };

    return {
      volume: () => {
        read();
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += clean(i);
        return sum / data.length;
      },
      bands: (count) => {
        read();
        return split(count, clean);
      },
      rawBands: (count) => {
        analyser.getByteFrequencyData(data);
        return split(count, (i) => data[i]! / 255);
      },
      cleanup: () => {
        source.disconnect();
        for (const track of stream.getTracks()) track.stop();
      },
    };
  } catch {
    // No microphone, or permission denied: recognition still works, the meter stays flat.
    return null;
  }
}

/** The nearest `lang` from `element` up, crossing shadow roots; else the page's language. */
function nearestLang(element: Element | null): string {
  for (let node: Node | null = element; node; node = node.parentNode ?? (node as ShadowRoot).host) {
    if (node instanceof Element) {
      const lang = node.getAttribute('lang');
      if (lang) return lang;
    }
  }
  return document.documentElement.lang || navigator.language || 'en';
}

export type SpeechRecognitionListener = () => void;

export class SpeechRecognitionController implements ReactiveController {
  /** The options; read on every use, so they may be changed at any time (`lang`, callbacks). */
  readonly options: SpeechRecognitionOptions;
  readonly #host: (ReactiveControllerHost & Partial<HTMLElement>) | null;
  readonly #listeners = new Set<SpeechRecognitionListener>();
  #recognition: SpeechRecognitionLike | null = null;
  #analyser: VolumeAnalyser | null = null;
  #frame = 0;
  #listening = false;
  #speaking = false;
  #volume = 0;
  #bands = zeros();
  #rawBands = zeros();
  #interim = '';

  /**
   * @param host A Lit host to re-render on coarse state changes and to release on disconnect; `null`
   *   for plain scripts (then call {@link dispose} yourself).
   */
  constructor(
    host: (ReactiveControllerHost & Partial<HTMLElement>) | null,
    options: SpeechRecognitionOptions = {},
  ) {
    this.#host = host;
    this.options = options;
    host?.addController(this);
  }

  /** Whether this engine has `SpeechRecognition`. Read live. */
  get isSupported(): boolean {
    return speechRecognitionConstructor() !== null;
  }

  /** Whether recognition is running. */
  get isListening(): boolean {
    return this.#listening;
  }

  /** Whether speech is being detected right now. */
  get isSpeaking(): boolean {
    return this.#speaking;
  }

  /** Calibrated microphone level, 0 to 1; updates every frame while listening (subscribers only). */
  get volume(): number {
    return this.#volume;
  }

  /** Calibrated frequency band levels, low to high, each 0 to 1. */
  get bands(): readonly number[] {
    return this.#bands;
  }

  /** Raw band levels, for debugging. */
  get rawBands(): readonly number[] {
    return this.#rawBands;
  }

  /** The transcript so far of the phrase being spoken. */
  get interimTranscript(): string {
    return this.#interim;
  }

  /**
   * Calls `listener` on every state change including the per-frame level. Returns the unsubscribe
   * function. The dictation button uses this; the host re-renders only on coarse changes.
   */
  subscribe(listener: SpeechRecognitionListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  hostDisconnected(): void {
    this.dispose();
  }

  /** Aborts recognition and releases the microphone and the frame loop. Safe to call twice. */
  dispose(): void {
    const recognition = this.#recognition;
    this.#recognition = null;
    recognition?.abort();
    this.#stopMeter();
    if (this.#listening || this.#speaking || this.#interim) {
      this.#listening = false;
      this.#speaking = false;
      this.#interim = '';
      this.#changed(true);
    }
  }

  /** Starts recognition (after aborting a running one). A no-op where it is unsupported. */
  start(): void {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) return;
    this.#recognition?.abort();
    const recognition = new Recognition();
    const {options} = this;
    const lang = options.lang;
    recognition.lang =
      typeof lang === 'function' ? lang() : (lang ?? nearestLang(this.#host as Element | null));
    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    // A recognition that was replaced or aborted still reports its own `end`; only the current one counts.
    const current = (): boolean => this.#recognition === recognition;

    recognition.onstart = () => {
      if (!current()) return;
      this.#listening = true;
      this.#changed(true);
      this.started();
      void this.#startMeter(recognition);
    };
    recognition.onend = () => {
      if (!current()) return;
      this.#recognition = null;
      this.#listening = false;
      this.#speaking = false;
      this.#interim = '';
      this.#stopMeter();
      this.#changed(true);
      this.ended();
    };
    recognition.onspeechstart = () => {
      if (!current()) return;
      this.#speaking = true;
      this.#changed(true);
    };
    recognition.onspeechend = () => {
      if (!current()) return;
      this.#speaking = false;
      this.#changed(true);
    };
    recognition.onresult = (event) => {
      if (!current()) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const transcript = this.transform(result[0]?.transcript ?? '');
        if (result.isFinal) {
          this.#interim = '';
          this.#changed(true);
          this.transcribed(transcript, true);
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        this.#interim = interim;
        this.#changed(true);
        this.transcribed(interim, false);
      }
    };
    recognition.onerror = (event) => {
      if (!current()) return;
      options.onError?.({error: event.error, message: event.message});
    };
    recognition.onnomatch = () => {
      if (!current()) return;
      const message = options.noSpeechMessage;
      options.onError?.({
        error: 'no-speech',
        message:
          typeof message === 'function'
            ? message()
            : (message ?? english['@tct.chat.speechRecognition.noSpeechDetected']),
      });
    };

    this.#recognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      // `InvalidStateError` when a recognition is already running in this document.
      this.#recognition = null;
      options.onError?.({
        error: 'start-failed',
        message: error instanceof Error ? error.message : undefined,
      });
    }
  }

  /** Stops recognition gracefully: the engine delivers the final result, then ends. */
  stop(): void {
    this.#recognition?.stop();
  }

  /** Aborts recognition at once; pending results are dropped. */
  abort(): void {
    this.#recognition?.abort();
    this.#stopMeter();
  }

  /** Stops when listening, starts otherwise. */
  toggle(): void {
    if (this.#listening) this.stop();
    else this.start();
  }

  // ------------------------------------------------------------------------------- hooks

  /** Transforms a transcript before it is reported. Subclasses extend it; the base applies the option. */
  protected transform(text: string): string {
    return this.options.transformTranscript ? this.options.transformTranscript(text) : text;
  }

  /** Recognition started. */
  protected started(): void {
    this.options.onStart?.();
  }

  /** Recognition ended. */
  protected ended(): void {
    this.options.onEnd?.();
  }

  /** A transcript arrived (already transformed); a final one also reaches `onResult`. */
  protected transcribed(transcript: string, isFinal: boolean): void {
    if (isFinal) this.options.onResult?.(transcript);
    this.options.onTranscript?.(transcript, isFinal);
  }

  /** One meter frame measured `volume`. */
  protected measured(_volume: number): void {
    // Nothing by default; the dictation controller keeps a short history of it.
  }

  // ------------------------------------------------------------------------------ meter

  async #startMeter(recognition: SpeechRecognitionLike): Promise<void> {
    const analyser = await createVolumeAnalyser(this.options.audioContext);
    if (!analyser) return;
    // Stopped (or replaced) while the microphone permission prompt was open: release it again.
    if (this.#recognition !== recognition || !this.#listening) {
      analyser.cleanup();
      return;
    }
    this.#analyser?.cleanup();
    this.#analyser = analyser;
    const poll = (): void => {
      const meter = this.#analyser;
      if (!meter) return;
      this.#volume = meter.volume();
      this.#bands = meter.bands(SPEECH_BAND_COUNT);
      this.#rawBands = meter.rawBands(SPEECH_BAND_COUNT);
      this.measured(this.#volume);
      this.options.onVolume?.(this.#volume);
      this.#changed(false);
      this.#frame = requestAnimationFrame(poll);
    };
    this.#frame = requestAnimationFrame(poll);
  }

  #stopMeter(): void {
    cancelAnimationFrame(this.#frame);
    this.#analyser?.cleanup();
    this.#analyser = null;
    if (this.#volume !== 0) {
      this.#volume = 0;
      this.#bands = zeros();
      this.#rawBands = zeros();
      this.#changed(false);
    }
  }

  /** Notifies subscribers; a coarse change also re-renders the Lit host. */
  #changed(coarse: boolean): void {
    for (const listener of [...this.#listeners]) listener();
    if (coarse) this.#host?.requestUpdate();
  }
}

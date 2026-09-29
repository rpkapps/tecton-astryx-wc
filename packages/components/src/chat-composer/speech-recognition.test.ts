import {LitElement, html} from 'lit';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {
  speechRecognitionConstructor,
  type SpeechRecognitionLike,
  type SpeechResultEventLike,
} from './chat-composer.platform.js';
import {ChatDictationController} from './chat-dictation.js';
import {SpeechRecognitionController} from './speech-recognition.js';

/** A controllable stand-in for the engine's recognizer. */
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  static failStart: Error | undefined;
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: SpeechResultEventLike) => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onerror: ((event: {error: string; message?: string}) => void) | null = null;
  onnomatch: (() => void) | null = null;
  started = 0;
  stopped = 0;
  aborted = 0;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start(): void {
    if (FakeRecognition.failStart) throw FakeRecognition.failStart;
    this.started++;
    queueMicrotask(() => this.onstart?.());
  }
  stop(): void {
    this.stopped++;
    queueMicrotask(() => this.onend?.());
  }
  abort(): void {
    this.aborted++;
    queueMicrotask(() => this.onend?.());
  }
  /** Delivers one result list: `[text, isFinal]` per entry, starting at `resultIndex`. */
  say(results: [string, boolean][], resultIndex = 0): void {
    const list = results.map(([transcript, isFinal]) => ({isFinal, length: 1, 0: {transcript}}));
    this.onresult?.({resultIndex, results: Object.assign(list, {length: list.length})});
  }
}

const scope = window as unknown as Record<string, unknown>;
let saved: {plain: unknown; prefixed: unknown; media: unknown};

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.failStart = undefined;
  saved = {
    plain: scope.SpeechRecognition,
    prefixed: scope.webkitSpeechRecognition,
    media: navigator.mediaDevices,
  };
  scope.SpeechRecognition = FakeRecognition;
  scope.webkitSpeechRecognition = undefined;
});

afterEach(() => {
  scope.SpeechRecognition = saved.plain;
  scope.webkitSpeechRecognition = saved.prefixed;
  vi.restoreAllMocks();
});

const last = (): FakeRecognition => FakeRecognition.instances.at(-1)!;

/** A microphone that never asks: a silent stream from an offline audio graph. */
function stubMicrophone(): {tracksStopped: () => number} {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  let stopped = 0;
  for (const track of destination.stream.getTracks()) {
    const stop = track.stop.bind(track);
    track.stop = () => {
      stopped++;
      stop();
    };
  }
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: () => Promise.resolve(destination.stream),
  });
  return {tracksStopped: () => stopped};
}

describe('SpeechRecognitionController: support', () => {
  it('reports unsupported, does nothing and throws nothing where SpeechRecognition is absent', () => {
    scope.SpeechRecognition = undefined;
    const controller = new SpeechRecognitionController(null);
    expect(speechRecognitionConstructor()).toBeNull();
    expect(controller.isSupported).toBe(false);
    expect(() => {
      controller.start();
      controller.stop();
      controller.abort();
      controller.toggle();
      controller.dispose();
    }).not.toThrow();
    expect(controller.isListening).toBe(false);
  });

  it('falls back to the webkit-prefixed constructor', () => {
    scope.SpeechRecognition = undefined;
    scope.webkitSpeechRecognition = FakeRecognition;
    const controller = new SpeechRecognitionController(null);
    expect(controller.isSupported).toBe(true);
    controller.start();
    expect(FakeRecognition.instances).toHaveLength(1);
  });
});

describe('SpeechRecognitionController: a session', () => {
  it('configures the recognizer, tracks listening, and resets on end', async () => {
    stubMicrophone();
    const events: string[] = [];
    const controller = new SpeechRecognitionController(null, {
      lang: 'de-DE',
      continuous: false,
      onStart: () => events.push('start'),
      onEnd: () => events.push('end'),
    });
    controller.start();
    expect(last().lang).toBe('de-DE');
    expect(last().continuous).toBe(false);
    expect(last().interimResults).toBe(true);
    await waitUntil(() => controller.isListening, 'listening');
    expect(events).toEqual(['start']);
    last().onspeechstart?.();
    expect(controller.isSpeaking).toBe(true);
    last().onspeechend?.();
    expect(controller.isSpeaking).toBe(false);
    controller.stop();
    await waitUntil(() => !controller.isListening, 'stopped');
    expect(events).toEqual(['start', 'end']);
    expect(controller.interimTranscript).toBe('');
    controller.dispose();
  });

  it('defaults the language to the nearest lang, else the page language', async () => {
    const root = await fixture<HTMLElement>('<div lang="fr-FR"><span></span></div>');
    const host = Object.assign(root.querySelector('span')!, {
      addController: () => undefined,
      requestUpdate: () => undefined,
    });
    new SpeechRecognitionController(host as never).start();
    expect(last().lang).toBe('fr-FR');
    new SpeechRecognitionController(null).start();
    expect(last().lang).toBe(document.documentElement.lang || navigator.language || 'en');
  });

  it('reports interim and final results through the callbacks, once each', async () => {
    stubMicrophone();
    const seen: [string, boolean][] = [];
    const finals: string[] = [];
    const controller = new SpeechRecognitionController(null, {
      onTranscript: (text, isFinal) => seen.push([text, isFinal]),
      onResult: (text) => finals.push(text),
      transformTranscript: (text) => text.trim(),
    });
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    last().say([['hel', false]]);
    expect(controller.interimTranscript).toBe('hel');
    last().say([[' hello there ', true]]);
    expect(controller.interimTranscript).toBe('');
    expect(finals).toEqual(['hello there']);
    expect(seen).toEqual([
      ['hel', false],
      ['hello there', true],
    ]);
    controller.dispose();
  });

  it('reports errors, the no-speech message, and a start that throws', async () => {
    stubMicrophone();
    const errors: {error: string; message?: string}[] = [];
    const controller = new SpeechRecognitionController(null, {
      onError: (error) => errors.push(error),
    });
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    last().onerror?.({error: 'not-allowed', message: 'denied'});
    last().onnomatch?.();
    expect(errors).toEqual([
      {error: 'not-allowed', message: 'denied'},
      {error: 'no-speech', message: 'No speech was detected.'},
    ]);
    controller.dispose();
    FakeRecognition.failStart = new Error('already running');
    const other = new SpeechRecognitionController(null, {onError: (error) => errors.push(error)});
    other.start();
    expect(errors.at(-1)).toEqual({error: 'start-failed', message: 'already running'});
    expect(other.isListening).toBe(false);
  });

  it('ignores the late end of a recognition that was replaced', async () => {
    stubMicrophone();
    const controller = new SpeechRecognitionController(null);
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    const first = last();
    controller.start();
    await waitUntil(
      () => FakeRecognition.instances.length === 2 && last().started === 1,
      'restarted',
    );
    expect(first.aborted).toBe(1);
    await waitUntil(() => controller.isListening, 'the new recognition is listening');
    controller.dispose();
  });

  it('toggle starts and stops; abort ends at once; dispose releases everything', async () => {
    const mic = stubMicrophone();
    const controller = new SpeechRecognitionController(null);
    controller.toggle();
    await waitUntil(() => controller.isListening, 'started');
    controller.toggle();
    await waitUntil(() => !controller.isListening, 'stopped');
    expect(last().stopped).toBe(1);
    controller.start();
    await waitUntil(() => controller.isListening, 'started again');
    controller.abort();
    await waitUntil(() => !controller.isListening, 'aborted');
    expect(last().aborted).toBeGreaterThanOrEqual(1);
    controller.start();
    await waitUntil(() => controller.isListening, 'started a third time');
    controller.dispose();
    expect(controller.isListening).toBe(false);
    await waitUntil(() => mic.tracksStopped() > 0, 'the microphone is released');
  });
});

describe('SpeechRecognitionController: the level meter and subscribers', () => {
  it('runs a meter while listening, notifies subscribers per frame, and stops with the recognition', async () => {
    stubMicrophone();
    let frames = 0;
    const controller = new SpeechRecognitionController(null, {onVolume: () => frames++});
    const unsubscribe = controller.subscribe(() => undefined);
    let notified = 0;
    const stop = controller.subscribe(() => notified++);
    controller.start();
    await waitUntil(() => frames > 2, 'meter frames');
    expect(controller.bands).toHaveLength(5);
    expect(controller.rawBands).toHaveLength(5);
    expect(controller.volume).toBeGreaterThanOrEqual(0);
    expect(notified).toBeGreaterThan(2);
    controller.stop();
    await waitUntil(() => !controller.isListening, 'stopped');
    const at = frames;
    for (let i = 0; i < 4; i++) await nextFrame();
    expect(frames).toBe(at);
    expect(controller.volume).toBe(0);
    stop();
    unsubscribe();
    controller.dispose();
  });

  it('keeps working (a flat meter) when the microphone is refused', async () => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
    });
    const controller = new SpeechRecognitionController(null);
    controller.start();
    await waitUntil(() => controller.isListening, 'listening without a meter');
    expect(controller.volume).toBe(0);
    controller.dispose();
  });

  it('a Lit host re-renders on coarse changes only, never per meter frame, and releases on disconnect', async () => {
    stubMicrophone();
    class Host extends LitElement {
      renders = 0;
      readonly speech: SpeechRecognitionController = new SpeechRecognitionController(this);
      override render() {
        this.renders++;
        return html`<slot></slot>`;
      }
    }
    customElements.define('speech-test-host', Host);
    const host = await fixture<Host>('<speech-test-host></speech-test-host>');
    const before = host.renders;
    host.speech.start();
    await waitUntil(() => host.speech.isListening, 'listening');
    await host.updateComplete;
    const afterStart = host.renders;
    expect(afterStart).toBeGreaterThan(before);
    let frames = 0;
    host.speech.subscribe(() => frames++);
    await waitUntil(() => frames >= 5, 'several meter frames');
    await host.updateComplete;
    // Several meter frames later the host has not rendered again.
    expect(host.renders).toBe(afterStart);
    host.remove();
    expect(host.speech.isListening).toBe(false);
    expect(last().aborted).toBeGreaterThanOrEqual(1);
  });
});

describe('ChatDictationController', () => {
  class Loud extends ChatDictationController {
    push(level: number, times: number): void {
      for (let i = 0; i < times; i++) this.measured(level);
    }
  }

  function fakeInput() {
    const calls: string[] = [];
    let text = '';
    return {
      calls,
      handle: {
        insertToken: () => undefined,
        expandToken: () => undefined,
        insertText: (value: string) => {
          calls.push(`insert:${value}`);
          text += value;
        },
        focus: () => calls.push('focus'),
        getValue: () => text,
        setInterimText: (value: string) => calls.push(`interim:${value}`),
        clearInterimText: () => calls.push('clear'),
      },
    };
  }

  it('shows interim text as ghost text, then replaces it with the final text and a space', async () => {
    stubMicrophone();
    const input = fakeInput();
    const results: string[] = [];
    const controller = new ChatDictationController(null, {
      input: () => input.handle,
      onResult: (text) => results.push(text),
    });
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    last().say([['open the', false]]);
    last().say([['open the pod bay doors', true]]);
    expect(input.calls).toEqual([
      'interim:open the',
      'clear',
      'focus',
      'insert:open the pod bay doors ',
    ]);
    expect(results).toEqual(['open the pod bay doors']);
    controller.stop();
    await waitUntil(() => !controller.isListening, 'stopped');
    expect(input.calls.at(-1)).toBe('clear');
    controller.dispose();
  });

  it('without an input it only reports through the callbacks', async () => {
    stubMicrophone();
    const seen: string[] = [];
    const controller = new ChatDictationController(null, {onResult: (text) => seen.push(text)});
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    last().say([['plain', true]]);
    expect(seen).toEqual(['plain']);
    controller.dispose();
  });

  it('turns sustained loud speech to upper case, and normal speech stays as spoken', async () => {
    stubMicrophone();
    const seen: string[] = [];
    const controller = new Loud(null, {onResult: (text) => seen.push(text)});
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    controller.push(0.05, 30);
    last().say([['quiet words', true]]);
    controller.push(0.5, 30);
    last().say([['loud words', true]]);
    // Too few frames to count as sustained.
    const other = new Loud(null, {onResult: (text) => seen.push(text)});
    other.start();
    await waitUntil(() => other.isListening, 'listening');
    other.push(0.9, 5);
    FakeRecognition.instances.at(-1)!.say([['brief shout', true]]);
    expect(seen).toEqual(['quiet words', 'LOUD WORDS', 'brief shout']);
    controller.dispose();
    other.dispose();
  });

  it("applies the caller's transform before the caps rule", async () => {
    stubMicrophone();
    const seen: string[] = [];
    const controller = new Loud(null, {
      transformTranscript: (text) => `${text}!`,
      onResult: (text) => seen.push(text),
    });
    controller.start();
    await waitUntil(() => controller.isListening, 'listening');
    controller.push(0.4, 20);
    last().say([['go', true]]);
    expect(seen).toEqual(['GO!']);
    controller.dispose();
  });

  it('plays no audio cue unless asked, and never throws when it does', async () => {
    stubMicrophone();
    const quiet = new ChatDictationController(null);
    quiet.start();
    await waitUntil(() => quiet.isListening, 'listening');
    quiet.dispose();
    const loud = new ChatDictationController(null, {sounds: true});
    loud.start();
    await waitUntil(() => loud.isListening, 'listening');
    loud.stop();
    await waitUntil(() => !loud.isListening, 'stopped');
    loud.dispose();
  });
});

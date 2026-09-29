/**
 * Platform probes the composer needs and `core/features.ts` does not have yet (a shared file: the
 * request to move them there is in `parity.json`). Lazy and cached; nothing runs at import time.
 */

let plaintextOnly: boolean | undefined;
let plaintextOverride: boolean | undefined;

/**
 * Whether `contenteditable="plaintext-only"` is supported (Chrome 51, Safari 16.4, Firefox 136: every
 * Tier-1 engine; Firefox 125-135 is Tier 2). An engine without it treats the value as invalid and makes the
 * element not editable at all, so it is probed rather than assumed: assigning the value to
 * `contentEditable` throws a `SyntaxError` where it is unknown.
 */
export function supportsPlaintextOnly(): boolean {
  if (plaintextOverride !== undefined) return plaintextOverride;
  if (plaintextOnly === undefined) {
    try {
      const probe = document.createElement('div');
      probe.contentEditable = 'plaintext-only';
      plaintextOnly = probe.contentEditable === 'plaintext-only';
    } catch {
      plaintextOnly = false;
    }
  }
  return plaintextOnly;
}

/** Test hook: forces the answer of {@link supportsPlaintextOnly}; `undefined` restores the probe. */
export function overridePlaintextOnly(value: boolean | undefined): void {
  plaintextOverride = value;
}

// ----------------------------------------------------------------------- Web Speech API types

/** One recognition alternative. */
export interface SpeechAlternativeLike {
  readonly transcript: string;
}

/** One recognition result: final or interim. */
export interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternativeLike;
}

/** The `result` event of a recognition. */
export interface SpeechResultEventLike {
  readonly resultIndex: number;
  readonly results: {readonly length: number; readonly [index: number]: SpeechResultLike};
}

/** The part of `SpeechRecognition` the controllers use (the API is not in the DOM typings). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onerror: ((event: {error: string; message?: string}) => void) | null;
  onnomatch: (() => void) | null;
}

export type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

/** The engine's `SpeechRecognition` (unprefixed, else `webkit`-prefixed), or `null`. Read at call time. */
export function speechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/**
 * How the user last interacted (A§9.18, port of upstream `interactionModality`).
 *
 * `:focus-visible` stays the selector that draws a focus ring, but it is not "focused by keyboard":
 * per Selectors 4 a pointer-focused text field matches it too. Code that must know which device moved
 * focus (a ring only for keyboard focus, `focus({focusVisible})` when returning focus) reads this,
 * as a gate alongside `:focus-visible`, never instead of it.
 *
 *  - `keyboard`: the last input was a key press (also the default: with no interaction yet, focus
 *    arrived programmatically and showing a ring is the safe error);
 *  - `pointer`: the last input was a pointer press;
 *  - `virtual`: a click arrived with no key or pointer press before it (assistive technology
 *    "activate", voice control).
 *
 * The listeners live on `document` for its lifetime once activated (input during a gap between
 * consumers must not be lost) and are shared by every copy of the library.
 */

export type InteractionModality = 'keyboard' | 'pointer' | 'virtual';

interface ModalityStore {
  modality: InteractionModality;
  /** A key or pointer press happened since the last click. */
  pressedSinceClick: boolean;
  listening: boolean;
}

const STORE_KEY = Symbol.for('tct.interaction-modality');

function store(): ModalityStore {
  const holder = document as Document & {[STORE_KEY]?: ModalityStore};
  return (holder[STORE_KEY] ??= {modality: 'keyboard', pressedSinceClick: false, listening: false});
}

function activate(): ModalityStore {
  const state = store();
  if (state.listening) return state;
  state.listening = true;
  document.addEventListener(
    'pointerdown',
    () => {
      state.modality = 'pointer';
      state.pressedSinceClick = true;
    },
    {capture: true, passive: true},
  );
  document.addEventListener(
    'keydown',
    (event) => {
      // Modifier chords are not navigation: Shift held before a click must not turn it into keyboard.
      if (event.metaKey || event.altKey || event.ctrlKey) return;
      state.modality = 'keyboard';
      state.pressedSinceClick = true;
    },
    {capture: true, passive: true},
  );
  document.addEventListener(
    'click',
    () => {
      if (!state.pressedSinceClick) state.modality = 'virtual';
      state.pressedSinceClick = false;
    },
    {capture: true, passive: true},
  );
  return state;
}

/** Starts tracking (idempotent). Called by consumers so tracking begins before the first interaction. */
export function trackInteractionModality(): void {
  if (typeof document !== 'undefined') activate();
}

/** How the user last interacted with the page; `keyboard` on the server. */
export function getModality(): InteractionModality {
  return typeof document === 'undefined' ? 'keyboard' : activate().modality;
}

/** Restores the initial state. Test-only. */
export function resetModality(): void {
  if (typeof document === 'undefined') return;
  const state = store();
  state.modality = 'keyboard';
  state.pressedSinceClick = false;
}

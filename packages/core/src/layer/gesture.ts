/**
 * Gesture identity (A§9.9, port of upstream `gestureCounter`). A dismissing press and the trigger's
 * own click come from ONE user gesture, and which the code sees first is a race; comparing
 * timestamps guesses, counting gestures does not. The counter advances on every new pointerdown or
 * keydown, so "the click of the gesture that dismissed this layer" is exactly "the click while the
 * counter still reads what it read at the dismissal", however long the main thread was blocked.
 */

let gesture = 0;
let clickedGesture: number | null = null;
let lastAdvancingEvent: Event | null = null;
let listening = false;

/**
 * Advances the counter for a pointerdown/keydown event, at most once per event. Every capture
 * listener that reads the gesture calls this first, so the order of listeners never matters.
 */
export function noteGestureEvent(event: Event): void {
  if (event === lastAdvancingEvent) return;
  lastAdvancingEvent = event;
  gesture += 1;
}

function markClicked(): void {
  clickedGesture = gesture;
}

function listen(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  // Capture phase: the count must advance before any handler reads it. The click is observed in
  // capture too, so a consumer that stops propagation cannot hide it.
  document.addEventListener('pointerdown', noteGestureEvent, true);
  document.addEventListener('keydown', noteGestureEvent, true);
  document.addEventListener('click', markClicked, true);
}

/** Identifies the user gesture in flight: two reads returning the same value happened within one press or keystroke. */
export function currentGesture(): number {
  listen();
  return gesture;
}

/** Whether the click belonging to the current gesture already ran. */
export function currentGestureHasClicked(): boolean {
  listen();
  return clickedGesture === gesture;
}

/** Stops tracking and zeroes the state. Test-only. */
export function resetGesture(): void {
  if (listening) {
    document.removeEventListener('pointerdown', noteGestureEvent, true);
    document.removeEventListener('keydown', noteGestureEvent, true);
    document.removeEventListener('click', markClicked, true);
  }
  listening = false;
  gesture = 0;
  clickedGesture = null;
  lastAdvancingEvent = null;
}

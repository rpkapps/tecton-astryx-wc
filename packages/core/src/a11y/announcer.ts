/**
 * The Announcer (A§9.16, A§10): the only way components speak. Components never own live regions;
 * an empty `role="status"` per spinner is noise and a live region that is created together with its
 * message is often not announced at all.
 *
 * `element.ariaNotify(message, {priority})` when the engine has it; otherwise one polite and one
 * assertive light-DOM live region per document, mounted empty on first use, debounced (a burst of
 * messages is spoken as one), cleared about 2 s after speaking, and moved into the top-most modal
 * while one is open (`showModal()` makes everything outside it inert, live regions included) [mwg:persistent-top-layer-ui].
 *
 * Callers announce *state changes worth speaking* (a validation message appearing, a page loaded,
 * an item removed), once. Streaming text announces completion, not tokens.
 */
import {features} from '../features.js';
import {registerTopLayerPersistent} from '../layer/top-layer-host.js';

export interface AnnounceOptions {
  /** `polite` (default) waits for the user to be idle; `assertive` interrupts. */
  politeness?: 'polite' | 'assertive';
  /** Element the native `ariaNotify` is called on (default: the document body). */
  element?: Element;
}

interface Region {
  readonly element: HTMLElement;
  readonly stopPersisting: () => void;
  queue: string[];
  flushTimer: ReturnType<typeof setTimeout> | undefined;
  clearTimer: ReturnType<typeof setTimeout> | undefined;
}

/** A burst of messages inside this window is spoken as one update. */
const DEBOUNCE_MS = 60;
/** Regions created just now need a moment to be registered by assistive technology. */
const FIRST_USE_DELAY_MS = 150;
/** Spoken text is removed after this long, so it is not re-read when the user browses. */
const CLEAR_AFTER_MS = 2000;

const regions: {polite?: Region; assertive?: Region} = {};

const VISUALLY_HIDDEN =
  'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;' +
  'margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;' +
  'pointer-events:none;';

function createRegion(politeness: 'polite' | 'assertive'): Region {
  const element = document.createElement('div');
  element.dataset.tctAnnouncer = politeness;
  element.setAttribute('role', politeness === 'polite' ? 'status' : 'alert');
  element.setAttribute('aria-live', politeness);
  element.setAttribute('aria-atomic', 'true');
  element.style.cssText = VISUALLY_HIDDEN;
  document.body.append(element);
  const stopPersisting = registerTopLayerPersistent(element);
  return {element, stopPersisting, queue: [], flushTimer: undefined, clearTimer: undefined};
}

function regionFor(politeness: 'polite' | 'assertive'): {region: Region; created: boolean} {
  const existing = regions[politeness];
  if (existing?.element.isConnected) return {region: existing, created: false};
  existing?.stopPersisting();
  const region = createRegion(politeness);
  regions[politeness] = region;
  return {region, created: true};
}

function flush(region: Region): void {
  region.flushTimer = undefined;
  const text = region.queue.splice(0).join('. ');
  if (!text) return;
  clearTimeout(region.clearTimer);
  const speak = (): void => {
    region.element.textContent = text;
    region.clearTimer = setTimeout(() => {
      region.element.textContent = '';
    }, CLEAR_AFTER_MS);
  };
  // Clearing first makes an identical message speak again.
  if (region.element.textContent) {
    region.element.textContent = '';
    requestAnimationFrame(speak);
  } else {
    speak();
  }
}

/**
 * Speaks `message` to assistive technology. Empty messages are ignored; identical consecutive
 * messages inside the debounce window collapse into one.
 */
export function announce(message: string, options: AnnounceOptions = {}): void {
  const text = message.trim();
  if (!text || typeof document === 'undefined') return;
  const politeness = options.politeness ?? 'polite';

  if (features.ariaNotify) {
    (options.element ?? document.body).ariaNotify?.(text, {
      priority: politeness === 'assertive' ? 'high' : 'normal',
    });
    return;
  }

  const {region, created} = regionFor(politeness);
  if (region.queue[region.queue.length - 1] === text) return;
  region.queue.push(text);
  if (region.flushTimer === undefined) {
    region.flushTimer = setTimeout(
      () => {
        flush(region);
      },
      created ? FIRST_USE_DELAY_MS : DEBOUNCE_MS,
    );
  }
}

/** Drops pending messages and empties both regions (navigation, a dismissed toast). */
export function clearAnnouncements(): void {
  for (const region of [regions.polite, regions.assertive]) {
    if (!region) continue;
    region.queue = [];
    clearTimeout(region.flushTimer);
    clearTimeout(region.clearTimer);
    region.flushTimer = undefined;
    region.element.textContent = '';
  }
}

/** The live regions (tests and diagnostics); undefined before first use or when `ariaNotify` is used. */
export function getAnnouncerRegions(): {polite?: HTMLElement; assertive?: HTMLElement} {
  return {polite: regions.polite?.element, assertive: regions.assertive?.element};
}

/** Removes both regions and pending timers. Test-only. */
export function resetAnnouncer(): void {
  clearAnnouncements();
  for (const key of ['polite', 'assertive'] as const) {
    regions[key]?.stopPersisting();
    regions[key]?.element.remove();
    regions[key] = undefined;
  }
}

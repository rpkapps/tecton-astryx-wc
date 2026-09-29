/**
 * Platform capability probes (A§9.5, A§1). Every guarded API goes through `features`, so Tier-2
 * behaviour can be forced in one place (`overrideFeature`, or `TCT_TIER2=1` in the test setup) and the
 * fallbacks are tested once. Direct `'x' in Element.prototype` checks elsewhere are a lint error.
 *
 * Probes are lazy and read at call time (never cached by consumers), so an override applies to code
 * that already ran its import. Nothing here touches the DOM at import time (Node-safe, A§14).
 * Guides: [mwg:prerendering-custom-elements] [mwg:web-components]
 */

export interface Features {
  /** Popover API (`popover`, `showPopover`). Tier 1 everywhere; guarded for Tier 2. */
  readonly popover: boolean;
  /** `showPopover({source})` implicitly anchors CSS anchor positioning (layout probe, cached). */
  readonly implicitAnchor: boolean;
  /** CSS anchor positioning (`position-area`). */
  readonly anchorPositioning: boolean;
  /** ARIA element reflection (`ariaLabelledByElements`, `ariaActiveDescendantElement`, ...). */
  readonly elementReflection: boolean;
  /** `ElementInternals#states` with `:state()`. */
  readonly customStates: boolean;
  /** `HTMLDialogElement#requestClose()`. */
  readonly requestClose: boolean;
  /** `CloseWatcher` (Android back, platform close requests). Not in every Tier-1 engine. */
  readonly closeWatcher: boolean;
  /** `<dialog closedby>`. Not in every Tier-1 engine. */
  readonly dialogClosedBy: boolean;
  /** `Element#moveBefore()`. Not in every Tier-1 engine. */
  readonly moveBefore: boolean;
  /** `Element#ariaNotify()`. Not in every Tier-1 engine. */
  readonly ariaNotify: boolean;
  /** Invoker commands (`commandfor`/`command`). Not in every Tier-1 engine. */
  readonly invokerCommands: boolean;
  /** `hidden="until-found"` (`beforematch`). Not in every Tier-1 engine. */
  readonly hiddenUntilFound: boolean;
  /** Reference Target (`shadowRoot.referenceTarget`). Not in every Tier-1 engine. */
  readonly referenceTarget: boolean;
  /** Native Sanitizer API (`Element#setHTML`). Not in every Tier-1 engine. */
  readonly sanitizer: boolean;
  /** CSS `field-sizing`. Not in every Tier-1 engine. */
  readonly fieldSizing: boolean;
  /** CSS `light-dark()`. */
  readonly lightDark: boolean;
  /** `focus({focusVisible})`. Not in every Tier-1 engine. */
  readonly focusVisibleOption: boolean;
}

export type FeatureName = keyof Features;

const hasDom = (): boolean => typeof document !== 'undefined' && typeof HTMLElement !== 'undefined';

const cssSupports = (property: string, value: string): boolean =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value);

/**
 * Layout probe: does `showPopover({source})` make the source the popover's implicit anchor? A popover
 * is placed with `position-area` and must land directly under its source. Returns `undefined` when
 * the document has no layout yet (hidden iframe), so the answer is not cached.
 */
function probeImplicitAnchor(): boolean | undefined {
  if (!hasDom() || !PROBES.popover() || !PROBES.anchorPositioning()) return false;
  const host = document.body ?? document.documentElement;
  const source = document.createElement('button');
  const surface = document.createElement('div');
  source.style.cssText =
    'position:fixed;inset-block-start:96px;inset-inline-start:96px;inline-size:24px;block-size:24px;margin:0;padding:0;border:0;';
  surface.setAttribute('popover', 'manual');
  surface.style.cssText =
    'position:fixed;inset:auto;margin:0;padding:0;border:0;inline-size:16px;block-size:16px;position-area:block-end;';
  host.append(source, surface);
  try {
    surface.showPopover({source});
    const anchor = source.getBoundingClientRect();
    const placed = surface.getBoundingClientRect();
    if (anchor.width === 0) return undefined;
    return (
      Math.abs(placed.top - anchor.bottom) < 1 &&
      Math.abs(placed.left + placed.width / 2 - (anchor.left + anchor.width / 2)) < 1
    );
  } catch {
    return false;
  } finally {
    try {
      surface.hidePopover();
    } catch {
      // Not shown: nothing to hide.
    }
    source.remove();
    surface.remove();
  }
}

/** Probes return `undefined` when they cannot decide yet (nothing is cached then). */
const PROBES: Record<FeatureName, () => boolean | undefined> = {
  popover: () =>
    hasDom() && 'popover' in HTMLElement.prototype && 'showPopover' in HTMLElement.prototype,
  implicitAnchor: probeImplicitAnchor,
  anchorPositioning: () =>
    hasDom() && cssSupports('position-area', 'block-end') && cssSupports('anchor-name', '--a'),
  elementReflection: () =>
    hasDom() &&
    'ariaLabelledByElements' in Element.prototype &&
    'ariaActiveDescendantElement' in Element.prototype,
  customStates: () =>
    hasDom() && typeof CustomStateSet === 'function' && 'states' in ElementInternals.prototype,
  requestClose: () => hasDom() && 'requestClose' in HTMLDialogElement.prototype,
  closeWatcher: () => hasDom() && typeof CloseWatcher === 'function',
  dialogClosedBy: () => hasDom() && 'closedBy' in HTMLDialogElement.prototype,
  moveBefore: () => hasDom() && 'moveBefore' in Element.prototype,
  ariaNotify: () => hasDom() && 'ariaNotify' in Element.prototype,
  invokerCommands: () => hasDom() && 'commandForElement' in HTMLButtonElement.prototype,
  hiddenUntilFound: () => hasDom() && 'onbeforematch' in HTMLElement.prototype,
  referenceTarget: () => hasDom() && 'referenceTarget' in ShadowRoot.prototype,
  sanitizer: () => hasDom() && 'setHTML' in Element.prototype,
  fieldSizing: () => cssSupports('field-sizing', 'content'),
  lightDark: () => cssSupports('color', 'light-dark(red, blue)'),
  focusVisibleOption: () => {
    if (!hasDom()) return false;
    let read = false;
    const options = {
      get focusVisible() {
        read = true;
        return true;
      },
    };
    document.createElement('div').focus(options);
    return read;
  },
};

const NAMES = Object.keys(PROBES) as FeatureName[];
const overrides = new Map<FeatureName, boolean>();
const cache = new Map<FeatureName, boolean>();

function resolve(name: FeatureName): boolean {
  const forced = overrides.get(name);
  if (forced !== undefined) return forced;
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  let value: boolean | undefined;
  try {
    value = PROBES[name]();
  } catch {
    value = false;
  }
  if (value !== undefined) cache.set(name, value);
  return value ?? false;
}

/** Live capability flags. Property reads run (and cache) the probe; overrides win. */
export const features: Features = Object.defineProperties(
  {} as Record<FeatureName, boolean>,
  Object.fromEntries(
    NAMES.map((name) => [name, {get: () => resolve(name), enumerable: true}] as const),
  ),
);

/**
 * Test hook: forces `name` on or off for every reader until the returned function restores the
 * previous state. Overrides stack (restore in reverse order).
 */
export function overrideFeature(name: FeatureName, value: boolean): () => void {
  const had = overrides.has(name);
  const previous = overrides.get(name);
  overrides.set(name, value);
  return () => {
    if (had && previous !== undefined) overrides.set(name, previous);
    else overrides.delete(name);
  };
}

/** Test hook: drops every override and cached probe result. */
export function resetFeatures(): void {
  overrides.clear();
  cache.clear();
}

/** Live `prefers-reduced-motion: reduce` (read at call time; false without `matchMedia`). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

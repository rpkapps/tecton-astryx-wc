/**
 * Where a theme's component overrides land (A§6.3). Themes address a component by a stable target key
 * (`button`, `hover-card`); upstream that key is the class on the target element. The web components
 * expose the same targets as shadow parts, so a component key resolves to a tag and a part:
 *
 * ```ts
 * resolveThemingTarget('button'); // {tag: 'tct-button', part: 'button'}
 * // components.button['variant:secondary'] -> tct-button[variant="secondary"]::part(button) {…}
 * ```
 *
 * The part is documented on each element with `@csspart <name> … (theme target \`<key>\`)`.
 * The table is read from the custom elements manifest with {@link themingTargetsFromCem} and
 * registered once; until then a key falls back to the convention `tct-<key>` with part `base`.
 */

/** A resolved target: the element and the part that carries its painting (`undefined`: the host). */
export interface ThemingTarget {
  tag: string;
  part?: string;
}

/** Targets shipped with the elements that already exist; everything else is registered or conventional. */
const BUILT_IN: Readonly<Record<string, ThemingTarget>> = {
  button: {tag: 'tct-button', part: 'button'},
  heading: {tag: 'tct-heading', part: 'text'},
  icon: {tag: 'tct-icon', part: 'icon'},
  text: {tag: 'tct-text', part: 'text'},
};

/** Renamed target keys: a theme written against the old key still lands on the same element. */
const DEPRECATED_KEYS: Readonly<Record<string, string>> = {
  hovercard: 'hover-card',
  'progressbar-mark': 'progress-bar-mark',
  textarea: 'text-area',
};

const registered = new Map<string, ThemingTarget>();

/** Adds (or replaces) targets, keyed by component key (the theme target key). */
export function registerThemingTargets(targets: Readonly<Record<string, ThemingTarget>>): void {
  for (const [key, target] of Object.entries(targets)) registered.set(key, target);
}

/** Forgets every registered target. Test-only. */
export function resetThemingTargets(): void {
  registered.clear();
}

/** The tag and part a component key styles. Falls back to `tct-<key>` with part `base`. */
export function resolveThemingTarget(component: string): ThemingTarget {
  const key = DEPRECATED_KEYS[component] ?? component;
  return registered.get(key) ?? BUILT_IN[key] ?? {tag: `tct-${key}`, part: 'base'};
}

interface CemPart {
  name?: unknown;
  description?: unknown;
}
interface CemDeclaration {
  tagName?: unknown;
  cssParts?: unknown;
}
interface CemModule {
  declarations?: unknown;
}

const TARGET_PATTERN = /theme targets? `([a-z0-9-]+)`/g;

/**
 * Reads the targets out of a custom elements manifest: every `@csspart` whose description carries
 * `(theme target \`<key>\`)` maps `<key>` to that element and part. Register the result with
 * {@link registerThemingTargets}.
 */
export function themingTargetsFromCem(manifest: unknown): Record<string, ThemingTarget> {
  const targets: Record<string, ThemingTarget> = {};
  const modules = (manifest as {modules?: unknown} | null)?.modules;
  if (!Array.isArray(modules)) return targets;
  for (const module of modules as CemModule[]) {
    if (!Array.isArray(module.declarations)) continue;
    for (const declaration of module.declarations as CemDeclaration[]) {
      if (typeof declaration.tagName !== 'string' || !Array.isArray(declaration.cssParts)) continue;
      for (const part of declaration.cssParts as CemPart[]) {
        if (typeof part.name !== 'string' || typeof part.description !== 'string') continue;
        for (const match of part.description.matchAll(TARGET_PATTERN)) {
          targets[match[1]!] = {tag: declaration.tagName, part: part.name};
        }
      }
    }
  }
  return targets;
}

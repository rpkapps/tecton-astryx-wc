/**
 * Icon registry (A§12, A-13): names to icon data. `tct-icon` renders `IconDefinition`s through Lit
 * `svg` templates (never `unsafeSVG`); this module only stores them. Sets are data modules
 * (`@tecton-astryx/icons/...`), registered by the application or, for the default set, by `tct-icon`
 * on its first connect at the lowest priority so consumer registrations always win.
 */

export interface IconDefinition {
  /** e.g. `'0 0 24 24'`. */
  viewBox: string;
  paths: readonly {d: string; fillRule?: 'evenodd' | 'nonzero'}[];
  /** `stroke`: drawn with `strokeWidth` (`--icon-stroke-width` may override it). */
  mode: 'fill' | 'stroke';
  strokeWidth?: number;
  /** Mirror in right-to-left contexts (chevrons, arrows). */
  mirrorInRtl?: boolean;
  /** Does not inherit `currentColor`. */
  colored?: boolean;
}

export type IconLoader = () => Promise<IconDefinition>;

export interface RegisterIconsOptions {
  /** Prefix: `registerIcons({close}, {namespace: 'lucide'})` registers `lucide:close`. */
  namespace?: string;
  /**
   * `'default'` registers into the lowest-priority layer (what `tct-icon` does for the built-in
   * set); `'normal'` (default) overrides it.
   */
  priority?: 'default' | 'normal';
}

type Entry = IconDefinition | IconLoader;

const layers = {default: new Map<string, Entry>(), normal: new Map<string, Entry>()};
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of [...listeners]) listener();
};

/** Registers (merging, later wins) icons by name. Notifies subscribers so rendered icons refresh. */
export function registerIcons(
  icons: Record<string, IconDefinition | IconLoader>,
  options: RegisterIconsOptions = {},
): void {
  const layer = layers[options.priority ?? 'normal'];
  const prefix = options.namespace ? `${options.namespace}:` : '';
  for (const [name, entry] of Object.entries(icons)) layer.set(`${prefix}${name}`, entry);
  notify();
}

/** The definition (or lazy loader) for `name`; consumer registrations beat the default set. */
export function getIcon(name: string): IconDefinition | IconLoader | undefined {
  return layers.normal.get(name) ?? layers.default.get(name);
}

/** Whether `name` is registered in any layer. */
export function hasIcon(name: string): boolean {
  return getIcon(name) !== undefined;
}

/** Every registered name (both layers, deduplicated, sorted). */
export function getIconNames(): string[] {
  return [...new Set([...layers.default.keys(), ...layers.normal.keys()])].sort();
}

/** Subscribes to registrations (so a rendered `tct-icon` can pick up an icon registered later). */
export function onIconsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Removes every icon from both layers. */
export function resetIcons(): void {
  layers.default.clear();
  layers.normal.clear();
  notify();
}

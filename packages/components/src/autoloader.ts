/**
 * Autoloader (A§2.5): registers component families lazily, the first time one of their tags is seen.
 *
 * ```html
 * <script type="module" src=".../cdn/autoloader.js"></script>   <!-- or import '@tecton-wc/components/autoloader.js' -->
 * <html data-tct-preload="button dialog">                        <!-- optional: load these families up front -->
 * ```
 *
 * One `MutationObserver` on the document finds `tct-*` tags that are not defined yet and imports the
 * family's `define.js` (a literal dynamic import per folder, generated from the Custom Elements
 * Manifest, so bundlers split every family). Elements our components render inside their own shadow
 * roots are defined through `static dependencies`, so those roots are never observed; an application's
 * own shadow roots opt in with `observe(root)`. Importing this module in Node does nothing.
 * Guides: [mwg:custom-elements] (upgrade timing: an element may exist before its class is defined).
 */
import {autoloaderMap, folderLoaders} from './generated/autoloader-map.js';

export interface AutoloaderOptions {
  /** tag name -> family folder */
  map: Readonly<Record<string, string>>;
  /** family folder -> lazy registration */
  loaders: Readonly<Record<string, () => Promise<unknown>>>;
}

export interface Autoloader {
  /** Loads the families of every undefined `tct-*` tag found in `root` (and `root` itself). */
  discover(root?: ParentNode): void;
  /** `discover(root)` plus a MutationObserver for later additions. Returns a function that stops it. */
  observe(root?: Document | ShadowRoot | Element): () => void;
  /** Loads families by folder name (or tag name). */
  preload(families: Iterable<string>): void;
  /** Folders whose load has started. */
  readonly requested: ReadonlySet<string>;
}

export function createAutoloader(options: AutoloaderOptions): Autoloader {
  const {map, loaders} = options;
  const requested = new Set<string>();
  const observers = new WeakMap<Node, {stop: () => void}>();
  const selector = Object.keys(map).join(',');

  const load = (folder: string): void => {
    if (requested.has(folder)) return;
    const loader = loaders[folder];
    if (!loader) return;
    requested.add(folder);
    loader().catch((error: unknown) => {
      // Allow a later sighting to retry (a flaky network, a chunk that 404ed once).
      requested.delete(folder);
      console.warn(`[tecton] Could not load the "${folder}" components.`, error);
    });
  };

  const handle = (element: Element): void => {
    const tag = element.localName;
    const folder = map[tag];
    if (folder === undefined || customElements.get(tag) !== undefined) return;
    load(folder);
  };

  const discover = (root: ParentNode = document): void => {
    if (selector === '') return;
    if (root instanceof Element && root.matches(selector)) handle(root);
    for (const element of root.querySelectorAll(selector)) handle(element);
  };

  const observe = (root: Document | ShadowRoot | Element = document): (() => void) => {
    const existing = observers.get(root);
    if (existing) return existing.stop;
    discover(root);
    if (typeof MutationObserver === 'undefined' || selector === '') return () => undefined;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) discover(node);
        }
      }
    });
    observer.observe(root, {childList: true, subtree: true});
    const stop = () => {
      observer.disconnect();
      observers.delete(root);
    };
    observers.set(root, {stop});
    return stop;
  };

  const preload = (families: Iterable<string>): void => {
    for (const family of families) load(map[family] ?? family);
  };

  return {discover, observe, preload, requested};
}

const autoloader = createAutoloader({map: autoloaderMap, loaders: folderLoaders});

export const discover: Autoloader['discover'] = (root) => {
  autoloader.discover(root);
};
export const observe: Autoloader['observe'] = (root) => autoloader.observe(root);
export const preload: Autoloader['preload'] = (families) => {
  autoloader.preload(families);
};

function start(): void {
  const attribute = document.documentElement.getAttribute('data-tct-preload');
  if (attribute) autoloader.preload(attribute.split(/\s+/).filter(Boolean));
  autoloader.observe(document);
}

// Browser only: importing the module on a server registers nothing and touches no globals.
if (typeof document !== 'undefined' && typeof customElements !== 'undefined') start();

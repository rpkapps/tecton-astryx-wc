/**
 * Fixtures (A§15.2): render a Lit template (or an HTML string) into a fresh container attached to
 * `document.body`, wait until every `tct-*` element inside (including nested shadow roots) has
 * finished updating, and clean up after each test (the setup file calls `cleanupFixtures`).
 *
 * ```ts
 * const button = await fixture<TctButton>(html`<tct-button>Save</tct-button>`, {dir: 'rtl'});
 * ```
 */
import {render, type TemplateResult} from 'lit';

const containers = new Set<HTMLElement>();

export interface FixtureOptions {
  /** `dir` on the container (for RTL checks). */
  dir?: 'ltr' | 'rtl';
  /** `lang` on the container (locale resolution reads the nearest `lang`). */
  lang?: string;
  /** `data-theme` on the container. */
  theme?: 'light' | 'dark';
}

/** Every element under `root` (light DOM and open shadow roots) matching `predicate`, document order. */
export function deepQueryAll(
  root: ParentNode,
  predicate: (element: Element) => boolean,
): Element[] {
  const out: Element[] = [];
  const walk = (node: ParentNode): void => {
    for (const element of node.querySelectorAll('*')) {
      if (predicate(element)) out.push(element);
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(root);
  return out;
}

const isLibraryElement = (element: Element): boolean => element.localName.startsWith('tct-');

/**
 * Resolves when every `tct-*` element under `root` (and in nested shadow roots) has finished
 * updating. Several passes: elements rendered by a first update settle in the next. Tags that are not
 * defined are skipped, never awaited (a missing `define` must fail the test, not hang it).
 */
export async function settle(root: ParentNode): Promise<void> {
  type Updatable = Element & {updateComplete?: Promise<unknown>; isUpdatePending?: boolean};
  let previousCount = -1;
  for (let pass = 0; pass < 10; pass++) {
    const elements = deepQueryAll(root, isLibraryElement) as Updatable[];
    await Promise.all(elements.map((element) => element.updateComplete ?? Promise.resolve()));
    // Stable when no element is still updating and the set of elements did not grow (a first
    // update may render children whose own update starts afterwards).
    if (
      elements.length === previousCount &&
      elements.every((element) => !element.isUpdatePending)
    ) {
      return;
    }
    previousCount = elements.length;
  }
}

/**
 * Renders `template` and returns the first element child of the container once everything settled.
 * The container is removed after the test.
 */
export async function fixture<T extends Element = HTMLElement>(
  template: TemplateResult | string,
  options: FixtureOptions = {},
): Promise<T> {
  const container = document.createElement('div');
  container.dataset.testFixture = '';
  if (options.dir) container.dir = options.dir;
  if (options.lang) container.lang = options.lang;
  if (options.theme) container.dataset.theme = options.theme;
  document.body.append(container);
  containers.add(container);
  if (typeof template === 'string') {
    // Test-only: fixture markup is authored in the test file.
    container.innerHTML = template;
  } else {
    render(template, container);
  }
  await settle(container);
  return container.firstElementChild as T;
}

/** The container of the most recent fixture (for tests that need siblings or `dir`). */
export function fixtureRoot(element: Element): HTMLElement {
  const root = element.closest<HTMLElement>('[data-test-fixture]');
  if (!root) throw new Error('fixtureRoot: element is not inside a fixture');
  return root;
}

/** Removes every fixture container. Called after each test by `setup.ts`. */
export function cleanupFixtures(): void {
  for (const container of containers) {
    render(null, container);
    container.remove();
  }
  containers.clear();
}

import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctDivider} from '../divider/tct-divider.js';
import base from '../styles/base.styles.css';
import {topNavRenderContext} from './top-nav.context.js';
import styles from './tct-top-nav-drawer.styles.css';

/** Properties a menu carries that an attribute copy does not: set on the copy from the original. */
const COPIED_PROPERTIES = ['items'] as const;

/**
 * The top navigation's items in the mobile drawer of a `tct-app-shell`. The shell's drawer shows what is
 * slotted into it, and the items are children of the top navigation, which is slotted into the header; a
 * node can be projected into one place only. So below the mobile breakpoint the top navigation adds this
 * element to the shell (`slot="drawer"`), and it shows a *copy* of the top navigation's start and centre
 * items in the drawer, in the `drawer` render mode (vertical rows, collapsible sections for the menus).
 * A click on a copy is forwarded to the original as a click event, so the page's listeners on the items
 * still run (and can cancel the navigation); the copies are rebuilt whenever the originals change.
 *
 * Created and removed by `tct-top-nav`; never author it.
 *
 * @internal
 */
export class TctTopNavDrawer extends TctElement {
  static override readonly tagName = 'tct-top-nav-drawer';
  static override readonly dependencies = [TctDivider];
  static override styles: CSSResultGroup = [base, styles];

  /** The originals whose copies are shown. */
  @property({attribute: false}) sources: readonly Element[] = [];

  /** The accessible name of the list of items (the top navigation's label). */
  @property() label = '';

  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #originals = new WeakMap<Element, Element>();
  #copies: Element[] = [];

  constructor() {
    super();
    new ContextProvider(this, {context: topNavRenderContext, initialValue: 'drawer'});
  }

  /** Rebuilds the copies from the originals (call after they changed). */
  refresh(): void {
    this.#rebuild();
    this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('sources')) this.#rebuild();
  }

  #rebuild(): void {
    const previous = this.#copies;
    this.#copies = this.sources.map((source, index) => {
      const copy = source.cloneNode(true) as Element;
      this.#originals.set(copy, source);
      // The tree of a copy mirrors its original, so the pairs can be found again from any node inside.
      const pairs: [Element, Element][] = [[copy, source]];
      const walk = (from: Element, to: Element): void => {
        [...from.children].forEach((child, i) => {
          const twin = to.children[i];
          if (twin) {
            this.#originals.set(twin, child);
            pairs.push([twin, child]);
            walk(child, twin);
          }
        });
      };
      walk(source, copy);
      for (const [twin, original] of pairs) {
        // No duplicate ids, no state that belongs to the original's own panel, and no slot of the original.
        twin.removeAttribute('id');
        twin.removeAttribute('open');
        twin.removeAttribute('slot');
        for (const name of COPIED_PROPERTIES) {
          if (name in original) (twin as unknown as Record<string, unknown>)[name] = (original as unknown as Record<string, unknown>)[name];
        }
      }
      // A section the user expanded stays expanded across a rebuild.
      const before = previous[index];
      if (before?.localName === copy.localName && 'drawerExpanded' in before) {
        (copy as unknown as {drawerExpanded: boolean}).drawerExpanded = (
          before as unknown as {drawerExpanded: boolean}
        ).drawerExpanded;
      }
      return copy;
    });
  }

  /** A click on a copy is a click on its original, first: the page's listeners run and may cancel it. */
  readonly #onClick = (event: MouseEvent): void => {
    if (!event.isTrusted && event.detail === -1) return;
    const path = event.composedPath();
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const original = this.#originals.get(node);
      if (!original) continue;
      const forwarded = new MouseEvent('click', {
        bubbles: true,
        composed: true,
        cancelable: true,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        detail: -1,
      });
      if (!original.dispatchEvent(forwarded)) event.preventDefault();
      return;
    }
  };

  override render(): TemplateResult | typeof nothing {
    if (this.#copies.length === 0) return nothing;
    return html`<nav
        class="list"
        part="base"
        aria-label=${this.label}
        @click=${{handleEvent: this.#onClick, capture: true}}
      >
        ${this.#copies}
      </nav>
      ${this.#shell.value.hasSideNav ? html`<tct-divider class="divider"></tct-divider>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-drawer': TctTopNavDrawer;
  }
}

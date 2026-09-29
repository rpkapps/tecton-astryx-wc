/**
 * ARIA delegation (A§9.6) for elements that wrap one native control in their shadow root
 * (`tct-button` -> `<button>`, `tct-checkbox-input` -> `<input type=checkbox>`). Authors and other
 * components put ARIA on the **host** (`<tct-button aria-label="Close">`, `aria-expanded` set by a
 * layer controller on its trigger, `aria-describedby="hint"` set by a field); the inner control is
 * the node assistive technology actually sees, so the host's attributes are mirrored onto it:
 *
 *  - plain attributes (`aria-label`, `aria-expanded`, `aria-pressed`, ...) are copied;
 *  - ID-reference attributes (`aria-labelledby`, `aria-describedby`, `aria-controls`, ...) are
 *    resolved in the host's tree scope and set as element references (`ariaLabelledByElements`),
 *    because ids never resolve across a shadow boundary [mwg:accessible-web-components];
 *  - **Tier 2** (no element reflection): `aria-labelledby` becomes the referenced elements' text as
 *    `aria-label`, `aria-describedby` becomes `aria-description`; relationships that cannot be
 *    expressed as text (`controls`, `owns`, `details`, `errormessage`, `activedescendant`) are
 *    dropped, and components that need them stay within one tree (A§8.2).
 *
 * The host keeps its attributes: they stay the source of truth (frameworks update them, tests read
 * them). Hosts carry no role, so the attributes are inert there.
 *
 * ```ts
 * #aria = new AriaDelegateController(this, {target: () => this.renderRoot.querySelector('button')});
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {features} from '../features.js';

/** Host attributes mirrored onto the inner control. */
export const DELEGATED_ARIA_ATTRIBUTES = [
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-errormessage',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-expanded',
  'aria-haspopup',
  'aria-pressed',
  'aria-disabled',
  'aria-current',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-roledescription',
  'aria-autocomplete',
  'aria-busy',
] as const;

type ElementListProperty =
  | 'ariaLabelledByElements'
  | 'ariaDescribedByElements'
  | 'ariaDetailsElements'
  | 'ariaErrorMessageElements'
  | 'ariaControlsElements'
  | 'ariaOwnsElements';

/** ID-reference attributes and the element-reflection property that replaces them. */
export const IDREF_ARIA: Readonly<
  Record<string, ElementListProperty | 'ariaActiveDescendantElement'>
> = {
  'aria-labelledby': 'ariaLabelledByElements',
  'aria-describedby': 'ariaDescribedByElements',
  'aria-details': 'ariaDetailsElements',
  'aria-errormessage': 'ariaErrorMessageElements',
  'aria-controls': 'ariaControlsElements',
  'aria-owns': 'ariaOwnsElements',
  'aria-activedescendant': 'ariaActiveDescendantElement',
};

/** Resolves a space-separated id list in `scope`'s tree (document or shadow root); missing ids are skipped. */
export function resolveIdRefs(scope: Node, ids: string | null): Element[] {
  if (!ids) return [];
  const root = scope.getRootNode() as Document | ShadowRoot;
  return ids
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => root.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);
}

/** Sets (or, with `null`/`undefined`, clears) an element-reflection ARIA property. */
export function setAriaElements(
  element: Element,
  property: ElementListProperty | 'ariaActiveDescendantElement',
  value: Element[] | Element | null | undefined,
): void {
  const target = element as unknown as Record<string, unknown>;
  if (property === 'ariaActiveDescendantElement') {
    target[property] = Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    return;
  }
  const list =
    value === null || value === undefined ? null : Array.isArray(value) ? value : [value];
  target[property] = list && list.length > 0 ? list : null;
}

/** Text an element contributes to a name/description (its `aria-label`, else its text). */
export function accessibleText(element: Element): string {
  return (element.getAttribute('aria-label') ?? element.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AriaDelegateOptions {
  /** The inner control (re-read on every sync, so it may change between renders). */
  target: () => Element | null | undefined;
  /**
   * Attributes the component manages itself on the control (never delegated or overwritten). A
   * function is re-read on every sync.
   */
  exclude?: readonly string[] | (() => readonly string[]);
  /**
   * Label elements used when the host has neither `aria-labelledby` nor `aria-label`, e.g. the
   * `<label for>` elements of a form control (`internals.labels`).
   */
  labels?: () => Element[];
}

/**
 * Mirrors the host's `aria-*` attributes onto an inner control. Syncs on connect, after every host
 * update, whenever a host `aria-*` attribute changes, and on `focusin` (so id references that
 * appeared later are picked up before assistive technology reads the name).
 */
export class AriaDelegateController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: AriaDelegateOptions;
  #observer: MutationObserver | undefined;
  /** Attributes/properties written on the current target, to remove them when the host drops them. */
  readonly #written = new Set<string>();
  #lastTarget: Element | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement, options: AriaDelegateOptions) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  hostConnected(): void {
    this.#observer ??= new MutationObserver(() => {
      this.sync();
    });
    this.#observer.observe(this.#host, {
      attributes: true,
      attributeFilter: [...DELEGATED_ARIA_ATTRIBUTES],
    });
    this.#host.addEventListener('focusin', this.#onFocusIn);
    this.sync();
  }

  hostDisconnected(): void {
    this.#observer?.disconnect();
    this.#host.removeEventListener('focusin', this.#onFocusIn);
  }

  hostUpdated(): void {
    this.sync();
  }

  readonly #onFocusIn = (): void => {
    this.sync();
  };

  /** Re-applies every delegated attribute to the current target. Cheap; call it whenever in doubt. */
  sync(): void {
    const target = this.#options.target();
    if (!target) return;
    if (target !== this.#lastTarget) {
      this.#written.clear();
      this.#lastTarget = target;
    }
    const option = this.#options.exclude ?? [];
    const exclude = typeof option === 'function' ? option() : option;
    const reflection = features.elementReflection;

    for (const name of DELEGATED_ARIA_ATTRIBUTES) {
      if (exclude.includes(name)) continue;
      if (name === 'aria-labelledby' || name === 'aria-label' || name === 'aria-describedby')
        continue;
      if (name === 'aria-description' && !reflection) continue; // merged with describedby below
      const value = this.#host.getAttribute(name);
      const property = IDREF_ARIA[name];
      if (property) {
        // Relationships without a text equivalent exist only through element reflection.
        if (!reflection) continue;
        if (value !== null) {
          setAriaElements(target, property, resolveIdRefs(this.#host, value));
          this.#written.add(name);
        } else if (this.#written.delete(name)) {
          setAriaElements(target, property, null);
        }
        continue;
      }
      this.#mirrorPlain(target, name, value);
    }
    if (!exclude.includes('aria-label') || !exclude.includes('aria-labelledby')) {
      this.#syncName(target, exclude, reflection);
    }
    if (!exclude.includes('aria-describedby')) this.#syncDescription(target, reflection);
  }

  #mirrorPlain(target: Element, name: string, value: string | null): void {
    if (value !== null) {
      if (target.getAttribute(name) !== value) target.setAttribute(name, value);
      this.#written.add(name);
    } else if (this.#written.delete(name)) {
      target.removeAttribute(name);
    }
  }

  /** `aria-label` and `aria-labelledby` (plus `labels`) together, because either may yield the name. */
  #syncName(target: Element, exclude: readonly string[], reflection: boolean): void {
    const host = this.#host;
    const explicit = host.getAttribute('aria-labelledby');
    const own = host.getAttribute('aria-label');
    let elements: Element[] = [];
    if (explicit !== null && !exclude.includes('aria-labelledby'))
      elements = resolveIdRefs(host, explicit);
    else if (own === null) elements = this.#options.labels?.() ?? [];

    if (reflection) {
      if (!exclude.includes('aria-label')) this.#mirrorPlain(target, 'aria-label', own);
      if (exclude.includes('aria-labelledby')) return;
      if (elements.length > 0) {
        setAriaElements(target, 'ariaLabelledByElements', elements);
        this.#written.add('aria-labelledby');
      } else if (this.#written.delete('aria-labelledby')) {
        setAriaElements(target, 'ariaLabelledByElements', null);
      }
      return;
    }
    // Tier 2: copy the referenced text (accessible-name precedence: labelledby beats aria-label).
    const text = elements.map(accessibleText).filter(Boolean).join(' ');
    if (!exclude.includes('aria-label')) this.#mirrorPlain(target, 'aria-label', text || own);
  }

  #syncDescription(target: Element, reflection: boolean): void {
    const host = this.#host;
    const ids = host.getAttribute('aria-describedby');
    if (reflection) {
      if (ids !== null) {
        setAriaElements(target, 'ariaDescribedByElements', resolveIdRefs(host, ids));
        this.#written.add('aria-describedby');
      } else if (this.#written.delete('aria-describedby')) {
        setAriaElements(target, 'ariaDescribedByElements', null);
      }
      return;
    }
    const own = host.getAttribute('aria-description');
    const text = resolveIdRefs(host, ids).map(accessibleText).filter(Boolean).join(' ');
    this.#mirrorPlain(target, 'aria-description', text || own);
  }
}

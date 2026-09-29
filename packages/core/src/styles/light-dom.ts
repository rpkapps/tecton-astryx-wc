/**
 * Light-DOM component styling delivery (A§6.7). Light-DOM families ship `tct-<name>.light.css` in
 * `@layer tecton.light-dom`; the static `light-dom.css` serves SSR/no-JS pages, and this helper
 * appends the same sheet at runtime to the root node that contains the host (document or shadow
 * root) so components rendered into an application's shadow root are styled too.
 * Guides: [mwg:styling-web-components]
 */
import type {CSSResult} from 'lit';

const adopted = new WeakMap<Node, Set<CSSStyleSheet | string>>();

/**
 * Appends `sheet` to `host.getRootNode().adoptedStyleSheets` once per root (never replaces existing
 * sheets). Accepts a constructed stylesheet or a Lit `css` result. Falls back to a `<style>`
 * element where adopted stylesheets are unavailable. Returns true when something was added.
 */
export function adoptLightDomStyles(host: Element, sheet: CSSStyleSheet | CSSResult): boolean {
  const root = host.getRootNode();
  if (!(root instanceof Document) && !(root instanceof ShadowRoot)) return false;

  const key: CSSStyleSheet | string =
    'styleSheet' in sheet ? (sheet.styleSheet ?? sheet.cssText) : sheet;
  let seen = adopted.get(root);
  if (!seen) adopted.set(root, (seen = new Set()));
  if (seen.has(key)) return false;

  if (key instanceof CSSStyleSheet) {
    try {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, key];
      seen.add(key);
      return true;
    } catch {
      // Cross-realm sheet or a frozen array: fall through to a <style> element.
    }
  }
  const style = (root instanceof Document ? root : root.ownerDocument).createElement('style');
  style.textContent = typeof key === 'string' ? key : sheetText(key);
  style.dataset.tctLightDom = '';
  (root instanceof Document ? root.head : root).append(style);
  seen.add(key);
  return true;
}

function sheetText(sheet: CSSStyleSheet): string {
  return Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
}

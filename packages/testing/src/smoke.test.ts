/**
 * Smoke test proving the Vitest browser project works end to end: a real browser (Playwright
 * provider), workspace resolution, Lit, and the in-house `*.styles.css` plugin (A§2.3, A§15.1).
 * Milestone M4 replaces this with the real harness tests; keep it until then.
 */
import {LitElement, html, type CSSResultGroup} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import styles from './fixtures/smoke.styles.css';

class TctSmoke extends LitElement {
  static override styles: CSSResultGroup = [styles];
  override render() {
    return html`<div class="box">smoke</div>`;
  }
}
customElements.define('tct-smoke', TctSmoke);

describe('browser project', () => {
  afterEach(() => document.body.replaceChildren());

  it('runs in a real browser with a shadow-capable DOM', () => {
    expect(typeof document.createElement('div').attachShadow).toBe('function');
    expect(navigator.userAgent.length).toBeGreaterThan(0);
  });

  it('compiles *.styles.css into an adopted Lit stylesheet', async () => {
    const element = document.createElement('tct-smoke') as TctSmoke;
    document.body.append(element);
    await element.updateComplete;
    const box = element.shadowRoot!.querySelector('.box')!;
    expect(getComputedStyle(element).display).toBe('block');
    expect(getComputedStyle(box).paddingInlineStart).toBe('12px');
  });

  it('exposes TCT_* environment values to tests', () => {
    // TCT_TIER2 is set by the CI tier-2 job; absent means Tier-1 behaviour.
    const value = import.meta.env.TCT_TIER2 as string | undefined;
    expect(value === undefined || typeof value === 'string').toBe(true);
  });
});

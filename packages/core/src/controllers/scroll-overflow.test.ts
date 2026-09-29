/**
 * ScrollOverflowController (upstream useScrollOverflow): start and end overflow of a horizontally
 * scrollable box, live on scroll and resize, direction aware, with a 1px tolerance.
 */
import {css, html, LitElement} from 'lit';
import {describe, expect, it} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {measureScrollOverflow, ScrollOverflowController} from './scroll-overflow.js';

class OverflowHost extends LitElement {
  static override styles = css`
    .track {
      display: flex;
      inline-size: 100px;
      overflow-x: auto;
    }
    .item {
      flex: none;
      inline-size: 80px;
    }
  `;
  items = 5;
  changes = 0;
  readonly overflow: ScrollOverflowController = new ScrollOverflowController(this, {
    target: () => this.renderRoot.querySelector<HTMLElement>('.track'),
    onChange: () => {
      this.changes++;
    },
  });

  override render() {
    return html`<div class="track">
      ${Array.from({length: this.items}, (_, index) => html`<div class="item">${index}</div>`)}
    </div>`;
  }
}
customElements.define('test-overflow-host', OverflowHost);

async function host(dir?: 'rtl', items = 5) {
  const root = await fixture<HTMLElement>(`<test-overflow-host></test-overflow-host>`, {dir});
  const element = root as OverflowHost;
  element.items = items;
  element.requestUpdate();
  await element.updateComplete;
  await nextFrame();
  await nextFrame();
  return {element, track: element.shadowRoot!.querySelector<HTMLElement>('.track')!};
}

describe('ScrollOverflowController', () => {
  it('reports overflow at the end only, at the start of the scroll', async () => {
    const {element} = await host();
    expect(element.overflow.hasOverflow).toBe(true);
    expect(element.overflow.overflowStart).toBe(false);
    expect(element.overflow.overflowEnd).toBe(true);
  });

  it('follows scrolling: both edges in the middle, only the start at the end', async () => {
    const {element, track} = await host();
    track.scrollLeft = 50;
    await waitUntil(() => element.overflow.overflowStart);
    expect(element.overflow.overflowEnd).toBe(true);
    track.scrollLeft = track.scrollWidth;
    await waitUntil(() => !element.overflow.overflowEnd);
    expect(element.overflow.overflowStart).toBe(true);
  });

  it('reports nothing when the content fits, and updates when it grows', async () => {
    const {element} = await host(undefined, 1);
    expect(element.overflow.hasOverflow).toBe(false);
    expect(element.overflow.overflowEnd).toBe(false);
    element.items = 6;
    element.requestUpdate();
    await waitUntil(() => element.overflow.hasOverflow);
    expect(element.overflow.overflowEnd).toBe(true);
  });

  it('start and end follow the direction: RTL starts at the right', async () => {
    const {element, track} = await host('rtl');
    expect(element.overflow.overflowStart).toBe(false);
    expect(element.overflow.overflowEnd).toBe(true);
    track.scrollLeft = -track.scrollWidth;
    await waitUntil(() => !element.overflow.overflowEnd);
    expect(element.overflow.overflowStart).toBe(true);
  });

  it('re-renders the host and calls onChange only when the answer changes', async () => {
    const {element, track} = await host();
    const before = element.changes;
    track.scrollLeft = 10;
    await waitUntil(() => element.changes > before);
    const after = element.changes;
    track.scrollLeft = 12;
    await nextFrame();
    await nextFrame();
    // Still "scrolled away from the start, more to come": nothing changed.
    expect(element.changes).toBe(after);
  });

  it('measureScrollOverflow applies a 1px tolerance', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 100px; overflow-x: auto"><div style="inline-size: 100.6px; block-size: 10px"></div></div>`,
    );
    expect(measureScrollOverflow(root).hasOverflow).toBe(false);
    (root.firstElementChild as HTMLElement).style.inlineSize = '104px';
    expect(measureScrollOverflow(root).hasOverflow).toBe(true);
  });

  it('stops observing when the host disconnects', async () => {
    const {element, track} = await host();
    element.remove();
    const changes = element.changes;
    track.scrollLeft = 30;
    await nextFrame();
    await nextFrame();
    expect(element.changes).toBe(changes);
  });
});

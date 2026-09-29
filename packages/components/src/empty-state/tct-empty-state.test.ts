import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {EMPTY_STATE_HEADING_LEVELS} from './empty-state.types.js';
import '../icon/define.js';
import './define.js';
import type {TctEmptyState} from './tct-empty-state.js';

const $ = (element: TctEmptyState, selector: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(selector);

runElementSuite({
  tag: 'tct-empty-state',
  render: () => `<tct-empty-state heading="No results found"></tct-empty-state>`,
  properties: {heading: 'Nothing here', description: 'Try again', headingLevel: 2, compact: true},
  attributes: {heading: 'heading', description: 'description', compact: 'compact'},
});

describe('tct-empty-state (EmptyState.test.tsx)', () => {
  it('renders with title', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="No results found"></tct-empty-state>`,
    );
    expect($(empty, '.title')!.textContent.trim()).toBe('No results found');
  });

  it('renders title as h3 by default', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="Title"></tct-empty-state>`,
    );
    expect($(empty, '.title')!.tagName).toBe('H3');
  });

  it('renders custom heading level', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="Title" heading-level="2"></tct-empty-state>`,
    );
    expect($(empty, '.title')!.tagName).toBe('H2');
  });

  it('renders all heading levels', async () => {
    for (const level of EMPTY_STATE_HEADING_LEVELS) {
      const empty = await fixture<TctEmptyState>(
        html`<tct-empty-state heading="Title" heading-level=${level}></tct-empty-state>`,
      );
      expect($(empty, '.title')!.tagName, `level ${level}`).toBe(`H${level}`);
    }
  });

  it('keeps the title the same size at every level (semantic only)', async () => {
    const sizes = new Set<string>();
    for (const level of EMPTY_STATE_HEADING_LEVELS) {
      const empty = await fixture<TctEmptyState>(
        html`<tct-empty-state heading="Title" heading-level=${level}></tct-empty-state>`,
      );
      sizes.add(getComputedStyle($(empty, '.title')!).fontSize);
    }
    expect(sizes.size).toBe(1);
  });

  it('falls back to level 3 for an invalid level', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="Title" heading-level="9"></tct-empty-state>`,
    );
    expect($(empty, '.title')!.tagName).toBe('H3');
  });

  it('renders with description', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state
        heading="A"
        description="Try adjusting your search."
      ></tct-empty-state>`,
    );
    expect($(empty, '.description')!.textContent.trim()).toBe('Try adjusting your search.');
  });

  it('does not render description when not provided', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"></tct-empty-state>`,
    );
    expect($(empty, '.description')).toBeNull();
  });

  it('renders rich description and heading through their slots', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state
        ><span slot="heading">Rich <em>title</em></span
        ><span slot="description">Rich <strong>text</strong></span></tct-empty-state
      >`,
    );
    const heading = $(empty, '.title slot')! as HTMLSlotElement;
    const description = $(empty, '.description slot')! as HTMLSlotElement;
    expect(heading.assignedElements()).toHaveLength(1);
    expect(description.assignedElements()).toHaveLength(1);
  });

  it('renders with icon', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"
        ><tct-icon slot="icon" name="search" size="lg"></tct-icon
      ></tct-empty-state>`,
    );
    const slot = $(empty, '.icon slot') as HTMLSlotElement;
    expect(slot.assignedElements()).toHaveLength(1);
  });

  it('marks icon as decorative with aria-hidden', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"
        ><svg slot="icon" width="24" height="24"></svg
      ></tct-empty-state>`,
    );
    expect($(empty, '.icon')!.getAttribute('aria-hidden')).toBe('true');
    if (isChromium) expect((await axNode($(empty, '.icon')!)).ignored).toBe('true');
  });

  it('does not render icon wrapper when icon is not provided', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"></tct-empty-state>`,
    );
    expect($(empty, '.icon')).toBeNull();
  });

  it('renders with actions', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"><button slot="actions">Compose</button></tct-empty-state>`,
    );
    const slot = $(empty, '.actions slot') as HTMLSlotElement;
    expect(slot.assignedElements()).toHaveLength(1);
  });

  it('does not render actions wrapper when actions is not provided', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"></tct-empty-state>`,
    );
    expect($(empty, '.actions')).toBeNull();
  });

  it('adds the icon, description and actions when they are slotted later', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A"></tct-empty-state>`,
    );
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('slot', 'icon');
    const button = document.createElement('button');
    button.slot = 'actions';
    button.textContent = 'Go';
    empty.append(svg, button);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await empty.updateComplete;
    expect($(empty, '.icon')).not.toBeNull();
    expect($(empty, '.actions')).not.toBeNull();
  });

  it('renders all slots together', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="No messages" description="You're all caught up!"
        ><svg slot="icon" width="24" height="24"></svg
        ><button slot="actions">Compose</button></tct-empty-state
      >`,
    );
    for (const selector of ['.icon', '.title', '.description', '.actions']) {
      expect($(empty, selector), selector).not.toBeNull();
    }
  });
});

describe('tct-empty-state: compact variant', () => {
  it('reflects compact and reduces spacing, type size and stacks the actions', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-empty-state heading="Regular" description="d"
          ><button slot="actions">One</button><button slot="actions">Two</button></tct-empty-state
        >
        <tct-empty-state compact heading="Compact" description="d"
          ><button slot="actions">One</button><button slot="actions">Two</button></tct-empty-state
        >
      </div>`,
    );
    const [regular, compact] = [...wrapper.querySelectorAll<TctEmptyState>('tct-empty-state')];
    expect(compact!.hasAttribute('compact')).toBe(true);
    const padding = (el: TctEmptyState) => parseFloat(getComputedStyle($(el, '.base')!).paddingTop);
    expect(padding(compact!)).toBeLessThan(padding(regular!));
    const size = (el: TctEmptyState) => parseFloat(getComputedStyle($(el, '.title')!).fontSize);
    expect(size(compact!)).toBeLessThan(size(regular!));
    expect(getComputedStyle($(regular!, '.actions')!).flexDirection).toBe('row');
    expect(getComputedStyle($(compact!, '.actions')!).flexDirection).toBe('column');
  });
});

describe('tct-empty-state: parts (theming targets)', () => {
  it('exposes base, icon, title, description and actions as parts', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="A" description="B"
        ><svg slot="icon" width="8" height="8"></svg
        ><button slot="actions">C</button></tct-empty-state
      >`,
    );
    for (const part of ['base', 'icon', 'title', 'description', 'actions']) {
      expect(empty.shadowRoot!.querySelector(`[part~="${part}"]`), part).not.toBeNull();
    }
  });
});

describe('tct-empty-state: accessibility', () => {
  it('has role="status" on the container (ElementInternals default)', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="No results found" description="Try again."></tct-empty-state>`,
    );
    expect(empty.hasAttribute('role')).toBe(false);
    if (isChromium) expect((await axNode(empty)).role).toBe('status');
  });

  it('lets a host role attribute override the default', async () => {
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state role="region" aria-label="Empty" heading="A"></tct-empty-state>`,
    );
    if (isChromium) expect((await axNode(empty)).role).toBe('region');
  });

  it('exposes the title as a heading with its level', async () => {
    if (!isChromium) return;
    const empty = await fixture<TctEmptyState>(
      html`<tct-empty-state heading="No results found" heading-level="2"></tct-empty-state>`,
    );
    const node = await axNode($(empty, '.title')!);
    expect(node.role).toBe('heading');
    expect(node.name).toBe('No results found');
    expect(node.level).toBe('2');
  });

  it('passes axe with every part present, in light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          <tct-empty-state
            heading="No messages"
            description="You're all caught up!"
            heading-level="2"
            ><tct-icon slot="icon" name="search" size="lg"></tct-icon
            ><button slot="actions">Compose</button></tct-empty-state
          >
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });

  it('slotted actions are ordinary tab stops in document order', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-empty-state heading="A"
          ><button slot="actions">One</button><button slot="actions">Two</button></tct-empty-state
        >
      </div>`,
    );
    const [first, second] = wrapper.querySelectorAll('button');
    first!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(second);
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(first);
  });
});

describe('tct-empty-state: right-to-left and layout', () => {
  it('centres its content in both directions', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div style="inline-size: 400px">
          <tct-empty-state heading="Centred" description="Text"></tct-empty-state>
        </div>`,
        {dir},
      );
      const title = $(wrapper.querySelector<TctEmptyState>('tct-empty-state')!, '.title')!;
      const box = title.getBoundingClientRect();
      const outer = wrapper.getBoundingClientRect();
      expect(Math.abs(box.left + box.width / 2 - (outer.left + outer.width / 2))).toBeLessThan(2);
    }
  });

  it('limits the text group to a readable measure', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="inline-size: 800px">
        <tct-empty-state
          heading="Heading"
          description="A very long description that repeats itself so it has to wrap at the readable measure of the text group. A very long description that repeats itself so it has to wrap at the readable measure of the text group."
        ></tct-empty-state>
      </div>`,
    );
    const text = $(wrapper.querySelector<TctEmptyState>('tct-empty-state')!, '.text')!;
    expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(360);
  });
});

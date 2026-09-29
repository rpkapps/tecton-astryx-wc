/**
 * tct-item: slots and content, static / button / link / delegating / role-managed modes, nested
 * interactive content, selection semantics, density, alignment, layout, truncation, RTL, forced
 * colours (ported from upstream Item.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import {itemDescriptionContext} from './item.context.js';
import './define.js';
import type {TctItem} from './tct-item.js';

// The keyboard table lives in parity.json (read as data; the docs and these tests share it).
const parity = Object.values(
  import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const make = async (markup: string, options: {dir?: 'ltr' | 'rtl'} = {}): Promise<TctItem> => {
  const wrapper = await fixture<HTMLElement>(`<div style="width: 320px">${markup}</div>`, options);
  return wrapper.querySelector<TctItem>('tct-item')!;
};
const part = (item: TctItem, name: string): HTMLElement | null =>
  item.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

runElementSuite({
  tag: 'tct-item',
  render: () => html`<tct-item label="Contact"></tct-item>`,
  properties: {
    label: 'Contact',
    description: 'Team lead',
    density: 'compact',
    alignment: 'start',
    layout: 'inline',
    pressable: true,
    selected: true,
    disabled: true,
  },
  attributes: {
    label: 'label',
    description: 'description',
    density: 'density',
    alignment: 'alignment',
    layout: 'layout',
  },
  events: ['click'],
});

describe('tct-item: rendering (Item.test.tsx)', () => {
  it('renders label text', async () => {
    const item = await make('<tct-item label="Contact Name"></tct-item>');
    expect(part(item, 'label')!.textContent).toBe('Contact Name');
  });

  it('renders label and description', async () => {
    const item = await make(
      '<tct-item label="Settings" description="Manage your preferences"></tct-item>',
    );
    expect(part(item, 'label')!.textContent).toBe('Settings');
    expect(part(item, 'description')!.textContent).toBe('Manage your preferences');
  });

  it('does not render a description element when there is no description', async () => {
    const item = await make('<tct-item label="Settings"></tct-item>');
    expect(part(item, 'description')).toBeNull();
  });

  it('renders every slot: marker, start, label, description, end', async () => {
    const item = await make(`
      <tct-item description="Description">
        <span slot="marker" id="m">•</span>
        <span slot="start" id="s">S</span>
        <span slot="label" id="l">Label</span>
        <span slot="end" id="e">E</span>
      </tct-item>`);
    const assigned = (name: string) =>
      item.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)!.assignedElements();
    expect(assigned('marker').map((el) => el.id)).toEqual(['m']);
    expect(assigned('start').map((el) => el.id)).toEqual(['s']);
    expect(assigned('label').map((el) => el.id)).toEqual(['l']);
    expect(assigned('end').map((el) => el.id)).toEqual(['e']);
    expect(part(item, 'description')!.textContent).toBe('Description');
  });

  it('accepts rich content as the label and description through their slots', async () => {
    const item = await make(`
      <tct-item>
        <strong slot="label">Rich <em>label</em></strong>
        <div slot="description"><a href="#x">Rich</a> description</div>
      </tct-item>`);
    expect(item.querySelector('strong em')).not.toBeNull();
    const description = item.shadowRoot!.querySelector<HTMLSlotElement>(
      'slot[name="description"]',
    )!;
    expect(description.assignedElements()).toHaveLength(1);
    expect(part(item, 'description')).not.toBeNull();
  });

  it('renders as a div by default and exposes a listitem for as="li"', async () => {
    const div = await make('<tct-item label="Item"></tct-item>');
    expect(await axNode(part(div, 'item')!)).toMatchObject({role: 'generic'});
    const li = await make('<tct-item as="li" label="Item"></tct-item>');
    expect(await axNode(li)).toMatchObject({role: 'listitem'});
  });

  it('falls back to the default for an invalid density and keeps rendering', async () => {
    const item = await make('<tct-item label="Item" density="huge"></tct-item>');
    expect(part(item, 'item')!.dataset.density).toBe('balanced');
  });
});

describe('tct-item: static, button and link modes', () => {
  it('renders neither a button nor an anchor for a static item', async () => {
    const item = await make('<tct-item label="Static"></tct-item>');
    expect(item.shadowRoot!.querySelector('button, a')).toBeNull();
  });

  it('renders an invisible button when pressable', async () => {
    const item = await make('<tct-item label="Open" pressable></tct-item>');
    const button = item.shadowRoot!.querySelector('button')!;
    expect(button).not.toBeNull();
    expect(button.type).toBe('button');
    expect(await axNode(button)).toMatchObject({role: 'button', name: 'Open'});
  });

  it('fires click when the invisible button is clicked, once', async () => {
    const item = await make('<tct-item label="Open" pressable></tct-item>');
    const clicks = recordEvents(item, 'click');
    await userEvent.click(item.shadowRoot!.querySelector('button')!);
    expectEventCounts(clicks, {click: 1});
  });

  it('fires one click when the container area (not the button) is clicked', async () => {
    const item = await make('<tct-item label="Open" pressable></tct-item>');
    const clicks = recordEvents(item, 'click');
    // The row padding: left edge of the row surface, outside the button.
    const box = part(item, 'item')!.getBoundingClientRect();
    await userEvent.click(part(item, 'item')!, {position: {x: 2, y: box.height / 2}});
    expectEventCounts(clicks, {click: 1});
  });

  it('the button is focusable and Enter and Space activate it', async () => {
    const item = await make('<tct-item label="Open" pressable></tct-item>');
    const clicks = recordEvents(item, 'click');
    await pressKeys('Tab');
    expect(item.shadowRoot!.activeElement).toBe(item.shadowRoot!.querySelector('button'));
    await pressKeys('Enter');
    await pressKeys(' ');
    expectEventCounts(clicks, {click: 2});
  });

  it('does not render nested buttons: exactly one invisible button', async () => {
    const item = await make(
      '<tct-item label="Row" description="Details" pressable><span slot="start">S</span><span slot="end">E</span></tct-item>',
    );
    expect(item.shadowRoot!.querySelectorAll('button')).toHaveLength(1);
  });

  it('does not forward a click that lands on nested interactive end content', async () => {
    const item = await make(
      '<tct-item label="Row" pressable><button slot="end" id="inner">More</button></tct-item>',
    );
    const seen: string[] = [];
    item.addEventListener('click', (event) => {
      seen.push((event.composedPath()[0] as HTMLElement).id || 'row');
    });
    await userEvent.click(item.querySelector('#inner')!);
    // Only the nested button's own click: the row never proxies a second click to its action.
    expect(seen).toEqual(['inner']);
  });

  it('does not forward a click that lands on nested interactive start content', async () => {
    const item = await make(
      '<tct-item label="Row" pressable><button slot="start" id="inner">A</button></tct-item>',
    );
    const seen: string[] = [];
    item.addEventListener('click', (event) => {
      seen.push((event.composedPath()[0] as HTMLElement).id || 'row');
    });
    await userEvent.click(item.querySelector('#inner')!);
    expect(seen).toEqual(['inner']);
  });

  it('renders an invisible anchor for href, with target and merged rel', async () => {
    const item = await make(
      '<tct-item label="Docs" href="https://example.com/docs" target="_blank" rel="author"></tct-item>',
    );
    const anchor = item.shadowRoot!.querySelector('a')!;
    expect(anchor.getAttribute('href')).toBe('https://example.com/docs');
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel.split(' ').sort()).toEqual(['author', 'noopener', 'noreferrer']);
    expect(await axNode(anchor)).toMatchObject({role: 'link', name: 'Docs'});
  });

  it('keeps existing rel tokens and adds nothing for a same-window link', async () => {
    const item = await make('<tct-item label="Docs" href="/docs" rel="author"></tct-item>');
    const anchor = item.shadowRoot!.querySelector('a')!;
    expect(anchor.getAttribute('rel')).toBe('author');
    expect(anchor.hasAttribute('target')).toBe(false);
  });

  it('renders a destination-less anchor for an unsafe URL', async () => {
    const item = await make('<tct-item label="Bad" href="javascript:alert(1)"></tct-item>');
    expect(item.shadowRoot!.querySelector('a')!.hasAttribute('href')).toBe(false);
  });

  it('hands an unmodified same-origin click to the link context and stops the navigation', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><tct-item id="row" label="Docs" href="/docs"></tct-item></div>`,
    );
    const item = wrapper.querySelector<TctItem>('tct-item')!;
    const navigated: string[] = [];
    // A router provider (tct-link-provider) answers linkContext with navigate().
    wrapper.addEventListener('context-request', (event) => {
      const request = event as unknown as {
        context: symbol;
        callback: (value: unknown) => void;
      };
      if (request.context !== linkContext) return;
      request.callback({
        navigate: (href: string) => {
          navigated.push(href);
          return true;
        },
      });
      event.stopPropagation();
    });
    // Re-request now that the provider exists.
    item.remove();
    wrapper.append(item);
    await item.updateComplete;
    const seen: boolean[] = [];
    item.addEventListener('click', (event) => seen.push(event.defaultPrevented));
    await userEvent.click(item.shadowRoot!.querySelector('a')!);
    expect(navigated).toEqual(['/docs']);
    expect(seen).toEqual([true]); // a host listener sees the click after the router took the navigation
    expect(location.pathname).not.toBe('/docs');
  });

  it('does not make a same-origin link a router link for a modified click', async () => {
    const item = await make('<tct-item label="Docs" href="/docs" target="_blank"></tct-item>');
    expect(item.shadowRoot!.querySelector('a')!.target).toBe('_blank');
  });
});

describe('tct-item: disabled', () => {
  it('sets aria-disabled on the host and disables the invisible button', async () => {
    const item = await make('<tct-item as="li" label="Off" pressable disabled></tct-item>');
    expect(await axNode(item)).toMatchObject({disabled: 'true'});
    expect(item.shadowRoot!.querySelector('button')!.disabled).toBe(true);
  });

  it('does not set aria-disabled when not disabled', async () => {
    const item = await make('<tct-item as="li" label="On" pressable></tct-item>');
    expect((await axNode(item)).disabled).toBeUndefined();
  });

  it('does not fire click when a disabled item is clicked', async () => {
    const item = await make('<tct-item label="Off" pressable disabled></tct-item>');
    const clicks = recordEvents(item, 'click');
    await userEvent.click(part(item, 'item')!, {force: true});
    expectEventCounts(clicks, {click: 0});
  });

  it('a disabled link is not a tab stop and carries aria-disabled', async () => {
    const item = await make('<tct-item label="Off" href="/x" disabled></tct-item>');
    const anchor = item.shadowRoot!.querySelector('a')!;
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.tabIndex).toBe(-1);
  });
});

describe('tct-item: selection semantics', () => {
  // Chromium's accessibility tree does not surface aria-current, so the ElementInternals defaults the
  // row sets are read directly (the platform resolves them against author attributes).
  const internalsOf = (item: TctItem): ElementInternals =>
    (item as unknown as {internals: ElementInternals}).internals;

  it('conveys selection through aria-current on a row that is a listitem', async () => {
    const item = await make('<tct-item as="li" label="Row" selected></tct-item>');
    expect(internalsOf(item).ariaCurrent).toBe('true');
    expect(internalsOf(item).ariaSelected).toBeNull();
  });

  it('uses aria-selected (not aria-current) when the role permits it', async () => {
    const item = await make('<tct-item role="option" label="Row" selected></tct-item>');
    expect(await axNode(item)).toMatchObject({role: 'option', selected: 'true'});
    expect(internalsOf(item).ariaCurrent).toBeNull();
  });

  it('falls back to aria-current when the role does not permit aria-selected', async () => {
    const item = await make('<tct-item role="listitem" label="Row" selected></tct-item>');
    expect(internalsOf(item).ariaCurrent).toBe('true');
    expect(internalsOf(item).ariaSelected).toBeNull();
  });

  it('applies neither when not selected', async () => {
    const item = await make('<tct-item role="option" label="Row"></tct-item>');
    expect(await axNode(item)).toMatchObject({role: 'option', selected: 'false'});
    expect(internalsOf(item).ariaCurrent).toBeNull();
  });

  it('lets a consumer-provided aria-current win over the selection default', async () => {
    const item = await make(
      '<tct-item as="li" aria-current="page" label="Row" selected></tct-item>',
    );
    expect(internalsOf(item).ariaCurrent).toBeNull();
    expect(item.getAttribute('aria-current')).toBe('page');
    item.removeAttribute('aria-current');
    await item.updateComplete;
    expect(internalsOf(item).ariaCurrent).toBe('true');
  });

  it('renders the highlighted state without error and paints it', async () => {
    const item = await make('<tct-item label="Row" highlighted></tct-item>');
    expect(getComputedStyle(part(item, 'item')!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});

describe('tct-item: delegation (interactive-element)', () => {
  const markup = `<tct-item label="Row" interactive-selector="input"><input slot="start" type="checkbox" aria-label="Pick row"></tct-item>`;

  it('renders no invisible button or anchor', async () => {
    const item = await make(markup);
    expect(item.shadowRoot!.querySelector('button, a')).toBeNull();
  });

  it('keeps the nested control as the only tab stop', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">b</button>${markup}</div>`,
    );
    const item = wrapper.querySelector<TctItem>('tct-item')!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    const stops = await tabSequence(item, {
      start: wrapper.querySelector<HTMLElement>('#before')!,
      max: 3,
    });
    expect(stops[0]).toBe(item.querySelector('input'));
  });

  it('delegates a row-surface click to the control', async () => {
    const item = await make(markup);
    const input = item.querySelector('input')!;
    expect(input.checked).toBe(false);
    await userEvent.click(part(item, 'label')!);
    expect(input.checked).toBe(true);
  });

  it('does not double-fire when the control itself is clicked', async () => {
    const item = await make(markup);
    const input = item.querySelector('input')!;
    const changes: boolean[] = [];
    input.addEventListener('change', () => changes.push(input.checked));
    await userEvent.click(input);
    expect(changes).toEqual([true]);
  });

  it('accepts the element as a property', async () => {
    const item = await make(
      '<tct-item label="Row"><input slot="start" type="checkbox" aria-label="Pick"></tct-item>',
    );
    const input = item.querySelector('input')!;
    item.interactiveElement = input;
    await item.updateComplete;
    expect(item.shadowRoot!.querySelector('button, a')).toBeNull();
    await userEvent.click(part(item, 'label')!);
    expect(input.checked).toBe(true);
  });

  it('ignores pressable and href when delegating (the nested control is the sole action)', async () => {
    const item = await make(
      '<tct-item label="Row" pressable href="/x" interactive-selector="input"><input slot="start" type="checkbox" aria-label="Pick"></tct-item>',
    );
    expect(item.shadowRoot!.querySelector('button, a')).toBeNull();
  });
});

describe('tct-item: role-managed rows (a parent owns the keyboard access)', () => {
  it('renders no invisible button or anchor when the host has a role', async () => {
    const item = await make(
      '<tct-item role="menuitem" tabindex="-1" label="Copy" pressable></tct-item>',
    );
    expect(item.shadowRoot!.querySelector('button, a')).toBeNull();
    expect(await axNode(item)).toMatchObject({role: 'menuitem', name: 'Copy'});
  });

  it('still paints the interactive look for a pressable role-managed row', async () => {
    const item = await make('<tct-item role="menuitem" label="Copy" pressable></tct-item>');
    expect(part(item, 'item')!.hasAttribute('data-interactive')).toBe(true);
  });

  it('a disabled role-managed row keeps receiving pointer events for its parent', async () => {
    const item = await make(
      '<tct-item role="menuitem" label="Copy" pressable disabled></tct-item>',
    );
    expect(getComputedStyle(part(item, 'item')!).pointerEvents).not.toBe('none');
  });

  it('rings the whole row when the host itself takes focus-visible', async () => {
    const item = await make('<tct-item role="option" tabindex="0" label="Row"></tct-item>');
    await pressKeys('Tab');
    expect(item.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(part(item, 'item')!).outlineStyle).not.toBe('none');
  });
});

describe('tct-item: description context', () => {
  /** A control rendered in a slot: consumes what the row publishes about its description. */
  class TctTestDescriptionProbe extends TctElement {
    static override readonly tagName = 'tct-test-description-probe';
    readonly consumer: ContextConsumer<typeof itemDescriptionContext> = new ContextConsumer<
      typeof itemDescriptionContext
    >(this, {
      context: itemDescriptionContext,
      subscribe: true,
    });
  }
  defineElement(TctTestDescriptionProbe);

  const probe = async (markup: string) => {
    const item = await make(markup);
    return item.querySelector<TctTestDescriptionProbe>('tct-test-description-probe')!.consumer;
  };

  it('publishes the description text to slotted content', async () => {
    const consumer = await probe(
      '<tct-item label="Email" description="Receive notifications by email"><tct-test-description-probe slot="start"></tct-test-description-probe></tct-item>',
    );
    expect(consumer.value).toEqual({text: 'Receive notifications by email', element: null});
  });

  it('publishes the slotted description element, which shares a tree with the control', async () => {
    const consumer = await probe(
      '<tct-item label="Email"><span slot="description" id="d">By email</span><tct-test-description-probe slot="start"></tct-test-description-probe></tct-item>',
    );
    expect(consumer.value?.text).toBe('By email');
    expect(consumer.value?.element?.id).toBe('d');
  });

  it('publishes nothing when the description renders nothing', async () => {
    const consumer = await probe(
      '<tct-item label="Email" description=""><tct-test-description-probe slot="start"></tct-test-description-probe></tct-item>',
    );
    expect(consumer.value).toBeNull();
  });

  it('follows a description that changes', async () => {
    const item = await make(
      '<tct-item label="Email" description="One"><tct-test-description-probe slot="start"></tct-test-description-probe></tct-item>',
    );
    const consumer = item.querySelector<TctTestDescriptionProbe>(
      'tct-test-description-probe',
    )!.consumer;
    item.description = 'Two';
    await item.updateComplete;
    expect(consumer.value?.text).toBe('Two');
    item.description = '';
    await item.updateComplete;
    expect(consumer.value).toBeNull();
  });
});

describe('tct-item: layout, truncation and density', () => {
  it('puts label and description on one row for layout="inline"', async () => {
    const item = await make(
      '<tct-item layout="inline" label="Label" description="A very long description that should ellipsize before the label does"></tct-item>',
    );
    const label = part(item, 'label')!.getBoundingClientRect();
    const description = part(item, 'description')!.getBoundingClientRect();
    expect(
      Math.abs(label.top + label.height / 2 - (description.top + description.height / 2)),
    ).toBeLessThan(2);
    expect(getComputedStyle(part(item, 'description')!).textOverflow).toBe('ellipsis');
  });

  it('ellipsizes a rich description in inline layout too', async () => {
    const item = await make(
      '<tct-item layout="inline" label="Label"><span slot="description">Rich description text</span></tct-item>',
    );
    expect(getComputedStyle(part(item, 'description')!).whiteSpace).toBe('nowrap');
  });

  it('stacks label above description by default', async () => {
    const item = await make('<tct-item label="Label" description="Description"></tct-item>');
    const label = part(item, 'label')!.getBoundingClientRect();
    const description = part(item, 'description')!.getBoundingClientRect();
    expect(description.top).toBeGreaterThanOrEqual(label.bottom - 1);
  });

  it('ignores inline layout when there is no description', async () => {
    const item = await make('<tct-item layout="inline" label="Label"></tct-item>');
    expect(part(item, 'description')).toBeNull();
    expect(part(item, 'label')!.textContent).toBe('Label');
  });

  it('truncates a plain label to one line by default', async () => {
    const item = await make(`<tct-item label="${'Long label '.repeat(20)}"></tct-item>`);
    const style = getComputedStyle(part(item, 'label')!);
    expect([style.textOverflow, style.whiteSpace]).toEqual(['ellipsis', 'nowrap']);
  });

  it('clamps to label-lines and description-lines', async () => {
    const item = await make(
      `<tct-item label-lines="2" description-lines="3" label="${'word '.repeat(60)}" description="${'text '.repeat(80)}"></tct-item>`,
    );
    const label = part(item, 'label')!;
    const description = part(item, 'description')!;
    const labelLine = parseFloat(getComputedStyle(label).lineHeight);
    const descriptionLine = parseFloat(getComputedStyle(description).lineHeight);
    expect(label.getBoundingClientRect().height).toBeLessThanOrEqual(labelLine * 2 + 1);
    expect(description.getBoundingClientRect().height).toBeLessThanOrEqual(descriptionLine * 3 + 1);
  });

  it('density changes the block padding: compact < balanced < spacious', async () => {
    const heights: number[] = [];
    for (const density of ['compact', 'balanced', 'spacious']) {
      const item = await make(`<tct-item density="${density}" label="Row"></tct-item>`);
      heights.push(part(item, 'item')!.getBoundingClientRect().height);
    }
    expect(heights[0]!).toBeLessThan(heights[1]!);
    expect(heights[1]!).toBeLessThan(heights[2]!);
  });

  it('spacious density also widens the inline inset', async () => {
    const item = await make('<tct-item density="spacious" label="Row"></tct-item>');
    const balanced = await make('<tct-item label="Row"></tct-item>');
    const inset = (element: TctItem) =>
      parseFloat(getComputedStyle(part(element, 'item')!).paddingInlineStart);
    expect(inset(item)).toBeGreaterThan(inset(balanced));
  });

  it('center alignment is the default; start aligns start and end content to the top', async () => {
    const centered = await make(
      '<tct-item label="Row" description="Two lines"><span slot="start">S</span></tct-item>',
    );
    const start = await make(
      '<tct-item alignment="start" label="Row" description="Two lines"><span slot="start">S</span></tct-item>',
    );
    expect(getComputedStyle(part(centered, 'item')!).alignItems).toBe('center');
    expect(getComputedStyle(part(start, 'item')!).alignItems).toBe('flex-start');
  });
});

describe('tct-item: accessibility, RTL and forced colours', () => {
  it('is accessible in the static, button, link and delegating modes', async () => {
    for (const markup of [
      '<tct-item label="Static" description="Details"></tct-item>',
      '<tct-item label="Button" pressable></tct-item>',
      '<tct-item label="Link" href="/x"></tct-item>',
      '<tct-item label="Row" interactive-selector="input"><input slot="start" type="checkbox" aria-label="Pick"></tct-item>',
      '<tct-item as="li" label="List item"></tct-item>',
    ]) {
      const item = await make(markup);
      await expectAccessible(item.parentElement!);
    }
  });

  it('lays the start, label and end out in reading order and mirrors in RTL', async () => {
    const markup =
      '<tct-item label="Row" description="Description"><span slot="start" id="s">S</span><span slot="end" id="e">E</span></tct-item>';
    const ltr = await make(markup);
    const rtl = await make(markup, {dir: 'rtl'});
    const rect = (item: TctItem, id: string) =>
      item.querySelector(`#${id}`)!.getBoundingClientRect();
    expect(rect(ltr, 's').left).toBeLessThan(rect(ltr, 'e').left);
    expect(rect(rtl, 's').left).toBeGreaterThan(rect(rtl, 'e').left);
    expect(getComputedStyle(part(rtl, 'item')!).textAlign).toBe('start');
  });

  it.skipIf(!isChromium)(
    'keeps selection visible and draws a focus ring under forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const selected = await make('<tct-item label="Row" selected></tct-item>');
      await nextFrame();
      expect(getComputedStyle(part(selected, 'item')!).backgroundColor).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
      const pressable = await make('<tct-item label="Row" pressable></tct-item>');
      await pressKeys('Tab');
      const base = part(pressable, 'item')!;
      expect(getComputedStyle(base).outlineStyle).not.toBe('none');
    },
  );
});

describe('tct-item: keyboard', () => {
  // The table lives in parity.json; each row needs a step (the suite fails on a row without one).
  const before = (element: HTMLElement) =>
    element.parentElement!.querySelector<HTMLElement>('#before')!;
  const shell = (row: string) => `<button id="before">before</button>${row}`;
  const clicks = new WeakMap<Element, number>();
  const count = (element: HTMLElement) => clicks.get(element) ?? 0;

  runKeyboardSuite({
    tag: 'tct-item',
    render: () => shell('<tct-item label="Open" pressable></tct-item>'),
    table: parity.entries['core.item']!.keyboard.filter((row) => row.when === 'pressable or href'),
    steps: {
      "Moves focus to the row's button or link": {
        focus: before,
        keys: ['Tab'],
        expect: ({element}) => {
          expect(element.shadowRoot!.activeElement).toBe(
            element.shadowRoot!.querySelector('button'),
          );
        },
      },
    },
  });

  runKeyboardSuite({
    tag: 'tct-item',
    render: () => shell('<tct-item label="Open" pressable></tct-item>'),
    table: parity.entries['core.item']!.keyboard.filter((row) => row.when === 'pressable'),
    steps: {
      'Activates the row button': {
        setup: (element) => {
          element.addEventListener('click', () => clicks.set(element, count(element) + 1));
        },
        focus: (element) => element.shadowRoot!.querySelector<HTMLElement>('button'),
        keys: ['Enter', ' '],
        expect: ({element}) => {
          expect(count(element)).toBe(2);
        },
      },
    },
  });

  runKeyboardSuite({
    tag: 'tct-item',
    render: () => shell('<tct-item label="Docs" href="#item-keyboard-target"></tct-item>'),
    table: parity.entries['core.item']!.keyboard.filter((row) => row.when === 'href'),
    steps: {
      'Follows the row link': {
        focus: (element) => element.shadowRoot!.querySelector<HTMLElement>('a'),
        keys: ['Enter'],
        expect: () => {
          expect(location.hash).toBe('#item-keyboard-target');
          history.replaceState(null, '', location.pathname + location.search);
        },
      },
    },
  });

  runKeyboardSuite({
    tag: 'tct-item',
    render: () =>
      shell(
        '<tct-item label="Row" interactive-selector="input"><input slot="start" type="checkbox" aria-label="Pick" /></tct-item>',
      ),
    table: parity.entries['core.item']!.keyboard.filter((row) => row.when === 'delegating'),
    steps: {
      'Moves focus to the nested control only, never to a second stop on the row': {
        focus: before,
        keys: ['Tab'],
        expect: ({element}) => {
          expect(document.activeElement).toBe(element.querySelector('input'));
        },
      },
    },
  });
});

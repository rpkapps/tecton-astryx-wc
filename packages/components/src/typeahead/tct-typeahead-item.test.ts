/**
 * `tct-typeahead-item` (TypeaheadItem.test.tsx): the default content of a result row.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import '../icon/define.js';
import './define.js';
import {textOf} from './fixtures/typeahead-test-helpers.js';
import type {TctTypeaheadItem} from './tct-typeahead-item.js';

runElementSuite({
  tag: 'tct-typeahead-item',
  render: () => html`<tct-typeahead-item label="Apple"></tct-typeahead-item>`,
  properties: {
    item: {id: 'apple', label: 'Apple'},
    label: 'Other',
    description: 'A fruit',
    disabled: true,
    group: 'Fruit',
  },
  attributes: {label: 'label', description: 'description', group: 'group'},
});

async function make(markup: string): Promise<TctTypeaheadItem> {
  const root = await fixture<HTMLElement>(`<div style="padding:16px">${markup}</div>`);
  const element = root.querySelector<TctTypeaheadItem>('tct-typeahead-item')!;
  await element.updateComplete;
  return element;
}

const part = (element: TctTypeaheadItem, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

describe('tct-typeahead-item', () => {
  it('shows the label of `item`, and `label` wins over it', async () => {
    const element = await make('<tct-typeahead-item></tct-typeahead-item>');
    element.item = {id: 'a', label: 'From the item'};
    await element.updateComplete;
    expect(textOf(part(element, 'label'))).toBe('From the item');
    element.label = 'From the attribute';
    await element.updateComplete;
    expect(textOf(part(element, 'label'))).toBe('From the attribute');
  });

  it('shows a description under the label only when there is one', async () => {
    const element = await make('<tct-typeahead-item label="Apple"></tct-typeahead-item>');
    expect(part(element, 'description')).toBeNull();
    element.description = 'A red fruit';
    await element.updateComplete;
    expect(textOf(part(element, 'description'))).toBe('A red fruit');
  });

  it('renders the icon slot only when it has content', async () => {
    const plain = await make('<tct-typeahead-item label="Apple"></tct-typeahead-item>');
    expect(plain.shadowRoot!.querySelector('slot[name="icon"]')).toBeNull();
    const withIcon = await make(
      '<tct-typeahead-item label="Apple"><tct-icon slot="icon" name="search"></tct-icon></tct-typeahead-item>',
    );
    await withIcon.updateComplete;
    expect(withIcon.shadowRoot!.querySelector('slot[name="icon"]')).not.toBeNull();
  });

  it('an item element replaces the whole layout', async () => {
    const element = await make('<tct-typeahead-item></tct-typeahead-item>');
    element.item = {id: 'a', label: 'Plain', element: html`<b class="custom">Custom</b>`};
    await element.updateComplete;
    expect(part(element, 'item')).toBeNull();
    expect(textOf(element.shadowRoot!.querySelector('.custom'))).toBe('Custom');
  });

  it('marks the row disabled (a dimmed row) without changing the label text', async () => {
    const element = await make('<tct-typeahead-item label="Apple" disabled></tct-typeahead-item>');
    expect(part(element, 'item')!.hasAttribute('data-disabled')).toBe(true);
    expect(textOf(part(element, 'label'))).toBe('Apple');
  });

  it('has no accessibility violations, with an icon and a description', async () => {
    const element = await make(
      '<tct-typeahead-item label="Apple" description="A red fruit"><tct-icon slot="icon" name="search"></tct-icon></tct-typeahead-item>',
    );
    await expectAccessible(element);
  });
});

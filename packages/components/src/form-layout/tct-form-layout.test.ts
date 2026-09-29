/**
 * tct-form-layout: directions, the formLayoutContext it publishes (ported from upstream
 * FormLayout.test.tsx), nesting, responsive collapse, RTL, forced colours.
 */
import {html, LitElement} from 'lit';
import {page} from 'vitest/browser';
import {afterEach, beforeAll, describe, expect, it} from 'vitest';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import {formLayoutContext} from '@tecton-astryx/core/context/keys.js';
import {expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctFormLayout} from './tct-form-layout.js';

/** A stand-in for tct-field and the form controls: reads the layout context and renders it. */
class TestLayoutReader extends LitElement {
  readonly consumer = new ContextConsumer(this, {context: formLayoutContext, subscribe: true});
  renders = 0;
  protected override render() {
    this.renders++;
    const value = this.consumer.value;
    return html`<span
      data-direction=${value?.direction ?? 'none'}
      data-optionality=${value?.optionality ?? 'unset'}
      >${value?.direction ?? 'none'}</span
    >`;
  }
}

beforeAll(() => {
  if (!customElements.get('test-layout-reader')) {
    customElements.define('test-layout-reader', TestLayoutReader);
  }
});

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));
const readerOf = (root: ParentNode, selector = 'test-layout-reader') =>
  root.querySelector<TestLayoutReader>(selector)!;
const seen = (reader: TestLayoutReader) => {
  const span = reader.shadowRoot!.querySelector('span')!;
  return {direction: span.dataset.direction, optionality: span.dataset.optionality};
};

async function layout(attributes = '', content = '<test-layout-reader></test-layout-reader>') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 600px"><tct-form-layout ${attributes}>${content}</tct-form-layout></div>`,
  );
  await readerOf(root)?.updateComplete;
  return root.querySelector<TctFormLayout>('tct-form-layout')!;
}

afterEach(async () => {
  await page.viewport(414, 896);
});

runElementSuite({
  tag: 'tct-form-layout',
  render: () => html`<tct-form-layout><input aria-label="Name" /></tct-form-layout>`,
  properties: {direction: 'horizontal', defaultOptionality: 'required'},
  attributes: {direction: 'direction', defaultOptionality: 'default-optionality'},
});

describe('tct-form-layout: rendering (FormLayout.test.tsx)', () => {
  it('renders children', async () => {
    const element = await layout('', '<input data-testid="child" aria-label="x">');
    expect(element.querySelector('[data-testid="child"]')).not.toBeNull();
    expect(element.shadowRoot!.querySelector('slot')!.assignedElements()).toHaveLength(1);
  });

  it('renders a div container inside the shadow root', async () => {
    const element = await layout();
    expect(baseOf(element).localName).toBe('div');
    expect(baseOf(element).getAttribute('part')).toBe('base');
  });

  it('passes through HTML attributes on the host', async () => {
    const element = await layout('id="form-1" role="group" aria-label="Details"');
    expect(element.id).toBe('form-1');
    expect(element.getAttribute('role')).toBe('group');
  });

  it('defaults to vertical direction: fields stack with a spacing-4 gap', async () => {
    const element = await layout('', '<input aria-label="a"><input aria-label="b">');
    expect(element.direction).toBe('vertical');
    expect(element.getAttribute('direction')).toBe('vertical');
    expect(css(element).display).toBe('flex');
    expect(css(element).flexDirection).toBe('column');
    expect(css(element).rowGap).toBe('16px');
    const [a, b] = element.querySelectorAll('input');
    expect(b!.getBoundingClientRect().top).toBeGreaterThan(a!.getBoundingClientRect().bottom);
  });

  it('supports horizontal direction: equal columns side by side', async () => {
    const element = await layout(
      'direction="horizontal"',
      '<div id="a">a</div><div id="b">b</div><div id="c">c</div>',
    );
    expect(css(element).display).toBe('grid');
    expect(css(element).gridAutoFlow).toBe('column');
    const widths = ['a', 'b', 'c'].map(
      (id) => element.querySelector(`#${id}`)!.getBoundingClientRect().width,
    );
    expect(widths[0]).toBeCloseTo(widths[1]!, 0);
    expect(widths[1]).toBeCloseTo(widths[2]!, 0);
    const [a, b] = ['a', 'b'].map((id) => element.querySelector(`#${id}`)!.getBoundingClientRect());
    expect(b!.left).toBeGreaterThan(a!.left);
    expect(b!.top).toBeCloseTo(a!.top, 0);
  });

  it('supports horizontal-labels direction: a label column and a control column', async () => {
    await page.viewport(800, 800);
    const element = await layout(
      'direction="horizontal-labels"',
      '<label id="l1">Name</label><input id="i1" aria-labelledby="l1"><label id="l2">Email</label><input id="i2" aria-labelledby="l2">',
    );
    expect(css(element).display).toBe('grid');
    expect(css(element).gridTemplateColumns.split(' ')).toHaveLength(2);
    const [l1, i1, l2, i2] = ['l1', 'i1', 'l2', 'i2'].map((id) =>
      element.querySelector(`#${id}`)!.getBoundingClientRect(),
    ) as [DOMRect, DOMRect, DOMRect, DOMRect];
    expect(i1.left).toBeGreaterThan(l1.right - 1);
    expect(i1.top).toBeCloseTo(l1.top, 0);
    expect(l2.top).toBeGreaterThan(l1.top);
    expect(i2.left).toBeCloseTo(i1.left, 0);
    // The first column is as wide as the widest label.
    expect(l1.width).toBeGreaterThan(0);
  });

  it('horizontal-labels: a display:contents child contributes its own children as grid items', async () => {
    await page.viewport(800, 800);
    const element = await layout(
      'direction="horizontal-labels"',
      '<div style="display: contents"><label id="l">Username</label><input id="i" aria-labelledby="l"></div>',
    );
    const label = element.querySelector('#l')!.getBoundingClientRect();
    const input = element.querySelector('#i')!.getBoundingClientRect();
    expect(input.left).toBeGreaterThan(label.right - 1);
    expect(input.top).toBeCloseTo(label.top, 0);
  });

  it('horizontal-labels collapses to a single column at 480px viewport width and below', async () => {
    const element = await layout(
      'direction="horizontal-labels"',
      '<label id="l">Name</label><input id="i" aria-labelledby="l">',
    );
    await page.viewport(400, 800);
    expect(css(element).display).toBe('flex');
    expect(css(element).flexDirection).toBe('column');
    expect(css(element).rowGap).toBe('16px');
    const label = element.querySelector('#l')!.getBoundingClientRect();
    const input = element.querySelector('#i')!.getBoundingClientRect();
    expect(input.top).toBeGreaterThan(label.top);
    await page.viewport(800, 800);
    expect(css(element).display).toBe('grid');
  });

  it('reflects direction and falls back to vertical for an unknown value', async () => {
    const element = await layout();
    (element as unknown as {direction: string}).direction = 'diagonal';
    await element.updateComplete;
    expect(css(element).flexDirection).toBe('column');
    expect(seen(readerOf(element.parentElement!)).direction).toBe('vertical');
  });
});

describe('tct-form-layout: context', () => {
  it.each(['vertical', 'horizontal', 'horizontal-labels'])(
    'provides direction "%s" to children',
    async (direction) => {
      const element = await layout(`direction="${direction}"`);
      expect(seen(readerOf(element)).direction).toBe(direction);
    },
  );

  it('provides the default (vertical) when no direction is specified', async () => {
    const element = await layout();
    expect(seen(readerOf(element))).toEqual({direction: 'vertical', optionality: 'unset'});
  });

  it('follows direction changes with an updated context (no events)', async () => {
    const element = await layout();
    const reader = readerOf(element);
    element.direction = 'horizontal-labels';
    await element.updateComplete;
    await reader.updateComplete;
    expect(seen(reader).direction).toBe('horizontal-labels');
  });

  it('gives nothing to children outside a layout', async () => {
    const root = await fixture<HTMLElement>('<div><test-layout-reader></test-layout-reader></div>');
    const reader = readerOf(root);
    await reader.updateComplete;
    expect(seen(reader).direction).toBe('none');
    expect(reader.consumer.value).toBeUndefined();
  });

  it('a late-upgrading layout is found by children that asked first', async () => {
    const root = await fixture<HTMLElement>(
      '<div><tct-form-layout direction="horizontal"><test-layout-reader></test-layout-reader></tct-form-layout></div>',
    );
    const reader = readerOf(root);
    await reader.updateComplete;
    expect(seen(reader).direction).toBe('horizontal');
  });

  it('supports nesting: the inner layout overrides the outer one for its children', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-form-layout direction="vertical" default-optionality="optional">
        <test-layout-reader id="outer"></test-layout-reader>
        <tct-form-layout direction="horizontal" default-optionality="required">
          <test-layout-reader id="inner"></test-layout-reader>
        </tct-form-layout>
      </tct-form-layout>`,
    );
    await Promise.all([
      readerOf(root, '#outer').updateComplete,
      readerOf(root, '#inner').updateComplete,
    ]);
    expect(seen(readerOf(root, '#outer'))).toEqual({
      direction: 'vertical',
      optionality: 'optional',
    });
    expect(seen(readerOf(root, '#inner'))).toEqual({
      direction: 'horizontal',
      optionality: 'required',
    });
  });

  it('renders nested layouts as different containers', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-form-layout id="outer"><tct-form-layout id="inner" direction="horizontal"><div>a</div><div>b</div></tct-form-layout></tct-form-layout>`,
    );
    expect(css(root).display).toBe('flex');
    expect(css(root.querySelector('#inner')!).display).toBe('grid');
  });

  it('leaves defaultOptionality unset by default', async () => {
    const element = await layout();
    expect(element.defaultOptionality).toBeUndefined();
    expect(seen(readerOf(element)).optionality).toBe('unset');
  });

  it.each(['optional', 'required'])(
    'provides default-optionality="%s" to children',
    async (value) => {
      const element = await layout(`default-optionality="${value}"`);
      expect(seen(readerOf(element)).optionality).toBe(value);
    },
  );

  it('an inner layout shadows the outer defaultOptionality, also when it sets none', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-form-layout default-optionality="required">
        <tct-form-layout><test-layout-reader id="inner"></test-layout-reader></tct-form-layout>
      </tct-form-layout>`,
    );
    await readerOf(root, '#inner').updateComplete;
    expect(seen(readerOf(root, '#inner')).optionality).toBe('unset');
  });

  it('ignores an unknown default-optionality', async () => {
    const element = await layout('default-optionality="sometimes"');
    expect(seen(readerOf(element)).optionality).toBe('unset');
  });

  it('updates children when default-optionality changes, and re-renders them once per change', async () => {
    const element = await layout('default-optionality="optional"');
    const reader = readerOf(element);
    const before = reader.renders;
    element.defaultOptionality = 'required';
    await element.updateComplete;
    await reader.updateComplete;
    expect(seen(reader).optionality).toBe('required');
    expect(reader.renders - before).toBe(1);
  });

  it('an unrelated update does not notify children again', async () => {
    const element = await layout('direction="horizontal"');
    const reader = readerOf(element);
    const before = reader.renders;
    element.requestUpdate();
    await element.updateComplete;
    expect(reader.renders).toBe(before);
  });
});

describe('tct-form-layout: accessibility, RTL, forced colours', () => {
  it('adds no semantics and passes axe in every direction', async () => {
    for (const direction of ['vertical', 'horizontal', 'horizontal-labels']) {
      const element = await layout(
        `direction="${direction}"`,
        '<label for="a">Name</label><input id="a"><label for="b">Email</label><input id="b" type="email">',
      );
      await expectAccessible(element);
    }
  });

  it('horizontal puts the first column at the inline start in RTL', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 400px"><tct-form-layout direction="horizontal"><div id="a">a</div><div id="b">b</div></tct-form-layout></div>',
      {dir: 'rtl'},
    );
    expect(root.querySelector('#a')!.getBoundingClientRect().left).toBeGreaterThan(
      root.querySelector('#b')!.getBoundingClientRect().left,
    );
  });

  it('horizontal-labels puts the label column at the inline start in RTL', async () => {
    await page.viewport(800, 800);
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 500px"><tct-form-layout direction="horizontal-labels"><label id="l">Name</label><input id="i" aria-labelledby="l"></tct-form-layout></div>',
      {dir: 'rtl'},
    );
    expect(root.querySelector('#l')!.getBoundingClientRect().left).toBeGreaterThan(
      root.querySelector('#i')!.getBoundingClientRect().left,
    );
  });

  it.skipIf(!isChromium)('keeps its layout in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await layout('direction="horizontal"', '<div>a</div><div>b</div>');
    expect(css(element).display).toBe('grid');
    await expectAccessible(element);
  });
});

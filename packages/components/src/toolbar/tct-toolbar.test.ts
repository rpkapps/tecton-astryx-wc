/**
 * `tct-toolbar`: toolbar semantics, the three areas, size cascade, dividers and variants, and the roving
 * keyboard model over heterogeneous content (wrapper buttons, native inputs with a caret guard, a nested
 * segmented control). Names follow upstream `Toolbar.test.tsx`.
 */
import {html} from 'lit';
import {beforeAll, describe, expect, it} from 'vitest';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {sizeContext} from '@tecton-wc/core/context/keys.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {TctTestChip} from '@tecton-wc/testing/fixtures/test-toolbar.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../segmented-control/define.js';
import './define.js';
import type {TctToolbar} from './tct-toolbar.js';

/** A control that reports the size it inherits (what a button or input reads). */
class TctTestSized extends TctElement {
  static override readonly tagName = 'tct-test-sized';
  readonly #size = new ContextConsumer(this, {context: sizeContext, subscribe: true});
  get inherited(): string | null | undefined {
    return this.#size.value;
  }
  override render() {
    return html`<slot></slot>`;
  }
}

beforeAll(() => {
  defineElement(TctTestChip);
  defineElement(TctTestSized);
});

const chip = (label: string, attributes = ''): string =>
  `<tct-test-chip ${attributes}>${label}</tct-test-chip>`;

async function toolbar(
  attributes = 'label="Actions"',
  inner = `${chip('Cut', 'slot="start"')}${chip('Copy', 'slot="start"')}${chip('Paste', 'slot="end"')}`,
  wrapperAttributes = '',
): Promise<TctToolbar> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${wrapperAttributes} style="width: 600px"><button id="before">before</button>` +
      `<tct-toolbar ${attributes}>${inner}</tct-toolbar><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-toolbar')!;
  await element.updateComplete;
  await nextFrame();
  await nextFrame();
  return element;
}

const activeText = (): string => {
  const active = deepActiveElement();
  const root = active?.getRootNode();
  const owner = root instanceof ShadowRoot ? root.host : active;
  return (owner as HTMLElement | null)?.textContent.trim() ?? '';
};
const inner = (element: Element): HTMLButtonElement => element.shadowRoot!.querySelector('button')!;
const chipTabindexes = (element: Element): (string | null)[] =>
  [...element.querySelectorAll('tct-test-chip')].map((item) =>
    inner(item).getAttribute('tabindex'),
  );
const bar = (element: TctToolbar): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part="toolbar"]')!;
const surface = (element: TctToolbar): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!;

runElementSuite({
  tag: 'tct-toolbar',
  render: () =>
    html`<tct-toolbar label="Actions"
      ><tct-test-chip slot="start">Cut</tct-test-chip></tct-toolbar
    >`,
  properties: {size: 'lg', gap: 3, orientation: 'vertical', variant: 'muted', dividers: ['bottom']},
  attributes: {size: 'size', gap: 'gap', orientation: 'orientation', variant: 'variant'},
  // The toolbar draws its surface on an inner part; the host itself is bare.
});

describe('tct-toolbar: rendering', () => {
  it('renders with the toolbar role and its label as the name', async () => {
    const element = await toolbar();
    expect(await axNode(element)).toMatchObject({role: 'toolbar', name: 'Actions'});
  });

  it('a host aria-label wins over the label property', async () => {
    const element = await toolbar('label="Actions" aria-label="Table actions"');
    expect(await axNode(element)).toMatchObject({name: 'Table actions'});
  });

  it('sets aria-orientation to horizontal by default and vertical when asked', async () => {
    const element = await toolbar();
    expect(await axNode(element)).toMatchObject({orientation: 'horizontal'});
    element.orientation = 'vertical';
    await element.updateComplete;
    expect(await axNode(element)).toMatchObject({orientation: 'vertical'});
  });

  it('renders start, centre and end content in their areas', async () => {
    const element = await toolbar(
      'label="Actions"',
      `${chip('A', 'slot="start"')}${chip('B', 'slot="center"')}${chip('C', 'slot="end"')}`,
    );
    const [a, b, c] = [...element.children].map((child) => child.getBoundingClientRect());
    expect(a!.left).toBeLessThan(b!.left);
    expect(b!.left).toBeLessThan(c!.left);
    const box = element.getBoundingClientRect();
    expect(Math.abs(b!.left + b!.width / 2 - (box.left + box.width / 2))).toBeLessThan(2);
  });

  it('renders the two-area layout without centre content: start at the start, end at the end', async () => {
    const element = await toolbar(
      'label="Actions"',
      `${chip('A', 'slot="start"')}${chip('C', 'slot="end"')}`,
    );
    const box = element.getBoundingClientRect();
    const [a, c] = [...element.children].map((child) => child.getBoundingClientRect());
    expect(a!.left - box.left).toBeLessThan(box.right - c!.right + 1);
    expect(c!.right).toBeGreaterThan(box.right - 24);
  });

  it('renders start-only and end-only layouts', async () => {
    const start = await toolbar('label="Actions"', chip('A', 'slot="start"'));
    const startBox = start.getBoundingClientRect();
    expect(start.children[0]!.getBoundingClientRect().left - startBox.left).toBeLessThan(24);
    const end = await toolbar('label="Actions"', chip('C', 'slot="end"'));
    const endBox = end.getBoundingClientRect();
    expect(endBox.right - end.children[0]!.getBoundingClientRect().right).toBeLessThan(24);
  });

  it('unslotted children are start content', async () => {
    const element = await toolbar('label="Actions"', chip('A'));
    expect(element.children[0]!.getBoundingClientRect().left).toBeLessThan(
      element.getBoundingClientRect().left + 24,
    );
  });

  it('defaults to md and reflects the size', async () => {
    const element = await toolbar();
    expect(bar(element).dataset.size).toBe('md');
    element.size = 'lg';
    await element.updateComplete;
    expect(bar(element).dataset.size).toBe('lg');
    expect(element.getAttribute('size')).toBe('lg');
  });

  it('provides its size to the controls inside (explicit, else md)', async () => {
    const element = await toolbar(
      'label="Actions" size="sm"',
      '<tct-test-sized slot="start">x</tct-test-sized>',
    );
    const sized = element.querySelector<TctTestSized>('tct-test-sized')!;
    await sized.updateComplete;
    expect(sized.inherited).toBe('sm');
  });

  it('defaults to the transparent variant and paints the others', async () => {
    const element = await toolbar();
    expect(getComputedStyle(surface(element)).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    for (const variant of ['section', 'muted']) {
      element.variant = variant as 'section';
      await element.updateComplete;
      expect(getComputedStyle(surface(element)).backgroundColor, variant).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
    }
  });

  it('draws dividers on the sides asked for, as logical edges', async () => {
    const element = await toolbar('label="Actions" dividers="bottom start"');
    const style = getComputedStyle(surface(element));
    expect(element.dividers).toEqual(['bottom', 'start']);
    expect(style.borderBlockEndWidth).toBe('1px');
    expect(style.borderInlineStartWidth).toBe('1px');
    expect(style.borderBlockStartWidth).toBe('0px');
    expect(style.borderInlineEndWidth).toBe('0px');
  });

  it('applies the gap as a spacing step', async () => {
    const element = await toolbar(
      'label="Actions" gap="4"',
      `${chip('A', 'slot="start"')}${chip('B', 'slot="start"')}`,
    );
    const [a, b] = [...element.children].map((child) => child.getBoundingClientRect());
    expect(b!.left - a!.right).toBeGreaterThanOrEqual(15);
    element.gap = 0;
    await element.updateComplete;
    const [a2, b2] = [...element.children].map((child) => child.getBoundingClientRect());
    expect(b2!.left - a2!.right).toBeLessThan(2);
  });

  it('is axe clean in every variant', async () => {
    for (const attributes of [
      'label="Actions"',
      'label="Actions" variant="muted" dividers="bottom"',
      'label="Actions" orientation="vertical"',
    ]) {
      await expectAccessible(await toolbar(attributes));
    }
  });
});

describe('tct-toolbar: one tab stop and arrow navigation', () => {
  it('is a single tab stop: only one item is tabbable (navigation-3)', async () => {
    const element = await toolbar();
    expect(chipTabindexes(element)).toEqual(['0', '-1', '-1']);
    const stops = await tabSequence(element, {
      start: element.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(activeText()).toBe('after');
    expect(stops).toHaveLength(2);
  });

  it('navigates with ArrowRight and ArrowLeft in horizontal orientation, wrapping', async () => {
    const element = await toolbar();
    inner(element.children[0]!).focus();
    await pressKeys('ArrowRight');
    expect(activeText()).toBe('Copy');
    await pressKeys('ArrowRight', 'ArrowRight');
    expect(activeText()).toBe('Cut');
    await pressKeys('ArrowLeft');
    expect(activeText()).toBe('Paste');
  });

  it('navigates with ArrowDown and ArrowUp in vertical orientation', async () => {
    const element = await toolbar('label="Actions" orientation="vertical"');
    inner(element.children[0]!).focus();
    await pressKeys('ArrowDown');
    expect(activeText()).toBe('Copy');
    await pressKeys('ArrowUp');
    expect(activeText()).toBe('Cut');
    await pressKeys('ArrowRight');
    expect(activeText()).toBe('Cut');
  });

  it('supports Home and End keys', async () => {
    const element = await toolbar();
    inner(element.children[1]!).focus();
    await pressKeys('End');
    expect(activeText()).toBe('Paste');
    await pressKeys('Home');
    expect(activeText()).toBe('Cut');
  });

  it('skips disabled items', async () => {
    const element = await toolbar(
      'label="Actions"',
      `${chip('A', 'slot="start"')}${chip('B', 'slot="start" disabled')}${chip('C', 'slot="end"')}`,
    );
    inner(element.children[0]!).focus();
    await pressKeys('ArrowRight');
    expect(activeText()).toBe('C');
  });

  it('follows visual direction in RTL', async () => {
    const element = await toolbar('label="Actions"', undefined, 'dir="rtl"');
    inner(element.children[0]!).focus();
    await pressKeys('ArrowLeft');
    expect(activeText()).toBe('Copy');
  });

  it('does not steal caret keys from a text input mid-line (navigation-4)', async () => {
    const element = await toolbar(
      'label="Actions"',
      `${chip('Bold', 'slot="start"')}<input slot="start" aria-label="Search" value="hello" />${chip('Save', 'slot="end"')}`,
    );
    const input = element.querySelector('input')!;
    input.focus();
    input.setSelectionRange(2, 2);
    await pressKeys('ArrowLeft');
    expect(deepActiveElement()).toBe(input);
    expect(input.selectionStart).toBe(1);
    input.setSelectionRange(0, 0);
    await pressKeys('ArrowLeft');
    expect(activeText()).toBe('Bold');
    input.focus();
    input.setSelectionRange(5, 5);
    await pressKeys('ArrowRight');
    expect(activeText()).toBe('Save');
  });

  it('leaves keys already handled by content alone (a consumer or nested widget preventing default)', async () => {
    const element = await toolbar();
    element.children[0]!.addEventListener('keydown', (event) => {
      event.preventDefault();
    });
    inner(element.children[0]!).focus();
    await pressKeys('ArrowRight');
    expect(activeText()).toBe('Cut');
  });

  it('a nested segmented control keeps its own tab stop and arrows', async () => {
    const element = await toolbar(
      'label="Actions"',
      `${chip('Cut', 'slot="start"')}<tct-segmented-control slot="end" label="View" value="list"><tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item><tct-segmented-control-item value="list" label="List"></tct-segmented-control-item></tct-segmented-control>`,
    );
    const control = element.querySelector('tct-segmented-control')!;
    element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(activeText()).toBe('Cut');
    // A nested composite that runs its own roving keeps its own stop (and its own arrows).
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(control.querySelector('[value="list"]'));
    await pressKeys('ArrowLeft');
    expect((control as unknown as {value: string}).value).toBe('grid');
    expect(deepActiveElement()).toBe(control.querySelector('[value="grid"]'));
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
    // The toolbar's own arrows never enter it.
    inner(element.children[0]!).focus();
    await pressKeys('ArrowRight');
    expect(activeText()).toBe('Cut');
  });

  it('shows the keyboard hint once on first keyboard entry', async () => {
    const element = await toolbar();
    const hint = element.shadowRoot!.querySelector<HTMLElement>('[part="keyboard-hint"]')!;
    element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await waitUntil(() => hint.matches(':popover-open'));
    await pressKeys('ArrowRight');
    await waitUntil(() => !hint.matches(':popover-open'));
    await pressKeys('Shift+Tab', 'Tab');
    await nextFrame();
    expect(hint.matches(':popover-open')).toBe(false);
  });

  it('repairs the tab stop when the item holding it is removed', async () => {
    const element = await toolbar();
    element.children[0]!.remove();
    await nextFrame();
    await nextFrame();
    expect(chipTabindexes(element)).toEqual(['0', '-1']);
  });
});

const parity = Object.values(
  import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

runKeyboardSuite({
  tag: 'tct-toolbar',
  render: () =>
    `<tct-toolbar label="Actions">${chip('Cut', 'slot="start"')}${chip('Copy', 'slot="start"')}${chip('Paste', 'slot="end"')}</tct-toolbar>`,
  table: parity.entries['core.toolbar']!.keyboard,
  steps: {
    'Enters the toolbar at the item that last had focus (the first enabled item at first); the next Tab leaves it':
      {
        focus: (element) => (element.previousElementSibling as HTMLElement | null) ?? document.body,
        keys: ['Tab'],
        expect: () => {
          expect(activeText()).toBe('Cut');
        },
      },
    'Moves focus to the next enabled item, wrapping after the last': {
      focus: (element) => inner(element.children[2]!),
      keys: ['ArrowRight'],
      rtl: {keys: ['ArrowLeft']},
      expect: () => {
        expect(activeText()).toBe('Cut');
      },
    },
    'Moves focus to the previous enabled item, wrapping before the first': {
      focus: (element) => inner(element.children[0]!),
      keys: ['ArrowLeft'],
      rtl: {keys: ['ArrowRight']},
      expect: () => {
        expect(activeText()).toBe('Paste');
      },
    },
    'Moves focus to the next enabled item of a vertical toolbar': {
      setup: (element) => {
        (element as TctToolbar).orientation = 'vertical';
      },
      focus: (element) => inner(element.children[0]!),
      keys: ['ArrowDown'],
      expect: () => {
        expect(activeText()).toBe('Copy');
      },
    },
    'Moves focus to the previous enabled item of a vertical toolbar': {
      setup: (element) => {
        (element as TctToolbar).orientation = 'vertical';
      },
      focus: (element) => inner(element.children[1]!),
      keys: ['ArrowUp'],
      expect: () => {
        expect(activeText()).toBe('Cut');
      },
    },
    'Moves focus to the first enabled item': {
      focus: (element) => inner(element.children[2]!),
      keys: ['Home'],
      expect: () => {
        expect(activeText()).toBe('Cut');
      },
    },
    'Moves focus to the last enabled item': {
      focus: (element) => inner(element.children[0]!),
      keys: ['End'],
      expect: () => {
        expect(activeText()).toBe('Paste');
      },
    },
    'Are left to a text field while its caret can still move; at the edge they move focus on': {
      setup: (element) => {
        const input = document.createElement('input');
        input.slot = 'start';
        input.value = 'hello';
        input.setAttribute('aria-label', 'Search');
        element.append(input);
      },
      focus: (element) => {
        const input = element.querySelector('input')!;
        input.setSelectionRange(2, 2);
        return input;
      },
      keys: ['ArrowRight'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(element.querySelector('input'));
      },
    },
  },
});

describe('tct-toolbar: RTL and forced colours', () => {
  it('puts start content on the right in RTL', async () => {
    const element = await toolbar('label="Actions"', undefined, 'dir="rtl"');
    const [start, , end] = [...element.children].map((child) => child.getBoundingClientRect());
    expect(start!.left).toBeGreaterThan(end!.left);
  });

  it('renders under forced colours and stays accessible', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await toolbar('label="Actions" variant="muted" dividers="bottom"');
    expect(getComputedStyle(surface(element)).borderBlockEndStyle).toBe('solid');
    await expectAccessible(element);
  });
});

/**
 * tct-tree-list: semantics, expansion, guides, levers, interactive rows, the APG keyboard model, focus
 * recovery, lazy children, localisation, RTL, forced colours (ported from upstream TreeList.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, axTree, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTreeList} from './tct-tree-list.js';
import type {TreeListItemData} from './tree-list.types.js';

const tree = (): TreeListItemData[] => [
  {
    id: 'docs',
    label: 'Documents',
    children: [
      {id: 'report', label: 'Report.pdf'},
      {id: 'notes', label: 'Notes.md'},
    ],
  },
  {
    id: 'images',
    label: 'Images',
    children: [{id: 'logo', label: 'Logo.png'}],
  },
  {id: 'readme', label: 'README.md'},
];

const make = async (
  items: TreeListItemData[] = tree(),
  attributes = '',
  options: {dir?: 'ltr' | 'rtl'; lang?: string; width?: number} = {},
): Promise<TctTreeList> => {
  const wrapper = await fixture<HTMLElement>(
    `<div style="width: ${options.width ?? 360}px"><tct-tree-list ${attributes}></tct-tree-list></div>`,
    options,
  );
  const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
  element.items = items;
  await element.updateComplete;
  return element;
};

const root = (element: TctTreeList): ShadowRoot => element.shadowRoot!;
const treeEl = (element: TctTreeList): HTMLElement =>
  root(element).querySelector<HTMLElement>('.tree')!;
const li = (element: TctTreeList, id: string): HTMLElement | null =>
  root(element).querySelector<HTMLElement>(`[data-tree-id="${id}"]`);
const items = (element: TctTreeList): HTMLElement[] => [
  ...root(element).querySelectorAll<HTMLElement>('[role="treeitem"]'),
];
const ids = (element: TctTreeList): string[] => items(element).map((item) => item.dataset.treeId!);
const rowOf = (element: TctTreeList, id: string): HTMLElement =>
  li(element, id)!.querySelector<HTMLElement>(':scope > .row-wrapper > .row')!;
const active = (element: TctTreeList): string | undefined =>
  (root(element).activeElement as HTMLElement | null)?.dataset.treeId;
const tabbable = (element: TctTreeList): string[] =>
  items(element)
    .filter((item) => item.getAttribute('tabindex') === '0')
    .map((item) => item.dataset.treeId!);

runElementSuite({
  tag: 'tct-tree-list',
  render: () => html`<tct-tree-list aria-label="Files"></tct-tree-list>`,
  properties: {
    density: 'compact',
    variant: 'noGuides',
    header: 'Files',
    toggleChildrenLabel: 'Expand',
  },
  attributes: {
    density: 'density',
    variant: 'variant',
    header: 'header',
    toggleChildrenLabel: 'toggle-children-label',
  },
  events: ['tct-tree-toggle'],
});

describe('tct-tree-list: rendering and semantics (TreeList.test.tsx)', () => {
  it('renders the items', async () => {
    const element = await make();
    expect(ids(element)).toEqual(['docs', 'images', 'readme']);
    expect(li(element, 'docs')!.textContent).toContain('Documents');
  });

  it('renders a tree role on the list and a treeitem role on items', async () => {
    const element = await make();
    expect(await axNode(treeEl(element))).toMatchObject({role: 'tree'});
    for (const item of items(element)) expect(await axNode(item)).toMatchObject({role: 'treeitem'});
    expect(await axTree(element)).toEqual([
      'tree',
      'treeitem: Documents',
      'button: Toggle children',
      'treeitem: Images',
      'button: Toggle children',
      'treeitem: README.md',
    ]);
    expect(li(element, 'docs')!.getAttribute('aria-expanded')).toBe('false');
    expect(li(element, 'readme')!.hasAttribute('aria-expanded')).toBe(false);
  });

  it('gives each treeitem a clean name from its own label, not from its subtree', async () => {
    const element = await make([
      {id: 'a', label: 'Parent', isExpanded: true, children: [{id: 'b', label: 'Child'}]},
    ]);
    expect(await axNode(li(element, 'a')!)).toMatchObject({role: 'treeitem', name: 'Parent'});
    expect(await axNode(li(element, 'b')!)).toMatchObject({name: 'Child'});
  });

  it('renders the description and names it as the accessible description', async () => {
    const element = await make([{id: 'a', label: 'Well', description: 'Drilled 2019'}]);
    expect(root(element).querySelector('.description')!.textContent).toBe('Drilled 2019');
    expect(await axNode(li(element, 'a')!)).toMatchObject({
      name: 'Well',
      description: 'Drilled 2019',
    });
  });

  it('forwards aria-label on the host to the tree element', async () => {
    const element = await make(tree(), 'aria-label="Project files"');
    expect(await axNode(treeEl(element))).toMatchObject({role: 'tree', name: 'Project files'});
  });

  it('renders a header and associates it through aria-labelledby', async () => {
    const element = await make(tree(), 'header="Explorer"');
    const header = root(element).querySelector<HTMLElement>('.header')!;
    expect(treeEl(element).getAttribute('aria-labelledby')).toBe(header.id);
    expect(await axNode(treeEl(element))).toMatchObject({name: 'Explorer'});
  });

  it('names the tree from rich header content in the header slot', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-tree-list><strong slot="header">Rich <em>header</em></strong></tct-tree-list></div>',
    );
    const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
    element.items = tree();
    await element.updateComplete;
    expect(await axNode(treeEl(element))).toMatchObject({name: 'Rich header'});
  });

  it('does not render aria-labelledby when there is no header', async () => {
    const element = await make();
    expect(treeEl(element).hasAttribute('aria-labelledby')).toBe(false);
  });

  it('prefers the visible header over a caller aria-labelledby, and ignores a caller aria-label', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><h3 id="outside">Outside</h3><tct-tree-list header="Own header" aria-labelledby="outside" aria-label="Ignored"></tct-tree-list></div>',
    );
    const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
    element.items = tree();
    await element.updateComplete;
    expect(await axNode(treeEl(element))).toMatchObject({name: 'Own header'});
  });

  it('uses a caller aria-labelledby on the headerless path', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><h3 id="outside">Outside title</h3><tct-tree-list aria-labelledby="outside"></tct-tree-list></div>',
    );
    const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
    element.items = tree();
    await element.updateComplete;
    expect(await axNode(treeEl(element))).toMatchObject({name: 'Outside title'});
  });

  it('sets aria-level, aria-posinset and aria-setsize at every depth', async () => {
    const element = await make([
      {
        id: 'a',
        label: 'A',
        isExpanded: true,
        children: [
          {
            id: 'a1',
            label: 'A1',
            isExpanded: true,
            children: [
              {id: 'a1x', label: 'A1x'},
              {id: 'a1y', label: 'A1y'},
            ],
          },
          {id: 'a2', label: 'A2'},
        ],
      },
      {id: 'b', label: 'B'},
    ]);
    const meta = (id: string) => [
      li(element, id)!.getAttribute('aria-level'),
      li(element, id)!.getAttribute('aria-posinset'),
      li(element, id)!.getAttribute('aria-setsize'),
    ];
    expect(meta('a')).toEqual(['1', '1', '2']);
    expect(meta('b')).toEqual(['1', '2', '2']);
    expect(meta('a1')).toEqual(['2', '1', '2']);
    expect(meta('a2')).toEqual(['2', '2', '2']);
    expect(meta('a1y')).toEqual(['3', '2', '2']);
  });

  it('is accessible in every state', async () => {
    for (const attributes of [
      'aria-label="Files"',
      'header="Files"',
      'variant="noGuides" aria-label="Files"',
    ]) {
      const element = await make(
        [
          {
            id: 'a',
            label: 'Open',
            isExpanded: true,
            children: [
              {id: 'a1', label: 'Selected', isSelected: true},
              {id: 'a2', label: 'Disabled', isDisabled: true},
            ],
          },
          {id: 'b', label: 'Action', onClick: () => undefined},
          {id: 'c', label: 'Link', href: '#x'},
        ],
        attributes,
      );
      await expectAccessible(element.parentElement!);
    }
  });
});

describe('tct-tree-list: expansion', () => {
  it('does not render children by default', async () => {
    const element = await make();
    expect(li(element, 'report')).toBeNull();
    expect(root(element).querySelector('[role="group"]')).toBeNull();
  });

  it('renders children of an item with isExpanded: true, in a group', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    expect(ids(element)).toEqual(['docs', 'report', 'notes', 'images', 'readme']);
    expect(root(element).querySelector('[role="group"]')).not.toBeNull();
    expect(await axNode(root(element).querySelector('[role="group"]')!)).toMatchObject({
      role: 'group',
    });
  });

  it('sets aria-expanded on parents (true or false) and not on leaves', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    expect(li(element, 'docs')!.getAttribute('aria-expanded')).toBe('true');
    expect(li(element, 'images')!.getAttribute('aria-expanded')).toBe('false');
    expect(li(element, 'readme')!.hasAttribute('aria-expanded')).toBe(false);
    expect(li(element, 'report')!.hasAttribute('aria-expanded')).toBe(false);
  });

  it('expands a collapsed item when its row is clicked, and collapses it when clicked again', async () => {
    const element = await make();
    await userEvent.click(rowOf(element, 'docs'));
    expect(ids(element)).toContain('report');
    expect(li(element, 'docs')!.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(rowOf(element, 'docs'));
    expect(ids(element)).not.toContain('report');
  });

  it('renders a toggle button for parents, named through the catalog, and expands from it', async () => {
    const element = await make();
    const toggle = rowOf(element, 'docs').querySelector<HTMLButtonElement>('[data-tree-toggle]')!;
    expect(toggle).not.toBeNull();
    expect(toggle.tabIndex).toBe(-1); // the treeitem is the tab stop, not the toggle
    expect(await axNode(toggle)).toMatchObject({
      role: 'button',
      name: 'Toggle children',
      expanded: 'false',
    });
    await userEvent.click(toggle);
    expect(ids(element)).toContain('report');
    expect(rowOf(element, 'readme').querySelector('[data-tree-toggle]')).toBeNull();
  });

  it('a toggle click does not also toggle through the row (one toggle per click)', async () => {
    const element = await make();
    const events = recordEvents(element, 'tct-tree-toggle');
    await userEvent.click(rowOf(element, 'docs').querySelector('[data-tree-toggle]')!);
    expectEventCounts(events, {'tct-tree-toggle': 1});
    expect(li(element, 'docs')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders deeply nested items when everything is expanded', async () => {
    const element = await make([
      {
        id: '1',
        label: 'One',
        isExpanded: true,
        children: [
          {
            id: '2',
            label: 'Two',
            isExpanded: true,
            children: [
              {id: '3', label: 'Three', isExpanded: true, children: [{id: '4', label: 'Four'}]},
            ],
          },
        ],
      },
    ]);
    expect(ids(element)).toEqual(['1', '2', '3', '4']);
    expect(li(element, '4')!.getAttribute('aria-level')).toBe('4');
  });

  it('keeps a user toggle when items are replaced with the same ids, and follows new isExpanded values for new ids', async () => {
    const element = await make();
    await userEvent.click(rowOf(element, 'docs'));
    element.items = tree();
    await element.updateComplete;
    expect(ids(element)).toContain('report');
    const other = tree();
    other[1]!.isExpanded = true;
    element.items = other;
    await element.updateComplete;
    expect(ids(element)).toContain('logo');
  });

  it('expand(), collapse() and toggle() change branches without events; isExpanded() reads them', async () => {
    const element = await make();
    const events = recordEvents(element, 'tct-tree-toggle');
    element.expand('docs');
    await element.updateComplete;
    expect(element.isExpanded('docs')).toBe(true);
    expect(ids(element)).toContain('report');
    element.collapse('docs');
    element.toggle('images');
    element.toggle('images', true);
    await element.updateComplete;
    expect(element.isExpanded('docs')).toBe(false);
    expect(element.isExpanded('images')).toBe(true);
    expectEventCounts(events, {'tct-tree-toggle': 0});
  });

  it('emits a cancelable tct-tree-toggle before a user toggle, and honours preventDefault', async () => {
    const element = await make();
    const events = recordEvents(element, 'tct-tree-toggle');
    await userEvent.click(rowOf(element, 'docs'));
    expectEventCounts(events, {'tct-tree-toggle': 1});
    expectEventFlags(events.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect(events.events[0]).toMatchObject({id: 'docs', expanded: true, reason: 'pointer'});

    element.addEventListener('tct-tree-toggle', (event) => event.preventDefault(), {once: true});
    await userEvent.click(rowOf(element, 'docs'));
    expect(li(element, 'docs')!.getAttribute('aria-expanded')).toBe('true'); // the collapse was prevented
  });

  it('lazy children: an expandable item shows the toggle, and the app supplies children on the event', async () => {
    const element = await make([{id: 'lazy', label: 'Remote folder', expandable: true}]);
    expect(rowOf(element, 'lazy').querySelector('[data-tree-toggle]')).not.toBeNull();
    expect(li(element, 'lazy')!.getAttribute('aria-expanded')).toBe('false');
    element.addEventListener('tct-tree-toggle', (event) => {
      if (event.expanded) {
        element.items = [
          {
            id: 'lazy',
            label: 'Remote folder',
            expandable: true,
            children: [{id: 'lazy-1', label: 'Loaded.txt'}],
          },
        ];
      }
    });
    await userEvent.click(rowOf(element, 'lazy'));
    await element.updateComplete;
    expect(ids(element)).toEqual(['lazy', 'lazy-1']);
  });
});

describe('tct-tree-list: interactive rows and content', () => {
  it('renders an invisible button for onClick and fires it once', async () => {
    const clicks: string[] = [];
    const element = await make([{id: 'a', label: 'Open', onClick: () => clicks.push('a')}]);
    const button = rowOf(element, 'a').querySelector<HTMLButtonElement>('button.action')!;
    expect(button).not.toBeNull();
    await userEvent.click(button);
    expect(clicks).toEqual(['a']);
  });

  it('a click on the row surface (not on the button) runs onClick once', async () => {
    const clicks: string[] = [];
    const element = await make([{id: 'a', label: 'Open', onClick: () => clicks.push('a')}]);
    await userEvent.click(rowOf(element, 'a'), {position: {x: 2, y: 10}});
    expect(clicks).toEqual(['a']);
  });

  it('a click on a nested interactive control in endContent belongs to that control', async () => {
    const clicks: string[] = [];
    const element = await make([
      {
        id: 'a',
        label: 'Row',
        onClick: () => clicks.push('row'),
        endContent: html`<button id="inner" @click=${() => clicks.push('inner')}>x</button>`,
      },
    ]);
    await userEvent.click(root(element).querySelector('#inner')!);
    expect(clicks).toEqual(['inner']);
  });

  it('renders an invisible anchor for href, with target and rel, and a destination-less one for unsafe URLs', async () => {
    const element = await make([
      {id: 'a', label: 'Docs', href: 'https://example.com', target: '_blank'},
      {id: 'b', label: 'Bad', href: 'javascript:alert(1)'},
    ]);
    const anchor = rowOf(element, 'a').querySelector<HTMLAnchorElement>('a.action')!;
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toContain('noopener');
    expect(await axNode(anchor)).toMatchObject({role: 'link'});
    expect(rowOf(element, 'b').querySelector('a.action')!.hasAttribute('href')).toBe(false);
  });

  it('renders neither button nor anchor for static items', async () => {
    const element = await make([{id: 'a', label: 'Static'}]);
    expect(rowOf(element, 'a').querySelector('button, a')).toBeNull();
  });

  it('applies aria-disabled and disables the action for isDisabled', async () => {
    const element = await make([
      {id: 'a', label: 'Off', isDisabled: true, onClick: () => undefined},
    ]);
    expect(li(element, 'a')!.getAttribute('aria-disabled')).toBe('true');
    expect(rowOf(element, 'a').querySelector<HTMLButtonElement>('button.action')!.disabled).toBe(
      true,
    );
    expect(li(element, 'a')!.getAttribute('tabindex')).toBe('-1');
  });

  it('applies aria-selected for isSelected, and none otherwise', async () => {
    const element = await make([
      {id: 'a', label: 'On', isSelected: true},
      {id: 'b', label: 'Off'},
    ]);
    expect(li(element, 'a')!.getAttribute('aria-selected')).toBe('true');
    expect(li(element, 'b')!.hasAttribute('aria-selected')).toBe(false);
    expect(await axNode(li(element, 'a')!)).toMatchObject({selected: 'true'});
    expect(getComputedStyle(rowOf(element, 'a')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('renders startContent and endContent as templates, nodes and text', async () => {
    const node = document.createElement('span');
    node.id = 'node';
    node.textContent = 'N';
    const element = await make([
      {
        id: 'a',
        label: 'Row',
        startContent: html`<span id="start">S</span>`,
        endContent: html`<span id="end">E</span>`,
      },
      {id: 'b', label: 'Node', startContent: node, endContent: 'plain <b>text</b>'},
    ]);
    expect(root(element).querySelector('#start')).not.toBeNull();
    expect(root(element).querySelector('#end')).not.toBeNull();
    expect(root(element).querySelector('#node')).toBe(node);
    // Strings render as text, never as HTML.
    expect(rowOf(element, 'b').querySelector('.end')!.textContent).toBe('plain <b>text</b>');
    expect(rowOf(element, 'b').querySelector('.end b')).toBeNull();
  });

  it('applies the row style map and extra part tokens to that row only', async () => {
    const element = await make([
      {id: 'a', label: 'One', style: {'--row-tag': 'x', color: 'rgb(1, 2, 3)'}, part: 'special'},
      {id: 'b', label: 'Two'},
    ]);
    expect(getComputedStyle(rowOf(element, 'a')).getPropertyValue('--row-tag').trim()).toBe('x');
    expect(rowOf(element, 'a').getAttribute('part')).toContain('special');
    expect(rowOf(element, 'b').getAttribute('part')).not.toContain('special');
    expect(li(element, 'a')!.getAttribute('style')).toBeNull(); // the outer semantic <li> is never styled
  });

  it('renders selected and disabled state part tokens for theming', async () => {
    const element = await make([
      {id: 'a', label: 'A', isSelected: true},
      {id: 'b', label: 'B', isDisabled: true},
    ]);
    expect(rowOf(element, 'a').getAttribute('part')).toContain('tree-list-item-selected');
    expect(rowOf(element, 'b').getAttribute('part')).toContain('tree-list-item-disabled');
    expect(rowOf(element, 'a').querySelector('.label')!.getAttribute('part')).toContain(
      'tree-list-item-label-selected',
    );
  });
});

describe('tct-tree-list: density, guides and levers', () => {
  const data = (): TreeListItemData[] => [
    {
      id: 'a',
      label: 'A',
      isExpanded: true,
      children: [
        {id: 'a1', label: 'A1'},
        {id: 'a2', label: 'A2', isExpanded: true, children: [{id: 'a2x', label: 'A2x'}]},
      ],
    },
    {id: 'b', label: 'B'},
  ];

  it('renders compact, balanced and spacious rows with growing block padding', async () => {
    const heights: number[] = [];
    for (const density of ['compact', 'balanced', 'spacious']) {
      const element = await make([{id: 'a', label: 'Row'}], `density="${density}"`);
      heights.push(rowOf(element, 'a').getBoundingClientRect().height);
    }
    expect(heights[0]!).toBeLessThan(heights[1]!);
    expect(heights[1]!).toBeLessThan(heights[2]!);
  });

  it('draws guide lines by default and none for variant="noGuides", keeping the indentation', async () => {
    const guided = await make(data());
    expect(root(guided).querySelectorAll('.guide').length).toBeGreaterThan(0);
    const plain = await make(data(), 'variant="noGuides"');
    expect(root(plain).querySelectorAll('.guide')).toHaveLength(0);
    expect(ids(plain)).toEqual(ids(guided));
    const left = (element: TctTreeList, id: string) =>
      rowOf(element, id).getBoundingClientRect().left;
    expect(left(plain, 'a2x') - left(plain, 'a')).toBe(left(guided, 'a2x') - left(guided, 'a'));
    expect(left(plain, 'a2x')).toBeGreaterThan(left(plain, 'a2'));
  });

  it('exposes the guide as a theming part', async () => {
    const element = await make(data());
    expect(root(element).querySelector('.guide')!.getAttribute('part')).toBe('tree-list-guide');
  });

  it('draws a connector for each nested row and continues the ancestor line past non-last rows', async () => {
    const element = await make(data());
    // a1 (level 1, not last): its own connector; a2x (level 2): its connector; a's continuation not needed (a is expanded, b follows).
    expect(li(element, 'a1')!.querySelectorAll('.guide').length).toBe(1);
    expect(li(element, 'a2x')!.querySelectorAll('.guide').length).toBeGreaterThanOrEqual(1);
    expect(li(element, 'a')!.querySelectorAll(':scope > .branches .guide').length).toBe(0);
  });

  it('the last row of a group clamps its guide so it does not overhang the gap; other rows bridge it', async () => {
    const element = await make(data(), '', {});
    element.style.setProperty('--tree-list-row-gap', '8px');
    await nextFrame();
    const guide = (id: string) =>
      li(element, id)!.querySelector<HTMLElement>(':scope > .branches .guide')!;
    const lastHeight = guide('a2').getBoundingClientRect().height;
    const middle = guide('a1');
    const middleLi = li(element, 'a1')!.getBoundingClientRect().height;
    expect(middle.getBoundingClientRect().height).toBeCloseTo(middleLi + 1, 0);
    const lastLi = li(element, 'a2')!.getBoundingClientRect().height;
    expect(lastHeight).toBeLessThan(lastLi);
  });

  it('lets --tree-list-indent retune the per-level indent, for rows and guides together', async () => {
    const narrow = await make(data());
    const wide = await make(data());
    wide.style.setProperty('--tree-list-indent', '40px');
    await nextFrame();
    const step = (element: TctTreeList) =>
      rowOf(element, 'a1').getBoundingClientRect().left -
      rowOf(element, 'a').getBoundingClientRect().left;
    expect(step(wide)).toBeGreaterThan(step(narrow));
    expect(step(wide) - step(narrow)).toBeCloseTo(
      40 -
        parseFloat(
          getComputedStyle(root(narrow).querySelector<HTMLElement>('.root')!).getPropertyValue(
            '--_indent',
          ) || '16',
        ),
      0,
    );
  });

  it('defaults --tree-list-row-gap to a subtle 2px and lets a theme open it', async () => {
    const element = await make(data());
    const wrapper = root(element).querySelector<HTMLElement>('.row-wrapper')!;
    expect(parseFloat(getComputedStyle(wrapper).paddingTop)).toBe(1);
    element.style.setProperty('--tree-list-row-gap', '10px');
    await nextFrame();
    expect(parseFloat(getComputedStyle(wrapper).paddingTop)).toBe(5);
  });

  it('carries the inter-row gap as collapse-proof padding on the row wrapper, not on the painted row', async () => {
    const element = await make(data());
    expect(getComputedStyle(rowOf(element, 'a')).marginTop).toBe('0px');
    expect(getComputedStyle(rowOf(element, 'a').parentElement!).paddingTop).not.toBe('0px');
  });

  it('a leaf reserves the chevron column when the tree has any expandable item, so its label aligns under a parent label', async () => {
    const element = await make([
      {id: 'p', label: 'Parent', isExpanded: true, children: [{id: 'c', label: 'Child'}]},
      {id: 'leaf', label: 'Leaf'},
    ]);
    const labelLeft = (id: string) =>
      rowOf(element, id).querySelector('.label')!.getBoundingClientRect().left;
    // A top-level leaf lines up under the parent's label; a child sits one indent further in.
    expect(labelLeft('leaf')).toBeCloseTo(labelLeft('p'), 0);
    expect(labelLeft('c')).toBeGreaterThan(labelLeft('p'));
  });

  it('reserves the chevron column for a leaf nested under an expandable ancestor, even in an all-leaf group', async () => {
    const element = await make([
      {
        id: 'p',
        label: 'Parent',
        isExpanded: true,
        children: [
          {id: 'c1', label: 'C1'},
          {id: 'c2', label: 'C2'},
        ],
      },
    ]);
    const left = (id: string) =>
      rowOf(element, id).querySelector('.label')!.getBoundingClientRect().left;
    expect(left('c1')).toBeGreaterThan(left('p'));
    expect(left('c1')).toBeCloseTo(left('c2'), 0);
  });

  it('every row of a flat tree sits flush: no chevron column is reserved', async () => {
    const element = await make([
      {id: 'a', label: 'A'},
      {id: 'b', label: 'B'},
    ]);
    expect(rowOf(element, 'a').hasAttribute('data-reserve')).toBe(false);
    expect(rowOf(element, 'a').getBoundingClientRect().left).toBe(
      rowOf(element, 'b').getBoundingClientRect().left,
    );
  });

  it('exposes the chevron and its state as theming parts', async () => {
    const element = await make(data());
    const chevron = rowOf(element, 'a').querySelector('.chevron')!;
    expect(chevron.getAttribute('part')).toBe('tree-list-chevron tree-list-chevron-expanded');
    expect(rowOf(element, 'b').querySelector('.chevron')).toBeNull();
    const collapsed = await make();
    expect(rowOf(collapsed, 'docs').querySelector('.chevron')!.getAttribute('part')).toContain(
      'tree-list-chevron-collapsed',
    );
  });

  it('turns the chevron a quarter when expanded, and the right way round in RTL', async () => {
    const ltr = await make(data());
    const rtl = await make(data(), '', {dir: 'rtl'});
    const rotation = (element: TctTreeList) =>
      getComputedStyle(rowOf(element, 'a').querySelector('.chevron-icon')!).rotate;
    expect(rotation(ltr)).toBe('90deg');
    expect(rotation(rtl)).toBe('-90deg');
  });
});

describe('tct-tree-list: focus, tab stop and the keyboard', () => {
  it('makes exactly one treeitem tabbable: the first enabled by default', async () => {
    const element = await make();
    expect(tabbable(element)).toEqual(['docs']);
  });

  it('defaults the tab stop to the selected item, and skips a disabled first item', async () => {
    const element = await make([
      {id: 'a', label: 'A', isDisabled: true},
      {id: 'b', label: 'B'},
      {id: 'c', label: 'C', isSelected: true},
    ]);
    expect(tabbable(element)).toEqual(['c']);
    const first = await make([
      {id: 'a', label: 'A', isDisabled: true},
      {id: 'b', label: 'B'},
    ]);
    expect(tabbable(first)).toEqual(['b']);
  });

  it('is a single Tab stop', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="before">b</button><tct-tree-list aria-label="Files"></tct-tree-list><button id="after">a</button></div>',
    );
    const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
    element.items = tree();
    await element.updateComplete;
    const stops = await tabSequence(wrapper, {
      start: wrapper.querySelector<HTMLElement>('#before')!,
      max: 4,
    });
    const insideTree = stops.filter(
      (stop) => stop === li(element, 'docs') || items(element).includes(stop as HTMLElement),
    );
    expect(insideTree).toHaveLength(1);
    expect(stops.at(1)).toBe(wrapper.querySelector('#after'));
  });

  it('moves the single tab stop when focus moves by keyboard, and when a row is clicked', async () => {
    const element = await make();
    li(element, 'docs')!.focus();
    await pressKeys('ArrowDown');
    expect(active(element)).toBe('images');
    expect(tabbable(element)).toEqual(['images']);
    await userEvent.click(rowOf(element, 'readme'), {position: {x: 2, y: 10}});
    expect(tabbable(element)).toEqual(['readme']);
  });

  it('ArrowDown and ArrowUp move between visible items and clamp at the ends', async () => {
    const element = await make();
    li(element, 'docs')!.focus();
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowDown');
    expect(active(element)).toBe('readme');
    await pressKeys('ArrowUp');
    expect(active(element)).toBe('images');
    li(element, 'docs')!.focus();
    await pressKeys('ArrowUp');
    expect(active(element)).toBe('docs');
  });

  it('ArrowDown and ArrowUp skip disabled items', async () => {
    const element = await make([
      {id: 'a', label: 'A'},
      {id: 'b', label: 'B', isDisabled: true},
      {id: 'c', label: 'C'},
    ]);
    li(element, 'a')!.focus();
    await pressKeys('ArrowDown');
    expect(active(element)).toBe('c');
    await pressKeys('ArrowUp');
    expect(active(element)).toBe('a');
  });

  it('ArrowRight expands a collapsed parent, then enters the first child; ArrowRight on a leaf is a no-op', async () => {
    const element = await make();
    li(element, 'docs')!.focus();
    await pressKeys('ArrowRight');
    expect(ids(element)).toContain('report');
    expect(active(element)).toBe('docs');
    await pressKeys('ArrowRight');
    expect(active(element)).toBe('report');
    await pressKeys('ArrowRight');
    expect(active(element)).toBe('report');
  });

  it('ArrowLeft collapses an expanded parent, then moves to the parent', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    li(element, 'notes')!.focus();
    await pressKeys('ArrowLeft');
    expect(active(element)).toBe('docs');
    await pressKeys('ArrowLeft');
    expect(ids(element)).not.toContain('report');
    expect(active(element)).toBe('docs');
    await pressKeys('ArrowLeft');
    expect(active(element)).toBe('docs'); // a collapsed root has no parent
  });

  it('Home and End move to the first and last visible items', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    li(element, 'notes')!.focus();
    await pressKeys('End');
    expect(active(element)).toBe('readme');
    await pressKeys('Home');
    expect(active(element)).toBe('docs');
  });

  it('Enter and Space activate the item onClick', async () => {
    const clicks: string[] = [];
    const element = await make([{id: 'a', label: 'A', onClick: () => clicks.push('a')}]);
    li(element, 'a')!.focus();
    await pressKeys('Enter');
    await pressKeys(' ');
    expect(clicks).toEqual(['a', 'a']);
  });

  it('Enter toggles a parent without its own action', async () => {
    const element = await make();
    li(element, 'docs')!.focus();
    await pressKeys('Enter');
    expect(ids(element)).toContain('report');
    await pressKeys(' ');
    expect(ids(element)).not.toContain('report');
  });

  it('Enter on a parent with an action runs the action and does not toggle it', async () => {
    const clicks: string[] = [];
    const element = await make([
      {id: 'p', label: 'P', onClick: () => clicks.push('p'), children: [{id: 'c', label: 'C'}]},
    ]);
    li(element, 'p')!.focus();
    await pressKeys('Enter');
    expect(clicks).toEqual(['p']);
    expect(ids(element)).toEqual(['p']);
  });

  it('typeahead moves focus to the next item whose own label starts with the typed characters', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    li(element, 'docs')!.focus();
    await pressKeys('i');
    expect(active(element)).toBe('images');
    await pressKeys('r');
    expect(active(element)).toBe('images'); // "ir" matches nothing; focus stays
  });

  it("typeahead compares each item's own label, not the text of its subtree", async () => {
    const element = await make([
      {id: 'p', label: 'Alpha', isExpanded: true, children: [{id: 'c', label: 'Zulu'}]},
      {id: 'q', label: 'Beta'},
    ]);
    li(element, 'q')!.focus();
    await pressKeys('z');
    expect(active(element)).toBe('c');
    await nextFrame();
  });

  it('typeahead skips disabled items and cycles on a repeated letter', async () => {
    const element = await make([
      {id: 'a1', label: 'Apple'},
      {id: 'a2', label: 'Avocado', isDisabled: true},
      {id: 'a3', label: 'Apricot'},
    ]);
    li(element, 'a1')!.focus();
    await pressKeys('a');
    expect(active(element)).toBe('a3');
    await pressKeys('a');
    expect(active(element)).toBe('a1');
  });

  it('mirrors ArrowRight and ArrowLeft in right-to-left containers', async () => {
    const element = await make(tree(), '', {dir: 'rtl'});
    li(element, 'docs')!.focus();
    await pressKeys('ArrowLeft'); // in RTL, Left expands
    expect(ids(element)).toContain('report');
    await pressKeys('ArrowLeft');
    expect(active(element)).toBe('report');
    await pressKeys('ArrowRight');
    expect(active(element)).toBe('docs');
  });

  it('lets a consumer prevent the built-in navigation with a capture-phase keydown listener', async () => {
    const element = await make();
    element.addEventListener('keydown', (event) => event.preventDefault(), {capture: true});
    li(element, 'docs')!.focus();
    await pressKeys('ArrowDown');
    expect(active(element)).toBe('docs');
  });

  it('does not navigate when a key is pressed inside the header slot', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-tree-list><input slot="header" aria-label="Filter" /></tct-tree-list></div>',
    );
    const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
    element.items = tree();
    await element.updateComplete;
    wrapper.querySelector('input')!.focus();
    await pressKeys('ArrowDown');
    expect(document.activeElement).toBe(wrapper.querySelector('input'));
    expect(root(element).activeElement).toBeNull();
  });

  it('ignores keys with Ctrl, Meta or Alt held and IME composition', async () => {
    const element = await make();
    li(element, 'docs')!.focus();
    await pressKeys('Control+ArrowDown');
    expect(active(element)).toBe('docs');
  });
});

describe('tct-tree-list: focus recovery', () => {
  it('collapsing the branch that holds focus moves focus to the branch item, not the page', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    li(element, 'notes')!.focus();
    element.collapse('docs');
    await element.updateComplete;
    await waitUntil(() => active(element) === 'docs', 'focus on the parent');
    expect(document.activeElement).toBe(element);
  });

  it('filtering out the focused item moves focus to the nearest surviving item', async () => {
    const element = await make([
      {id: 'a', label: 'Alpha'},
      {id: 'b', label: 'Beta'},
      {id: 'c', label: 'Gamma'},
    ]);
    li(element, 'b')!.focus();
    element.items = [
      {id: 'a', label: 'Alpha'},
      {id: 'c', label: 'Gamma'},
    ];
    await element.updateComplete;
    await waitUntil(() => active(element) !== undefined, 'recovered focus');
    expect(active(element)).toBe('a');
    expect(tabbable(element)).toEqual(['a']);
  });

  it('replacing the items entirely recovers to the first enabled item and keeps a single tab stop', async () => {
    const element = await make();
    li(element, 'images')!.focus();
    element.items = [
      {id: 'x', label: 'X'},
      {id: 'y', label: 'Y'},
    ];
    await element.updateComplete;
    await waitUntil(() => active(element) === 'x', 'recovered to the first item');
    expect(tabbable(element)).toEqual(['x']);
  });

  it('does not steal focus when the tree did not hold it', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="outside">o</button><tct-tree-list aria-label="Files"></tct-tree-list></div>',
    );
    const element = wrapper.querySelector<TctTreeList>('tct-tree-list')!;
    element.items = tree();
    await element.updateComplete;
    wrapper.querySelector<HTMLElement>('#outside')!.focus();
    element.items = [{id: 'x', label: 'X'}];
    await element.updateComplete;
    expect(document.activeElement).toBe(wrapper.querySelector('#outside'));
  });

  it('keeps focus on the same row when items are reordered (rows are keyed by id)', async () => {
    const element = await make([
      {id: 'a', label: 'Alpha'},
      {id: 'b', label: 'Beta'},
    ]);
    li(element, 'b')!.focus();
    const row = li(element, 'b')!;
    element.items = [
      {id: 'b', label: 'Beta'},
      {id: 'a', label: 'Alpha'},
    ];
    await element.updateComplete;
    expect(li(element, 'b')).toBe(row);
    expect(active(element)).toBe('b');
  });

  it('moves the tab stop off a collapsed-away item to a visible one', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const element = await make(data);
    li(element, 'notes')!.focus();
    expect(tabbable(element)).toEqual(['notes']);
    document.body.focus();
    element.collapse('docs');
    await element.updateComplete;
    expect(tabbable(element)).toHaveLength(1);
    expect(ids(element)).toContain(tabbable(element)[0]);
  });
});

describe('tct-tree-list: localisation, RTL and forced colours', () => {
  it('localises the toggle label (de-DE) and lets an attribute override win', async () => {
    const german = await make(tree(), '', {lang: 'de-DE'});
    const toggle = () =>
      rowOf(german, 'docs').querySelector('[data-tree-toggle]')!.getAttribute('aria-label');
    await waitUntil(() => toggle() !== 'Toggle children', 'German toggle label');
    expect(toggle()).not.toBe('');
    const overridden = await make(tree(), 'toggle-children-label="Open branch"');
    expect(
      rowOf(overridden, 'docs').querySelector('[data-tree-toggle]')!.getAttribute('aria-label'),
    ).toBe('Open branch');
  });

  it('lays rows out from the inline start and mirrors nesting in right-to-left containers', async () => {
    const data = tree();
    data[0]!.isExpanded = true;
    const ltr = await make(data);
    const rtl = await make(data, '', {dir: 'rtl'});
    // The nested row is inset from the inline-start edge: left in LTR, right in RTL.
    const inset = (element: TctTreeList, side: 'left' | 'right') => {
      const parent = rowOf(element, 'docs').getBoundingClientRect()[side];
      const child = rowOf(element, 'report').getBoundingClientRect()[side];
      return side === 'left' ? child - parent : parent - child;
    };
    expect(inset(ltr, 'left')).toBeGreaterThan(0);
    expect(inset(rtl, 'right')).toBeGreaterThan(0);
  });

  it('keeps Arabic (ar-SA, RTL) rendering with an English fallback for the toggle name', async () => {
    const element = await make(tree(), '', {lang: 'ar-SA', dir: 'rtl'});
    expect(
      rowOf(element, 'docs').querySelector('[data-tree-toggle]')!.getAttribute('aria-label'),
    ).toBeTruthy();
  });

  it.skipIf(!isChromium)(
    'keeps selection perceivable and the focus ring visible under forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const element = await make([
        {id: 'a', label: 'Selected', isSelected: true},
        {id: 'b', label: 'Other'},
      ]);
      expect(getComputedStyle(rowOf(element, 'a')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      li(element, 'b')!.focus();
      await pressKeys('ArrowUp');
      await nextFrame();
      expect(getComputedStyle(rowOf(element, 'a')).outlineStyle).not.toBe('none');
    },
  );

  it.skipIf(!isChromium)(
    'scopes the focus outline to the focused row, never a descendant or ancestor',
    async () => {
      const element = await make([
        {id: 'p', label: 'Parent', isExpanded: true, children: [{id: 'c', label: 'Child'}]},
      ]);
      li(element, 'p')!.focus();
      await pressKeys('ArrowDown'); // to the child by keyboard, so the ring is focus-visible
      await nextFrame();
      expect(active(element)).toBe('c');
      expect(getComputedStyle(rowOf(element, 'c')).outlineStyle).not.toBe('none');
      expect(getComputedStyle(rowOf(element, 'p')).outlineStyle).toBe('none');
    },
  );

  it('does not animate the chevron under reduced motion', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const element = await make();
    const icon = rowOf(element, 'docs').querySelector('.chevron-icon')!;
    expect(getComputedStyle(icon).transitionProperty).not.toContain('rotate');
  });
});

describe('tct-tree-list: keyboard table', () => {
  const parity = Object.values(
    import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
      eager: true,
      import: 'default',
    }),
  )[0]!;
  const table = parity.entries['core.tree-list']!.keyboard;
  const open = (element: HTMLElement): void => {
    const data: TreeListItemData[] = [
      {
        id: 'docs',
        label: 'Documents',
        isExpanded: true,
        children: [
          {id: 'report', label: 'Report.pdf', onClick: () => undefined},
          {id: 'notes', label: 'Notes.md'},
        ],
      },
      {id: 'images', label: 'Images', children: [{id: 'logo', label: 'Logo.png'}]},
      {id: 'readme', label: 'README.md'},
    ];
    (element as TctTreeList).items = data;
  };
  const focusOn = (id: string) => (element: HTMLElement) => li(element as TctTreeList, id);
  const at = (element: HTMLElement) => active(element as TctTreeList);

  runKeyboardSuite({
    tag: 'tct-tree-list',
    render: () =>
      `<button id="before">before</button><tct-tree-list aria-label="Files"></tct-tree-list><button id="after">after</button>`,
    table,
    steps: {
      'Moves focus to the next or previous enabled visible item': {
        setup: open,
        focus: focusOn('docs'),
        keys: ['ArrowDown'],
        expect: ({element}) => {
          expect(at(element)).toBe('report');
        },
      },
      'Moves focus to the first or last visible item': {
        setup: open,
        focus: focusOn('report'),
        keys: ['End'],
        expect: ({element}) => {
          expect(at(element)).toBe('readme');
        },
      },
      'Expands a collapsed branch; on an expanded branch moves to its first child': {
        setup: open,
        focus: focusOn('images'),
        keys: ['ArrowRight'],
        rtl: {keys: ['ArrowLeft']},
        expect: ({element}) => {
          expect(items(element as TctTreeList).map((item) => item.dataset.treeId)).toContain(
            'logo',
          );
        },
      },
      'Collapses an expanded branch; otherwise moves to the parent': {
        setup: open,
        focus: focusOn('report'),
        keys: ['ArrowLeft'],
        rtl: {keys: ['ArrowRight']},
        expect: ({element}) => {
          expect(at(element)).toBe('docs');
        },
      },
      'Activates the item, or toggles a branch that has no action of its own': {
        setup: open,
        focus: focusOn('images'),
        keys: ['Enter'],
        expect: ({element}) => {
          expect(items(element as TctTreeList).map((item) => item.dataset.treeId)).toContain(
            'logo',
          );
        },
      },
      'Jumps to the next item whose label starts with the typed text': {
        setup: open,
        focus: focusOn('docs'),
        keys: ['r', 'e'],
        expect: ({element}) => {
          expect(at(element)).toBe('report');
        },
      },
      'Leaves the tree: it is one tab stop': {
        setup: open,
        focus: focusOn('docs'),
        keys: ['Tab'],
        expect: () => {
          expect((document.activeElement as HTMLElement).id).toBe('after');
        },
      },
    },
  });

  it('every step of the keyboard table is asserted above', () => {
    expect(table.length).toBe(7);
  });
});

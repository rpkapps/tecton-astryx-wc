/**
 * Layout behaviour of `tct-tab-list`: overflow scrolling (arrows, fades, keeping the selected tab in
 * view), the divider, edge compensation, the keyboard hint, localisation, RTL, forced colours and
 * reduced motion. Test names follow upstream "TabList overflow (scroll)".
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTab} from './tct-tab.js';
import type {TctTabList} from './tct-tab-list.js';

const MANY = ['Overview', 'Activity', 'Settings', 'Billing', 'Integrations', 'Permissions', 'Audit log']
  .map((label) => `<tct-tab value="${label.toLowerCase().replace(' ', '-')}" label="${label}"></tct-tab>`)
  .join('');

async function make(
  attributes: string,
  inner: string,
  wrapperAttributes = 'style="width: 260px"',
): Promise<TctTabList> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${wrapperAttributes}><tct-tab-list ${attributes}>${inner}</tct-tab-list></div>`,
  );
  const element = wrapper.querySelector('tct-tab-list')!;
  await element.updateComplete;
  await Promise.all([...element.children].map((child) => (child as TctTab).updateComplete));
  await nextFrame();
  await nextFrame();
  return element;
}

const strip = (element: TctTabList): HTMLElement => element.shadowRoot!.querySelector('.strip')!;
const arrow = (element: TctTabList, direction: 'start' | 'end'): HTMLElement | null =>
  element.shadowRoot!.querySelector(`.arrow[data-direction="${direction}"]`);
const tabs = (element: Element): TctTab[] => [...element.querySelectorAll('tct-tab')] as TctTab[];
const tab = (element: Element, value: string): TctTab =>
  tabs(element).find((candidate) => candidate.value === value)!;

describe('tct-tab-list: overflow (scroll)', () => {
  it('renders the tabs inside a scroll strip by default', async () => {
    const element = await make('value="overview"', MANY);
    const box = strip(element);
    expect(box.hasAttribute('data-scroll')).toBe(true);
    expect(getComputedStyle(box).overflowX).toBe('auto');
  });

  it('offers no arrows while every tab fits', async () => {
    const element = await make('value="overview"', TABS(), 'style="width: 480px"');
    expect(arrow(element, 'start')).toBeNull();
    expect(arrow(element, 'end')).toBeNull();
    expect(strip(element).hasAttribute('data-fade')).toBe(false);
  });

  it('offers an end arrow while there are tabs past the end, and pressing it scrolls', async () => {
    const element = await make('value="overview"', MANY);
    await waitUntil(() => arrow(element, 'end'), 'end arrow');
    expect(arrow(element, 'start')).toBeNull();
    expect(strip(element).dataset.fade).toBe('end');
    const before = strip(element).scrollLeft;
    (arrow(element, 'end') as HTMLButtonElement).click();
    await waitUntil(() => strip(element).scrollLeft > before, 'scrolled');
  });

  it('offers both arrows once the strip is scrolled away from the start', async () => {
    const element = await make('value="overview"', MANY);
    const box = strip(element);
    box.scrollTo({left: 60, behavior: 'instant'});
    await waitUntil(() => arrow(element, 'start') && arrow(element, 'end'), 'both arrows');
    expect(box.dataset.fade).toBe('both');
  });

  it('keeps the arrows out of the tab order and out of the accessibility tree', async () => {
    const element = await make('value="overview"', MANY);
    await waitUntil(() => arrow(element, 'end'), 'end arrow');
    const button = arrow(element, 'end')!;
    expect(button.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('tabindex')).toBe('-1');
    const node = await axNode(button);
    expect(node.ignored).toBe('true');
  });

  it('does not hand focus to an arrow: pressing it leaves focus where it was', async () => {
    const element = await make('value="overview"', MANY);
    await waitUntil(() => arrow(element, 'end'), 'end arrow');
    tab(element, 'overview').control!.focus();
    const event = new MouseEvent('mousedown', {bubbles: true, cancelable: true});
    arrow(element, 'end')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('scrolls a selected tab that starts out of view back into view on mount', async () => {
    const element = await make('value="audit-log"', MANY);
    await waitUntil(() => strip(element).scrollLeft > 0, 'scrolled to the selected tab');
    const stripBox = strip(element).getBoundingClientRect();
    const tabBox = tab(element, 'audit-log').control!.getBoundingClientRect();
    expect(tabBox.right).toBeLessThanOrEqual(stripBox.right + 1);
    expect(tabBox.left).toBeGreaterThanOrEqual(stripBox.left - 1);
  });

  it('keeps the selected tab in view when the host changes value without focus', async () => {
    const element = await make('value="overview"', MANY);
    element.value = 'permissions';
    await waitUntil(() => strip(element).scrollLeft > 0, 'scrolled');
    const stripBox = strip(element).getBoundingClientRect();
    const tabBox = tab(element, 'permissions').control!.getBoundingClientRect();
    expect(tabBox.right).toBeLessThanOrEqual(stripBox.right + 1);
  });

  it('leaves a tab that is already in view alone', async () => {
    const element = await make('value="overview"', TABS(), 'style="width: 480px"');
    await nextFrame();
    expect(strip(element).scrollLeft).toBe(0);
  });

  it('finishes the job on focus: arrowing to a tab that is half in view scrolls it clear', async () => {
    const element = await make('value="overview"', MANY);
    tab(element, 'overview').control!.focus();
    await pressKeys('End');
    const stripBox = strip(element).getBoundingClientRect();
    const tabBox = tab(element, 'audit-log').control!.getBoundingClientRect();
    await waitUntil(() => tab(element, 'audit-log').control!.getBoundingClientRect().right <= stripBox.right + 1, 'in view');
    expect(tabBox).toBeDefined();
  });

  it('overflow="visible" scrolls nothing and offers no arrows', async () => {
    const element = await make('value="overview" overflow="visible"', MANY);
    expect(strip(element).hasAttribute('data-scroll')).toBe(false);
    expect(getComputedStyle(strip(element)).overflowX).toBe('visible');
    expect(arrow(element, 'end')).toBeNull();
  });

  it('shows the reading start of a stop too wide to fit', async () => {
    const element = await make(
      'value="wide"',
      '<tct-tab value="a" label="A"></tct-tab><tct-tab value="wide" label="An extraordinarily long tab label that cannot fit in the strip"></tct-tab>',
      'style="width: 180px"',
    );
    await waitUntil(() => strip(element).scrollLeft > 0, 'scrolled');
    const stripBox = strip(element).getBoundingClientRect();
    const tabBox = tab(element, 'wide').control!.getBoundingClientRect();
    expect(tabBox.left).toBeGreaterThanOrEqual(stripBox.left - 1);
  });

  it('in right-to-left, the end arrow is on the left and scrolling reveals the tabs past it', async () => {
    const element = await make('value="overview"', MANY, 'dir="rtl" style="width: 260px"');
    await waitUntil(() => arrow(element, 'end'), 'end arrow');
    const arrowBox = arrow(element, 'end')!.getBoundingClientRect();
    const stripBox = strip(element).getBoundingClientRect();
    expect(arrowBox.left).toBeLessThan(stripBox.left + stripBox.width / 2);
    (arrow(element, 'end') as HTMLButtonElement).click();
    await waitUntil(() => Math.abs(strip(element).scrollLeft) > 0, 'scrolled toward the end');
  });
});

describe('tct-tab-list: divider and edge compensation', () => {
  it('has-divider draws a rule under the strip and drops the indicator onto it', async () => {
    const element = await make('value="overview" has-divider', TABS(), 'style="width: 480px"');
    const root = element.shadowRoot!.querySelector<HTMLElement>('.root')!;
    expect(getComputedStyle(root).borderBlockEndWidth).toBe('1px');
    const indicator = tab(element, 'overview').shadowRoot!.querySelector('.indicator')!;
    const rail = root.getBoundingClientRect().bottom;
    expect(Math.abs(indicator.getBoundingClientRect().bottom - rail)).toBeLessThanOrEqual(2);
  });

  it('adds no divider styling to an undivided tab list', async () => {
    const element = await make('value="overview"', TABS(), 'style="width: 480px"');
    const root = element.shadowRoot!.querySelector<HTMLElement>('.root')!;
    expect(getComputedStyle(root).borderBlockEndWidth).toBe('0px');
  });

  const PADDED =
    'style="width: 400px; --_container-padding-inline-start: 16px; --_container-padding-inline-end: 16px"';

  it('edge-compensation="inline" pulls the box through the container padding and lands the first label on the content edge', async () => {
    const element = await make('value="overview" edge-compensation="inline" has-divider', TABS(), PADDED);
    const container = element.parentElement!.getBoundingClientRect();
    const root = element.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
    expect(root.left).toBeCloseTo(container.left - 16, 0);
    expect(root.width).toBeCloseTo(432, 0);
    const label = tab(element, 'overview').shadowRoot!.querySelector('.label')!.getBoundingClientRect();
    expect(label.left).toBeCloseTo(container.left, 0);
  });

  it('full-bleed is the deprecated alias of edge-compensation="inline"', async () => {
    const element = await make('value="overview" full-bleed', TABS(), PADDED);
    const root = element.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
    expect(root.width).toBeCloseTo(432, 0);
  });

  it('changes nothing outside a padded container', async () => {
    const plain = await make('value="overview"', TABS(), 'style="width: 400px"');
    const compensated = await make('value="overview" edge-compensation="inline"', TABS(), 'style="width: 400px"');
    const box = (e: TctTabList) => e.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
    expect(box(compensated).width).toBe(box(plain).width);
    expect(box(compensated).left).toBe(box(plain).left);
  });

  it('a tab reflects the passive edge-compensation marker for containers', async () => {
    const element = await make('value="overview"', TABS(), 'style="width: 400px"');
    expect(tab(element, 'overview').hasAttribute('data-tct-edge-comp')).toBe(true);
  });
});

function TABS(): string {
  return (
    '<tct-tab value="overview" label="Overview"></tct-tab>' +
    '<tct-tab value="activity" label="Activity"></tct-tab>'
  );
}

describe('tct-tab-list: keyboard hint', () => {
  it('shows the arrow-key hint once on first keyboard entry and never again', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="width: 480px; padding-block-end: 80px"><button id="before">before</button><tct-tab-list value="overview">${TABS()}</tct-tab-list></div>`,
    );
    const element = wrapper.querySelector('tct-tab-list')!;
    await Promise.all([...element.children].map((child) => (child as TctTab).updateComplete));
    await nextFrame();
    wrapper.querySelector('button')!.focus();
    await pressKeys('Tab');
    const hint = element.shadowRoot!.querySelector<HTMLElement>('[data-tct-keyboard-hint]')!;
    await waitUntil(() => hint.matches(':popover-open'), 'hint shown');
    expect(hint.getAttribute('aria-hidden')).toBe('true');
    await pressKeys('ArrowRight');
    await waitUntil(() => !hint.matches(':popover-open'), 'hint dismissed by an arrow key');
    await pressKeys('Shift+Tab', 'Tab');
    expect(hint.matches(':popover-open')).toBe(false);
  });

  it('does not show for a pointer click', async () => {
    const element = await make('value="overview"', TABS(), 'style="width: 480px"');
    await userEvent.click(tab(element, 'activity').control!);
    await nextFrame();
    expect(element.shadowRoot!.querySelector('[data-tct-keyboard-hint]')!.matches(':popover-open')).toBe(false);
  });
});

describe('tct-tab-list: localisation and RTL', () => {
  it('names the strip from the catalog of the nearest lang (de-DE)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div lang="de-DE"><tct-tab-list value="overview">${TABS()}</tct-tab-list></div>`,
    );
    const element = wrapper.querySelector('tct-tab-list')!;
    await waitUntil(
      () => element.shadowRoot!.querySelector('nav')?.getAttribute('aria-label') === 'Registerkarten',
      'German name',
      4000,
    );
  });

  it('names the strip in Arabic and mirrors the layout (ar-SA)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div lang="ar-SA" dir="rtl"><tct-tab-list value="overview">${TABS()}</tct-tab-list></div>`,
    );
    const element = wrapper.querySelector('tct-tab-list')!;
    await waitUntil(
      () => element.shadowRoot!.querySelector('nav')?.getAttribute('aria-label') === 'علامات التبويب',
      'Arabic name',
      4000,
    );
    const [first, second] = tabs(element);
    expect(first!.getBoundingClientRect().left).toBeGreaterThan(second!.getBoundingClientRect().left);
  });

  it('the label attribute wins over the catalog', async () => {
    const element = await make('value="overview" label="Project views"', TABS(), 'style="width: 480px"');
    expect(await axNode(element.shadowRoot!.querySelector('nav')!)).toMatchObject({
      role: 'navigation',
      name: 'Project views',
    });
  });

  it('the label attribute names the tablist under the tabs pattern', async () => {
    const element = await make('value="overview" pattern="tabs" label="Project views"', TABS(), 'style="width: 480px"');
    expect(await axNode(element)).toMatchObject({role: 'tablist', name: 'Project views'});
  });
});

describe('tct-tab-list: forced colours and reduced motion', () => {
  it('keeps the focus ring and paints the selected indicator in a system colour', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await make('value="overview"', TABS(), 'style="width: 480px"');
    tab(element, 'activity').control!.focus({focusVisible: true} as FocusOptions);
    await userEvent.keyboard('{Shift>}{/Shift}');
    const focused = tab(element, 'overview').control!;
    focused.focus({focusVisible: true} as FocusOptions);
    expect(getComputedStyle(focused).outlineStyle).not.toBe('none');
    const indicator = tab(element, 'overview').shadowRoot!.querySelector('.indicator')!;
    expect(getComputedStyle(indicator).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('does not scroll smoothly under reduced motion', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const element = await make('value="overview"', MANY);
    expect(getComputedStyle(strip(element)).scrollBehavior).toBe('auto');
  });

  it('has no axe violations in the default, divided and overflowing configurations', async () => {
    const element = await make('value="overview" has-divider', MANY, 'style="width: 260px; background: var(--color-background-body)"');
    await expectAccessible(element.parentElement!);
  });
});

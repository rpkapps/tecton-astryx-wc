/**
 * `tct-button-group` with the real `tct-button`, `tct-icon-button` and `tct-toggle-button`: corner
 * squaring by position, size and disabled cascade, roving focus through the wrapper buttons, and the
 * split-button pattern. The group's own contract is tested in `tct-button-group.test.ts`.
 */
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import '../button/define.js';
import '../icon-button/define.js';
import '../toggle-button/define.js';
import './define.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctButtonGroup} from './tct-button-group.js';

const inner = (button: Element): HTMLElement =>
  (button as TctButton).shadowRoot!.querySelector<HTMLElement>('.button')!;

async function group(markup: string, attributes = 'label="Actions"'): Promise<TctButtonGroup> {
  const wrapper = await fixture<HTMLElement>(
    `<div><button id="before">before</button><tct-button-group ${attributes}>${markup}</tct-button-group><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector<TctButtonGroup>('tct-button-group')!;
  await element.updateComplete;
  await nextFrame();
  await nextFrame();
  for (const child of element.children) await (child as TctButton).updateComplete;
  return element;
}

describe('tct-button-group with tct-button', () => {
  it('squares the interior corners by position, and mirrors them in right-to-left', async () => {
    const element = await group(
      '<tct-button label="A"></tct-button><tct-button label="B"></tct-button><tct-button label="C"></tct-button>',
    );
    const [a, b, c] = [...element.children].map((child) => getComputedStyle(inner(child)));
    expect(a!.borderStartStartRadius).not.toBe('0px');
    expect(a!.borderStartEndRadius).toBe('0px');
    expect(b!.borderStartStartRadius).toBe('0px');
    expect(b!.borderStartEndRadius).toBe('0px');
    expect(c!.borderStartStartRadius).toBe('0px');
    expect(c!.borderStartEndRadius).not.toBe('0px');
    element.dir = 'rtl';
    await nextFrame();
    // Logical radii: the outer edge stays the first and last item's, whichever way the text runs.
    expect(getComputedStyle(inner(element.children[0]!)).borderStartStartRadius).not.toBe('0px');
  });

  it('hands out the position data to every member kind', async () => {
    const element = await group(
      '<tct-button label="Save"></tct-button><tct-icon-button label="More" icon="chevronDown"></tct-icon-button><tct-toggle-button label="Pin"></tct-toggle-button>',
    );
    const [button, iconButton, toggle] = [...element.children];
    expect(inner(button!).dataset.position).toBe('first');
    expect(inner(iconButton!).dataset.position).toBe('middle');
    const toggleInner = (toggle as HTMLElement)
      .shadowRoot!.querySelector<TctButton>('tct-button')!
      .shadowRoot!.querySelector<HTMLElement>('.button')!;
    expect(toggleInner.dataset.position).toBe('last');
  });

  it('recomputes positions when a member is hidden or added', async () => {
    const element = await group(
      '<tct-button label="A"></tct-button><tct-button label="B"></tct-button><tct-button label="C"></tct-button>',
    );
    const [a, b, c] = [...element.children] as TctButton[];
    b!.hidden = true;
    await nextFrame();
    await nextFrame();
    await c!.updateComplete;
    expect(inner(c!).dataset.position).toBe('last');
    expect(inner(a!).dataset.position).toBe('first');
    b!.hidden = false;
    await nextFrame();
    await nextFrame();
    expect(inner(b!).dataset.position).toBe('middle');
  });

  it('cascades size and disabled to the buttons, and the members ignore their own elevation', async () => {
    const element = await group(
      '<tct-button label="A" elevation="high"></tct-button><tct-button label="B"></tct-button>',
      'label="Actions" size="sm" disabled',
    );
    for (const child of element.children) {
      expect(inner(child).dataset.size).toBe('sm');
      expect(inner(child).hasAttribute('disabled')).toBe(true);
      expect(inner(child).dataset.elevation).toBe('none');
    }
  });

  it('is one Tab stop with arrow-key roving across the buttons', async () => {
    const element = await group(
      '<tct-button label="A"></tct-button><tct-button label="B"></tct-button><tct-button label="C"></tct-button>',
    );
    element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(inner(element.children[0]!));
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(inner(element.children[1]!));
    await pressKeys('End');
    expect(deepActiveElement()).toBe(inner(element.children[2]!));
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
  });

  it('builds a split button: a labelled group of a button and an icon button', async () => {
    const element = await group(
      '<tct-button label="Save" variant="primary"></tct-button><tct-icon-button label="More save options" icon="chevronDown" variant="primary"></tct-icon-button>',
      'label="Save options"',
    );
    expect(await axNode(element)).toMatchObject({role: 'group', name: 'Save options'});
    expect(await axNode(inner(element.children[1]!))).toMatchObject({
      role: 'button',
      name: 'More save options',
    });
    await expectAccessible(element);
  });
});

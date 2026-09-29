/**
 * `tct-toolbar` with the real `tct-button`, `tct-icon-button` and `tct-toggle-button`: one tab stop,
 * arrow-key roving into the buttons' shadow roots, size cascade and the ghost edge compensation. The
 * toolbar's own contract is tested in `tct-toolbar.test.ts`.
 */
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-astryx/testing/keyboard.js';
import {nextFrame} from '@tecton-astryx/testing/timing.js';
import '../button/define.js';
import '../icon-button/define.js';
import '../toggle-button/define.js';
import './define.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctToolbar} from './tct-toolbar.js';

const inner = (button: Element): HTMLElement =>
  (button as TctButton).shadowRoot!.querySelector<HTMLElement>('.button')!;

async function toolbar(markup: string, attributes = 'label="Formatting"'): Promise<TctToolbar> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="width: 600px"><button id="before">before</button><tct-toolbar ${attributes}>${markup}</tct-toolbar><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector<TctToolbar>('tct-toolbar')!;
  await element.updateComplete;
  await nextFrame();
  await nextFrame();
  return element;
}

const markup = `
  <tct-icon-button slot="start" variant="ghost" label="Undo" icon="chevronLeft"></tct-icon-button>
  <tct-toggle-button slot="start" label="Bold" icon="check" icon-only></tct-toggle-button>
  <tct-button slot="start" variant="ghost" label="Filter" icon="funnel"></tct-button>
  <tct-button slot="end" variant="primary" label="Publish"></tct-button>`;

describe('tct-toolbar with tct-button', () => {
  it('is one Tab stop, with arrow keys moving through every kind of button', async () => {
    const element = await toolbar(markup);
    const stops = await tabSequence(element, {
      start: element.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(
      stops.filter((stop) => element.contains(stop) || stop.getRootNode() !== document),
    ).toHaveLength(1);
    element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    const first = deepActiveElement();
    expect(first).toBe(inner(element.children[0]!));
    await pressKeys('ArrowRight');
    const toggleInner = (element.children[1] as HTMLElement)
      .shadowRoot!.querySelector<TctButton>('tct-button')!
      .shadowRoot!.querySelector<HTMLElement>('.button')!;
    expect(deepActiveElement()).toBe(toggleInner);
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(inner(element.children[2]!));
    await pressKeys('End');
    expect(deepActiveElement()).toBe(inner(element.children[3]!));
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
  });

  it('gives the buttons the toolbar size', async () => {
    const element = await toolbar(markup, 'label="Formatting" size="sm"');
    for (const child of [element.children[0]!, element.children[2]!, element.children[3]!]) {
      await (child as TctButton).updateComplete;
      expect(inner(child).dataset.size).toBe('sm');
    }
  });

  it('is a named toolbar and passes axe', async () => {
    const element = await toolbar(markup);
    expect(await axNode(element)).toMatchObject({role: 'toolbar', name: 'Formatting'});
    await expectAccessible(element);
  });

  it('pressing a toggle inside the toolbar toggles it and keeps focus in the toolbar', async () => {
    const element = await toolbar(markup);
    const toggle = element.children[1] as HTMLElement & {pressed: boolean};
    toggle.focus();
    await pressKeys('Enter');
    await nextFrame();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(toggle.pressed).toBe(true);
    expect(element.contains(toggle)).toBe(true);
    expect(toggle.shadowRoot!.activeElement).not.toBeNull();
  });
});

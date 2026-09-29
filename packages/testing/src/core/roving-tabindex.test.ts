/**
 * `RovingTabindexController` (A§9.11): a composite is one tab stop; arrows, Home/End, paging, wrap,
 * disabled skipping, RTL mirroring, typeahead, activate-on-focus, wrapper items and IME safety.
 */
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {fixture} from '../fixture.js';
import {type TctTestChip, TctTestToolbar} from '../fixtures/test-toolbar.js';
import {deepActiveElement, pressKeys, tabSequence} from '../keyboard.js';
import {nextFrame} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestToolbar);
});

const labels = (elements: readonly Element[]): string[] =>
  elements.map((element) => element.textContent.trim());
/** Text of the focused item; for a control inside a wrapper's shadow root, the wrapper's text. */
const activeLabel = (): string => {
  const active = deepActiveElement();
  const root = active?.getRootNode();
  const owner = root instanceof ShadowRoot ? root.host : active;
  return owner?.textContent.trim() ?? '';
};
const tabindexes = (toolbar: TctTestToolbar): (string | null)[] =>
  [...toolbar.children].map((item) => item.getAttribute('tabindex'));

async function toolbar(
  attributes = '',
  items = '<button>Bold</button><button>Italic</button><button disabled>Underline</button><button>Strike</button>',
  options: {dir?: 'rtl'} = {},
): Promise<TctTestToolbar> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${options.dir ? `dir="${options.dir}"` : ''}><button id="before">before</button>` +
      `<tct-test-toolbar ${attributes}>${items}</tct-test-toolbar><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-test-toolbar')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

describe('one tab stop', () => {
  it('only the first enabled item carries tabindex 0', async () => {
    const bar = await toolbar();
    expect(tabindexes(bar)).toEqual(['0', '-1', '-1', '-1']);
    expect(bar.roving.active).toBe(bar.children[0]);
  });

  it('Tab enters the composite once and leaves it on the next Tab', async () => {
    const bar = await toolbar();
    const wrapper = bar.parentElement!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(activeLabel()).toBe('Bold');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
    await pressKeys('Shift+Tab');
    expect(activeLabel()).toBe('Bold');
  });

  it('Tab re-enters at the last used item, not the first', async () => {
    const bar = await toolbar();
    (bar.children[0] as HTMLElement).focus();
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Italic');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
    await pressKeys('Shift+Tab');
    expect(activeLabel()).toBe('Italic');
    expect(tabindexes(bar)).toEqual(['-1', '0', '-1', '-1']);
  });

  it('tabSequence visits exactly one stop inside', async () => {
    const bar = await toolbar();
    const stops = await tabSequence(bar, {
      start: bar.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(labels(stops.slice(0, 1))).toEqual(['Bold']);
    expect(stops[1]).toBe(bar.parentElement!.querySelector('#after'));
  });

  it('a click or script focus on another item makes it the tab stop', async () => {
    const bar = await toolbar();
    await userEvent.click(bar.children[3]!);
    expect(tabindexes(bar)).toEqual(['-1', '-1', '-1', '0']);
    expect(bar.roving.active).toBe(bar.children[3]);
    (bar.children[1] as HTMLElement).focus();
    expect(tabindexes(bar)).toEqual(['-1', '0', '-1', '-1']);
  });
});

describe('arrow keys', () => {
  it('ArrowRight/ArrowLeft move focus, skipping disabled items, and wrap', async () => {
    const bar = await toolbar();
    (bar.children[0] as HTMLElement).focus();
    const seen: string[] = [];
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
      await pressKeys(key);
      seen.push(activeLabel());
    }
    expect(seen).toEqual(['Italic', 'Strike', 'Bold', 'Italic']);
    await pressKeys('ArrowLeft');
    expect(activeLabel()).toBe('Bold');
    await pressKeys('ArrowLeft');
    expect(activeLabel()).toBe('Strike');
    expect(tabindexes(bar)).toEqual(['-1', '-1', '-1', '0']);
  });

  it('no-wrap stops at the ends', async () => {
    const bar = await toolbar('no-wrap');
    (bar.children[0] as HTMLElement).focus();
    await pressKeys('ArrowLeft');
    expect(activeLabel()).toBe('Bold');
    await pressKeys('End');
    expect(activeLabel()).toBe('Strike');
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Strike');
  });

  it('Home and End go to the first and last enabled item', async () => {
    const bar = await toolbar();
    (bar.children[1] as HTMLElement).focus();
    await pressKeys('End');
    expect(activeLabel()).toBe('Strike');
    await pressKeys('Home');
    expect(activeLabel()).toBe('Bold');
  });

  it('vertical orientation answers Up/Down only; both answers all four', async () => {
    const vertical = await toolbar('orientation="vertical"');
    (vertical.children[0] as HTMLElement).focus();
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Bold');
    await pressKeys('ArrowDown');
    expect(activeLabel()).toBe('Italic');
    await pressKeys('ArrowUp');
    expect(activeLabel()).toBe('Bold');

    const both = await toolbar('orientation="both"');
    (both.children[0] as HTMLElement).focus();
    await pressKeys('ArrowDown');
    expect(activeLabel()).toBe('Italic');
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Strike');
  });

  it('mirrors horizontal arrows in RTL', async () => {
    const bar = await toolbar('', undefined, {dir: 'rtl'});
    (bar.children[0] as HTMLElement).focus();
    await pressKeys('ArrowLeft');
    expect(activeLabel()).toBe('Italic');
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Bold');
  });

  it('PageDown/PageUp step by page-size, clamped', async () => {
    const items = Array.from({length: 8}, (_, i) => `<button>Item ${i + 1}</button>`).join('');
    const bar = await toolbar('page-size="3"', items);
    (bar.children[0] as HTMLElement).focus();
    await pressKeys('PageDown');
    expect(activeLabel()).toBe('Item 4');
    await pressKeys('PageDown', 'PageDown');
    expect(activeLabel()).toBe('Item 8');
    await pressKeys('PageUp');
    expect(activeLabel()).toBe('Item 5');
  });

  it('prevents the default scroll of the keys it handles, and leaves others alone', async () => {
    const bar = await toolbar();
    const first = bar.children[0] as HTMLElement;
    first.focus();
    const prevented: Record<string, boolean> = {};
    bar.addEventListener('keydown', (event) => {
      queueMicrotask(() => {
        prevented[event.key] = event.defaultPrevented;
      });
    });
    await pressKeys('ArrowRight', 'Home', 'x');
    await nextFrame();
    expect(prevented).toMatchObject({ArrowRight: true, Home: true});
    expect(prevented.x).toBeFalsy();
  });

  it('ignores chords with Alt/Ctrl/Meta and composing keys (IME)', async () => {
    const bar = await toolbar();
    const first = bar.children[0] as HTMLElement;
    first.focus();
    await pressKeys('Alt+ArrowRight');
    expect(activeLabel()).toBe('Bold');
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      first.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    expect(activeLabel()).toBe('Bold');
  });
});

describe('disabled items', () => {
  it('are skipped, and cannot be the tab stop', async () => {
    const bar = await toolbar('', '<button disabled>Off</button><button>On</button>');
    expect(tabindexes(bar)).toEqual(['-1', '0']);
  });

  it('focus-disabled keeps them reachable (APG menus)', async () => {
    const bar = await toolbar('focus-disabled');
    (bar.children[1] as HTMLElement).focus();
    await pressKeys('ArrowRight');
    // Disabled buttons cannot take DOM focus; the controller still targets it as an item.
    expect(bar.roving.active).toBe(bar.children[2]);
  });

  it('a disabled active item hands the tab stop to the first enabled one on update()', async () => {
    const bar = await toolbar();
    (bar.children[1] as HTMLElement).focus();
    (bar.children[1] as HTMLElement).setAttribute('disabled', '');
    bar.roving.update();
    expect(bar.roving.active).toBe(bar.children[0]);
    expect(tabindexes(bar)).toEqual(['0', '-1', '-1', '-1']);
  });

  it('removing the active item re-picks a tab stop (slotchange)', async () => {
    const bar = await toolbar('', '<button>A</button><button>B</button>');
    (bar.children[0] as HTMLElement).focus();
    bar.children[0]!.remove();
    await nextFrame();
    await nextFrame();
    expect(bar.roving.active).toBe(bar.children[0]);
    expect(tabindexes(bar)).toEqual(['0']);
  });
});

describe('typeahead', () => {
  it('a letter focuses the next item starting with it; repeats cycle', async () => {
    const bar = await toolbar(
      'typeahead',
      '<button>Apple</button><button>Avocado</button><button>Banana</button>',
    );
    (bar.children[0] as HTMLElement).focus();
    await pressKeys('b');
    expect(activeLabel()).toBe('Banana');
    await pressKeys('a');
    // "ba" refines within the buffer: Banana stays.
    expect(activeLabel()).toBe('Banana');
  });

  it('is case and accent insensitive and off unless enabled', async () => {
    const on = await toolbar('typeahead', '<button>Alpha</button><button>Élan</button>');
    (on.children[0] as HTMLElement).focus();
    await pressKeys('e');
    expect(activeLabel()).toBe('Élan');

    const off = await toolbar('', '<button>Alpha</button><button>Beta</button>');
    (off.children[0] as HTMLElement).focus();
    await pressKeys('b');
    expect(activeLabel()).toBe('Alpha');
  });
});

describe('activation', () => {
  it('activate-on-focus reports each item the keyboard lands on', async () => {
    const bar = await toolbar('activate-on-focus');
    (bar.children[0] as HTMLElement).focus();
    await pressKeys('ArrowRight', 'ArrowRight');
    expect(bar.activated).toEqual(['Italic', 'Strike']);
  });

  it('Enter and Space activate non-native items; native buttons keep their own click', async () => {
    const bar = await toolbar('', '<span>One</span><span>Two</span>');
    const first = bar.children[0] as HTMLElement;
    first.focus();
    await pressKeys('Enter', ' ');
    expect(bar.activated).toEqual(['One', 'One']);

    const native = await toolbar();
    (native.children[0] as HTMLElement).focus();
    await pressKeys('Enter');
    expect(native.activated).toEqual([]);
  });
});

describe('wrapper items (tabindex on a shadow host removes its subtree from tab order)', () => {
  const chips =
    '<tct-test-chip>One</tct-test-chip><tct-test-chip>Two</tct-test-chip><tct-test-chip disabled>Three</tct-test-chip><tct-test-chip>Four</tct-test-chip>';

  it('writes tabindex on the inner button and never on the host', async () => {
    const bar = await toolbar('', chips);
    const chipsList = [...bar.children] as TctTestChip[];
    for (const chip of chipsList)
      expect(chip.hasAttribute('tabindex'), chip.textContent).toBe(false);
    expect(chipsList.map((chip) => chip.button!.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
    ]);
  });

  it('is one tab stop and arrows move real focus into the shadow roots', async () => {
    const bar = await toolbar('', chips);
    const wrapper = bar.parentElement!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe((bar.children[0] as TctTestChip).button);
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe((bar.children[1] as TctTestChip).button);
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Four');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
  });
});

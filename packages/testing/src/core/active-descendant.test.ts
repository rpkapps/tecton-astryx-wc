/**
 * `ActiveDescendantController` (A§9.12): DOM focus stays on the input while a highlight moves over
 * light-DOM options in another tree, exposed through ARIA element reflection (Tier 1) or spoken
 * through the announcer (Tier 2, forced here with `withFeature`).
 */
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {features} from '@tecton-wc/core/features.js';
import {axActiveDescendant} from '../a11y.js';
import {fixture} from '../fixture.js';
import {TctTestCombobox} from '../fixtures/test-combobox.js';
import {deepActiveElement, pressKeys} from '../keyboard.js';
import {forceFeatures, isChromium, isTier2} from '../tier.js';
import {nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestCombobox);
});

/** Element reflection off (cross-tree ARIA impossible) and native `ariaNotify` off (live regions used). */
async function withTier2Aria(run: () => Promise<void>): Promise<void> {
  const restore = forceFeatures({elementReflection: false, ariaNotify: false});
  try {
    await run();
  } finally {
    restore();
  }
}

const OPTIONS =
  '<div role="option">Apple</div><div role="option">Banana</div><div role="option" aria-disabled="true">Fig</div><div role="option">Grape</div>';

async function combobox(attributes = '', options = OPTIONS): Promise<TctTestCombobox> {
  const host = await fixture<HTMLDivElement>(
    `<div><tct-test-combobox ${attributes}>${options}</tct-test-combobox></div>`,
  );
  const element = host.querySelector('tct-test-combobox')!;
  await element.updateComplete;
  element.input.focus();
  return element;
}

const highlightedText = (combo: TctTestCombobox): string | undefined =>
  combo.descendants.highlighted?.textContent.trim();

describe('keyboard highlight', () => {
  it('ArrowDown starts at the first option, ArrowUp at the last; focus never leaves the input', async () => {
    const combo = await combobox();
    await pressKeys('ArrowDown');
    expect(highlightedText(combo)).toBe('Apple');
    expect(deepActiveElement()).toBe(combo.input);

    const other = await combobox();
    await pressKeys('ArrowUp');
    expect(highlightedText(other)).toBe('Grape');
    expect(deepActiveElement()).toBe(other.input);
  });

  it('skips disabled options and wraps', async () => {
    const combo = await combobox();
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      await pressKeys('ArrowDown');
      seen.push(highlightedText(combo)!);
    }
    expect(seen).toEqual(['Apple', 'Banana', 'Grape', 'Apple']);
    await pressKeys('ArrowUp');
    expect(highlightedText(combo)).toBe('Grape');
  });

  it('no-wrap stays at the ends', async () => {
    const combo = await combobox('no-wrap');
    await pressKeys('End', 'ArrowDown');
    expect(highlightedText(combo)).toBe('Grape');
    await pressKeys('Home', 'ArrowUp');
    expect(highlightedText(combo)).toBe('Apple');
  });

  it('Home and End jump to the first and last enabled option', async () => {
    const combo = await combobox();
    await pressKeys('End');
    expect(highlightedText(combo)).toBe('Grape');
    await pressKeys('Home');
    expect(highlightedText(combo)).toBe('Apple');
  });

  it('PageDown moves by page-size from the current option (or from the first), clamped', async () => {
    const options = Array.from({length: 9}, (_, i) => `<div role="option">O${i + 1}</div>`).join(
      '',
    );
    const combo = await combobox('page-size="4"', options);
    await pressKeys('Home');
    expect(highlightedText(combo)).toBe('O1');
    await pressKeys('PageDown');
    expect(highlightedText(combo)).toBe('O5');
    await pressKeys('PageDown', 'PageDown');
    expect(highlightedText(combo)).toBe('O9');
    await pressKeys('PageUp');
    expect(highlightedText(combo)).toBe('O5');
  });

  it('consumed keys are prevented; other keys and modified arrows are not consumed', async () => {
    const combo = await combobox();
    const prevented: Record<string, boolean> = {};
    combo.input.addEventListener('keydown', (event) => {
      queueMicrotask(() => {
        prevented[`${event.altKey ? 'Alt+' : ''}${event.key}`] = event.defaultPrevented;
      });
    });
    await pressKeys('ArrowDown', 'a', 'Alt+ArrowDown');
    await nextFrame();
    expect(prevented.ArrowDown).toBe(true);
    expect(prevented.a).toBeFalsy();
    expect(prevented['Alt+ArrowDown']).toBeFalsy();
    expect(highlightedText(combo)).toBe('Apple');
  });

  it('does not react to IME composition keys', async () => {
    const combo = await combobox();
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      combo.input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    expect(combo.descendants.highlighted).toBeNull();
  });

  it('Enter can read the highlighted option (the caller decides what it means)', async () => {
    const combo = await combobox();
    await pressKeys('ArrowDown', 'ArrowDown', 'Enter');
    expect(combo.chosen).toEqual(['Banana']);
  });
});

describe('highlight state', () => {
  it('marks exactly one option with data-highlighted and reports the source', async () => {
    const combo = await combobox();
    await pressKeys('ArrowDown', 'ArrowDown');
    expect(combo.options.map((option) => option.hasAttribute('data-highlighted'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(combo.highlights).toEqual(['Apple@keyboard', 'Banana@keyboard']);
  });

  it('disabled options cannot be highlighted programmatically either', async () => {
    const combo = await combobox();
    combo.descendants.highlight(combo.options[2]!);
    expect(combo.descendants.highlighted).toBeNull();
    expect(combo.highlights).toEqual([]);
  });

  it('highlight(null) clears; an unchanged highlight reports nothing', async () => {
    const combo = await combobox();
    combo.descendants.highlight(combo.options[0]!);
    combo.descendants.highlight(combo.options[0]!);
    expect(combo.highlights).toEqual(['Apple@programmatic']);
    combo.descendants.highlight(null);
    expect(combo.options[0]!.hasAttribute('data-highlighted')).toBe(false);
    expect(combo.highlights).toEqual(['Apple@programmatic', 'none@programmatic']);
  });

  it('a pointer highlight is reported as pointer and never scrolls; a keyboard one scrolls into view', async () => {
    const combo = await combobox();
    const [apple, banana] = combo.options as [HTMLElement, HTMLElement];
    const scrolled: string[] = [];
    for (const option of [apple, banana]) {
      option.scrollIntoView = vi.fn(() => {
        scrolled.push(option.textContent.trim());
      });
    }
    await userEvent.hover(apple);
    await waitUntil(() => combo.descendants.highlighted === apple, 'pointer highlight');
    expect(combo.highlights.at(-1)).toBe('Apple@pointer');
    expect(scrolled).toEqual([]);

    await pressKeys('ArrowDown');
    expect(highlightedText(combo)).toBe('Banana');
    expect(scrolled).toEqual(['Banana']);
  });

  it('drops a highlighted option that was removed by a data change', async () => {
    const combo = await combobox();
    await pressKeys('ArrowDown');
    combo.options[0]!.remove();
    combo.requestUpdate();
    await combo.updateComplete;
    expect(combo.descendants.highlighted).toBeNull();
    if (features.elementReflection) expect(combo.input.ariaActiveDescendantElement).toBeNull();
  });

  it('clears the reference when the host disconnects', async () => {
    const combo = await combobox();
    await pressKeys('ArrowDown');
    const input = combo.input;
    combo.remove();
    expect(combo.descendants.highlighted).toBeNull();
    if (features.elementReflection) expect(input.ariaActiveDescendantElement).toBeNull();
  });
});

describe.skipIf(isTier2)('exposure through element reflection (Tier 1)', () => {
  it('sets ariaActiveDescendantElement across the shadow boundary and clears it', async () => {
    const combo = await combobox();
    await pressKeys('ArrowDown');
    expect(combo.input.ariaActiveDescendantElement).toBe(combo.options[0]);
    combo.descendants.highlight(null);
    expect(combo.input.ariaActiveDescendantElement).toBeNull();
  });

  it.skipIf(!isChromium)(
    'Chromium computes the same active descendant in its accessibility tree',
    async () => {
      const combo = await combobox();
      await pressKeys('ArrowDown', 'ArrowDown');
      const resolved = await axActiveDescendant(combo.input, combo.options);
      expect(resolved).toBe(combo.options[1]);
    },
  );
});

describe('Tier 2 fallback (element reflection forced off)', () => {
  it('cross-tree options are spoken through the announcer instead of referenced', async () => {
    await withTier2Aria(async () => {
      const combo = await combobox();
      await pressKeys('ArrowDown');
      expect(combo.input.hasAttribute('aria-activedescendant')).toBe(false);
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent.includes('Apple') === true,
        'announced the highlighted option',
        1500,
      );
    });
  });

  it('same-tree options get an id reference', async () => {
    await withTier2Aria(async () => {
      const host = await fixture<HTMLDivElement>(
        `<div><tct-test-combobox></tct-test-combobox></div>`,
      );
      const combo = host.querySelector('tct-test-combobox')!;
      await combo.updateComplete;
      // An option placed in the input's own (shadow) tree.
      const option = document.createElement('div');
      option.setAttribute('role', 'option');
      option.textContent = 'Inner';
      combo.renderRoot.querySelector('#list')!.append(option);
      combo.descendants.highlight(option);
      expect(combo.input.getAttribute('aria-activedescendant')).toBe(option.id);
      expect(option.id).not.toBe('');
      combo.descendants.highlight(null);
      expect(combo.input.hasAttribute('aria-activedescendant')).toBe(false);
    });
  });
});

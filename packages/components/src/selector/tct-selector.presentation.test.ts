/**
 * tct-selector presentation: the adaptive bottom sheet on compact touch, the anchored popover (placement,
 * width, flipping, the selected-item overlay) on the CSS path and on the Tier-2 positioning fallback, and
 * localisation (de-DE, ar-SA) with attribute overrides.
 */
import {afterEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {isFloatingLoaded} from '@tecton-wc/core/layer/floating.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {isChromium, withFeature} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {stubCompactTouch} from '../dropdown-menu/menu-test-helpers.js';
import './define.js';
import type {SelectorOptionType} from './selector.types.js';
import type {TctSelector} from './tct-selector.js';
import {
  FRUIT,
  GROUPED,
  activeText,
  closed,
  isShown,
  layerOf,
  listboxOf,
  mountSelect,
  openByClick,
  optionsOf,
  searchOf,
  trigger,
} from './selector-test-helpers.js';

let stub: ReturnType<typeof stubCompactTouch> | undefined;
afterEach(() => {
  stub?.restore();
  stub = undefined;
});

const make = (
  attributes = 'label="Fruit"',
  options: SelectorOptionType[] = FRUIT,
  fixtureOptions: {dir?: 'rtl' | 'ltr'; lang?: string} = {},
) => mountSelect<TctSelector>('tct-selector', attributes, options, fixtureOptions);

/** A real pointer press on the box: the sheet's dialog carries the same label, so the trigger alone is ambiguous by name. */
const press = (el: TctSelector): Promise<void> =>
  userEvent.click(el.shadowRoot!.querySelector<HTMLElement>('.input-wrapper')!);

const sheetOf = (el: TctSelector) =>
  el.shadowRoot!.querySelector<HTMLElement & {open: boolean}>('tct-bottom-sheet');
const surfaceOf = (el: TctSelector): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;

describe('tct-selector: bottom sheet', () => {
  it('opens the options in a modal sheet, and choosing closes it, changes the value and returns focus', async () => {
    const el = await make('label="Fruit" presentation="bottom-sheet"');
    const events = recordEvents(el, [
      'input',
      'change',
      'tct-open-change',
      'tct-after-open-change',
    ]);
    await press(el);
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    expect(trigger(el).getAttribute('aria-haspopup')).toBe('dialog');
    expect(isShown(el)).toBe(false);
    expect(sheetOf(el)!.querySelector('tct-heading')!.textContent.trim()).toBe('Fruit');
    await waitUntil(() => optionsOf(el).length === 4, 'rows');
    await animationsFinished(sheetOf(el)!);
    await userEvent.click(optionsOf(el)[2]!);
    await waitUntil(() => !el.open, 'closed');
    expect(el.value).toBe('Orange');
    await waitUntil(() => deepActiveElement() === trigger(el), 'focus back on the trigger');
    expect(events.named('tct-open-change').map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger'],
      [false, 'selection'],
    ]);
    expect(events.events.filter((e) => e.type === 'input' || e.type === 'change')).toHaveLength(2);
    await waitUntil(() => events.named('tct-after-open-change').length >= 2, 'after events');
  });

  it('names the sheet and its listbox by the label, and the listbox takes focus on a keyboard open', async () => {
    const el = await make('label="Fruit" presentation="bottom-sheet"');
    trigger(el).focus();
    await pressKeys('Enter');
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    await waitUntil(() => deepActiveElement() === listboxOf(el), 'listbox focused');
    const listbox = listboxOf(el)!;
    expect(listbox.getAttribute('aria-label')).toBe('Fruit');
    expect(listbox.getAttribute('tabindex')).toBe('0');
    if (isChromium) expect((await axNode(listbox)).name).toBe('Fruit');
    await waitUntil(() => activeText(listbox) === 'Apple', 'first option highlighted');
    await pressKeys('ArrowDown', 'Enter');
    await waitUntil(() => !el.open, 'closed');
    expect(el.value).toBe('Banana');
  });

  it('a search selector focuses the search field in the sheet and filters', async () => {
    const el = await make('label="Fruit" presentation="bottom-sheet" has-search');
    await press(el);
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    await waitUntil(() => deepActiveElement() === searchOf(el), 'search focused');
    await userEvent.keyboard('an');
    await el.updateComplete;
    expect(optionsOf(el)).toHaveLength(2);
    await pressKeys('ArrowDown', 'Enter');
    await waitUntil(() => !el.open, 'closed');
    expect(el.value).toBe('Banana');
  });

  it('Escape closes it through the intent event; a cancelled intent keeps it open', async () => {
    const el = await make('label="Fruit" presentation="bottom-sheet"');
    const changes = recordEvents(el, 'tct-open-change');
    await press(el);
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    await animationsFinished(sheetOf(el)!);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(changes.events.map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger'],
      [false, 'escape'],
    ]);
    el.addEventListener('tct-open-change', (event) => {
      if (!(event as unknown as {open: boolean}).open) event.preventDefault();
    });
    await press(el);
    await waitUntil(() => el.open, 'reopened');
    await animationsFinished(sheetOf(el)!);
    await pressKeys('Escape');
    await nextFrame();
    expect(el.open).toBe(true);
  });

  it('uses the sheet for adaptive presentation on compact touch, and a popover otherwise; the open state survives the switch', async () => {
    stub = stubCompactTouch(true);
    const el = await make('label="Fruit" presentation="adaptive"');
    await press(el);
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    stub.set(false);
    await waitUntil(() => isShown(el) && sheetOf(el)?.open !== true, 'popover after the switch');
    expect(el.open).toBe(true);
    expect(trigger(el).getAttribute('aria-haspopup')).toBe('listbox');
    stub.set(true);
    await waitUntil(() => sheetOf(el)?.open === true && !isShown(el), 'sheet again');
  });

  it('keeps adaptive anchored without compact touch', async () => {
    stub = stubCompactTouch(false);
    const el = await make('label="Fruit" presentation="adaptive"');
    await openByClick(el);
    expect(sheetOf(el)?.open ?? false).toBe(false);
    expect(isShown(el)).toBe(true);
  });

  it('passes axe with the sheet open', async () => {
    const el = await make('label="Fruit" presentation="bottom-sheet" value="Apple"', GROUPED);
    await press(el);
    await waitUntil(() => sheetOf(el)?.open === true, 'sheet open');
    await waitUntil(() => optionsOf(el).length > 0, 'rows');
    await animationsFinished(sheetOf(el)!);
    await expectAccessible(sheetOf(el)!);
  });
});

describe('tct-selector: the popover', () => {
  it('opens below the trigger, at least as wide as it', async () => {
    const el = await make('label="Fruit" width="300"');
    await openByClick(el);
    const box = el.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(surface.top).toBeGreaterThanOrEqual(box.bottom);
    expect(surface.width).toBeGreaterThanOrEqual(box.width - 1);
    expect(Math.abs(surface.left - box.left)).toBeLessThan(2);
  });

  it('honours placement above and alignment end', async () => {
    const el = await make('label="Fruit" placement="above" alignment="end" width="200"');
    const box0 = el.shadowRoot!.querySelector('.input-wrapper')!;
    await openByClick(el);
    const box = box0.getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    // Above with room to spare (the fixture leaves 40px on top, so the browser may flip it below).
    expect(surface.bottom <= box.top + 1 || surface.top >= box.bottom - 1).toBe(true);
    expect(Math.abs(surface.right - box.right) < 2 || Math.abs(surface.left - box.left) < 2).toBe(
      true,
    );
  });

  it('caps the list height and scrolls it', async () => {
    const many = Array.from({length: 60}, (_, index) => `Option ${index + 1}`);
    const el = await make('label="Fruit"', many);
    await openByClick(el);
    const list = listboxOf(el)!;
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    expect(surfaceOf(el).getBoundingClientRect().height).toBeLessThanOrEqual(345);
  });

  it('draws the popover on the Tier-2 positioning fallback too', async () => {
    await withFeature('implicitAnchor', false, async () => {
      const el = await make('label="Fruit" width="300"');
      await userEvent.click(trigger(el));
      await waitUntil(() => el.open && isShown(el), 'opened');
      await waitUntil(() => isFloatingLoaded(), 'fallback loaded');
      await waitUntil(() => layerOf(el).style.top !== '', 'placed by the fallback');
      const box = el.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
      const surface = surfaceOf(el).getBoundingClientRect();
      expect(surface.top).toBeGreaterThanOrEqual(box.bottom - 1);
      expect(Math.abs(surface.left - box.left)).toBeLessThan(3);
      await pressKeys('ArrowDown', 'Enter');
      await closed(el);
      expect(el.value).toBe('Banana');
    });
  });

  it('placement="overlay" lines the chosen option up with the trigger, inside the viewport', async () => {
    const el = await mountSelect<TctSelector>(
      'tct-selector',
      'label="Fruit" placement="overlay" value="Orange" width="300"',
      FRUIT,
      {},
      '<div style="block-size:220px"></div>',
    );
    const box = el.shadowRoot!.querySelector('.input-wrapper')!;
    await openByClick(el);
    await waitUntil(() => !listboxOf(el)!.hasAttribute('data-overlay'), 'measured');
    await nextFrame();
    const anchor = box.getBoundingClientRect();
    const chosen = optionsOf(el)[2]!.getBoundingClientRect();
    const anchorCenter = anchor.top + anchor.height / 2;
    const chosenCenter = chosen.top + chosen.height / 2;
    expect(Math.abs(anchorCenter - chosenCenter)).toBeLessThan(4);
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(surface.top).toBeGreaterThanOrEqual(0);
    expect(surface.bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it('the anchored popup shows in RTL from the start edge', async () => {
    const el = await make('label="Fruit" width="300"', FRUIT, {dir: 'rtl'});
    await openByClick(el);
    const box = el.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(Math.abs(surface.right - box.right)).toBeLessThan(2);
  });
});

describe('tct-selector: localisation', () => {
  it('reads the placeholder and the search chrome in German from the nearest lang', async () => {
    const el = await make('label="Obst" has-search', FRUIT, {lang: 'de-DE'});
    await waitUntil(
      () =>
        el.shadowRoot!.querySelector('[part~="placeholder"]')!.textContent.trim() === 'Auswählen…',
      'German placeholder',
      4000,
    );
    await openByClick(el);
    const input = searchOf(el)!;
    await waitUntil(
      () => input.getAttribute('aria-label') === 'Suchoptionen',
      'German search label',
      4000,
    );
    expect(input.placeholder).toBe('Suchen…');
    await userEvent.keyboard('zzz');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.message')!.textContent.trim()).toBe(
      'Keine Ergebnisse gefunden',
    );
  });

  it('localizes the clear label and the read-only description', async () => {
    const el = await make('label="Obst" has-clear value="Apple"', FRUIT, {lang: 'de-DE'});
    await waitUntil(
      () =>
        el.shadowRoot!.querySelector('tct-input-clear-button')?.getAttribute('label') ===
        'Obst löschen',
      'German clear label',
      4000,
    );
    el.readonly = true;
    await el.updateComplete;
    await waitUntil(
      () =>
        el.shadowRoot!.querySelector('.visually-hidden[id$="read-only"]')?.textContent.trim() ===
        'Schreibgeschützt',
      'German read-only text',
      4000,
    );
  });

  it('reads Arabic and lays out right to left', async () => {
    const el = await make('label="فاكهة"', FRUIT, {lang: 'ar-SA', dir: 'rtl'});
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part~="placeholder"]')!.textContent.trim() === 'اختر…',
      'Arabic placeholder',
      4000,
    );
    expect(getComputedStyle(el).direction).toBe('rtl');
  });

  it('attribute overrides win over the catalog', async () => {
    const el = await make(
      'label="Fruit" placeholder="Pick" has-search search-placeholder="Find" empty-search-text="None found"',
      FRUIT,
      {lang: 'de-DE'},
    );
    expect(el.shadowRoot!.querySelector('[part~="placeholder"]')!.textContent.trim()).toBe('Pick');
    await openByClick(el);
    expect(searchOf(el)!.placeholder).toBe('Find');
    await userEvent.keyboard('zzz');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.message')!.textContent.trim()).toBe('None found');
  });
});

describe('tct-selector: layer behaviour', () => {
  it('Escape closes one layer per press: a selector in a popover closes before the popover', async () => {
    const root = await import('@tecton-wc/testing/fixture.js').then(({fixture}) =>
      fixture<HTMLElement>(
        `<div style="padding:40px 40px 320px;inline-size:520px"><tct-popover label="Settings"><button id="open" type="button">Open</button>
          <div slot="content"><tct-selector label="Fruit"></tct-selector></div></tct-popover></div>`,
      ),
    );
    await import('../popover/define.js');
    const popover = root.querySelector<HTMLElement & {open: boolean; show(): Promise<void>}>(
      'tct-popover',
    )!;
    const el = root.querySelector<TctSelector>('tct-selector')!;
    el.options = FRUIT;
    await popover.show();
    await el.updateComplete;
    await openByClick(el);
    await pressKeys('Escape');
    await closed(el);
    expect(popover.open).toBe(true);
    await pressKeys('Escape');
    await waitUntil(() => !popover.open, 'popover closed by the second press');
    expect(layerOf(el)).toBeTruthy();
  });
});

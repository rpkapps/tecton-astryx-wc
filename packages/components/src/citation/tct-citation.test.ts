import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runKeyboardSuite} from '@tecton-wc/testing/suites/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import './define.js';
import parity from './parity.json' with {type: 'json'};
import type {TctCitation} from './tct-citation.js';

const source = {title: 'Example Source', url: 'https://example.com'};

const baseOf = (citation: TctCitation): HTMLElement =>
  citation.shadowRoot!.querySelector<HTMLElement>('.base')!;

/** The computed colour a token resolves to in this document (light or dark). */
function tokenColor(scope: Element, name: string, property = 'color'): string {
  const probe = document.createElement('span');
  probe.style.setProperty(property, `var(${name})`);
  (scope.parentElement ?? scope).append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

async function make(
  props: Partial<Pick<TctCitation, 'source' | 'number' | 'variant'>> = {},
  slot = '',
): Promise<TctCitation> {
  const wrapper = await fixture<HTMLElement>(`<div><tct-citation>${slot}</tct-citation></div>`);
  const citation = wrapper.querySelector<TctCitation>('tct-citation')!;
  Object.assign(citation, {source, number: 1, ...props});
  await citation.updateComplete;
  return citation;
}

runElementSuite({
  tag: 'tct-citation',
  render: () =>
    `<tct-citation number="1" source-title="Example" source-url="https://example.com"></tct-citation>`,
  properties: {number: 4, variant: 'number', sourceTitle: 'Another'},
  attributes: {number: 'number', variant: 'variant', sourceTitle: 'source-title'},
});

runKeyboardSuite({
  tag: 'tct-citation',
  render: () =>
    `<button id="before">before</button><tct-citation number="1" source-title="Example" source-url="https://example.com"></tct-citation>`,
  table: parity.entries['core.citation'].keyboard,
  steps: {
    'Moves focus to the citation link': {
      focus: (element) => element.parentElement!.querySelector<HTMLElement>('#before'),
      keys: ['Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(element.shadowRoot!.querySelector('a'));
      },
    },
    'Opens the source in a new tab': {
      setup: (element) => {
        (element as unknown as {clicks: number}).clicks = 0;
        element.shadowRoot!.querySelector('a')!.addEventListener('click', (event) => {
          event.preventDefault(); // keep the test page: a real activation opens a new tab
          (element as unknown as {clicks: number}).clicks++;
        });
      },
      focus: (element) => element.shadowRoot!.querySelector<HTMLElement>('a'),
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element as unknown as {clicks: number}).clicks).toBe(1);
      },
    },
  },
});

describe('tct-citation (Citation.test.tsx)', () => {
  it.each([
    'javascript:alert(1)',
    'vbscript:MsgBox(1)',
    'data:text/html,<b>x</b>',
    'java\nscript:alert(1)',
  ])('renders rejected citation URL %s without navigation', async (url) => {
    const label = await make({source: {title: 'Source', url}});
    const number = await make({source: {title: 'Source', url}, variant: 'number'});
    for (const citation of [label, number]) {
      expect(citation.shadowRoot!.querySelector('a')).toBeNull();
      expect(citation.shadowRoot!.querySelector('[href]')).toBeNull();
    }
    expect(label.shadowRoot!.textContent.trim()).toBe('Source');
    expect(number.shadowRoot!.textContent.trim()).toBe('1');
  });

  it('renders the source title as a link in the label variant', async () => {
    const citation = await make();
    const link = baseOf(citation);
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.textContent.trim()).toBe('Example Source');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders the index as a badge in the number variant', async () => {
    const citation = await make({number: 3, variant: 'number'});
    const link = baseOf(citation);
    expect(link.textContent.trim()).toBe('3');
    expect(link.getAttribute('role')).toBe('doc-noteref');
    expect(link.getAttribute('aria-label')).toBe('Citation 3: Example Source');
  });

  it('renders as a plain element when the source has no url, without a link role', async () => {
    const citation = await make({source: {title: 'No link'}});
    const element = baseOf(citation);
    expect(element.tagName).toBe('SPAN');
    // doc-noteref is a reference role that is not permitted on an unlinked element (upstream a11y note).
    expect(element.getAttribute('role')).not.toBe('doc-noteref');
    expect(element.hasAttribute('href')).toBe(false);
  });

  it('uses the number as the title when the source has none', async () => {
    const citation = await make({source: {url: 'https://example.com'}, number: 7});
    expect(baseOf(citation).textContent.trim()).toBe('7');
    expect(baseOf(citation).getAttribute('aria-label')).toBe('Citation 7: 7');
  });

  it('exposes the base part (theming target astryx-citation)', async () => {
    const citation = await make();
    expect(citation.shadowRoot!.querySelector('[part~="base"]')).toBe(baseOf(citation));
  });

  it('takes the source from the flat attributes, a source field winning per field', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-citation
          number="2"
          source-title="From attribute"
          source-url="https://example.org"
        ></tct-citation>
      </div>`,
    );
    const citation = wrapper.querySelector<TctCitation>('tct-citation')!;
    expect(baseOf(citation).textContent.trim()).toBe('From attribute');
    expect(baseOf(citation).getAttribute('href')).toBe('https://example.org');
    citation.source = {title: 'From property'};
    await citation.updateComplete;
    expect(baseOf(citation).textContent.trim()).toBe('From property');
    expect(baseOf(citation).getAttribute('href')).toBe('https://example.org');
  });
});

describe('tct-citation: colours and cursor', () => {
  it('uses the secondary text colour in the label variant', async () => {
    const citation = await make();
    expect(getComputedStyle(baseOf(citation)).color).toBe(
      tokenColor(citation, '--color-text-secondary'),
    );
  });

  it('uses the secondary text colour, not accent, in the number variant', async () => {
    const citation = await make({variant: 'number'});
    const color = getComputedStyle(baseOf(citation)).color;
    expect(color).toBe(tokenColor(citation, '--color-text-secondary'));
    expect(color).not.toBe(tokenColor(citation, '--color-text-accent'));
  });

  it('keeps the accent-muted badge background when the source has a url', async () => {
    const citation = await make({variant: 'number'});
    expect(getComputedStyle(baseOf(citation)).backgroundColor).toBe(
      tokenColor(citation, '--color-accent-muted', 'background-color'),
    );
  });

  it.each(['label', 'number'] as const)(
    'uses the pointer cursor only with a url in the %s variant',
    async (variant) => {
      const linked = await make({variant});
      const plain = await make({variant, source: {title: 'No link'}});
      expect(getComputedStyle(baseOf(linked)).cursor).toBe('pointer');
      expect(getComputedStyle(baseOf(plain)).cursor).not.toBe('pointer');
    },
  );

  it('the number badge is a pill and the label chip a bordered rectangle', async () => {
    const badge = await make({variant: 'number', number: 1});
    const chip = await make();
    expect(parseFloat(getComputedStyle(baseOf(badge)).borderTopLeftRadius)).toBeGreaterThan(100);
    expect(getComputedStyle(baseOf(chip)).borderTopWidth).toBe('1px');
    expect(baseOf(badge).getBoundingClientRect().height).toBe(20);
    expect(baseOf(chip).getBoundingClientRect().height).toBe(20);
  });

  it('clips a long title with an ellipsis at 15em', async () => {
    const citation = await make({
      source: {
        title: 'A very long source title that does not fit in fifteen em',
        url: 'https://e.com',
      },
    });
    const chip = baseOf(citation);
    const label = citation.shadowRoot!.querySelector<HTMLElement>('.label')!;
    const em = parseFloat(getComputedStyle(chip).fontSize);
    expect(chip.getBoundingClientRect().width).toBeLessThanOrEqual(15 * em + 1);
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
  });
});

describe('tct-citation: source icon (image URL back-compat vs slotted node)', () => {
  const png = 'https://example.com/favicon.png';

  it('renders a legacy string icon as a decorative image (back-compat)', async () => {
    const citation = await make({source: {title: 'GitHub', url: 'https://github.com', icon: png}});
    const img = citation.shadowRoot!.querySelector<HTMLImageElement>('img')!;
    expect(img.getAttribute('src')).toBe(png);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders source.src as a decorative image and it wins over the legacy icon', async () => {
    const citation = await make({
      source: {
        title: 'GitHub',
        url: 'https://github.com',
        src: 'https://example.com/logo.png',
        icon: png,
      },
    });
    const img = citation.shadowRoot!.querySelector<HTMLImageElement>('img')!;
    expect(img.getAttribute('src')).toBe('https://example.com/logo.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('renders a slotted node icon as-is (not an <img>) and prefers it over src', async () => {
    const citation = await make(
      {source: {title: 'GitHub', url: 'https://github.com', src: 'https://example.com/logo.png'}},
      '<svg slot="icon" data-testid="custom-icon"></svg>',
    );
    await citation.updateComplete;
    expect(citation.shadowRoot!.querySelector('img')).toBeNull();
    const wrapper = citation.shadowRoot!.querySelector('.icon')!;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper.querySelector<HTMLSlotElement>('slot')!.assignedElements()).toHaveLength(1);
  });

  it('refuses an unsafe image URL (data: and script schemes)', async () => {
    const citation = await make({
      source: {
        title: 'X',
        url: 'https://x.com',
        src: 'javascript:alert(1)',
        icon: 'data:image/png;base64,AAAA',
      },
    });
    expect(citation.shadowRoot!.querySelector('img')).toBeNull();
  });

  it('drops the icon when the image fails to load', async () => {
    const citation = await make({
      source: {title: 'Broken', url: 'https://x.com', src: 'http://localhost:1/none.png'},
    });
    await waitUntil(() => citation.shadowRoot!.querySelector('img') === null, 'image error');
  });

  it('does not draw an icon in the number variant', async () => {
    const citation = await make({
      source: {title: 'X', url: 'https://x.com', src: png},
      variant: 'number',
    });
    expect(citation.shadowRoot!.querySelector('.icon')).toBeNull();
  });

  it('keeps aria-label as the sole accessible name when an icon is present', async () => {
    const citation = await make({
      source: {title: 'GitHub', url: 'https://github.com', icon: png},
      number: 2,
    });
    expect(baseOf(citation).getAttribute('aria-label')).toBe('Citation 2: GitHub');
    if (isChromium) expect((await axNode(baseOf(citation))).name).toBe('Citation 2: GitHub');
  });
});

describe('tct-citation: accessibility and keyboard', () => {
  it('a linked citation is a link named "Citation n: title" and opens in a new tab', async () => {
    if (!isChromium) return;
    const citation = await make({number: 3, variant: 'number'});
    const node = await axNode(baseOf(citation));
    expect(node.name).toBe('Citation 3: Example Source');
    expect(['link', 'doc-noteref', 'DocNoteref']).toContain(node.role);
  });

  it('an unlinked citation is an image named "Citation n: title"', async () => {
    if (!isChromium) return;
    const citation = await make({source: {title: 'No link'}, number: 5, variant: 'number'});
    const node = await axNode(baseOf(citation));
    expect(node.role).toBe('image');
    expect(node.name).toBe('Citation 5: No link');
  });

  it('passes axe in every variant and link state, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<p>
          Claim
          <tct-citation .source=${source} .number=${1} variant="number"></tct-citation>
          and another
          <tct-citation .source=${{title: 'No link'}} .number=${2} variant="number"></tct-citation>
          <tct-citation .source=${source} .number=${3}></tct-citation>
          <tct-citation .source=${{title: 'No link'}} .number=${4}></tct-citation>
        </p>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });

  it('is one tab stop when linked; focus() lands on the link and Enter is native activation', async () => {
    const citation = await make();
    // A focusable element after the citation: Tab from the last tab stop would leave the document for
    // the browser UI, where whether document.activeElement changes is timing-dependent.
    const next = document.createElement('button');
    next.textContent = 'next';
    citation.after(next);
    citation.focus();
    expect(deepActiveElement()).toBe(baseOf(citation));
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(next);
  });

  it('an unlinked citation takes no focus', async () => {
    const citation = await make({source: {title: 'No link'}});
    citation.focus();
    expect(deepActiveElement()).not.toBe(baseOf(citation));
    expect(baseOf(citation).hasAttribute('tabindex')).toBe(false);
  });

  it('draws a focus ring on the link for keyboard focus', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <button type="button">before</button
        ><tct-citation
          number="1"
          source-title="Example"
          source-url="https://example.com"
        ></tct-citation>
      </div>`,
    );
    const citation = wrapper.querySelector<TctCitation>('tct-citation')!;
    wrapper.querySelector('button')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(baseOf(citation));
    expect(getComputedStyle(baseOf(citation)).outlineStyle).not.toBe('none');
  });
});

describe('tct-citation: forced colours', () => {
  it.skipIf(!isChromium)('draws the link in LinkText and keeps the badge edge', async () => {
    await emulateMedia({forcedColors: 'active'});
    const badge = await make({variant: 'number'});
    const chip = await make();
    expect(getComputedStyle(baseOf(badge)).borderTopStyle).toBe('solid');
    expect(getComputedStyle(baseOf(chip)).borderTopStyle).toBe('solid');
    expect(getComputedStyle(baseOf(chip)).color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

describe('tct-citation: i18n', () => {
  it('localises the accessible name (de-DE, ar-SA) and lets the locale switch re-render', async () => {
    const german = await fixture<HTMLElement>(
      html`<div lang="de-DE">
        <tct-citation .source=${source} .number=${1}></tct-citation>
      </div>`,
    );
    const de = german.querySelector<TctCitation>('tct-citation')!;
    await waitUntil(
      () => baseOf(de).getAttribute('aria-label') === 'Quelle 1: Example Source',
      'German name',
    );

    const arabic = await fixture<HTMLElement>(
      html`<div lang="ar-SA" dir="rtl">
        <tct-citation .source=${source} .number=${1}></tct-citation>
      </div>`,
    );
    const ar = arabic.querySelector<TctCitation>('tct-citation')!;
    await waitUntil(
      () => baseOf(ar).getAttribute('aria-label')!.startsWith('الاستشهاد'),
      'Arabic name',
    );
  });
});

describe('tct-citation: right-to-left', () => {
  it('lays the icon out at the inline start and keeps the chip inside its line', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<p style="inline-size: 300px">
        <tct-citation
          .source=${{title: 'المصدر', url: 'https://example.com', src: 'https://example.com/x.png'}}
          .number=${1}
        ></tct-citation>
      </p>`,
      {dir: 'rtl'},
    );
    const citation = wrapper.querySelector<TctCitation>('tct-citation')!;
    const chip = baseOf(citation).getBoundingClientRect();
    expect(chip.right).toBeLessThanOrEqual(wrapper.getBoundingClientRect().right + 1);
  });
});

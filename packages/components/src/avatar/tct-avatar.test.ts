import {html} from 'lit';
import {describe, expect, it, vi} from 'vitest';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {linkContext, type LinkContextValue} from '@tecton-astryx/core/context/keys.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runKeyboardSuite} from '@tecton-astryx/testing/suites/keyboard.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import {userEvent} from 'vitest/browser';
import {beforeAll} from 'vitest';
import '../icon/define.js';
import {getInitials} from './avatar.initials.js';
import {AVATAR_SHAPES, resolveSize} from './avatar.types.js';
import './define.js';
import parity from './parity.json' with {type: 'json'};
import type {TctAvatar} from './tct-avatar.js';

/** A real, loadable image (a `blob:` URL passes the resource policy; `data:` does not). */
async function imageUrl(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  canvas.getContext('2d')!.fillRect(0, 0, 4, 4);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!)));
  return URL.createObjectURL(blob);
}
const BROKEN = 'http://localhost:1/none.png';

/** Stands in for `tct-link-provider` (which arrives with the link folder). */
class TctTestRouter extends TctElement {
  static override readonly tagName = 'tct-test-router';
  readonly calls: {href: string; event: MouseEvent}[] = [];
  readonly provider = new ContextProvider(this, {
    context: linkContext,
    initialValue: {
      navigate: (href, event) => {
        this.calls.push({href, event});
        return true;
      },
    } satisfies LinkContextValue,
  });
  override render() {
    return html`<slot></slot>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'tct-test-router': TctTestRouter;
  }
}
beforeAll(() => {
  defineElement(TctTestRouter);
});

const rootOf = (avatar: TctAvatar): HTMLElement =>
  avatar.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const fallbackOf = (avatar: TctAvatar): HTMLElement | null =>
  avatar.shadowRoot!.querySelector<HTMLElement>('[part~="fallback"]');

async function make(attributes = '', slot = ''): Promise<TctAvatar> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding: 16px"><tct-avatar ${attributes}>${slot}</tct-avatar></div>`,
  );
  const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
  await avatar.updateComplete;
  return avatar;
}

runElementSuite({
  tag: 'tct-avatar',
  render: () => `<tct-avatar name="Ada Lovelace"></tct-avatar>`,
  properties: {name: 'Grace Hopper', size: 'lg', shape: 'rounded', src: 'x.png', interactive: true},
  attributes: {name: 'name', size: 'size', shape: 'shape', src: 'src'},
  // The runElementSuite default render is decorative-safe; the interactive variant is covered below.
  skip: ['a11y'],
});

runKeyboardSuite({
  tag: 'tct-avatar',
  render: () =>
    `<button type="button">before</button><tct-avatar name="Ada" href="#ada"></tct-avatar><tct-avatar name="Bob" interactive></tct-avatar><tct-avatar name="Cy"></tct-avatar>`,
  table: parity.entries['core.avatar'].keyboard,
  steps: {
    'Moves focus to an interactive avatar': {
      focus: (element) => element.previousElementSibling as HTMLElement,
      keys: ['Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe((element as TctAvatar).control);
      },
    },
    'Follows the link': {
      setup: (element) => {
        (element as unknown as {clicks: number}).clicks = 0;
        (element as TctAvatar).control!.addEventListener('click', (event) => {
          event.preventDefault(); // keep the test page where it is
          (element as unknown as {clicks: number}).clicks++;
        });
      },
      focus: (element) => (element as TctAvatar).control,
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element as unknown as {clicks: number}).clicks).toBe(1);
      },
    },
    'Activates the button': {
      setup: (element) => {
        const bob = element.nextElementSibling as TctAvatar;
        (bob as unknown as {clicks: number}).clicks = 0;
        bob.control!.addEventListener('click', () => {
          (bob as unknown as {clicks: number}).clicks++;
        });
      },
      focus: (element) => (element.nextElementSibling as TctAvatar).control,
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element.nextElementSibling as unknown as {clicks: number}).clicks).toBe(1);
      },
    },
    'Moves focus to a static avatar and opens its tooltip': {
      focus: (element) => (element.nextElementSibling as TctAvatar).control,
      keys: ['Tab'],
      expect: async ({element}) => {
        const cy = element.nextElementSibling!.nextElementSibling as TctAvatar;
        expect(deepActiveElement()).toBe(rootOf(cy));
        await waitUntil(
          () => cy.shadowRoot!.querySelector('.tooltip-surface')!.matches(':popover-open'),
          'tooltip open on focus',
        );
      },
    },
    'Closes the tooltip': {
      setup: async (element) => {
        const cy = element.nextElementSibling!.nextElementSibling as TctAvatar;
        await userEvent.hover(rootOf(cy));
        await waitUntil(
          () => cy.shadowRoot!.querySelector('.tooltip-surface')!.matches(':popover-open'),
          'tooltip open on hover',
        );
      },
      focus: (element) => rootOf(element.nextElementSibling!.nextElementSibling as TctAvatar),
      keys: ['Escape'],
      expect: async ({element}) => {
        const cy = element.nextElementSibling!.nextElementSibling as TctAvatar;
        await waitUntil(
          () => !cy.shadowRoot!.querySelector('.tooltip-surface')!.matches(':popover-open'),
          'tooltip closed by Escape',
        );
      },
    },
  },
});

describe('tct-avatar (Avatar.test.tsx)', () => {
  it('exposes role="img" with the name as accessible name', async () => {
    const avatar = await make('name="Ada Lovelace"');
    expect(rootOf(avatar).getAttribute('role')).toBe('img');
    if (isChromium) expect((await axNode(rootOf(avatar))).name).toBe('Ada Lovelace');
  });

  it('uses alt over name for the accessible name', async () => {
    const avatar = await make('name="Ada" alt="Ada Lovelace, profile photo"');
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace, profile photo');
  });

  it('is decorative (presentation + aria-hidden) when it has no name or alt (obs-9)', async () => {
    const avatar = await make();
    const root = rootOf(avatar);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('role')).toBe('presentation');
    expect(root.hasAttribute('aria-label')).toBe(false);
    if (isChromium) expect((await axNode(root)).ignored).toBe('true');
  });

  it('does not double-announce: the inner img is decorative when the wrapper is named', async () => {
    const src = await imageUrl();
    const avatar = await make(`name="Ada" src="${src}"`);
    const img = rootOf(avatar).querySelector('img')!;
    expect(img).not.toBeNull();
    expect(img.getAttribute('alt')).toBe('');
  });

  it('renders fallback initials at the proportional size (40% of the avatar)', async () => {
    const avatar = await make('name="Ada Lovelace" size="sm"');
    expect(fallbackOf(avatar)!.textContent.trim()).toBe('AL');
    expect(parseFloat(getComputedStyle(fallbackOf(avatar)!).fontSize)).toBeCloseTo(9.6, 1);
  });

  it('marks the fallback surface with the stable part (initials and icon)', async () => {
    const initials = await make('name="Ada Lovelace"');
    expect(fallbackOf(initials)).not.toBeNull();
    const icon = await make();
    expect(fallbackOf(icon)!.querySelector('svg')).not.toBeNull();
  });

  it('puts the avatar box on the element that carries the base part, for every root kind', async () => {
    const staticAvatar = await make('name="Ada Lovelace" size="lg"');
    const link = await make('name="Ada" size="lg" href="/ada"');
    const button = await make('name="Ada" size="lg" interactive');
    for (const avatar of [staticAvatar, link, button]) {
      const box = rootOf(avatar).getBoundingClientRect();
      expect([box.width, box.height]).toEqual([48, 48]);
    }
  });

  it('does not split an emoji surrogate pair when generating initials', async () => {
    expect(fallbackOf(await make('name="😀 Ada"'))!.textContent.trim()).toBe('😀A');
    expect(fallbackOf(await make('name="🇬🇧 Ada"'))!.textContent.trim()).toBe('🇬🇧A');
    expect(fallbackOf(await make('name="👨‍👩‍👧‍👦 Ada"'))!.textContent.trim()).toBe('👨‍👩‍👧‍👦A');
  });

  describe('initials come from letters, digits and emoji, not punctuation', () => {
    it.each([
      ['Northwind Workbench (automation)', 'NA'],
      ['Ada "The Countess" Lovelace', 'AL'],
      ['“Ada” Lovelace', 'AL'],
      ['Ada - Lovelace', 'AL'],
      ['Ada Lovelace —', 'AL'],
      ['Mary-Jane Watson', 'MW'],
      ['(Ada)', 'A'],
      ['Alice', 'A'],
      ['R2 D2', 'RD'],
      ['3M', '3'],
      ['émile zola', 'ÉZ'],
      ['😀 Ada', '😀A'],
      ['Ada (😀)', 'A😀'],
    ])('%s renders %s', (name, expected) => {
      expect(getInitials(name)).toBe(expected);
    });

    it('falls through to the default icon when no word yields an initial', async () => {
      const avatar = await make('name="- ()"');
      expect(fallbackOf(avatar)!.querySelector('svg')).not.toBeNull();
      expect(fallbackOf(avatar)!.textContent.trim()).toBe('');
      // The name still names the avatar.
      expect(rootOf(avatar).getAttribute('aria-label')).toBe('- ()');
    });
  });

  it('retries a new src after a previous src failed to load', async () => {
    const avatar = await make(`name="Ada" src="${BROKEN}"`);
    await waitUntil(() => rootOf(avatar).querySelector('img') === null, 'broken image dropped');
    expect(fallbackOf(avatar)!.textContent.trim()).toBe('A');
    const good = await imageUrl();
    avatar.src = good;
    await avatar.updateComplete;
    expect(rootOf(avatar).querySelector('img')!.getAttribute('src')).toBe(good);
  });

  it('retries a new fallbackSrc after a previous fallbackSrc failed to load', async () => {
    const avatar = await make(`name="Ada" src="${BROKEN}" fallback-src="${BROKEN}?2"`);
    await waitUntil(() => fallbackOf(avatar) !== null, 'both images failed');
    const good = await imageUrl();
    avatar.fallbackSrc = good;
    await avatar.updateComplete;
    expect(rootOf(avatar).querySelector('img')!.getAttribute('src')).toBe(good);
  });

  it('falls back from src to fallback-src to the initials', async () => {
    const good = await imageUrl();
    const avatar = await make(`name="Ada" src="${BROKEN}" fallback-src="${good}"`);
    await waitUntil(
      () => rootOf(avatar).querySelector('img')?.getAttribute('src') === good,
      'fallback image',
    );
    expect(fallbackOf(avatar)).toBeNull();
  });

  it('refuses unsafe image URLs (script schemes, data:) and shows the initials', async () => {
    for (const src of ['javascript:alert(1)', 'data:image/png;base64,AAAA']) {
      const avatar = await make(`name="Ada" src="${src}"`);
      expect(rootOf(avatar).querySelector('img')).toBeNull();
      expect(fallbackOf(avatar)!.textContent.trim()).toBe('A');
    }
  });
});

describe('tct-avatar: status in the accessible name (WCAG 4.1.2)', () => {
  const dot = (attributes = 'label="Online"') =>
    `<tct-avatar-status-dot slot="status" ${attributes}></tct-avatar-status-dot>`;

  it('composes the status label into the accessible name for image and initials avatars', async () => {
    const src = await imageUrl();
    const image = await make(`name="Ada Lovelace" src="${src}"`, dot());
    expect(rootOf(image).getAttribute('aria-label')).toBe('Ada Lovelace, Online');
    const initials = await make('name="Ada Lovelace"', dot('variant="error" label="Busy"'));
    expect(rootOf(initials).getAttribute('aria-label')).toBe('Ada Lovelace, Busy');
    expect(fallbackOf(initials)!.textContent.trim()).toBe('AL');
    if (isChromium) expect((await axNode(rootOf(initials))).name).toBe('Ada Lovelace, Busy');
  });

  it('composes the status label with alt when alt overrides name', async () => {
    const avatar = await make('name="Ada" alt="Ada Lovelace, profile photo"', dot());
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace, profile photo, Online');
  });

  it('keeps the plain name when there is no status or the dot has no label', async () => {
    expect(rootOf(await make('name="Ada Lovelace"')).getAttribute('aria-label')).toBe(
      'Ada Lovelace',
    );
    expect(rootOf(await make('name="Ada Lovelace"', dot(''))).getAttribute('aria-label')).toBe(
      'Ada Lovelace',
    );
    expect(
      rootOf(await make('name="Ada Lovelace"', '<span slot="status"></span>')).getAttribute(
        'aria-label',
      ),
    ).toBe('Ada Lovelace');
  });

  it('announces a labelled status even on an otherwise decorative avatar', async () => {
    const avatar = await make('', dot());
    const root = rootOf(avatar);
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Online');
    expect(root.hasAttribute('aria-hidden')).toBe(false);
  });

  it('stays decorative with an unlabelled status and no name', async () => {
    const avatar = await make('', dot(''));
    expect(rootOf(avatar).getAttribute('aria-hidden')).toBe('true');
    expect(rootOf(avatar).hasAttribute('aria-label')).toBe(false);
  });

  describe('status label through a consumer wrapper (P14)', () => {
    const wrapped = (presence = 'Online') =>
      `<span slot="status"><b><tct-avatar-status-dot variant="success" label="${presence}"></tct-avatar-status-dot></b></span>`;

    it('composes a label reported from inside a wrapper element, at any nesting depth', async () => {
      const avatar = await make('name="Ada Lovelace"', wrapped('Away'));
      expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace, Away');
    });

    it('follows a label that changes after mount', async () => {
      const avatar = await make('name="Ada Lovelace"', wrapped('Online'));
      avatar.querySelector('tct-avatar-status-dot')!.setAttribute('label', 'Busy');
      await waitUntil(
        () => rootOf(avatar).getAttribute('aria-label') === 'Ada Lovelace, Busy',
        'label follows',
      );
    });

    it('drops the label when the status element is removed', async () => {
      const avatar = await make('name="Ada Lovelace"', wrapped());
      expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace, Online');
      avatar.querySelector('span[slot="status"]')!.remove();
      await waitUntil(
        () => rootOf(avatar).getAttribute('aria-label') === 'Ada Lovelace',
        'label dropped',
      );
    });

    it('announces a wrapped status on an otherwise decorative avatar', async () => {
      const avatar = await make('', wrapped());
      expect(rootOf(avatar).getAttribute('role')).toBe('img');
      expect(rootOf(avatar).getAttribute('aria-label')).toBe('Online');
    });

    it('leaves a consumer aria-label alone when a wrapped status reports', async () => {
      const avatar = await make(
        'name="Ada Lovelace" aria-label="Ada Lovelace, first programmer"',
        wrapped(),
      );
      expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace, first programmer');
    });

    it('follows a host aria-label added after mount, and back', async () => {
      const avatar = await make('name="Ada"');
      avatar.setAttribute('aria-label', 'Countess of Lovelace');
      await waitUntil(
        () => rootOf(avatar).getAttribute('aria-label') === 'Countess of Lovelace',
        'aria-label override',
      );
      avatar.removeAttribute('aria-label');
      await waitUntil(() => rootOf(avatar).getAttribute('aria-label') === 'Ada', 'back to name');
    });
  });

  it('positions the status dot on the circle edge and at the corner for other shapes', async () => {
    const circle = await make('name="Ada" size="xl" shape="circle"', dot());
    const square = await make('name="Ada" size="xl" shape="square"', dot());
    const box = (avatar: TctAvatar) => rootOf(avatar).getBoundingClientRect();
    const statusBox = (avatar: TctAvatar) =>
      avatar.shadowRoot!.querySelector('[part~="status"]')!.getBoundingClientRect();
    // 45 degrees on a 128px circle: 0.1464 * 128 = 18.7px from the corner, pushed outward by half the dot.
    expect(box(circle).right - statusBox(circle).right).toBeCloseTo(2.7, 0);
    expect(box(square).bottom - statusBox(square).bottom).toBeCloseTo(-8, 0);
  });
});

describe('tct-avatar: a whitespace-only name carries no identity', () => {
  it('falls through to the default icon instead of an empty plate', async () => {
    const avatar = await make('name="   "');
    expect(fallbackOf(avatar)!.querySelector('svg')).not.toBeNull();
  });

  it('is decorative rather than a role="img" with a blank name', async () => {
    const avatar = await make('name="   "');
    expect(rootOf(avatar).getAttribute('aria-hidden')).toBe('true');
    expect(rootOf(avatar).hasAttribute('aria-label')).toBe(false);
  });

  it('keeps a meaningful alt as the accessible name and still shows the icon', async () => {
    const avatar = await make('name="   " alt="Ada Lovelace"');
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(fallbackOf(avatar)!.querySelector('svg')).not.toBeNull();
  });

  it('treats a whitespace-only alt the same way', async () => {
    const avatar = await make('name="Ada" alt="   "');
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada');
  });
});

describe('tct-avatar: shape and size', () => {
  it('renders every shape with the matching radius and defaults to circle', async () => {
    const radius = async (attributes: string) =>
      getComputedStyle(rootOf(await make(`name="Ada" size="lg" ${attributes}`)))
        .borderTopLeftRadius;
    expect(parseFloat(await radius(''))).toBeGreaterThan(100);
    expect(await radius('shape="rounded"')).toBe('4px');
    expect(await radius('shape="square"')).toBe('0px');
    expect(AVATAR_SHAPES).toHaveLength(3);
  });

  it('resolves named and numeric sizes', async () => {
    expect([
      resolveSize('xsm'),
      resolveSize('sm'),
      resolveSize('md'),
      resolveSize('lg'),
      resolveSize('xl'),
    ]).toEqual([20, 24, 36, 48, 128]);
    expect(resolveSize(40)).toBe(40);
    const numeric = await make('name="Ada" size="60"');
    expect(rootOf(numeric).getBoundingClientRect().width).toBe(60);
    expect(numeric.size).toBe(60);
  });

  it('an unknown size falls back to md', async () => {
    const avatar = await make('name="Ada" size="huge"');
    expect(rootOf(avatar).getBoundingClientRect().width).toBe(36);
  });
});

describe('tct-avatar: interactivity (Button trichotomy)', () => {
  it('renders a link when href is set', async () => {
    const avatar = await make('name="Ada" href="/ada"');
    const link = rootOf(avatar);
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/ada');
    if (isChromium) {
      const node = await axNode(link);
      expect(node.role).toBe('link');
      expect(node.name).toBe('Ada');
    }
  });

  it('forwards target and rel on the link', async () => {
    const avatar = await make('name="Ada" href="/ada" target="_blank" rel="noopener"');
    expect(rootOf(avatar).getAttribute('target')).toBe('_blank');
    expect(rootOf(avatar).getAttribute('rel')).toBe('noopener');
  });

  it('renders a <button type="button"> when interactive (no href) and fires one click', async () => {
    const avatar = await make('name="Ada" interactive');
    const button = rootOf(avatar);
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    const clicks = recordEvents(avatar, 'click');
    await userEvent.click(button);
    expect(clicks.events).toHaveLength(1);
    if (isChromium) expect((await axNode(button)).role).toBe('button');
  });

  it('href wins over interactive (link, not button)', async () => {
    const avatar = await make('name="Ada" href="/ada" interactive');
    expect(rootOf(avatar).tagName).toBe('A');
  });

  it('stays a static element by default and exposes no control', async () => {
    const avatar = await make('name="Ada"');
    expect(rootOf(avatar).tagName).toBe('DIV');
    expect(avatar.control).toBeNull();
  });

  it('exposes the inner link or button as the control (the roving tab stop)', async () => {
    expect((await make('name="Ada" href="/a"')).control!.tagName).toBe('A');
    expect((await make('name="Ada" interactive')).control!.tagName).toBe('BUTTON');
  });

  it('carries a focus ring on the interactive element', async () => {
    // Start from a known button: another test's leftovers may be the first tab stop of the page.
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <button type="button">before</button><tct-avatar name="Ada" interactive></tct-avatar>
      </div>`,
    );
    const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
    wrapper.querySelector('button')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(rootOf(avatar));
    expect(getComputedStyle(rootOf(avatar)).outlineStyle).not.toBe('none');
  });

  it('does not render a link for an unsafe href', async () => {
    const avatar = await make('name="Ada" href="javascript:alert(1)"');
    expect(rootOf(avatar).hasAttribute('href')).toBe(false);
  });

  it('warns in dev when interactive without an accessible name, not otherwise', async () => {
    resetDevWarnings();
    globalThis.tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await make('href="/ada"');
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockClear();
      resetDevWarnings();
      await make('name="Ada" href="/ada"');
      await make('name="Ada"');
      await make('');
      await make('aria-label="Profile" interactive');
      expect(warn).not.toHaveBeenCalled();
      // A status label is not an identity.
      resetDevWarnings();
      await make(
        'interactive',
        '<tct-avatar-status-dot slot="status" label="Online"></tct-avatar-status-dot>',
      );
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      globalThis.tctDevMode = undefined;
      resetDevWarnings();
    }
  });

  it('hands a plain primary click on a link to the router (linkContext), ignoring modified clicks', async () => {
    const router = await fixture<TctTestRouter>(
      html`<tct-test-router><tct-avatar name="Ada" href="/ada"></tct-avatar></tct-test-router>`,
    );
    const avatar = router.querySelector<TctAvatar>('tct-avatar')!;
    await avatar.updateComplete;
    const link = rootOf(avatar) as HTMLAnchorElement;
    // Never leave the test page: the router claims the plain click, and the others are cancelled by us.
    const seen: boolean[] = [];
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.button !== 0) event.preventDefault();
      seen.push(event.defaultPrevented);
    });
    link.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true, cancelable: true}));
    expect(router.calls.map((call) => call.href)).toEqual(['/ada']);
    link.dispatchEvent(
      new MouseEvent('click', {bubbles: true, composed: true, cancelable: true, ctrlKey: true}),
    );
    link.dispatchEvent(
      new MouseEvent('click', {bubbles: true, composed: true, cancelable: true, button: 1}),
    );
    expect(router.calls).toHaveLength(1);
  });
});

describe('tct-avatar: accessibility, forced colours, right-to-left', () => {
  it('passes axe in every state, light and dark', async () => {
    const src = await imageUrl();
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div style="display: flex; gap: 8px; padding: 12px">
          <tct-avatar name="Ada Lovelace"></tct-avatar>
          <tct-avatar name="Ada Lovelace" src=${src} size="lg"></tct-avatar>
          <tct-avatar></tct-avatar>
          <tct-avatar name="Ada" href="/ada"></tct-avatar>
          <tct-avatar name="Ada" interactive></tct-avatar>
          <tct-avatar name="Ada Lovelace" size="xl">
            <tct-avatar-status-dot slot="status" variant="success" label="Online">
              <tct-icon slot="icon" name="check"></tct-icon>
            </tct-avatar-status-dot>
          </tct-avatar>
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });

  it.skipIf(!isChromium)('keeps the fallback visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const avatar = await make('name="Ada Lovelace"');
    expect(getComputedStyle(fallbackOf(avatar)!).borderTopStyle).toBe('solid');
  });

  it('places the status dot at the inline end in both directions', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div style="padding: 20px">
          <tct-avatar name="Ada" size="xl" shape="square"
            ><tct-avatar-status-dot slot="status" label="Online"></tct-avatar-status-dot
          ></tct-avatar>
        </div>`,
        {dir},
      );
      const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
      const root = rootOf(avatar).getBoundingClientRect();
      const status = avatar.shadowRoot!.querySelector('[part~="status"]')!.getBoundingClientRect();
      const centre = status.left + status.width / 2;
      if (dir === 'ltr') expect(centre).toBeGreaterThan(root.left + root.width / 2);
      else expect(centre).toBeLessThan(root.left + root.width / 2);
    }
  });
});

describe('tct-avatar: name tooltip (Avatar.test.tsx "name tooltip")', () => {
  const surfaceOf = (avatar: TctAvatar): HTMLElement | null =>
    avatar.shadowRoot!.querySelector<HTMLElement>('.tooltip-surface');
  const isOpen = (avatar: TctAvatar): boolean =>
    surfaceOf(avatar)?.matches(':popover-open') ?? false;

  /** The real mouse pointer stays where the last test left it; park it in an empty corner. */
  const parkPointer = async (): Promise<void> => {
    const corner = document.createElement('div');
    corner.style.cssText =
      'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
    document.body.append(corner);
    await userEvent.hover(corner);
    corner.remove();
  };

  it('shows the name in a tooltip by default', async () => {
    const avatar = await make('name="Ada Lovelace"');
    expect(surfaceOf(avatar)!.textContent.trim()).toBe('Ada Lovelace');
    expect(surfaceOf(avatar)!.getAttribute('role')).toBe('tooltip');
  });

  it('shows a custom string tooltip instead of the name', async () => {
    const avatar = await make('name="alovelace" tooltip="Ada Lovelace, Mathematician"');
    expect(surfaceOf(avatar)!.textContent.trim()).toBe('Ada Lovelace, Mathematician');
    expect(surfaceOf(avatar)!.textContent).not.toContain('alovelace');
  });

  it('renders no tooltip when tooltip="false"', async () => {
    const avatar = await make('name="Ada Lovelace" tooltip="false"');
    expect(surfaceOf(avatar)).toBeNull();
    avatar.tooltip = true;
    await avatar.updateComplete;
    expect(surfaceOf(avatar)).not.toBeNull();
    avatar.tooltip = false;
    await avatar.updateComplete;
    expect(surfaceOf(avatar)).toBeNull();
  });

  it('renders no tooltip for a decorative avatar (no name or alt)', async () => {
    const avatar = await make();
    expect(surfaceOf(avatar)).toBeNull();
  });

  it('renders no tooltip when the default would show the name and the name is blank', async () => {
    const avatar = await make('name="   " alt="Profile photo"');
    // The default tooltip uses `name` (not `alt`): a blank name leaves nothing to show.
    expect(surfaceOf(avatar)).toBeNull();
    if (isChromium) expect((await axNode(rootOf(avatar))).name).toBe('Profile photo');
  });

  it('still shows a custom string tooltip when there is no name', async () => {
    const avatar = await make('tooltip="Anonymous user"');
    expect(surfaceOf(avatar)!.textContent.trim()).toBe('Anonymous user');
  });

  it('makes a static root focusable while a tooltip is attached, and not when it is off', async () => {
    const withTip = await make('name="Ada Lovelace"');
    expect(rootOf(withTip).getAttribute('tabindex')).toBe('0');
    const without = await make('name="Ada Lovelace" tooltip="false"');
    expect(rootOf(without).hasAttribute('tabindex')).toBe(false);
  });

  it('keeps the accessible name on the root regardless of the tooltip', async () => {
    const avatar = await make('name="Ada Lovelace"');
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace');
    avatar.tooltip = false;
    await avatar.updateComplete;
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('Ada Lovelace');
    avatar.tooltip = 'Ada Lovelace, Eng';
    avatar.name = 'alovelace';
    await avatar.updateComplete;
    // alt || name still drives the accessible name, not the custom tooltip.
    expect(rootOf(avatar).getAttribute('aria-label')).toBe('alovelace');
    avatar.alt = "Ada's profile photo";
    await avatar.updateComplete;
    expect(rootOf(avatar).getAttribute('aria-label')).toBe("Ada's profile photo");
  });

  it('does not describe the root with the default name tooltip (no double-announce)', async () => {
    const avatar = await make('name="Ada Lovelace"');
    expect(rootOf(avatar).hasAttribute('aria-describedby')).toBe(false);
    avatar.name = 'Grace Hopper';
    await avatar.updateComplete;
    expect(rootOf(avatar).hasAttribute('aria-describedby')).toBe(false);
  });

  it('describes the root with a custom string tooltip (matches Button)', async () => {
    const avatar = await make('name="alovelace" tooltip="Ada Lovelace, Mathematician"');
    expect(rootOf(avatar).getAttribute('aria-describedby')).toBe(surfaceOf(avatar)!.id);
  });

  it('shows the tooltip on hover above the avatar and hides it on leave', async () => {
    await parkPointer();
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding: 80px"><tct-avatar name="Ada Lovelace"></tct-avatar></div>`,
    );
    const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
    await avatar.updateComplete;
    await userEvent.hover(rootOf(avatar));
    await waitUntil(() => isOpen(avatar), 'tooltip open');
    expect(surfaceOf(avatar)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      rootOf(avatar).getBoundingClientRect().top + 1,
    );
    await parkPointer();
    await waitUntil(() => !isOpen(avatar), 'tooltip closed');
  });

  it('shows on keyboard focus of the tab stop, and Escape closes it', async () => {
    await parkPointer();
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding: 80px"><button>before</button><tct-avatar name="Ada Lovelace"></tct-avatar></div>`,
    );
    const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
    await avatar.updateComplete;
    wrapper.querySelector('button')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(rootOf(avatar));
    await waitUntil(() => isOpen(avatar), 'tooltip open on focus');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(avatar), 'tooltip closed by Escape');
  });

  it('gives an interactive avatar the tooltip without adding a tab stop of its own', async () => {
    const avatar = await make('name="Ada Lovelace" interactive');
    expect(rootOf(avatar).localName).toBe('button');
    expect(rootOf(avatar).hasAttribute('tabindex')).toBe(false);
    expect(surfaceOf(avatar)!.textContent.trim()).toBe('Ada Lovelace');
  });

  it('adds no tab stop to a static avatar inside a group', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-avatar-group><tct-avatar name="Ada Lovelace"></tct-avatar></tct-avatar-group>`,
    );
    const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
    await avatar.updateComplete;
    expect(rootOf(avatar).hasAttribute('tabindex')).toBe(false);
    // The hover tooltip is still there.
    expect(surfaceOf(avatar)!.textContent.trim()).toBe('Ada Lovelace');
  });

  it('passes axe with the tooltip open', async () => {
    await parkPointer();
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding: 80px"><tct-avatar name="Ada Lovelace"></tct-avatar></div>`,
    );
    const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
    await avatar.updateComplete;
    await userEvent.hover(rootOf(avatar));
    await waitUntil(() => isOpen(avatar), 'tooltip open');
    await expectAccessible(wrapper);
  });
});

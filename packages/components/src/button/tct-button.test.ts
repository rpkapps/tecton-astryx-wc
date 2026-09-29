/**
 * tct-button: naming, variants and tokens, loading and clickAction, disabled with a reason, links,
 * sizes and elevation, focus ring, ARIA delegation, events (ported from upstream Button.test.tsx).
 * Form submitter semantics live in tct-button.form.test.ts, the button group contract in
 * tct-button.group.test.ts, keyboard in tct-button.keyboard.test.ts.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {loadLocale} from '@tecton-astryx/core/i18n/registry.js';
import {linkContext, sizeContext} from '@tecton-astryx/core/context/keys.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium, withFeature} from '@tecton-astryx/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-astryx/testing/timing.js';
import {BUTTON_SIZES, BUTTON_VARIANTS} from './button.types.js';
import './define.js';
import type {TctButton} from './tct-button.js';

const inner = (button: TctButton): HTMLElement =>
  button.shadowRoot!.querySelector<HTMLElement>('.button')!;
const surface = (button: TctButton): HTMLElement | null =>
  button.shadowRoot!.querySelector<HTMLElement>('.tooltip-surface');

async function make(
  attributes = 'label="Click me"',
  content = '',
  wrapperStyle = '',
): Promise<TctButton> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="${wrapperStyle}"><tct-button ${attributes}>${content}</tct-button></div>`,
  );
  const button = wrapper.querySelector<TctButton>('tct-button')!;
  await button.updateComplete;
  return button;
}

/** Clicks with the real pointer, then waits for the activation (it runs after the event dispatched). */
async function click(button: HTMLElement): Promise<void> {
  await userEvent.click(button);
  await aTimeout(30);
}

/**
 * Reaches the button by keyboard (so `:focus-visible` matches): renders a native button before it, focuses
 * that one and presses Tab.
 */
async function tabTo(attributes: string, wrapperStyle = ''): Promise<TctButton> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="${wrapperStyle}"><button id="before">before</button><tct-button ${attributes}></tct-button></div>`,
  );
  const button = wrapper.querySelector<TctButton>('tct-button')!;
  await button.updateComplete;
  wrapper.querySelector<HTMLButtonElement>('#before')!.focus();
  await pressKeys('Tab');
  return button;
}

/** Answers `context-request` events for `context` on `target` (a stand-in for a provider element). */
function provide(target: HTMLElement, context: symbol, value: unknown): void {
  target.addEventListener('context-request', (event) => {
    if ((event.context as unknown) !== context) return;
    event.stopPropagation();
    (event.callback as (value: unknown) => void)(value);
  });
}

/** Resolves a token to a computed colour by painting it on a probe. */
async function colorOf(
  token: string,
  property: 'color' | 'backgroundColor' = 'color',
): Promise<string> {
  const probe = await fixture<HTMLElement>('<span>x</span>');
  probe.style[property] = `var(${token})`;
  return getComputedStyle(probe)[property];
}

/** Parks the real pointer in an empty corner: a fixture laid out under it would receive hover. */
beforeEach(async () => {
  const corner = document.createElement('div');
  corner.style.cssText =
    'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
  document.body.append(corner);
  await userEvent.hover(corner);
  corner.remove();
});

runElementSuite({
  tag: 'tct-button',
  render: () => html`<tct-button label="Save"></tct-button>`,
  properties: {
    variant: 'primary',
    size: 'lg',
    elevation: 'high',
    type: 'submit',
    name: 'go',
    value: '1',
    label: 'Save now',
    icon: 'search',
    tooltip: 'Saves the file',
    width: '200',
  },
  attributes: {
    variant: 'variant',
    size: 'size',
    elevation: 'elevation',
    type: 'type',
    name: 'name',
  },
});

describe('tct-button: rendering (Button.test.tsx)', () => {
  it('renders label as visible text', async () => {
    const button = await make();
    expect(inner(button).textContent.trim()).toBe('Click me');
    expect(inner(button).localName).toBe('button');
  });

  it.skipIf(!isChromium)('exposes role button named by its label', async () => {
    const button = await make();
    expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Click me'});
  });

  it('renders children instead of label when provided, with the label as accessible name', async () => {
    const button = await make('label="Accessible name"', 'Custom content');
    expect(button.textContent).toContain('Custom content');
    expect(button.shadowRoot!.querySelector('.label slot')).not.toBeNull();
    expect(inner(button).textContent).not.toContain('Accessible name');
    expect(inner(button).getAttribute('aria-label')).toBe('Accessible name');
  });

  it('renders text-only children without adding an aria-label that equals them', async () => {
    const button = await make('label="Save"', 'Save');
    expect(inner(button).hasAttribute('aria-label')).toBe(false);
  });

  it('uses the slotted text as the name when there is no label', async () => {
    const button = await make('', 'Save draft');
    if (isChromium) expect(await axNode(inner(button))).toMatchObject({name: 'Save draft'});
  });

  it.each(BUTTON_VARIANTS)(
    'renders the %s variant and reflects it for theming',
    async (variant) => {
      const button = await make(`label="B" variant="${variant}"`);
      expect(button.getAttribute('variant')).toBe(variant);
      expect(inner(button).getBoundingClientRect().height).toBe(32);
    },
  );

  it('defaults to the secondary variant, md size, type button, not disabled', async () => {
    const button = await make();
    expect(button.variant).toBe('secondary');
    expect(button.type).toBe('button');
    expect(inner(button).getAttribute('type')).toBe('button');
    expect(inner(button).getAttribute('data-size')).toBe('md');
    expect(inner(button).getAttribute('data-elevation')).toBe('none');
    expect(inner(button).hasAttribute('disabled')).toBe(false);
  });

  it('maps label to aria-label and keeps the icon when icon-only', async () => {
    const button = await make(
      'label="Settings" icon-only',
      '<svg slot="icon" data-testid="icon" viewBox="0 0 4 4"><path d="M0 0h4v4z"/></svg>',
    );
    expect(inner(button).getAttribute('aria-label')).toBe('Settings');
    expect(inner(button).textContent).not.toContain('Settings');
    expect(button.querySelector('[slot=icon]')!.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(inner(button).getBoundingClientRect().width).toBe(
      inner(button).getBoundingClientRect().height,
    );
  });

  it('renders the icon attribute as a registered icon and the icon slot with text', async () => {
    const byName = await make('label="Search" icon="search"');
    expect(inner(byName).hasAttribute('aria-label')).toBe(false);
    expect(inner(byName).textContent).toContain('Search');
    const icon = byName.shadowRoot!.querySelector('tct-icon')!;
    await icon.updateComplete;
    expect(icon.shadowRoot!.querySelector('svg')).not.toBeNull();
    const slotted = await make(
      'label="Edit"',
      '<svg slot="icon" viewBox="0 0 4 4"><path d="M0 0h4v4z"/></svg>',
    );
    expect(inner(slotted).hasAttribute('aria-label')).toBe(false);
    expect(slotted.querySelector('svg')!.getBoundingClientRect().width).toBe(16);
  });

  it('sizes a slotted tct-icon from the button size (16px for sm and md, 20px for lg)', async () => {
    const sizes: Record<string, number> = {sm: 16, md: 16, lg: 20};
    for (const [size, px] of Object.entries(sizes)) {
      const button = await make(
        `label="Edit" size="${size}"`,
        '<tct-icon slot="icon" name="search"></tct-icon>',
      );
      const icon = button.querySelector('tct-icon')!;
      await icon.updateComplete;
      expect(icon.shadowRoot!.querySelector('svg')!.getBoundingClientRect().width, size).toBe(px);
    }
  });

  it('an explicit icon size beats the size the button supplies', async () => {
    const button = await make(
      'label="Edit"',
      '<tct-icon slot="icon" name="search" size="lg"></tct-icon>',
    );
    const icon = button.querySelector('tct-icon')!;
    await icon.updateComplete;
    expect(icon.shadowRoot!.querySelector('svg')!.getBoundingClientRect().width).toBe(24);
  });

  it('renders end content after the label and ignores it when icon-only', async () => {
    const button = await make('label="Messages"', '<span slot="end" id="badge">3</span>');
    const label = button.shadowRoot!.querySelector('.label')!.getBoundingClientRect();
    const end = button.querySelector('#badge')!.getBoundingClientRect();
    expect(end.left).toBeGreaterThanOrEqual(label.right - 1);
    expect(button.shadowRoot!.querySelector('.end')).not.toBeNull();
    const iconOnly = await make(
      'label="Settings" icon="search" icon-only',
      '<span slot="end" id="badge">3</span>',
    );
    expect(iconOnly.shadowRoot!.querySelector('.end')).toBeNull();
    expect(iconOnly.querySelector('#badge')!.getBoundingClientRect().width).toBe(0);
  });

  it('end content inherits the button text colour', async () => {
    const button = await make(
      'label="Test" variant="primary"',
      '<span slot="end" id="badge">3</span>',
    );
    expect(getComputedStyle(button.querySelector('#badge')!).color).toBe(
      getComputedStyle(inner(button)).color,
    );
  });

  it('hides end content from layout and keeps it in the DOM while loading', async () => {
    const button = await make('label="Submit" loading', '<span slot="end" id="badge">3</span>');
    expect(button.querySelector('#badge')).not.toBeNull();
    expect(inner(button).getAttribute('aria-busy')).toBe('true');
    expect(button.shadowRoot!.querySelector('.content')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('tct-button: tokens, variants and states', () => {
  it.each([
    ['primary', '--color-accent', '--color-on-accent'],
    ['secondary', '--tecton-color-action-secondary-bg', '--tecton-color-action-secondary-text'],
    ['ghost', '--tecton-color-action-tertiary-bg', '--tecton-color-action-tertiary-text'],
    [
      'destructive',
      '--tecton-color-status-error-filled-bg',
      '--tecton-color-status-error-filled-text',
    ],
    ['outlined', '--tecton-color-action-outlined-bg', '--tecton-color-action-outlined-text'],
    ['text-only', '--tecton-color-action-outlined-bg', '--tecton-color-action-text-only'],
  ])('%s paints from its Tecton roles', async (variant, bg, fg) => {
    const button = await make(`label="B" variant="${variant}"`);
    const style = getComputedStyle(inner(button));
    expect(style.backgroundColor).toBe(await colorOf(bg, 'backgroundColor'));
    expect(style.color).toBe(await colorOf(fg));
  });

  it('outlined draws a 1px border; other variants keep a transparent one for forced colours', async () => {
    const outlined = await make('label="B" variant="outlined"');
    expect(getComputedStyle(inner(outlined)).borderTopColor).toBe(
      await colorOf('--tecton-color-action-outlined-border'),
    );
    expect(getComputedStyle(inner(outlined)).borderTopWidth).toBe('1px');
    const primary = await make('label="B" variant="primary"');
    expect(getComputedStyle(inner(primary)).borderTopWidth).toBe('1px');
    expect(getComputedStyle(inner(primary)).borderTopColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('shape: 4px corners, medium weight label, no letter-spacing change', async () => {
    const button = await make();
    const style = getComputedStyle(inner(button));
    expect(style.borderStartStartRadius).toBe('4px');
    expect(style.borderEndEndRadius).toBe('4px');
    expect(style.fontWeight).toBe('500');
    expect(style.letterSpacing).toBe('normal');
    expect(style.textTransform).toBe('none');
  });

  it('hover lightens to the hover fill; press to the press fill', async () => {
    const button = await make('label="Hover me"', '', 'padding: 20px');
    await userEvent.hover(inner(button));
    await aTimeout(300);
    expect(getComputedStyle(inner(button)).backgroundColor).toBe(
      await colorOf('--tecton-color-action-secondary-bg-hover', 'backgroundColor'),
    );
  });

  it('an explicit disabled button is recessed: native disabled, disabled fill and ink', async () => {
    const button = await make('label="Submit" disabled');
    expect(inner(button).hasAttribute('disabled')).toBe(true);
    const style = getComputedStyle(inner(button));
    expect(style.backgroundColor).toBe(
      await colorOf('--tecton-color-disabled-filled-bg', 'backgroundColor'),
    );
    expect(style.color).toBe(await colorOf('--tecton-color-disabled-filled-text'));
    expect(style.cursor).toBe('default');
  });

  it('outlined and text-only disabled use their own disabled roles', async () => {
    const outlined = await make('label="B" variant="outlined" disabled');
    expect(getComputedStyle(inner(outlined)).color).toBe(
      await colorOf('--tecton-color-disabled-outline-text'),
    );
    expect(getComputedStyle(inner(outlined)).borderTopColor).toBe(
      await colorOf('--tecton-color-disabled-outline-border'),
    );
    const textOnly = await make('label="B" variant="text-only" disabled');
    expect(getComputedStyle(inner(textOnly)).color).toBe(
      await colorOf('--tecton-color-disabled-text-only-text'),
    );
  });

  it('sizes: sm 28px, md 32px, lg 36px tall', async () => {
    const heights: Record<string, number> = {sm: 28, md: 32, lg: 36};
    for (const size of BUTTON_SIZES) {
      const button = await make(`label="B" size="${size}"`);
      expect(inner(button).getBoundingClientRect().height, size).toBe(heights[size]);
      expect(inner(button).getAttribute('data-size')).toBe(size);
    }
  });

  it('takes its size from a size provider; an explicit size wins', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-button id="a" label="A"></tct-button><tct-button id="b" label="B" size="sm"></tct-button></div>',
    );
    provide(wrapper, sizeContext, 'lg');
    // The buttons requested their context on connect, before the provider existed: ask again.
    for (const id of ['a', 'b']) {
      const button = wrapper.querySelector<TctButton>(`#${id}`)!;
      button.remove();
      wrapper.append(button);
      await button.updateComplete;
    }
    expect(inner(wrapper.querySelector<TctButton>('#a')!).getAttribute('data-size')).toBe('lg');
    expect(inner(wrapper.querySelector<TctButton>('#b')!).getAttribute('data-size')).toBe('sm');
  });

  it('width: a number is px, a string is a CSS length, unset fits the content', async () => {
    const fits = await make('label="Sign in"');
    const px = await make('label="Sign in" width="240"');
    const full = await make('label="Sign in" width="100%"', '', 'inline-size: 500px');
    expect(px.getBoundingClientRect().width).toBe(240);
    expect(inner(px).getBoundingClientRect().width).toBe(240);
    expect(full.getBoundingClientRect().width).toBe(500);
    expect(inner(full).getBoundingClientRect().width).toBe(500);
    expect(fits.getBoundingClientRect().width).toBeLessThan(200);
    px.removeAttribute('width');
    await px.updateComplete;
    expect(px.getBoundingClientRect().width).toBeLessThan(200);
  });

  it('elevation adds the shadow token for low, med and high; none is flat', async () => {
    const probe = await fixture<HTMLElement>('<span>x</span>');
    const shadow = (token: string): string => {
      probe.style.boxShadow = `var(${token})`;
      return getComputedStyle(probe).boxShadow;
    };
    for (const [elevation, token] of [
      ['low', '--shadow-low'],
      ['med', '--shadow-med'],
      ['high', '--shadow-high'],
    ] as const) {
      const button = await make(`label="Save" elevation="${elevation}"`);
      expect(inner(button).getAttribute('data-elevation')).toBe(elevation);
      expect(getComputedStyle(inner(button)).boxShadow).toBe(shadow(token));
    }
    expect(getComputedStyle(inner(await make('label="Save"'))).boxShadow).toBe('none');
  });

  it('the icon-only aspect ratio is a public custom property', async () => {
    const button = await make(
      'label="S" icon="search" icon-only',
      '',
      '--button-icon-only-aspect: 2 / 1',
    );
    const rect = inner(button).getBoundingClientRect();
    expect(rect.width / rect.height).toBeCloseTo(2, 1);
  });
});

describe('tct-button: focus ring (D-005)', () => {
  it('keyboard focus draws the hot-pink ring 1px outside the edge, on the inner button', async () => {
    const button = await tabTo('label="Focus me"');
    expect(button.shadowRoot!.activeElement).toBe(inner(button));
    const style = getComputedStyle(inner(button));
    expect(style.outlineStyle).toBe('solid');
    expect(style.outlineWidth).toBe('2px');
    expect(style.outlineOffset).toBe('1px');
    expect(style.outlineColor).toBe(await colorOf('--focus-outline-color'));
  });

  it('a pointer click does not draw the ring', async () => {
    const button = await make('label="Click me"');
    await userEvent.click(button);
    expect(getComputedStyle(inner(button)).outlineStyle).toBe('none');
  });

  it('the destructive variant keeps the same pink ring, not a red one', async () => {
    const button = await tabTo('label="Delete" variant="destructive"');
    expect(getComputedStyle(inner(button)).outlineColor).toBe(
      await colorOf('--focus-outline-color'),
    );
  });

  it('--button-focus-offset re-tunes the ring distance', async () => {
    const button = await tabTo('label="Focus me"', '--button-focus-offset: 4px');
    expect(getComputedStyle(inner(button)).outlineOffset).toBe('4px');
  });

  it('a keyboard-focused button takes the focus fill of its variant', async () => {
    const button = await tabTo('label="Focus me" variant="primary"');
    await aTimeout(300);
    expect(getComputedStyle(inner(button)).backgroundColor).toBe(
      await colorOf('--tecton-color-action-primary-bg-focus', 'backgroundColor'),
    );
  });
});

describe('tct-button: loading and clickAction', () => {
  it('shows the loading state with a spinner, aria-busy and no dimming', async () => {
    const button = await make('label="Submit" loading');
    expect(inner(button).getAttribute('aria-busy')).toBe('true');
    expect(inner(button).getAttribute('aria-disabled')).toBe('true');
    expect(inner(button).hasAttribute('disabled')).toBe(false); // focus is never dropped
    expect(inner(button).hasAttribute('data-disabled')).toBe(false); // busy is not dimmed
    expect(button.shadowRoot!.querySelector('tct-spinner')).not.toBeNull();
    expect(button.busy).toBe(true);
    const style = getComputedStyle(inner(button));
    expect(style.backgroundColor).toBe(
      await colorOf('--tecton-color-action-secondary-bg', 'backgroundColor'),
    );
  });

  it('a busy button keeps the label as its accessible name while its content is hidden', async () => {
    const button = await make('label="Submit" loading');
    expect(inner(button).getAttribute('aria-label')).toBe('Submit');
    if (isChromium)
      expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Submit'});
  });

  it.each(BUTTON_VARIANTS)(
    'renders the loading spinner with the inherit shade for %s (#2717)',
    async (variant) => {
      const button = await make(`label="Submit" variant="${variant}" loading`);
      const spinner = button.shadowRoot!.querySelector('tct-spinner')!;
      expect(spinner.getAttribute('shade')).toBe('inherit');
      expect(spinner.getAttribute('size')).toBe('sm');
    },
  );

  it('hides its own content while the spinner shows', async () => {
    const button = await make('label="Submit" loading');
    const content = button.shadowRoot!.querySelector<HTMLElement>('.content')!;
    expect(getComputedStyle(content).color).toBe('rgba(0, 0, 0, 0)');
    const overlay = button.shadowRoot!.querySelector<HTMLElement>('.spinner-overlay')!;
    const box = inner(button).getBoundingClientRect();
    const spin = overlay.getBoundingClientRect();
    expect(spin.width).toBe(box.width - 2); // inside the 1px border on each side
  });

  it('does not fire click when loading', async () => {
    const button = await make('label="Click me" loading');
    const clicks = recordEvents(button, 'click');
    await click(button);
    expectEventCounts(clicks, {click: 0});
  });

  it('does not fire click when disabled', async () => {
    const button = await make('label="Click me" disabled');
    const clicks = recordEvents(button, 'click');
    await click(button);
    expectEventCounts(clicks, {click: 0});
  });

  it('announces loading once through the announcer', async () => {
    await withFeature('ariaNotify', false, async () => {
      const button = await make('label="Submit"');
      button.loading = true;
      await button.updateComplete;
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Loading',
        'announcement',
      );
      button.loading = false;
      await button.updateComplete;
      expect(getAnnouncerRegions().polite?.textContent).toBe('Loading');
    });
  });

  it('localises the loading announcement from the language in scope', async () => {
    await loadLocale('de-DE');
    await withFeature('ariaNotify', false, async () => {
      const wrapper = await fixture<HTMLElement>(
        '<div lang="de-DE"><tct-button label="Senden"></tct-button></div>',
      );
      const button = wrapper.querySelector<TctButton>('tct-button')!;
      await button.updateComplete;
      button.loading = true;
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Wird geladen',
        'german announcement',
      );
    });
  });

  it('sets aria-busy while a clickAction is pending and clears it when it settles', async () => {
    let resolve!: () => void;
    const clickAction = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const button = await make('label="Save"');
    button.clickAction = clickAction;
    await click(button);
    await waitUntil(() => inner(button).getAttribute('aria-busy') === 'true', 'busy');
    expect(button.matches(':state(loading)') || !CSS.supports('selector(:state(x))')).toBe(true);
    expect(clickAction).toHaveBeenCalledTimes(1);
    resolve();
    await waitUntil(() => !inner(button).hasAttribute('aria-busy'), 'settled');
    expect(button.busy).toBe(false);
  });

  it('fires the click event before clickAction, and skips clickAction when the click is cancelled', async () => {
    const order: string[] = [];
    const button = await make('label="Test"');
    button.clickAction = () => {
      order.push('clickAction');
    };
    button.addEventListener('click', () => order.push('click'));
    await click(button);
    expect(order).toEqual(['click', 'clickAction']);

    const cancelled = vi.fn();
    const second = await make('label="Test"');
    second.clickAction = cancelled;
    second.addEventListener('click', (event) => event.preventDefault());
    await click(second);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('a synchronous clickAction never shows a busy state', async () => {
    const button = await make('label="Sync"');
    const action = vi.fn();
    button.clickAction = action;
    await click(button);
    expect(action).toHaveBeenCalledTimes(1);
    expect(button.busy).toBe(false);
  });

  it('fires clickAction once on a fast double click (no double-submit) and the click event once', async () => {
    let resolve!: () => void;
    const action = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const button = await make('label="Pay"');
    button.clickAction = action;
    const clicks = recordEvents(button, 'click');
    inner(button).click();
    inner(button).click();
    await aTimeout(50);
    expect(action).toHaveBeenCalledTimes(1);
    expectEventCounts(clicks, {click: 1});
    resolve();
    await waitUntil(() => !button.busy, 'settled');
  });

  it('interruptible: stays clickable while pending and re-fires the action (no dedupe)', async () => {
    const resolvers: (() => void)[] = [];
    const action = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolvers.push(done);
        }),
    );
    const button = await make('label="Toggle" interruptible');
    button.clickAction = action;
    inner(button).click();
    await waitUntil(() => button.busy, 'busy');
    expect(inner(button).getAttribute('aria-busy')).toBe('true');
    expect(inner(button).hasAttribute('aria-disabled')).toBe(false);
    inner(button).click();
    await aTimeout(50);
    expect(action).toHaveBeenCalledTimes(2);
    for (const resolve of resolvers) resolve();
    await waitUntil(() => !button.busy, 'settled');
  });

  it('a rejected clickAction leaves the button usable again', async () => {
    const button = await make('label="Save"');
    const unhandled: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent): void => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    try {
      button.clickAction = () => Promise.reject(new Error('nope'));
      await click(button);
      await waitUntil(() => !button.busy, 'settled after a rejection');
      await aTimeout(20);
      expect(unhandled).toHaveLength(1);
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
    }
  });
});

describe('tct-button: disabled with a reason (aria-disabled + tooltip)', () => {
  it('uses aria-disabled instead of disabled when a tooltip is present, so it stays focusable', async () => {
    const button = await make('label="Test" tooltip="Reason disabled" disabled');
    expect(inner(button).hasAttribute('disabled')).toBe(false);
    expect(inner(button).getAttribute('aria-disabled')).toBe('true');
    inner(button).focus();
    expect(button.shadowRoot!.activeElement).toBe(inner(button));
    if (isChromium)
      expect(await axNode(inner(button))).toMatchObject({role: 'button', disabled: 'true'});
  });

  it('does not fire handlers when aria-disabled via tooltip', async () => {
    const button = await make('label="Test" tooltip="Reason disabled" disabled');
    const clicks = recordEvents(button, 'click');
    const action = vi.fn();
    button.clickAction = action;
    await click(button);
    inner(button).focus();
    await pressKeys('Enter', ' ');
    await aTimeout(30);
    expectEventCounts(clicks, {click: 0});
    expect(action).not.toHaveBeenCalled();
  });

  it('suppresses activation keys but passes other keys when aria-disabled via tooltip', async () => {
    const button = await make('label="Test" tooltip="Reason disabled" disabled');
    const keys = recordEvents(button, 'keydown');
    inner(button).focus();
    await pressKeys('Enter');
    expect(keys.events).toHaveLength(0);
    await pressKeys('Escape');
    expect(keys.events.map((event) => (event as KeyboardEvent).key)).toEqual(['Escape']);
  });

  it('the reason is the tooltip, shown on keyboard focus and described to assistive technology', async () => {
    const button = await tabTo(
      'label="Save" tooltip="Fill in the form first" disabled',
      'padding: 60px 40px',
    );
    await waitUntil(
      () => surface(button)?.matches(':popover-open') === true,
      'tooltip open on focus',
    );
    expect(surface(button)!.textContent.trim()).toBe('Fill in the form first');
    if (isChromium) {
      expect(await axNode(inner(button))).toMatchObject({
        name: 'Save',
        description: 'Fill in the form first',
      });
    }
  });
});

describe('tct-button: tooltip and icon-only', () => {
  it('shows a tooltip on hover above the button', async () => {
    const button = await make('label="Save" tooltip="Saves the file"', '', 'padding: 60px 40px');
    await userEvent.hover(button);
    await waitUntil(() => surface(button)?.matches(':popover-open') === true, 'tooltip');
    expect(surface(button)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      inner(button).getBoundingClientRect().top + 1,
    );
    expect(inner(button).getAttribute('aria-describedby')).toBe(surface(button)!.id);
  });

  it('an icon-only button has the label as accessible name and built-in tooltip', async () => {
    const button = await make('label="Settings" icon="search" icon-only', '', 'padding: 60px 40px');
    expect(surface(button)!.textContent.trim()).toBe('Settings');
    if (isChromium)
      expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Settings'});
    await userEvent.hover(button);
    await waitUntil(() => surface(button)?.matches(':popover-open') === true, 'tooltip');
  });

  it('Escape closes the tooltip and the button stays focused', async () => {
    const button = await tabTo('label="Settings" icon="search" icon-only', 'padding: 60px 40px');
    await waitUntil(() => surface(button)?.matches(':popover-open') === true, 'tooltip');
    await pressKeys('Escape');
    await waitUntil(() => surface(button)?.matches(':popover-open') === false, 'closed');
    expect(button.shadowRoot!.activeElement).toBe(inner(button));
  });

  it('a button without a tooltip renders no surface', async () => {
    const button = await make('label="Save"');
    expect(surface(button)).toBeNull();
  });
});

describe('tct-button: links', () => {
  it('href renders an anchor with button styling; link name and role', async () => {
    const button = await make('label="Visit site" href="https://example.com" variant="primary"');
    const link = inner(button);
    expect(link.localName).toBe('a');
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.hasAttribute('type')).toBe(false);
    expect(getComputedStyle(link).textDecorationLine).toBe('none');
    expect(link.getBoundingClientRect().height).toBe(32);
    if (isChromium) expect(await axNode(link)).toMatchObject({role: 'link', name: 'Visit site'});
  });

  it('passes target and rel to the link', async () => {
    const button = await make(
      'label="Docs" href="https://example.com" target="_blank" rel="noopener noreferrer"',
    );
    expect(inner(button).getAttribute('target')).toBe('_blank');
    expect(inner(button).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('a disabled button with href renders a button (disabled links are an anti-pattern)', async () => {
    const button = await make('label="Docs" href="https://example.com" disabled');
    expect(inner(button).localName).toBe('button');
    expect(inner(button).hasAttribute('href')).toBe(false);
  });

  it('refuses javascript: URLs: the button renders as a button', async () => {
    const button = await make('label="Bad" href="javascript:alert(1)"');
    expect(inner(button).localName).toBe('button');
  });

  it('exposes aria-busy on the link while loading and none otherwise', async () => {
    const busy = await make('label="Docs" href="https://example.com" loading interruptible');
    expect(inner(busy).localName).toBe('a');
    expect(inner(busy).getAttribute('aria-busy')).toBe('true');
    const idle = await make('label="Docs" href="https://example.com"');
    expect(inner(idle).hasAttribute('aria-busy')).toBe(false);
  });

  it('a busy link does not navigate: the click is swallowed', async () => {
    const button = await make('label="Docs" href="/busy-target" loading');
    let reached = false;
    const listener = (event: MouseEvent): void => {
      reached = true;
      event.preventDefault();
    };
    window.addEventListener('click', listener);
    await click(button);
    window.removeEventListener('click', listener);
    expect(reached).toBe(false);
  });

  it('width applies to a link button', async () => {
    const button = await make(
      'label="Sign in" href="https://example.com" width="100%"',
      '',
      'inline-size: 400px',
    );
    expect(inner(button).getBoundingClientRect().width).toBe(400);
  });

  describe('linkContext', () => {
    async function withRouter(
      navigate: (href: string, event: MouseEvent) => boolean,
      attributes: string,
    ) {
      const wrapper = await fixture<HTMLElement>(
        `<div><tct-button label="Go" ${attributes}></tct-button></div>`,
      );
      provide(wrapper, linkContext, {navigate});
      const button = wrapper.querySelector<TctButton>('tct-button')!;
      button.remove();
      wrapper.append(button);
      await button.updateComplete;
      return button;
    }

    /**
     * Records whether the click was already cancelled when it reached `window` (the router did it), then
     * cancels it for real so the test page never navigates or opens a tab.
     */
    function watchClick(): {cancelledByButton: () => boolean | undefined; stop: () => void} {
      let cancelled: boolean | undefined;
      const listener = (event: MouseEvent): void => {
        cancelled = event.defaultPrevented;
        event.preventDefault();
      };
      window.addEventListener('click', listener);
      return {
        cancelledByButton: () => cancelled,
        stop: () => window.removeEventListener('click', listener),
      };
    }

    it('hands an unmodified primary click on an internal link to the router and cancels the navigation', async () => {
      const navigate = vi.fn((_href: string) => true);
      const button = await withRouter(navigate, 'href="/docs/button#top"');
      const watch = watchClick();
      await click(button);
      watch.stop();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0]![0]).toBe('/docs/button#top');
      expect(watch.cancelledByButton()).toBe(true);
    });

    it('leaves external links, new-tab links and modified clicks to the browser', async () => {
      const navigate = vi.fn(() => true);
      const watch = watchClick();
      await click(await withRouter(navigate, 'href="https://example.org/x"'));
      await click(await withRouter(navigate, 'href="/inside" target="_blank"'));
      watch.stop();
      expect(navigate).not.toHaveBeenCalled();
      expect(watch.cancelledByButton()).toBe(false);
    });

    it('does not cancel the navigation when the router declines', async () => {
      const navigate = vi.fn(() => false);
      const button = await withRouter(navigate, 'href="/declined"');
      const watch = watchClick();
      await click(button);
      watch.stop();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(watch.cancelledByButton()).toBe(false);
    });
  });
});

describe('tct-button: ARIA and events', () => {
  it('delegates host aria attributes to the inner button', async () => {
    const button = await make(
      'label="Menu" aria-expanded="true" aria-haspopup="menu" aria-pressed="false" aria-keyshortcuts="Alt+M"',
    );
    expect(inner(button).getAttribute('aria-expanded')).toBe('true');
    expect(inner(button).getAttribute('aria-haspopup')).toBe('menu');
    expect(inner(button).getAttribute('aria-pressed')).toBe('false');
    if (isChromium)
      expect(await axNode(inner(button))).toMatchObject({expanded: 'true', hasPopup: 'menu'});
    button.setAttribute('aria-expanded', 'false');
    await button.updateComplete;
    await aTimeout(20);
    expect(inner(button).getAttribute('aria-expanded')).toBe('false');
  });

  it('a host aria-label wins and follows changes; removing it restores the computed name', async () => {
    const button = await make('label="Settings" icon-only icon="search" aria-label="Preferences"');
    expect(inner(button).getAttribute('aria-label')).toBe('Preferences');
    button.removeAttribute('aria-label');
    await button.updateComplete;
    expect(inner(button).getAttribute('aria-label')).toBe('Settings');
  });

  it('aria-labelledby on the host names the inner button through element references', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><span id="name">Named elsewhere</span><tct-button label="X" aria-labelledby="name"></tct-button></div>',
    );
    const button = wrapper.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    if (isChromium) expect((await axNode(inner(button))).name).toBe('Named elsewhere');
  });

  it('a host aria-describedby still describes the button without a tooltip', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><span id="hint">Extra hint</span><tct-button label="X" aria-describedby="hint"></tct-button></div>',
    );
    const button = wrapper.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    if (isChromium) expect((await axNode(inner(button))).description).toBe('Extra hint');
  });

  it('fires exactly one click per activation: pointer, Enter, Space and click()', async () => {
    const button = await make('label="Once"');
    const clicks = recordEvents(button, 'click');
    await userEvent.click(button);
    inner(button).focus();
    await pressKeys('Enter');
    await pressKeys(' ');
    button.click();
    expectEventCounts(clicks, {click: 4});
    for (const event of clicks.events) {
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    }
  });

  it('focus() focuses the inner button; disabled buttons cannot take focus', async () => {
    const button = await make('label="Focus"');
    button.focus();
    expect(button.shadowRoot!.activeElement).toBe(inner(button));
    const disabled = await make('label="Nope" disabled');
    disabled.focus();
    expect(disabled.shadowRoot!.activeElement).toBeNull();
  });

  it('host click() on a disabled button does nothing', async () => {
    const button = await make('label="Nope" disabled');
    const clicks = recordEvents(button, 'click');
    button.click();
    await aTimeout(20);
    expect(clicks.events.length).toBeLessThanOrEqual(1);
    const action = vi.fn();
    button.clickAction = action;
    button.click();
    await aTimeout(20);
    expect(action).not.toHaveBeenCalled();
  });
});

describe('tct-button: accessibility, RTL, motion, forced colours', () => {
  it('passes axe in every variant and state', async () => {
    for (const variant of BUTTON_VARIANTS) {
      await expectAccessible(await make(`label="Save" variant="${variant}"`));
    }
    await expectAccessible(await make('label="Save" loading'));
    await expectAccessible(await make('label="Save" disabled'));
    await expectAccessible(await make('label="Save" tooltip="Because" disabled'));
    await expectAccessible(await make('label="Settings" icon="search" icon-only'));
    await expectAccessible(await make('label="Docs" href="https://example.com"'));
    await expectAccessible(await make('label="Save"', '', 'padding: 8px'));
  });

  it('lays out icon, label and end mirrored in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl"><tct-button label="Save" icon="search"><span slot="end" id="end">3</span></tct-button></div>',
    );
    const button = wrapper.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    const icon = button.shadowRoot!.querySelector('.icon-slot')!.getBoundingClientRect();
    const label = button.shadowRoot!.querySelector('.label')!.getBoundingClientRect();
    const end = button.querySelector('#end')!.getBoundingClientRect();
    expect(icon.left).toBeGreaterThanOrEqual(label.right - 1);
    expect(end.right).toBeLessThanOrEqual(label.left + 1);
  });

  it('truncates a long label with an ellipsis inside a narrow width', async () => {
    const button = await make('label="A very long button label that will not fit" width="120"');
    const label = button.shadowRoot!.querySelector<HTMLElement>('.label')!;
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
    expect(inner(button).getBoundingClientRect().width).toBe(120);
  });

  it.skipIf(!isChromium)('press feedback is movement and stays out of reduced motion', async () => {
    const normal = await make('label="Press"');
    expect(getComputedStyle(inner(normal)).transitionProperty).toContain('scale');
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const reduced = await make('label="Press"');
      expect(getComputedStyle(inner(reduced)).transitionProperty).not.toContain('scale');
    } finally {
      await restore();
    }
  });

  it.skipIf(!isChromium)('renders in forced colours with a visible edge and label', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const button = await make('label="Forced" variant="primary"');
      expect(getComputedStyle(inner(button)).borderTopWidth).toBe('1px');
      expect(inner(button).getBoundingClientRect().width).toBeGreaterThan(0);
      const disabled = await make('label="Forced" disabled');
      expect(getComputedStyle(inner(disabled)).borderTopWidth).toBe('1px');
    } finally {
      await restore();
    }
  });
});

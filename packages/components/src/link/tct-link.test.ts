/**
 * tct-link: ported from upstream Link.test.tsx (rendering, button fallback, disabled, external, rel,
 * click, tooltip, pressed state) plus the router hand-off, the URL policy, keyboard and accessibility.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {
  interactiveRoleContext,
  linkContext,
  type LinkContextValue,
} from '@tecton-wc/core/context/keys.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runKeyboardSuite} from '@tecton-wc/testing/suites/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import parity from './parity.json' with {type: 'json'};
import {computeTargetAndRel} from './link.rel.js';
import type {TctLink} from './tct-link.js';

/** Stands in for `tct-link-provider`: provides a router hook and, optionally, an interactive-role override. */
class TctTestContext extends TctElement {
  static override readonly tagName = 'tct-test-context';
  readonly calls: {href: string; event: MouseEvent}[] = [];
  handled = true;
  readonly router = new ContextProvider(this, {
    context: linkContext,
    initialValue: {
      navigate: (href, event) => {
        this.calls.push({href, event});
        return this.handled;
      },
    } satisfies LinkContextValue,
  });
  readonly interactive = new ContextProvider(this, {
    context: interactiveRoleContext,
    initialValue: false,
  });
  override render() {
    return html`<slot></slot>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'tct-test-context': TctTestContext;
  }
}
beforeAll(() => {
  defineElement(TctTestContext);
});

const controlOf = (link: TctLink): HTMLAnchorElement | HTMLButtonElement =>
  link.shadowRoot!.querySelector<HTMLAnchorElement | HTMLButtonElement>('.root')!;
const textOf = (link: TctLink): HTMLElement =>
  link.shadowRoot!.querySelector<HTMLElement>('tct-text')!;
const surfaceOf = (link: TctLink): HTMLElement | null =>
  link.shadowRoot!.querySelector<HTMLElement>('.tooltip-surface');

/** Mounts one link; its clicks never navigate the test page. */
async function make(attributes = '', content = 'Link', props: Partial<TctLink> = {}) {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding: 60px 80px"><tct-link ${attributes}>${content}</tct-link></div>`,
  );
  const link = wrapper.querySelector<TctLink>('tct-link')!;
  Object.assign(link, props);
  await link.updateComplete;
  const clicks: MouseEvent[] = [];
  link.addEventListener('click', (event) => {
    clicks.push(event);
    event.preventDefault();
  });
  return {link, clicks, wrapper};
}

/** The real mouse pointer stays where the last test left it; park it in an empty corner. */
async function parkPointer(): Promise<void> {
  const corner = document.createElement('div');
  corner.style.cssText =
    'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
  document.body.append(corner);
  await userEvent.hover(corner);
  corner.remove();
}

runElementSuite({
  tag: 'tct-link',
  render: () => `<tct-link href="/docs">Documentation</tct-link>`,
  properties: {
    href: '/settings',
    color: 'secondary',
    type: 'inherit',
    hasUnderline: true,
    external: true,
    tooltip: 'Settings',
  },
  attributes: {
    href: 'href',
    color: 'color',
    type: 'type',
    hasUnderline: 'has-underline',
    external: 'external',
    tooltip: 'tooltip',
  },
});

runKeyboardSuite({
  tag: 'tct-link',
  render: () =>
    `<button type="button">before</button><tct-link href="/docs">Docs</tct-link><tct-link>Action</tct-link><tct-link href="/off" disabled>Off</tct-link>`,
  table: parity.entries['core.link'].keyboard,
  steps: {
    'Moves focus to the link': {
      focus: (element) => element.previousElementSibling as HTMLElement,
      keys: ['Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(controlOf(element as TctLink));
      },
    },
    'Follows the link (Enter)': {
      setup: (element) => {
        (element as unknown as {clicks: number}).clicks = 0;
        element.addEventListener('click', (event) => {
          event.preventDefault(); // keep the test page where it is
          (element as unknown as {clicks: number}).clicks++;
        });
      },
      focus: (element) => controlOf(element as TctLink),
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element as unknown as {clicks: number}).clicks).toBe(1);
      },
    },
    'Activates the button form (Enter, Space)': {
      setup: (element) => {
        const action = element.nextElementSibling as TctLink;
        (action as unknown as {clicks: number}).clicks = 0;
        action.addEventListener('click', () => {
          (action as unknown as {clicks: number}).clicks++;
        });
      },
      focus: (element) => controlOf(element.nextElementSibling as TctLink),
      keys: ['Space'],
      expect: ({element}) => {
        expect((element.nextElementSibling as unknown as {clicks: number}).clicks).toBe(1);
      },
    },
    'Skips a disabled link': {
      focus: (element) => controlOf(element.nextElementSibling as TctLink),
      keys: ['Tab'],
      expect: ({element}) => {
        const off = element.nextElementSibling!.nextElementSibling as TctLink;
        expect(deepActiveElement()).not.toBe(controlOf(off));
        expect(off.shadowRoot!.contains(deepActiveElement())).toBe(false);
      },
    },
  },
});

describe('tct-link (Link.test.tsx)', () => {
  it('renders children as link text', async () => {
    const {link} = await make('href="/test"', 'Click me');
    expect(link.textContent).toBe('Click me');
    const slot = textOf(link).querySelector('slot')!;
    expect(slot.assignedNodes()[0]!.textContent).toBe('Click me');
  });

  it('renders with an href attribute on a native anchor', async () => {
    const {link} = await make('href="/test"');
    expect(controlOf(link).localName).toBe('a');
    expect(controlOf(link).getAttribute('href')).toBe('/test');
    if (isChromium) {
      const node = await axNode(controlOf(link));
      expect([node.role, node.name]).toEqual(['link', 'Link']);
    }
  });

  it('renders as a button when href is undefined', async () => {
    const {link} = await make('', 'Open');
    expect(controlOf(link).localName).toBe('button');
    expect(controlOf(link).getAttribute('type')).toBe('button');
    if (isChromium) expect((await axNode(controlOf(link))).role).toBe('button');
    link.href = '/x';
    await link.updateComplete;
    expect(controlOf(link).localName).toBe('a');
  });

  it('button fallback fires click', async () => {
    const {link, clicks} = await make('', 'Open');
    controlOf(link).click();
    expect(clicks).toHaveLength(1);
  });

  it('button fallback supports disabled', async () => {
    const {link, clicks} = await make('disabled', 'Open');
    const button = controlOf(link) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    expect(clicks).toHaveLength(0);
  });

  it('button fallback supports aria-label via the label property', async () => {
    const {link} = await make('label="Open the panel"', 'Open');
    expect(controlOf(link).getAttribute('aria-label')).toBe('Open the panel');
  });

  it('does not render aria-label when label is omitted', async () => {
    const {link} = await make('href="/test"');
    expect(controlOf(link).hasAttribute('aria-label')).toBe(false);
  });

  it('renders aria-label when the label property is provided', async () => {
    const {link} = await make(
      'label="Accessible label" href="/test"',
      '<span aria-hidden="true">home</span>',
    );
    expect(controlOf(link).getAttribute('aria-label')).toBe('Accessible label');
    if (isChromium) expect((await axNode(controlOf(link))).name).toBe('Accessible label');
  });

  it('lets a host aria-label win over label', async () => {
    const {link} = await make('label="A" aria-label="B" href="/t"');
    expect(controlOf(link).getAttribute('aria-label')).toBe('B');
    link.setAttribute('aria-label', 'C');
    await link.updateComplete;
    expect(controlOf(link).getAttribute('aria-label')).toBe('C');
  });

  it('renders with different color values', async () => {
    const {link} = await make('href="/test"');
    for (const color of ['accent', 'primary', 'secondary', 'disabled', 'placeholder', 'inherit']) {
      link.color = color;
      await link.updateComplete;
      expect(controlOf(link).dataset.color).toBe(color);
    }
  });

  it('paints accent as the primary text colour (Tecton) and inherit as the surrounding colour', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<p style="color: rgb(9, 8, 7)">
        <tct-link href="/a">accent</tct-link>
        <tct-link href="/b" color="primary">primary</tct-link>
        <tct-link href="/c" color="inherit">inherit</tct-link>
        <span id="probe" style="color: var(--color-text-primary)">p</span>
      </p>`,
    );
    const [accent, primary, inherit] = [...wrapper.querySelectorAll<TctLink>('tct-link')];
    await accent!.updateComplete;
    const expected = getComputedStyle(wrapper.querySelector('#probe')!).color;
    expect(getComputedStyle(controlOf(accent!)).color).toBe(expected);
    expect(getComputedStyle(controlOf(primary!)).color).toBe(expected);
    expect(getComputedStyle(controlOf(inherit!)).color).toBe('rgb(9, 8, 7)');
    // The text inside follows the link colour (one colour for text, underline and icon).
    expect(getComputedStyle(textOf(accent!).shadowRoot!.querySelector('.text')!).color).toBe(
      expected,
    );
  });

  it('defaults the inner text type to body', async () => {
    const {link} = await make('href="/test"', 'Body link');
    expect(link.type).toBe('body');
    expect(textOf(link).getAttribute('type')).toBe('body');
  });

  it('forwards type="inherit" so the link adopts the surrounding text type', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<p style="font-size: 22px; line-height: 30px">
        Read the <tct-link href="/terms" type="inherit">terms</tct-link> first.
      </p>`,
    );
    const link = wrapper.querySelector<TctLink>('tct-link')!;
    await link.updateComplete;
    expect(textOf(link).getAttribute('type')).toBe('inherit');
    const inner = textOf(link).shadowRoot!.querySelector('.text')!;
    expect(getComputedStyle(inner).fontSize).toBe('22px');
    expect(getComputedStyle(inner).lineHeight).toBe('30px');
  });

  it('forwards size, weight, display and max-lines to the text', async () => {
    const {link} = await make('href="/t" size="lg" weight="bold" display="block"', 'x');
    link.maxLines = 2;
    await link.updateComplete;
    const text = textOf(link) as HTMLElement & {maxLines: number};
    expect(text.getAttribute('size')).toBe('lg');
    expect(text.getAttribute('weight')).toBe('bold');
    expect(text.getAttribute('display')).toBe('block');
    expect(text.maxLines).toBe(2);
  });

  it('underlines on hover, and always with has-underline', async () => {
    await parkPointer();
    const {link} = await make('href="/test"', 'Underlined');
    expect(getComputedStyle(controlOf(link)).textDecorationLine).toBe('none');
    await userEvent.hover(controlOf(link));
    await waitUntil(
      () => getComputedStyle(controlOf(link)).textDecorationLine === 'underline',
      'underline on hover',
    );
    await parkPointer();
    link.hasUnderline = true;
    await link.updateComplete;
    expect(getComputedStyle(controlOf(link)).textDecorationLine).toBe('underline');
  });

  it('applies the disabled state', async () => {
    const {link} = await make('href="/test" disabled', 'Disabled Link');
    const anchor = controlOf(link);
    // An href-less anchor has no implicit link role.
    expect(anchor.localName).toBe('a');
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(anchor.getAttribute('tabindex')).toBe('-1');
    expect(getComputedStyle(anchor).opacity).toBe('0.5');
    expect(getComputedStyle(anchor).pointerEvents).toBe('none');
  });

  it('a disabled link has no href attribute', async () => {
    const {link} = await make('href="/test" disabled');
    expect(controlOf(link).hasAttribute('href')).toBe(false);
  });

  it('clicking a disabled link cancels default navigation and never reaches the host', async () => {
    const {link, clicks} = await make('href="/test" disabled');
    // A synthetic click bypasses pointer-events, like assistive technology or script activation.
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true});
    controlOf(link).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(clicks).toHaveLength(0);
  });

  it('a disabled link fires neither navigation nor the consumer click handler', async () => {
    const {link, clicks} = await make('href="/test" disabled');
    controlOf(link).click();
    expect(clicks).toHaveLength(0);
    expect(controlOf(link).hasAttribute('href')).toBe(false);
  });

  it('a disabled link omits target and rel', async () => {
    const {link} = await make('href="https://example.com" disabled external', 'Disabled External');
    expect(controlOf(link).hasAttribute('target')).toBe(false);
    expect(controlOf(link).hasAttribute('rel')).toBe(false);
  });

  it('a disabled link never asks the router to navigate', async () => {
    const wrapper = await fixture<TctTestContext>(
      html`<tct-test-context><tct-link href="/custom" disabled>Off</tct-link></tct-test-context>`,
    );
    const link = wrapper.querySelector<TctLink>('tct-link')!;
    await link.updateComplete;
    controlOf(link).click();
    expect(wrapper.calls).toHaveLength(0);
    expect(controlOf(link).hasAttribute('href')).toBe(false);
  });

  it('renders an external link with icon and target="_blank"', async () => {
    const {link} = await make('href="https://example.com" external', 'External Link');
    const anchor = controlOf(link);
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    const icon = anchor.querySelector('tct-icon')!;
    expect(icon).not.toBeNull();
    await (icon as unknown as {updateComplete: Promise<unknown>}).updateComplete;
    expect(icon.shadowRoot!.querySelector('svg')).not.toBeNull();
    const box = icon.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([12, 12]);
  });

  it('announces the new-tab context via screen-reader text (obs-4)', async () => {
    const {link} = await make('href="https://example.com" external', 'Docs');
    if (isChromium) {
      expect((await axNode(controlOf(link))).name).toBe('Docs (opens in new tab)');
    }
    const hint = controlOf(link).querySelector('.visually-hidden')!;
    expect(hint.textContent).toBe('(opens in new tab)');
  });

  it('supports a custom new-tab-label for localisation', async () => {
    const {link} = await make(
      'href="https://example.com" external new-tab-label="(new window)"',
      'Docs',
    );
    if (isChromium) expect((await axNode(controlOf(link))).name).toBe('Docs (new window)');
  });

  it('localises the default new-tab hint with the language of the element', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<tct-link href="https://example.com" external>Docs</tct-link>`,
      {lang: 'de'},
    );
    const link = wrapper as TctLink;
    await waitUntil(
      () =>
        !controlOf(link).querySelector('.visually-hidden')!.textContent.includes('opens in new'),
      'German new-tab hint',
    );
  });

  it('does not add new-tab text to non-external links', async () => {
    const {link} = await make('href="/internal"', 'Internal');
    expect(controlOf(link).querySelector('.visually-hidden')).toBeNull();
    expect(controlOf(link).querySelector('tct-icon')).toBeNull();
    if (isChromium) expect((await axNode(controlOf(link))).name).toBe('Internal');
  });

  it('merges an existing rel into an external link', async () => {
    const {link} = await make('href="https://example.com" external rel="sponsored"');
    expect(controlOf(link).getAttribute('rel')).toBe('sponsored noopener noreferrer');
  });

  it('renders a custom target without external', async () => {
    const {link} = await make('href="/test" target="_parent"');
    expect(controlOf(link).getAttribute('target')).toBe('_parent');
    expect(controlOf(link).querySelector('tct-icon')).toBeNull();
  });

  it('adds safe rel tokens for an explicit target="_blank"', async () => {
    const {link} = await make('href="/test" target="_blank"');
    expect(controlOf(link).getAttribute('target')).toBe('_blank');
    expect(controlOf(link).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('preserves existing rel tokens for an explicit target="_blank"', async () => {
    const {link} = await make('href="/test" target="_blank" rel="sponsored noopener"');
    expect(controlOf(link).getAttribute('rel')).toBe('sponsored noopener noreferrer');
  });

  it('passes download (with or without a file name) and referrer-policy to the anchor', async () => {
    const {link} = await make('href="/file.pdf" download referrer-policy="no-referrer"');
    expect(link.download).toBe(true);
    expect(controlOf(link).getAttribute('download')).toBe('');
    expect(controlOf(link).getAttribute('referrerpolicy')).toBe('no-referrer');
    link.download = 'report.pdf';
    await link.updateComplete;
    expect(controlOf(link).getAttribute('download')).toBe('report.pdf');
    link.download = false;
    await link.updateComplete;
    expect(controlOf(link).hasAttribute('download')).toBe(false);
  });

  it('handles click events (retargeted from the inner anchor)', async () => {
    const {link, clicks} = await make('href="/test"', 'Click me');
    await userEvent.click(controlOf(link));
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.target).toBe(link);
  });

  it('exposes the inner element as control (upstream ref)', async () => {
    const {link} = await make('href="/test"');
    expect(link.control).toBe(controlOf(link));
    expect(link.control).toBeInstanceOf(HTMLAnchorElement);
  });

  it('renders a standalone link with the body size and leading', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="font-size: 30px; line-height: 40px">
        <tct-link href="/standalone" standalone>Standalone</tct-link>
        <tct-link href="/inline">Inline</tct-link>
      </div>`,
    );
    const [standalone, inline] = [...wrapper.querySelectorAll<TctLink>('tct-link')];
    await standalone!.updateComplete;
    const probe = document.createElement('span');
    probe.style.fontSize = 'var(--text-body-size)';
    wrapper.append(probe);
    const bodySize = getComputedStyle(probe).fontSize;
    probe.remove();
    expect(getComputedStyle(controlOf(standalone!)).fontSize).toBe(bodySize);
    expect(getComputedStyle(controlOf(inline!)).fontSize).toBe('30px');
  });

  it('exposes the theming hooks: base part and data-color', async () => {
    const {link} = await make('href="/test" color="secondary"');
    expect(controlOf(link).getAttribute('part')).toBe('base');
    expect(controlOf(link).dataset.color).toBe('secondary');
    expect(textOf(link).getAttribute('part')).toBe('text');
  });

  it('is decorated with the pressed overlay only while enabled', async () => {
    const {link} = await make('href="/docs"');
    const styles = (link.constructor as unknown as {elementStyles: {cssText: string}[]})
      .elementStyles;
    const css = styles.map((style) => style.cssText).join('\n');
    expect(css).toMatch(/:active:where\(:not\(\[aria-disabled=["']?true["']?\]\)\)/);
    expect(css).toContain('--color-overlay-pressed');
  });
});

describe('tct-link: interactive role and URL policy', () => {
  it('renders as a button inside a container that asks for a button, when its destination is not live', async () => {
    const wrapper = await fixture<TctTestContext>(
      html`<tct-test-context><tct-link href="/x" disabled>Off</tct-link></tct-test-context>`,
    );
    wrapper.interactive.setValue(true);
    const link = wrapper.querySelector<TctLink>('tct-link')!;
    await waitUntil(() => controlOf(link).localName === 'button', 'button form');
    // A live href still wins: navigation always wins over the container's request.
    link.disabled = false;
    await link.updateComplete;
    expect(controlOf(link).localName).toBe('a');
  });

  it('renders an anchor without href for an unsafe destination', async () => {
    for (const href of [
      'javascript:alert(1)',
      'vbscript:MsgBox(1)',
      'data:text/html,<script>1</script>',
      ' \u0000JaVa\tsCrIpT:alert(1)',
    ]) {
      const {link} = await make('', 'Bad');
      link.href = href;
      await link.updateComplete;
      expect(controlOf(link).localName).toBe('a');
      expect(controlOf(link).hasAttribute('href'), href).toBe(false);
    }
  });

  it('accepts safe destinations: relative, mailto, tel, https', async () => {
    for (const href of [
      '/a/b',
      '#top',
      'mailto:hi@example.com',
      'tel:+123',
      'https://example.com/x',
    ]) {
      const {link} = await make(`href="${href}"`);
      expect(controlOf(link).hasAttribute('href'), href).toBe(true);
    }
  });

  it('computeTargetAndRel leaves other targets alone', () => {
    expect(computeTargetAndRel(undefined, 'sponsored')).toEqual({
      target: undefined,
      rel: 'sponsored',
    });
    expect(computeTargetAndRel('_self', undefined)).toEqual({target: '_self', rel: undefined});
    expect(computeTargetAndRel('_blank', undefined)).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });
});

describe('tct-link: router hand-off (tct-link-provider)', () => {
  const mount = async (attributes = '') => {
    const wrapper = await fixture<TctTestContext>(
      `<tct-test-context><tct-link ${attributes}>Docs</tct-link></tct-test-context>`,
    );
    const link = wrapper.querySelector<TctLink>('tct-link')!;
    await link.updateComplete;
    return {wrapper, link};
  };

  it('hands a plain primary click on an internal link to the router and cancels the navigation', async () => {
    const {wrapper, link} = await mount('href="/docs"');
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true});
    controlOf(link).dispatchEvent(event);
    expect(wrapper.calls.map((call) => call.href)).toEqual(['/docs']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the navigation native when the router declines it', async () => {
    const {wrapper, link} = await mount('href="/docs"');
    wrapper.handled = false;
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true});
    link.addEventListener('click', (e) => e.preventDefault(), {once: true});
    controlOf(link).dispatchEvent(event);
    expect(wrapper.calls).toHaveLength(1);
  });

  it('ignores modified and middle clicks', async () => {
    const {wrapper, link} = await mount('href="/docs"');
    link.addEventListener('click', (e) => e.preventDefault());
    for (const init of [
      {metaKey: true},
      {ctrlKey: true},
      {shiftKey: true},
      {altKey: true},
      {button: 1},
    ]) {
      controlOf(link).dispatchEvent(
        new MouseEvent('click', {bubbles: true, cancelable: true, composed: true, ...init}),
      );
    }
    expect(wrapper.calls).toHaveLength(0);
  });

  it('does not route external, targeted, download or cross-origin links', async () => {
    for (const attributes of [
      'href="/docs" external',
      'href="/docs" target="_blank"',
      'href="/docs" download',
      'href="https://elsewhere.example/docs"',
    ]) {
      const {wrapper, link} = await mount(attributes);
      link.addEventListener('click', (e) => e.preventDefault());
      controlOf(link).dispatchEvent(
        new MouseEvent('click', {bubbles: true, cancelable: true, composed: true}),
      );
      expect(wrapper.calls, attributes).toHaveLength(0);
    }
  });

  it('routes a same-origin absolute URL and honours target="_self"', async () => {
    const {wrapper, link} = await mount(`href="${location.origin}/docs" target="_self"`);
    controlOf(link).dispatchEvent(
      new MouseEvent('click', {bubbles: true, cancelable: true, composed: true}),
    );
    expect(wrapper.calls).toHaveLength(1);
  });

  it('does not route the button form', async () => {
    const {wrapper, link} = await mount();
    link.addEventListener('click', (e) => e.preventDefault());
    controlOf(link).click();
    expect(wrapper.calls).toHaveLength(0);
  });

  it('works without a provider (native navigation)', async () => {
    const {link, clicks} = await make('href="/docs"');
    controlOf(link).click();
    expect(clicks).toHaveLength(1);
  });

  it('stops asking a router that was removed', async () => {
    const {wrapper, link} = await mount('href="/docs"');
    document.body.append(link);
    link.addEventListener('click', (e) => e.preventDefault());
    controlOf(link).click();
    expect(wrapper.calls).toHaveLength(0);
    link.remove();
  });
});

describe('tct-link: tooltip', () => {
  beforeEach(parkPointer);
  const isOpen = (link: TctLink): boolean => surfaceOf(link)?.matches(':popover-open') ?? false;

  it('renders no surface without a tooltip', async () => {
    const {link} = await make('href="/settings"', 'Settings');
    expect(surfaceOf(link)).toBeNull();
    expect(controlOf(link).hasAttribute('aria-describedby')).toBe(false);
  });

  it('renders a link with a tooltip that describes it, keeping the name', async () => {
    const {link} = await make('href="/settings" tooltip="Configure settings"', 'Settings');
    const surface = surfaceOf(link)!;
    expect(surface.textContent.trim()).toBe('Configure settings');
    expect(surface.getAttribute('role')).toBe('tooltip');
    expect(controlOf(link).getAttribute('aria-describedby')).toBe(surface.id);
    if (isChromium) {
      const node = await axNode(controlOf(link));
      expect([node.role, node.name]).toEqual(['link', 'Settings']);
    }
  });

  it('shows above the link on hover and on keyboard focus, and Escape closes it', async () => {
    const {link, wrapper} = await make('href="/settings" tooltip="Configure"', 'Settings');
    await userEvent.hover(controlOf(link));
    await waitUntil(() => isOpen(link), 'tooltip open on hover');
    expect(surfaceOf(link)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      controlOf(link).getBoundingClientRect().top + 1,
    );
    await parkPointer();
    await waitUntil(() => !isOpen(link), 'tooltip closed');

    const before = document.createElement('button');
    wrapper.prepend(before);
    before.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(controlOf(link));
    await waitUntil(() => isOpen(link), 'tooltip open on focus');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(link), 'tooltip closed by Escape');
  });

  it('passes axe with the tooltip open', async () => {
    const {link, wrapper} = await make('href="/settings" tooltip="Configure"', 'Settings');
    await userEvent.hover(controlOf(link));
    await waitUntil(() => isOpen(link), 'tooltip open');
    await expectAccessible(wrapper);
  });
});

describe('tct-link: accessibility, direction and forced colours', () => {
  it('passes axe as a link, an external link, a button, a disabled link and with an icon label', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="display: grid; gap: 8px">
        <tct-link href="/docs">Documentation</tct-link>
        <tct-link href="https://example.com" external>Example</tct-link>
        <tct-link>Run the action</tct-link>
        <tct-link href="/off" disabled>Unavailable</tct-link>
        <tct-link href="/home" label="Home"><span aria-hidden="true">H</span></tct-link>
        <tct-link href="/docs" color="secondary" has-underline>Secondary</tct-link>
      </div>`,
    );
    await expectAccessible(wrapper);
  });

  it('places the external icon at the inline end in both directions', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const {link} = await (async () => {
        const wrapper = await fixture<HTMLElement>(
          html`<div style="padding: 20px">
            <tct-link href="https://e.com" external>Docs</tct-link>
          </div>`,
          {dir},
        );
        const element = wrapper.querySelector<TctLink>('tct-link')!;
        await element.updateComplete;
        return {link: element};
      })();
      const text = textOf(link).getBoundingClientRect();
      const icon = controlOf(link).querySelector('tct-icon')!.getBoundingClientRect();
      if (dir === 'ltr') expect(icon.left).toBeGreaterThanOrEqual(text.right - 1);
      else expect(icon.right).toBeLessThanOrEqual(text.left + 1);
    }
  });

  it.skipIf(!isChromium)('uses system colours in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-link href="/a">Live</tct-link>
        <tct-link href="/b" disabled>Off</tct-link>
      </div>`,
    );
    const [live, off] = [...wrapper.querySelectorAll<TctLink>('tct-link')];
    await live!.updateComplete;
    const probe = (color: string) => {
      const span = document.createElement('span');
      span.style.color = color;
      wrapper.append(span);
      const value = getComputedStyle(span).color;
      span.remove();
      return value;
    };
    expect(getComputedStyle(controlOf(live!)).color).toBe(probe('LinkText'));
    expect(getComputedStyle(controlOf(off!)).color).toBe(probe('GrayText'));
  });

  it('warns in dev for an unknown colour', async () => {
    const {resetDevWarnings} = await import('@tecton-wc/core/utils/dev.js');
    resetDevWarnings();
    globalThis.tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await make('href="/a" color="rainbow"');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      globalThis.tctDevMode = undefined;
      resetDevWarnings();
    }
  });

  it('truncates with max-lines inside a narrow container', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="inline-size: 100px">
        <tct-link href="/long" max-lines="1" display="block"
          >A link label far wider than the space it was given</tct-link
        >
      </div>`,
    );
    const link = wrapper.querySelector<TctLink>('tct-link')!;
    link.maxLines = 1;
    await link.updateComplete;
    expect(link.getBoundingClientRect().width).toBeLessThanOrEqual(100);
    expect(controlOf(link).getBoundingClientRect().width).toBeLessThanOrEqual(100);
  });
});

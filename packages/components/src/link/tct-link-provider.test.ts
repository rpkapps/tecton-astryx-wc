/**
 * tct-link-provider: the routing hook for the links below it (upstream LinkProvider / useLinkComponent
 * tests, re-expressed as a navigation hook), including the acceptance case: single-page navigation with no
 * document load.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import '../avatar/define.js';
import '../button/define.js';
import './define.js';
import type {TctAvatar} from '../avatar/tct-avatar.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctLink} from './tct-link.js';
import type {LinkNavigate, TctLinkProvider} from './tct-link-provider.js';

// `runElementSuite` asserts a shadow root after reconnecting, which a light-DOM provider by design has not
// (ARCHITECTURE §8: providers render nothing into the light DOM); the lifecycle checks it makes are
// repeated here without that assertion. Requested: a `shadow: false` option in the suite.
describe('tct-link-provider: element lifecycle', () => {
  it('is registered under its tag, and registering again is a no-op without warnings', async () => {
    const constructor = customElements.get('tct-link-provider')!;
    expect(constructor).toBeDefined();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const {defineElement} = await import('@tecton-wc/core/define.js');
      defineElement(constructor as Parameters<typeof defineElement>[0]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps navigate across reconnect', async () => {
    const navigate: LinkNavigate = () => true;
    const provider = document.createElement('tct-link-provider');
    provider.navigate = navigate;
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    wrapper.append(provider);
    await provider.updateComplete;
    provider.remove();
    wrapper.append(provider);
    await provider.updateComplete;
    expect(provider.navigate).toBe(navigate);
    expect(provider.isConnected).toBe(true);
    expect(provider.shadowRoot).toBeNull();
  });

  it('fires no events on property writes and carries no box or semantics', async () => {
    const {provider} = await mount(() => true);
    const events: string[] = [];
    for (const type of ['input', 'change', 'tct-change']) {
      provider.addEventListener(type, () => events.push(type));
    }
    provider.navigate = () => false;
    await provider.updateComplete;
    expect(events).toEqual([]);
    expect(provider.getAttribute('role')).toBeNull();
    expect(provider.hasAttribute('tabindex')).toBe(false);
  });
});

const anchorOf = (link: TctLink): HTMLAnchorElement => link.control as HTMLAnchorElement;
const clickEvent = (init: MouseEventInit = {}): MouseEvent =>
  new MouseEvent('click', {bubbles: true, cancelable: true, composed: true, ...init});

/** Mounts a provider around one link with the given attributes. */
async function mount(
  navigate: LinkNavigate | undefined,
  attributes = {href: '/docs'} as Record<string, string>,
) {
  const wrapper = await fixture<HTMLElement>(
    html`<tct-link-provider .navigate=${navigate}><tct-link>Docs</tct-link></tct-link-provider>`,
  );
  const provider = wrapper as unknown as TctLinkProvider;
  const link = provider.querySelector<TctLink>('tct-link')!;
  for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
  await link.updateComplete;
  return {provider, link};
}

describe('tct-link-provider (LinkProvider.test.tsx / useLinkComponent.test.tsx)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders no shadow root and no box of its own: children stay in the light DOM', async () => {
    const {provider, link} = await mount(() => true);
    expect(provider.shadowRoot).toBeNull();
    expect(link.parentElement).toBe(provider);
    expect(provider.children).toHaveLength(1);
  });

  it('offers a plain click on an internal link to navigate and cancels the native navigation', async () => {
    const calls: string[] = [];
    const {link} = await mount((href) => {
      calls.push(href);
      return true;
    });
    const event = clickEvent();
    anchorOf(link).dispatchEvent(event);
    expect(calls).toEqual(['/docs']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the navigation native when navigate returns false or is not set', async () => {
    for (const navigate of [undefined, () => false] as const) {
      const {link} = await mount(navigate);
      link.addEventListener('click', (event) => event.preventDefault()); // keep the test page
      const event = clickEvent();
      anchorOf(link).dispatchEvent(event);
      // The only preventDefault is the listener above: the provider did not claim the click.
      expect(event.defaultPrevented).toBe(true);
    }
    const {link} = await mount(() => false);
    const seen: boolean[] = [];
    link.addEventListener('click', (event) => {
      seen.push(event.defaultPrevented);
      event.preventDefault();
    });
    anchorOf(link).dispatchEvent(clickEvent());
    expect(seen).toEqual([false]);
  });

  it('reads navigate at click time: it can be set and replaced after mount', async () => {
    const {provider, link} = await mount(undefined);
    link.addEventListener('click', (event) => event.preventDefault());
    const first = vi.fn(() => true);
    provider.navigate = first;
    anchorOf(link).dispatchEvent(clickEvent());
    const second = vi.fn(() => true);
    provider.navigate = second;
    anchorOf(link).dispatchEvent(clickEvent());
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores modified and middle clicks, new-tab, download and cross-origin links', async () => {
    const navigate = vi.fn(() => true);
    const {link} = await mount(navigate);
    link.addEventListener('click', (event) => event.preventDefault());
    for (const init of [
      {metaKey: true},
      {ctrlKey: true},
      {shiftKey: true},
      {altKey: true},
      {button: 1},
    ]) {
      anchorOf(link).dispatchEvent(clickEvent(init));
    }
    const variants: Record<string, string>[] = [
      {external: ''},
      {target: '_blank'},
      {download: ''},
      {href: 'https://elsewhere.example/docs'},
    ];
    for (const attributes of variants) {
      for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
      await link.updateComplete;
      anchorOf(link).dispatchEvent(clickEvent());
      for (const name of Object.keys(attributes)) link.removeAttribute(name);
      link.setAttribute('href', '/docs');
      await link.updateComplete;
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never offers a refused destination to the router (no href, no navigation)', async () => {
    const navigate = vi.fn(() => true);
    const {link} = await mount(navigate, {href: 'javascript:alert(1)'});
    expect(anchorOf(link).hasAttribute('href')).toBe(false);
    anchorOf(link).dispatchEvent(clickEvent());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('nests: the nearest provider wins', async () => {
    const outer = vi.fn(() => true);
    const inner = vi.fn(() => true);
    const wrapper = await fixture<TctLinkProvider>(
      html`<tct-link-provider .navigate=${outer}>
        <tct-link href="/outer">Outer</tct-link>
        <tct-link-provider .navigate=${inner}>
          <tct-link href="/inner">Inner</tct-link>
        </tct-link-provider>
      </tct-link-provider>`,
    );
    const [outerLink, innerLink] = [...wrapper.querySelectorAll<TctLink>('tct-link')];
    await innerLink!.updateComplete;
    anchorOf(outerLink!).dispatchEvent(clickEvent());
    anchorOf(innerLink!).dispatchEvent(clickEvent());
    expect(outer).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledWith('/outer', expect.any(MouseEvent));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith('/inner', expect.any(MouseEvent));
  });

  it('serves links added after the fact and links moved into it', async () => {
    const navigate = vi.fn(() => true);
    const {provider} = await mount(navigate);
    const late = document.createElement('tct-link');
    late.setAttribute('href', '/late');
    provider.append(late);
    await late.updateComplete;
    anchorOf(late).dispatchEvent(clickEvent());
    expect(navigate).toHaveBeenCalledWith('/late', expect.any(MouseEvent));

    const outside = await fixture<HTMLElement>(
      html`<div><tct-link href="/moved">Moved</tct-link></div>`,
    );
    const moved = outside.querySelector<TctLink>('tct-link')!;
    await moved.updateComplete;
    provider.append(moved);
    await moved.updateComplete;
    anchorOf(moved).dispatchEvent(clickEvent());
    expect(navigate).toHaveBeenCalledWith('/moved', expect.any(MouseEvent));
  });

  it('routes link-form buttons and avatars too', async () => {
    const navigate = vi.fn(() => true);
    const wrapper = await fixture<TctLinkProvider>(
      html`<tct-link-provider .navigate=${navigate}>
        <tct-button href="/from-button">Go</tct-button>
        <tct-avatar name="Ada" href="/from-avatar"></tct-avatar>
      </tct-link-provider>`,
    );
    const button = wrapper.querySelector<TctButton>('tct-button')!;
    const avatar = wrapper.querySelector<TctAvatar>('tct-avatar')!;
    await Promise.all([button.updateComplete, avatar.updateComplete]);
    button.shadowRoot!.querySelector('a')!.dispatchEvent(clickEvent());
    avatar.control!.dispatchEvent(clickEvent());
    expect(navigate.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      '/from-button',
      '/from-avatar',
    ]);
  });

  it('single-page navigation: a real click updates the route with no document load', async () => {
    const start = location.href;
    const marker = `spa-${Math.random()}`;
    (window as unknown as Record<string, string>).__spaMarker = marker;
    try {
      const {link} = await mount(
        (href) => {
          history.pushState({}, '', href);
          return true;
        },
        {href: '/routed-page'},
      );
      await userEvent.click(anchorOf(link));
      expect(location.pathname).toBe('/routed-page');
      // The document was not replaced: what the page held before the click is still there.
      expect((window as unknown as Record<string, string>).__spaMarker).toBe(marker);
      expect(link.isConnected).toBe(true);
    } finally {
      history.replaceState({}, '', start);
      delete (window as unknown as Record<string, string>).__spaMarker;
    }
  });

  it('keeps a click retargeted to the link host for listeners', async () => {
    const {link} = await mount(() => true);
    const seen: EventTarget[] = [];
    link.addEventListener('click', (event) => seen.push(event.target!));
    anchorOf(link).dispatchEvent(clickEvent());
    expect(seen).toEqual([link]);
  });
});

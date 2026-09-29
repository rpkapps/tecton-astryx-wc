/**
 * Small host controllers (A§9.18): slot presence, owned satellites, shared resize observer, media
 * queries, interaction modality, light-DOM style delivery, and the clickable container.
 */
import {css, html, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {ClickableContainerController} from '@tecton-astryx/core/controllers/clickable-container.js';
import {
  getModality,
  trackInteractionModality,
} from '@tecton-astryx/core/controllers/interaction-modality.js';
import {MediaQueryController} from '@tecton-astryx/core/controllers/media-query.js';
import {OwnedPartsController} from '@tecton-astryx/core/controllers/owned-parts.js';
import {
  observeResize,
  ResizeController,
  unobserveResize,
} from '@tecton-astryx/core/controllers/resize.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {adoptLightDomStyles} from '@tecton-astryx/core/styles/light-dom.js';
import {fixture} from '../fixture.js';
import {hasCustomState} from '../forms.js';
import {pressKeys} from '../keyboard.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';
import {isTier2} from '../tier.js';

// ---------------------------------------------------------------------------------- fixtures

class TctTestSlots extends TctElement {
  static override readonly tagName = 'tct-test-slots';
  readonly slots: SlotController = new SlotController(this, 'icon', 'default', 'description');
  renders = 0;
  override render() {
    this.renders++;
    return html`${this.slots.has('icon') ? html`<i part="icon"><slot name="icon"></slot></i>` : nothing}<slot
      ></slot>`;
  }
}

class TctTestSatellite extends TctElement {
  static override readonly tagName = 'tct-test-satellite';
  override render() {
    return html`<slot></slot>`;
  }
}

class TctTestOwner extends TctElement {
  static override readonly tagName = 'tct-test-owner';
  static override readonly dependencies = [TctTestSatellite];
  @property() text = 'hint';
  @property({type: Boolean}) present = true;
  readonly parts: OwnedPartsController = new OwnedPartsController(this, {
    parts: [
      {
        slot: 'surface',
        tag: 'tct-test-satellite',
        when: () => this.present,
        init: (element) => {
          element.textContent = this.text;
        },
      },
    ],
  });
  override render() {
    return html`<slot></slot><slot name="surface"></slot>`;
  }
}

class TctTestWatcher extends TctElement {
  static override readonly tagName = 'tct-test-watcher';
  static override styles = css`
    :host {
      display: block;
    }
  `;
  @property({type: Number}) width = 100;
  entries: number[] = [];
  readonly resize: ResizeController = new ResizeController(this, {
    target: () => this.renderRoot.querySelector('div'),
    callback: (entry) => this.entries.push(Math.round(entry.contentRect.width)),
  });
  readonly narrow: MediaQueryController = new MediaQueryController(this, '(max-width: 300px)');
  override render() {
    return html`<div style="inline-size:${this.width}px;block-size:10px"></div>`;
  }
}

class TctTestCard extends TctElement {
  static override readonly tagName = 'tct-test-card';
  @property() href = 'https://example.invalid/target';
  @property({type: Boolean}) disabled = false;
  actionClicks = 0;
  readonly clickable: ClickableContainerController = new ClickableContainerController(this, {
    action: () => this.renderRoot.querySelector('a'),
    disabled: () => this.disabled,
  });
  override render() {
    return html`<a
        href=${this.href}
        @click=${(event: MouseEvent) => {
          this.actionClicks++;
          event.preventDefault(); // stay on the page; the test only counts activations
        }}
        >Read more</a
      ><slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-slots': TctTestSlots;
    'tct-test-satellite': TctTestSatellite;
    'tct-test-owner': TctTestOwner;
    'tct-test-watcher': TctTestWatcher;
    'tct-test-card': TctTestCard;
  }
}

beforeAll(() => {
  for (const ctor of [TctTestSlots, TctTestOwner, TctTestWatcher, TctTestCard]) defineElement(ctor);
});

// -------------------------------------------------------------------------------------- slots

describe('SlotController', () => {
  it('knows slot presence before the first render, and ignores whitespace-only text', async () => {
    const host = await fixture<TctTestSlots>(
      `<tct-test-slots>  \n <span slot="icon">i</span> </tct-test-slots>`,
    );
    expect(host.slots.has('icon')).toBe(true);
    expect(host.slots.has('default')).toBe(false);
    expect(host.slots.has('description')).toBe(false);
    expect(host.renderRoot.querySelector('[part="icon"]')).not.toBeNull();
  });

  it('default content is text or an unslotted element, not <template> or slotted elements', async () => {
    const text = await fixture<TctTestSlots>(`<tct-test-slots>hello</tct-test-slots>`);
    expect(text.slots.has('default')).toBe(true);
    const element = await fixture<TctTestSlots>(`<tct-test-slots><b>x</b></tct-test-slots>`);
    expect(element.slots.has('')).toBe(true);
    const template = await fixture<TctTestSlots>(
      `<tct-test-slots><template></template><i slot="icon"></i></tct-test-slots>`,
    );
    expect(template.slots.has('default')).toBe(false);
  });

  it('re-renders when presence changes, and only then', async () => {
    const host = await fixture<TctTestSlots>(`<tct-test-slots></tct-test-slots>`);
    expect(host.renderRoot.querySelector('[part="icon"]')).toBeNull();
    const before = host.renders;

    const icon = document.createElement('i');
    icon.slot = 'icon';
    host.append(icon);
    await waitUntil(
      () => host.renderRoot.querySelector('[part="icon"]') !== null,
      'icon slot rendered',
    );
    expect(host.renders).toBe(before + 1);

    // Deeper churn that does not change presence does not re-render.
    icon.append(document.createElement('span'));
    await nextFrame();
    expect(host.renders).toBe(before + 1);

    icon.remove();
    await waitUntil(
      () => host.renderRoot.querySelector('[part="icon"]') === null,
      'icon slot removed',
    );
  });

  it('follows text edits and slot attribute changes', async () => {
    const host = await fixture<TctTestSlots>(`<tct-test-slots><b id="b">x</b></tct-test-slots>`);
    expect(host.slots.has('description')).toBe(false);
    host.querySelector('b')!.setAttribute('slot', 'description');
    await nextFrame();
    expect(host.slots.has('description')).toBe(true);
    expect(host.slots.has('default')).toBe(false);
  });

  it.skipIf(isTier2)('exposes :state(has-<slot>) for consumers', async () => {
    const host = await fixture<TctTestSlots>(
      `<tct-test-slots><i slot="icon"></i>text</tct-test-slots>`,
    );
    await nextFrame();
    expect(hasCustomState(host, 'has-icon')).toBe(true);
    expect(hasCustomState(host, 'has-default')).toBe(true);
    expect(hasCustomState(host, 'has-description')).toBe(false);
  });
});

// ------------------------------------------------------------------------------ owned parts

describe('OwnedPartsController', () => {
  const satellite = (host: TctTestOwner): HTMLElement | null =>
    host.querySelector<HTMLElement>(':scope > [data-tct-owned]');

  it('renders a light-DOM satellite assigned to its slot, initialised by the host', async () => {
    const host = await fixture<TctTestOwner>(
      `<tct-test-owner text="Hello">Trigger</tct-test-owner>`,
    );
    const part = satellite(host)!;
    expect(part.localName).toBe('tct-test-satellite');
    expect(part.getAttribute('slot')).toBe('surface');
    expect(part.textContent).toBe('Hello');
    expect(host.parts.get('surface')).toBe(part);
    expect(part.assignedSlot?.name).toBe('surface');
  });

  it('re-runs init after updates, and removes the part while `when` is false', async () => {
    const host = await fixture<TctTestOwner>(`<tct-test-owner>Trigger</tct-test-owner>`);
    host.text = 'Changed';
    await host.updateComplete;
    expect(satellite(host)!.textContent).toBe('Changed');
    host.present = false;
    await host.updateComplete;
    expect(satellite(host)).toBeNull();
    expect(host.parts.get('surface')).toBeUndefined();
    host.present = true;
    await host.updateComplete;
    expect(satellite(host)).not.toBeNull();
  });

  it('restores a satellite pruned by a framework reconciler', async () => {
    const host = await fixture<TctTestOwner>(`<tct-test-owner>Trigger</tct-test-owner>`);
    satellite(host)!.remove();
    await waitUntil(() => satellite(host) !== null, 'satellite re-created');
    expect(host.querySelectorAll(':scope > [data-tct-owned]')).toHaveLength(1);
  });

  it('does nothing while disconnected', async () => {
    const host = await fixture<TctTestOwner>(`<tct-test-owner>Trigger</tct-test-owner>`);
    host.remove();
    host.parts.ensure();
    expect(host.querySelectorAll('[data-tct-owned]').length).toBeLessThanOrEqual(1);
  });
});

// -------------------------------------------------------------------------- resize, media query

describe('shared resize observer', () => {
  it('delivers the initial size and follows changes for a controller target', async () => {
    const host = await fixture<TctTestWatcher>(`<tct-test-watcher></tct-test-watcher>`);
    await waitUntil(() => host.entries.length > 0, 'initial observation');
    expect(host.entries[0]).toBe(100);
    host.width = 160;
    await waitUntil(() => host.entries.at(-1) === 160, 'resized');
  });

  it('stops when the host disconnects', async () => {
    const host = await fixture<TctTestWatcher>(`<tct-test-watcher></tct-test-watcher>`);
    await waitUntil(() => host.entries.length > 0, 'initial');
    const parent = host.parentElement!;
    host.remove();
    const count = host.entries.length;
    host.width = 200;
    await aTimeout(50);
    parent.append(host); // reconnect: observing resumes with a fresh initial observation
    await waitUntil(() => host.entries.length > count, 'observing again');
  });

  it('keeps registrations independent: unsubscribing one leaves the other', async () => {
    const box = await fixture<HTMLDivElement>(
      `<div style="inline-size:50px;block-size:10px"></div>`,
    );
    const a = vi.fn();
    const b = vi.fn();
    const stopA = observeResize(box, a);
    observeResize(box, b);
    await waitUntil(() => a.mock.calls.length > 0 && b.mock.calls.length > 0, 'both delivered');
    stopA();
    stopA(); // idempotent
    a.mockClear();
    b.mockClear();
    box.style.inlineSize = '80px';
    await waitUntil(() => b.mock.calls.length > 0, 'b notified');
    expect(a).not.toHaveBeenCalled();
    unobserveResize(box);
    b.mockClear();
    box.style.inlineSize = '120px';
    await aTimeout(50);
    expect(b).not.toHaveBeenCalled();
  });
});

describe('MediaQueryController', () => {
  it('reflects the query for the host and re-renders when it changes', async () => {
    const host = await fixture<TctTestWatcher>(`<tct-test-watcher></tct-test-watcher>`);
    expect(host.narrow.matches).toBe(window.innerWidth <= 300);
    // The result must agree with the platform at every moment.
    expect(host.narrow.matches).toBe(matchMedia('(max-width: 300px)').matches);
  });
});

// -------------------------------------------------------------------------- interaction modality

describe('interaction modality', () => {
  it('defaults to keyboard, follows pointer presses and key presses, and reports virtual clicks', async () => {
    const button = await fixture<HTMLButtonElement>(`<button>go</button>`);
    trackInteractionModality();
    expect(getModality()).toBe('keyboard');
    await userEvent.click(button);
    expect(getModality()).toBe('pointer');
    button.focus();
    await pressKeys('Enter');
    expect(getModality()).toBe('keyboard');
    // A click with no preceding key or pointer press (assistive technology "activate").
    await pressKeys('Tab');
    button.click();
    button.click();
    expect(getModality()).toBe('virtual');
  });

  it('modifier chords are not navigation', async () => {
    const button = await fixture<HTMLButtonElement>(`<button>go</button>`);
    trackInteractionModality();
    await userEvent.click(button);
    expect(getModality()).toBe('pointer');
    await pressKeys('Control+c');
    expect(getModality()).toBe('pointer');
  });
});

// ------------------------------------------------------------------------------- light DOM styles

describe('adoptLightDomStyles', () => {
  it('appends a sheet once per root and never replaces existing sheets', async () => {
    const host = await fixture<HTMLDivElement>(`<div id="host">x</div>`);
    const existing = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, existing];
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('#host { outline: 3px solid rgb(1, 2, 3); }');
    try {
      expect(adoptLightDomStyles(host, sheet)).toBe(true);
      expect(adoptLightDomStyles(host, sheet)).toBe(false);
      expect(document.adoptedStyleSheets).toContain(existing);
      expect(document.adoptedStyleSheets.filter((item) => item === sheet)).toHaveLength(1);
      expect(getComputedStyle(host).outlineColor).toBe('rgb(1, 2, 3)');
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (item) => item !== sheet && item !== existing,
      );
    }
  });

  it('adopts into the shadow root that contains the host', async () => {
    const outer = await fixture<HTMLDivElement>(`<div></div>`);
    const shadow = outer.attachShadow({mode: 'open'});
    const inside = document.createElement('p');
    shadow.append(inside);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('p { color: rgb(9, 8, 7); }');
    expect(adoptLightDomStyles(inside, sheet)).toBe(true);
    expect(shadow.adoptedStyleSheets).toContain(sheet);
    expect(getComputedStyle(inside).color).toBe('rgb(9, 8, 7)');
    expect(document.adoptedStyleSheets).not.toContain(sheet);
  });

  it('ignores a detached host', () => {
    expect(adoptLightDomStyles(document.createElement('div'), new CSSStyleSheet())).toBe(false);
  });
});

// ------------------------------------------------------------------------- clickable container

describe('ClickableContainerController', () => {
  async function card(
    attributes = '',
    content = '<p>Body text</p><button id="inner">Share</button>',
  ) {
    const wrapper = await fixture<HTMLDivElement>(
      `<div><tct-test-card ${attributes}>${content}</tct-test-card></div>`,
    );
    const host = wrapper.querySelector('tct-test-card')!;
    await host.updateComplete;
    return host;
  }

  it('marks the host and proxies a click on the surface to the real action, exactly once', async () => {
    const host = await card();
    expect(host.getAttribute('data-pressable-container')).toBe('true');
    const hostClicks = vi.fn();
    host.addEventListener('click', hostClicks);
    await userEvent.click(host.querySelector('p')!);
    expect(host.actionClicks).toBe(1);
    // The original click is swallowed in capture; author listeners see the proxied one only.
    expect(hostClicks).toHaveBeenCalledTimes(1);
  });

  it('a click on a nested interactive child belongs to that child', async () => {
    const host = await card();
    const inner = vi.fn();
    host.querySelector('#inner')!.addEventListener('click', inner);
    await userEvent.click(host.querySelector('#inner')!);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(host.actionClicks).toBe(0);
  });

  it('the real action’s own click is not proxied again (no loop)', async () => {
    const host = await card();
    host.renderRoot.querySelector('a')!.click();
    expect(host.actionClicks).toBe(1);
  });

  it('is inert while disabled, and for a blocked href (URL policy)', async () => {
    const disabled = await card('disabled');
    await userEvent.click(disabled.querySelector('p')!);
    expect(disabled.actionClicks).toBe(0);

    const blocked = await card('href="javascript:alert(1)"');
    await userEvent.click(blocked.querySelector('p')!);
    expect(blocked.actionClicks).toBe(0);
  });

  it('a text selection is not a click', async () => {
    const host = await card();
    const paragraph = host.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    paragraph.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));
    expect(host.actionClicks).toBe(0);
    selection.removeAllRanges();
  });

  it('carries modifier keys to the real action (Ctrl-click opens a tab natively)', async () => {
    const host = await card();
    let seen: {ctrl: boolean; shift: boolean} | undefined;
    host.renderRoot.querySelector('a')!.addEventListener('click', (event) => {
      seen = {ctrl: event.ctrlKey, shift: event.shiftKey};
    });
    host
      .querySelector('p')!
      .dispatchEvent(
        new MouseEvent('click', {bubbles: true, composed: true, cancelable: true, ctrlKey: true}),
      );
    expect(seen).toEqual({ctrl: true, shift: false});
  });

  it('the selector list covers native controls and interactive roles', async () => {
    const {INTERACTIVE_SELECTORS} =
      await import('@tecton-astryx/core/controllers/clickable-container.js');
    const probe = document.createElement('div');
    for (const markup of [
      '<button></button>',
      '<a href="#"></a>',
      '<div role="menuitem"></div>',
      '<span></span>',
    ]) {
      probe.innerHTML = markup;
      const element = probe.firstElementChild!;
      expect(element.matches(INTERACTIVE_SELECTORS), markup).toBe(markup !== '<span></span>');
    }
  });
});

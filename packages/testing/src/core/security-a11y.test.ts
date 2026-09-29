/**
 * The sanitiser boundary (A§13), the announcer (A§9.16) and the focus trap (A§9.18): the pieces
 * that touch untrusted markup and assistive technology.
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {
  announce,
  clearAnnouncements,
  getAnnouncerRegions,
  resetAnnouncer,
} from '@tecton-wc/core/a11y/announcer.js';
import {FocusTrapController} from '@tecton-wc/core/controllers/focus-trap.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {
  isSanitizerReady,
  preloadSanitizer,
  resetSanitizer,
  sanitizeHtml,
  sanitizeHtmlSync,
} from '@tecton-wc/core/security/sanitize.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {fixture} from '../fixture.js';
import {deepActiveElement, pressKeys} from '../keyboard.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

const serialise = (fragment: DocumentFragment): string => {
  const holder = document.createElement('div');
  holder.append(fragment);
  return holder.innerHTML;
};

afterEach(() => {
  resetSanitizer();
  resetAnnouncer();
  vi.restoreAllMocks();
});

// -------------------------------------------------------------------------------------- sanitize

describe('sanitizeHtml: DOMPurify fallback (native Sanitizer forced off)', () => {
  it('lazily loads the fallback and returns a fragment without script, handlers or javascript: URLs', async () => {
    const restore = overrideFeature('sanitizer', false);
    try {
      expect(isSanitizerReady()).toBe(false);
      const fragment = await sanitizeHtml(
        '<p onclick="x()">ok <b>bold</b></p><script>alert(1)</script><a href="javascript:alert(1)">l</a><img src=x onerror="alert(1)">',
      );
      expect(fragment).toBeInstanceOf(DocumentFragment);
      const out = serialise(fragment);
      expect(out).toContain('<b>bold</b>');
      expect(out).not.toMatch(/script|onclick|onerror|javascript:/i);
      expect(isSanitizerReady()).toBe(true);
    } finally {
      restore();
    }
  });

  it('sanitizeHtmlSync never returns unsanitised markup: null (with a dev warning) until loaded', async () => {
    const restore = overrideFeature('sanitizer', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    try {
      expect(sanitizeHtmlSync('<b>x</b>')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      await preloadSanitizer();
      expect(serialise(sanitizeHtmlSync('<b>x</b><script>1</script>')!)).toBe('<b>x</b>');
    } finally {
      globalThis.tctDevMode = undefined;
      restore();
    }
  });

  it('svg mode keeps shapes and drops scripts, styles, foreignObject and style attributes', async () => {
    const restore = overrideFeature('sanitizer', false);
    try {
      const fragment = await sanitizeHtml(
        '<path d="M0 0h10" style="fill:red" onload="x()"/><script>1</script><style>*{}</style><foreignObject><div>x</div></foreignObject>',
        {svg: true},
      );
      const out = serialise(fragment);
      expect(out).toContain('d="M0 0h10"');
      expect(out).not.toMatch(/script|<style|foreignobject|onload|style=/i);
    } finally {
      restore();
    }
  });

  it('resists the classic mutation-XSS payloads (the result is moved, never re-serialised)', async () => {
    const restore = overrideFeature('sanitizer', false);
    try {
      const payloads = [
        '<svg></p><style><a title="</style><img src onerror=alert(1)>">',
        '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      ];
      for (const payload of payloads) {
        const fragment = await sanitizeHtml(payload);
        const holder = document.createElement('div');
        holder.append(fragment);
        expect(holder.querySelector('[onerror]'), payload).toBeNull();
        expect(holder.querySelector('script'), payload).toBeNull();
      }
    } finally {
      restore();
    }
  });
});

describe('sanitizeHtml: native Sanitizer path (stubbed setHTML)', () => {
  it('uses Element#setHTML when the engine has it and never loads the fallback', async () => {
    const proto = Element.prototype as Element & {setHTML?: (html: string) => void};
    const had = Object.getOwnPropertyDescriptor(proto, 'setHTML');
    const calls: string[] = [];
    Object.defineProperty(proto, 'setHTML', {
      configurable: true,
      writable: true,
      value(this: Element, markup: string) {
        calls.push(markup);
        this.replaceChildren(Object.assign(document.createElement('i'), {textContent: 'native'}));
      },
    });
    const restore = overrideFeature('sanitizer', true);
    try {
      expect(isSanitizerReady()).toBe(true);
      const fragment = await sanitizeHtml('<b>x</b>');
      expect(calls).toEqual(['<b>x</b>']);
      expect(serialise(fragment)).toBe('<i>native</i>');
      expect(serialise(sanitizeHtmlSync('<b>y</b>')!)).toBe('<i>native</i>');
      // SVG markup is parsed in an SVG context.
      await sanitizeHtml('<path/>', {svg: true});
      expect(calls).toHaveLength(3);
      await preloadSanitizer();
    } finally {
      restore();
      if (had) Object.defineProperty(proto, 'setHTML', had);
      else delete proto.setHTML;
    }
  });
});

// ------------------------------------------------------------------------------------ announcer

describe('announcer without ariaNotify (live regions)', () => {
  const restoreNotify = (): (() => void) => overrideFeature('ariaNotify', false);

  it('mounts nothing until the first message, then one polite status region', async () => {
    const restore = restoreNotify();
    try {
      expect(getAnnouncerRegions()).toEqual({polite: undefined, assertive: undefined});
      announce('Saved');
      const {polite} = getAnnouncerRegions();
      expect(polite).toBeDefined();
      expect(polite!.getAttribute('role')).toBe('status');
      expect(polite!.getAttribute('aria-live')).toBe('polite');
      expect(polite!.textContent).toBe('');
      await waitUntil(() => polite!.textContent === 'Saved', 'spoken', 1500);
      expect(document.querySelectorAll('[data-tct-announcer="polite"]')).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('assertive messages use an alert region', async () => {
    const restore = restoreNotify();
    try {
      announce('Failed', {politeness: 'assertive'});
      const {assertive} = getAnnouncerRegions();
      expect(assertive!.getAttribute('role')).toBe('alert');
      await waitUntil(() => assertive!.textContent === 'Failed', 'spoken', 1500);
    } finally {
      restore();
    }
  });

  it('a burst is spoken as one message; identical consecutive messages collapse; empty ones are ignored', async () => {
    const restore = restoreNotify();
    try {
      announce('  ');
      expect(getAnnouncerRegions().polite).toBeUndefined();
      announce('One');
      announce('One');
      announce('Two');
      const {polite} = getAnnouncerRegions();
      await waitUntil(() => polite!.textContent !== '', 'spoken', 1500);
      expect(polite!.textContent).toBe('One. Two');
    } finally {
      restore();
    }
  });

  it('clearAnnouncements drops pending text and empties the regions', async () => {
    const restore = restoreNotify();
    try {
      announce('Pending');
      clearAnnouncements();
      await aTimeout(250);
      expect(getAnnouncerRegions().polite!.textContent).toBe('');
    } finally {
      restore();
    }
  });

  it('spoken text is removed after a moment so it is not re-read when browsing', async () => {
    const restore = restoreNotify();
    try {
      announce('Ephemeral');
      const {polite} = getAnnouncerRegions();
      await waitUntil(() => polite!.textContent === 'Ephemeral', 'spoken', 1500);
      await waitUntil(() => polite!.textContent === '', 'cleared', 3500);
    } finally {
      restore();
    }
  });

  it('the same message can be spoken again later (the region is cleared first)', async () => {
    const restore = restoreNotify();
    try {
      announce('Again');
      const {polite} = getAnnouncerRegions();
      await waitUntil(() => polite!.textContent === 'Again', 'first', 1500);
      const seen: string[] = [];
      new MutationObserver(() => seen.push(polite!.textContent)).observe(polite!, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      announce('Again');
      await waitUntil(() => seen.includes('Again'), 'second', 1500);
      expect(seen[0]).toBe('');
    } finally {
      restore();
    }
  });

  it('stays audible under a modal dialog: the region moves into it (review H2)', async () => {
    const restore = restoreNotify();
    try {
      announce('Before');
      const {polite} = getAnnouncerRegions();
      const dialog = await fixture<HTMLDialogElement>(`<dialog><p>modal</p></dialog>`);
      const {noteModalShown, noteModalHidden} =
        await import('@tecton-wc/core/layer/top-layer-host.js');
      dialog.showModal();
      noteModalShown(dialog);
      expect(dialog.contains(polite!)).toBe(true);
      expect(polite!.matches(':modal *, :modal')).toBe(true);
      noteModalHidden(dialog);
      dialog.close();
      expect(polite!.parentElement).toBe(document.body);
    } finally {
      restore();
    }
  });
});

describe('announcer with ariaNotify', () => {
  it('delegates to element.ariaNotify with the right priority and creates no regions', () => {
    const proto = Element.prototype as Element & {
      ariaNotify?: (message: string, options?: object) => void;
    };
    const had = Object.getOwnPropertyDescriptor(proto, 'ariaNotify');
    const notify = vi.fn();
    Object.defineProperty(proto, 'ariaNotify', {configurable: true, writable: true, value: notify});
    const restore = overrideFeature('ariaNotify', true);
    try {
      announce('Polite thing');
      announce('Loud thing', {politeness: 'assertive'});
      const target = document.createElement('div');
      document.body.append(target);
      announce('On element', {element: target});
      target.remove();
      expect(notify.mock.calls.map((call) => call as unknown[])).toEqual([
        ['Polite thing', {priority: 'normal'}],
        ['Loud thing', {priority: 'high'}],
        ['On element', {priority: 'normal'}],
      ]);
      expect(notify.mock.contexts[2]).toBe(target);
      expect(getAnnouncerRegions()).toEqual({polite: undefined, assertive: undefined});
    } finally {
      restore();
      if (had) Object.defineProperty(proto, 'ariaNotify', had);
      else delete proto.ariaNotify;
    }
  });
});

// ------------------------------------------------------------------------------------ focus trap

class TctTestTrap extends TctElement {
  static override readonly tagName = 'tct-test-trap';
  @property({type: Boolean}) active = true;
  readonly trap: FocusTrapController = new FocusTrapController(this, {
    container: () => this.renderRoot.querySelector('section'),
    active: () => this.active,
  });
  override render() {
    return html`<section><slot></slot></section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-trap': TctTestTrap;
  }
}

beforeAll(() => {
  defineElement(TctTestTrap);
});

describe('FocusTrapController', () => {
  async function trap(
    content = '<button id="a">A</button><button id="b">B</button><button id="c">C</button>',
  ) {
    const root = await fixture<HTMLDivElement>(
      `<div><button id="outside-before">o1</button><tct-test-trap>${content}</tct-test-trap><button id="outside-after">o2</button></div>`,
    );
    return {root, host: root.querySelector('tct-test-trap')!};
  }
  const focusId = (): string | undefined => deepActiveElement()?.id;

  it('Tab from the last tabbable wraps to the first; Shift+Tab from the first wraps to the last', async () => {
    const {root} = await trap();
    root.querySelector<HTMLElement>('#c')!.focus();
    await pressKeys('Tab');
    expect(focusId()).toBe('a');
    await pressKeys('Shift+Tab');
    expect(focusId()).toBe('c');
    await pressKeys('Shift+Tab');
    expect(focusId()).toBe('b');
    await pressKeys('Tab');
    expect(focusId()).toBe('c');
  });

  it('is inert while inactive, and when focus is outside the container', async () => {
    const {root, host} = await trap();
    host.active = false;
    await host.updateComplete;
    root.querySelector<HTMLElement>('#c')!.focus();
    await pressKeys('Tab');
    expect(focusId()).toBe('outside-after');

    host.active = true;
    await host.updateComplete;
    root.querySelector<HTMLElement>('#outside-before')!.focus();
    await pressKeys('Tab');
    expect(focusId()).toBe('a');
  });

  it('with nothing tabbable inside, Tab is swallowed so focus cannot leave', async () => {
    const {root} = await trap('<div id="only" tabindex="-1">x</div>');
    root.querySelector<HTMLElement>('#only')!.focus();
    await pressKeys('Tab');
    expect(focusId()).toBe('only');
  });

  it('follows shadow roots: a wrapper’s inner control counts as one stop', async () => {
    const {root} = await trap('<button id="a">A</button><div id="wrap"></div>');
    const wrap = root.querySelector('#wrap')!;
    const shadow = wrap.attachShadow({mode: 'open'});
    shadow.innerHTML = '<button id="inner">inner</button>';
    shadow.querySelector<HTMLElement>('#inner')!.focus();
    await pressKeys('Tab');
    expect(focusId()).toBe('a');
    await pressKeys('Shift+Tab');
    expect(focusId()).toBe('inner');
  });

  it('ignores modified Tab and stops listening on disconnect', async () => {
    const {root, host} = await trap();
    root.querySelector<HTMLElement>('#c')!.focus();
    await pressKeys('Alt+Tab');
    host.remove();
    root.querySelector<HTMLElement>('#outside-before')!.focus();
    await nextFrame();
    expect(focusId()).toBe('outside-before');
  });
});

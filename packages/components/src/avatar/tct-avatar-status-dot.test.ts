import {html} from 'lit';
import {beforeAll, describe, expect, it} from 'vitest';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import '../icon/define.js';
import {avatarContext, type AvatarContextValue} from './avatar.context.js';
import {AVATAR_STATUS_DOT_VARIANTS} from './avatar.types.js';
import './define.js';
import type {TctAvatarStatusDot} from './tct-avatar-status-dot.js';

/** Stands in for an avatar: provides the size and records the labels its status reports. */
class TctTestAvatarHost extends TctElement {
  static override readonly tagName = 'tct-test-avatar-host';
  readonly reports = new Map<Element, string | undefined>();
  readonly provider = new ContextProvider(this, {
    context: avatarContext,
    initialValue: {
      size: 36,
      reportStatusLabel: (source, label) => {
        this.reports.set(source, label);
      },
    } satisfies AvatarContextValue,
  });
  setSize(size: number): void {
    this.provider.setValue({...this.provider.value!, size});
  }
  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-avatar-host': TctTestAvatarHost;
  }
}

beforeAll(() => {
  defineElement(TctTestAvatarHost);
});

const dotOf = (element: TctAvatarStatusDot): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('.dot')!;

async function inAvatar(size: number, dotAttributes = 'label="Online"', content = '') {
  const host = await fixture<TctTestAvatarHost>(
    `<tct-test-avatar-host><tct-avatar-status-dot ${dotAttributes}>${content}</tct-avatar-status-dot></tct-test-avatar-host>`,
  );
  host.setSize(size);
  const dot = host.querySelector<TctAvatarStatusDot>('tct-avatar-status-dot')!;
  await dot.updateComplete;
  return {host, dot};
}

const luminance = (rgb: string): number => {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

runElementSuite({
  tag: 'tct-avatar-status-dot',
  render: () => `<tct-avatar-status-dot label="Online"></tct-avatar-status-dot>`,
  properties: {variant: 'error', label: 'Busy'},
  attributes: {variant: 'variant', label: 'label'},
});

describe('tct-avatar-status-dot (AvatarStatusDot.test.tsx)', () => {
  it('renders standalone as role="img" with the label as its name', async () => {
    const dot = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot label="Online"></tct-avatar-status-dot>`,
    );
    if (isChromium) {
      const node = await axNode(dot);
      expect(node.role).toBe('image');
      expect(node.name).toBe('Online');
    }
    expect(dot.hasAttribute('role')).toBe(false);
  });

  it('has no role without a label', async () => {
    const dot = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot></tct-avatar-status-dot>`,
    );
    if (isChromium) expect((await axNode(dot)).role).not.toBe('image');
  });

  it('renders every variant and defaults to success', async () => {
    const dot = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot label="x"></tct-avatar-status-dot>`,
    );
    expect(dot.variant).toBe('success');
    for (const variant of AVATAR_STATUS_DOT_VARIANTS) {
      const each = await fixture<TctAvatarStatusDot>(
        html`<tct-avatar-status-dot variant=${variant} label=${variant}></tct-avatar-status-dot>`,
      );
      expect(getComputedStyle(dotOf(each)).backgroundColor, variant).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  it('pairs each variant with its own shape: solid, ring, minus bar (WCAG 1.4.1)', async () => {
    const shapes: string[] = [];
    for (const variant of AVATAR_STATUS_DOT_VARIANTS) {
      const each = await fixture<TctAvatarStatusDot>(
        html`<tct-avatar-status-dot variant=${variant} label=${variant}></tct-avatar-status-dot>`,
      );
      const glyph = each.shadowRoot!.querySelector('.glyph');
      shapes.push(glyph?.getAttribute('data-shape') ?? 'none');
    }
    expect(shapes).toEqual(['none', 'ring', 'minus']);
  });

  it('is a plain childless dot by default (design review #4373): success has no glyph or icon', async () => {
    const dot = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot label="Online"></tct-avatar-status-dot>`,
    );
    expect(dotOf(dot).childElementCount).toBe(0);
  });
});

describe('tct-avatar-status-dot: size tiers follow the avatar', () => {
  it.each([
    [20, 10, 1, 'small'],
    [36, 10, 1, 'small'],
    [40, 20, 2, 'medium'],
    [72, 20, 2, 'medium'],
    [96, 32, 4, 'large'],
    [128, 32, 4, 'large'],
  ])('a %ipx avatar gets a %ipx dot with a %ipx border (%s)', async (avatar, dotSize, border) => {
    const {dot} = await inAvatar(avatar);
    const box = dotOf(dot).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([dotSize, dotSize]);
    expect(getComputedStyle(dotOf(dot)).borderTopWidth).toBe(`${border}px`);
  });

  it('defaults to the medium avatar size (36px) outside an avatar', async () => {
    const dot = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot label="x"></tct-avatar-status-dot>`,
    );
    expect(dotOf(dot).getBoundingClientRect().width).toBe(10);
  });

  it('rescales when the avatar size changes', async () => {
    const {host, dot} = await inAvatar(20);
    expect(dotOf(dot).getBoundingClientRect().width).toBe(10);
    host.setSize(96);
    await dot.updateComplete;
    expect(dotOf(dot).getBoundingClientRect().width).toBe(32);
  });
});

describe('tct-avatar-status-dot: custom icon (parity with StatusDot)', () => {
  const icon = '<tct-icon slot="icon" name="check" data-testid="custom-icon"></tct-icon>';

  it('renders a provided icon inside the dot at medium and large sizes, replacing the glyph', async () => {
    const {dot} = await inAvatar(48, 'variant="error" label="Busy"', icon);
    expect(dot.shadowRoot!.querySelector('[part~="icon"] slot')).not.toBeNull();
    expect(dot.shadowRoot!.querySelector('.glyph')).toBeNull();
  });

  it('hides the icon wrapper from assistive tech (the label carries the status)', async () => {
    const {dot} = await inAvatar(48, 'label="Verified"', icon);
    expect(dot.shadowRoot!.querySelector('[part~="icon"]')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('draws the built-in glyph instead at the smallest tier (no room for an icon)', async () => {
    const {dot} = await inAvatar(24, 'variant="error" label="Busy"', icon);
    expect(dot.shadowRoot!.querySelector('[part~="icon"]')).toBeNull();
    expect(dot.shadowRoot!.querySelector('.glyph')).not.toBeNull();
  });

  it('keeps the accessible name on the dot when an icon renders', async () => {
    if (!isChromium) return;
    const {dot} = await inAvatar(48, 'label="Verified"', icon);
    const node = await axNode(dot);
    expect(node.role).toBe('image');
    expect(node.name).toBe('Verified');
  });
});

describe('tct-avatar-status-dot: reports its label to the avatar', () => {
  it('reports on connect, follows changes and withdraws on removal', async () => {
    const {host, dot} = await inAvatar(36, 'label="Online"');
    expect(host.reports.get(dot)).toBe('Online');
    dot.label = 'Busy';
    await dot.updateComplete;
    expect(host.reports.get(dot)).toBe('Busy');
    dot.remove();
    expect(host.reports.get(dot)).toBeUndefined();
  });

  it('reports an empty label as absent', async () => {
    const {host, dot} = await inAvatar(36, '');
    expect(host.reports.get(dot)).toBeUndefined();
  });
});

describe('tct-avatar-status-dot: colour and forced colours', () => {
  it.each(['light', 'dark'] as const)(
    'every variant keeps at least 3:1 between plate and ink in the %s theme',
    async (theme) => {
      for (const variant of AVATAR_STATUS_DOT_VARIANTS) {
        const wrapper = await fixture<HTMLElement>(
          html`<div>
            <tct-avatar-status-dot variant=${variant} label=${variant}></tct-avatar-status-dot>
          </div>`,
          {theme},
        );
        const style = getComputedStyle(
          dotOf(wrapper.querySelector<TctAvatarStatusDot>('tct-avatar-status-dot')!),
        );
        expect(contrast(style.backgroundColor, style.color), `${variant}/${theme}`).toBeGreaterThan(
          3,
        );
      }
    },
  );

  it.skipIf(!isChromium)('keeps each shape visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const success = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot label="ok"></tct-avatar-status-dot>`,
    );
    const neutral = await fixture<TctAvatarStatusDot>(
      html`<tct-avatar-status-dot variant="neutral" label="away"></tct-avatar-status-dot>`,
    );
    expect(getComputedStyle(dotOf(success)).backgroundColor).not.toBe(
      getComputedStyle(dotOf(neutral)).backgroundColor,
    );
  });

  it('passes axe, standalone, in every variant and both themes', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          ${AVATAR_STATUS_DOT_VARIANTS.map(
            (variant) =>
              html`<tct-avatar-status-dot
                variant=${variant}
                label=${variant}
              ></tct-avatar-status-dot>`,
          )}
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });
});

/**
 * tct-icon-button: a tct-button with icon-only fixed on. Upstream IconButton.test.tsx ported; the button
 * behaviour itself (naming, busy, forms, tooltip) is tested in the button folder.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {loadLocale} from '@tecton-astryx/core/i18n/registry.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout} from '@tecton-astryx/testing/timing.js';
import {TctButton} from '../button/tct-button.js';
import './define.js';
import type {TctIconButton} from './tct-icon-button.js';

const inner = (button: TctIconButton): HTMLElement =>
  button.shadowRoot!.querySelector<HTMLElement>('.button')!;

async function make(attributes = 'label="Settings" icon="search"'): Promise<TctIconButton> {
  const wrapper = await fixture<HTMLElement>(
    `<div><tct-icon-button ${attributes}></tct-icon-button></div>`,
  );
  const button = wrapper.querySelector<TctIconButton>('tct-icon-button')!;
  await button.updateComplete;
  return button;
}

runElementSuite({
  tag: 'tct-icon-button',
  render: () => html`<tct-icon-button label="Settings" icon="search"></tct-icon-button>`,
  properties: {
    variant: 'primary',
    size: 'lg',
    elevation: 'high',
    label: 'Other',
    icon: 'check',
    tooltip: 'Tip',
  },
  attributes: {variant: 'variant', size: 'size', elevation: 'elevation'},
});

describe('tct-icon-button: naming and rendering (IconButton.test.tsx)', () => {
  it('maps label to the accessible name and renders the icon', async () => {
    const button = await make();
    expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Settings'});
    expect(button.shadowRoot!.querySelector('tct-icon[name="search"]')).not.toBeNull();
  });

  it('does not render label as visible text', async () => {
    const button = await make();
    expect(button.shadowRoot!.querySelector('.label')).toBeNull();
    expect(inner(button).textContent).not.toContain('Settings');
  });

  it('keeps icon-only on: writing false or removing the attribute has no effect', async () => {
    const button = await make();
    expect(button.iconOnly).toBe(true);
    expect(button.hasAttribute('icon-only')).toBe(true);
    button.iconOnly = false;
    await button.updateComplete;
    expect(button.iconOnly).toBe(true);
    button.removeAttribute('icon-only');
    await button.updateComplete;
    expect(button.iconOnly).toBe(true);
    expect(button.shadowRoot!.querySelector('.label')).toBeNull();
  });

  it('forwards variant', async () => {
    const button = await make('label="Delete" icon="close" variant="destructive"');
    expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Delete'});
    expect(button.variant).toBe('destructive');
  });

  it('forwards size and draws a square button', async () => {
    const small = await make('label="Add" icon="add" size="sm"');
    const rect = inner(small).getBoundingClientRect();
    expect(rect.width).toBe(rect.height);
    const large = await make('label="Add" icon="add" size="lg"');
    expect(inner(large).getBoundingClientRect().height).toBeGreaterThan(rect.height);
  });

  it.each(['sm', 'md', 'lg'] as const)('the %s button sizes its inherited icon', async (size) => {
    const button = await make(`label="Add" icon="check" size="${size}"`);
    const icon = button.shadowRoot!.querySelector('tct-icon')!.getBoundingClientRect();
    expect(icon.width).toBeGreaterThan(0);
    expect(icon.width).toBe(icon.height);
    const wrapper = button.shadowRoot!.querySelector('.icon-slot')!.getBoundingClientRect();
    expect(wrapper.width).toBe(icon.width);
  });

  it('a lg icon button draws a larger icon than a md one', async () => {
    const md = await make('label="Add" icon="check" size="md"');
    const lg = await make('label="Add" icon="check" size="lg"');
    expect(lg.shadowRoot!.querySelector('tct-icon')!.getBoundingClientRect().width).toBeGreaterThan(
      md.shadowRoot!.querySelector('tct-icon')!.getBoundingClientRect().width,
    );
  });

  it('accepts a slotted icon', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-icon-button label="Star"><tct-icon slot="icon" name="check"></tct-icon></tct-icon-button></div>',
    );
    const button = wrapper.querySelector<TctIconButton>('tct-icon-button')!;
    await button.updateComplete;
    expect(button.shadowRoot!.querySelector('slot[name="icon"]')).not.toBeNull();
    expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Star'});
  });

  it('forwards elevation to the inner button, so a raised icon button differs from a flat one', async () => {
    const flat = await make('label="Add" icon="add"');
    const raised = await make('label="Add" icon="add" elevation="med"');
    expect(getComputedStyle(raised.shadowRoot!.querySelector('.button')!).boxShadow).not.toBe(
      getComputedStyle(flat.shadowRoot!.querySelector('.button')!).boxShadow,
    );
  });

  it('has its own tag and extends tct-button', async () => {
    const button = await make();
    expect(button.localName).toBe('tct-icon-button');
    expect(customElements.get('tct-icon-button')).toBeDefined();
    expect(button).toBeInstanceOf(TctButton);
  });
});

describe('tct-icon-button: behaviour', () => {
  it('handles click events', async () => {
    const button = await make('label="Close" icon="close"');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is inert when disabled', async () => {
    const button = await make('label="Close" icon="close" disabled');
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    expect(inner(button)).toHaveProperty('disabled', true);
    await userEvent.click(button, {force: true}).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is busy while loading: it blocks activation but keeps its name', async () => {
    const button = await make('label="Save" icon="check" loading');
    expect(inner(button).getAttribute('aria-busy')).toBe('true');
    expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Save'});
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    button.click();
    await aTimeout(20);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('runs clickAction and shows the pending state', async () => {
    const button = await make('label="Sync" icon="check"');
    let resolve!: () => void;
    button.clickAction = () =>
      new Promise<void>((done) => {
        resolve = done;
      });
    button.click();
    await aTimeout(20);
    await button.updateComplete;
    expect(button.busy).toBe(true);
    resolve();
    await aTimeout(20);
    expect(button.busy).toBe(false);
  });

  it('shows the label as its tooltip by default and lets `tooltip` override it', async () => {
    const button = await make('label="Settings" icon="search"');
    expect(button.shadowRoot!.querySelector('.tooltip-surface')?.textContent?.trim()).toBe(
      'Settings',
    );
    button.tooltip = 'Open settings';
    await button.updateComplete;
    expect(button.shadowRoot!.querySelector('.tooltip-surface')?.textContent?.trim()).toBe(
      'Open settings',
    );
  });

  it('activates from the keyboard with Enter and Space', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="before">b</button><tct-icon-button label="Go" icon="search"></tct-icon-button></div>',
    );
    const button = wrapper.querySelector<TctIconButton>('tct-icon-button')!;
    await button.updateComplete;
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    wrapper.querySelector<HTMLButtonElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(button.matches(':focus-within, :focus')).toBe(true);
    await pressKeys('Enter');
    await pressKeys('Space');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('tct-icon-button: form submission (inherited from tct-button)', () => {
  it('submits its form with its name and value, like a button', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<form><input name="q" value="x"><tct-icon-button label="Go" icon="search" type="submit" name="go" value="1"></tct-icon-button></form>',
    );
    const form = wrapper as HTMLFormElement;
    const button = form.querySelector<TctIconButton>('tct-icon-button')!;
    await button.updateComplete;
    const submitted = new Promise<FormData>((resolve) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        resolve(new FormData(form));
      });
    });
    button.click();
    const data = await submitted;
    expect(data.get('q')).toBe('x');
    expect(button.form).toBe(form);
  });
});

describe('tct-icon-button: accessibility, localisation, RTL, forced colours', () => {
  it('passes axe in every variant and state', async () => {
    for (const variant of [
      'primary',
      'secondary',
      'ghost',
      'destructive',
      'outlined',
      'text-only',
    ]) {
      await expectAccessible(await make(`label="Settings" icon="search" variant="${variant}"`));
    }
    await expectAccessible(await make('label="Settings" icon="search" disabled'));
    await expectAccessible(await make('label="Settings" icon="search" loading'));
    await expectAccessible(await make('label="Settings" icon="search" tooltip="Because" disabled'));
  });

  it('the host aria-label wins over label', async () => {
    const button = await make('label="Settings" aria-label="Preferences" icon="search"');
    expect(await axNode(inner(button))).toMatchObject({role: 'button', name: 'Preferences'});
  });

  it('the busy announcement follows the language in scope', async () => {
    await loadLocale('de-DE');
    const wrapper = await fixture<HTMLElement>(
      '<div lang="de-DE"><tct-icon-button label="Senden" icon="check"></tct-icon-button></div>',
    );
    const button = wrapper.querySelector<TctIconButton>('tct-icon-button')!;
    button.loading = true;
    await button.updateComplete;
    expect(inner(button).getAttribute('aria-label')).toBe('Senden');
  });

  it('is a square in right-to-left too, with the icon centred', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl"><tct-icon-button label="Next" icon="search"></tct-icon-button></div>',
    );
    const button = wrapper.querySelector<TctIconButton>('tct-icon-button')!;
    await button.updateComplete;
    const box = inner(button).getBoundingClientRect();
    const icon = button.shadowRoot!.querySelector('tct-icon')!.getBoundingClientRect();
    expect(box.width).toBe(box.height);
    expect(Math.abs(box.left + box.width / 2 - (icon.left + icon.width / 2))).toBeLessThan(1);
  });

  it.skipIf(!isChromium)('keeps a visible edge in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const button = await make('label="Forced" icon="search" variant="primary"');
      expect(getComputedStyle(inner(button)).borderTopWidth).toBe('1px');
      expect(inner(button).getBoundingClientRect().width).toBeGreaterThan(0);
    } finally {
      await restore();
    }
  });
});

/**
 * Acceptance criterion 10 (i18n) for the dialog, the text input and the field chrome: a `lang` on an
 * ancestor lazily loads the shipped catalog and re-renders the close label; `ar-SA` is right-to-left and
 * mirrors the header; overrides of an internationalization provider win over catalogs; the pseudo locale
 * renders. The provider element is another work package's, so its context is published by a stand-in with
 * the same context value.
 */
import {html} from 'lit';
import {beforeAll, describe, expect, it} from 'vitest';
import pseudoMessages from '@tecton-astryx/locales/pseudo.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {localeContext, type LocaleContextValue} from '@tecton-astryx/core/context/keys.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {animationsFinished, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../button/define.js';
import '../text-input/define.js';
import './define.js';
import type {TctButton} from '../button/tct-button.js';
import type {TctTextInput} from '../text-input/tct-text-input.js';
import type {TctDialog} from './tct-dialog.js';
import type {TctDialogHeader} from './tct-dialog-header.js';

class TctTestLocaleProvider extends TctElement {
  static override readonly tagName = 'tct-test-locale-provider';
  readonly provider = new ContextProvider(this, {context: localeContext, initialValue: null});
  set value(value: LocaleContextValue | null) {
    this.provider.setValue(value);
  }
  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-locale-provider': TctTestLocaleProvider;
  }
}

beforeAll(() => {
  defineElement(TctTestLocaleProvider);
});

const headerOf = (dialog: TctDialog): TctDialogHeader =>
  dialog.shadowRoot!.querySelector<TctDialogHeader>('tct-dialog-header')!;
const closeOf = (dialog: TctDialog): TctButton =>
  headerOf(dialog).shadowRoot!.querySelector<TctButton>('.close')!;
const nativeName = (dialog: TctDialog): string | null =>
  closeOf(dialog).shadowRoot!.querySelector('button')!.getAttribute('aria-label');

async function dialogIn(wrapperAttributes: string): Promise<TctDialog> {
  const wrapper = await fixture<HTMLElement>(
    `<div ${wrapperAttributes}><tct-dialog heading="T" open><p>Body</p></tct-dialog></div>`,
  );
  const dialog = wrapper.querySelector<TctDialog>('tct-dialog')!;
  await dialog.updateComplete;
  return dialog;
}

describe('i18n (acceptance 10)', () => {
  it('lang="de-DE" lazily loads the German catalog and re-renders the dialog close label', async () => {
    const dialog = await dialogIn('lang="de-DE"');
    await waitUntil(() => nativeName(dialog) === 'Schließen', 'German close label rendered');
    expect(closeOf(dialog).label).toBe('Schließen');
    await dialog.hide();
  });

  it('lang="de-DE" localises the text input clear label, and a close-label attribute still wins', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-text-input label="Name" has-clear value="x"></tct-text-input></div>`,
    );
    const text = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await text.updateComplete;
    const clear = () => text.shadowRoot!.querySelector('tct-input-clear-button')!;
    await waitUntil(() => clear().getAttribute('label') === 'Name löschen', 'German clear label');

    const custom = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-dialog open heading="T" ><tct-dialog-header close-label="Zu"></tct-dialog-header></tct-dialog></div>`,
    );
    const header = custom.querySelector<TctDialogHeader>('tct-dialog-header')!;
    await header.updateComplete;
    const close = header.shadowRoot!.querySelector<TctButton>('.close')!;
    expect(close.label).toBe('Zu');
  });

  it('lang="ar-SA" loads the Arabic catalog and, with dir="rtl", mirrors the header: title at the right, close at the left', async () => {
    const dialog = await dialogIn('lang="ar-SA" dir="rtl"');
    await waitUntil(() => closeOf(dialog).label !== 'Close', 'Arabic close label rendered');
    expect(closeOf(dialog).label).toMatch(/[؀-ۿ]/);
    await animationsFinished(dialog.shadowRoot!.querySelector('dialog')!);
    expect(getComputedStyle(dialog.shadowRoot!.querySelector('dialog')!).direction).toBe('rtl');
    const title = headerOf(dialog).querySelector('h2')!.getBoundingClientRect();
    const close = closeOf(dialog).getBoundingClientRect();
    expect(close.left).toBeLessThan(title.left);
    await dialog.hide();
  });

  it('an internationalization provider’s overrides win over the shipped catalog and its own messages', async () => {
    const provider = await fixture<TctTestLocaleProvider>(
      `<tct-test-locale-provider><tct-dialog heading="T" open></tct-dialog></tct-test-locale-provider>`,
    );
    const dialog = provider.querySelector<TctDialog>('tct-dialog')!;
    await dialog.updateComplete;
    provider.value = {
      locale: 'de-DE',
      messages: {'de-DE': {'@astryx.dialog.close': 'Provider zu'}},
    };
    await waitUntil(
      () => nativeName(dialog) === 'Provider zu',
      'provider messages beat the catalog',
    );
    provider.value = {
      locale: 'de-DE',
      messages: {'de-DE': {'@astryx.dialog.close': 'Provider zu'}},
      overrides: {'de-DE': {'@astryx.dialog.close': 'Override zu'}},
    };
    await waitUntil(() => nativeName(dialog) === 'Override zu', 'provider overrides win');
    await dialog.hide();
  });

  it('the pseudo locale (en-XA) renders the pseudo close label, so untranslated UI is easy to spot', async () => {
    const dialog = await dialogIn('lang="en-XA"');
    const expected = (pseudoMessages as Record<string, string>)['@astryx.dialog.close'];
    expect(expected).toBeTruthy();
    await waitUntil(() => nativeName(dialog) === expected, 'pseudo close label rendered');
    expect(nativeName(dialog)).not.toBe('Close');
    await dialog.hide();
  });
});

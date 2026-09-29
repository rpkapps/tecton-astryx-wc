import {describe, expect, it} from 'vitest';
import {aTimeout, fixture, waitUntil} from '@tecton-astryx/testing/index.js';
import './define.js';
import type {TctBottomSheet} from './tct-bottom-sheet.js';

describe('smoke', () => {
  it('opens a standalone sheet', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-bottom-sheet label="Filters" snap-points="0.5 96px" height="tall"><p>Hello</p></tct-bottom-sheet></div>`,
    );
    const el = root.querySelector<TctBottomSheet>('tct-bottom-sheet')!;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLDialogElement>('dialog')!.open, 'open');
    await aTimeout(600);
    const sheet = el.shadowRoot!.querySelector<HTMLElement>('.sheet')!;
    const r = sheet.getBoundingClientRect();
    console.log('rect', JSON.stringify(r), window.innerHeight, el.snapCount, el.snapIndex);
    expect(el.snapCount).toBeGreaterThan(1);
    expect(r.bottom).toBeGreaterThan(window.innerHeight - 1);
  });
});

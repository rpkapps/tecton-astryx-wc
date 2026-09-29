/**
 * tct-field-status: the message box, the announcement channel, the detached leading icon (ported from
 * upstream FieldStatus.test.tsx), plus its element-suite lifecycle contract.
 */
import {html} from 'lit';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import './define.js';
import type {TctFieldStatus} from './tct-field-status.js';

const make = async (attributes: string, content = ''): Promise<TctFieldStatus> => {
  const wrapper = await fixture<HTMLElement>(
    `<div><tct-field-status ${attributes}>${content}</tct-field-status></div>`,
  );
  return wrapper.querySelector<TctFieldStatus>('tct-field-status')!;
};

const box = (status: TctFieldStatus): HTMLElement =>
  status.shadowRoot!.querySelector<HTMLElement>('[part="status"]')!;

runElementSuite({
  tag: 'tct-field-status',
  render: () => html`<tct-field-status type="error" message="Required"></tct-field-status>`,
  properties: {type: 'warning', message: 'Careful', variant: 'detached'},
  attributes: {type: 'type', message: 'message', variant: 'variant'},
});

describe('tct-field-status: rendering', () => {
  it('renders the message text', async () => {
    const status = await make('type="error" message="This field is required"');
    expect(box(status).textContent).toContain('This field is required');
  });

  it('renders the message from its own content when it needs more than plain text', async () => {
    const status = await make('type="error"', 'Enter a <b>valid</b> address');
    expect(status.textContent).toBe('Enter a valid address');
    expect(box(status).querySelector('slot')!.assignedNodes().length).toBeGreaterThan(0);
  });

  it('exposes the message box as the "status" part, inside a <div>', async () => {
    const status = await make('type="error" message="x"');
    expect(box(status).localName).toBe('div');
    expect(box(status).getAttribute('part')).toBe('status');
  });

  it('reflects the type and variant as data attributes (default variant "attached")', async () => {
    const status = await make('type="warning" message="x"');
    expect(box(status).dataset.type).toBe('warning');
    expect(box(status).dataset.variant).toBe('attached');
    status.variant = 'detached';
    status.type = 'success';
    await status.updateComplete;
    expect(box(status).dataset.variant).toBe('detached');
    expect(box(status).dataset.type).toBe('success');
  });

  it('falls back for an invalid type and treats the field-family "tooltip" sentinel as attached', async () => {
    const status = await make('type="bogus" message="x" variant="tooltip"');
    expect(box(status).dataset.type).toBe('error');
    expect(box(status).dataset.variant).toBe('attached');
  });

  it('updates the rendered message and type on change', async () => {
    const status = await make('type="error" message="One"');
    status.message = 'Two';
    status.type = 'success';
    await status.updateComplete;
    expect(box(status).textContent).toContain('Two');
    expect(box(status).dataset.type).toBe('success');
  });

  it('renders an empty message without crashing', async () => {
    const status = await make('type="error"');
    expect(box(status)).not.toBeNull();
    expect(box(status).textContent?.trim()).toBe('');
  });

  it('draws no message box behind the text (Tecton: coloured ink, no wash) and never intercepts the control', async () => {
    const status = await make('type="error" message="x"');
    expect(getComputedStyle(box(status)).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(status).display).toBe('block');
  });

  it('carries no role and is not aria-hidden: the text is read where it sits', async () => {
    const status = await make('type="error" message="Required"');
    expect(status.hasAttribute('role')).toBe(false);
    expect(status.getAttribute('aria-hidden')).toBeNull();
    expect(box(status).hasAttribute('role')).toBe(false);
    expect(box(status).hasAttribute('aria-live')).toBe(false);
  });
});

describe('tct-field-status: screen-reader announcements', () => {
  let restore: () => void;
  beforeEach(() => {
    // Force the live-region path so the announcement text is observable in every engine.
    restore = overrideFeature('ariaNotify', false);
  });
  afterEach(() => {
    restore();
  });

  it('announces error messages assertively, including on first mount', async () => {
    await make('type="error" message="This field is required"');
    await waitUntil(
      () => getAnnouncerRegions().assertive?.textContent === 'This field is required',
      'assertive announcement',
      2000,
    );
    expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
  });

  it('announces warning and success messages politely on first mount', async () => {
    await make('type="warning" message="Check this value"');
    await waitUntil(
      () => getAnnouncerRegions().polite?.textContent === 'Check this value',
      'warning announced',
      2000,
    );
    await make('type="success" message="Looks good"');
    await waitUntil(
      () => getAnnouncerRegions().polite?.textContent === 'Looks good',
      'success announced',
      2000,
    );
  });

  it('announces a message change, and re-routes to the polite channel when the type leaves error', async () => {
    const status = await make('type="error" message="This field is required"');
    await waitUntil(() => getAnnouncerRegions().assertive?.textContent !== '', 'first', 2000);
    status.message = 'Enter a valid email address';
    await waitUntil(
      () => getAnnouncerRegions().assertive?.textContent === 'Enter a valid email address',
      'replacement announced',
      2000,
    );
    status.type = 'success';
    status.message = 'Looks good';
    await waitUntil(
      () => getAnnouncerRegions().polite?.textContent === 'Looks good',
      'polite after the type changed',
      2000,
    );
  });

  it('does not announce an empty message, and does not repeat on unrelated updates', async () => {
    const status = await make('type="error"');
    status.variant = 'detached';
    await status.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getAnnouncerRegions().assertive?.textContent ?? '').toBe('');
    expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
  });

  it('a status owned by a field (data-tct-owned) is left to its owner to announce', async () => {
    await make('data-tct-owned type="error" message="Owned message"');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(getAnnouncerRegions().assertive?.textContent ?? '').toBe('');
    expect(getAnnouncerRegions().polite?.textContent ?? '').toBe('');
  });
});

describe('tct-field-status: detached leading status icon (use of colour)', () => {
  it('renders a leading, decorative status icon before the message for the detached variant', async () => {
    const status = await make('type="warning" message="Careful" variant="detached"');
    const icon = status.shadowRoot!.querySelector<HTMLElement>('[part="icon"]')!;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('name')).toBe('warning');
    expect(icon.getAttribute('aria-hidden') ?? icon.ariaHidden ?? 'true').toBe('true');
    const order = icon.compareDocumentPosition(box(status).querySelector('.text')!);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the matching glyph for each status type', async () => {
    for (const [type, name] of [
      ['error', 'error'],
      ['warning', 'warning'],
      ['success', 'success'],
      ['info', 'info'],
    ] as const) {
      const status = await make(`type="${type}" message="x" variant="detached"`);
      expect(status.shadowRoot!.querySelector('[part="icon"]')!.getAttribute('name'), type).toBe(
        name,
      );
    }
  });

  it('does not render the icon for the attached variant (the control draws it)', async () => {
    const status = await make('type="error" message="x"');
    expect(status.shadowRoot!.querySelector('[part="icon"]')).toBeNull();
  });
});

describe('tct-field-status: accessibility and styling', () => {
  it('passes axe for every type and variant', async () => {
    for (const type of ['error', 'warning', 'success', 'info']) {
      for (const variant of ['attached', 'detached']) {
        const status = await make(`type="${type}" message="Message" variant="${variant}"`);
        await expectAccessible(status);
      }
    }
  });

  it('keeps the text readable in forced-colours mode', async () => {
    const status = await make('type="error" message="Message" variant="detached"');
    await emulateMedia({forcedColors: 'active'});
    expect(getComputedStyle(box(status)).color).not.toBe('rgba(0, 0, 0, 0)');
    await emulateMedia({forcedColors: 'none'});
  });
});

/**
 * tct-text-area: the element and form-control suites, then rendering, events, the character counter and its
 * announcements, auto-grow (with `field-sizing` and with the JS fallback), status, adornments, disabled
 * reason, loading and changeAction, slotted-textarea mode, RTL, forced colours and i18n. Ported from
 * upstream TextArea.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {recordEvents} from '@tecton-astryx/testing/events.js';
import {deepQueryAll, fixture} from '@tecton-astryx/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-astryx/testing/forms.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-astryx/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctTextArea} from './tct-text-area.js';
import {characterCount} from './text-area.types.js';

const inner = (area: TctTextArea): HTMLTextAreaElement =>
  area.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea.area-control')!;
const part = (area: TctTextArea, name: string): HTMLElement | null =>
  area.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

async function motionDone(element: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(element.parentElement ?? element, () => true)
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
}

async function make(attributes = 'label="Notes"', extra = ''): Promise<TctTextArea> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:420px"><tct-text-area ${attributes}>${extra}</tct-text-area></div>`,
  );
  const area = wrapper.querySelector<TctTextArea>('tct-text-area')!;
  await area.updateComplete;
  await nextFrame();
  return area;
}

runElementSuite({
  tag: 'tct-text-area',
  render: () => html`<tct-text-area label="Notes" name="n"></tct-text-area>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Type',
    rows: 5,
    size: 'lg',
    loading: true,
    autoGrow: true,
    maxlength: 100,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    rows: 'rows',
    autoGrow: 'auto-grow',
  },
});

runFormControlSuite({
  tag: 'tct-text-area',
  render: (attributes) => `<tct-text-area label="Field" ${attributes}></tct-text-area>`,
  validValue: 'hello\nworld',
  submitsOnEnter: false,
  readonly: true,
  labelActivation: 'focus',
  userEdit: async (element) => {
    await userEvent.click(element);
    await userEvent.keyboard('hi');
    await pressKeys('Tab');
  },
});

describe('tct-text-area: rendering (TextArea.test.tsx)', () => {
  it('renders a native textarea in the shadow root with the label; the value follows the attribute until set', async () => {
    const area = await make('label="Notes" value="Hello" name="n"');
    expect(inner(area).value).toBe('Hello');
    expect(area.value).toBe('Hello');
    area.value = 'Bye';
    await area.updateComplete;
    expect(inner(area).value).toBe('Bye');
    expect(area.defaultValue).toBe('Hello');
    expect(part(area, 'label')!.textContent).toContain('Notes');
    if (isChromium) {
      const node = await axNode(inner(area));
      expect(node.role).toBe('textbox');
      expect(node.name).toBe('Notes');
    }
  });

  it('forwards placeholder, rows (default 3), autocomplete, inputmode and enterkeyhint', async () => {
    const area = await make(
      'label="Notes" placeholder="Describe" rows="5" autocomplete="off" inputmode="text" enterkeyhint="send"',
    );
    const control = inner(area);
    expect(control.placeholder).toBe('Describe');
    expect(control.rows).toBe(5);
    expect(control.autocomplete).toBe('off');
    expect(control.getAttribute('inputmode')).toBe('text');
    expect(control.getAttribute('enterkeyhint')).toBe('send');
    expect(inner(await make('label="Notes"')).rows).toBe(3);
    expect(inner(await make('label="Notes" autocomplete="on"')).getAttribute('autocomplete')).toBe(
      'on',
    );
    expect(inner(await make('label="Notes"')).hasAttribute('autocomplete')).toBe(false);
  });

  it('forwards the host spellcheck', async () => {
    expect(inner(await make('label="Notes"')).spellcheck).toBe(true);
    expect(inner(await make('label="Notes" spellcheck="false"')).spellcheck).toBe(false);
  });

  it('does not set a native maxlength (the counter is soft)', async () => {
    const area = await make('label="Notes" maxlength="10"');
    expect(inner(area).hasAttribute('maxlength')).toBe(false);
    expect(inner(await make('label="Notes"')).hasAttribute('maxlength')).toBe(false);
  });

  it('draws the field as the Tecton outlined box: 1px border, 4px radius, sized by rows', async () => {
    const area = await make('label="Notes" rows="3"');
    const box = part(area, 'input')!;
    const style = getComputedStyle(box);
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopLeftRadius).toBe('4px');
    const three = box.getBoundingClientRect().height;
    area.rows = 6;
    await area.updateComplete;
    await nextFrame();
    expect(box.getBoundingClientRect().height).toBeGreaterThan(three + 30);
  });

  it('lg adds inner padding; sm and md do not', async () => {
    const area = await make('label="Notes"');
    const md = inner(area).getBoundingClientRect().height;
    area.size = 'lg';
    await area.updateComplete;
    await nextFrame();
    expect(inner(area).getBoundingClientRect().height).toBeGreaterThan(md);
  });

  it('Enter adds a line and does not submit the form', async () => {
    const form = await formHarness('<tct-text-area label="Notes" name="notes"></tct-text-area>');
    const area = form.form.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    await userEvent.click(inner(area));
    await userEvent.keyboard('a{Enter}b');
    expect(area.value).toBe('a\nb');
    expect(form.submitEvents).toHaveLength(0);
  });

  it('typing fires input on every edit and change on commit; setting value fires nothing', async () => {
    const area = await make('label="Notes"');
    const events = recordEvents(area, ['input', 'change']);
    await userEvent.click(inner(area));
    await userEvent.keyboard('abc');
    expect(events.named('input')).toHaveLength(3);
    expect(events.named('change')).toHaveLength(0);
    await pressKeys('Tab');
    expect(events.named('change')).toHaveLength(1);
    expect(events.named('change')[0]!.composed).toBe(true);
    area.value = 'x';
    await area.updateComplete;
    expect(events.events).toHaveLength(4);
  });

  it('forwards a paste event, composed', async () => {
    const area = await make('label="Notes"');
    const events = recordEvents(area, 'paste');
    inner(area).dispatchEvent(new Event('paste', {bubbles: true, composed: true}));
    expect(events.events).toHaveLength(1);
  });

  it('is a plain textbox: the description is linked and label-hidden hides the label visually', async () => {
    const area = await make('label="Notes" description="Say more" label-hidden');
    expect(part(area, 'label')!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(inner(area).getAttribute('aria-describedby')!.split(' ')).toContain(
      part(area, 'description')!.id,
    );
    if (isChromium) {
      const node = await axNode(inner(area));
      expect(node.name).toBe('Notes');
      expect(node.description).toContain('Say more');
    }
  });

  it('shows the Required and Optional indicators; required is native, aria-required otherwise', async () => {
    const required = await make('label="Notes" required');
    expect(part(required, 'label-indicator')!.textContent).toContain('Required');
    expect(inner(required).required).toBe(true);
    const optional = await make('label="Notes" optional label-tooltip="Why?"');
    expect(part(optional, 'label-indicator')!.textContent).toContain('Optional');
    expect(part(optional, 'label-tip')).not.toBeNull();
    expect(inner(optional).required).toBe(false);
  });

  it('renders a start icon and pads the text for it; clicking the icon focuses the textarea', async () => {
    const area = await make('label="Notes" start-icon="search"');
    const icon = part(area, 'start-icon')!;
    expect(icon.getAttribute('name')).toBe('search');
    expect(parseFloat(getComputedStyle(inner(area)).paddingInlineStart)).toBeGreaterThan(20);
    // The icon does not take pointer events: a click on it lands on the textarea underneath.
    const rect = icon.getBoundingClientRect();
    expect(
      area.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
    ).toBe(inner(area));
    await userEvent.click(inner(area));
    expect(deepActiveElement()).toBe(inner(area));
    expect(part(await make('label="Notes"'), 'start-icon')).toBeNull();
  });

  it('clicking the box padding focuses the textarea', async () => {
    const area = await make('label="Notes"');
    const box = part(area, 'input')!;
    const rect = box.getBoundingClientRect();
    await userEvent.click(box, {position: {x: 2, y: 2}});
    expect(deepActiveElement()).toBe(inner(area));
    expect(rect.width).toBeGreaterThan(100);
  });

  it('autofocus focuses the textarea once rendered', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-text-area label="Notes" autofocus></tct-text-area></div>',
    );
    const area = wrapper.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    await waitUntil(() => deepActiveElement() === inner(area), 'autofocus');
  });
});

describe('tct-text-area: the character counter (maxLength)', () => {
  it('shows a n/max counter inside the box, linked to the textarea, and none without maxlength', async () => {
    const area = await make('label="Notes" maxlength="10" value="abc"');
    const counter = part(area, 'counter')!;
    expect(counter.textContent.replace(/\s+/g, '')).toBe('3/10');
    expect(part(area, 'input')!.contains(counter)).toBe(true);
    expect(inner(area).getAttribute('aria-describedby')!.split(' ')).toContain(counter.id);
    expect(part(await make('label="Notes"'), 'counter')).toBeNull();
  });

  it('updates as the user types and never blocks typing', async () => {
    const area = await make('label="Notes" maxlength="3"');
    await userEvent.click(inner(area));
    await userEvent.keyboard('abcde');
    expect(area.value).toBe('abcde');
    expect(part(area, 'counter')!.textContent.replace(/\s+/g, '')).toContain('5/3');
  });

  it('counts user-perceived characters, not code units', async () => {
    expect(characterCount('a👨‍👩‍👧b')).toBe(3);
    expect(characterCount('🇫🇷🇩🇪')).toBe(2);
    expect(characterCount('é')).toBe(1);
    const area = await make('label="Notes" maxlength="4" value="👨‍👩‍👧👍👍"');
    expect(part(area, 'counter')!.textContent.replace(/\s+/g, '')).toBe('3/4');
    expect(inner(area).getAttribute('aria-invalid')).toBeNull();
  });

  it('past the limit: aria-invalid at once, a warning icon in the counter, the error colour, invalid validity, no second message', async () => {
    const area = await make('label="Notes" maxlength="3" value="abcde"');
    expect(inner(area).getAttribute('aria-invalid')).toBe('true');
    const counter = part(area, 'counter')!;
    expect(counter.hasAttribute('data-over')).toBe(true);
    expect(counter.querySelector('tct-icon')!.getAttribute('name')).toBe('warning');
    expect(area.validity.tooLong).toBe(true);
    expect(area.checkValidity()).toBe(false);
    expect(area.shadowRoot!.querySelector('tct-field-status')).toBeNull();
    area.value = 'abc';
    await area.updateComplete;
    await nextFrame();
    expect(inner(area).hasAttribute('aria-invalid')).toBe(false);
    expect(area.validity.valid).toBe(true);
    expect(part(area, 'counter')!.querySelector('tct-icon')).toBeNull();
  });

  it('an over-limit value blocks the form submit', async () => {
    const form = await formHarness(
      '<tct-text-area label="Notes" name="n" maxlength="3" value="abcde"></tct-text-area><button type="submit">Go</button>',
    );
    await form.form.querySelector<TctTextArea>('tct-text-area')!.updateComplete;
    await userEvent.click(form.form.querySelector('button')!);
    expect(form.submitEvents).toHaveLength(0);
  });

  it('announces the remaining count politely when it nears the limit, and the overflow assertively, once per crossing', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const area = await make('label="Notes" maxlength="10"');
      await userEvent.click(inner(area));
      await userEvent.keyboard('abcdefgh');
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === '2 characters remaining',
        'near the limit announced',
        3000,
      );
      // Still near: nothing more is said.
      await userEvent.keyboard('i');
      await aTimeout(250);
      expect(getAnnouncerRegions().polite?.textContent).toBe('2 characters remaining');
      await userEvent.keyboard('jklm');
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === '1 character over the limit',
        'over the limit announced',
        3000,
      );
    } finally {
      restore();
    }
  });
});

describe('tct-text-area: auto-grow', () => {
  const textOf = (lines: number): string =>
    Array.from({length: lines}, (_, i) => `line ${i}`).join('\n');

  it('grows with the text and shrinks back, with field-sizing where available', async () => {
    const area = await make('label="Notes" auto-grow rows="2"');
    const control = inner(area);
    const empty = control.getBoundingClientRect().height;
    area.value = textOf(8);
    await area.updateComplete;
    await nextFrame();
    const tall = control.getBoundingClientRect().height;
    expect(tall).toBeGreaterThan(empty + 60);
    expect(control.scrollHeight - control.clientHeight).toBeLessThanOrEqual(1);
    area.value = '';
    await area.updateComplete;
    await nextFrame();
    expect(control.getBoundingClientRect().height).toBeLessThan(tall - 40);
    expect(getComputedStyle(control).resize).toBe('none');
  });

  it('stops at max-rows and scrolls', async () => {
    const area = await make('label="Notes" auto-grow rows="2" max-rows="4"');
    const control = inner(area);
    area.value = textOf(20);
    await area.updateComplete;
    await nextFrame();
    const lineHeight = parseFloat(getComputedStyle(control).lineHeight);
    expect(control.getBoundingClientRect().height).toBeLessThanOrEqual(lineHeight * 4 + 16);
    expect(control.scrollHeight).toBeGreaterThan(control.clientHeight + 20);
  });

  it('the JS fallback measures the text when field-sizing is missing, and follows edits and width changes', async () => {
    const restore = overrideFeature('fieldSizing', false);
    try {
      const area = await make('label="Notes" auto-grow rows="2" max-rows="6"');
      const control = inner(area);
      expect(control.style.blockSize).not.toBe('');
      const empty = control.getBoundingClientRect().height;
      await userEvent.click(control);
      await userEvent.keyboard('a{Enter}b{Enter}c{Enter}d{Enter}e');
      await nextFrame();
      const grown = control.getBoundingClientRect().height;
      expect(grown).toBeGreaterThan(empty + 20);
      expect(control.scrollHeight - control.clientHeight).toBeLessThanOrEqual(1);
      // A narrower field wraps a long line onto more rows.
      area.value = 'word '.repeat(40);
      await area.updateComplete;
      await nextFrame();
      const wide = control.getBoundingClientRect().height;
      area.style.inlineSize = '140px';
      await waitUntil(
        () => control.getBoundingClientRect().height > wide,
        'narrower field is taller',
      );
      area.value = '';
      await area.updateComplete;
      await nextFrame();
      expect(control.getBoundingClientRect().height).toBeLessThanOrEqual(empty + 1);
    } finally {
      restore();
    }
  });

  it('without auto-grow the field keeps its rows and scrolls', async () => {
    const area = await make('label="Notes" rows="2"');
    const control = inner(area);
    const before = control.getBoundingClientRect().height;
    area.value = textOf(20);
    await area.updateComplete;
    await nextFrame();
    expect(control.getBoundingClientRect().height).toBe(before);
    expect(control.style.blockSize).toBe('');
    expect(getComputedStyle(control).resize).toBe('vertical');
  });
});

describe('tct-text-area: status', () => {
  it('draws the status border and glyph; an error sets aria-invalid', async () => {
    const area = await make('label="Notes" status-type="error"');
    expect(part(area, 'input')!.dataset.status).toBe('error');
    expect(part(area, 'status-icon')!.getAttribute('name')).toBe('error');
    expect(inner(area).getAttribute('aria-invalid')).toBe('true');
    const warning = await make('label="Notes" status-type="warning"');
    expect(inner(warning).hasAttribute('aria-invalid')).toBe(false);
    expect(part(warning, 'status-icon')!.getAttribute('name')).toBe('warning');
    const success = await make('label="Notes" status-type="success"');
    expect(inner(success).hasAttribute('aria-invalid')).toBe(false);
  });

  it('attached, detached and tooltip variants place the message like the text input', async () => {
    const attached = await make('label="Notes" status-type="error" status-message="Too short"');
    const status = attached.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('attached');
    expect(inner(attached).getAttribute('aria-describedby')!.split(' ')).toContain(status.id);
    const detached = await make(
      'label="Notes" status-type="warning" status-message="Careful" status-variant="detached"',
    );
    expect(detached.shadowRoot!.querySelector('tct-field-status')!.getAttribute('variant')).toBe(
      'detached',
    );
    expect(part(detached, 'status-icon')).toBeNull();
    const tooltip = await make(
      'label="Notes" status-type="success" status-message="Saved" status-variant="tooltip"',
    );
    expect(tooltip.shadowRoot!.querySelector('tct-field-status')).toBeNull();
    const button = part(tooltip, 'status-button')!;
    expect(button.getAttribute('aria-label')).toBe('Success details');
    button.focus();
    await nextFrame();
    expect(deepActiveElement()).toBe(button);
  });

  it('shows both the busy spinner and the status glyph while busy', async () => {
    const area = await make('label="Notes" loading status-type="error"');
    expect(part(area, 'busy')).not.toBeNull();
    expect(part(area, 'status-icon')).not.toBeNull();
    expect(getComputedStyle(inner(area)).paddingInlineEnd).not.toBe('8px');
  });

  it('the status property reads and writes status-type and status-message together', async () => {
    const area = await make('label="Notes" status-type="warning" status-message="Hmm"');
    expect(area.status).toEqual({type: 'warning', message: 'Hmm'});
    area.status = undefined;
    await area.updateComplete;
    expect(part(area, 'input')!.dataset.status).toBeUndefined();
  });
});

describe('tct-text-area: disabled, read-only, loading and changeAction', () => {
  it('a disabled textarea is natively disabled and dimmed; a read-only one stays focusable and is submitted', async () => {
    const disabled = await make('label="Notes" disabled value="x"');
    expect(inner(disabled).disabled).toBe(true);
    expect(part(disabled, 'input')!.hasAttribute('data-disabled')).toBe(true);
    const form = await formHarness(
      '<tct-text-area label="Notes" name="n" value="kept" readonly></tct-text-area>',
    );
    const area = form.form.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    expect(inner(area).readOnly).toBe(true);
    expect(form.entries()).toEqual([['n', 'kept']]);
    inner(area).focus();
    expect(deepActiveElement()).toBe(inner(area));
    await userEvent.keyboard('zzz');
    expect(area.value).toBe('kept');
  });

  it('with a disabled-message it stays focusable, becomes read-only, and explains itself', async () => {
    const area = await make(
      'label="Notes" disabled disabled-message="Locked after submission" value="x"',
    );
    const control = inner(area);
    expect(control.disabled).toBe(false);
    expect(control.readOnly).toBe(true);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    control.focus();
    await userEvent.keyboard('zzz');
    expect(area.value).toBe('x');
    const reason = area.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(reason.textContent).toBe('Locked after submission');
    expect(control.getAttribute('aria-describedby')!.split(' ')).toContain(reason.id);
    expect(area.shadowRoot!.querySelector('tct-tooltip')!.getAttribute('content')).toBe(
      'Locked after submission',
    );
  });

  it('a disabled textarea submits nothing, even with a disabled-message', async () => {
    const form = await formHarness(
      '<tct-text-area label="Notes" name="n" value="x" disabled disabled-message="No"></tct-text-area>',
    );
    expect(form.entries()).toEqual([]);
  });

  it('loading shows a spinner and aria-busy; changeAction is busy while pending and runs after each edit', async () => {
    const loading = await make('label="Notes" loading');
    expect(inner(loading).getAttribute('aria-busy')).toBe('true');
    expect(part(loading, 'busy')).not.toBeNull();
    if (!isTier2) expect(hasCustomState(loading, 'busy')).toBe(true);

    const area = await make();
    let resolve!: () => void;
    const seen: [string, string][] = [];
    area.changeAction = (value, event) => {
      seen.push([value, event.type]);
      return new Promise<void>((done) => {
        resolve = done;
      });
    };
    await userEvent.click(inner(area));
    await userEvent.keyboard('a');
    expect(seen).toEqual([['a', 'input']]);
    await area.updateComplete;
    expect(inner(area).getAttribute('aria-busy')).toBe('true');
    resolve();
    await waitUntil(() => !inner(area).hasAttribute('aria-busy'), 'idle');
    expect(area.value).toBe('a');
  });
});

describe('tct-text-area: slotted-textarea mode', () => {
  it('the author textarea is the control: it submits itself, and the chrome is satellites next to it', async () => {
    const form = await formHarness(
      '<tct-text-area label="Notes" description="Say more" required><textarea slot="input" name="notes">hi</textarea></tct-text-area>',
    );
    const area = form.form.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    await nextFrame();
    const slotted = area.querySelector('textarea')!;
    expect(form.entries()).toEqual([['notes', 'hi']]);
    expect(area.value).toBe('hi');
    area.value = 'there';
    expect(slotted.value).toBe('there');
    expect(area.shadowRoot!.querySelector('textarea.area-control')).toBeNull();
    const label = area.querySelector<HTMLElement>('[slot="label"]')!;
    expect(label.textContent).toContain('Notes');
    expect(slotted.getAttribute('aria-labelledby')).toContain(label.id);
    if (isChromium) {
      const node = await axNode(slotted);
      expect(node.name).toMatch(/^Notes/);
      expect(node.description).toContain('Say more');
    }
  });

  it('does not add an entry of its own, and its counter follows the author textarea', async () => {
    const form = await formHarness(
      '<tct-text-area label="Notes" maxlength="4"><textarea slot="input" name="notes"></textarea></tct-text-area>',
    );
    const area = form.form.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    await userEvent.click(area.querySelector('textarea')!);
    await userEvent.keyboard('abcdef');
    await area.updateComplete;
    expect(form.entries()).toEqual([['notes', 'abcdef']]);
    expect(part(area, 'counter')!.textContent.replace(/\s+/g, '')).toContain('6/4');
    expect(area.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('tct-text-area: appearance, accessibility and i18n', () => {
  it('draws a 2px focus ring around the box on keyboard focus', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-text-area label="Notes"></tct-text-area></div>`,
    );
    const area = wrapper.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await waitUntil(() => getComputedStyle(part(area, 'input')!).outlineStyle === 'solid', 'ring');
    expect(getComputedStyle(part(area, 'input')!).outlineWidth).toBe('2px');
  });

  it('width sizes the whole field', async () => {
    const area = await make('label="Notes" width="240"');
    expect(part(area, 'field')!.getBoundingClientRect().width).toBe(240);
  });

  it('mirrors in RTL: the start icon sits at the right and the counter at the left', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size:400px"><tct-text-area label="Notes" start-icon="search" maxlength="10"></tct-text-area></div>`,
    );
    const area = wrapper.querySelector<TctTextArea>('tct-text-area')!;
    await area.updateComplete;
    await nextFrame();
    const box = part(area, 'input')!.getBoundingClientRect();
    expect(box.right - part(area, 'start-icon')!.getBoundingClientRect().right).toBeLessThan(20);
    expect(part(area, 'counter')!.getBoundingClientRect().left - box.left).toBeLessThan(20);
  });

  it('keeps the box border visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const area = await make();
    expect(getComputedStyle(part(area, 'input')!).borderTopStyle).toBe('solid');
  });

  it('passes axe in the default, error, disabled, read-only, counter and auto-grow states', async () => {
    for (const attributes of [
      'label="Notes"',
      'label="Notes" required status-type="error" status-message="Required"',
      'label="Notes" disabled value="x"',
      'label="Notes" disabled disabled-message="Locked" value="x"',
      'label="Notes" readonly value="x"',
      'label="Notes" maxlength="20" value="hello"',
      'label="Notes" auto-grow max-rows="5" start-icon="search"',
      'label="Notes" label-hidden loading',
    ]) {
      const area = await make(attributes);
      await motionDone(area);
      await expectAccessible(area);
    }
  });

  it('localises the counter announcements and the Required indicator', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const wrapper = await fixture<HTMLElement>(
        `<div lang="de-DE"><tct-text-area label="Notizen" required maxlength="4"></tct-text-area></div>`,
      );
      const area = wrapper.querySelector<TctTextArea>('tct-text-area')!;
      await area.updateComplete;
      await waitUntil(
        () => !(part(area, 'label-indicator')?.textContent ?? 'Required').includes('Required'),
        'German indicator',
      );
      await userEvent.click(inner(area));
      await userEvent.keyboard('abcdef');
      await waitUntil(
        () => (getAnnouncerRegions().assertive?.textContent ?? '').includes('Zeichen'),
        'German announcement',
        3000,
      );
    } finally {
      restore();
    }
  });
});

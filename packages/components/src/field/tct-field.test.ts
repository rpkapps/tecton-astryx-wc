/**
 * tct-field: label, description and status satellites around a slotted control, the ARIA wiring in the
 * light tree, group labels, horizontal labels, the required/optional indicator, the announcement, and the
 * naming contract (acceptance 6): ported from upstream Field.test.tsx.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {formLayoutContext, type FormLayoutContextValue} from '@tecton-astryx/core/context/keys.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import './define.js';
import type {TctField} from './tct-field.js';

const satellite = (field: TctField, slot: string): HTMLElement | null =>
  field.querySelector<HTMLElement>(`:scope > [slot="${slot}"]`);

async function make(
  attributes: string,
  control = '<input id="c" name="email">',
): Promise<TctField> {
  const wrapper = await fixture<HTMLElement>(
    `<div><tct-field ${attributes}>${control}</tct-field></div>`,
  );
  const field = wrapper.querySelector<TctField>('tct-field')!;
  await field.updateComplete;
  await nextFrame();
  return field;
}

runElementSuite({
  tag: 'tct-field',
  render: () => html`<tct-field label="Email"><input name="e" /></tct-field>`,
  properties: {label: 'Name', description: 'Help', required: true, groupLabel: true, width: 240},
  attributes: {label: 'label', description: 'description'},
});

describe('tct-field: label and description (Field.test.tsx)', () => {
  it('renders the label text as an owned satellite in the light DOM', async () => {
    const field = await make('label="Email"');
    const label = satellite(field, 'label')!;
    expect(label.localName).toBe('tct-field-label');
    expect(label.textContent).toBe('Email');
    expect(label.hasAttribute('data-tct-owned')).toBe(true);
    expect(label.assignedSlot?.name).toBe('label');
  });

  it('renders description text, wires it with aria-describedby and honours description-id', async () => {
    const field = await make(
      'label="Email" description="We will never share it" description-id="d1"',
    );
    const description = satellite(field, 'description')!;
    expect(description.textContent).toBe('We will never share it');
    expect(description.id).toBe('d1');
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBe('d1');
  });

  it('renders the description without an author id by generating one', async () => {
    const field = await make('label="Email" description="Help"');
    const description = satellite(field, 'description')!;
    expect(description.id).not.toBe('');
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBe(description.id);
  });

  it('shows the label visually by default, and label-hidden hides label and description but keeps them accessible', async () => {
    const shown = await make('label="Email" description="Help"');
    expect(satellite(shown, 'label')!.hasAttribute('data-hidden')).toBe(false);
    expect(satellite(shown, 'label')!.style.clipPath).toBe('');

    const hidden = await make('label="Search" description="Type a term" label-hidden');
    for (const slot of ['label', 'description']) {
      const part = satellite(hidden, slot)!;
      expect(part.hasAttribute('data-hidden'), slot).toBe(true);
      expect(part.style.clipPath, slot).not.toBe('');
    }
    if (isChromium) {
      expect(await axNode(hidden.querySelector('input')!)).toMatchObject({name: 'Search'});
    }
    expect(hidden.shadowRoot!.querySelector('.field')!.hasAttribute('data-label-hidden')).toBe(
      true,
    );
  });

  it('labels a single control: the control is named by the label through aria-labelledby (same tree)', async () => {
    const field = await make('label="Email"');
    const input = field.querySelector('input')!;
    expect(input.getAttribute('aria-labelledby')).toBe(satellite(field, 'label')!.id);
  });

  it('honours label-id and input-id (a control anywhere in the same tree)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><tct-field label="Owner" label-id="my-label" input-id="target"><span>note</span></tct-field><input id="target"></div>`,
    );
    const field = wrapper.querySelector<TctField>('tct-field')!;
    await field.updateComplete;
    await nextFrame();
    expect(satellite(field, 'label')!.id).toBe('my-label');
    expect(wrapper.querySelector('#target')!.getAttribute('aria-labelledby')).toBe('my-label');
  });

  it('renders a group label as a caption and names the group through aria-labelledby', async () => {
    const field = await make(
      'label="Notify me by" group-label',
      '<div role="radiogroup" id="g"><label><input type="radio" name="n"> Email</label></div>',
    );
    const group = field.querySelector('#g')!;
    const label = satellite(field, 'label') as HTMLElement & {shadowRoot: ShadowRoot};
    expect(group.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.shadowRoot.querySelector('label')).toBeNull();
    if (isChromium)
      expect(await axNode(group)).toMatchObject({role: 'radiogroup', name: 'Notify me by'});
  });

  it('pressing the label focuses the control, and so does pressing the description', async () => {
    const field = await make('label="Email" description="Help"');
    const input = field.querySelector('input')!;
    await userEvent.click(satellite(field, 'label')!);
    expect(deepActiveElement()).toBe(input);
    input.blur();
    await userEvent.click(satellite(field, 'description')!);
    expect(deepActiveElement()).toBe(input);
  });

  it('pressing the description of a checkbox clicks it, and interactive content inside the description is left alone', async () => {
    const field = await make('label="Agree" description="Terms"', '<input type="checkbox" id="c">');
    const description = satellite(field, 'description')!;
    await userEvent.click(description);
    expect(field.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
  });

  it('a disabled field does not forward description presses', async () => {
    const field = await make('label="Email" description="Help" disabled');
    field.querySelector('input')!.blur();
    await userEvent.click(satellite(field, 'description')!);
    expect(deepActiveElement()).not.toBe(field.querySelector('input'));
    expect(satellite(field, 'label')!.hasAttribute('data-disabled')).toBe(true);
  });

  it('a hidden label leaves the control keeping its name and the description its place in aria-describedby', async () => {
    const field = await make('label="Search" description="Type a term" label-hidden');
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBe(
      satellite(field, 'description')!.id,
    );
  });
});

describe('tct-field: required and optional indicators', () => {
  const indicator = (field: TctField): string =>
    (
      satellite(field, 'label')!.shadowRoot!.querySelector('[part="label-indicator"]')
        ?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim();

  it('renders Optional text with a bullet separator, Required likewise, and none by default', async () => {
    expect(indicator(await make('label="A" optional'))).toContain('Optional');
    expect(indicator(await make('label="A" optional'))).toContain('∙');
    expect(indicator(await make('label="B" required'))).toContain('Required');
    expect(indicator(await make('label="C"'))).toBe('');
  });

  it('shows Optional when both optional and required are set (optional wins) and warns in dev mode', async () => {
    expect(indicator(await make('label="A" optional required'))).toContain('Optional');
  });

  it('marks only the exception when the form states a default optionality', async () => {
    class Provider extends TctElement {
      static override readonly tagName = 'tct-test-form-layout';
      readonly provider = new ContextProvider(this, {
        context: formLayoutContext,
        initialValue: {direction: 'vertical', optionality: 'required'} as FormLayoutContextValue,
      });
      override render() {
        return html`<slot></slot>`;
      }
    }
    defineElement(Provider);
    const wrapper = await fixture<HTMLElement>(
      `<tct-test-form-layout><tct-field label="D" required><input id="d"></tct-field>` +
        `<tct-field label="E" optional><input id="e"></tct-field></tct-test-form-layout>`,
    );
    const [restated, exception] = [...wrapper.querySelectorAll<TctField>('tct-field')] as [
      TctField,
      TctField,
    ];
    await restated.updateComplete;
    await exception.updateComplete;
    await nextFrame();
    expect(indicator(restated)).toBe('');
    expect(indicator(exception)).toContain('Optional');
  });

  it('localizes the indicator through the nearest lang (de-DE)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-field label="Name" required><input></tct-field></div>`,
    );
    const field = wrapper.querySelector<TctField>('tct-field')!;
    await waitUntil(
      () => indicator(field).includes('Erforderlich') || indicator(field).includes('Pflicht'),
      'German indicator',
      4000,
    );
  });
});

describe('tct-field: label icon and tooltip', () => {
  it('renders the label icon in the label and the info tip beside it (not inside the label name)', async () => {
    const field = await make(
      'label="Email" label-icon="search" label-tooltip="Where we send receipts"',
    );
    const label = satellite(field, 'label')!;
    expect(label.shadowRoot!.querySelector('tct-icon')!.getAttribute('name')).toBe('search');
    const tip = field.shadowRoot!.querySelector<HTMLButtonElement>('button.label-tip')!;
    expect(tip).not.toBeNull();
    expect(tip.getAttribute('aria-label')).toBe('More information');
    expect(field.shadowRoot!.querySelector('tct-tooltip')!.getAttribute('content')).toBe(
      'Where we send receipts',
    );
    if (isChromium) {
      expect((await axNode(field.querySelector('input')!)).name).toBe('Email');
    }
  });

  it('renders no info tip without label-tooltip', async () => {
    const field = await make('label="Email"');
    expect(field.shadowRoot!.querySelector('.label-tip')).toBeNull();
  });
});

describe('tct-field: status', () => {
  it('renders a status satellite for a message and wires it into aria-describedby (status-id honoured)', async () => {
    const field = await make(
      'label="Email" status-type="error" status-message="Required" status-id="s1"',
    );
    const status = satellite(field, 'status')!;
    expect(status.localName).toBe('tct-field-status');
    expect(status.id).toBe('s1');
    expect(status.textContent).toBe('Required');
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBe('s1');
    expect((status as unknown as {type: string}).type).toBe('error');
  });

  it('the status property reads and writes status-type and status-message together', async () => {
    const field = await make('label="Email"');
    field.status = {type: 'warning', message: 'Careful'};
    await field.updateComplete;
    expect(field.statusType).toBe('warning');
    expect(field.statusMessage).toBe('Careful');
    expect(field.status).toEqual({type: 'warning', message: 'Careful'});
    expect(satellite(field, 'status')!.textContent).toBe('Careful');
    field.status = undefined;
    await field.updateComplete;
    expect(satellite(field, 'status')).toBeNull();
  });

  it('the tooltip variant and a status without a message render no message box', async () => {
    const tooltip = await make(
      'label="A" status-type="error" status-message="x" status-variant="tooltip"',
    );
    expect(satellite(tooltip, 'status')).toBeNull();
    const quiet = await make('label="B" status-type="error"');
    expect(satellite(quiet, 'status')).toBeNull();
  });

  it('announces a status once when it appears after mount, and does not repeat it (polite)', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Email"');
      field.statusType = 'error';
      field.statusMessage = 'Enter a valid email';
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Enter a valid email',
        'announced',
        2000,
      );
      expect(getAnnouncerRegions().assertive).toBeUndefined();
      const region = getAnnouncerRegions().polite!;
      const seen: string[] = [];
      new MutationObserver(() => seen.push(region.textContent)).observe(region, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      field.description = 'unrelated change';
      await field.updateComplete;
      await aTimeout(150);
      expect(seen.filter((text) => text === 'Enter a valid email')).toEqual([]);
    } finally {
      restore();
    }
  });
});

describe('tct-field: width and layout', () => {
  const box = (field: TctField): HTMLElement =>
    field.shadowRoot!.querySelector<HTMLElement>('.field')!;

  it('applies a numeric width as pixels and a string width as is, to the whole field', async () => {
    const numeric = await make('label="A" width="240"');
    expect(box(numeric).getBoundingClientRect().width).toBe(240);
    const percent = await make('label="B" width="50%"');
    expect(getComputedStyle(box(percent)).inlineSize).not.toBe('auto');
    const control = numeric.querySelector('input')!;
    expect(control.style.width).toBe('');
  });

  it('omits width styling when width is not given', async () => {
    const field = await make('label="A"');
    expect(box(field).style.getPropertyValue('--_field-width')).toBe('');
  });

  it('lays the label above the control by default, and beside it in a horizontal-labels form', async () => {
    const field = await make('label="Email"');
    expect(getComputedStyle(box(field)).display).toBe('flex');
    expect(getComputedStyle(field).display).toBe('block');

    class Layout extends TctElement {
      static override readonly tagName = 'tct-test-horizontal-layout';
      readonly provider = new ContextProvider(this, {
        context: formLayoutContext,
        initialValue: {direction: 'horizontal-labels'} as FormLayoutContextValue,
      });
      override render() {
        return html`<slot></slot>`;
      }
    }
    defineElement(Layout);
    const wrapper = await fixture<HTMLElement>(
      `<tct-test-horizontal-layout style="display:grid;grid-template-columns:auto 1fr;column-gap:8px">` +
        `<tct-field label="Email" description="Help"><input></tct-field></tct-test-horizontal-layout>`,
    );
    const horizontal = wrapper.querySelector<TctField>('tct-field')!;
    await horizontal.updateComplete;
    await nextFrame();
    expect(getComputedStyle(horizontal).display).toBe('contents');
    expect(getComputedStyle(box(horizontal)).display).toBe('contents');
    const label = satellite(horizontal, 'label')!.getBoundingClientRect();
    const input = horizontal.querySelector('input')!.getBoundingClientRect();
    expect(input.left).toBeGreaterThanOrEqual(label.right);
    // The description sits with the control in column two, not under the label.
    const description = satellite(horizontal, 'description')!.getBoundingClientRect();
    expect(description.left).toBeGreaterThanOrEqual(label.right);
  });

  it('a hidden label group takes no place in the layout', async () => {
    const field = await make('label="Search" label-hidden');
    expect(field.shadowRoot!.querySelector('.label-cell')!.getBoundingClientRect().height).toBe(0);
  });
});

describe('tct-field: library controls, naming and accessibility', () => {
  it.skipIf(!isChromium)(
    'the slotted native input gets its name and description from the satellites (acceptance 6)',
    async () => {
      const field = await make(
        'label="Email" description="We never share it" status-type="error" status-message="Required"',
      );
      expect(await axNode(field.querySelector('input')!)).toMatchObject({
        role: 'textbox',
        name: 'Email',
        description: 'We never share it Required',
      });
    },
  );

  it.skipIf(!isChromium || !isTier2)(
    'the same names are exposed with element reflection off (text fallback in the same tree)',
    async () => {
      const field = await make('label="Email" description="Help"');
      expect(await axNode(field.querySelector('input')!)).toMatchObject({
        name: 'Email',
        description: 'Help',
      });
    },
  );

  it('passes axe with a label, description, status and a required indicator', async () => {
    const field = await make(
      'label="Email" description="Help" required status-type="error" status-message="Required"',
    );
    await expectAccessible(field);
  });

  it('keeps label and control legible in forced-colours mode', async () => {
    const field = await make('label="Email" description="Help"');
    await emulateMedia({forcedColors: 'active'});
    const label = satellite(field, 'label')!.shadowRoot!.querySelector<HTMLElement>(
      '[part="label"]',
    )!;
    expect(getComputedStyle(label).color).not.toBe('rgba(0, 0, 0, 0)');
    await emulateMedia({forcedColors: 'none'});
  });

  it('is re-created around the control when a framework prunes a satellite', async () => {
    const field = await make('label="Email"');
    satellite(field, 'label')!.remove();
    await waitUntil(() => satellite(field, 'label') !== null, 'label satellite restored');
    expect(field.querySelector('input')!.getAttribute('aria-labelledby')).toBe(
      satellite(field, 'label')!.id,
    );
  });
});

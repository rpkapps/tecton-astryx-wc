/**
 * `FieldChromeController` (A§9.8): label, description and status of a control and their ARIA wiring,
 * in shadow mode (everything in the control's shadow root) and light mode (owned light-DOM
 * satellites around a slotted control).
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {beforeAll, describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {formLayoutContext, type FormOptionality} from '@tecton-astryx/core/context/keys.js';
import {FieldChromeController} from '@tecton-astryx/core/controllers/field-chrome.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {axNode} from '../a11y.js';
import {fixture} from '../fixture.js';
import {isChromium} from '../tier.js';
import {nextFrame, waitUntil} from '../timing.js';

/** A satellite: text stays in light DOM so it takes part in name computation. */
class TctTestPart extends TctElement {
  static override readonly tagName = 'tct-test-part';
  override render() {
    return html`<slot></slot>`;
  }
}

class TctTestField extends TctElement {
  static override readonly tagName = 'tct-test-field';
  static override readonly dependencies = [TctTestPart];
  @property() label = '';
  @property() description = '';
  @property() message = '';
  @property({attribute: 'status-type'}) statusType: 'error' | 'warning' | 'success' | 'info' =
    'error';
  @property({attribute: 'status-variant'}) statusVariant: 'attached' | 'detached' | 'tooltip' =
    'attached';
  @property({type: Boolean}) required = false;
  @property({type: Boolean}) optional = false;
  @property({type: Boolean}) disabled = false;
  @property({type: Boolean, attribute: 'label-hidden'}) labelHidden = false;
  @property({type: Boolean, attribute: 'group-label'}) groupLabel = false;
  @property() mode: 'shadow' | 'light' = 'shadow';

  readonly chrome: FieldChromeController = new FieldChromeController(this, {
    mode: () => this.mode,
    control: () =>
      this.mode === 'light'
        ? this.querySelector<HTMLElement>(':scope > input, :scope > [data-control]')
        : this.renderRoot.querySelector<HTMLElement>('input, [data-control]'),
    state: () => ({
      label: this.label,
      labelHidden: this.labelHidden,
      description: this.description || undefined,
      status: this.message ? {type: this.statusType, message: this.message} : undefined,
      statusVariant: this.statusVariant,
      required: this.required,
      optional: this.optional,
      disabled: this.disabled,
      size: 'md',
      groupLabel: this.groupLabel,
    }),
    tags: {label: 'tct-test-part', description: 'tct-test-part', status: 'tct-test-part'},
  });

  override render() {
    return html`${this.chrome.renderLabel()}
      ${
        this.groupLabel
          ? html`<div role="group" data-control tabindex="0"></div>`
          : this.mode === 'shadow'
            ? html`<input />`
            : html`<slot></slot>`
      }
      ${this.chrome.renderDescription()}${this.chrome.renderStatus()} <slot name="label"></slot
      ><slot name="description"></slot><slot name="status"></slot>`;
  }
}

class TctTestLayoutProvider extends TctElement {
  static override readonly tagName = 'tct-test-layout-provider';
  @property() optionality: FormOptionality = 'required';
  readonly provider = new ContextProvider(this, {
    context: formLayoutContext,
    initialValue: {direction: 'vertical'},
  });
  protected override willUpdate(): void {
    this.provider.setValue({direction: 'vertical', optionality: this.optionality});
  }
  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-field': TctTestField;
    'tct-test-part': TctTestPart;
    'tct-test-layout-provider': TctTestLayoutProvider;
  }
}

beforeAll(() => {
  defineElement(TctTestField);
  defineElement(TctTestLayoutProvider);
});

async function field(attributes: string, content = ''): Promise<TctTestField> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div><tct-test-field ${attributes}>${content}</tct-test-field></div>`,
  );
  const host = wrapper.querySelector('tct-test-field')!;
  await host.updateComplete;
  await nextFrame();
  return host;
}

const shadowPart = (host: TctTestField, name: string): HTMLElement | null =>
  host.renderRoot.querySelector<HTMLElement>(`[part="${name}"]`);
const inputOf = (host: TctTestField): HTMLElement => host.renderRoot.querySelector('input')!;

describe('shadow mode', () => {
  it('renders a real <label for> pointing at the control, and wires aria-describedby', async () => {
    const host = await field('label="Email" description="We never share it" message="Required" ');
    const label = shadowPart(host, 'label') as HTMLLabelElement;
    const input = inputOf(host);
    expect(label.localName).toBe('label');
    expect(label.htmlFor).toBe(input.id);
    expect(input.id).not.toBe('');
    expect(input.getAttribute('aria-describedby')!.split(' ')).toEqual([
      shadowPart(host, 'description')!.id,
      shadowPart(host, 'status')!.id,
    ]);
    expect(shadowPart(host, 'status')!.getAttribute('data-status-type')).toBe('error');
  });

  it.skipIf(!isChromium)(
    'the computed accessibility tree names and describes the control',
    async () => {
      const host = await field('label="Email" description="We never share it"');
      expect(await axNode(inputOf(host))).toMatchObject({
        role: 'textbox',
        name: 'Email',
        description: 'We never share it',
      });
    },
  );

  it('clicking the label focuses the control (a real label does)', async () => {
    const host = await field('label="Email"');
    shadowPart(host, 'label')!.click();
    expect(host.shadowRoot!.activeElement).toBe(inputOf(host));
  });

  it('a hidden label stays in the DOM (visually hidden) so the control keeps its name', async () => {
    const host = await field('label="Search" label-hidden description="Type a term"');
    const label = shadowPart(host, 'label')!;
    expect(label.hasAttribute('data-hidden')).toBe(true);
    expect(label.getAttribute('style')).toContain('clip-path');
    expect(shadowPart(host, 'description')!.hasAttribute('data-hidden')).toBe(true);
    if (isChromium) expect(await axNode(inputOf(host))).toMatchObject({name: 'Search'});
  });

  it('marks required and optional as text, and only when they differ from the form default', async () => {
    const required = await field('label="A" required');
    expect(shadowPart(required, 'label-indicator')!.textContent).toContain('Required');
    const optional = await field('label="B" optional');
    expect(shadowPart(optional, 'label-indicator')!.textContent).toContain('Optional');
    expect(shadowPart(await field('label="C"'), 'label-indicator')).toBeNull();

    const wrapper = await fixture<TctTestLayoutProvider>(
      `<tct-test-layout-provider optionality="required"><tct-test-field label="D" required></tct-test-field><tct-test-field label="E" optional></tct-test-field></tct-test-layout-provider>`,
    );
    const [restated, exception] = wrapper.querySelectorAll('tct-test-field') as unknown as [
      TctTestField,
      TctTestField,
    ];
    await restated.updateComplete;
    await exception.updateComplete;
    await nextFrame();
    // Everything is required by default: the required field restates it, the optional one is the exception.
    expect(shadowPart(restated, 'label-indicator')).toBeNull();
    expect(shadowPart(exception, 'label-indicator')!.textContent).toContain('Optional');
  });

  it('a group label is a span and the group is named through aria-labelledby', async () => {
    const host = await field('label="Notify me by" group-label');
    const label = shadowPart(host, 'label')!;
    expect(label.localName).toBe('span');
    const group = host.renderRoot.querySelector<HTMLElement>('[data-control]')!;
    expect(group.getAttribute('aria-labelledby')).toBe(label.id);
    expect(group.id).toBe('');
  });

  it('updates the wiring when parts appear and disappear, keeping the author’s own tokens', async () => {
    const host = await field('label="Name"');
    const input = inputOf(host);
    input.setAttribute('aria-describedby', 'author-hint');
    host.description = 'Help';
    await host.updateComplete;
    expect(input.getAttribute('aria-describedby')!.split(' ').sort()).toEqual(
      ['author-hint', shadowPart(host, 'description')!.id].sort(),
    );
    host.description = '';
    await host.updateComplete;
    expect(input.getAttribute('aria-describedby')).toBe('author-hint');
    input.removeAttribute('aria-describedby');
    host.message = 'Bad';
    await host.updateComplete;
    host.message = '';
    await host.updateComplete;
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('the tooltip variant renders no status (the control surfaces it)', async () => {
    const host = await field('label="Name" message="Bad" status-variant="tooltip"');
    expect(shadowPart(host, 'status')).toBeNull();
    expect(inputOf(host).hasAttribute('aria-describedby')).toBe(false);
  });

  it('exposes stable ids', async () => {
    const host = await field('label="Name"');
    expect(host.chrome.labelId).toBe(host.chrome.labelId);
    expect(
      new Set([
        host.chrome.labelId,
        host.chrome.descriptionId,
        host.chrome.statusId,
        host.chrome.controlId,
      ]).size,
    ).toBe(4);
    expect(host.chrome.satellite('label')).toBeUndefined();
  });
});

describe('status announcement', () => {
  it('speaks a message once when it appears or changes, not on unrelated re-renders', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const host = await field('label="Name"');
      host.message = 'Enter a name';
      await host.updateComplete;
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Enter a name',
        'first announcement',
        1500,
      );
      // Unrelated update: nothing new to say.
      host.description = 'Help';
      await host.updateComplete;
      const region = getAnnouncerRegions().polite!;
      const seen: string[] = [];
      new MutationObserver(() => seen.push(region.textContent)).observe(region, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      host.requestUpdate();
      await host.updateComplete;
      await nextFrame();
      expect(seen).toEqual([]);

      host.message = 'Name is too short';
      await waitUntil(
        () => region.textContent === 'Name is too short',
        'changed message spoken',
        1500,
      );
    } finally {
      restore();
    }
  });

  it('is polite and never a role=alert bound to the message', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const host = await field('label="Name" message="Bad"');
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'Bad', 'announced', 1500);
      expect(getAnnouncerRegions().assertive).toBeUndefined();
      expect(shadowPart(host, 'status')!.hasAttribute('role')).toBe(false);
    } finally {
      restore();
    }
  });

  it('a message that goes away and comes back is announced again', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const host = await field('label="Name" message="Bad"');
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'Bad', 'first', 1500);
      host.message = '';
      await host.updateComplete;
      host.message = 'Bad';
      await host.updateComplete;
      const region = getAnnouncerRegions().polite!;
      await waitUntil(() => region.textContent === '', 'cleared before repeating', 1500);
      await waitUntil(() => region.textContent === 'Bad', 'announced again', 2500);
    } finally {
      restore();
    }
  });
});

describe('light mode (slotted control, owned satellites)', () => {
  const light = (attributes: string, control = '<input />') =>
    field(`mode="light" ${attributes}`, control);
  const satellite = (host: TctTestField, name: string): HTMLElement | null =>
    host.querySelector<HTMLElement>(`:scope > [slot="${name}"]`);

  it('renders satellites in the light DOM with text, assigned to their slots', async () => {
    const host = await light('label="Email" description="Help" message="Bad"');
    for (const [name, text] of [
      ['label', 'Email'],
      ['description', 'Help'],
      ['status', 'Bad'],
    ] as const) {
      const part = satellite(host, name)!;
      expect(part.textContent, name).toBe(text);
      expect(part.hasAttribute('data-tct-owned'), name).toBe(true);
      expect(part.assignedSlot?.name, name).toBe(name);
    }
    expect(satellite(host, 'status')!.getAttribute('data-status-type')).toBe('error');
    expect(host.chrome.satellite('label')).toBe(satellite(host, 'label'));
    // Nothing is rendered in the shadow root in this mode.
    expect(shadowPart(host, 'label')).toBeNull();
  });

  it('wires the slotted control with aria-labelledby and aria-describedby in the light tree', async () => {
    const host = await light('label="Email" description="Help" message="Bad"');
    const input = host.querySelector('input')!;
    expect(input.getAttribute('aria-labelledby')).toBe(satellite(host, 'label')!.id);
    expect(input.getAttribute('aria-describedby')!.split(' ')).toEqual([
      satellite(host, 'description')!.id,
      satellite(host, 'status')!.id,
    ]);
    if (isChromium) {
      expect(await axNode(input)).toMatchObject({name: 'Email', description: 'Help Bad'});
    }
  });

  it('clicking the label satellite focuses the control, unless disabled', async () => {
    const host = await light('label="Email"');
    satellite(host, 'label')!.click();
    expect(document.activeElement).toBe(host.querySelector('input'));
    host.querySelector('input')!.blur();
    host.disabled = true;
    await host.updateComplete;
    satellite(host, 'label')!.click();
    expect(document.activeElement).not.toBe(host.querySelector('input'));
  });

  it('removes satellites and tokens that are no longer wanted, and keeps author tokens', async () => {
    const host = await light(
      'label="Email" description="Help"',
      '<input aria-describedby="author-hint" />',
    );
    const input = host.querySelector('input')!;
    expect(input.getAttribute('aria-describedby')).toContain('author-hint');
    host.description = '';
    await host.updateComplete;
    await nextFrame();
    expect(satellite(host, 'description')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe('author-hint');
  });

  it('restores a satellite that a framework pruned', async () => {
    const host = await light('label="Email"');
    satellite(host, 'label')!.remove();
    await waitUntil(() => satellite(host, 'label') !== null, 'label satellite restored');
    expect(host.querySelector('input')!.getAttribute('aria-labelledby')).toBe(
      satellite(host, 'label')!.id,
    );
  });
});

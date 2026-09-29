/**
 * `tct-stepper` and `tct-step`: list semantics and `aria-current="step"`, the indicator per progress and
 * status (with the status as text for assistive technology), clickable steps in a navigable stepper,
 * the connector fill (one forward step animates, everything else lands at once), the collapsed layout
 * with its summary and controls, on-track and vertical arrangements, RTL, localisation and contrast in
 * every state. Test names follow upstream `Stepper.test.tsx`.
 */
import {html} from 'lit';
import {cdp, userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import './define.js';
import type {TctStep} from './tct-step.js';
import type {TctStepper} from './tct-stepper.js';

const STEPS =
  '<tct-step label="Account"></tct-step><tct-step label="Profile" description="Tell us about you"></tct-step>' +
  '<tct-step label="Review"></tct-step>';

async function stepper(
  attributes = 'active-step="1"',
  inner = STEPS,
  wrapperStyle = 'width: 480px',
): Promise<TctStepper> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="${wrapperStyle}"><button id="before">before</button><tct-stepper ${attributes}>${inner}</tct-stepper></div>`,
  );
  const element = wrapper.querySelector('tct-stepper')!;
  await settleSteps(element);
  return element;
}

async function settleSteps(element: Element): Promise<void> {
  await (element as TctStepper).updateComplete;
  for (let pass = 0; pass < 2; pass++) {
    await Promise.all([...element.children].map((child) => (child as TctStep).updateComplete));
    await nextFrame();
  }
  await (element as TctStepper).updateComplete;
}

const steps = (element: Element): TctStep[] => [...element.children] as TctStep[];
const root = (step: TctStep): HTMLElement => step.shadowRoot!.querySelector<HTMLElement>('.step')!;
const indicator = (step: TctStep): HTMLElement | null => step.shadowRoot!.querySelector<HTMLElement>('.indicator');
const button = (step: TctStep): HTMLButtonElement | null => step.shadowRoot!.querySelector<HTMLButtonElement>('button');
const list = (element: TctStepper): HTMLElement => element.shadowRoot!.querySelector<HTMLElement>('.list')!;
const summary = (element: TctStepper): HTMLElement | null => element.shadowRoot!.querySelector<HTMLElement>('.summary');

runElementSuite({
  tag: 'tct-stepper',
  render: () =>
    html`<tct-stepper active-step="1"
      ><tct-step label="One"></tct-step><tct-step label="Two"></tct-step></tct-stepper
    >`,
  properties: {
    activeStep: 1,
    orientation: 'vertical',
    navigable: true,
    density: 'spacious',
    indicatorPosition: 'on-track',
    collapsedVariant: 'hidden-label',
    minimumStepWidth: 90,
  },
  attributes: {
    orientation: 'orientation',
    navigable: 'navigable',
    density: 'density',
    indicatorPosition: 'indicator-position',
    collapsedVariant: 'collapsed-variant',
  },
  events: ['tct-value-change'],
});

runElementSuite({
  tag: 'tct-step',
  render: () =>
    html`<tct-stepper active-step="0"
      ><tct-step id="under-test" label="One"></tct-step><tct-step label="Two"></tct-step></tct-stepper
    >`,
  properties: {
    step: 3,
    label: 'Other',
    description: 'More',
    status: 'error',
    indicator: 'number',
    disabled: true,
    optional: true,
    density: 'compact',
  },
  attributes: {label: 'label', description: 'description', indicator: 'indicator'},
  skip: ['hostBox'],
});

describe('tct-stepper: semantics', () => {
  it('renders an ordered list of steps (not a nav landmark)', async () => {
    const element = await stepper();
    expect(element.shadowRoot!.querySelector('nav')).toBeNull();
    expect(list(element).localName).toBe('ol');
    expect(await axNode(list(element))).toMatchObject({role: 'list', name: 'Progress'});
    for (const step of steps(element)) expect(await axNode(step)).toMatchObject({role: 'listitem'});
  });

  it('renders step numbers on steps that are not reached, and a check once completed', async () => {
    const element = await stepper('active-step="1"');
    const [done, current, next] = steps(element);
    expect(indicator(done!)!.dataset.kind).toBe('progress');
    expect(indicator(done!)!.querySelector('svg')).not.toBeNull();
    expect(indicator(current!)!.dataset.kind).toBe('progress');
    expect(indicator(next!)!.dataset.kind).toBe('number');
    expect(indicator(next!)!.textContent).toBe('3');
  });

  it('marks the active step with aria-current="step"', async () => {
    const element = await stepper('active-step="1"');
    const [first, second, third] = steps(element);
    expect(second!.matches(':state(active)')).toBe(true);
    expect(first!.matches(':state(active)')).toBe(false);
    expect(first!.matches(':state(completed)')).toBe(true);
    expect(third!.matches(':state(completed)')).toBe(false);
    // The state is ElementInternals ARIA on the host (Chromium's AX helper does not surface `current`).
    const current = (step: TctStep): string | null => (step as unknown as {internals: ElementInternals}).internals.ariaCurrent;
    expect(steps(element).map(current)).toEqual([null, 'step', null]);
    expect(await axNode(second!)).toMatchObject({role: 'listitem'});
  });

  it('handles the first step as active', async () => {
    const element = await stepper('active-step="0"');
    expect(steps(element)[0]!.matches(':state(active)')).toBe(true);
  });

  it('renders descriptions when provided', async () => {
    const element = await stepper();
    expect(steps(element)[1]!.shadowRoot!.querySelector('.description')!.textContent).toBe('Tell us about you');
    expect(steps(element)[0]!.shadowRoot!.querySelector('.description')).toBeNull();
  });

  it('supports a custom accessible label and a host aria-label', async () => {
    const custom = await stepper('active-step="0" label="Checkout progress"');
    expect(await axNode(list(custom))).toMatchObject({name: 'Checkout progress'});
    const host = await stepper('active-step="0" aria-label="Sign-up flow"');
    expect(await axNode(list(host))).toMatchObject({name: 'Sign-up flow'});
  });

  it('infers a step index from its position, and honours an explicit step', async () => {
    const element = await stepper(
      'active-step="5"',
      '<tct-step label="A"></tct-step><tct-step label="B" step="5"></tct-step>',
    );
    expect(steps(element)[0]!.index).toBe(0);
    expect(steps(element)[1]!.index).toBe(5);
    expect(steps(element)[1]!.matches(':state(active)')).toBe(true);
  });

  it('warns about two steps sharing an index', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    resetDevWarnings();
    try {
      await stepper('active-step="0"', '<tct-step label="A" step="1"></tct-step><tct-step label="B" step="1"></tct-step>');
      expect(warn.mock.calls.some((call) => String(call[0]).includes('Duplicate step index 1'))).toBe(true);
    } finally {
      globalThis.tctDevMode = undefined;
      warn.mockRestore();
    }
  });

  it('supports vertical orientation', async () => {
    const element = await stepper('active-step="1" orientation="vertical"');
    const [a, b] = steps(element).map((step) => step.getBoundingClientRect());
    expect(b!.top).toBeGreaterThan(a!.top + a!.height - 1);
    expect(root(steps(element)[0]!).dataset.orientation).toBe('vertical');
  });
});

describe('tct-step: status and indicators', () => {
  it('reflects the status and exposes it as visually hidden text (indicators are aria-hidden)', async () => {
    const element = await stepper(
      'active-step="3"',
      '<tct-step label="Done"></tct-step><tct-step label="Bad" status="error"></tct-step><tct-step label="Careful" status="warning"></tct-step><tct-step label="Now"></tct-step>',
    );
    const words = steps(element).map((step) => step.shadowRoot!.querySelector('.visually-hidden')?.textContent ?? null);
    expect(words).toEqual(['completed', 'error', 'warning', null]);
    expect(indicator(steps(element)[1]!)!.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a distinct glyph per status on non-current steps and a colour badge on unreached ones', async () => {
    const element = await stepper(
      'active-step="0"',
      '<tct-step label="Now"></tct-step><tct-step label="A" status="success"></tct-step><tct-step label="B" status="warning"></tct-step><tct-step label="C" status="error"></tct-step>',
    );
    const names = steps(element).slice(1).map((step) => indicator(step)!.querySelector('tct-icon')?.getAttribute('name'));
    expect(names).toEqual(['success', 'warning', 'error']);
  });

  it('lets the current step keep its ring regardless of status', async () => {
    const element = await stepper('active-step="0"', '<tct-step label="Now" status="error"></tct-step>');
    const ind = indicator(steps(element)[0]!)!;
    expect(ind.dataset.kind).toBe('progress');
    expect(ind.querySelector('svg')).not.toBeNull();
    expect(ind.dataset.status).toBe('error');
  });

  it('indicator="number" always shows a number and indicator="none" shows none', async () => {
    const element = await stepper(
      'active-step="1"',
      '<tct-step label="A" indicator="number"></tct-step><tct-step label="B" indicator="none"></tct-step>',
    );
    expect(indicator(steps(element)[0]!)!.textContent).toBe('1');
    expect(indicator(steps(element)[1]!)).toBeNull();
  });

  it('accepts a slotted custom indicator', async () => {
    const element = await stepper(
      'active-step="0"',
      '<tct-step label="A"><tct-icon slot="indicator" name="check"></tct-icon></tct-step>',
    );
    const ind = indicator(steps(element)[0]!)!;
    expect(ind.dataset.kind).toBe('custom');
    expect(ind.querySelector('slot[name="indicator"]')).not.toBeNull();
  });

  it('shows "Optional" after the label and the end slot at the end of the row', async () => {
    const element = await stepper(
      'active-step="0"',
      '<tct-step label="A" optional><span slot="end">2 min</span></tct-step>',
    );
    const step = steps(element)[0]!;
    expect(step.shadowRoot!.querySelector('.optional')!.textContent).toBe('Optional');
    expect(step.shadowRoot!.querySelector('.end slot[name="end"]')).not.toBeNull();
  });

  it('keeps status colour out of the connector: the bar follows progress only', async () => {
    const element = await stepper('active-step="1"', '<tct-step label="A" status="error"></tct-step><tct-step label="B"></tct-step>');
    expect(steps(element)[0]!.shadowRoot!.querySelector('.seg')!.hasAttribute('data-filled')).toBe(true);
    expect(root(steps(element)[0]!).dataset.status).toBe('error');
  });
});

describe('tct-step: clickable steps (navigable)', () => {
  it('renders no buttons unless the stepper is navigable', async () => {
    const element = await stepper('active-step="1"');
    for (const step of steps(element)) expect(button(step)).toBeNull();
  });

  it('renders buttons for reached and upcoming steps, but not for disabled ones', async () => {
    const element = await stepper(
      'active-step="1" navigable',
      '<tct-step label="A"></tct-step><tct-step label="B"></tct-step><tct-step label="C"></tct-step><tct-step label="D" disabled></tct-step>',
    );
    expect(steps(element).map((step) => button(step) !== null)).toEqual([true, true, true, false]);
  });

  it('names a step button "Go to step N: label" and composes the status', async () => {
    const element = await stepper(
      'active-step="1" navigable',
      '<tct-step label="Account"></tct-step><tct-step label="Payment" status="error"></tct-step><tct-step label="Review"></tct-step>',
    );
    expect(await axNode(button(steps(element)[0]!)!)).toMatchObject({role: 'button', name: 'Go to step 1: Account, completed'});
    expect((await axNode(button(steps(element)[1]!)!)).name).toBe('Go to step 2: Payment, error');
    expect((await axNode(button(steps(element)[2]!)!)).name).toBe('Go to step 3: Review');
  });

  it('asks to activate the clicked step with a cancelable tct-value-change and applies it', async () => {
    const element = await stepper('active-step="1" navigable');
    const events = recordEvents(element, ['tct-value-change']);
    await userEvent.click(button(steps(element)[2]!)!);
    expectEventCounts(events, {'tct-value-change': 1});
    const event = events.events[0]!;
    expect(event).toMatchObject({value: 2, oldValue: 1, reason: 'pointer'});
    expect(event.bubbles && event.composed && event.cancelable).toBe(true);
    expect(element.activeStep).toBe(2);
    expect(steps(element)[2]!.matches(':state(active)')).toBe(true);
  });

  it('keeps the active step when the request is prevented (controlled use)', async () => {
    const element = await stepper('active-step="1" navigable');
    element.addEventListener('tct-value-change', (event) => event.preventDefault());
    await userEvent.click(button(steps(element)[0]!)!);
    expect(element.activeStep).toBe(1);
  });

  it('clicking the active step is not a change', async () => {
    const element = await stepper('active-step="1" navigable');
    const events = recordEvents(element, 'tct-value-change');
    await userEvent.click(button(steps(element)[1]!)!);
    expect(events.events).toHaveLength(0);
  });

  it('activates a step with Enter and Space', async () => {
    const element = await stepper('active-step="0" navigable');
    button(steps(element)[1]!)!.focus();
    await pressKeys('Enter');
    expect(element.activeStep).toBe(1);
    button(steps(element)[2]!)!.focus();
    await pressKeys(' ');
    expect(element.activeStep).toBe(2);
  });

  it('tabs through steps in document order, skipping disabled ones', async () => {
    const element = await stepper(
      'active-step="0" navigable',
      '<tct-step label="A"></tct-step><tct-step label="B" disabled></tct-step><tct-step label="C"></tct-step>',
    );
    const sequence = await tabSequence(element, {start: document.getElementById('before')!});
    const names = sequence.slice(0, 2).map((el) => el.getAttribute('aria-label'));
    expect(names).toEqual(['Go to step 1: A', 'Go to step 3: C']);
  });

  it('does not fire events on property writes of activeStep', async () => {
    const element = await stepper('active-step="0" navigable');
    const events = recordEvents(element, 'tct-value-change');
    element.activeStep = 2;
    await element.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('a controlled stepper sets active-step back from the event', async () => {
    const element = await stepper('active-step="0" navigable');
    element.addEventListener('tct-value-change', (event) => {
      event.preventDefault();
      element.activeStep = event.value as unknown as number;
    });
    await userEvent.click(button(steps(element)[2]!)!);
    expect(element.activeStep).toBe(2);
  });
});

describe('tct-stepper: connector fill', () => {
  const bar = (step: TctStep): HTMLElement => step.shadowRoot!.querySelector<HTMLElement>('.seg')!;
  const duration = (step: TctStep): string => bar(step).style.getPropertyValue('--_fill-duration');

  it('fills the bar of every step up to the active one, along the inline axis when horizontal', async () => {
    const element = await stepper('active-step="1"');
    expect(steps(element).map((step) => bar(step).hasAttribute('data-filled'))).toEqual([true, true, false]);
    expect(getComputedStyle(bar(steps(element)[2]!), '::before').transform).toBe('matrix(0, 0, 0, 1, 0, 0)');
    expect(getComputedStyle(bar(steps(element)[0]!), '::before').transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  it('scales along the block axis when vertical', async () => {
    const element = await stepper('active-step="0" orientation="vertical"');
    expect(getComputedStyle(bar(steps(element)[2]!), '::before').transform).toBe('matrix(1, 0, 0, 0, 0, 0)');
  });

  it('leaves every segment instant on mount', async () => {
    const element = await stepper('active-step="2"');
    expect(steps(element).map((step) => duration(step))).toEqual(['0s', '0s', '0s']);
  });

  it('animates the one span a single forward step crosses, over the medium duration', async () => {
    const element = await stepper('active-step="0"');
    element.activeStep = 1;
    await settleSteps(element);
    expect(steps(element).map((step) => duration(step))).toEqual(['0s', 'var(--duration-medium)', '0s']);
  });

  it('lands a forward jump of more than one step at once', async () => {
    const element = await stepper('active-step="0"');
    element.activeStep = 2;
    await settleSteps(element);
    expect(steps(element).map((step) => duration(step))).toEqual(['0s', '0s', '0s']);
  });

  it('lands a backward change at once', async () => {
    const element = await stepper('active-step="2"');
    element.activeStep = 1;
    await settleSteps(element);
    expect(steps(element).map((step) => duration(step))).toEqual(['0s', '0s', '0s']);
  });

  it('runs the leaving half of an on-track span before the arriving half', async () => {
    const element = await stepper('active-step="0" indicator-position="on-track"');
    element.activeStep = 1;
    await settleSteps(element);
    const seg = (step: TctStep, kind: string): HTMLElement =>
      step.shadowRoot!.querySelector<HTMLElement>(`.seg[data-kind="${kind}"]`)!;
    const rail = seg(steps(element)[0]!, 'rail').style;
    const lead = seg(steps(element)[1]!, 'lead').style;
    expect(rail.getPropertyValue('--_fill-delay')).toBe('0s');
    expect(lead.getPropertyValue('--_fill-delay')).not.toBe('0s');
  });

  it('does not run the fill under reduced motion', async () => {
    const session = cdp();
    await session.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    try {
      const element = await stepper('active-step="0"');
      element.activeStep = 1;
      await settleSteps(element);
      expect(getComputedStyle(bar(steps(element)[1]!), '::before').transitionDuration).toBe('0s');
    } finally {
      await session.send('Emulation.setEmulatedMedia', {features: []});
    }
  });
});

describe('tct-stepper: on-track arrangement', () => {
  it('draws the indicator on the rail with a segment before and after it', async () => {
    const element = await stepper('active-step="1" indicator-position="on-track"');
    const middle = steps(element)[1]!;
    const kinds = [...middle.shadowRoot!.querySelectorAll('.seg')].map((seg) => (seg as HTMLElement).dataset.kind);
    expect(kinds).toEqual(['lead', 'rail']);
    expect(middle.shadowRoot!.querySelector('.track-row .indicator')).not.toBeNull();
  });

  it('hides the segment before the first step and after the last', async () => {
    const element = await stepper('active-step="1" indicator-position="on-track"');
    const seg = (step: TctStep, kind: string): HTMLElement => step.shadowRoot!.querySelector<HTMLElement>(`.seg[data-kind="${kind}"]`)!;
    expect(getComputedStyle(seg(steps(element)[0]!, 'lead')).visibility).toBe('hidden');
    expect(getComputedStyle(seg(steps(element)[1]!, 'lead')).visibility).toBe('visible');
    expect(getComputedStyle(seg(steps(element)[2]!, 'rail')).visibility).toBe('hidden');
  });

  it('continues the vertical connector past a step content slot', async () => {
    const element = await stepper(
      'active-step="2" orientation="vertical" indicator-position="on-track"',
      '<tct-step label="A"><p>Content</p></tct-step><tct-step label="B"></tct-step><tct-step label="C"></tct-step>',
    );
    const kinds = [...steps(element)[0]!.shadowRoot!.querySelectorAll('.seg')].map((seg) => (seg as HTMLElement).dataset.kind);
    expect(kinds).toEqual(['lead', 'rail', 'content']);
  });

  it('exposes hidden status text in the on-track layout too', async () => {
    const element = await stepper('active-step="1" indicator-position="on-track"', '<tct-step label="A"></tct-step><tct-step label="B" status="error"></tct-step>');
    expect(steps(element)[0]!.shadowRoot!.querySelector('.visually-hidden')!.textContent).toBe('completed');
    expect(steps(element)[1]!.shadowRoot!.querySelector('.visually-hidden')!.textContent).toBe('error');
  });

  it('supports keyboard activation in the on-track layout', async () => {
    const element = await stepper('active-step="0" indicator-position="on-track" navigable');
    button(steps(element)[1]!)!.focus();
    await pressKeys('Enter');
    expect(element.activeStep).toBe(1);
  });
});

describe('tct-stepper: collapse (narrow containers)', () => {
  const FOUR =
    '<tct-step label="Account"></tct-step><tct-step label="Profile" description="About you"></tct-step><tct-step label="Payment"></tct-step><tct-step label="Review"></tct-step>';
  const collapsed = async (attributes = 'active-step="1"', width = 'width: 300px'): Promise<TctStepper> => {
    const element = await stepper(attributes, FOUR, width);
    await waitUntil(() => steps(element).every((step) => root(step).hasAttribute('data-compact')), 'collapsed');
    await settleSteps(element);
    return element;
  };

  it('keeps every label while each step has room for one', async () => {
    const element = await stepper('active-step="1"', FOUR, 'width: 600px');
    expect(steps(element).every((step) => !root(step).hasAttribute('data-compact'))).toBe(true);
    expect(summary(element)).toBeNull();
  });

  it('drops the labels and names the current step once they no longer fit', async () => {
    const element = await collapsed();
    const labels = steps(element).map((step) => step.shadowRoot!.querySelector('.label'));
    expect(labels.every((label) => label === null)).toBe(true);
    expect(summary(element)!.textContent).toContain('Profile');
    expect(summary(element)!.textContent).toContain('About you');
  });

  it('collapses later the more steps there are, and treats the minimum width as pixels', async () => {
    const wide = await stepper('active-step="1" minimum-step-width="60"', FOUR, 'width: 300px');
    expect(steps(wide).every((step) => !root(step).hasAttribute('data-compact'))).toBe(true);
  });

  it('leaves a vertical stepper alone at any width', async () => {
    const element = await stepper('active-step="1" orientation="vertical"', FOUR, 'width: 120px');
    expect(steps(element).every((step) => !root(step).hasAttribute('data-compact'))).toBe(true);
    expect(summary(element)).toBeNull();
  });

  it('keeps the sequence whole for a screen reader after collapsing', async () => {
    const element = await collapsed();
    const names = steps(element).map((step) => step.shadowRoot!.querySelector('.visually-hidden')?.textContent);
    expect(names.slice(0, 4)).toEqual(['Account', 'Profile', 'Payment', 'Review']);
    expect(summary(element)!.querySelector('.summary-body')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('offers no step controls on a stepper that cannot be navigated', async () => {
    const element = await collapsed();
    expect(element.shadowRoot!.querySelector('.control')).toBeNull();
  });

  it('moves a step at a time through the controls when navigable, and stops at the ends', async () => {
    const element = await collapsed('active-step="0" navigable');
    const controls = () => [...element.shadowRoot!.querySelectorAll<HTMLElement>('tct-icon-button')];
    expect(controls()).toHaveLength(2);
    expect(controls()[0]!.hasAttribute('disabled')).toBe(true);
    const events = recordEvents(element, 'tct-value-change');
    await userEvent.click(controls()[1]!);
    expect(element.activeStep).toBe(1);
    expect(events.events[0]).toMatchObject({value: 1, oldValue: 0});
    element.activeStep = 3;
    await settleSteps(element);
    expect(controls()[1]!.hasAttribute('disabled')).toBe(true);
  });

  it('skips disabled steps in either direction', async () => {
    const element = await stepper(
      'active-step="1" navigable',
      '<tct-step label="A"></tct-step><tct-step label="B"></tct-step><tct-step label="C" disabled></tct-step><tct-step label="D"></tct-step>',
      'width: 300px',
    );
    await waitUntil(() => summary(element), 'summary');
    const [previous, next] = [...element.shadowRoot!.querySelectorAll<HTMLElement>('tct-icon-button')];
    await userEvent.click(next!);
    expect(element.activeStep).toBe(3);
    await settleSteps(element);
    await userEvent.click([...element.shadowRoot!.querySelectorAll<HTMLElement>('tct-icon-button')][0]!);
    expect(element.activeStep).toBe(1);
    expect(previous).toBeDefined();
  });

  it('names the controls "Previous step" and "Next step"', async () => {
    const element = await collapsed('active-step="1" navigable');
    const names = [...element.shadowRoot!.querySelectorAll('tct-icon-button')].map((control) => control.getAttribute('label'));
    expect(names).toEqual(['Previous step', 'Next step']);
  });

  it('drops the controls but keeps the name on request (collapsed-variant="with-label")', async () => {
    const element = await collapsed('active-step="1" navigable collapsed-variant="with-label"');
    expect(element.shadowRoot!.querySelector('tct-icon-button')).toBeNull();
    expect(summary(element)!.textContent).toContain('Profile');
  });

  it('leaves a bare track when the label is hidden (collapsed-variant="hidden-label")', async () => {
    const element = await collapsed('active-step="1" navigable collapsed-variant="hidden-label"');
    expect(summary(element)).toBeNull();
    expect(root(steps(element)[0]!).hasAttribute('data-compact')).toBe(true);
  });

  it('takes the collapsed steps out of the tab order', async () => {
    const element = await collapsed('active-step="0" navigable');
    for (const step of steps(element)) expect(button(step)).toBeNull();
  });

  it('keeps the content of a step mounted but hidden while collapsed', async () => {
    const element = await stepper(
      'active-step="0"',
      '<tct-step label="A"><input id="kept" /></tct-step><tct-step label="B"></tct-step><tct-step label="C"></tct-step><tct-step label="D"></tct-step>',
      'width: 300px',
    );
    await waitUntil(() => root(steps(element)[0]!).hasAttribute('data-compact'), 'collapsed');
    expect(element.querySelector('#kept')).not.toBeNull();
    expect(steps(element)[0]!.shadowRoot!.querySelector('.content')!.hasAttribute('hidden')).toBe(true);
  });
});

describe('tct-stepper: localisation and RTL', () => {
  it('names the list and a step button from the nearest lang (de-DE)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div lang="de-DE"><tct-stepper active-step="1" navigable>${STEPS}</tct-stepper></div>`,
    );
    const element = wrapper.querySelector('tct-stepper')!;
    await waitUntil(() => list(element).getAttribute('aria-label') === 'Fortschritt', 'German list name', 4000);
    await waitUntil(
      () => button(steps(element)[2]!)?.getAttribute('aria-label') === 'Zu Schritt 3: Review',
      'German step name',
      4000,
    );
    expect(button(steps(element)[0]!)!.getAttribute('aria-label')).toBe('Zu Schritt 1: Account, abgeschlossen');
  });

  it('names the list in Arabic and runs the steps from the right (ar-SA)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div lang="ar-SA" dir="rtl"><tct-stepper active-step="1">${STEPS}</tct-stepper></div>`,
    );
    const element = wrapper.querySelector('tct-stepper')!;
    await waitUntil(() => list(element).getAttribute('aria-label') === 'التقدّم', 'Arabic name', 4000);
    await settleSteps(element);
    const [first, second] = steps(element);
    expect(first!.getBoundingClientRect().left).toBeGreaterThan(second!.getBoundingClientRect().left);
  });

  it('fills the bar from the right in right-to-left', async () => {
    const wrapper = await fixture<HTMLDivElement>(`<div dir="rtl" style="width: 480px"><tct-stepper active-step="1">${STEPS}</tct-stepper></div>`);
    const element = wrapper.querySelector('tct-stepper')!;
    await settleSteps(element);
    const fill = getComputedStyle(steps(element)[2]!.shadowRoot!.querySelector('.seg')!, '::before');
    expect(fill.transformOrigin.startsWith('100%') || parseFloat(fill.transformOrigin) > 0).toBe(true);
  });
});

describe('tct-stepper: accessibility', () => {
  it('has no axe violations in each arrangement, navigable and not', async () => {
    for (const attributes of [
      'active-step="1"',
      'active-step="1" navigable',
      'active-step="1" orientation="vertical" navigable',
      'active-step="1" indicator-position="on-track" navigable',
      'active-step="1" orientation="vertical" indicator-position="on-track"',
    ]) {
      const element = await stepper(
        attributes,
        '<tct-step label="Account"></tct-step><tct-step label="Profile" description="Tell us about you" optional></tct-step><tct-step label="Review" status="error"></tct-step><tct-step label="Done" disabled></tct-step>',
        'width: 600px; background: var(--color-background-body)',
      );
      await expectAccessible(element.parentElement!);
    }
  });

  it('has no axe violations when collapsed, with controls', async () => {
    const element = await stepper(
      'active-step="1" navigable',
      '<tct-step label="Account"></tct-step><tct-step label="Profile"></tct-step><tct-step label="Payment"></tct-step><tct-step label="Review"></tct-step>',
      'width: 300px; background: var(--color-background-body)',
    );
    await waitUntil(() => summary(element), 'summary');
    await expectAccessible(element.parentElement!);
  });
});

const contrastOnly = {runOnly: {type: 'rule' as const, values: ['color-contrast']}};

/** State colours arrive through CSS transitions: measure the settled state, not the first frame. */
async function settledStepper(_element: TctStepper): Promise<void> {
  await nextFrame();
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
}

afterEach(async () => {
  await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
  await cdp().send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 0, y: 0, button: 'left'}).catch(() => undefined);
});

describe('tct-step: text contrast in every state', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const position of ['separated', 'on-track'] as const) {
      const where = `${position}, ${theme}`;
      const mount = async (): Promise<{wrapper: HTMLElement; element: TctStepper}> => {
        const wrapper = await fixture<HTMLElement>(
          `<div style="background: var(--color-background-body); padding: 16px; width: 900px"><button>before</button>` +
            `<tct-stepper active-step="2" navigable indicator-position="${position}">` +
            `<tct-step label="Account" description="Sign in"></tct-step><tct-step label="Profile" status="warning" optional></tct-step>` +
            `<tct-step label="Payment" description="Card details"></tct-step><tct-step label="Review" status="success"></tct-step>` +
            `<tct-step label="Confirm" status="error"></tct-step><tct-step label="Locked" disabled></tct-step></tct-stepper></div>`,
          {theme},
        );
        const element = wrapper.querySelector('tct-stepper')!;
        await settleSteps(element);
        return {wrapper, element};
      };

      it(`rest: completed, current, upcoming, status and disabled steps (${where})`, async () => {
        const {wrapper, element} = await mount();
        await settledStepper(element);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`hover over a clickable step (${where})`, async () => {
        const {wrapper, element} = await mount();
        await userEvent.hover(button(steps(element)[3]!)!);
        await settledStepper(element);
        await expectAccessible(wrapper, contrastOnly);
      });

      it(`keyboard focus on a clickable step (${where})`, async () => {
        const {wrapper, element} = await mount();
        wrapper.querySelector('button')!.focus();
        await pressKeys('Tab');
        await settledStepper(element);
        await expectAccessible(wrapper, contrastOnly);
        expect(deepActiveElement()).toBe(button(steps(element)[0]!));
      });

      it(`pressed step (${where})`, async () => {
        const {wrapper, element} = await mount();
        const box = button(steps(element)[4]!)!.getBoundingClientRect();
        const point = {x: box.left + box.width / 2, y: box.top + box.height / 2};
        const session = cdp();
        await session.send('Input.dispatchMouseEvent', {type: 'mouseMoved', ...point});
        await session.send('Input.dispatchMouseEvent', {type: 'mousePressed', ...point, button: 'left', clickCount: 1});
        await settledStepper(element);
        try {
          await expectAccessible(wrapper, contrastOnly);
        } finally {
          await session.send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', clickCount: 1});
        }
      });
    }
  }
});

/** The computed colour a CSS system colour resolves to (forced colours emulation on). */
function systemColor(name: string): string {
  const probe = document.createElement('span');
  probe.style.color = name;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

describe('tct-stepper: forced colours', () => {
  it('draws the segments and badges in system colours and keeps the focus ring', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await stepper('active-step="1" navigable');
    const [done, , upcoming] = steps(element);
    const seg = done!.shadowRoot!.querySelector('.seg')!;
    expect(getComputedStyle(seg).backgroundColor).toBe(systemColor('GrayText'));
    expect(getComputedStyle(seg, '::before').backgroundColor).toBe(systemColor('Highlight'));
    const badge = indicator(upcoming!)!;
    expect(getComputedStyle(badge).borderStyle).toBe('solid');
    button(upcoming!)!.focus({focusVisible: true});
    expect(getComputedStyle(button(upcoming!)!).outlineStyle).not.toBe('none');
    expect(getComputedStyle(button(upcoming!)!).outlineColor).toBe(systemColor('Highlight'));
  });
});

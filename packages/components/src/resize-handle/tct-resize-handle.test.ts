/**
 * tct-resize-handle: the separator semantics (role, value, bounds, readable value), keyboard resizing
 * (arrows, Shift, Home, End, Enter) in LTR and RTL, the pointer drag (capture, cancel, direction
 * inversion), collapse, the non-drag alternatives, pill placement and overlay mode (ported from
 * upstream ResizeHandle.test.tsx and useResizable.test.ts, as behaviour of a real panel and handle).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import type {TctResizeHandle} from './tct-resize-handle.js';
import {ResizableController} from '@tecton-wc/core/controllers/resizable.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../layout/define.js';
import '../button/define.js';
import './define.js';
import type {TctLayoutPanel} from '../layout/tct-layout-panel.js';

runElementSuite({
  tag: 'tct-resize-handle',
  render: () => html`<tct-resize-handle label="Resize"></tct-resize-handle>`,
  properties: {
    direction: 'vertical',
    position: 'overlay',
    reversed: true,
    hasDivider: true,
    pillPlacement: 'center',
    label: 'Resize things',
  },
  attributes: {direction: 'direction', position: 'position', pillPlacement: 'pill-placement'},
  // The handle has no region to describe until it finds one; the default render is still named.
});

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
/** `aria-valuenow` as set through the host's ElementInternals (the AX tree exposes it only as the node value). */
const valueNow = (handle: Element): string | null =>
  (handle as unknown as {internals: ElementInternals}).internals.ariaValueNow;
const grabOf = (handle: Element): HTMLElement =>
  handle.shadowRoot!.querySelector<HTMLElement>('.grab')!;
const width = (panel: Element): number => baseOf(panel).getBoundingClientRect().width;

interface Setup {
  panel?: string;
  handle?: string;
  dir?: 'ltr' | 'rtl';
  end?: boolean;
}

/** A layout with a resizable start panel (or end panel) and its handle. */
async function split({
  panel = 'default-size="200" min-size="100" max-size="300"',
  handle = 'has-divider label="Resize sidebar"',
  dir,
  end = false,
}: Setup = {}) {
  const slot = end ? 'end' : 'start';
  const parts = [
    `<tct-layout-panel slot="${slot}" id="p" resizable ${panel}>Panel</tct-layout-panel>`,
    `<tct-resize-handle slot="${slot}" id="h" ${end ? 'reversed' : ''} ${handle}></tct-resize-handle>`,
  ];
  if (end) parts.reverse();
  const root = await fixture<HTMLElement>(
    `<div style="block-size: 300px; inline-size: 600px"><tct-layout>${parts.join('')}<tct-layout-content>Content</tct-layout-content></tct-layout></div>`,
    {dir},
  );
  const panelElement = root.querySelector<TctLayoutPanel>('#p')!;
  const handleElement = root.querySelector<TctResizeHandle>('#h')!;
  await panelElement.updateComplete;
  await handleElement.updateComplete;
  await nextFrame();
  return {root, panel: panelElement, handle: handleElement};
}

describe('tct-resize-handle: separator semantics', () => {
  it('exposes the region size and bounds', async () => {
    const {handle} = await split();
    const node = await axNode(handle);
    expect(node.role).toBe('separator');
    expect(node.name).toBe('Resize sidebar');
    expect(node.valuemin).toBe('100');
    expect(node.valuemax).toBe('300');
    expect(node.orientation).toBe('vertical');
    // The current size is a number and a readable text ("200 px").
    expect(node.valuetext).toBe('200 px');
    expect(valueNow(handle)).toBe('200');
  });

  it('announces the value: aria-valuenow and aria-valuetext follow every step', async () => {
    const {handle} = await split();
    expect(handle.region!.size).toBe(200);
    handle.focus();
    await pressKeys('ArrowRight');
    await handle.updateComplete;
    const node = await axNode(handle);
    expect(node.valuetext).toBe('210 px');
    // aria-valuenow is the same pixel value (the AX tree exposes it as the node's value).
    expect(valueNow(handle)).toBe('210');
  });

  it('is named "Resize handle" by default and follows the label attribute', async () => {
    const {handle} = await split({handle: ''});
    expect((await axNode(handle)).name).toBe('Resize handle');
    handle.label = 'Resize the navigation';
    await handle.updateComplete;
    expect((await axNode(handle)).name).toBe('Resize the navigation');
  });

  it('a horizontal handle is a vertical separator, and a vertical handle is a horizontal one', async () => {
    const horizontal = await split();
    expect((await axNode(horizontal.handle)).orientation).toBe('vertical');
    const vertical = await split({handle: 'direction="vertical" label="x"'});
    expect((await axNode(vertical.handle)).orientation).toBe('horizontal');
  });

  it('is focusable, and a disabled handle is not a tab stop', async () => {
    const {handle} = await split();
    expect(handle.tabIndex).toBe(0);
    handle.focus();
    expect(deepActiveElement()).toBe(handle);
    handle.disabled = true;
    await handle.updateComplete;
    expect(handle.tabIndex).toBe(-1);
    expect((await axNode(handle)).disabled).toBe('true');
  });

  it('respects a tabindex the author sets', async () => {
    const {handle} = await split({handle: 'tabindex="-1" label="x"'});
    expect(handle.tabIndex).toBe(-1);
  });

  it('is accessible with a divider, in a layout', async () => {
    const {root} = await split();
    await expectAccessible(root);
  });

  it('has no value semantics until it finds a region', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-resize-handle label="Lonely"></tct-resize-handle>`,
    );
    const handle = root as TctResizeHandle;
    const node = await axNode(handle);
    expect(node.role).toBe('separator');
    expect(valueNow(handle)).toBeNull();
    handle.stepBy(10);
    expect(handle.region).toBeUndefined();
  });
});

describe('tct-resize-handle: keyboard', () => {
  it('grows the panel by a step on ArrowRight and shrinks it on ArrowLeft', async () => {
    const {handle, panel} = await split();
    handle.focus();
    await pressKeys('ArrowRight');
    expect(width(panel)).toBe(210);
    await pressKeys('ArrowLeft', 'ArrowLeft');
    expect(width(panel)).toBe(190);
  });

  it('ArrowDown grows and ArrowUp shrinks (every arrow is accepted)', async () => {
    const {handle, panel} = await split();
    handle.focus();
    await pressKeys('ArrowDown');
    expect(width(panel)).toBe(210);
    await pressKeys('ArrowUp');
    expect(width(panel)).toBe(200);
  });

  it('uses the large step when Shift is held', async () => {
    const {handle, panel} = await split();
    handle.focus();
    await pressKeys('Shift+ArrowRight');
    expect(width(panel)).toBe(250);
  });

  it('jumps to the minimum on Home and the maximum on End', async () => {
    const {handle, panel} = await split();
    handle.focus();
    await pressKeys('Home');
    expect(width(panel)).toBe(100);
    await pressKeys('End');
    expect(width(panel)).toBe(300);
  });

  it('never leaves the bounds', async () => {
    const {handle, panel} = await split();
    handle.focus();
    await pressKeys('End', 'ArrowRight', 'ArrowRight');
    expect(width(panel)).toBe(300);
    await pressKeys('Home', 'ArrowLeft');
    expect(width(panel)).toBe(100);
  });

  it('End does nothing when the region has no maximum', async () => {
    const {handle, panel} = await split({panel: 'default-size="200" min-size="100"'});
    handle.focus();
    await pressKeys('End');
    expect(width(panel)).toBe(200);
    // Unbounded: no aria-valuemax is set (the platform default of 100 would be wrong).
    expect((handle as unknown as {internals: ElementInternals}).internals.ariaValueMax).toBeNull();
  });

  it('a reversed handle (an end panel) grows the panel when the pointer moves towards the start', async () => {
    const {handle, panel} = await split({end: true});
    handle.focus();
    // For an end panel the growth direction is inverted: ArrowLeft grows it.
    await pressKeys('ArrowLeft');
    expect(width(panel)).toBe(210);
  });

  it('arrows follow the text direction: in RTL ArrowLeft grows a start panel', async () => {
    const {handle, panel} = await split({dir: 'rtl'});
    handle.focus();
    await pressKeys('ArrowLeft');
    expect(width(panel)).toBe(210);
    await pressKeys('ArrowRight');
    expect(width(panel)).toBe(200);
  });

  it('ignores keyboard input when disabled', async () => {
    const {handle, panel} = await split({handle: 'disabled label="x"'});
    handle.focus();
    await pressKeys('ArrowRight');
    expect(width(panel)).toBe(200);
  });

  it('ignores keys while an IME composition is running', async () => {
    const {handle, panel} = await split();
    handle.focus();
    handle.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'ArrowRight', isComposing: true, bubbles: true}),
    );
    expect(width(panel)).toBe(200);
  });

  it('raises tct-size-change for every keyboard step, and never for a property write', async () => {
    const {handle, panel} = await split();
    const events = recordEvents(panel, ['tct-size-change']);
    handle.focus();
    await pressKeys('ArrowRight', 'ArrowRight');
    expect(events.named('tct-size-change').length).toBe(2);
    const last = events.named('tct-size-change').at(-1) as unknown as {
      size: number;
      reason: string;
    };
    expect([last.size, last.reason]).toEqual([220, 'keyboard']);
    panel.resize(150);
    await panel.updateComplete;
    expect(events.named('tct-size-change').length).toBe(2);
    expect(width(panel)).toBe(150);
  });
});

describe('tct-resize-handle: collapse', () => {
  const collapsible = 'default-size="200" min-size="100" collapsible';

  it('collapses on Enter and expands back to the minimum on the next Enter', async () => {
    const {handle, panel} = await split({panel: collapsible});
    handle.focus();
    await pressKeys('Enter');
    await panel.updateComplete;
    expect(panel.collapsed).toBe(true);
    expect(width(panel)).toBe(0);
    await pressKeys('Enter');
    await panel.updateComplete;
    expect(panel.collapsed).toBe(false);
    expect(width(panel)).toBe(100);
  });

  it('a double click collapses and expands a collapsible panel', async () => {
    const {handle, panel} = await split({panel: collapsible});
    grabOf(handle).dispatchEvent(new MouseEvent('dblclick', {bubbles: true, composed: true}));
    await panel.updateComplete;
    expect(panel.collapsed).toBe(true);
    handle.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, composed: true}));
    await panel.updateComplete;
    expect(panel.collapsed).toBe(false);
  });

  it('does nothing on Enter when the region is not collapsible', async () => {
    const {handle, panel} = await split();
    handle.focus();
    await pressKeys('Enter');
    expect(panel.collapsed).toBe(false);
    expect(width(panel)).toBe(200);
  });

  it('keeps aria-valuenow >= aria-valuemin and announces "Collapsed" while collapsed', async () => {
    const {handle, panel} = await split({panel: collapsible});
    handle.focus();
    await pressKeys('Enter');
    await panel.updateComplete;
    await handle.updateComplete;
    expect(valueNow(handle)).toBe('100');
    expect((await axNode(handle)).valuetext).toBe('Collapsed');
    await pressKeys('Enter');
    await handle.updateComplete;
    expect((await axNode(handle)).valuetext).toBe('100 px');
  });

  it('a collapsed panel takes no space and its content leaves the tab order', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="p" resizable collapsed collapsible default-size="200"><button id="inside">x</button></tct-layout-panel>
        <tct-resize-handle slot="start" id="h" label="r"></tct-resize-handle>
        <tct-layout-content>c</tct-layout-content></tct-layout></div>`,
    );
    const panel = root.querySelector<TctLayoutPanel>('#p')!;
    await panel.updateComplete;
    expect(panel.collapsed).toBe(true);
    expect(getComputedStyle(baseOf(panel)).visibility).toBe('hidden');
    expect(panel.matches(':state(collapsed)')).toBe(true);
    root.querySelector<HTMLElement>('#inside')!.focus();
    expect(deepActiveElement()).not.toBe(root.querySelector('#inside'));
  });

  it('a page can own the collapse state: a prevented tct-collapse-change keeps it', async () => {
    const {handle, panel} = await split({panel: collapsible});
    panel.addEventListener('tct-collapse-change', (event) => {
      event.preventDefault();
    });
    const events = recordEvents(panel, ['tct-collapse-change']);
    handle.focus();
    await pressKeys('Enter');
    expect(events.named('tct-collapse-change').length).toBe(1);
    expect(panel.collapsed).toBe(false);
    expect(width(panel)).toBe(200);
  });

  it('collapse() and expand() (programmatic) never emit tct-collapse-change', async () => {
    const {panel} = await split({panel: collapsible});
    const events = recordEvents(panel, ['tct-collapse-change']);
    panel.collapsed = true;
    await panel.updateComplete;
    expect(width(panel)).toBe(0);
    panel.collapsed = false;
    await panel.updateComplete;
    expect(width(panel)).toBe(200);
    expect(events.named('tct-collapse-change').length).toBe(0);
  });
});

describe('tct-resize-handle: pointer', () => {
  const pointer = (type: string, x: number, id = 7) =>
    new PointerEvent(type, {
      pointerId: id,
      clientX: x,
      clientY: 0,
      button: 0,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

  it('drives the region with the raw pointer delta under LTR', async () => {
    const {handle, panel} = await split();
    const grab = grabOf(handle);
    grab.dispatchEvent(pointer('pointerdown', 100));
    grab.dispatchEvent(pointer('pointermove', 130));
    await panel.updateComplete;
    expect(width(panel)).toBe(230);
    grab.dispatchEvent(pointer('pointerup', 130));
    expect(document.body.style.cursor).toBe('');
  });

  it('inverts the pointer delta under RTL so dragging resizes intuitively', async () => {
    const {handle, panel} = await split({dir: 'rtl'});
    const grab = grabOf(handle);
    grab.dispatchEvent(pointer('pointerdown', 100));
    // Dragging left widens a start panel that sits on the right in RTL.
    grab.dispatchEvent(pointer('pointermove', 70));
    await panel.updateComplete;
    expect(width(panel)).toBe(230);
    grab.dispatchEvent(pointer('pointerup', 70));
  });

  it('a reversed handle inverts the drag', async () => {
    const {handle, panel} = await split({end: true});
    const grab = grabOf(handle);
    grab.dispatchEvent(pointer('pointerdown', 100));
    grab.dispatchEvent(pointer('pointermove', 60));
    await panel.updateComplete;
    expect(width(panel)).toBe(240);
    grab.dispatchEvent(pointer('pointerup', 60));
  });

  it('clamps to the bounds during a drag and reports every step', async () => {
    const {handle, panel} = await split();
    const events = recordEvents(panel, ['tct-size-change']);
    const grab = grabOf(handle);
    grab.dispatchEvent(pointer('pointerdown', 0));
    grab.dispatchEvent(pointer('pointermove', 20));
    grab.dispatchEvent(pointer('pointermove', 900));
    await panel.updateComplete;
    expect(width(panel)).toBe(300);
    expect(events.named('tct-size-change').length).toBe(2);
    const reasons = events.named('tct-size-change').map((event) => event.reason);
    expect(reasons).toEqual(['pointer', 'pointer']);
    grab.dispatchEvent(pointer('pointerup', 900));
  });

  it('ignores moves from a pointer that does not own the drag', async () => {
    const {handle, panel} = await split();
    const grab = grabOf(handle);
    grab.dispatchEvent(pointer('pointerdown', 100, 7));
    grab.dispatchEvent(pointer('pointermove', 150, 8));
    await panel.updateComplete;
    expect(width(panel)).toBe(200);
    grab.dispatchEvent(pointer('pointerup', 150, 7));
  });

  it('ignores presses when disabled and non-primary buttons', async () => {
    const {handle, panel} = await split();
    const grab = grabOf(handle);
    grab.dispatchEvent(
      new PointerEvent('pointerdown', {pointerId: 3, button: 2, clientX: 0, bubbles: true}),
    );
    grab.dispatchEvent(pointer('pointermove', 40, 3));
    expect(width(panel)).toBe(200);
    handle.disabled = true;
    await handle.updateComplete;
    grab.dispatchEvent(pointer('pointerdown', 0, 4));
    grab.dispatchEvent(pointer('pointermove', 40, 4));
    expect(width(panel)).toBe(200);
  });

  it('a cancelled drag releases the body styles and lets the region resume', async () => {
    const {handle, panel} = await split();
    const grab = grabOf(handle);
    grab.dispatchEvent(pointer('pointerdown', 100));
    await handle.updateComplete;
    expect(document.body.style.cursor).toBe('col-resize');
    expect(handle.matches(':state(dragging)')).toBe(true);
    grab.dispatchEvent(pointer('pointercancel', 100));
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    // The size reached stays; a later drag starts fresh.
    grab.dispatchEvent(pointer('pointerdown', 0, 9));
    grab.dispatchEvent(pointer('pointermove', 10, 9));
    await panel.updateComplete;
    expect(width(panel)).toBe(210);
    grab.dispatchEvent(pointer('pointerup', 10, 9));
  });

  it('releases the body styles when the handle is removed mid-drag', async () => {
    const {handle} = await split();
    grabOf(handle).dispatchEvent(pointer('pointerdown', 100));
    expect(document.body.style.cursor).toBe('col-resize');
    handle.remove();
    expect(document.body.style.cursor).toBe('');
  });

  it('resizes with a real mouse drag (pointer capture on the grab zone)', async () => {
    const {handle, panel, root} = await split();
    const content = root.querySelector('tct-layout-content')!;
    await userEvent.dragAndDrop(grabOf(handle), content, {
      sourcePosition: {x: 8, y: 50},
      targetPosition: {x: 30, y: 50},
    });
    await panel.updateComplete;
    expect(width(panel)).toBeGreaterThan(200);
  });
});

describe('tct-resize-handle: non-drag alternatives', () => {
  it('stepBy, stepToMin and stepToMax resize like the keyboard (buttons can call them)', async () => {
    const {handle, panel} = await split();
    handle.stepBy(40);
    await panel.updateComplete;
    expect(width(panel)).toBe(240);
    handle.stepBy(-20);
    await panel.updateComplete;
    expect(width(panel)).toBe(220);
    handle.stepToMin();
    await panel.updateComplete;
    expect(width(panel)).toBe(100);
    handle.stepToMax();
    await panel.updateComplete;
    expect(width(panel)).toBe(300);
  });

  it('a button outside the handle can offer the same resize with a single click', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="p" resizable default-size="200" min-size="100" max-size="300">Panel</tct-layout-panel>
        <tct-resize-handle slot="start" id="h" label="Resize"></tct-resize-handle>
        <tct-layout-content><tct-button id="wider">Wider</tct-button></tct-layout-content></tct-layout></div>`,
    );
    const handle = root.querySelector<TctResizeHandle>('#h')!;
    const panel = root.querySelector<TctLayoutPanel>('#p')!;
    root.querySelector('#wider')!.addEventListener('click', () => {
      handle.stepBy(50);
    });
    await userEvent.click(root.querySelector('#wider')!);
    await panel.updateComplete;
    expect(width(panel)).toBe(250);
  });

  it('a disabled handle ignores the methods', async () => {
    const {handle, panel} = await split({handle: 'disabled label="x"'});
    handle.stepBy(50);
    expect(width(panel)).toBe(200);
  });
});

describe('tct-resize-handle: finding the region', () => {
  it('drives the panel it points at with for', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 300px; inline-size: 600px"><tct-layout>
        <tct-layout-panel slot="start" id="target" resizable default-size="200" min-size="100">P</tct-layout-panel>
        <tct-layout-panel slot="end" id="other" width="80">Q</tct-layout-panel>
        <tct-resize-handle slot="end" id="h" for="target" label="Resize"></tct-resize-handle>
        <tct-layout-content>c</tct-layout-content></tct-layout></div>`,
    );
    const handle = root.querySelector<TctResizeHandle>('#h')!;
    await handle.updateComplete;
    expect(handle.region).toBe(root.querySelector<TctLayoutPanel>('#target')!.activeRegion);
    handle.focus();
    await pressKeys('ArrowRight');
    expect(width(root.querySelector('#target')!)).toBe(210);
  });

  it('drives a region of your own (a ResizableController) assigned to resizable', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-resize-handle id="h" label="Resize"></tct-resize-handle></div>`,
    );
    const handle = root.querySelector<TctResizeHandle>('#h')!;
    const sizes: number[] = [];
    const region = new ResizableController(null, {
      defaultSize: 120,
      minSize: 50,
      maxSize: 400,
      onSizeChange: (size) => sizes.push(size),
    });
    handle.resizable = region;
    await handle.updateComplete;
    handle.focus();
    await pressKeys('ArrowRight', 'Shift+ArrowRight');
    expect(region.size).toBe(180);
    expect(sizes.at(-1)).toBe(180);
    expect(valueNow(handle)).toBe('180');
  });

  it('finds a panel that arrives after the handle while the page parses', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 200px"><tct-layout><tct-resize-handle slot="start" id="h" label="R"></tct-resize-handle><tct-layout-content>c</tct-layout-content></tct-layout></div>`,
    );
    const handle = root.querySelector<TctResizeHandle>('#h')!;
    await handle.updateComplete;
    expect(handle.region).toBeUndefined();
    const panel = document.createElement('tct-layout-panel');
    panel.slot = 'start';
    panel.resizable = true;
    panel.defaultSize = '150';
    handle.before(panel);
    await waitUntil(() => valueNow(handle) === '150');
    expect(handle.region).toBeDefined();
  });
});

describe('tct-resize-handle: presentation', () => {
  it('shows a pill at rest, and only on hover and focus with no-always-visible', async () => {
    const shown = await split();
    expect(getComputedStyle(shown.handle.shadowRoot!.querySelector('.pill')!).opacity).toBe('1');
    const hidden = await split({handle: 'no-always-visible label="x"'});
    expect(getComputedStyle(hidden.handle.shadowRoot!.querySelector('.pill')!).opacity).toBe('0');
    hidden.handle.focus();
    await pressKeys('Shift+Tab', 'Tab');
    expect(deepActiveElement()).toBe(hidden.handle);
    const pill = hidden.handle.shadowRoot!.querySelector('.pill')!;
    await waitUntil(() => getComputedStyle(pill).opacity === '1');
  });

  it('places the pill on the panel side, and on the other side while the panel is collapsed', async () => {
    const {handle, panel} = await split({panel: 'default-size="200" collapsible'});
    expect(baseOf(handle).dataset.side).toBe('start');
    handle.focus();
    await pressKeys('Enter');
    await panel.updateComplete;
    await handle.updateComplete;
    expect(baseOf(handle).dataset.side).toBe('end');
    handle.pillPlacement = 'center';
    await handle.updateComplete;
    expect(baseOf(handle).dataset.side).toBe('center');
  });

  it('a reversed handle puts the pill on the end side', async () => {
    const {handle} = await split({end: true});
    expect(baseOf(handle).dataset.side).toBe('end');
  });

  it('draws the divider only when asked', async () => {
    const {handle} = await split();
    expect(getComputedStyle(baseOf(handle)).width).toBe('1px');
    const none = await split({handle: 'label="x"'});
    expect(getComputedStyle(baseOf(none.handle)).width).toBe('0px');
  });

  it('the pill and the grab zone are on the panel side in LTR and mirrored in RTL', async () => {
    const ltr = await split();
    const rtl = await split({dir: 'rtl'});
    const centre = (element: Element): number => {
      const box = element.getBoundingClientRect();
      return box.left + box.width / 2;
    };
    const line = (handle: Element): number => baseOf(handle).getBoundingClientRect().left;
    const pillLtr = centre(ltr.handle.shadowRoot!.querySelector('.pill')!);
    const grabLtr = centre(grabOf(ltr.handle));
    const pillRtl = centre(rtl.handle.shadowRoot!.querySelector('.pill')!);
    const grabRtl = centre(grabOf(rtl.handle));
    // The start panel is left of the line in LTR and right of it in RTL.
    expect(pillLtr).toBeLessThan(line(ltr.handle));
    expect(pillRtl).toBeGreaterThan(line(rtl.handle));
    // The grab zone sits over the pill in both.
    expect(Math.abs(grabLtr - pillLtr)).toBeLessThanOrEqual(1);
    expect(Math.abs(grabRtl - pillRtl)).toBeLessThanOrEqual(1);
  });

  it('replaces the default pill with a slotted grip', async () => {
    const {handle} = await split({handle: 'label="x"><span id="grip">|||</span><'});
    expect(handle.shadowRoot!.querySelector('.pill')).toBeNull();
    expect(handle.shadowRoot!.querySelector('slot')).not.toBeNull();
  });

  it('overlay mode sits inside its parent and does not take layout space', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="position: relative; inline-size: 300px; block-size: 200px"><tct-resize-handle position="overlay" label="r"></tct-resize-handle></div>`,
    );
    const handle = root.querySelector<TctResizeHandle>('tct-resize-handle')!;
    await handle.updateComplete;
    const box = handle.getBoundingClientRect();
    const parent = root.getBoundingClientRect();
    expect(getComputedStyle(handle).position).toBe('absolute');
    expect(box.width).toBe(16);
    expect(box.height).toBe(200);
    expect(Math.round(box.right)).toBe(Math.round(parent.right));
  });

  it('warns when the handle and its region use different axes', async () => {
    (globalThis as {tctDevMode?: boolean}).tctDevMode = true;
    const original = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    try {
      await split({handle: 'direction="vertical" label="x"'});
      expect(warnings.join('\n')).toContain('They must match');
    } finally {
      console.warn = original;
      (globalThis as {tctDevMode?: boolean}).tctDevMode = undefined;
    }
  });
});

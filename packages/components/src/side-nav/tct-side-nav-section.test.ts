/**
 * tct-side-nav-section: the labelled group, its header (subheading, end content), the hidden header and
 * the collapsed rail (ported from the upstream SideNavSection tests).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {page} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {nextFrame} from '@tecton-wc/testing/timing.js';
import './define.js';

runElementSuite({
  tag: 'tct-side-nav-section',
  render: () =>
    html`<tct-side-nav-section heading="Main"><tct-side-nav-item label="Home" href="#"></tct-side-nav-item></tct-side-nav-section>`,
  properties: {heading: 'Projects', subheading: 'Recent', headerHidden: true},
  attributes: {heading: 'heading', subheading: 'subheading', headerHidden: 'header-hidden'},
});

async function section(attributes = '', extra = '') {
  await page.viewport(1000, 700);
  const wrapper = await fixture<HTMLElement>(
    `<tct-side-nav><tct-side-nav-section id="s" ${attributes}>${extra}
      <tct-side-nav-item label="Home" icon="viewColumns" href="#home"></tct-side-nav-item>
    </tct-side-nav-section></tct-side-nav>`,
  );
  const element = wrapper.querySelector('tct-side-nav-section')!;
  await element.updateComplete;
  await nextFrame();
  return {wrapper, element};
}

const group = (element: Element): HTMLElement => element.shadowRoot!.querySelector<HTMLElement>('[role="group"]')!;

describe('tct-side-nav-section', () => {
  it('is a group named by its heading', async () => {
    const {element} = await section('heading="Main"');
    expect(await axNode(group(element))).toMatchObject({role: 'group', name: 'Main'});
  });

  it('draws the heading, the subheading and the end content in the header', async () => {
    const {element} = await section(
      'heading="Main" subheading="Workspace"',
      '<tct-button slot="end" id="add" variant="ghost" icon-only icon="close" label="Add"></tct-button>',
    );
    const header = element.shadowRoot!.querySelector<HTMLElement>('.header')!;
    expect(header.querySelector('[part="heading"]')!.textContent).toBe('Main');
    expect(header.querySelector('[part="subheading"]')!.textContent).toBe('Workspace');
    expect(
      header.querySelector<HTMLSlotElement>('slot[name="end"]')!.assignedElements()[0]!.id,
    ).toBe('add');
  });

  it('renders the items in the default slot, in order', async () => {
    const {element} = await section('heading="Main"');
    const items = element.shadowRoot!.querySelector<HTMLSlotElement>('.items slot')!.assignedElements();
    expect(items.map((item) => item.getAttribute('label'))).toEqual(['Home']);
  });

  it('keeps a hidden header readable by assistive technology', async () => {
    const {element} = await section('heading="Main" subheading="Sub" header-hidden');
    expect(element.shadowRoot!.querySelector('.header')).toBeNull();
    const hidden = element.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(hidden.textContent).toContain('Main');
    expect(hidden.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(await axNode(group(element))).toMatchObject({role: 'group', name: 'Main'});
    await expectAccessible(element);
  });

  it('hides the header in the collapsed rail but keeps the group named', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<tct-side-nav collapsible collapsed><tct-side-nav-section heading="Main"><tct-side-nav-item label="Home" icon="viewColumns" href="#"></tct-side-nav-item></tct-side-nav-section></tct-side-nav>`,
    );
    const element = wrapper.querySelector('tct-side-nav-section')!;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('.header')).toBeNull();
    expect(await axNode(group(element))).toMatchObject({role: 'group', name: 'Main'});
    await expectAccessible(wrapper);
  });

  it('is accessible with a header, a subheading and end content', async () => {
    const {wrapper} = await section(
      'heading="Main" subheading="Workspace"',
      '<tct-button slot="end" variant="ghost" icon-only icon="close" label="Add"></tct-button>',
    );
    await expectAccessible(wrapper);
  });

  it('lays the header out from the start in RTL text: the end content comes after the title, on the left', async () => {
    await page.viewport(1000, 700);
    const wrapper = await fixture<HTMLElement>(
      `<tct-side-nav><tct-side-nav-section heading="Main"><tct-button slot="end" id="add" variant="ghost" icon-only icon="close" label="Add"></tct-button><tct-side-nav-item label="Home" href="#"></tct-side-nav-item></tct-side-nav-section></tct-side-nav>`,
      {dir: 'rtl'},
    );
    const element = wrapper.querySelector('tct-side-nav-section')!;
    await element.updateComplete;
    const title = element.shadowRoot!.querySelector<HTMLElement>('.title')!.getBoundingClientRect();
    const end = element.querySelector('#add')!.getBoundingClientRect();
    expect(end.right).toBeLessThanOrEqual(title.left + 1);
  });
});

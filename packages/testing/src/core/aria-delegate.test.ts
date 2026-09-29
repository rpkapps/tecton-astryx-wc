/**
 * `AriaDelegateController` (A§9.6): host ARIA mirrored onto the inner control, including id
 * references that cannot cross a shadow boundary. Tier 1 uses element reflection; Tier 2 (forced
 * with `withFeature`) degrades to copied text. Chromium's accessibility tree is the ground truth.
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {beforeAll, describe, expect, it} from 'vitest';
import {
  AriaDelegateController,
  accessibleText,
  resolveIdRefs,
  setAriaElements,
} from '@tecton-astryx/core/controllers/aria-delegate.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {axNode} from '../a11y.js';
import {fixture} from '../fixture.js';
import {isChromium, isTier2, withFeature} from '../tier.js';
import {nextFrame} from '../timing.js';

class TctTestDelegate extends TctElement {
  static override readonly tagName = 'tct-test-delegate';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  @property({type: Boolean}) managed = false;
  @property({type: Boolean}) labelled = false;
  readonly aria: AriaDelegateController = new AriaDelegateController(this, {
    target: () => this.renderRoot.querySelector('button'),
    exclude: () => (this.managed ? ['aria-pressed'] : []),
    labels: () => (this.labelled ? [...document.querySelectorAll('[data-fake-label]')] : []),
  });
  override render() {
    return html`<button type="button"><slot></slot></button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-delegate': TctTestDelegate;
  }
}

beforeAll(() => {
  defineElement(TctTestDelegate);
});

const inner = (host: TctTestDelegate): HTMLButtonElement =>
  host.renderRoot.querySelector('button')!;

async function delegate(attributes: string, before = ''): Promise<TctTestDelegate> {
  const root = await fixture<HTMLDivElement>(
    `<div>${before}<tct-test-delegate ${attributes}>Save</tct-test-delegate></div>`,
  );
  const host = root.querySelector('tct-test-delegate')!;
  await host.updateComplete;
  return host;
}

const settle = async (host: TctTestDelegate): Promise<void> => {
  await host.updateComplete;
  await nextFrame(); // MutationObserver callbacks run as microtasks; one frame covers the chain
};

describe('plain attributes', () => {
  it('copies host aria-* onto the inner control and follows changes and removal', async () => {
    const host = await delegate('aria-label="Close" aria-expanded="false" aria-pressed="true"');
    const button = inner(host);
    expect(button.getAttribute('aria-label')).toBe('Close');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    host.setAttribute('aria-expanded', 'true');
    await settle(host);
    expect(button.getAttribute('aria-expanded')).toBe('true');

    host.removeAttribute('aria-expanded');
    host.removeAttribute('aria-label');
    await settle(host);
    expect(button.hasAttribute('aria-expanded')).toBe(false);
    expect(button.hasAttribute('aria-label')).toBe(false);
  });

  it('never overwrites what the component manages (exclude), and never removes it', async () => {
    const host = await delegate('managed aria-pressed="true"');
    const button = inner(host);
    button.setAttribute('aria-pressed', 'mixed');
    host.setAttribute('aria-pressed', 'false');
    await settle(host);
    expect(button.getAttribute('aria-pressed')).toBe('mixed');
  });

  it('leaves attributes it did not write alone when the host has none', async () => {
    const host = await delegate('');
    inner(host).setAttribute('aria-busy', 'true');
    host.requestUpdate();
    await settle(host);
    expect(inner(host).getAttribute('aria-busy')).toBe('true');
  });

  it('keeps the host attributes as the source of truth', async () => {
    const host = await delegate('aria-label="Close"');
    expect(host.getAttribute('aria-label')).toBe('Close');
  });
});

describe.skipIf(isTier2)('id references through element reflection (Tier 1)', () => {
  it('resolves aria-labelledby and aria-describedby in the host’s tree, across the shadow boundary', async () => {
    const host = await delegate(
      'aria-labelledby="lab" aria-describedby="desc1 desc2"',
      '<span id="lab">Delete file</span><span id="desc1">Cannot be undone.</span><span id="desc2">Really.</span>',
    );
    const root = host.getRootNode() as Document;
    const button = inner(host);
    expect(button.ariaLabelledByElements).toEqual([root.getElementById('lab')]);
    expect(button.ariaDescribedByElements).toEqual([
      root.getElementById('desc1'),
      root.getElementById('desc2'),
    ]);
    // The id string is never copied (it would not resolve inside the shadow root); reflection may
    // leave an empty content attribute behind.
    expect(button.getAttribute('aria-labelledby') ?? '').not.toBe('lab');
  });

  it.skipIf(!isChromium)('the computed accessibility tree agrees', async () => {
    const host = await delegate(
      'aria-labelledby="lab" aria-describedby="desc"',
      '<span id="lab">Delete file</span><span id="desc">Cannot be undone.</span>',
    );
    expect(await axNode(inner(host))).toMatchObject({
      role: 'button',
      name: 'Delete file',
      description: 'Cannot be undone.',
    });
  });

  it('picks up a reference whose target appears later (on focusin)', async () => {
    const host = await delegate('aria-labelledby="late"');
    expect(inner(host).ariaLabelledByElements ?? []).toHaveLength(0);
    const label = document.createElement('span');
    label.id = 'late';
    label.textContent = 'Late label';
    host.before(label);
    host.dispatchEvent(new FocusEvent('focusin', {bubbles: true, composed: true}));
    expect(inner(host).ariaLabelledByElements).toEqual([label]);
  });

  it('clears element references when the host drops the attribute', async () => {
    const host = await delegate('aria-describedby="d"', '<span id="d">hint</span>');
    expect(inner(host).ariaDescribedByElements).toHaveLength(1);
    host.removeAttribute('aria-describedby');
    await settle(host);
    expect(inner(host).ariaDescribedByElements ?? []).toHaveLength(0);
  });

  it('labels (e.g. <label for>) name the control when the host has no aria-label(ledby)', async () => {
    const host = await delegate('labelled', '<span data-fake-label>Full name</span>');
    expect(inner(host).ariaLabelledByElements).toHaveLength(1);
    host.setAttribute('aria-label', 'Explicit');
    await settle(host);
    expect(inner(host).getAttribute('aria-label')).toBe('Explicit');
    expect(inner(host).ariaLabelledByElements ?? []).toHaveLength(0);
  });

  it('mirrors relationships that only element reflection can express (controls, activedescendant)', async () => {
    const host = await delegate('aria-controls="panel"', '<div id="panel">panel</div>');
    expect(inner(host).ariaControlsElements).toHaveLength(1);
  });
});

describe('Tier 2 (element reflection forced off): text instead of references', () => {
  it('turns aria-labelledby into aria-label and aria-describedby into aria-description', async () => {
    await withFeature('elementReflection', false, async () => {
      const host = await delegate(
        'aria-labelledby="a b" aria-describedby="desc"',
        '<span id="a">Delete</span><span id="b" aria-label="the file"></span><span id="desc">Cannot be undone.</span>',
      );
      const button = inner(host);
      expect(button.getAttribute('aria-label')).toBe('Delete the file');
      expect(button.getAttribute('aria-description')).toBe('Cannot be undone.');
      expect(button.hasAttribute('aria-labelledby')).toBe(false);
    });
  });

  it('drops relationships with no text equivalent instead of throwing', async () => {
    await withFeature('elementReflection', false, async () => {
      const host = await delegate('aria-controls="panel"', '<div id="panel"></div>');
      expect(inner(host).hasAttribute('aria-controls')).toBe(false);
    });
  });

  it('an explicit aria-label survives when no reference resolves', async () => {
    await withFeature('elementReflection', false, async () => {
      const host = await delegate('aria-label="Own" aria-labelledby="missing"');
      expect(inner(host).getAttribute('aria-label')).toBe('Own');
    });
  });
});

describe('helpers', () => {
  it('resolveIdRefs resolves in the scope’s tree and skips missing ids', async () => {
    const root = await fixture<HTMLDivElement>(`<div><i id="x"></i><i id="y"></i></div>`);
    const found = resolveIdRefs(root.firstElementChild!, 'x nope y');
    expect(found.map((element) => element.id)).toEqual(['x', 'y']);
    expect(resolveIdRefs(root, null)).toEqual([]);
  });

  it('accessibleText prefers aria-label and collapses whitespace', () => {
    const span = document.createElement('span');
    span.innerHTML = '  a \n  b ';
    expect(accessibleText(span)).toBe('a b');
    span.setAttribute('aria-label', 'Own');
    expect(accessibleText(span)).toBe('Own');
  });

  it.skipIf(isTier2)('setAriaElements sets, replaces and clears element lists', () => {
    const owner = document.createElement('button');
    const a = document.createElement('i');
    document.body.append(owner, a);
    setAriaElements(owner, 'ariaDescribedByElements', [a]);
    expect(owner.ariaDescribedByElements).toEqual([a]);
    setAriaElements(owner, 'ariaDescribedByElements', []);
    expect(owner.ariaDescribedByElements ?? []).toHaveLength(0);
    owner.remove();
    a.remove();
  });
});

/**
 * Autoloader behaviour (A§2.5) with fake loaders, so it does not depend on which families exist.
 * Tag names are unique per test: custom elements cannot be undefined again.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createAutoloader} from './autoloader.js';

let counter = 0;
const uniqueTag = () => `tct-autoload-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`;

const mounted: Element[] = [];
function mount(html: string, parent: ParentNode = document.body): Element {
  const template = document.createElement('template');
  template.innerHTML = html;
  const element = template.content.firstElementChild!;
  mounted.push(element);
  parent.append(element);
  return element;
}

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
  vi.restoreAllMocks();
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createAutoloader', () => {
  it('imports a family once for many elements of its tags', () => {
    const [a, b] = [uniqueTag(), uniqueTag()];
    const load = vi.fn(() => Promise.resolve());
    const loader = createAutoloader({map: {[a]: 'one', [b]: 'one'}, loaders: {one: load}});
    mount(`<div><${a}></${a}><${a}></${a}><${b}></${b}></div>`);
    loader.discover();
    loader.discover();
    expect(load).toHaveBeenCalledTimes(1);
    expect([...loader.requested]).toEqual(['one']);
  });

  it('ignores unknown tags and tags that are already defined', () => {
    const known = uniqueTag();
    const defined = uniqueTag();
    customElements.define(defined, class extends HTMLElement {});
    const load = vi.fn(() => Promise.resolve());
    const loader = createAutoloader({
      map: {[known]: 'known', [defined]: 'defined'},
      loaders: {known: load, defined: load},
    });
    mount(`<div><${defined}></${defined}><tct-never-mapped></tct-never-mapped></div>`);
    loader.discover();
    expect(load).not.toHaveBeenCalled();
  });

  it('finds elements added later, at any depth, and stops when told to', async () => {
    const tag = uniqueTag();
    const other = uniqueTag();
    const load = vi.fn(() => Promise.resolve());
    const otherLoad = vi.fn(() => Promise.resolve());
    const loader = createAutoloader({
      map: {[tag]: 'late', [other]: 'other'},
      loaders: {late: load, other: otherLoad},
    });
    const stop = loader.observe(document);
    expect(load).not.toHaveBeenCalled();
    mount(`<section><div><p><${tag}></${tag}></p></div></section>`);
    await tick();
    expect(load).toHaveBeenCalledTimes(1);
    stop();
    mount(`<${other}></${other}>`);
    await tick();
    expect(otherLoad).not.toHaveBeenCalled();
  });

  it('observes an application shadow root on request', async () => {
    const tag = uniqueTag();
    const load = vi.fn(() => Promise.resolve());
    const loader = createAutoloader({map: {[tag]: 'shadow'}, loaders: {shadow: load}});
    const host = mount('<div></div>');
    const root = host.attachShadow({mode: 'open'});
    const stop = loader.observe(root);
    const inner = document.createElement(tag);
    root.append(inner);
    await tick();
    expect(load).toHaveBeenCalledTimes(1);
    stop();
  });

  it('preloads by folder or tag name and retries a failed load on the next sighting', async () => {
    const tag = uniqueTag();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let attempts = 0;
    const load = vi.fn(() =>
      ++attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(),
    );
    const loader = createAutoloader({map: {[tag]: 'flaky'}, loaders: {flaky: load}});
    loader.preload([tag]);
    await tick();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(loader.requested.has('flaky')).toBe(false);
    mount(`<${tag}></${tag}>`);
    loader.discover();
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
    expect(loader.requested.has('flaky')).toBe(true);
  });

  it('does nothing without any mapped tag', () => {
    const loader = createAutoloader({map: {}, loaders: {}});
    expect(() => {
      loader.discover();
      loader.observe(document)();
    }).not.toThrow();
  });
});

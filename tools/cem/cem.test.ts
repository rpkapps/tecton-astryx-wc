import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {apiOf, buildSnapshots, serializeSnapshot} from '../api/build-snapshot.ts';
import {autoloaderMapFile} from '../generators/autoloader-map.ts';
import {cemElements, type CemPackage} from '../lib/cem.ts';
import {elementDoc} from '../lib/element-api.ts';
import {analyzeComponents} from './analyze.ts';
import {createFixtureTree, type FixtureTree} from './testing.ts';

let tree: FixtureTree;
let cem: CemPackage;

beforeAll(() => {
  tree = createFixtureTree();
  cem = analyzeComponents(tree);
});
afterAll(() => {
  tree.dispose();
});

const badge = () => cemElements(cem).find((element) => element.tagName === 'tct-sample-badge')!;

describe('CEM analysis of the sample component', () => {
  it('finds the element, its folder and the core event classes', () => {
    expect(cemElements(cem).map((element) => element.tagName)).toEqual(['tct-sample-badge']);
    expect(badge().folder).toBe('sample-badge');
    const classes = cem.modules.flatMap((module) => module.declarations ?? []).map((d) => d.name);
    expect(classes).toContain('TctRemoveEvent');
    expect(classes).toContain('TctElement');
  });

  it('reads the custom JSDoc tags (@upstream, @cloakDisplay, @cloakMinBlockSize)', () => {
    expect(badge().declaration['x-tct']).toMatchObject({
      upstream: 'Badge',
      cloakDisplay: 'inline-flex',
      cloakMinBlockSize: '1.5rem',
    });
    expect(badge().declaration.summary).toBe('A small status label.');
  });

  it('keeps the public API only: drops @internal, underscored, protected and static plumbing', () => {
    const names = (badge().declaration.members ?? []).map((member) => member.name);
    expect(names).toEqual(
      expect.arrayContaining(['variant', 'size', 'label', 'removable', 'requestRemove']),
    );
    expect(names).not.toContain('_measure');
    // `this.internals.role = …` in the constructor is not a `role` field (analyzer quirk).
    expect(names).not.toContain('role');
    expect(names).not.toContain('updated');
    expect(names).not.toContain('styles');
    expect(names).not.toContain('tagName');
    expect(names).not.toContain('internals');
    expect(names).not.toContain('dispatch');
  });

  it('resolves union and as-const aliases to option lists', () => {
    const variant = (badge().declaration.attributes ?? []).find((a) => a.name === 'variant');
    expect(variant?.['x-tct']?.values).toEqual(['neutral', 'info', 'success', 'warning', 'error']);
    const size = (badge().declaration.attributes ?? []).find((a) => a.name === 'size');
    expect(size?.['x-tct']?.values).toEqual(['sm', 'md']);
  });

  it('types @fires from the event class in core/src/events and marks native events', () => {
    const events = badge().declaration.events ?? [];
    const remove = events.find((event) => event.name === 'tct-remove');
    expect(remove?.['x-tct']).toMatchObject({
      eventClass: 'TctRemoveEvent',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    expect(remove?.['x-tct']?.fields?.[0]?.name).toBe('value');
    expect(events.find((event) => event.name === 'click')?.['x-tct']).toEqual({native: true});
  });

  it('collects slots, parts, states and custom properties', () => {
    const doc = elementDoc(badge());
    expect(doc.slots.map((slot) => slot.name)).toEqual(['', 'icon']);
    expect(doc.cssParts.map((part) => part.name)).toEqual(['badge']);
    expect(doc.cssStates.map((state) => state.name)).toEqual(['removable']);
    expect(doc.cssProperties.map((property) => property.name)).toEqual(['--sample-badge-radius']);
  });

  it('attaches the parity mapping as x-tct-upstream', () => {
    const facts = badge().declaration['x-tct-upstream'];
    expect(facts?.entry).toBe('core.badge');
    expect(facts?.keyboard?.[0]?.keys).toBe('Enter, Space');
    expect(facts?.api.some((row) => row.as === 'waived')).toBe(true);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(analyzeComponents(tree))).toBe(JSON.stringify(cem));
  });
});

describe('API snapshots', () => {
  it('produce one file per folder, without descriptions, in a stable shape', () => {
    const snapshots = buildSnapshots(cem);
    expect([...snapshots.keys()]).toEqual(['sample-badge']);
    const text = serializeSnapshot(snapshots.get('sample-badge')!);
    expect(text).toContain('"tct-sample-badge"');
    expect(text).not.toContain('Visual emphasis');
    const api = apiOf(elementDoc(badge()));
    expect(api.events.find((event) => event.name === 'tct-remove')).toEqual({
      name: 'tct-remove',
      class: 'TctRemoveEvent',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    expect(api.methods).toEqual([{name: 'requestRemove', signature: '() => boolean'}]);
  });

  it('change when the public API changes', () => {
    const before = serializeSnapshot(buildSnapshots(cem).get('sample-badge')!);
    const file = join(tree.componentsSrc, 'sample-badge/tct-sample-badge.ts');
    const original = readFileSync(file, 'utf8');
    try {
      writeFileSync(
        file,
        original.replace(
          "variant: SampleBadgeVariant = 'neutral'",
          "variant: SampleBadgeVariant = 'info'",
        ),
      );
      const after = serializeSnapshot(buildSnapshots(analyzeComponents(tree)).get('sample-badge')!);
      expect(after).not.toBe(before);
    } finally {
      writeFileSync(file, original);
    }
  });
});

describe('autoloader map', () => {
  it('lists every tag with its folder and one literal loader per folder', () => {
    const file = autoloaderMapFile('/x/src', [
      ['tct-b', 'two'],
      ['tct-a', 'one'],
      ['tct-c', 'one'],
    ]);
    expect(file.path).toBe('/x/src/generated/autoloader-map.ts');
    expect(file.content).toContain("'tct-a': 'one',\n  'tct-b': 'two',\n  'tct-c': 'one',");
    expect(file.content).toContain("'one': () => import('../one/define.js'),");
    expect(file.content.match(/=> import\(/g)).toHaveLength(2);
  });

  it('is valid with zero components', () => {
    const file = autoloaderMapFile('/x/src', []);
    expect(file.content).toContain('autoloaderMap: Readonly<Record<string, string>> = {\n};');
    expect(file.content).toContain('folderLoaders');
  });
});

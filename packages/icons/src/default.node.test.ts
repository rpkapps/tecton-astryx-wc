import {describe, expect, it} from 'vitest';
import {defaultIconNames, defaultIcons, roleIconNames, roleIcons} from './default.js';
import {lucideIconNames, lucideIcons} from './lucide.js';
import {tectonIconNames, tectonIcons} from './tecton.js';
import type {IconDefinition} from './types.js';

/** `IconName` at astryx@ca632c6 (packages/core/src/Icon/globalIconRegistry.tsx) + the namespaced role of defaultIcons.tsx. */
const UPSTREAM_ROLES = [
  'close',
  'chevronDown',
  'chevronLeft',
  'chevronRight',
  'chevronsLeft',
  'chevronsRight',
  'check',
  'success',
  'error',
  'warning',
  'info',
  'calendar',
  'clock',
  'externalLink',
  'menu',
  'moreHorizontal',
  'search',
  'arrowUp',
  'arrowDown',
  'arrowsUpDown',
  'funnel',
  'eyeSlash',
  'viewColumns',
  'copy',
  'checkDouble',
  'wrench',
  'stop',
  'microphone',
  'numberInput:stepperDown',
];

describe('default icon set (D-009)', () => {
  it('maps every upstream Astryx role name, in upstream order', () => {
    expect(roleIconNames).toEqual(UPSTREAM_ROLES);
    expect(defaultIconNames.slice(0, UPSTREAM_ROLES.length)).toEqual(UPSTREAM_ROLES);
  });

  it.each(UPSTREAM_ROLES)('%s is a 24x24 stroke glyph', (role) => {
    const icon: IconDefinition = roleIcons[role as keyof typeof roleIcons];
    expect(icon.viewBox).toBe('0 0 24 24');
    expect(icon.mode).toBe('stroke');
    expect(icon.strokeWidth).toBe(2);
    expect(icon.paths.length).toBeGreaterThan(0);
    for (const path of icon.paths) expect(path.d).toMatch(/^M/i);
    expect(icon.colored).toBeUndefined();
  });

  it('flags the directional roles for RTL mirroring and nothing else', () => {
    const mirrored = roleIconNames.filter((role) => roleIcons[role].mirrorInRtl === true);
    expect(mirrored).toEqual(['chevronLeft', 'chevronRight', 'chevronsLeft', 'chevronsRight']);
  });

  it('uses the Lucide glyph the role stands for', () => {
    expect(roleIcons.close.paths.map((p) => p.d)).toEqual(['M18 6 6 18', 'm6 6 12 12']);
    expect(roleIcons.moreHorizontal.paths).toHaveLength(3); // ellipsis: three dots
    expect(roleIcons['numberInput:stepperDown'].paths).toEqual(roleIcons.chevronDown.paths);
  });
});

describe('default set carries the Tecton domain icons (D-013 Q-02)', () => {
  it('registers every Tecton glyph as <name> and <name>-filled, after the role names', () => {
    expect(tectonIconNames).toHaveLength(18);
    const expected = tectonIconNames.flatMap((name) => [name, `${name}-filled`]);
    expect(defaultIconNames).toEqual([...UPSTREAM_ROLES, ...expected]);
    for (const name of expected)
      expect(defaultIcons[name as keyof typeof defaultIcons], name).toBe(
        tectonIcons[name as keyof typeof tectonIcons],
      );
  });

  it('keeps the role icons as plain data and the Tecton glyphs lazy', async () => {
    expect(typeof defaultIcons.close).toBe('object');
    expect(typeof defaultIcons.well).toBe('function');
    const well = await defaultIcons.well();
    expect(well).toMatchObject({viewBox: '1 1 14 14', mode: 'fill'});
    expect(await defaultIcons['well-filled']()).not.toBe(well);
  });

  it('does not collide with the Astryx role names', () => {
    expect(new Set(defaultIconNames).size).toBe(defaultIconNames.length);
  });
});

describe('lucide registry helper', () => {
  it('lists every glyph (extraction: 1,854 modules at lucide 1.48) and resolves loaders lazily', async () => {
    expect(lucideIconNames.length).toBeGreaterThan(1800);
    expect(Object.keys(lucideIcons).length).toBeGreaterThanOrEqual(lucideIconNames.length);
    const icon = await lucideIcons.activity!();
    expect(icon).toMatchObject({viewBox: '0 0 24 24', mode: 'stroke', strokeWidth: 2});
  });

  it('resolves a deprecated alias to the canonical module', async () => {
    const [alias, canonical] = await Promise.all([
      lucideIcons['more-horizontal']!(),
      lucideIcons.ellipsis!(),
    ]);
    expect(alias).toBe(canonical);
  });

  it('marks directional glyphs and leaves media controls alone', async () => {
    expect((await lucideIcons['arrow-left']!()).mirrorInRtl).toBe(true);
    expect((await lucideIcons.undo!()).mirrorInRtl).toBe(true);
    expect((await lucideIcons.play!()).mirrorInRtl).toBeUndefined();
    expect((await lucideIcons['skip-forward']!()).mirrorInRtl).toBeUndefined();
    expect((await lucideIcons.x!()).mirrorInRtl).toBeUndefined();
  });

  it('every glyph module is plain data (no shapes other than paths)', async () => {
    for (const name of ['circle', 'lock', 'database', 'inbox', 'navigation', 'chart-scatter']) {
      const icon = await lucideIcons[name]!();
      for (const path of icon.paths) expect(path.d).toMatch(/^[Mm]/);
    }
  });
});

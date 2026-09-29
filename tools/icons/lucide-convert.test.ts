import {describe, expect, it} from 'vitest';
import {
  fmt,
  iconNodeToDefinition,
  isDirectional,
  kebabToPascal,
  parseAliases,
  pascalToKebab,
  renderIconModule,
  renderRegistry,
  shapeToPath,
  type IconNode,
} from './lucide-convert.ts';

describe('shapeToPath', () => {
  it('passes path data through', () => {
    expect(shapeToPath('path', {d: 'M18 6 6 18'})).toBe('M18 6 6 18');
    expect(() => shapeToPath('path', {})).toThrow(/without d/);
  });

  it('converts a circle to two arcs', () => {
    expect(shapeToPath('circle', {cx: '12', cy: '12', r: '10'})).toBe(
      'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0',
    );
    expect(shapeToPath('circle', {cx: '7.5', cy: '7.5', r: '.5', fill: 'currentColor'})).toBe(
      'M7 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0',
    );
  });

  it('refuses a filled circle that a stroke cannot cover', () => {
    expect(() => shapeToPath('circle', {cx: 1, cy: 1, r: 4, fill: 'currentColor'})).toThrow(
      /filled circle/,
    );
  });

  it('converts a plain rect and a rounded rect (copy: 14x14 at 8,8 with rx 2)', () => {
    expect(shapeToPath('rect', {x: '3', y: '4', width: '18', height: '2'})).toBe('M3 4h18v2h-18z');
    expect(shapeToPath('rect', {width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2'})).toBe(
      'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z',
    );
  });

  it('uses the other radius when only one is given and clamps to half the side', () => {
    expect(shapeToPath('rect', {x: 15, y: 4, width: 4, height: 6, ry: 2})).toBe(
      'M17 4a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h0a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2z'.replace('h0', ''),
    );
    expect(shapeToPath('rect', {x: 0, y: 0, width: 4, height: 4, rx: 9})).toContain('a2 2 0 0 1');
  });

  it('converts an ellipse, a line, a polyline and a polygon', () => {
    expect(shapeToPath('ellipse', {cx: 12, cy: 5, rx: 9, ry: 3})).toBe(
      'M3 5a9 3 0 1 0 18 0a9 3 0 1 0 -18 0',
    );
    expect(shapeToPath('line', {x1: 8, y1: 2, x2: 8, y2: 6})).toBe('M8 2L8 6');
    expect(shapeToPath('polyline', {points: '15,9 18,9 18,11'})).toBe('M15 9L18 9L18 11');
    expect(shapeToPath('polygon', {points: '12 2 19 21 12 17 5 21 12 2'})).toBe(
      'M12 2L19 21L12 17L5 21L12 2z',
    );
  });

  it('rejects unknown elements and bad numbers', () => {
    expect(() => shapeToPath('text', {})).toThrow(/unsupported/);
    expect(() => shapeToPath('circle', {cx: 'a', cy: 1, r: 1})).toThrow(/not a number/);
    expect(() => shapeToPath('polyline', {points: '1 2 3'})).toThrow(/bad points/);
  });

  it('formats numbers without noise', () => {
    expect(fmt(0.1 + 0.2)).toBe('0.3');
    expect(fmt(-0)).toBe('0');
    expect(fmt(12)).toBe('12');
  });
});

describe('iconNodeToDefinition', () => {
  const node: IconNode = [
    ['path', {d: 'm15 18-6-6 6-6'}],
    ['circle', {cx: 12, cy: 12, r: 1}],
  ];

  it('builds a 24x24 stroke definition', () => {
    expect(iconNodeToDefinition(node, 'thing')).toEqual({
      viewBox: '0 0 24 24',
      paths: [{d: 'm15 18-6-6 6-6'}, {d: 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'}],
      mode: 'stroke',
      strokeWidth: 2,
    });
  });

  it('marks directional glyphs', () => {
    expect(iconNodeToDefinition(node, 'chevron-left').mirrorInRtl).toBe(true);
    expect(iconNodeToDefinition(node, 'arrow-big-right-dash').mirrorInRtl).toBe(true);
    expect(iconNodeToDefinition(node, 'undo-2').mirrorInRtl).toBe(true);
    expect(iconNodeToDefinition(node, 'search').mirrorInRtl).toBeUndefined();
  });
});

describe('isDirectional', () => {
  it.each([
    'arrow-left',
    'chevrons-right',
    'panel-left-close',
    'undo',
    'redo-2',
    'log-out',
    'reply-all',
  ])('%s mirrors', (name) => expect(isDirectional(name)).toBe(true));
  it.each(['play', 'skip-forward', 'step-back', 'rewind', 'fast-forward', 'x', 'copy', 'leftover'])(
    '%s does not',
    (name) => expect(isDirectional(name)).toBe(false),
  );
});

describe('names and aliases', () => {
  it('converts between kebab and Pascal case', () => {
    expect(kebabToPascal('more-horizontal')).toBe('MoreHorizontal');
    expect(pascalToKebab('MoreHorizontal')).toBe('more-horizontal');
    expect(pascalToKebab('ArrowDownAZ')).toBe('arrow-down-az');
  });

  it('parses unambiguous aliases only', () => {
    const source = [
      "export { default as Ellipsis, default as MoreHorizontal } from './icons/ellipsis.mjs';",
      "export { default as ArrowDownAZ } from './icons/arrow-down-a-z.mjs';",
      "export { default as Grid2X2 } from './icons/grid-2x2.mjs';",
      "export { default as Check } from './icons/check.mjs';",
    ].join('\n');
    const aliases = parseAliases(
      source,
      new Set(['ellipsis', 'arrow-down-a-z', 'grid-2x2', 'check']),
    );
    expect([...aliases]).toEqual([['more-horizontal', 'ellipsis']]);
  });
});

describe('rendering', () => {
  it('renders a data module', () => {
    const source = renderIconModule(
      {
        viewBox: '0 0 24 24',
        paths: [{d: 'M1 1'}],
        mode: 'stroke',
        strokeWidth: 2,
        mirrorInRtl: true,
      },
      '1.2.3',
    );
    expect(source).toContain('GENERATED by tools/icons/extract-lucide.ts from lucide@1.2.3');
    expect(source).toContain(`import type {IconDefinition} from '../types.js';`);
    expect(source).toContain(
      `paths: [{d: "M1 1"}], mode: 'stroke', strokeWidth: 2, mirrorInRtl: true`,
    );
    expect(source).toContain('export default icon;');
  });

  it('renders lazy loaders for glyphs and aliases', () => {
    const source = renderRegistry(
      ['ellipsis', 'x'],
      new Map([['more-horizontal', 'ellipsis']]),
      '1.2.3',
    );
    expect(source).toContain(`"ellipsis": () => import('./lucide/ellipsis.js')`);
    expect(source).toContain(`"more-horizontal": () => import('./lucide/ellipsis.js')`);
    expect(source).toContain('lucideIconNames: readonly string[] = ["ellipsis","x"]');
    expect(source).not.toMatch(/^import .* from '\.\/lucide/m); // no eager imports
  });
});

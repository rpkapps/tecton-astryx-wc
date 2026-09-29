import {describe, expect, it} from 'vitest';
import {findStyleViolations, isAllowedProperty} from './lib/example-style.ts';

describe('example style rule', () => {
  it('allows custom properties and size constraints', () => {
    expect(isAllowedProperty('--spinner-color')).toBe(true);
    expect(isAllowedProperty('max-inline-size')).toBe(true);
    expect(isAllowedProperty('display')).toBe(false);
    expect(
      findStyleViolations(
        '<div style="max-inline-size: 20rem; --tree-list-indent: 2rem; resize: both; overflow: auto"></div>',
      ),
    ).toEqual([]);
  });

  it('reports layout and surface properties in style attributes with their line', () => {
    const html =
      '<p>x</p>\n<div style="display: flex; gap: var(--spacing-2)">\n</div>\n<span style=\'color: red\'></span>';
    expect(findStyleViolations(html)).toEqual([
      {property: 'display', line: 2, source: 'attribute'},
      {property: 'gap', line: 2, source: 'attribute'},
      {property: 'color', line: 4, source: 'attribute'},
    ]);
  });

  it('reports declarations in <style> elements but not selectors or custom properties', () => {
    const html = [
      '<style>',
      '  #row:hover { --_indicator-hover: 1; }',
      '  #row { padding: 4px; }',
      '</style>',
    ].join('\n');
    expect(findStyleViolations(html)).toEqual([
      {property: 'padding', line: 3, source: 'style-element'},
    ]);
  });

  it('ignores HTML comments and values that merely contain colons', () => {
    const html =
      '<!-- title: T; description: style="display: flex" -->\n<div style="--x: url(a:b); inline-size: 10px"></div>';
    expect(findStyleViolations(html)).toEqual([]);
  });

  it('is not fooled by data attributes named like style', () => {
    expect(findStyleViolations('<div data-style="display: flex"></div>')).toEqual([]);
  });
});

/// <reference types="node" />
/**
 * The runtime sheet (`media-theme.light.ts`, adopted by the element) and the static sheet
 * (`media-theme.light.css`, shipped in the generated `light-dom.css`) must say the same thing.
 */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {mediaThemeLightStyles} from './media-theme.light.js';

/** Comments dropped, whitespace collapsed, so only the rules are compared. */
const rules = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('media-theme light-DOM styles', () => {
  const file = readFileSync(new URL('./media-theme.light.css', import.meta.url), 'utf8');

  it('the runtime sheet equals the static light-dom.css source', () => {
    expect(rules(mediaThemeLightStyles.cssText)).toBe(rules(file));
  });

  it('is one layered rule: the element takes no box, and [hidden] still hides it', () => {
    expect(rules(file)).toBe(
      '@layer tecton.light-dom { :where(tct-media-theme:not([hidden])) { display: contents; } }',
    );
  });
});

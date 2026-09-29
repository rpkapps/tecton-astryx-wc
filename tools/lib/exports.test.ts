import {describe, expect, it} from 'vitest';
import {scanExports, scanTagName, stripComments} from './exports.ts';

describe('scanExports', () => {
  it('finds declarations, lists and type-only exports', () => {
    const scanned = scanExports(`
      export class TctButton extends TctElement {}
      export abstract class Base {}
      export function helper() {}
      export async function later() {}
      export const BUTTON_VARIANTS = ['a'] as const;
      export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
      export interface ButtonInit {}
      export enum Legacy {}
      export {a, b as renamed, type T};
      export type {U} from './u.js';
      export {default} from './d.js';
    `);
    expect(scanned.values).toEqual([
      'BUTTON_VARIANTS',
      'Base',
      'Legacy',
      'TctButton',
      'a',
      'helper',
      'later',
      'renamed',
    ]);
    expect(scanned.types).toEqual(['ButtonInit', 'ButtonVariant', 'T', 'U']);
    expect(scanned.hasExportStar).toBe(false);
  });

  it('ignores comments and string contents', () => {
    const scanned = scanExports(`
      // export const nope = 1;
      /* export class Nope {} */
      const text = "export const stillNope = 1";
      export const yes = \`export const nope2\`;
    `);
    expect(scanned.values).toEqual(['yes']);
  });

  it('reports export star and default exports', () => {
    expect(scanExports("export * from './x.js';").hasExportStar).toBe(true);
    expect(scanExports('export default class {}').hasDefault).toBe(true);
  });
});

describe('scanTagName', () => {
  it('reads the static tagName', () => {
    expect(scanTagName("export class A { static override readonly tagName = 'tct-button'; }")).toBe(
      'tct-button',
    );
    expect(scanTagName('export class A { static tagName = "tct-x-y"; }')).toBe('tct-x-y');
    expect(scanTagName("export class A { static readonly tagName: string = 'tct-a'; }")).toBe(
      'tct-a',
    );
    expect(scanTagName('// static tagName = "tct-comment"\nexport class A {}')).toBeUndefined();
  });
});

describe('stripComments', () => {
  it('keeps comment markers inside strings', () => {
    expect(stripComments("const u = 'http://x'; // tail")).toBe("const u = 'http://x'; ");
  });
});

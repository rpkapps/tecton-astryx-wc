import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {componentFolders, generateComponentsBarrels, generateCoreBarrel} from './barrels.ts';

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'tct-barrels-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), {recursive: true});
    writeFileSync(join(root, name), content);
  }
  return root;
}

const button = `export class TctButton { static override readonly tagName = 'tct-button'; }
declare global { interface HTMLElementTagNameMap { 'tct-button': TctButton } }
`;

const byName = (files: {path: string; content: string}[], name: string) =>
  files.find((file) => file.path.endsWith(`/generated/${name}`))!.content;

describe('generateComponentsBarrels', () => {
  it('produces valid empty barrels with zero components', () => {
    const src = tree({'styles/base.styles.css': ''});
    const files = generateComponentsBarrels(src);
    expect(files.map((f) => f.path.split('/').pop())).toEqual([
      'index.ts',
      'define-all.ts',
      'autoloader-map.ts',
    ]);
    expect(byName(files, 'index.ts')).toContain('export {};');
    expect(byName(files, 'autoloader-map.ts')).toContain('autoloaderMap');
  });

  it('globs folders with a define.ts and re-exports by name', () => {
    const src = tree({
      'button/tct-button.ts': button,
      'button/button.types.ts':
        "export const BUTTON_VARIANTS = ['a'] as const;\nexport type ButtonVariant = (typeof BUTTON_VARIANTS)[number];\n",
      'button/define.ts': "import {TctButton} from './tct-button.js';\nexport {TctButton};\n",
      'button/tct-button.test.ts': 'export const ignored = 1;\n',
      'text/tct-text.ts':
        "export class TctText { static override readonly tagName = 'tct-text'; }\n",
      'text/tct-heading.ts':
        "export class TctHeading { static override readonly tagName = 'tct-heading'; }\n",
      'text/define.ts': 'export {TctText, TctHeading};\n',
      'helpers/no-define.ts': 'export const skipped = 1;\n',
      'styles/base.styles.css': '',
    });
    expect(componentFolders(src)).toEqual(['button', 'text']);
    const files = generateComponentsBarrels(src);
    const index = byName(files, 'index.ts');
    expect(index).toContain("export {BUTTON_VARIANTS} from '../button/button.types.js';");
    expect(index).toContain("export type {ButtonVariant} from '../button/button.types.js';");
    expect(index).toContain("export {TctButton} from '../button/tct-button.js';");
    expect(index).not.toContain('ignored');
    expect(index).not.toContain('skipped');
    expect(byName(files, 'define-all.ts')).toContain("import '../button/define.js';");
    expect(byName(files, 'define-all.ts')).toContain(
      "export {TctText, TctHeading} from '../text/define.js';".replace(
        'TctText, TctHeading',
        'TctHeading, TctText',
      ),
    );
    const map = byName(files, 'autoloader-map.ts');
    expect(map).toContain("'tct-button': 'button',");
    expect(map).toContain("'tct-heading': 'text',");
    expect(map).toContain("'tct-text': 'text',");
  });

  it('fails on duplicate export names across folders', () => {
    const src = tree({
      'a/tct-a.ts': 'export class Shared {}\n',
      'a/define.ts': 'export {Shared};\n',
      'b/tct-b.ts': 'export class Shared {}\n',
      'b/define.ts': 'export {Shared};\n',
    });
    expect(() => generateComponentsBarrels(src)).toThrow(/Duplicate export name "Shared"/);
  });

  it('fails on duplicate tag names and on export star', () => {
    const dup = tree({
      'a/tct-a.ts': "export class A { static tagName = 'tct-x'; }\n",
      'a/define.ts': 'export {A};\n',
      'b/tct-b.ts': "export class B { static tagName = 'tct-x'; }\n",
      'b/define.ts': 'export {B};\n',
    });
    expect(() => generateComponentsBarrels(dup)).toThrow(/Duplicate tag name "tct-x"/);
    const star = tree({
      'a/tct-a.ts': 'export class A {}\n',
      'a/define.ts': "export * from './tct-a.js';\n",
    });
    expect(() => generateComponentsBarrels(star)).toThrow(/export \*/);
  });
});

describe('generateCoreBarrel', () => {
  it('re-exports public core modules and skips tests, internals, generated output and underscore files', () => {
    const src = tree({
      'define.ts': 'export function defineElement() {}\n',
      'events/tct-event.ts': 'export class TctEvent {}\n',
      'events/tct-event.test.ts': 'export const t = 1;\n',
      'utils/internal/x.ts': 'export const hidden = 1;\n',
      'utils/_private.ts': 'export const hidden2 = 1;\n',
      'generated/index.ts': 'export const old = 1;\n',
      'env.d.ts': 'export {};\n',
    });
    const [file] = generateCoreBarrel(src);
    expect(file!.content).toContain("export {defineElement} from '../define.js';");
    expect(file!.content).toContain("export {TctEvent} from '../events/tct-event.js';");
    for (const skipped of ['hidden', 'hidden2', 'old', 'export const t'])
      expect(file!.content).not.toContain(skipped);
  });
});

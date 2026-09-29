import {describe, expect, it} from 'vitest';
import {build} from './build.ts';
import {parseTectonExport} from './export-css.ts';
import {loadInputs} from './inputs.ts';
import {buildPalette} from './palette.ts';
import {cssLightDark, cssValue, isModeInvariant, resolveTokens, roleTokenName} from './resolve.ts';

const fresh = () => structuredClone(loadInputs());
const resolveWith = (inputs = fresh()) =>
  resolveTokens(inputs, buildPalette(inputs.paletteJson), parseTectonExport(inputs.exportCss));

const real = resolveWith();
const value = (name: string, mode: 'light' | 'dark') =>
  cssValue(real.byName.get(name)!, mode, real.byName, true);

describe('parseTectonExport', () => {
  it('reads both blocks: 392 roles per mode and 69 non-colour tokens', () => {
    const exp = parseTectonExport(loadInputs().exportCss);
    expect(exp.light.size).toBe(392);
    expect(exp.dark.size).toBe(392);
    expect(exp.nonColor.size).toBe(69);
    expect(exp.light.get('--tecton-color-action-primary-bg')).toBe('#644a78');
    expect(exp.dark.get('--tecton-color-action-primary-bg')).toBe('#5d4d68');
  });

  it('rejects light/dark blocks that disagree', () => {
    const css =
      ':root {\n --tecton-color-a: #000000;\n}\n.dark {\n --tecton-color-b: #ffffff;\n}\n';
    expect(() => parseTectonExport(css)).toThrow(/disagree/);
  });
});

describe('resolveTokens (D-001)', () => {
  it('uses the export for role values in both modes', () => {
    expect(value('--color-accent', 'light')).toBe('#644a78');
    expect(value('--color-accent', 'dark')).toBe('#5d4d68');
    expect(value('--color-on-accent', 'light')).toBe('#f7f3f8');
    expect(value('--color-warning', 'light')).toBe('#ffdd89');
  });

  it('takes the export values for the three swapped text-field dark roles', () => {
    expect(value('--tecton-color-input-outlined-border-hover', 'dark')).toBe('#a7a2ac');
    expect(value('--tecton-color-input-border-hover', 'dark')).toBe('#a7a2ac');
  });

  it('rebinds the accent ink tokens through the overrides file', () => {
    const text = real.byName.get('--color-text-accent')!;
    expect(value('--color-text-accent', 'light')).toBe('#5c3878');
    expect(value('--color-icon-accent', 'light')).toBe('#5c3878');
    expect(value('--color-text-accent', 'dark')).toBe('#beb1c8');
    expect(text.override?.reason).toMatch(/1\.42:1/);
    expect(text.override?.modes).toEqual(['light']);
  });

  it('keeps upstream values where Tecton made no change and marks them', () => {
    expect(real.byName.get('--spacing-4')?.status).toBe('upstream-default');
    expect(value('--spacing-4', 'light')).toBe('16px');
  });

  it('marks data-viz and --size-element-lg provisional, motion retained-default (D-013)', () => {
    for (const name of ['--color-data-categorical-blue', '--size-element-lg'])
      expect(real.byName.get(name)?.status).toBe('provisional');
    for (const name of ['--duration-fast', '--ease-standard'])
      expect(real.byName.get(name)?.status).toBe('retained-default');
    expect(real.byName.get('--color-accent')?.status).toBe('tecton-export');
  });

  it('emits theme-local names as aliases of export roles', () => {
    const alias = real.byName.get('--tecton-color-info')!;
    expect(alias.value).toEqual({kind: 'ref', name: '--tecton-color-status-info'});
    expect(value('--tecton-color-info', 'light')).toBe('#2f5dba'); // export light, not the derived #2850a1
  });

  it('adds tecton-astryx-only component roles under export-style names', () => {
    expect(roleTokenName('component.tab.restText')).toBe('--tecton-color-tab-rest-text');
    expect(roleTokenName('accent.lilac.fill')).toBe('--tecton-color-accent-lilac-fill');
    expect(real.byName.get('--tecton-color-checkbox-border')?.status).toBe('tecton-binding');
  });

  it('builds shadows per mode and keeps syntax tokens as references', () => {
    expect(value('--shadow-low', 'light')).toBe('0px 1px 2px #0000001a');
    expect(value('--shadow-inset-error', 'dark')).toBe('inset 0px 0px 0px 2px #b25d594d');
    expect(real.byName.get('--color-syntax-keyword')?.value).toEqual({
      kind: 'ref',
      name: '--color-text-accent',
    });
    expect(value('--color-syntax-keyword', 'light')).toBe('#5c3878');
  });

  it('agrees with the shadow strings recorded in the semantic map', () => {
    const map = loadInputs().semanticMap;
    for (const name of [
      '--shadow-low',
      '--shadow-med',
      '--shadow-high',
      '--shadow-inset-selected',
    ]) {
      const token = real.byName.get(name)!;
      expect(cssLightDark(token, real.byName).toLowerCase()).toBe(
        map.tokens[name]!.css!.toLowerCase(),
      );
    }
  });

  it('renders light-dark() only for tokens that differ between modes', () => {
    expect(isModeInvariant(real.byName.get('--spacing-4')!, real.byName)).toBe(true);
    expect(cssLightDark(real.byName.get('--color-accent')!, real.byName)).toBe(
      'light-dark(#644a78, #5d4d68)',
    );
  });

  it('resolves every reference chain', () => {
    for (const token of real.tokens)
      expect(() => cssValue(token, 'light', real.byName, true)).not.toThrow();
  });
});

describe('resolveTokens failure modes', () => {
  it('rejects an override without a reason', () => {
    const inputs = fresh();
    inputs.overrides.overrides[0]!.reason = ' ';
    expect(() => resolveWith(inputs)).toThrow(/needs a reason/);
  });

  it('rejects an override that names an unknown palette path', () => {
    const inputs = fresh();
    inputs.overrides.overrides[0]!.light = 'foundational.color.nope.onLight.1';
    expect(() => resolveWith(inputs)).toThrow(/palette path not found/);
  });

  it('rejects an override of an unknown token', () => {
    const inputs = fresh();
    inputs.overrides.overrides.push({token: '--nope', value: '1px', reason: 'x'});
    expect(() => resolveWith(inputs)).toThrow(/unknown token/);
  });

  it('flags an export colour that resolves to no palette entry', () => {
    const inputs = fresh();
    inputs.exportCss = inputs.exportCss.replace(
      /(--tecton-color-avatar-fill: )#[0-9a-f]{6}/g,
      '$1#010203',
    );
    expect(() => resolveWith(inputs)).toThrow(/resolves to no palette entry/);
  });

  it('lets unresolved.allow.json waive an unresolved export colour', () => {
    const inputs = fresh();
    inputs.exportCss = inputs.exportCss.replace(
      /(--tecton-color-avatar-fill: )#[0-9a-f]{6}/g,
      '$1#010203',
    );
    inputs.unresolvedAllow.entries.push({token: '--tecton-color-avatar-fill', reason: 'test'});
    const resolved = resolveWith(inputs);
    const token = resolved.byName.get('--tecton-color-avatar-fill')!;
    expect(token.value).toMatchObject({kind: 'color', light: '#010203'});
  });

  it('detects a map value that disagrees with the palette', () => {
    const inputs = fresh();
    inputs.semanticMap.tokens['--color-background-body']!.exportAlt!.light.value = '#000000';
    expect(() => resolveWith(inputs)).toThrow(/export/);
  });
});

describe('build', () => {
  it('produces every output file', () => {
    const result = build();
    expect([...result.files.keys()].sort()).toEqual([
      'fallbacks.json',
      'fonts.css',
      'palette.css',
      'palette.manifest.json',
      'tecton.css',
      'tokens.css',
      'tokens.d.ts',
      'tokens.js',
      'tokens.json',
    ]);
  });

  it('is deterministic', () => {
    const [a, b] = [build(), build()];
    for (const [file, content] of a.files) expect(b.files.get(file)).toBe(content);
    expect(a.snapshot).toBe(b.snapshot);
  });
});

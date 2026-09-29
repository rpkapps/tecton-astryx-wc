/**
 * How component keys, style keys and token defaults map onto the web components: the parts of the
 * theme utilities that are new here (upstream targets `.astryx-*` classes and `data-*` attributes).
 */
import {afterEach, beforeAll, describe, expect, it} from 'vitest';
import {defineTheme} from './define-theme.js';
import {getDerivedVars} from './derived-var-registry.js';
import {generateOnMediaCSS, generateThemeRules} from './generate-theme-rules.js';
import {cssVar, MEDIA_ATTRIBUTE, TAG_PREFIX, THEME_ATTRIBUTE} from './naming.js';
import {attributeName, parseStyleKey} from './parse-style-key.js';
import {
  registerTokenDefaults,
  resetTokenDefaults,
  tokenDefaults,
  tokenDefaultsFromMetadata,
} from './token-defaults.js';
import {
  registerThemingTargets,
  resetThemingTargets,
  resolveThemingTarget,
  themingTargetsFromCem,
} from './theming-targets.js';
import {tokenVar, tokenVars} from './tokens.js';
import {pipelineTokens, registerPipelineDefaults} from './_tokens-fixture.js';

afterEach(() => {
  resetThemingTargets();
});

const rulesFor = (components: Record<string, Record<string, Record<string, string>>>): string =>
  generateThemeRules(defineTheme({name: 'targets', components})).join('\n');

describe('naming', () => {
  it('names the attributes the elements write and the tokens pipeline targets', () => {
    expect(THEME_ATTRIBUTE).toBe('data-tct-theme');
    expect(MEDIA_ATTRIBUTE).toBe('data-media-theme');
    expect(TAG_PREFIX).toBe('tct-');
  });

  it('builds public component custom properties without a namespace segment', () => {
    expect(cssVar('card-padding')).toBe('--card-padding');
  });
});

describe('parseStyleKey', () => {
  it.each([
    ['base', ''],
    ['variant:secondary', '[variant="secondary"]'],
    ['level:1', '[level="1"]'],
    ['checked', '[checked]'],
    ['checked+disabled', '[checked][disabled]'],
    ['variant:destructive+size:sm', '[variant="destructive"][size="sm"]'],
    ['iconOnly:true', '[icon-only="true"]'],
  ])('%s selects %s', (key, expected) => {
    expect(parseStyleKey(key)).toBe(expected);
  });

  it('kebab-cases a camelCase prop', () => {
    expect(attributeName('hasTabularNumbers')).toBe('has-tabular-numbers');
    expect(attributeName('size')).toBe('size');
  });

  it('escapes a quote, a backslash and a control character in a value', () => {
    expect(parseStyleKey('label:a"b')).toBe('[label="a\\22 b"]');
    expect(parseStyleKey('label:a\\b')).toBe('[label="a\\5c b"]');
    expect(parseStyleKey('label:a\nb')).toBe('[label="a\\a b"]');
  });
});

describe('resolveThemingTarget', () => {
  it('knows the elements that already exist, with their own part names', () => {
    expect(resolveThemingTarget('button')).toEqual({tag: 'tct-button', part: 'button'});
    expect(resolveThemingTarget('text')).toEqual({tag: 'tct-text', part: 'text'});
    expect(resolveThemingTarget('heading')).toEqual({tag: 'tct-heading', part: 'text'});
    expect(resolveThemingTarget('icon')).toEqual({tag: 'tct-icon', part: 'icon'});
  });

  it('falls back to tct-<key> with the base part', () => {
    expect(resolveThemingTarget('card')).toEqual({tag: 'tct-card', part: 'base'});
    expect(resolveThemingTarget('hover-card')).toEqual({tag: 'tct-hover-card', part: 'base'});
  });

  it('resolves a deprecated key to the key that replaced it', () => {
    expect(resolveThemingTarget('hovercard')).toEqual(resolveThemingTarget('hover-card'));
    expect(resolveThemingTarget('textarea')).toEqual(resolveThemingTarget('text-area'));
    expect(resolveThemingTarget('progressbar-mark')).toEqual(
      resolveThemingTarget('progress-bar-mark'),
    );
  });

  it('prefers a registered target, and forgets it on reset', () => {
    registerThemingTargets({'progress-bar-mark': {tag: 'tct-progress-bar', part: 'mark'}});
    expect(resolveThemingTarget('progressbar-mark')).toEqual({
      tag: 'tct-progress-bar',
      part: 'mark',
    });
    resetThemingTargets();
    expect(resolveThemingTarget('progress-bar-mark').tag).toBe('tct-progress-bar-mark');
  });

  it('lets a registered target address the host (no part)', () => {
    registerThemingTargets({stack: {tag: 'tct-stack'}});
    expect(rulesFor({stack: {base: {gap: '4px'}}})).toContain('tct-stack {');
  });
});

describe('themingTargetsFromCem', () => {
  const cem = {
    modules: [
      {
        declarations: [
          {
            tagName: 'tct-button',
            cssParts: [
              {name: 'button', description: 'The native button. Astryx target `astryx-button`.'},
              {name: 'icon', description: 'The leading icon wrapper.'},
            ],
          },
          {
            tagName: 'tct-selector',
            cssParts: [
              {name: 'base', description: 'The field (Astryx target `astryx-selector`).'},
              {name: 'popup', description: 'The list (Astryx target `astryx-selector-popup`).'},
            ],
          },
          {tagName: 'tct-empty'},
          {kind: 'class'},
        ],
      },
      {},
    ],
  };

  it('maps each documented Astryx target to its element and part', () => {
    expect(themingTargetsFromCem(cem)).toEqual({
      button: {tag: 'tct-button', part: 'button'},
      selector: {tag: 'tct-selector', part: 'base'},
      'selector-popup': {tag: 'tct-selector', part: 'popup'},
    });
  });

  it('returns nothing for a manifest without modules', () => {
    expect(themingTargetsFromCem(null)).toEqual({});
    expect(themingTargetsFromCem({})).toEqual({});
  });

  it('feeds the generator once registered', () => {
    registerThemingTargets(themingTargetsFromCem(cem));
    expect(rulesFor({'selector-popup': {base: {maxHeight: '240px'}}})).toContain(
      'tct-selector::part(popup) {',
    );
  });
});

describe('component rules on the web components', () => {
  it('puts a component key on its part and a prop:value key on the reflected attribute', () => {
    const css = rulesFor({button: {'variant:secondary+size:sm': {padding: '2px'}}});
    expect(css).toContain('tct-button[variant="secondary"][size="sm"]::part(button) {');
  });

  it('selects a boolean state by attribute presence', () => {
    expect(rulesFor({card: {selected: {borderColor: 'red'}}})).toContain(
      'tct-card[selected]::part(base) {',
    );
  });

  it('puts the disabled guard of a themed :hover on the host, before the part', () => {
    const css = generateThemeRules(
      defineTheme({name: 'targets', components: {button: {base: {':hover': {color: 'red'}}}}}),
    ).join('\n');
    expect(css).toContain(
      'tct-button:where(:not([disabled], [aria-disabled="true"]))::part(button):hover {',
    );
  });

  it('never wraps a part in :is(), which cannot hold a pseudo-element', () => {
    const css = generateOnMediaCSS(
      defineTheme({
        name: 'media',
        onDark: {components: {button: {'variant:ghost': {borderWidth: '1px'}}}},
      }),
    );
    expect(css).toContain(
      ':is([data-media-theme="dark"]) tct-button[variant="ghost"]::part(button) {',
    );
    expect(css).not.toMatch(/:is\([^)]*::part/);
  });

  it('keeps an explicit Text size and colour ahead of a themed type, on the text part', () => {
    const css = rulesFor({text: {'type:body': {fontSize: '1rem'}}});
    expect(css).toContain('tct-text[size="sm"]::part(text) { font-size: var(--font-size-sm); }');
    expect(css).toContain(
      'tct-text[color="secondary"]::part(text) { color: var(--color-text-secondary); }',
    );
  });
});

describe('derived vars', () => {
  it('expands container padding into the public --<component>-padding properties', () => {
    const css = rulesFor({card: {base: {padding: '20px'}}});
    expect(css).toContain('--card-padding: 20px');
    expect(css).not.toMatch(/[{;]\s*padding:/);
  });

  it('expands directional container padding', () => {
    const css = rulesFor({section: {base: {paddingBlock: '8px', paddingInline: '16px'}}});
    expect(css).toContain('--section-padding-block-start: 8px');
    expect(css).toContain('--section-padding-block-end: 8px');
    expect(css).toContain('--section-padding-inline: 16px');
  });

  it('leaves everything else as a plain property on the part: no private aliases', () => {
    const css = rulesFor({
      button: {base: {borderRadius: '9px'}},
      card: {base: {borderRadius: '4px'}},
    });
    expect(css).toContain('tct-button::part(button) {\n    border-radius: 9px;');
    expect(css).toContain('border-radius: 4px');
    expect(css).not.toContain('--_');
  });

  it('registers only the container components', () => {
    expect(getDerivedVars('card', 'padding')).toEqual([{property: 'padding', expand: 'container'}]);
    expect(getDerivedVars('button', 'borderRadius')).toEqual([]);
    expect(getDerivedVars('unknown', 'padding')).toEqual([]);
  });
});

describe('token defaults', () => {
  beforeAll(() => {
    resetTokenDefaults();
  });

  it('starts empty and registers a value, or a pair as light-dark()', () => {
    expect(Object.keys(tokenDefaults)).toHaveLength(0);
    registerTokenDefaults({'--a': 'red', '--b': ['white', 'black']});
    expect(tokenDefaults).toEqual({'--a': 'red', '--b': 'light-dark(white, black)'});
    resetTokenDefaults();
    expect(Object.keys(tokenDefaults)).toHaveLength(0);
  });

  it('converts pipeline metadata: one value where the schemes agree, a pair otherwise', () => {
    expect(
      tokenDefaultsFromMetadata({
        '--same': {light: '4px', dark: '4px'},
        '--differs': {light: '#fff', dark: '#000'},
      }),
    ).toEqual({'--same': '4px', '--differs': ['#fff', '#000']});
  });

  it('registers the whole pipeline token set', () => {
    registerPipelineDefaults();
    expect(Object.keys(tokenDefaults)).toHaveLength(Object.keys(pipelineTokens()).length);
    expect(tokenDefaults['--spacing-4']).toBe(pipelineTokens()['--spacing-4']!.light);
  });

  it('feeds tokenVars, which reads any name as its reference and enumerates the defaults', () => {
    registerPipelineDefaults();
    expect(tokenVars['--anything']).toBe(tokenVar('--anything'));
    expect(Object.keys(tokenVars)).toHaveLength(Object.keys(pipelineTokens()).length);
    expect('--color-accent' in tokenVars).toBe(true);
    expect('--not-a-token' in tokenVars).toBe(false);
  });
});

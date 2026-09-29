/**
 * The layout expression language: parser (both surfaces), validator, printer round trips and the markup the
 * expander generates, plus the `tct layout` commands (exit codes, path safety, stdin, JSON).
 */
import {existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {MAX_REPEAT, expand} from './layout/expand.ts';
import {LayoutParseError, detectForm, parse} from './layout/parse.ts';
import {toCompact, toOutline} from './layout/print.ts';
import {buildLayoutRegistry, resolveElement} from './layout/registry.ts';
import {validate} from './layout/validate.ts';
import {Sandbox, fixtureRegistry} from './testing/fixture.ts';

const registry = buildLayoutRegistry(fixtureRegistry());

function markup(source: string, options: {loose?: boolean} = {}): string {
  const doc = parse(source);
  const {errors} = validate(doc, registry, options);
  expect(errors.map((issue) => issue.message)).toEqual([]);
  return expand(doc, registry)
    .html.replace(/^<!--.*-->\n/, '')
    .replace(/\n<script[\s\S]*$/, '')
    .trimEnd();
}

function errorsOf(source: string, options: {loose?: boolean} = {}) {
  return validate(parse(source), registry, options).errors;
}

describe('registry', () => {
  it('drops an alias whose element does not exist and resolves tags, short and Pascal names', () => {
    expect(registry.aliases.get('V')).toBe('tct-vstack');
    expect(registry.aliases.has('Sp')).toBe(false);
    for (const name of ['V', 'tct-vstack', 'vstack', 'VStack', 'TCT-VSTACK']) {
      expect(resolveElement(registry, name)?.tag, name).toBe('tct-vstack');
    }
    expect(resolveElement(registry, 'nope')).toBeNull();
  });
});

describe('parser: compact surface', () => {
  it('parses nesting, siblings, groups, payloads, ids, mods, attributes, slots and repeats', () => {
    const doc = parse('V#page.wide[gap=4 p2 !scroll @start=B"x"] > (Tx"a":"b" + B*3) + Tx');
    const page = doc.roots[0]!;
    expect(page).toMatchObject({kind: 'node', name: 'V', id: 'page', enumMods: ['wide']});
    if (page.kind !== 'node') throw new Error('node expected');
    expect(page.attrs.map((attr) => attr.key)).toEqual(['gap', 'p', 'scroll']);
    expect(page.slots[0]?.key).toBe('start');
    // `+ Tx` after the `>` chain is a sibling of the group, inside V.
    expect(page.children).toHaveLength(2);
    expect(doc.roots).toHaveLength(1);
  });

  it('accepts hyphenated tag names', () => {
    const doc = parse('tct-vstack[row-gap=2] > tct-text');
    expect(doc.roots[0]).toMatchObject({name: 'tct-vstack'});
  });

  it('separates overlays with ;;', () => {
    const doc = parse('B"Open"[opens=#d] ;; Dlg#d');
    expect(doc.overlays).toHaveLength(1);
  });

  it('rejects a climb-up, dangling operators, unbalanced brackets and leftover text with a position', () => {
    const cases: [string, RegExp][] = [
      ['V > B ^ B', /climb-up/],
      ['V >', /Expected an element after '>'/],
      ['V + ', /Expected an element after '\+'/],
      ['V[gap=4', /Unclosed '\['/],
      ['V > (B "x"', /Unclosed '\('/],
      ['V > (Tx"a" + B"c"fill)', /Unexpected 'f'/],
      ['B"unterminated', /Unterminated string/],
      ['{Not A Ref}', /not an element reference/],
    ];
    for (const [source, message] of cases) {
      expect(() => parse(source), source).toThrow(LayoutParseError);
      try {
        parse(source);
      } catch (error) {
        expect((error as LayoutParseError).message).toMatch(message);
        expect((error as LayoutParseError).line).toBeGreaterThanOrEqual(1);
        expect((error as LayoutParseError).col).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('caps nesting so a hostile expression is a located error, not a stack overflow', () => {
    const deep = `${'V > ('.repeat(600)}B${')'.repeat(600)}`;
    expect(() => parse(deep)).toThrow(/nested too deeply/);
  });
});

describe('parser: outline surface', () => {
  const outline = [
    'V gap=4',
    '  Tx "Title"',
    '  H',
    '    B.primary "Save"',
    '    repeat 2:',
    '      B "Item $"',
  ].join('\n');

  it('parses indentation, repeat blocks and quoted payloads', () => {
    const doc = parse(outline);
    expect(doc.form).toBe('outline');
    expect(detectForm(outline)).toBe('outline');
    expect(doc.roots).toHaveLength(1);
  });

  it('parses slot lines and overlays sections', () => {
    const doc = parse(
      [
        'Tbar',
        '  start: B "Back"',
        '  end:',
        '    B "Save"',
        '',
        'overlays:',
        '  Dlg#confirm',
      ].join('\n'),
    );
    const root = doc.roots[0]!;
    if (root.kind !== 'node') throw new Error('node expected');
    expect(root.slots.map((slot) => slot.key)).toEqual(['start', 'end']);
    expect(doc.overlays).toHaveLength(1);
  });

  it('treats multi-line input with trailing operators as compact', () => {
    expect(detectForm('V >\n  B')).toBe('compact');
    expect(parse('V >\n  B').form).toBe('compact');
    expect(detectForm('B')).toBe('compact');
  });

  it('reports a slot with no parent as a parse error', () => {
    expect(() => parse('start: B "x"', {form: 'outline'})).toThrow(/has no parent element/);
  });
});

describe('printers', () => {
  const cases = [
    'V[gap=4] > (Tx"Title" + H[gap=2] > (B.primary"Save" + B"Cancel"))',
    'G[columns=3 gap=4] > (C[padding=4]*3)',
    'Dlg[@footer=(B"Save" + B"Go")] > Tx"Hello"',
    'B"Open"[opens=#d] ;; Dlg#d[width=400] > Tx"Sure?"',
    'Tx"it\'s" + Tx\'say "hi"\'',
  ];

  it.each(cases)('round-trips through compact and outline: %s', (source) => {
    const first = parse(source);
    const compact = toCompact(first);
    expect(toCompact(parse(compact))).toBe(compact);
    const outline = toOutline(first);
    expect(toOutline(parse(outline))).toBe(outline);
    // Both surfaces mean the same thing: they expand to the same markup.
    const expandOf = (doc: ReturnType<typeof parse>) => {
      expect(validate(doc, registry).errors).toEqual([]);
      return expand(doc, registry).html;
    };
    expect(expandOf(parse(compact))).toBe(expandOf(parse(source)));
    expect(expandOf(parse(outline))).toBe(expandOf(parse(source)));
  });

  it('chooses the quote the text does not contain', () => {
    expect(toCompact(parse('Tx"it\'s"'))).toBe('Tx"it\'s"');
    expect(toCompact(parse('Tx\'say "hi"\''))).toBe('Tx\'say "hi"\'');
  });
});

describe('validator', () => {
  it('normalises spelling variants silently: p6, pad=6 and padding=6 are the same', () => {
    const one = markup('V[p6]');
    expect(markup('V[pad=6]')).toBe(one);
    expect(markup('V[padding=6]')).toBe(one);
    expect(one).toContain('padding="6"');
  });

  it('reports an unknown element with ranked suggestions', () => {
    const [issue] = errorsOf('Tx > Buton');
    expect(issue?.message).toMatch(/Unknown element or alias 'Buton'/);
    expect(issue?.suggestions).toContain('button');
    expect(issue?.line).toBe(1);
  });

  it('reports an unknown attribute, an out-of-range enum value and a wrong slot', () => {
    expect(errorsOf('V[gapp=4]')[0]).toMatchObject({
      message: expect.stringMatching(/no attribute 'gapp'/) as string,
      suggestions: expect.arrayContaining(['gap']) as string[],
    });
    expect(errorsOf('B[variant=fancy]')[0]?.message).toMatch(/must be one of primary \| secondary/);
    expect(errorsOf('B[variant=primar]')[0]?.suggestions).toContain('primary');
    expect(errorsOf('V[gap=7]')[0]?.message).toMatch(/gap must be one of/);
    expect(errorsOf('Dlg[@nope=B]')[0]?.message).toMatch(/has no slot 'nope'/);
  });

  it('resolves a bare word to a boolean attribute or a unique enum value, and refuses an ambiguous one', () => {
    expect(markup('B.primary"x"')).toContain('variant="primary"');
    expect(markup('B[dis]')).toContain('disabled');
    expect(markup('V[scroll]')).toContain('scrollable');
    expect(markup('V[!scroll]')).not.toContain('scrollable');
    expect(errorsOf('V[start]')[0]?.message).toMatch(/ambiguous/);
    expect(errorsOf('V[!gap]')[0]?.message).toMatch(/does not match a boolean attribute/);
  });

  it('maps the axis-neutral j= and a= onto the right alignment attributes per element', () => {
    expect(markup('V[j=center a=end]')).toContain('v-align="center" h-align="end"');
    expect(markup('H[j=between a=center]')).toContain('h-align="between" v-align="center"');
    expect(markup('St[j=center a=end]')).toContain('justify="center" alignment="end"');
  });

  it('turns the grid columns object into the real attributes', () => {
    expect(markup('G[c{min:240,max:3,fit}]')).toContain(
      'column-min-width="240" column-max="3" column-repeat="fit"',
    );
    expect(markup('G[c4]')).toContain('columns="4"');
  });

  it('enforces the pairings of stack items and grid spans', () => {
    expect(errorsOf('C > SI')[0]?.message).toMatch(/only valid directly under/);
    expect(errorsOf('V > GS')[0]?.message).toMatch(/only valid directly under tct-grid/);
    expect(errorsOf('V > SI')).toEqual([]);
    expect(errorsOf('G > GS')).toEqual([]);
  });

  it('checks element references: a tct-* element, an app custom element (warned), else an error or, loosely, a TODO', () => {
    expect(markup('V > {tct-card}')).toContain('<tct-card></tct-card>');
    const doc = parse('V > {kpi-card}');
    const {errors, warnings} = validate(doc, registry);
    expect(errors).toEqual([]);
    expect(warnings[0]?.message).toMatch(/not a tct-\* element/);
    expect(expand(doc, registry).html).toContain('<kpi-card></kpi-card>');
    expect(errorsOf('V > {nope}')[0]?.message).toMatch(/Unknown element reference/);
    expect(markup('V > {nope}', {loose: true})).toContain('TODO(layout)');
  });

  it('warns about an overlay without an id', () => {
    const doc = parse('B ;; Dlg');
    expect(validate(doc, registry).warnings[0]?.message).toMatch(/has no #id/);
  });
});

describe('expander', () => {
  it('generates nested markup with attributes, text and the family imports', () => {
    const doc = parse('V[gap=4] > (Tx"Title" + H[gap=2] > (B.primary"Save" + B"Cancel"))');
    validate(doc, registry);
    const {html, elementsUsed, imports} = expand(doc, registry);
    expect(html).toBe(
      [
        '<!-- Generated by `tct layout expand`: this markup is the artifact; edit freely. -->',
        '<tct-vstack gap="4">',
        '  <tct-text>Title</tct-text>',
        '  <tct-hstack gap="2">',
        '    <tct-button variant="primary" label="Save"></tct-button>',
        '    <tct-button label="Cancel"></tct-button>',
        '  </tct-hstack>',
        '</tct-vstack>',
        '',
        '<script type="module">',
        "  import '@tecton-wc/components/button';",
        "  import '@tecton-wc/components/hstack';",
        "  import '@tecton-wc/components/text';",
        "  import '@tecton-wc/components/vstack';",
        '</script>',
        '',
      ].join('\n'),
    );
    expect(elementsUsed).toEqual(['tct-button', 'tct-hstack', 'tct-text', 'tct-vstack']);
    expect(imports).toHaveLength(4);
  });

  it('is deterministic: the same expression gives byte-identical markup', () => {
    const source = 'G[c3 g2] > (C[p3] > Tx"x")*3';
    expect(markup(source)).toBe(markup(source));
  });

  it('puts text in the label attribute when the element has one, else in the default slot', () => {
    expect(markup('B"Save"')).toBe('<tct-button label="Save"></tct-button>');
    expect(markup('Tx"Hi"')).toBe('<tct-text>Hi</tct-text>');
    expect(markup('Dlg"Title"')).toBe('<tct-dialog heading="Title"></tct-dialog>');
  });

  it('escapes text and attribute values', () => {
    expect(markup('Tx"a <b> & c"')).toBe('<tct-text>a &lt;b&gt; &amp; c</tct-text>');
    expect(markup('B[label=\'say "hi"\']')).toContain('label="say &quot;hi&quot;"');
  });

  it('routes slot content with its slot attribute', () => {
    expect(markup('Dlg[@footer=(B"Cancel" + B"OK")]')).toBe(
      [
        '<tct-dialog>',
        '  <tct-button slot="footer" label="Cancel"></tct-button>',
        '  <tct-button slot="footer" label="OK"></tct-button>',
        '</tct-dialog>',
      ].join('\n'),
    );
    expect(markup("Dlg[@footer='hello']")).toContain('<tct-text slot="footer">hello</tct-text>');
  });

  it('repeats with a $ counter, a literal \\$ and a cap', () => {
    expect(markup('V > (Tx"item-$")*3')).toMatch(/item-1[\s\S]*item-2[\s\S]*item-3/);
    expect(markup('Tx"cost \\$5"*2')).toBe(
      '<tct-text>cost $5</tct-text>\n<tct-text>cost $5</tct-text>',
    );
    expect(MAX_REPEAT).toBe(10000);
    const doc = parse('V > (Tx*10000)*10000');
    validate(doc, registry);
    expect(() => expand(doc, registry)).toThrow(/more than 100000 elements/);
  });

  it('wraps a fill child of a stack in a stack item and ignores fill elsewhere', () => {
    expect(markup('H > (B"a"[fill] + B"b")')).toContain(
      '<tct-stack-item size="fill">\n    <tct-button label="a"></tct-button>\n  </tct-stack-item>',
    );
    expect(markup('C > B"a"[fill]')).not.toContain('tct-stack-item');
  });

  it('emits overlays after the tree and wires the trigger', () => {
    const doc = parse('B"Open"[opens=#confirm] ;; Dlg#confirm[width=400] > Tx"Sure?"');
    validate(doc, registry);
    const {html} = expand(doc, registry);
    expect(html).toContain('<tct-button label="Open" data-opens="confirm"></tct-button>');
    expect(html).toContain('<tct-dialog id="confirm" width="400">');
    expect(html).toContain("document.querySelectorAll('[data-opens]')");
  });

  it('marks a selected element and reports a state that does not exist', () => {
    expect(markup('B"a"!')).toContain('selected');
    const doc = parse('V!');
    validate(doc, registry);
    expect(expand(doc, registry).todos[0]).toMatch(/no selected state/);
  });
});

describe('tct layout', () => {
  let sandbox: Sandbox;
  beforeEach(() => {
    sandbox = new Sandbox();
  });
  afterEach(() => {
    sandbox.dispose();
  });

  it('grammar lists the aliases of this install', async () => {
    const result = await sandbox.run(['layout', 'grammar', '--json']);
    const data = (
      JSON.parse(result.stdout) as {data: {text: string; aliases: Record<string, string>}}
    ).data;
    expect(data.aliases.V).toBe('tct-vstack');
    expect(data.text).toMatch(/H=tct-hstack/);
    expect(data.text).not.toMatch(/Sp=tct-spinner/);
    expect(data.text).toContain(`at most ${MAX_REPEAT} copies`);
  });

  it('check prints both canonical surfaces for a valid expression, and errors with suggestions for an invalid one', async () => {
    const ok = await sandbox.run(['layout', 'check', 'V > (Tx"a" + B"b")']);
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout).toMatch(/\[ok\] Valid \(parsed as compact\)/);
    expect(ok.stdout).toMatch(/^compact$/m);
    expect(ok.stdout).toMatch(/^outline$/m);
    const bad = await sandbox.run(['layout', 'check', 'V > Buton']);
    expect(bad.exitCode).toBe(1);
    expect(bad.stdout).toMatch(/\[fail\] Invalid \(1 error\)/);
    expect(bad.stdout).toMatch(/did you mean: button/);
  });

  it('check --form outline reads the outline surface', async () => {
    const result = await sandbox.run(['layout', 'check', 'V\n  Tx "a"', '--json']);
    const data = (JSON.parse(result.stdout) as {data: {form: string; compact: string}}).data;
    expect(data.form).toBe('outline');
    expect(data.compact).toBe('V > Tx"a"');
  });

  it('reads the expression from a file and from stdin (-)', async () => {
    sandbox.write('layout.txt', 'V > Tx"from file"');
    const file = await sandbox.run(['layout', 'expand', '--file', 'layout.txt']);
    expect(file.stdout).toContain('from file');
    const stdin = await sandbox.run(['layout', 'expand', '-'], {stdin: 'V > Tx"from stdin"'});
    expect(stdin.stdout).toContain('from stdin');
    expect((await sandbox.run(['layout', 'expand', '-'])).exitCode).toBe(1);
  });

  it('caps stdin and files', async () => {
    const big = 'V >'.padEnd(6 * 1024 * 1024, ' ');
    const result = await sandbox.run(['layout', 'check', '-', '--json'], {stdin: big});
    expect(result.exitCode).toBe(1);
    expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_INVALID_ARGUMENT');
    sandbox.write('big.txt', big);
    const file = await sandbox.run(['layout', 'check', '--file', 'big.txt', '--json']);
    expect((JSON.parse(file.stdout) as {code: string}).code).toBe('ERR_INVALID_ARGUMENT');
  });

  it('expand writes a file (or layout.html in a directory), refuses to overwrite, and stays inside the project', async () => {
    const one = await sandbox.run(['layout', 'expand', 'V > Tx"a"', 'out/page.html']);
    expect(one.exitCode).toBe(0);
    expect(one.stdout).toMatch(/\[ok\] Expanded to out\/page.html/);
    expect(readFileSync(join(sandbox.cwd, 'out/page.html'), 'utf8')).toContain('<tct-vstack>');
    const dir = await sandbox.run(['layout', 'expand', 'V > Tx"a"', 'gen']);
    expect(dir.exitCode).toBe(0);
    expect(existsSync(join(sandbox.cwd, 'gen/layout.html'))).toBe(true);

    writeFileSync(join(sandbox.cwd, 'mine.html'), 'mine');
    const exists = await sandbox.run(['layout', 'expand', 'V', 'mine.html', '--json']);
    expect(exists.exitCode).toBe(1);
    expect((JSON.parse(exists.stdout) as {code: string}).code).toBe('ERR_FILE_EXISTS');
    expect(readFileSync(join(sandbox.cwd, 'mine.html'), 'utf8')).toBe('mine');
    expect((await sandbox.run(['layout', 'expand', 'V', 'mine.html', '--force'])).exitCode).toBe(0);

    const outside = join(sandbox.root, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(sandbox.cwd, 'linked'));
    for (const path of ['../x.html', 'linked/x.html', join(outside, 'y.html')]) {
      const result = await sandbox.run(['layout', 'expand', 'V', path, '--json']);
      expect(result.exitCode, path).toBe(1);
      expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_PATH_TRAVERSAL');
    }
    expect(existsSync(join(outside, 'x.html'))).toBe(false);
  });

  it('expand of an invalid expression is ERR_LAYOUT_INVALID with the issues and suggestions', async () => {
    const result = await sandbox.run(['layout', 'expand', 'V > Buton', '--json']);
    const envelope = JSON.parse(result.stdout) as {
      code: string;
      error: string;
      suggestions: {name: string}[];
    };
    expect(result.exitCode).toBe(1);
    expect(envelope.code).toBe('ERR_LAYOUT_INVALID');
    expect(envelope.error).toMatch(/Unknown element or alias 'Buton'/);
    expect(envelope.suggestions.map((suggestion) => suggestion.name)).toContain('button');
  });

  it('a syntax error is ERR_LAYOUT_PARSE with line and column', async () => {
    const result = await sandbox.run(['layout', 'check', 'V[gap=4', '--json']);
    const envelope = JSON.parse(result.stdout) as {code: string; error: string};
    expect(envelope.code).toBe('ERR_LAYOUT_PARSE');
    expect(envelope.error).toMatch(/line 1, col \d+/);
  });

  it('--loose turns an unknown reference into a warning and a TODO', async () => {
    expect((await sandbox.run(['layout', 'expand', 'V > {nope}'])).exitCode).toBe(1);
    const loose = await sandbox.run(['layout', 'expand', 'V > {nope}', '--loose', '--json']);
    expect(loose.exitCode).toBe(0);
    const data = (JSON.parse(loose.stdout) as {data: {warnings: string[]; todos: string[]}}).data;
    expect(data.warnings[0]).toMatch(/--loose/);
    expect(data.todos[0]).toMatch(/unresolved element reference/);
  });
});

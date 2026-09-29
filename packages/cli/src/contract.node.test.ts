/**
 * The CLI contract: exit codes and the JSON envelope. Ported from the upstream CLI's contract tests
 * (cli-exit-codes, json-contract, error-envelope-code): the exit code is the contract; `--json` and text
 * mode agree on it; every `--json` emission is one valid envelope, stderr stays empty on error; commands
 * that do not support `--json` are rejected before any side effect.
 */
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {ERROR_CODES, isErrorCode} from './errors.ts';
import {API_VERSION, assertResponse, isError, parseResponse, type CLIError} from './json.ts';
import {Sandbox} from './testing/fixture.ts';

let sandbox: Sandbox;
beforeAll(() => {
  sandbox = new Sandbox();
});
afterAll(() => {
  sandbox.dispose();
});

const parse = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

describe('exit codes', () => {
  it('help and version exit 0', async () => {
    for (const argv of [
      [],
      ['--help'],
      ['-h'],
      ['--version'],
      ['-V'],
      ['component', '--help'],
      ['help', 'search'],
      ['layout'],
    ]) {
      const result = await sandbox.run(argv);
      expect(result.exitCode, argv.join(' ')).toBe(0);
    }
  });

  it('a bare command with a default lists and exits 0', async () => {
    for (const argv of [
      ['component'],
      ['docs'],
      ['controllers'],
      ['discover'],
      ['doctor'],
      ['manifest'],
      ['gap-report', '--list-categories'],
    ]) {
      const result = await sandbox.run(argv);
      expect(result.exitCode, argv.join(' ')).toBe(0);
    }
  });

  it('an unknown command exits 1 with suggestions', async () => {
    const result = await sandbox.run(['componet']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/unknown command 'componet'/);
    expect(result.stderr).toMatch(/component/);
    expect(result.stdout).toBe('');
  });

  it('an unknown subcommand, an unknown option and a missing argument exit 1', async () => {
    expect((await sandbox.run(['layout', 'bogus'])).exitCode).toBe(1);
    expect((await sandbox.run(['search', 'x', '--bogus'])).exitCode).toBe(1);
    expect((await sandbox.run(['search'])).exitCode).toBe(1);
    expect((await sandbox.run(['search', 'x', '--limit'])).exitCode).toBe(1);
  });

  it('"did you mean" suggestions are still errors', async () => {
    const result = await sandbox.run(['component', 'tct-buton']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/tct-button/);
  });

  it('json and text mode agree on the exit code of the same failure', async () => {
    const cases: string[][] = [
      ['component', 'nope'],
      ['docs', 'nope'],
      ['controllers', 'nope'],
      ['search'],
      ['search', 'x', '--limit', '0'],
      ['bogus'],
      ['layout', 'check', ''],
      ['init', '--features', 'bogus'],
      ['gap-report', 'x'],
    ];
    for (const argv of cases) {
      const text = await sandbox.run(argv);
      const json = await sandbox.run([...argv, '--json']);
      expect(json.exitCode, argv.join(' ')).toBe(text.exitCode);
      expect(json.exitCode, argv.join(' ')).toBe(1);
    }
  });

  it('an invalid but parseable layout exits 1 in both modes', async () => {
    const bad = 'ZzzUnknown[foo=bar]';
    expect((await sandbox.run(['layout', 'check', bad])).exitCode).toBe(1);
    const json = await sandbox.run(['layout', 'check', bad, '--json']);
    expect(json.exitCode).toBe(1);
    expect((parse(json.stdout).data as {valid: boolean}).valid).toBe(false);
    expect((await sandbox.run(['layout', 'check', 'tct-vstack'])).exitCode).toBe(0);
  });
});

describe('JSON envelope', () => {
  const successCases: [string[], string][] = [
    [['component', '--list'], 'component.list'],
    [['component', 'tct-button'], 'component.detail'],
    [['component', 'tct-button', '--props'], 'component.detail.props'],
    [['component', 'tct-button', '--examples'], 'component.detail.examples'],
    [['component', 'tct-button', '--styling'], 'component.detail.styling'],
    [['docs'], 'docs.list'],
    [['docs', 'styling'], 'docs.detail'],
    [['docs', 'styling', '--index'], 'docs.index'],
    [['docs', 'styling', 'design-tokens'], 'docs.detail.section'],
    [['search', 'button'], 'search'],
    [['controllers'], 'controller.list'],
    [['controllers', 'announce'], 'controller.detail'],
    [['controllers', 'RovingTabindexController', '--members'], 'controller.detail.members'],
    [['discover'], 'discover.list'],
    [['doctor'], 'doctor'],
    [['gap-report', '--list-categories'], 'gap-report.categories'],
    [['gap-report', 'tct-button', '--category', 'docs_gap', '--reason', 'x'], 'gap-report.file'],
    [['layout', 'grammar'], 'layout.grammar'],
    [['layout', 'check', 'tct-vstack'], 'layout.check'],
    [['layout', 'expand', 'tct-vstack'], 'layout.expand'],
    [['manifest'], 'manifest'],
    [['upgrade'], 'upgrade.run'],
    [['init', '--dry-run'], 'init.run'],
    [['--version'], 'version'],
    [[], 'help'],
  ];

  it.each(successCases)('%j emits a single %s envelope on stdout', async (argv, type) => {
    const result = await sandbox.run([...argv, '--json']);
    expect(result.exitCode).toBe(0);
    const envelope = parse(result.stdout);
    expect(envelope.apiVersion).toBe(API_VERSION);
    expect(envelope.type).toBe(type);
    expect(envelope).toHaveProperty('data');
    expect(result.stderr).toBe('');
    // One document: nothing but the envelope on stdout.
    expect(result.stdout.trim().startsWith('{')).toBe(true);
    expect(() => JSON.parse(result.stdout) as unknown).not.toThrow();
  });

  it('errors are one envelope with a stable code, empty stderr and no stack', async () => {
    const result = await sandbox.run(['component', 'tct-buton', '--json']);
    expect(result.exitCode).toBe(1);
    const envelope = parse(result.stdout) as unknown as CLIError;
    expect(envelope.apiVersion).toBe(API_VERSION);
    expect(envelope.code).toBe('ERR_UNKNOWN_COMPONENT');
    expect(envelope.suggestions?.[0]?.name).toBe('tct-button');
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toMatch(/\n\s+at /);
  });

  it('every error carries a registered code', async () => {
    const cases: [string[], string][] = [
      [['bogus'], 'ERR_UNKNOWN_COMMAND'],
      [['layout', 'bogus'], 'ERR_UNKNOWN_SUBCOMMAND'],
      [['search', 'x', '--bogus'], 'ERR_INVALID_OPTION'],
      [['search'], 'ERR_MISSING_ARGUMENT'],
      [['search', 'x', '--type', 'nope'], 'ERR_INVALID_ARGUMENT'],
      [['component', '--detail', 'huge'], 'ERR_INVALID_DETAIL'],
      [['docs', 'nope'], 'ERR_UNKNOWN_TOPIC'],
      [['docs', 'styling', 'nope'], 'ERR_UNKNOWN_SECTION'],
      [['controllers', 'nope'], 'ERR_UNKNOWN_CONTROLLER'],
      [['component', '--category', 'nope'], 'ERR_UNKNOWN_CATEGORY'],
      [['discover', '@nope/pkg'], 'ERR_UNKNOWN_PACKAGE'],
      [['init', '--agent', 'bogus'], 'ERR_UNKNOWN_AGENT'],
      [['init', '--features', 'bogus'], 'ERR_UNKNOWN_FEATURE'],
      [['layout', 'check', 'V >'], 'ERR_LAYOUT_PARSE'],
      [['layout', 'expand', 'Zork'], 'ERR_LAYOUT_INVALID'],
      [['layout', 'check', ''], 'ERR_MISSING_ARGUMENT'],
      [['layout', 'check', '--file', 'missing.txt'], 'ERR_FILE_NOT_FOUND'],
      [['mcp', '--json'], 'ERR_INVALID_OPTION'],
    ];
    for (const [argv, code] of cases) {
      const result = await sandbox.run([...argv, '--json']);
      const envelope = parse(result.stdout);
      expect(envelope.code, argv.join(' ')).toBe(code);
      expect(isErrorCode(envelope.code)).toBe(true);
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(1);
    }
  });

  it('a command that does not support --json is rejected before any side effect', async () => {
    const result = await sandbox.run(['mcp', '--json']);
    expect(result.exitCode).toBe(1);
    expect(parse(result.stdout).error).toMatch(/not supported for the 'mcp' command/);
  });

  it('a missing registry is a stable error, and the error is not swallowed by --json', async () => {
    const result = await sandbox.run(['component', '--json'], {
      env: {TCT_AGENT_REGISTRY: '/nonexistent/registry.json'},
    });
    expect(result.exitCode).toBe(1);
    expect(parse(result.stdout).code).toBe(ERROR_CODES.ERR_FILE_NOT_FOUND);
  });

  it('parseResponse, isError and assertResponse consume the envelopes', async () => {
    const ok = await sandbox.run(['search', 'button', '--json']);
    const parsed = parseResponse(ok.stdout);
    expect(isError(parsed)).toBe(false);
    expect(assertResponse(ok.stdout, 'search').type).toBe('search');
    expect(() => assertResponse(ok.stdout, 'docs.list')).toThrow(/Expected type "docs.list"/);
    const bad = await sandbox.run(['component', 'nope', '--json']);
    expect(isError(parseResponse(bad.stdout))).toBe(true);
    expect(() => assertResponse(bad.stdout, 'component.detail')).toThrow(/No element named/);
    expect(parseResponse({apiVersion: 1, type: 'x', data: 1}).apiVersion).toBe(1);
  });
});

describe('manifest', () => {
  it('describes every command, with its response types and json support', async () => {
    const result = await sandbox.run(['manifest', '--json']);
    const manifest = (
      parse(result.stdout) as {
        data: {
          commands: {
            name: string;
            json: boolean;
            responseTypes: string[];
            subcommands?: {name: string}[];
          }[];
          jsonSupported: string[];
          responseTypes: Record<string, string[]>;
        };
      }
    ).data;
    const names = manifest.commands.map((command) => command.name);
    for (const expected of [
      'component',
      'docs',
      'discover',
      'search',
      'controllers',
      'doctor',
      'gap-report',
      'layout',
      'init',
      'upgrade',
      'mcp',
    ]) {
      expect(names).toContain(expected);
    }
    expect(manifest.jsonSupported).toContain('layout check');
    expect(manifest.jsonSupported).not.toContain('mcp');
    expect(manifest.responseTypes.search).toEqual(['search']);
    expect(
      manifest.commands
        .find((command) => command.name === 'layout')
        ?.subcommands?.map((sub) => sub.name),
    ).toEqual(['grammar', 'check', 'expand']);
  });

  it('declares every response type the commands actually emit', async () => {
    const manifest = (
      parse((await sandbox.run(['manifest', '--json'])).stdout) as {
        data: {responseTypes: Record<string, string[]>};
      }
    ).data;
    const declared = new Set(Object.values(manifest.responseTypes).flat());
    for (const type of [
      'component.list',
      'component.detail',
      'docs.detail.section',
      'controller.list',
      'gap-report.file',
      'layout.expand',
      'upgrade.run',
      'init.remove',
    ]) {
      expect(declared.has(type), type).toBe(true);
    }
  });
});

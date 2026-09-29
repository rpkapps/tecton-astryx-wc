/**
 * Ranked search: scoring tiers, natural-language queries, typo tolerance, filters and the command's text and
 * JSON projections.
 */
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {ERROR_CODES, type CliError} from './errors.ts';
import {scoreCandidate, scoreQuery, search, stem, tokenizeQuery, type Candidate} from './search.ts';
import {Sandbox, fixtureRegistry} from './testing/fixture.ts';

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  domain: 'component',
  name: 'tct-widget',
  result: {command: 'tct component tct-widget'},
  ...over,
});

describe('scoring tiers', () => {
  it('scores an exact name 100, an exact keyword 90 and a name word 75', () => {
    expect(scoreCandidate('tct-widget', candidate())?.score).toBe(100);
    expect(scoreCandidate('gizmo', candidate({keywords: ['gizmo']}))?.score).toBe(90);
    expect(scoreCandidate('toggle', candidate({name: 'tct-toggle-button'}))?.score).toBe(75);
  });

  it('accepts a family folder or display name as the name', () => {
    expect(scoreCandidate('widget', candidate({names: ['widget']}))?.score).toBe(100);
  });

  it('ranks names above keywords above descriptions above guidance', () => {
    const name = scoreCandidate('panel', candidate({name: 'panel'}))!.score;
    const keyword = scoreCandidate('panel', candidate({keywords: ['panel']}))!.score;
    const description = scoreCandidate(
      'panel',
      candidate({description: 'A panel of stuff.'}),
    )!.score;
    const guidance = scoreCandidate(
      'panel',
      candidate({guidance: ['Do not nest a panel.']}),
    )!.score;
    expect(name).toBeGreaterThan(keyword);
    expect(keyword).toBeGreaterThan(description);
    expect(description).toBeGreaterThan(guidance);
    expect(description).toBe(50);
    expect(guidance).toBe(45);
  });

  it('tolerates typos: distance 1 scores 80 on names, distance 2 scores 40, distance 3 scores 20', () => {
    expect(scoreCandidate('buton', candidate({name: 'button'}))?.score).toBe(80);
    expect(scoreCandidate('butn', candidate({name: 'button'}))?.score).toBe(40);
    expect(scoreCandidate('btn', candidate({name: 'button'}))?.score).toBe(20);
  });

  it('matches plural and gerund forms of prose words', () => {
    expect(
      scoreCandidate('filter', candidate({description: 'Supports filtering rows.'}))?.score,
    ).toBe(50);
    expect(stem('charts')).toBe('chart');
    expect(stem('ies')).toBe('ies');
  });

  it('returns null when nothing matches', () => {
    expect(scoreCandidate('zzzzqq', candidate())).toBeNull();
  });
});

describe('natural-language queries', () => {
  it('drops stop words and short words', () => {
    expect(tokenizeQuery('a page where you can see the button')).toEqual(['see', 'button']);
  });

  it('scores per content word and rewards coverage', () => {
    const both = candidate({keywords: ['alpha', 'omega']});
    const one = candidate({keywords: ['alpha']});
    const tokens = tokenizeQuery('alpha omega');
    expect(scoreQuery('alpha omega', tokens, both)!.score).toBeGreaterThan(
      scoreQuery('alpha omega', tokens, one)!.score,
    );
  });

  it('gives a whole-phrase name or keyword a reserved top tier', () => {
    const declared = candidate({keywords: ['table of contents']});
    const incidental = candidate({keywords: ['table', 'contents']});
    const tokens = tokenizeQuery('table of contents');
    expect(scoreQuery('table of contents', tokens, declared)!.score).toBeGreaterThan(
      scoreQuery('table of contents', tokens, incidental)!.score,
    );
  });

  it('fans out through synonyms at a discount, so a direct hit always wins', () => {
    const direct = scoreQuery(
      'modal',
      tokenizeQuery('modal'),
      candidate({keywords: ['modal']}),
    )!.score;
    const viaSynonym = scoreQuery(
      'modal',
      tokenizeQuery('modal'),
      candidate({keywords: ['dialog']}),
    )!.score;
    expect(viaSynonym).toBeGreaterThan(0);
    expect(direct).toBeGreaterThan(viaSynonym);
  });
});

describe('search()', () => {
  const registry = fixtureRegistry();

  it('finds an element by tag, folder, display name and keyword', () => {
    for (const query of ['tct-button', 'button', 'Button', 'cta']) {
      expect(search(registry, query).results[0]?.name, query).toBe('tct-button');
    }
    expect(search(registry, 'Dropdown Menu').results[0]?.name).toBe('tct-dropdown-menu');
  });

  it('finds a compound element through the family', () => {
    expect(search(registry, 'tct-dropdown-menu-item').results[0]?.name).toBe('tct-dropdown-menu');
  });

  it('finds controllers and docs topics and tags each result with its domain and command', () => {
    const roving = search(registry, 'roving tabindex').results[0]!;
    expect(roving).toMatchObject({
      domain: 'controller',
      name: 'RovingTabindexController',
      command: 'tct controllers RovingTabindexController',
    });
    const styling = search(registry, 'styling').results.find((result) => result.domain === 'doc')!;
    expect(styling).toMatchObject({name: 'styling', command: 'tct docs styling', title: 'Styling'});
  });

  it('restricts to one domain with type', () => {
    const results = search(registry, 'button', {type: 'controller'}).results;
    expect(results.every((result) => result.domain === 'controller')).toBe(true);
  });

  it('reports the total match count and caps the results at limit', () => {
    const all = search(registry, 'stack');
    const capped = search(registry, 'stack', {limit: 1});
    expect(capped.results).toHaveLength(1);
    expect(capped.matchCount).toBe(all.matchCount);
    expect(all.matchCount).toBeGreaterThan(1);
  });

  it('orders equal scores by domain then name, deterministically', () => {
    const first = search(registry, 'stack').results.map((result) => result.name);
    expect(search(registry, 'stack').results.map((result) => result.name)).toEqual(first);
  });

  it('a nonsense query matches nothing', () => {
    expect(search(registry, 'qzxjkvw').matchCount).toBe(0);
  });

  it('rejects a blank query, a bad type and a bad limit with stable codes', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as CliError).code;
      }
      return null;
    };
    expect(code(() => search(registry, '  '))).toBe(ERROR_CODES.ERR_MISSING_ARGUMENT);
    expect(code(() => search(registry, 'x', {type: 'bogus' as never}))).toBe(
      ERROR_CODES.ERR_INVALID_ARGUMENT,
    );
    for (const limit of [0, -1, 1.5, Number.NaN]) {
      expect(
        code(() => search(registry, 'x', {limit})),
        String(limit),
      ).toBe(ERROR_CODES.ERR_INVALID_ARGUMENT);
    }
  });
});

describe('tct search', () => {
  let sandbox: Sandbox;
  beforeAll(() => {
    sandbox = new Sandbox();
  });
  afterAll(() => {
    sandbox.dispose();
  });

  it('prints greppable records', async () => {
    const result = await sandbox.run(['search', 'button']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^Results for "button" \(\d+\)/);
    expect(result.stdout).toMatch(/^command: +tct component tct-button$/m);
    expect(result.stdout).not.toMatch(/^score:/m);
  });

  it('--verbose adds the score and the reason', async () => {
    const result = await sandbox.run(['search', 'button', '--verbose']);
    expect(result.stdout).toMatch(/^score: +\d+$/m);
    expect(result.stdout).toMatch(/^reason: +/m);
  });

  it('joins unquoted words into one query', async () => {
    const result = await sandbox.run(['search', 'dropdown', 'menu', '--json']);
    const data = (JSON.parse(result.stdout) as {data: {query: string; results: {name: string}[]}})
      .data;
    expect(data.query).toBe('dropdown menu');
    expect(data.results[0]?.name).toBe('tct-dropdown-menu');
  });

  it('a no-match query is a success with a hint', async () => {
    const result = await sandbox.run(['search', 'qzxjkvw']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No results for "qzxjkvw"/);
  });

  it('--limit must be a positive integer (1.5 and 5abc are rejected, not truncated)', async () => {
    for (const limit of ['1.5', '5abc', '0', '-2']) {
      const result = await sandbox.run(['search', 'button', '--limit', limit, '--json']);
      expect(result.exitCode, limit).toBe(1);
      expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_INVALID_ARGUMENT');
    }
  });

  it('--dense prints one line per result', async () => {
    const result = await sandbox.run(['search', 'button', '--dense']);
    const lines = result.stdout.trim().split('\n');
    expect(lines[0]).toMatch(/^button \(\d+\/\d+\)/);
    expect(lines.slice(1).every((line) => line.includes('-> tct '))).toBe(true);
  });
});

/**
 * `tct search`: one ranked list across elements, controllers and docs topics.
 */
import type {CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {SEARCH_DOMAINS, search, type SearchDomain} from '../search.ts';
import {blocks, records, section, truncate} from '../text.ts';

const DOMAIN_LABEL: Record<SearchDomain, string> = {component: 'c', controller: 'k', doc: 'd'};

export const searchSpec: CommandSpec = {
  name: 'search',
  summary: 'Search elements, controllers and docs in one ranked list',
  description:
    'When you do not know whether what you need is an element, a controller or a docs topic, search across all ' +
    'of them. Results are ranked by relevance (name and keyword matches outrank incidental prose mentions, with ' +
    'fuzzy matching for typos) and tagged with their domain and the follow-up command to run.',
  args: [
    {
      name: 'query',
      required: true,
      variadic: true,
      description: 'Free text: a name, a keyword or a description of what you need.',
    },
  ],
  options: [
    {
      flag: '--type',
      type: 'string',
      value: 'domain',
      choices: SEARCH_DOMAINS,
      description: 'Restrict to one domain.',
    },
    {
      flag: '--limit',
      type: 'string',
      value: 'n',
      default: '20',
      description: 'Cap the number of results.',
    },
    {
      flag: '--verbose',
      type: 'boolean',
      description: 'Also print each result score and the reason it matched.',
    },
  ],
  examples: [
    {label: 'Find an element', cli: 'tct search "dropdown menu"'},
    {label: 'Only controllers', cli: 'tct search roving --type controller'},
    {label: 'As JSON', cli: 'tct search dialog --json'},
  ],
  exitCodes: [
    {code: 0, when: 'success, including no matches'},
    {code: 1, when: 'a blank query, an invalid --type or --limit, or the registry cannot be found'},
  ],
  responseTypes: ['search'],
  json: true,
  related: ['component', 'docs', 'controllers'],
  run: (context): Outcome => {
    const {registry} = context.registry();
    const rawLimit = context.options.limit;
    // Number(), not parseInt(): "1.5" and "5abc" must be rejected, not truncated.
    const limit = typeof rawLimit === 'string' ? Number(rawLimit) : 20;
    const query = context.args.join(' ');
    let type: SearchDomain | undefined;
    if (typeof context.options.type === 'string') {
      if (!SEARCH_DOMAINS.includes(context.options.type as SearchDomain)) {
        throw new CliError(
          `Unknown --type "${context.options.type}".`,
          ERROR_CODES.ERR_INVALID_ARGUMENT,
        );
      }
      type = context.options.type as SearchDomain;
    }
    const data = search(registry, query, {...(type ? {type} : {}), limit});
    const {results, matchCount} = data;

    if (results.length === 0) {
      return {
        type: 'search',
        data,
        text: blocks(
          `No results for "${data.query}".`,
          'Try a broader term, or browse: tct component --list',
        ),
      };
    }
    if (context.global.dense) {
      const lines = results.map(
        (result) =>
          `${DOMAIN_LABEL[result.domain]} ${result.name}  ${truncate(result.description, 80)}  -> ${result.command}`,
      );
      return {
        type: 'search',
        data,
        text: `${data.query} (${results.length}/${matchCount}) [c]omponent [k]ontroller [d]oc\n${lines.join('\n')}`,
      };
    }
    const fields = context.options.verbose
      ? [
          'name',
          'domain',
          'title',
          'category',
          'kind',
          'score',
          'reason',
          'import',
          'description',
          'command',
        ]
      : ['name', 'domain', 'title', 'category', 'kind', 'import', 'description', 'command'];
    const heading =
      matchCount > results.length
        ? `Results for "${data.query}" (${results.length} of ${matchCount})`
        : `Results for "${data.query}" (${results.length})`;
    return {type: 'search', data, text: blocks(section(heading), records(results, {fields}))};
  },
};

/**
 * `tct docs`: the guides of the docs site as topics: list them, print one, list its sections, or print one
 * section by its stable key. The topics are the guides in the agent registry, so they cannot differ from the
 * site.
 */
import type {CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {findSection, renderSection, renderTopic, topicSections} from '../format/docs.ts';
import {RegistryLookup} from '../registry/lookup.ts';
import {blocks, records, section, truncate} from '../text.ts';
import type {DocsDetailData, DocsIndexData, DocsListEntry, DocsSectionData} from '../types.ts';

export const docsSpec: CommandSpec = {
  name: 'docs',
  summary: 'Print the reference guides',
  description:
    'With no topic, lists every guide. A topic prints the whole guide; --index lists its sections with the key ' +
    'each is read by; a topic plus a section prints that section, found by its key, then its exact title, then a ' +
    'unique part of its title (an ambiguous query is refused). --dense compresses tables, admonitions and long ' +
    'code blocks for AI context windows.',
  args: [
    {name: 'topic', required: false, description: 'Guide to print (e.g. styling, forms, tokens).'},
    {name: 'section', required: false, description: 'Section key or title, from the topic index.'},
  ],
  options: [
    {
      flag: '--index',
      type: 'boolean',
      description: "List the topic's sections instead of printing it.",
    },
  ],
  examples: [
    {label: 'List the guides', cli: 'tct docs'},
    {label: 'A guide, token-efficient', cli: 'tct docs styling --dense'},
    {label: 'Its sections', cli: 'tct docs styling --index'},
    {label: 'One section as JSON', cli: 'tct docs forms validation --json'},
  ],
  exitCodes: [
    {code: 0, when: 'success'},
    {
      code: 1,
      when: 'unknown topic, or an unknown or ambiguous section, or the registry cannot be found',
    },
  ],
  responseTypes: ['docs.list', 'docs.detail', 'docs.index', 'docs.detail.section'],
  json: true,
  related: ['search', 'component', 'controllers'],
  run: (context): Outcome => {
    const {registry} = context.registry();
    const lookup = new RegistryLookup(registry);
    const {dense} = context.global;
    const detail = context.global.detail ?? 'full';
    const [topicName, sectionName] = context.args;

    if (topicName === undefined) {
      const entries: DocsListEntry[] = registry.topics.map((topic) => ({
        topic: topic.slug,
        title: topic.title,
        description: topic.description,
        url: topic.url,
        sections: topicSections(topic).length,
      }));
      const text = dense
        ? entries.map((entry) => `${entry.topic}  ${truncate(entry.description, 80)}`).join('\n')
        : blocks(
            section('Available docs'),
            records(entries, {fields: ['topic', 'description']}),
            'Usage: tct docs <topic>\n       tct docs <topic> <section>\n       tct docs <topic> --index',
          );
      return {type: 'docs.list', data: entries, text};
    }

    const topic = lookup.topic(topicName);
    if (!topic) {
      const suggestions = lookup.suggestTopics(topicName);
      throw new CliError(
        `No docs topic named "${topicName}".`,
        ERROR_CODES.ERR_UNKNOWN_TOPIC,
        (suggestions.length > 0 ? suggestions : registry.topics.map((each) => each.slug)).map(
          (name) => ({
            name,
            reason: suggestions.length > 0 ? 'similar name' : 'available topic',
          }),
        ),
      );
    }
    const sections = topicSections(topic);

    if (sectionName !== undefined) {
      const match = findSection(sections, sectionName);
      if (match.kind === 'none') {
        throw new CliError(
          `Section "${sectionName}" not found in "${topic.slug}".`,
          ERROR_CODES.ERR_UNKNOWN_SECTION,
          sections.map((each) => ({name: each.id, reason: each.title})),
        );
      }
      if (match.kind === 'ambiguous') {
        throw new CliError(
          `Section "${sectionName}" matches more than one section of "${topic.slug}"; use its key.`,
          ERROR_CODES.ERR_UNKNOWN_SECTION,
          match.candidates.map((each) => ({name: each.id, reason: each.title})),
        );
      }
      const data: DocsSectionData = {
        topic: topic.slug,
        id: match.section.id,
        title: match.section.title,
        body: match.section.body,
      };
      return {type: 'docs.detail.section', data, text: renderSection(match.section, detail, dense)};
    }

    if (context.options.index === true) {
      const data: DocsIndexData = {
        name: topic.slug,
        title: topic.title,
        description: topic.description,
        sections: sections.map((each) => ({
          id: each.id,
          title: each.title,
          summary: truncate(firstLine(each.body), 240),
        })),
      };
      const text = blocks(
        section(topic.title, topic.description),
        records(data.sections, {layout: 'inline', fields: ['id', 'title', 'summary']}),
        `Read one section: tct docs ${topic.slug} <section>\nRead everything:  tct docs ${topic.slug}`,
      );
      return {type: 'docs.index', data, text};
    }

    const data: DocsDetailData = {
      topic: topic.slug,
      title: topic.title,
      description: topic.description,
      url: topic.url,
      sections,
    };
    return {type: 'docs.detail', data, text: renderTopic(topic, detail, dense)};
  },
};

/** The first line of prose in a section body (skipping code fences and blank lines). */
function firstLine(body: string): string {
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && line.trim() !== '' && !line.startsWith('|') && !line.startsWith(':::'))
      return line.trim();
  }
  return '';
}

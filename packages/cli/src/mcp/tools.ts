/**
 * The two MCP tools, `search` and `get`, as pure functions over the agent registry. The stdio server
 * (`tct mcp`) and the docs-site route serve exactly these, so an agent gets the same answer either way.
 *
 * `search(query)` returns brief results (about 1.5K tokens each at most): name, description, import, the key
 * attributes and related elements. `get(name)` returns everything for one element, controller or topic:
 * attributes, slots, events, usage, best practices, keyboard, styling hooks and showcase examples, with
 * compound awareness (the other elements of the family and the related families).
 */
import {findSection, topicSections} from '../format/docs.ts';
import {RegistryLookup, importStatement} from '../registry/lookup.ts';
import type {AgentRegistry, RegistryComponent, RegistryElement} from '../registry/types.ts';
import {search} from '../search.ts';
import {truncate} from '../text.ts';

export interface McpToolResult {
  [key: string]: unknown;
  content: {type: 'text'; text: string}[];
  isError?: boolean;
}

export const MCP_SERVER_NAME = 'tecton-wc';

/** A whole topic above this size is answered with its overview and section list instead. */
export const MAX_TOPIC_BRIEF_CHARS = 4000;
/** Ceiling of one brief search result, in characters (about 1.5K tokens). */
export const MAX_BRIEF_RESULT_CHARS = 6000;

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;

const json = (value: unknown, isError = false): McpToolResult => ({
  content: [{type: 'text', text: JSON.stringify(value)}],
  ...(isError ? {isError: true} : {}),
});

const primaryTag = (component: RegistryComponent): string =>
  component.tag ?? `tct-${component.folder}`;

/** The attributes worth showing in a brief result: named-by-convention first, then enumerated ones. */
const KEY_ATTRIBUTES = [
  'variant',
  'size',
  'label',
  'value',
  'name',
  'type',
  'open',
  'disabled',
  'href',
];

function keyAttributes(element: RegistryElement | undefined): string[] {
  if (!element) return [];
  const byName = new Map(element.attributes.map((attribute) => [attribute.name, attribute]));
  const ordered = [
    ...KEY_ATTRIBUTES.filter((name) => byName.has(name)),
    ...element.attributes
      .filter((attribute) => attribute.values && !KEY_ATTRIBUTES.includes(attribute.name))
      .map((a) => a.name),
  ];
  return [...new Set(ordered)].slice(0, 6).map((name) => {
    const attribute = byName.get(name)!;
    return attribute.values
      ? `${name}: ${attribute.values.join('|')}`
      : `${name}: ${attribute.type.replace(/ \| undefined/, '')}`;
  });
}

function briefComponent(
  lookup: RegistryLookup,
  component: RegistryComponent,
): Record<string, unknown> {
  const primary =
    component.elements.find((element) => element.tag === component.tag) ?? component.elements[0];
  const related = component.related
    .map((folder) => lookup.component(folder)?.component)
    .filter((each): each is RegistryComponent => each !== undefined)
    .slice(0, 4)
    .map(primaryTag);
  const members = component.tags.filter((tag) => tag !== primaryTag(component)).slice(0, 6);
  const brief: Record<string, unknown> = {
    type: 'component',
    name: primaryTag(component),
    displayName: component.name,
    category: component.category,
    description: truncate(component.dense?.description ?? component.summary, 240),
    import: importStatement(component),
    keyAttributes: keyAttributes(primary),
    ...(members.length > 0 ? {elements: members} : {}),
    ...(related.length > 0 ? {relatedComponents: related} : {}),
    hint: `Use get("${primaryTag(component)}") for the full API, usage and examples.`,
  };
  // Trim key attributes if the whole entry would exceed the budget.
  while (
    JSON.stringify(brief).length > MAX_BRIEF_RESULT_CHARS &&
    (brief.keyAttributes as string[]).length > 0
  ) {
    (brief.keyAttributes as string[]).pop();
  }
  return brief;
}

export function mcpSearch(
  registry: AgentRegistry,
  input: {query: string; limit?: number},
): McpToolResult {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  if (query === '') {
    return json(
      {
        error: 'query must be a non-empty string.',
        hint: 'Try "dropdown menu", "form inputs" or "theming".',
      },
      true,
    );
  }
  const limit =
    Number.isInteger(input.limit) && input.limit! > 0
      ? Math.min(input.limit!, MAX_LIMIT)
      : DEFAULT_LIMIT;
  const lookup = new RegistryLookup(registry);
  const {results} = search(registry, query, {limit});
  if (results.length === 0) {
    return json({
      results: [],
      hint: 'No results. Try an element name (tct-button, dialog), a topic (styling, forms, tokens) or a controller (RovingTabindexController).',
    });
  }
  const briefs = results.map((result) => {
    if (result.domain === 'component') {
      const component = lookup.component(result.name)?.component;
      if (component) return briefComponent(lookup, component);
    }
    if (result.domain === 'controller') {
      const controller = lookup.controller(result.name);
      if (controller) {
        return {
          type: 'controller',
          name: controller.name,
          kind: controller.kind,
          area: controller.area,
          description: truncate(controller.summary, 240),
          import: `import {${controller.name}} from '${controller.import}';`,
          ...(controller.usedBy.length > 0
            ? {usedBy: controller.usedBy.slice(0, 6).map((folder) => `tct-${folder}`)}
            : {}),
          hint: `Use get("${controller.name}") for the signature, usage example and members.`,
        };
      }
    }
    const topic = lookup.topic(result.name);
    return {
      type: 'doc',
      topic: result.name,
      title: topic?.title ?? result.title ?? result.name,
      description: truncate(result.description, 240),
      sections: topic ? topicSections(topic).map((section) => section.title) : [],
      hint: `Use get("${result.name}") for the content, or get("${result.name}", {section: "..."}) for one section.`,
    };
  });
  return json(briefs);
}

function elementDetail(element: RegistryElement): Record<string, unknown> {
  return {
    tag: element.tag,
    description: element.description,
    attributes: element.attributes.map((attribute) => ({
      name: attribute.name,
      type: attribute.type,
      ...(attribute.values ? {values: attribute.values} : {}),
      ...(attribute.default !== undefined ? {default: attribute.default} : {}),
      description: attribute.description,
    })),
    properties: element.properties.map((property) => ({
      name: property.name,
      type: property.type,
      description: property.description,
    })),
    slots: element.slots,
    events: element.events.map((event) => ({
      name: event.name,
      description: event.description,
      ...(event.cancelable ? {cancelable: true} : {}),
    })),
    methods: element.methods.map((method) => ({
      name: method.name,
      signature: `${method.name}${method.signature}`,
      description: method.description,
    })),
    parts: element.cssParts,
    states: element.cssStates,
    customProperties: element.cssProperties,
    ...(element.keyboard.length > 0 ? {keyboard: element.keyboard} : {}),
    ...(element.form?.formAssociated ? {formAssociated: true} : {}),
  };
}

function componentDetail(
  lookup: RegistryLookup,
  component: RegistryComponent,
  scoped: RegistryElement | null,
): Record<string, unknown> {
  const elements = scoped ? [scoped] : component.elements;
  const showcase = component.examples[0];
  const more = component.examples.slice(1, 2);
  const groupMembers = scoped
    ? []
    : component.elements
        .filter((element) => element.tag !== component.tag)
        .slice(0, 6)
        .map((element) => ({
          tag: element.tag,
          description: truncate(element.summary || element.description, 120),
        }));
  const relatedComponents = component.related
    .map((folder) => lookup.component(folder)?.component)
    .filter((each): each is RegistryComponent => each !== undefined)
    .slice(0, 6)
    .map((each) => ({
      name: primaryTag(each),
      description: truncate(each.dense?.description ?? each.summary, 120),
    }));
  return {
    name: scoped?.tag ?? primaryTag(component),
    displayName: component.name,
    category: component.category,
    ...(scoped ? {parent: primaryTag(component)} : {}),
    import: importStatement(component),
    package: '@tecton-wc/components',
    description: component.summary,
    usage: component.dense?.usage ?? '',
    bestPractices: component.dense?.bestPractices ?? [],
    elements: elements.map(elementDetail),
    related: component.related,
    ...(showcase
      ? {
          example: {
            id: showcase.id,
            title: showcase.title,
            description: showcase.description,
            source: showcase.source,
          },
        }
      : {}),
    ...(more.length > 0
      ? {
          moreExamples: more.map((example) => ({
            id: example.id,
            title: example.title,
            source: example.source,
          })),
        }
      : {}),
    ...(groupMembers.length > 0 ? {groupMembers} : {}),
    ...(relatedComponents.length > 0 ? {relatedComponents} : {}),
    moreExamplesIds: component.examples.map((example) => example.id),
    docs: component.url,
  };
}

export function mcpGet(
  registry: AgentRegistry,
  input: {name: string; section?: string},
): McpToolResult {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name === '')
    return json(
      {error: 'name must be a non-empty string.', hint: 'Use search() to discover names.'},
      true,
    );
  const lookup = new RegistryLookup(registry);

  // Elements first: an exact tag, family folder or display name.
  const match = lookup.component(name);
  if (match) return json(componentDetail(lookup, match.component, match.element));

  const controller = lookup.controller(name);
  if (controller) {
    return json({
      name: controller.name,
      kind: controller.kind,
      area: controller.area,
      import: `import {${controller.name}} from '${controller.import}';`,
      signature: controller.signature,
      description: controller.description,
      ...(controller.example ? {example: controller.example} : {}),
      members: controller.members,
      usedBy: controller.usedBy.map((folder) => `tct-${folder}`),
    });
  }

  const topic = lookup.topic(name);
  if (topic) {
    const sections = topicSections(topic);
    if (input.section) {
      const found = findSection(sections, input.section);
      if (found.kind === 'found')
        return json({
          topic: topic.slug,
          id: found.section.id,
          title: found.section.title,
          body: found.section.body,
        });
      return json(
        {
          error:
            found.kind === 'ambiguous'
              ? `Section "${input.section}" matches more than one section of "${topic.slug}".`
              : `Section "${input.section}" not found in "${topic.slug}".`,
          available: (found.kind === 'ambiguous' ? found.candidates : sections).map((section) => ({
            id: section.id,
            title: section.title,
          })),
        },
        true,
      );
    }
    const full = {
      topic: topic.slug,
      title: topic.title,
      description: topic.description,
      sections: sections.map(({id, title, body}) => ({id, title, body})),
    };
    if (JSON.stringify(full).length > MAX_TOPIC_BRIEF_CHARS) {
      return json({
        topic: topic.slug,
        title: topic.title,
        description: topic.description,
        overview: sections[0]
          ? {id: sections[0].id, title: sections[0].title, body: truncate(sections[0].body, 1200)}
          : null,
        sections: sections.map((section) => ({id: section.id, title: section.title})),
        hint: `This topic is large (${sections.length} sections). Use get("${topic.slug}", {section: "..."}) for one section to avoid context overload.`,
      });
    }
    return json(full);
  }

  // Fuzzy fallback: keyword-aware suggestions.
  const found = search(registry, name, {limit: 5}).results;
  const suggestions = found.filter((result) => result.score >= 50);
  if (suggestions.length > 0) {
    return json({
      note: `"${name}" is not an exact name. Did you mean one of these?`,
      suggestions: suggestions.map((result) => ({
        type: result.domain,
        name: result.name,
        description: truncate(result.description, 120),
        ...(result.import ? {import: result.import} : {}),
      })),
      hint: 'Use get() with the exact name from the suggestions above.',
    });
  }
  return json(
    {
      error: `"${name}" not found.`,
      ...(lookup.suggestComponents(name).length > 0
        ? {similarComponents: lookup.suggestComponents(name)}
        : {}),
      ...(lookup.suggestTopics(name).length > 0 ? {similarTopics: lookup.suggestTopics(name)} : {}),
      hint: 'Use search() to discover available elements, controllers and topics.',
    },
    true,
  );
}

export const SEARCH_TOOL = {
  name: 'search',
  description:
    'Search the Tecton Web Components: finds elements (tct-*), controllers and utilities, and documentation topics.\n\n' +
    'Returns brief results (name, description, import, key attributes). Use the "get" tool with a specific name for ' +
    'the full API, usage guidance and code examples.\n\n' +
    'Examples: "dropdown menu", "form inputs", "theming", "dialog", "roving focus", "toast notification".',
  inputSchema: {
    type: 'object',
    properties: {
      query: {type: 'string', description: 'Natural language search query.'},
      limit: {
        type: 'number',
        description: `Max results (default ${DEFAULT_LIMIT}, at most ${MAX_LIMIT}).`,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
} as const;

export const GET_TOOL = {
  name: 'get',
  description:
    'Get full documentation for one element, controller or doc topic by name.\n\n' +
    'Returns attributes, slots, events, usage guidelines, best practices, keyboard behaviour, styling hooks and ' +
    'showcase examples. For a large doc topic, pass a section to get just that section.\n\n' +
    'Examples:\n' +
    '- get("tct-button"): the full button docs\n' +
    '- get("dropdown-menu"): the family, with its compound elements\n' +
    '- get("RovingTabindexController"): a controller with its usage example\n' +
    '- get("styling", {section: "parts"}): one section of a guide',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Element tag or family (tct-button, button), controller name, or docs topic (styling, forms).',
      },
      section: {
        type: 'string',
        description: 'For docs topics: return only this section (a key or a part of its title).',
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
} as const;

/** Dispatches a tool call by name; an unknown name is an error result, not an exception. */
export function callTool(
  registry: AgentRegistry,
  name: string,
  args: Record<string, unknown> | undefined,
): McpToolResult {
  const input = args ?? {};
  if (name === 'search')
    return mcpSearch(registry, {
      query: typeof input.query === 'string' ? input.query : '',
      ...(typeof input.limit === 'number' ? {limit: input.limit} : {}),
    });
  if (name === 'get') {
    return mcpGet(registry, {
      name: typeof input.name === 'string' ? input.name : '',
      ...(typeof input.section === 'string' ? {section: input.section} : {}),
    });
  }
  return json({error: `Unknown tool "${name}".`, tools: ['search', 'get']}, true);
}

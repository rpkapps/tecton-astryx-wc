/**
 * `llms.txt` (index, llmstxt.org format) and `llms-full.txt` (everything in Markdown) rendered from
 * the agent registry (D-011). Links are site-root-relative: the docs site has no fixed origin
 * (nothing is published, D-008), so a consumer resolves them against wherever it hosts the build.
 */
import type {PublicRegistry, RegistryComponent, RegistryElement} from './build.ts';
import {REFERENCE_URLS} from '../lib/site.ts';

const REGISTRY_URL = '/agent-registry.json';

const code = (text: string) => `\`${text.replace(/`/g, "'")}\``;

export function renderLlmsTxt(registry: PublicRegistry): string {
  const lines: string[] = [
    `# ${registry.library.name}`,
    '',
    `> ${registry.library.description}`,
    '',
    'Custom elements are prefixed `tct-`, events `tct-`. Nothing is published to a registry: the library is consumed from the workspace, a tarball or a self-hosted CDN build. ' +
      `Every page below is also in ${REGISTRY_URL} (machine-readable) and /llms-full.txt (everything in one file).`,
    '',
  ];

  if (registry.topics.length > 0) {
    lines.push('## Guides', '');
    for (const topic of registry.topics) {
      lines.push(
        `- [${topic.title}](${topic.url})${topic.description ? `: ${topic.description}` : ''}`,
      );
    }
    lines.push('');
  }

  lines.push('## Components', '');
  for (const category of registry.categories) {
    const inCategory = registry.components.filter((component) => component.category === category);
    if (inCategory.length === 0) continue;
    lines.push(`### ${category}`, '');
    for (const component of inCategory) {
      const tag = component.tag ? `${code(`<${component.tag}>`)}: ` : '';
      lines.push(`- [${component.name}](${component.url}): ${tag}${component.summary}`.trimEnd());
    }
    lines.push('');
  }
  if (registry.components.length === 0) lines.push('No components are documented yet.', '');

  lines.push(
    '## Reference',
    '',
    `- [Design tokens](${REFERENCE_URLS.tokens}): every token with light and dark values and status`,
    `- [Agent registry](${REGISTRY_URL}): the JSON registry read by the tct CLI and MCP server`,
    '',
  );
  return `${lines.join('\n')}`;
}

function elementMarkdown(element: RegistryElement): string[] {
  const out: string[] = [`##### ${code(`<${element.tag}>`)}`, ''];
  if (element.description) out.push(element.description, '');
  if (element.attributes.length > 0) {
    out.push('Attributes:', '');
    for (const attribute of element.attributes) {
      const options = attribute.values
        ? ` one of ${attribute.values.map((v) => code(v)).join(', ')};`
        : '';
      const fallback =
        attribute.default === undefined ? '' : ` default ${code(attribute.default)};`;
      out.push(
        `- ${code(attribute.name)} (${code(attribute.type)}${attribute.reflects ? ', reflected' : ''}):${options}${fallback} ${attribute.description}`.trimEnd(),
      );
    }
    out.push('');
  }
  if (element.properties.length > 0) {
    out.push('Properties (no attribute):', '');
    for (const property of element.properties) {
      out.push(
        `- ${code(property.name)} (${code(property.type)}${property.readonly ? ', readonly' : ''}): ${property.description}`.trimEnd(),
      );
    }
    out.push('');
  }
  if (element.methods.length > 0) {
    out.push('Methods:', '');
    for (const method of element.methods) {
      out.push(`- ${code(`${method.name}${method.signature}`)}: ${method.description}`.trimEnd());
    }
    out.push('');
  }
  if (element.slots.length > 0) {
    out.push('Slots:', '');
    for (const slot of element.slots) {
      out.push(
        `- ${slot.name === '' ? '(default)' : code(slot.name)}: ${slot.description}`.trimEnd(),
      );
    }
    out.push('');
  }
  if (element.events.length > 0) {
    out.push('Events:', '');
    for (const event of element.events) {
      const flags = event.class
        ? ` (${[
            event.bubbles && 'bubbles',
            event.composed && 'composed',
            event.cancelable && 'cancelable',
          ]
            .filter(Boolean)
            .join(', ')})`
        : '';
      out.push(`- ${code(event.name)}${flags}: ${event.description}`.trimEnd());
    }
    out.push('');
  }
  if (element.cssParts.length > 0) {
    out.push(`Parts: ${element.cssParts.map((part) => code(part.name)).join(', ')}`, '');
  }
  if (element.cssStates.length > 0) {
    out.push(
      `States: ${element.cssStates.map((state) => code(`:state(${state.name})`)).join(', ')}`,
      '',
    );
  }
  if (element.cssProperties.length > 0) {
    out.push(`Custom properties: ${element.cssProperties.map((p) => code(p.name)).join(', ')}`, '');
  }
  if (element.keyboard.length > 0) {
    out.push('Keyboard:', '');
    for (const row of element.keyboard) {
      out.push(`- ${row.keys}: ${row.action}${row.when ? ` (${row.when})` : ''}`);
    }
    out.push('');
  }
  return out;
}

function componentMarkdown(component: Omit<RegistryComponent, 'entries'>): string[] {
  const out: string[] = [
    `#### ${component.name}${component.tag ? ` (${code(`<${component.tag}>`)})` : ''}`,
    '',
    `Category: ${component.category}. Status: ${component.status}. Page: ${component.url}`,
    '',
  ];
  if (component.summary) out.push(component.summary, '');
  if (component.keywords.length > 0) out.push(`Keywords: ${component.keywords.join(', ')}`, '');
  if (component.related.length > 0) out.push(`Related: ${component.related.join(', ')}`, '');
  if (component.dense) {
    out.push(`Usage: ${component.dense.usage}`, '');
    out.push('Best practices:', '');
    for (const practice of component.dense.bestPractices) {
      out.push(`- ${practice.do ? 'Do' : "Don't"}: ${practice.text}`);
    }
    out.push('');
  }
  for (const element of component.elements) out.push(...elementMarkdown(element));
  if (component.examples.length > 0) {
    out.push('Examples:', '');
    for (const example of component.examples) {
      out.push(`###### ${example.title}`, '');
      if (example.description) out.push(example.description, '');
      out.push('```html', example.source, '```', '');
    }
  }
  return out;
}

export function renderLlmsFull(registry: PublicRegistry): string {
  const lines: string[] = [
    `# ${registry.library.name}: full reference`,
    '',
    `> ${registry.library.description}`,
    '',
    `Machine-readable: ${REGISTRY_URL}.`,
    '',
  ];

  if (registry.topics.length > 0) {
    lines.push('## Guides', '');
    for (const topic of registry.topics) {
      lines.push(`### ${topic.title}`, '', topic.description, '');
      for (const section of topic.sections) {
        if (section.heading) lines.push(`#### ${section.heading}`, '');
        if (section.body) lines.push(section.body, '');
      }
    }
  }

  lines.push('## Components', '');
  for (const category of registry.categories) {
    const inCategory = registry.components.filter((component) => component.category === category);
    if (inCategory.length === 0) continue;
    lines.push(`### ${category}`, '');
    for (const component of inCategory) lines.push(...componentMarkdown(component));
  }
  if (registry.components.length === 0) lines.push('No components are documented yet.', '');

  if (registry.controllers.length > 0) {
    lines.push(
      '## Controllers and utilities',
      '',
      'Runtime building blocks of `@tecton-wc/core` for building your own elements.',
      '',
    );
    for (const controller of registry.controllers) {
      lines.push(
        `- ${code(controller.name)} (${controller.kind}, ${code(controller.import)}): ${controller.summary}`,
      );
    }
    lines.push('');
  }

  if (registry.tokens.length > 0) {
    lines.push('## Design tokens', '');
    const byCategory = new Map<string, string[]>();
    for (const token of registry.tokens) {
      byCategory.set(token.category, [...(byCategory.get(token.category) ?? []), token.name]);
    }
    for (const [category, names] of [...byCategory].sort(([a], [b]) => (a < b ? -1 : 1))) {
      lines.push(`- ${category} (${names.length}): ${names.join(' ')}`);
    }
    lines.push('', `Values and status for each token: ${REFERENCE_URLS.tokens}`, '');
  }
  return lines.join('\n');
}

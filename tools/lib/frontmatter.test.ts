import {describe, expect, it} from 'vitest';
import {parseYamlSubset, readFrontmatter} from './frontmatter.ts';

const CONVENTIONS_EXAMPLE = `title: Button                       # display name (upstream displayName)
folder: button
category: Action                    # one of the 11 upstream categories
entries: [Button]                   # upstream names documented on this page (incl. subcomponents)
summary: Triggers an action when activated.
examples: [variants, sizes, icons, loading, disabled-with-reason, in-form]   # order on the page
keywords: [button, btn, cta, submit, action, loading, primary, secondary, ghost, destructive, danger]  # agent/search index (D-011)
dense:                              # agent-facing dense doc (D-011)
  description: action trigger w/ 4 variants, 3 sizes, loading state
  usage: Triggers an action when activated. Use for form submission, confirmation or any clear CTA.
  bestPractices:
    - {do: true,  text: 'Primary for the single most important action; secondary or ghost for the rest.'}
    - {do: false, text: 'Button for navigation; use tct-link when it only goes to another page.'}
  properties:                       # one line per public attribute/property/slot/event name
    variant: visual style variant
    loading: shows spinner, blocks activation, announces via live region
related: [icon-button, button-group, link]   # compound/related folders for agent 'get' results
`;

describe('parseYamlSubset', () => {
  it('parses the CONVENTIONS §7 example', () => {
    const data = parseYamlSubset(CONVENTIONS_EXAMPLE) as Record<string, unknown>;
    expect(data.title).toBe('Button');
    expect(data.entries).toEqual(['Button']);
    expect(data.examples).toEqual([
      'variants',
      'sizes',
      'icons',
      'loading',
      'disabled-with-reason',
      'in-form',
    ]);
    expect(data.related).toEqual(['icon-button', 'button-group', 'link']);
    expect(data.dense).toEqual({
      description: 'action trigger w/ 4 variants, 3 sizes, loading state',
      usage:
        'Triggers an action when activated. Use for form submission, confirmation or any clear CTA.',
      bestPractices: [
        {
          do: true,
          text: 'Primary for the single most important action; secondary or ghost for the rest.',
        },
        {do: false, text: 'Button for navigation; use tct-link when it only goes to another page.'},
      ],
      properties: {
        variant: 'visual style variant',
        loading: 'shows spinner, blocks activation, announces via live region',
      },
    });
  });

  it('parses block sequences, nested maps and scalar types', () => {
    const data = parseYamlSubset(`
a: 1
b: -2.5
c: true
d: ~
e: "quoted: #not-a-comment"
f: 'it''s'
list:
  - one
  - two words
  - key: value
    other: 2
  - {x: 1}
same-indent:
- a
- b
after: done
`);
    expect(data).toEqual({
      a: 1,
      b: -2.5,
      c: true,
      d: null,
      e: 'quoted: #not-a-comment',
      f: "it's",
      list: ['one', 'two words', {key: 'value', other: 2}, {x: 1}],
      'same-indent': ['a', 'b'],
      after: 'done',
    });
  });

  it('parses multi-line flow collections and block scalars', () => {
    const data = parseYamlSubset(`
keywords: [a, b,
  c, d]
usage: >
  folded text
  continues here

  new paragraph
literal: |
  line 1
    indented
  line 3
next: x
`) as Record<string, unknown>;
    expect(data.keywords).toEqual(['a', 'b', 'c', 'd']);
    expect(data.usage).toBe('folded text continues here\nnew paragraph\n');
    expect(data.literal).toBe('line 1\n  indented\nline 3\n');
    expect(data.next).toBe('x');
  });

  it('keeps # inside quotes and URLs, strips real comments', () => {
    expect(parseYamlSubset("a: 'x # y'  # comment\nb: http://x/#frag\n")).toEqual({
      a: 'x # y',
      b: 'http://x/#frag',
    });
  });

  it('rejects unsupported and malformed syntax with line numbers', () => {
    expect(() => parseYamlSubset('a: &anchor 1')).toThrow(/line 1.*anchors/);
    expect(() => parseYamlSubset('a: 1\na: 2')).toThrow(/line 2.*duplicate key "a"/);
    expect(() => parseYamlSubset('a: [1, 2')).toThrow(/unterminated/);
    expect(() => parseYamlSubset('a: 1\n  b: 2')).toThrow(/line 2/);
    expect(() => parseYamlSubset('\ta: 1')).toThrow(/tabs/);
    expect(() => parseYamlSubset('just text')).toThrow(/line 1/);
  });
});

describe('readFrontmatter', () => {
  it('splits frontmatter from the body', () => {
    const result = readFrontmatter('---\ntitle: X\n---\n\n## Purpose\n')!;
    expect(result.data).toEqual({title: 'X'});
    expect(result.body).toBe('\n## Purpose\n');
  });
  it('returns null without frontmatter and throws when unterminated', () => {
    expect(readFrontmatter('# Title\n')).toBeNull();
    expect(() => readFrontmatter('---\ntitle: X\n')).toThrow(/closing/);
  });
});

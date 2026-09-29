/** linkify(): ported from upstream useLinkify.test.tsx. */
import {html, render, type TemplateResult} from 'lit';
import {describe, expect, it} from 'vitest';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import './define.js';
import {linkify} from './linkify.js';
import type {TctLink} from './tct-link.js';

/** Renders the nodes into a paragraph and returns the `tct-link` elements. */
async function links(
  nodes: (string | TemplateResult)[],
): Promise<{paragraph: HTMLElement; links: TctLink[]}> {
  const paragraph = await fixture<HTMLElement>(html`<p></p>`);
  render(html`${nodes}`, paragraph);
  const found = [...paragraph.querySelectorAll<TctLink>('tct-link')];
  await Promise.all(found.map((link) => link.updateComplete));
  return {paragraph, links: found};
}

describe('linkify (useLinkify.test.tsx)', () => {
  it('returns plain text when no links are found', () => {
    expect(linkify('Hello world')).toEqual(['Hello world']);
  });

  it('returns plain text for an empty string', () => {
    expect(linkify('')).toEqual(['']);
  });

  it('detects URLs', () => {
    const nodes = linkify('Visit https://example.com today');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('Visit ');
    expect(nodes[2]).toBe(' today');
  });

  it('renders URLs as external tct-link elements', async () => {
    const {links: found} = await links(linkify('Visit https://example.com'));
    expect(found).toHaveLength(1);
    expect(found[0]!.getAttribute('href')).toBe('https://example.com');
    expect(found[0]!.external).toBe(true);
    expect(found[0]!.textContent).toBe('https://example.com');
    expect(found[0]!.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe(
      'https://example.com',
    );
  });

  it('detects email addresses', () => {
    const nodes = linkify('Email hi@example.com for info');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('Email ');
    expect(nodes[2]).toBe(' for info');
  });

  it('renders email links with mailto:, not external', async () => {
    const {links: found} = await links(linkify('Email hi@example.com'));
    expect(found[0]!.getAttribute('href')).toBe('mailto:hi@example.com');
    expect(found[0]!.external).toBe(false);
  });

  it('detects multiple links in one string', () => {
    const nodes = linkify('Go to https://a.com and https://b.com now');
    expect(nodes).toHaveLength(5);
    expect(nodes[0]).toBe('Go to ');
    expect(nodes[2]).toBe(' and ');
    expect(nodes[4]).toBe(' now');
  });

  it('supports custom patterns', async () => {
    const nodes = linkify('Check T1234 for details', {
      patterns: [{pattern: /\bT(\d+)\b/g, href: (m) => `https://tasks.example.com/${m[1]}`}],
    });
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('Check ');
    expect(nodes[2]).toBe(' for details');
    const {links: found} = await links(nodes);
    expect(found[0]!.getAttribute('href')).toBe('https://tasks.example.com/1234');
    expect(found[0]!.textContent).toBe('T1234');
  });

  it('custom patterns take priority over builtins', async () => {
    const {links: found} = await links(
      linkify('See https://example.com/T1234', {
        patterns: [
          {
            pattern: /https:\/\/example\.com\/T(\d+)/g,
            href: (m) => `https://tasks.example.com/${m[1]}`,
            label: (m) => `T${m[1]}`,
          },
        ],
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.textContent).toBe('T1234');
    expect(found[0]!.getAttribute('href')).toBe('https://tasks.example.com/1234');
  });

  it('supports a custom label function', async () => {
    const {links: found} = await links(
      linkify('See D5678 here', {
        patterns: [
          {
            pattern: /\bD(\d+)\b/g,
            href: (m) => `https://phabricator.example.com/${m[0]}`,
            label: (m) => `Diff ${m[1]}`,
          },
        ],
      }),
    );
    expect(found[0]!.textContent).toBe('Diff 5678');
  });

  it('can disable the builtins', () => {
    expect(linkify('Visit https://example.com', {hasBuiltins: false})).toEqual([
      'Visit https://example.com',
    ]);
  });

  it('handles text that starts or ends with a link', () => {
    expect(linkify('https://example.com is cool')).toHaveLength(2);
    expect(linkify('https://example.com is cool')[1]).toBe(' is cool');
    expect(linkify('Visit https://example.com')).toHaveLength(2);
    expect(linkify('Visit https://example.com')[0]).toBe('Visit ');
  });

  it('is safe to call repeatedly with the same global pattern (no lastIndex leak)', () => {
    const options = {
      patterns: [{pattern: /\bT(\d+)\b/g, href: (m: RegExpMatchArray) => `/t/${m[1]}`}],
    };
    expect(linkify('T1 and T2', options)).toHaveLength(3);
    expect(linkify('T1 and T2', options)).toHaveLength(3);
  });

  it('ignores a pattern that matches the empty string', () => {
    const nodes = linkify('abc', {
      patterns: [{pattern: /x*/g, href: () => '/x'}],
      hasBuiltins: false,
    });
    expect(nodes).toEqual(['abc']);
  });

  it('never parses the text as HTML', async () => {
    const {paragraph, links: found} = await links(
      linkify('<img src=x onerror=alert(1)> https://example.com/?a=<b>'),
    );
    expect(paragraph.querySelector('img')).toBeNull();
    expect(found).toHaveLength(1);
    expect(paragraph.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('a javascript: destination from a custom pattern renders an anchor without href', async () => {
    const {links: found} = await links(
      linkify('click JS1', {
        patterns: [{pattern: /JS\d/g, href: () => 'javascript:alert(1)'}],
        hasBuiltins: false,
      }),
    );
    expect(found[0]!.shadowRoot!.querySelector('a')!.hasAttribute('href')).toBe(false);
  });
});

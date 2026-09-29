/**
 * Docs-site layout shared by the page generator, the agent registry and the tests: where generated
 * and authored content lives, and how a category or component maps to a URL.
 *
 *   apps/docs/src/content/docs/
 *     index.mdx                              authored home page
 *     guides/<topic>.mdx                     authored by WP-D (the sidebar autogenerates this directory)
 *     components/<category-slug>/index.mdx   GENERATED category overviews
 *     components/<category-slug>/<folder>.mdx GENERATED component pages
 *     reference/*.mdx                        GENERATED: parity status, differences, tokens
 */
import {join} from 'node:path';
import {ROOT} from './paths.ts';

export const DOCS_APP = join(ROOT, 'apps/docs');
export const DOCS_CONTENT = join(DOCS_APP, 'src/content/docs');
export const DOCS_PUBLIC = join(DOCS_APP, 'public');
export const GUIDES_DIR = join(DOCS_CONTENT, 'guides');
export const COMPONENT_PAGES_DIR = join(DOCS_CONTENT, 'components');
export const REFERENCE_PAGES_DIR = join(DOCS_CONTENT, 'reference');

/** The 11 upstream component categories, in sidebar order (upstream docs order). */
export const CATEGORIES = [
  'Action',
  'Chat',
  'Container',
  'Content',
  'Feedback & Status',
  'Form Controls',
  'Layout',
  'Navigation',
  'Overlay',
  'Table & List',
  'Utility',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** `Feedback & Status` -> `feedback-and-status` */
export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Site-root-relative URL of a component page. */
export function componentUrl(category: string, folder: string): string {
  return `/components/${categorySlug(category)}/${folder}/`;
}

export const REFERENCE_URLS = {
  tokens: '/reference/tokens/',
} as const;

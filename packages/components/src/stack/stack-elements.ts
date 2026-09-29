import {literal, type StaticValue} from 'lit/static-html.js';
import type {StackElement} from './stack.types.js';

/**
 * The tag literals behind `as`. Static templates (`literal`) rather than `unsafeStatic`, so the
 * element name can never come from user input: an unknown `as` falls back to `div` before it gets
 * here.
 */
export const STACK_TAGS: Readonly<Record<StackElement, StaticValue>> = {
  div: literal`div`,
  section: literal`section`,
  article: literal`article`,
  aside: literal`aside`,
  nav: literal`nav`,
  header: literal`header`,
  footer: literal`footer`,
  main: literal`main`,
  ul: literal`ul`,
  ol: literal`ol`,
  li: literal`li`,
};

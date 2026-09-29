import type {Rule} from 'eslint';
import {posixFilename} from '../lib.ts';

/** `define.ts` re-exports by name so the generated barrels can detect duplicate names (A§3, A§4.1). */
export const noExportStarInDefine: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {description: 'Disallow `export *` in define.ts files.'},
    schema: [],
    messages: {star: 'Use named exports in define.ts (`export {TctButton};`), never `export *`.'},
  },
  create(context) {
    if (!/(?:^|\/)define\.ts$/.test(posixFilename(context))) return {};
    return {
      ExportAllDeclaration(node) {
        context.report({node, messageId: 'star'});
      },
    };
  },
};

/**
 * In-house ESLint plugin (A§18.1). Loaded by `eslint.config.js` under the namespace `tct`.
 * File-scoped exemptions (tests, boundary modules) are configured in `eslint.config.js`; rules that
 * are only legal in one file (define.ts, events/, security/, features.ts) know their own allowed paths.
 */
import type {ESLint} from 'eslint';
import {noCreateTctElement} from './rules/no-create-tct-element.ts';
import {noCustomElementsDefine} from './rules/no-custom-elements-define.ts';
import {noExportStarInDefine} from './rules/no-export-star-in-define.ts';
import {noFeatureChecks} from './rules/no-feature-checks.ts';
import {noHtmlSinks} from './rules/no-html-sinks.ts';
import {noPublicOnProps} from './rules/no-public-on-props.ts';
import {noRawEvents} from './rules/no-raw-events.ts';
import {noTopLevelDomAccess} from './rules/no-top-level-dom-access.ts';
import {typedHostController} from './rules/typed-host-controller.ts';

export const rules = {
  'no-create-tct-element': noCreateTctElement,
  'no-custom-elements-define': noCustomElementsDefine,
  'no-export-star-in-define': noExportStarInDefine,
  'no-feature-checks': noFeatureChecks,
  'no-html-sinks': noHtmlSinks,
  'no-public-on-props': noPublicOnProps,
  'no-raw-events': noRawEvents,
  'no-top-level-dom-access': noTopLevelDomAccess,
  'typed-host-controller': typedHostController,
};

const plugin: ESLint.Plugin = {
  meta: {name: 'eslint-plugin-tct', version: '0.0.0'},
  rules,
};

export default plugin;

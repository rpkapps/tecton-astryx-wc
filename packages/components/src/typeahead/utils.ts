/**
 * The server-safe entry of the typeahead family (`@tecton-wc/components/typeahead/utils.js`): the pure
 * helpers and types, with no element classes and no registration, so a build or a server render can
 * create search sources without loading any component.
 */
export {createStaticSource} from './create-static-source.js';
export type {CreateStaticSourceOptions} from './create-static-source.js';
export {getItemGroup, groupItems} from './typeahead.types.js';
export type {
  ItemGroup,
  SearchableItem,
  SearchSource,
  TypeaheadRenderResult,
} from './typeahead.types.js';

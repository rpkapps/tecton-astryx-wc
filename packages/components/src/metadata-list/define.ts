import {defineElement} from '@tecton-astryx/core/define.js';
import {TctMetadataList} from './tct-metadata-list.js';
import {TctMetadataListItem} from './tct-metadata-list-item.js';

// The list before its items (A§4.1).
defineElement(TctMetadataList);
defineElement(TctMetadataListItem);

export {TctMetadataList, TctMetadataListItem};

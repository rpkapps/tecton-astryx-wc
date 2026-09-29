import {defineElement} from '@tecton-wc/core/define.js';
import {TctBreadcrumbItem} from './tct-breadcrumb-item.js';
import {TctBreadcrumbs} from './tct-breadcrumbs.js';

// The trail only reads its children; the item asks for context, so either order works.
defineElement(TctBreadcrumbItem);
defineElement(TctBreadcrumbs);

export {TctBreadcrumbItem, TctBreadcrumbs};

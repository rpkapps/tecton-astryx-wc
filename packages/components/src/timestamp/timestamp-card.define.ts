import {defineElement} from '@tecton-wc/core/define.js';
import {TctHoverCard} from '../hover-card/tct-hover-card.js';
import {TctIconButton} from '../icon-button/tct-icon-button.js';

/**
 * Registers the elements only a timestamp with a card renders (the hover card and the copy buttons). Loaded
 * lazily by `tct-timestamp` the first time a card is due, so the default card-less timestamp never pays for
 * the overlay stack.
 */
defineElement(TctHoverCard);
defineElement(TctIconButton);

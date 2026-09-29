import type {CSSResultGroup, PropertyValues} from 'lit';
import {TctStack} from '../stack/tct-stack.js';
import type {StackDirection} from '../stack/stack.types.js';

/**
 * A horizontal stack: `tct-stack` with `direction="horizontal"` fixed. Children flow left to right
 * (right to left in RTL). `h-align` is the main axis (`start`, `center`, `end`, `between`, `around`,
 * `evenly`) and `v-align` the cross axis (`start`, `center`, `end`, `stretch`; default `stretch`);
 * `justify` and `alignment` are their aliases.
 *
 * @summary Horizontal flex layout: a `tct-stack` that always runs in a row.
 * @tag tct-hstack
 * @upstream HStack
 * @hideInherited direction - fixed to horizontal by this element
 * @slot - The stack's children, laid out as flex items in a row.
 * @csspart base - The flex container that holds the children and the padding (Astryx target `astryx-stack`).
 * @cloakDisplay flex
 */
export class TctHStack extends TctStack {
  static override readonly tagName: string = 'tct-hstack';
  static override styles: CSSResultGroup = TctStack.styles;

  constructor() {
    super();
    this.direction = 'horizontal';
  }

  protected override get effectiveDirection(): StackDirection {
    return 'horizontal';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // A stray `direction="vertical"` is ignored; keep the reflected attribute honest too.
    if (this.direction !== 'horizontal') this.direction = 'horizontal';
    super.willUpdate(changed);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-hstack': TctHStack;
  }
}

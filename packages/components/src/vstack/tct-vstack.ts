import type {CSSResultGroup, PropertyValues} from 'lit';
import {TctStack} from '../stack/tct-stack.js';
import type {StackDirection} from '../stack/stack.types.js';

/**
 * A vertical stack: `tct-stack` with `direction="vertical"` fixed. Children flow top to bottom.
 * `h-align` is the cross axis (`start`, `center`, `end`, `stretch`; default `stretch`) and `v-align`
 * the main axis (`start`, `center`, `end`, `between`, `around`, `evenly`); `alignment` and `justify`
 * are their aliases.
 *
 * @summary Vertical flex layout: a `tct-stack` that always runs in a column.
 * @tag tct-vstack
 * @upstream VStack
 * @hideInherited direction - fixed to vertical by this element
 * @slot - The stack's children, laid out as flex items in a column.
 * @csspart base - The flex container that holds the children and the padding (theme target `stack`).
 * @cloakDisplay flex
 */
export class TctVStack extends TctStack {
  static override readonly tagName: string = 'tct-vstack';
  static override styles: CSSResultGroup = TctStack.styles;

  constructor() {
    super();
    this.direction = 'vertical';
  }

  protected override get effectiveDirection(): StackDirection {
    return 'vertical';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // A stray `direction="horizontal"` is ignored; keep the reflected attribute honest too.
    if (this.direction !== 'vertical') this.direction = 'vertical';
    super.willUpdate(changed);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-vstack': TctVStack;
  }
}

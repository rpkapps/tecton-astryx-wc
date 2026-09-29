/**
 * `BoxPropsMixin` (A§9.18): the padding and size utilities shared by Layout, Stack, Section, Center
 * and ScrollableArea (it breaks the upstream Layout <-> Stack cycle). Attributes become private
 * custom properties on the element that carries `part="base"`; the component's stylesheet consumes
 * them once:
 *
 * ```css
 * .base {
 *   padding-inline-start: var(--_box-padding-inline-start, 0);
 *   inline-size: var(--_box-width, auto);
 * }
 * ```
 *
 * Padding uses the spacing scale (`0 0.5 1 1.5 2 3 4 5 6 8 10` -> `var(--spacing-N)`); the most
 * specific wins per edge: edge attribute, then axis attribute, then `padding`. `width`, `height`,
 * `max-width` and `min-height` accept a number (px) or any CSS length. Nothing is reflected.
 *
 * ```ts
 * export class TctStack extends BoxPropsMixin(TctElement) { … render() { return html`<div part="base"><slot></slot></div>`; } }
 * ```
 */
import {property} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import type {Constructor, TctElement} from '../tct-element.js';
import {devWarn} from '../utils/dev.js';

/** The spacing scale steps (`--spacing-<step>`, dots become dashes: `0.5` -> `--spacing-0-5`). */
export const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] as const;
export type SpacingStep = (typeof SPACING_STEPS)[number];
/** A CSS length: a number is px. */
export type BoxSize = number | string;

/** Names of the private custom properties written on `part="base"`. */
export const BOX_PROPERTIES = {
  paddingInlineStart: '--_box-padding-inline-start',
  paddingInlineEnd: '--_box-padding-inline-end',
  paddingBlockStart: '--_box-padding-block-start',
  paddingBlockEnd: '--_box-padding-block-end',
  width: '--_box-width',
  height: '--_box-height',
  maxWidth: '--_box-max-width',
  minHeight: '--_box-min-height',
} as const;

const stepToken = (step: number): string => `var(--spacing-${String(step).replace('.', '-')})`;

function toStep(value: unknown, name: string): SpacingStep | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const step = Number(value);
  if ((SPACING_STEPS as readonly number[]).includes(step)) return step as SpacingStep;
  const shown =
    typeof value === 'string' || typeof value === 'number' ? String(value) : typeof value;
  devWarn(
    `box:${name}:${shown}`,
    `${name}="${shown}" is not a spacing step (${SPACING_STEPS.join(', ')}).`,
  );
  return undefined;
}

/** `300` and `"300"` become `300px`; anything else is a CSS length and is used as written. */
function toLength(value: BoxSize | null | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return `${value}px`;
  return /^-?\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
}

/** The members the mixin adds (a type-only class so `protected` can be expressed; no runtime export). */
declare class BoxPropsShape {
  /** Padding on all sides, spacing-scale step. */
  padding: SpacingStep | undefined;
  /** Inline (left/right) padding; overrides `padding` on that axis. */
  paddingInline: SpacingStep | undefined;
  paddingInlineStart: SpacingStep | undefined;
  paddingInlineEnd: SpacingStep | undefined;
  /** Block (top/bottom) padding; overrides `padding` on that axis. */
  paddingBlock: SpacingStep | undefined;
  paddingBlockStart: SpacingStep | undefined;
  paddingBlockEnd: SpacingStep | undefined;
  width: BoxSize | undefined;
  height: BoxSize | undefined;
  maxWidth: BoxSize | undefined;
  minHeight: BoxSize | undefined;
  /** The element that carries the properties (default: the `[part="base"]` in the shadow root). */
  protected get boxTarget(): HTMLElement | null;
}

export type {BoxPropsShape as BoxProps};

export function BoxPropsMixin<T extends Constructor<TctElement>>(
  Base: T,
): Constructor<BoxPropsShape> & T {
  class BoxPropsElement extends Base {
    @property({attribute: 'padding', type: Number}) padding: SpacingStep | undefined;
    @property({attribute: 'padding-inline', type: Number}) paddingInline: SpacingStep | undefined;
    @property({attribute: 'padding-inline-start', type: Number}) paddingInlineStart:
      SpacingStep | undefined;
    @property({attribute: 'padding-inline-end', type: Number}) paddingInlineEnd:
      SpacingStep | undefined;
    @property({attribute: 'padding-block', type: Number}) paddingBlock: SpacingStep | undefined;
    @property({attribute: 'padding-block-start', type: Number}) paddingBlockStart:
      SpacingStep | undefined;
    @property({attribute: 'padding-block-end', type: Number}) paddingBlockEnd:
      SpacingStep | undefined;
    @property() width: BoxSize | undefined;
    @property() height: BoxSize | undefined;
    @property({attribute: 'max-width'}) maxWidth: BoxSize | undefined;
    @property({attribute: 'min-height'}) minHeight: BoxSize | undefined;

    protected get boxTarget(): HTMLElement | null {
      return this.renderRoot.querySelector<HTMLElement>('[part~="base"]');
    }

    protected override updated(changed: PropertyValues): void {
      super.updated(changed);
      const target = this.boxTarget;
      if (!target) return;
      // Most specific wins per edge: edge, then axis, then `padding`.
      const all = toStep(this.padding, 'padding');
      const inline = toStep(this.paddingInline, 'padding-inline');
      const block = toStep(this.paddingBlock, 'padding-block');
      const values: [string, string | undefined][] = [
        [
          BOX_PROPERTIES.paddingInlineStart,
          pad(toStep(this.paddingInlineStart, 'padding-inline-start') ?? inline ?? all),
        ],
        [
          BOX_PROPERTIES.paddingInlineEnd,
          pad(toStep(this.paddingInlineEnd, 'padding-inline-end') ?? inline ?? all),
        ],
        [
          BOX_PROPERTIES.paddingBlockStart,
          pad(toStep(this.paddingBlockStart, 'padding-block-start') ?? block ?? all),
        ],
        [
          BOX_PROPERTIES.paddingBlockEnd,
          pad(toStep(this.paddingBlockEnd, 'padding-block-end') ?? block ?? all),
        ],
        [BOX_PROPERTIES.width, toLength(this.width)],
        [BOX_PROPERTIES.height, toLength(this.height)],
        [BOX_PROPERTIES.maxWidth, toLength(this.maxWidth)],
        [BOX_PROPERTIES.minHeight, toLength(this.minHeight)],
      ];
      for (const [property, value] of values) {
        if (value === undefined) target.style.removeProperty(property);
        else target.style.setProperty(property, value);
      }
    }
  }

  return BoxPropsElement as unknown as Constructor<BoxPropsShape> & T;
}

function pad(step: SpacingStep | undefined): string | undefined {
  return step === undefined ? undefined : stepToken(step);
}

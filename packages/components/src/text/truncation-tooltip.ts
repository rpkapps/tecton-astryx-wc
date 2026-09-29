import {html, nothing, type TemplateResult} from 'lit';
import {TooltipController} from '@tecton-astryx/core/controllers/tooltip.js';
import {TruncationController} from '@tecton-astryx/core/controllers/truncation.js';
import type {TctElement} from '@tecton-astryx/core/tct-element.js';
import type {TooltipPlacement} from './text.types.js';

export interface TruncationTooltipOptions {
  /** The clamping element in the host's shadow root (also the tooltip trigger). */
  target: () => HTMLElement | null | undefined;
  maxLines: () => number;
  /** True when the tooltip is switched off (`no-truncate-tooltip`). */
  disabled: () => boolean;
  placement: () => TooltipPlacement;
}

/**
 * Truncation detection plus the built-in tooltip for cut-off text, shared by `tct-text` and
 * `tct-heading` (upstream `useTruncation` + the lazy Tooltip). The surface is a `[popover]` in the
 * host's shadow root, next to the trigger, so `aria-describedby` stays inside one tree; the trigger
 * never takes focus, and the full text stays in the accessibility tree (only the painting is cut).
 * Render `renderSurface()` after the clamped element.
 */
export class TruncationTooltip {
  readonly #options: TruncationTooltipOptions;
  readonly #truncation: TruncationController;

  constructor(host: TctElement, options: TruncationTooltipOptions) {
    this.#options = options;
    this.#truncation = new TruncationController(host, {
      target: options.target,
      maxLines: options.maxLines,
    });
    new TooltipController(host, {
      mode: 'shadow',
      trigger: () => options.target() ?? null,
      surface: () => host.shadowRoot?.querySelector<HTMLElement>('.tooltip-surface') ?? null,
      content: () => (this.enabled ? this.#truncation.fullText : ''),
      placement: () => ({
        placement: options.placement(),
        alignment: 'center',
        offset: 'var(--spacing-1)',
      }),
      focusTrigger: 'never',
      touchTrigger: 'auto',
      enabled: () => this.enabled,
    });
  }

  /** Whether the text is currently cut off. */
  get isTruncated(): boolean {
    return this.#truncation.isTruncated;
  }

  /** Whether the tooltip is active: truncating, cut off, and not disabled. */
  get enabled(): boolean {
    return (
      this.#options.maxLines() > 0 && !this.#options.disabled() && this.#truncation.isTruncated
    );
  }

  /** Measures now (after a slot change the controller cannot see). */
  measure(): void {
    this.#truncation.measure();
  }

  /** The tooltip surface while the tooltip is active. */
  renderSurface(): TemplateResult | typeof nothing {
    return this.enabled
      ? html`<div class="layer-surface tooltip-surface" popover="manual">
          ${this.#truncation.fullText}
        </div>`
      : nothing;
  }
}

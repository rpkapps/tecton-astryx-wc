import {html, nothing, type TemplateResult} from 'lit';

/**
 * The info tip beside a label (upstream `labelTooltip`): a small focusable button whose tooltip holds
 * the text. Upstream renders a non-focusable info icon, which keyboard and touch users cannot reach;
 * this one is a real button, so the hint is available to everyone. It sits next to the label, not inside
 * it, so its name is not folded into the label's accessible name. Hosts that render it list
 * `TctTooltip` and `TctIcon` in `dependencies`.
 */
export function renderLabelTip(
  text: string | undefined,
  name: string,
): TemplateResult | typeof nothing {
  if (!text) return nothing;
  return html`<tct-tooltip content=${text} placement="above" touch-trigger="tap"
    ><button type="button" class="label-tip focus-ring" part="label-tip" aria-label=${name}>
      <tct-icon name="info" size="sm" color="inherit"></tct-icon></button
  ></tct-tooltip>`;
}

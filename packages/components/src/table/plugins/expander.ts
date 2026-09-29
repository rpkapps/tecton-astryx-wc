/**
 * The expander control shared by the row-expansion, tree and grouped-rows plugins: a native button with
 * a chevron. `aria-expanded` carries the state, the chevron rotates from the table's light stylesheet
 * (and turns the right way in right-to-left), and the click never reaches the row, so a row that also
 * toggles on click toggles once.
 */
import {html, type TemplateResult} from 'lit';

export interface ExpanderOptions {
  /** Whether what the control opens is open. */
  expanded: boolean;
  /** The accessible name ("Expand row" / "Collapse row"). */
  label: string;
  /** Called when the user activates the control. */
  onToggle: () => void;
}

/** A chevron button; the icon element is registered by the plugin that renders it. */
export function renderExpander({expanded, label, onToggle}: ExpanderOptions): TemplateResult {
  return html`<button
    type="button"
    class="tct-table-expander"
    aria-expanded=${expanded ? 'true' : 'false'}
    aria-label=${label}
    @click=${(event: Event) => {
      event.stopPropagation();
      onToggle();
    }}
  >
    <tct-icon name="chevronRight" size="xsm"></tct-icon>
  </button>`;
}

/** Clicks that start on interactive content (or end a text selection) must not toggle a row. */
const INTERACTIVE =
  'button, a, input, select, textarea, [role="button"], [role="checkbox"], [contenteditable="true"], tct-checkbox-input, tct-button';

/** Whether a row click is a plain click on the row body: not on a control, not ending a text selection. */
export function isPlainRowClick(event: Event): boolean {
  const target = event.target;
  if (target instanceof Element && target.closest(INTERACTIVE)) return false;
  return (globalThis.getSelection()?.toString() ?? '') === '';
}

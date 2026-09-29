/** Enumerations shared by `tct-multi-selector`. The option shapes and sizes are the selector's. */

/** How the chosen options show on the closed trigger. */
export const TRIGGER_DISPLAYS = ['count', 'labels', 'badges'] as const;
export type TriggerDisplay = (typeof TRIGGER_DISPLAYS)[number];

/** One chosen option as `formatValue` receives it: its value and resolved label, in selection order. */
export interface MultiSelectorSelectedItem {
  value: string;
  label: string;
}

/** Formats the trigger text of the `count` and `labels` displays. */
export type MultiSelectorFormatter = (items: MultiSelectorSelectedItem[]) => string;

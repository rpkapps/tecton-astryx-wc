/** How a citation is drawn: a label chip with the source title, or a compact numbered badge. */
export const CITATION_VARIANTS = ['label', 'number'] as const;

export type CitationVariant = (typeof CITATION_VARIANTS)[number];

/** The cited source (upstream `CitationSource`). */
export interface CitationSource {
  /** Source title; the citation number is shown when absent. */
  title?: string;
  /**
   * Destination. It follows the shared navigation policy (`javascript:`, `vbscript:` and
   * `data:text/html` are refused); a rejected destination leaves the citation visible without a link.
   */
  url?: string;
  /** Image URL of a favicon or source logo, drawn decoratively before the title (label variant). */
  src?: string;
  /**
   * Image URL kept for callers that passed a favicon URL here (upstream back-compat). A node icon is
   * the `icon` slot instead; `src` wins over this when both are set.
   */
  icon?: string;
}

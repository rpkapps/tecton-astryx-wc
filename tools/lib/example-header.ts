/**
 * The metadata comment on the first line of `examples/<id>.html` (CONVENTIONS §7):
 *
 *   <!-- title: Disabled; description: Muted text; a11y-exempt: color-contrast | Why the exemption holds -->
 *
 * `a11y-exempt` is optional. It names axe rule ids (comma separated) that the docs accessibility crawl
 * must not enforce inside this example's preview, and a required reason after `|`. It exists for
 * demonstrations that WCAG itself exempts (for example disabled text shown outside a control): the crawl
 * lists every exemption with its reason in its output, so none is silent. Pure text handling: shared by
 * the docs model (Node) and `apps/docs/src/components/Example.astro`.
 */

/** Rule ids an example may exempt. Anything else is an error: the gate is not weakened by typo or by stealth. */
export const EXEMPTABLE_RULES: readonly string[] = ['color-contrast'];

export interface A11yExemption {
  rules: string[];
  reason: string;
}

export interface ExampleHeader {
  title: string;
  description: string;
  a11yExempt: A11yExemption | undefined;
  /** Number of characters the header (comment and trailing newline) occupied. */
  length: number;
}

const COMMENT = /^\s*<!--([\s\S]*?)-->\s*\n?/;

/** Undefined when the text does not start with a `title:` comment. */
export function parseExampleHeader(text: string): ExampleHeader | undefined {
  const match = COMMENT.exec(text);
  if (!match || !/^\s*title:/.test(match[1]!)) return undefined;
  let body = match[1]!.trim();

  let a11yExempt: A11yExemption | undefined;
  const exemptAt = body.search(/;\s*a11y-exempt:/);
  if (exemptAt !== -1) {
    const tail = body.slice(exemptAt).replace(/^;\s*a11y-exempt:\s*/, '');
    body = body.slice(0, exemptAt);
    const [rules = '', ...reason] = tail.split('|');
    a11yExempt = {
      rules: rules
        .split(',')
        .map((rule) => rule.trim())
        .filter(Boolean),
      reason: reason.join('|').trim(),
    };
  }

  const titleMatch = /^title:\s*([^;]*?)\s*(?:;\s*description:\s*([\s\S]*))?$/.exec(body);
  return {
    title: titleMatch?.[1] ?? '',
    description: titleMatch?.[2]?.trim() ?? '',
    a11yExempt,
    length: match[0].length,
  };
}

/** Problems with an exemption (empty when it is well formed). */
export function exemptionProblems(exemption: A11yExemption | undefined): string[] {
  if (!exemption) return [];
  const problems: string[] = [];
  if (exemption.rules.length === 0) problems.push('a11y-exempt names no rule');
  for (const rule of exemption.rules) {
    if (!EXEMPTABLE_RULES.includes(rule)) {
      problems.push(
        `a11y-exempt: "${rule}" cannot be exempted (allowed: ${EXEMPTABLE_RULES.join(', ')})`,
      );
    }
  }
  if (exemption.reason.length < 20) {
    problems.push(
      'a11y-exempt needs a reason (after "|"): say why the exemption holds, at least a sentence',
    );
  }
  return problems;
}

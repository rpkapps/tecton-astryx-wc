/**
 * Parity report model (A§15.5): upstream manifest (184 core + 67 extension entries) x every
 * `parity.json` x docs presence x CEM. One row per upstream entry with API mapping coverage,
 * behaviour (test categories present), docs (required sections present), theming (provisional
 * values and token requests), keyboard and a11y. Waived rows stay visible as disclosed gaps.
 * Consumed by `tools/parity-report.ts` (reports/parity.{json,md}) and the docs "Parity status" page.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  cemNamesByTag,
  expectedApiNames,
  type LoadedParity,
  type Manifest,
  type ParityEntry,
  type Problem,
} from './parity.ts';
import {REQUIRED_SECTIONS, loadComponentDocs, missingSections} from './docs-model.ts';

export const STATUSES = ['not-started', 'in-progress', 'implemented', 'verified'] as const;
export type ReportStatus = (typeof STATUSES)[number];

export interface ParityRow {
  id: string;
  name: string;
  package: string;
  tier: 'core' | 'extension';
  category: string | null;
  kind: string;
  folder: string | null;
  tag: string | null;
  status: ReportStatus;
  api: {expected: number; mapped: number; waived: number; coveragePct: number};
  behaviour: {testCategories: string[]};
  docs: {
    page: boolean;
    sectionsPresent: number;
    sectionsRequired: number;
    missingSections: string[];
    examples: number;
  };
  theming: {provisional: string[]; tokenRequests: string[]};
  keyboardRows: number;
  a11y: {tests: boolean};
  differences: string[];
  requests: number;
  /** Tag present in the CEM (undefined when there is no manifest or no tag). */
  inCem: boolean | null;
}

export interface ParityReport {
  generatedFrom: {manifestCommit: string; parityFiles: string[]};
  summary: Record<'core' | 'extension', {total: number} & Record<ReportStatus, number>>;
  problems: Problem[];
  entries: ParityRow[];
}

export function buildParityReport(options: {
  manifest: Manifest;
  parity: readonly LoadedParity[];
  problems: readonly Problem[];
  componentsSrc: string;
  cemPath?: string;
  /** Repository-relative shown path for each parity file. */
  shown: (file: string) => string;
}): ParityReport {
  const {manifest, parity, problems, componentsSrc} = options;
  const recorded = new Map<string, {folder: string; entry: ParityEntry}>();
  for (const {data} of parity) {
    for (const [id, entry] of Object.entries(data.entries))
      recorded.set(id, {folder: data.folder, entry});
  }
  const cem =
    options.cemPath && existsSync(options.cemPath)
      ? cemNamesByTag(JSON.parse(readFileSync(options.cemPath, 'utf8')) as unknown)
      : undefined;

  const rows: ParityRow[] = manifest.entries.map((upstream) => {
    const found = recorded.get(upstream.id);
    const expected = expectedApiNames(upstream);
    const mapped = new Set(found?.entry.api.map((row) => row.upstream) ?? []);
    const mappedCount = expected.filter((name) => mapped.has(name)).length;
    const docs = found ? loadComponentDocs(componentsSrc, found.folder) : null;
    const missing = docs?.docsFile ? missingSections(docs.sections) : [...REQUIRED_SECTIONS];
    const tests = Object.entries(found?.entry.tests ?? {})
      .filter(([, on]) => on)
      .map(([name]) => name);
    return {
      id: upstream.id,
      name: upstream.name,
      package: upstream.package,
      tier: upstream.package === '@astryxdesign/core' ? 'core' : 'extension',
      category: upstream.category ?? null,
      kind: upstream.kind,
      folder: found?.folder ?? null,
      tag: found?.entry.tag ?? null,
      status: found?.entry.status ?? 'not-started',
      api: {
        expected: expected.length,
        mapped: mappedCount,
        waived: found?.entry.api.filter((row) => row.as === 'waived').length ?? 0,
        coveragePct:
          expected.length === 0 ? 100 : Math.round((mappedCount / expected.length) * 100),
      },
      behaviour: {testCategories: tests},
      docs: {
        page: Boolean(docs?.docsFile),
        sectionsPresent: docs?.docsFile ? REQUIRED_SECTIONS.length - missing.length : 0,
        sectionsRequired: REQUIRED_SECTIONS.length,
        missingSections: found ? missing : [],
        examples: docs?.examples.length ?? 0,
      },
      theming: {
        provisional: found?.entry.provisional ?? [],
        tokenRequests: (found?.entry.tokenRequests ?? []).map((request) => request.name),
      },
      keyboardRows: found?.entry.keyboard?.length ?? 0,
      a11y: {tests: found?.entry.tests?.a11y === true},
      differences: (found?.entry.differences ?? []).map((difference) => difference.id),
      requests: found?.entry.requests?.length ?? 0,
      inCem: cem && found?.entry.tag ? cem.has(found.entry.tag) : null,
    };
  });

  const summarize = (tier: 'core' | 'extension') => {
    const tierRows = rows.filter((row) => row.tier === tier);
    return {
      total: tierRows.length,
      ...(Object.fromEntries(
        STATUSES.map((status) => [status, tierRows.filter((row) => row.status === status).length]),
      ) as Record<ReportStatus, number>),
    };
  };

  return {
    generatedFrom: {
      manifestCommit: manifest.baseline.commit,
      parityFiles: parity.map((p) => options.shown(p.file)),
    },
    summary: {core: summarize('core'), extension: summarize('extension')},
    problems: [...problems],
    entries: rows,
  };
}

export function parityMarkdown(report: ParityReport, manifestCommit: string): string {
  const {summary, problems, entries} = report;
  return [
    '# Parity report',
    '',
    `Upstream Astryx at \`${manifestCommit.slice(0, 7)}\`. Generated by \`pnpm parity\`; do not edit.`,
    '',
    '| Tier | Total | Not started | In progress | Implemented | Verified |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(summary).map(
      ([tier, s]) =>
        `| ${tier} | ${s.total} | ${s['not-started']} | ${s['in-progress']} | ${s.implemented} | ${s.verified} |`,
    ),
    '',
    ...(problems.length > 0
      ? ['## Problems', '', ...problems.map((p) => `- \`${p.file}\`: ${p.message}`), '']
      : []),
    '## Entries',
    '',
    '| Entry | Folder | Tag | Status | API mapped | Waived | Docs sections | Tests | Keyboard | Provisional |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: |',
    ...entries.map(
      (row) =>
        `| ${row.id} | ${row.folder ?? ''} | ${row.tag ?? ''} | ${row.status} | ${row.api.mapped}/${row.api.expected} | ${row.api.waived} | ` +
        `${row.docs.page ? `${row.docs.sectionsPresent}/${row.docs.sectionsRequired}` : ''} | ${row.behaviour.testCategories.join(', ')} | ` +
        `${row.keyboardRows || ''} | ${row.theming.provisional.length || ''} |`,
    ),
    '',
  ].join('\n');
}

export const PARITY_REPORT_FILES = (reportsDir: string) => ({
  json: join(reportsDir, 'parity.json'),
  md: join(reportsDir, 'parity.md'),
});

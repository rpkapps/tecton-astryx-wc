/**
 * `tct gap-report`: routes a design-system gap (a missing element, attribute, token, icon or guide) to the
 * package that owns it and records it where a handler can pick it up.
 *
 * Target selection: an explicit `--package`, else the unique package that provides the named element, else
 * the component library. The library is unpublished (there is no public issue tracker), so the built-in
 * delivery is `routed_only` (the receipt names the owner and where to record it), and `--output <file>` adds a
 * project handler that appends the report as one JSON line to a file inside the project.
 */
import {appendFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import type {CommandContext, CommandSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {assertWithin} from '../fs-safety.ts';
import {RegistryLookup} from '../registry/lookup.ts';
import {blocks, record, records, section} from '../text.ts';
import type {GapReportCategory, GapReportDelivery, GapReportReceipt} from '../types.ts';
import {scanPackages} from './discover.ts';
import {COMPONENT_PACKAGE} from './component.ts';

export const GAP_REPORT_CATEGORIES: readonly {value: GapReportCategory; label: string}[] = [
  {value: 'missing_component', label: 'Missing element'},
  {value: 'missing_variant', label: 'Missing variant or attribute'},
  {value: 'layout_gap', label: 'Layout gap'},
  {value: 'styling_gap', label: 'Styling gap'},
  {value: 'a11y_gap', label: 'Accessibility gap'},
  {value: 'api_friction', label: 'API friction'},
  {value: 'docs_gap', label: 'Documentation gap'},
  {value: 'other', label: 'Other'},
];

const LIMITS = {component: 120, reason: 2000, detail: 8000} as const;
const count = (value: string): number => Array.from(value).length;

export const gapReportSpec: CommandSpec = {
  name: 'gap-report',
  summary: 'Route a design-system gap to its owning package',
  description:
    'Reports a missing element, attribute, layout, styling, accessibility, API or documentation capability. The ' +
    'target is an explicit --package, else the unique package that provides the named element, else the component ' +
    'library. Nothing is filed publicly (the library is unpublished): the receipt names the owner and where the ' +
    'request is recorded, and --output appends the report to a file in your project.',
  args: [
    {
      name: 'component',
      required: false,
      description:
        'Element or design-system area the gap is about, up to 120 characters. Required unless --list-categories.',
    },
  ],
  options: [
    {
      flag: '--category',
      type: 'string',
      value: 'category',
      description: 'Gap category (see --list-categories). Required unless --list-categories.',
    },
    {
      flag: '--reason',
      type: 'string',
      value: 'text',
      description: 'What capability was missing or difficult, up to 2000 characters.',
    },
    {
      flag: '--additional-context',
      type: 'string',
      value: 'text',
      description: 'Optional further context, up to 8000 characters.',
    },
    {
      flag: '--package',
      type: 'string',
      value: 'pkg',
      description: 'Route to a specific package (see `tct discover`).',
    },
    {
      flag: '--output',
      type: 'string',
      value: 'file',
      description:
        'Also append the report as one JSON line to this file (relative, inside the project).',
    },
    {
      flag: '--list-categories',
      type: 'boolean',
      description: 'List the valid categories; nothing is routed or written.',
    },
  ],
  examples: [
    {label: 'List categories', cli: 'tct gap-report --list-categories'},
    {
      label: 'Route a report',
      cli: "tct gap-report tct-button --category missing_variant --reason 'Need a compact size'",
    },
    {
      label: 'Keep a local record',
      cli: "tct gap-report tct-dialog --category docs_gap --reason 'No RTL example' --output .tct/gaps.jsonl",
    },
  ],
  exitCodes: [
    {code: 0, when: 'routed, filed, or categories listed'},
    {code: 1, when: 'a delivery failed, the input is invalid, or the routing is ambiguous'},
  ],
  responseTypes: ['gap-report.categories', 'gap-report.file'],
  json: true,
  related: ['component', 'discover'],
  run: (context) => runGapReport(context),
};

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CliError(`${label} is required.`, ERROR_CODES.ERR_MISSING_ARGUMENT);
  }
  const normalized = value.trim();
  if (count(normalized) > max) {
    throw new CliError(
      `${label} must be ${max} characters or fewer.`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
    );
  }
  return normalized;
}

function runGapReport(context: CommandContext): Outcome {
  const {options} = context;

  if (options.listCategories === true) {
    return {
      type: 'gap-report.categories',
      data: [...GAP_REPORT_CATEGORIES],
      text: blocks(
        section('Gap report categories'),
        records([...GAP_REPORT_CATEGORIES], {fields: ['value', 'label']}),
      ),
    };
  }

  const component = requiredText(context.args[0], 'component', LIMITS.component);
  const categoryValue = requiredText(options.category, '--category', 64);
  const category = GAP_REPORT_CATEGORIES.find((entry) => entry.value === categoryValue);
  if (!category) {
    throw new CliError(
      `Unknown category "${categoryValue}".`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
      GAP_REPORT_CATEGORIES.map((entry) => ({name: entry.value, reason: entry.label})),
    );
  }
  const reason = requiredText(options.reason, '--reason', LIMITS.reason);
  let detail: string | undefined;
  if (typeof options.additionalContext === 'string' && options.additionalContext.trim() !== '') {
    detail = options.additionalContext.trim();
    if (count(detail) > LIMITS.detail) {
      throw new CliError(
        `--additional-context must be ${LIMITS.detail} characters or fewer.`,
        ERROR_CODES.ERR_INVALID_ARGUMENT,
      );
    }
  }

  const {packages} = scanPackages(context);
  const explicit = typeof options.package === 'string' ? options.package : undefined;
  let target = COMPONENT_PACKAGE;
  let owner: {folder: string; tag: string} | null = null;
  if (explicit) {
    const found = packages.find((pkg) => pkg.name === explicit);
    if (!found) {
      throw new CliError(
        `No package named "${explicit}" is loaded.`,
        ERROR_CODES.ERR_UNKNOWN_PACKAGE,
        packages.map((pkg) => ({name: pkg.name, reason: 'loaded package'})),
      );
    }
    target = found.name;
  }
  const owners = packages.flatMap((pkg) => {
    const match = new RegistryLookup(pkg.registry).component(component);
    return match
      ? [
          {
            pkg: pkg.name,
            folder: match.component.folder,
            tag: match.element?.tag ?? match.component.tag ?? component,
          },
        ]
      : [];
  });
  if (!explicit) {
    if (owners.length > 1) {
      throw new CliError(
        `"${component}" is provided by more than one package. Re-run with --package <pkg> to choose one.`,
        ERROR_CODES.ERR_AMBIGUOUS_COMPONENT,
        owners.map((each) => ({name: each.pkg, reason: 'provides this element'})),
      );
    }
    if (owners.length === 1) target = owners[0]!.pkg;
  }
  const ownerEntry = owners.find((each) => each.pkg === target);
  if (ownerEntry) owner = {folder: ownerEntry.folder, tag: ownerEntry.tag};

  const report = {
    component,
    category: category.value,
    reason,
    ...(detail ? {detail} : {}),
    package: target,
    createdAt: new Date().toISOString(),
  };
  const deliveries: GapReportDelivery[] = [];

  if (typeof options.output === 'string') {
    try {
      const file = assertWithin(options.output, context.cwd, '--output path');
      mkdirSync(dirname(file), {recursive: true});
      appendFileSync(file, `${JSON.stringify(report)}\n`);
      deliveries.push({
        handlerType: 'project',
        handler: 'output-file',
        audience: 'internal',
        status: 'filed',
        url: null,
        message: `Appended to ${options.output}.`,
      });
    } catch (error) {
      if (error instanceof CliError && error.code === ERROR_CODES.ERR_PATH_TRAVERSAL) throw error;
      deliveries.push({
        handlerType: 'project',
        handler: 'output-file',
        audience: 'internal',
        status: 'failed',
        url: null,
        message: (error as Error).message,
      });
    }
  }
  if (deliveries.length === 0) {
    const where =
      target === COMPONENT_PACKAGE && owner
        ? `record it under "requests" in packages/components/src/${owner.folder}/parity.json (library workspace)`
        : `report it to the maintainers of ${target}`;
    deliveries.push({
      handlerType: 'fallback',
      handler: 'routed-only',
      audience: null,
      status: 'routed_only',
      url: null,
      message: `No handler is configured and the library is unpublished, so nothing was filed: ${where}.`,
    });
  }

  const filedCount = deliveries.filter((entry) => entry.status === 'filed').length;
  const routedOnlyCount = deliveries.filter((entry) => entry.status === 'routed_only').length;
  const failed = deliveries.some((entry) => entry.status === 'failed');
  const receipt: GapReportReceipt = {
    status: failed
      ? filedCount > 0
        ? 'partial'
        : 'failed'
      : filedCount > 0
        ? 'filed'
        : 'routed_only',
    package: target,
    issuesUrl: null,
    deliveries,
    filedCount,
    routedOnlyCount,
  };
  const heading =
    receipt.status === 'filed'
      ? 'Gap report filed'
      : receipt.status === 'partial'
        ? 'Gap report partially filed'
        : receipt.status === 'failed'
          ? 'Gap report failed'
          : 'Gap report route';
  const text = blocks(
    section(heading),
    record(receipt, {fields: ['status', 'package', 'issuesUrl', 'filedCount', 'routedOnlyCount']}),
    receipt.deliveries.length > 0 &&
      blocks(
        section('Deliveries'),
        records(receipt.deliveries, {
          fields: ['handlerType', 'handler', 'audience', 'status', 'url', 'message'],
        }),
      ),
  );
  return {type: 'gap-report.file', data: receipt, text, exitCode: failed ? 1 : 0};
}

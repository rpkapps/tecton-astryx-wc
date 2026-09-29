/**
 * `tct layout`: generate and check layouts from a compressed expression. `grammar` prints the cheatsheet,
 * `check` validates an expression and echoes both canonical surfaces, `expand` produces validated `tct-*`
 * markup. The layout elements (tct-stack, tct-hstack, tct-vstack, tct-grid, tct-center, tct-card,
 * tct-section) are what an agent should reach for instead of hand-written CSS.
 */
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, relative, resolve} from 'node:path';
import type {CommandContext, CommandSpec, OptionSpec, Outcome} from '../command.ts';
import {ERROR_CODES, CliError} from '../errors.ts';
import {assertWithin} from '../fs-safety.ts';
import {MAX_REPEAT, expand} from '../layout/expand.ts';
import {LayoutParseError, detectForm, parse} from '../layout/parse.ts';
import {toCompact, toOutline} from '../layout/print.ts';
import {buildLayoutRegistry} from '../layout/registry.ts';
import {validate} from '../layout/validate.ts';
import type {LayoutDoc, LayoutRegistry, RawIssue} from '../layout/ast.ts';
import {blocks, list, section} from '../text.ts';
import type {LayoutCheckData, LayoutExpandData, LayoutGrammarData, LayoutIssue} from '../types.ts';

/** The largest expression read from --file or stdin. */
const MAX_EXPRESSION_BYTES = 5 * 1024 * 1024;

const FORM_OPTION: OptionSpec = {
  flag: '--form',
  type: 'string',
  value: 'form',
  choices: ['compact', 'outline', 'auto'],
  default: 'auto',
  description: 'The input surface (autodetected by default).',
};
const LOOSE_OPTION: OptionSpec = {
  flag: '--loose',
  type: 'boolean',
  description: 'Downgrade an unknown {reference} to a TODO placeholder instead of an error.',
};
const FILE_OPTION: OptionSpec = {
  flag: '--file',
  type: 'string',
  value: 'path',
  description: 'Read the expression from a file.',
};

const EXPRESSION_ARG = {
  name: 'expression',
  required: false,
  description: 'The layout expression, or - to read it from stdin (or use --file).',
} as const;

const formatIssue = (issue: RawIssue): string =>
  `${issue.line !== undefined ? `line ${issue.line}: ` : ''}${issue.message}`;

const toIssue = (issue: RawIssue): LayoutIssue => ({
  ...(issue.line !== undefined ? {line: issue.line} : {}),
  ...(issue.col !== undefined ? {col: issue.col} : {}),
  message: issue.message,
  formatted: formatIssue(issue),
  ...(issue.suggestions && issue.suggestions.length > 0 ? {suggestions: issue.suggestions} : {}),
});

async function readExpression(context: CommandContext): Promise<string> {
  const file = context.options.file;
  if (typeof file === 'string') {
    const path = resolve(context.cwd, file);
    const stat = existsSync(path) ? statSync(path) : null;
    if (!stat?.isFile())
      throw new CliError(`File not found: ${file}`, ERROR_CODES.ERR_FILE_NOT_FOUND);
    if (stat.size > MAX_EXPRESSION_BYTES) {
      throw new CliError(
        `File "${file}" is too large (max 5 MB).`,
        ERROR_CODES.ERR_INVALID_ARGUMENT,
      );
    }
    return readFileSync(path, 'utf8');
  }
  const expression = context.args[0];
  if (expression === '-') {
    if (!context.io.readStdin)
      throw new CliError('There is no piped input to read.', ERROR_CODES.ERR_MISSING_ARGUMENT);
    const text = await context.io.readStdin();
    if (Buffer.byteLength(text) > MAX_EXPRESSION_BYTES) {
      throw new CliError(
        'The layout expression on stdin is too large (max 5 MB).',
        ERROR_CODES.ERR_INVALID_ARGUMENT,
      );
    }
    return text;
  }
  return expression ?? '';
}

interface Analysis {
  doc: LayoutDoc;
  registry: LayoutRegistry;
  errors: RawIssue[];
  warnings: RawIssue[];
}

/** Parse and validate, turning a syntax error into `ERR_LAYOUT_PARSE`. */
function analyse(source: string, context: CommandContext): Analysis {
  if (source.trim() === '') {
    throw new CliError(
      'No layout expression given: pass it as an argument, with --file, or on stdin (-).',
      ERROR_CODES.ERR_MISSING_ARGUMENT,
    );
  }
  const form = (context.options.form as 'compact' | 'outline' | 'auto' | undefined) ?? 'auto';
  const registry = buildLayoutRegistry(context.registry().registry);
  let doc: LayoutDoc;
  try {
    doc = parse(source, {form});
  } catch (error) {
    if (error instanceof LayoutParseError) {
      throw new CliError(
        `Layout expression syntax error at line ${error.line}, col ${error.col}: ${error.message}`,
        ERROR_CODES.ERR_LAYOUT_PARSE,
      );
    }
    throw error;
  }
  const {errors, warnings} = validate(doc, registry, {loose: context.options.loose === true});
  return {doc, registry, errors, warnings};
}

const grammarSpec: CommandSpec = {
  name: 'grammar',
  summary: 'Print the layout expression grammar cheatsheet',
  description:
    'The agent cheatsheet for writing layout expressions, with the alias table generated from the installed ' +
    'registry (never hand-maintained), so the short names always match the elements that exist.',
  args: [],
  options: [],
  examples: [{label: 'Print the cheatsheet', cli: 'tct layout grammar'}],
  exitCodes: [{code: 0, when: 'success'}],
  responseTypes: ['layout.grammar'],
  json: true,
  related: ['layout check', 'layout expand'],
  run: (context): Outcome => {
    const registry = buildLayoutRegistry(context.registry().registry);
    const byTarget = new Map<string, string[]>();
    for (const [alias, tag] of registry.aliases)
      byTarget.set(tag, [...(byTarget.get(tag) ?? []), alias]);
    const aliasLines = [...byTarget]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, aliases]) => `${aliases.join('/')}=${tag}`);
    const text = `Layout expressions: compressed markup for tct-* layouts (aliases reflect this install)

WORKFLOW
  tct layout check "<expr>"           validate; echoes the canonical compact and outline forms
  tct layout expand "<expr>" [path]   emit validated markup (path optional; refuses to overwrite without --force)
  Errors carry line and column plus suggestions. Fix and resubmit; nothing is guessed.

TWO SURFACES, ONE LANGUAGE (autodetected; --form to force)
  compact: V[gap=4] > (Tx"Title" + H[gap=2] > (B.primary"Save" + B"Cancel"))
  outline: indentation = nesting, same indent = siblings, "repeat N:" block = (...)*N
           slot lines:  start: B"Back"     (or a block:  start:\\n    B"Back" ...)

NODE ANATOMY   Name#id.enum"payload"[attrs]{reference}*N > children
  Name         an alias (V), a tag (tct-vstack) or a short name (vstack, VStack)
  .enum        a unique enumerated value of any attribute:  B.primary  Bd.success
  "payload"    the element's text: its label attribute when it has one, else its default slot
  {name}       an element reference: a tct-* element by name ({tct-card}), or an app custom element ({kpi-card})
  *N           repeat, at most ${MAX_REPEAT} copies; $ is the counter (Tx"item-$"*3); \\$ is a literal dollar sign
  trailing !   initial selection (sets selected or checked when the element has it)

ATTRS [...] (outline: bare tokens after the name, no brackets)
  fused        p6 g4 c4 w240 h2 mw960 rg2 cg2  (padding, gap, columns, width, height, max-width, row/column gap)
  key=value    variant=primary href='/x' column-min-width=240 dividers=[top,bottom]; keys are the real attribute names
  flags        scroll dis req ... any boolean attribute; negate: !scroll
  align        j= main axis, a= cross axis: the expander picks h-align or v-align per stack direction
  slots        @slotName=Node | @slotName=(sub > expr) | @slotName='text' | @slotName=#id
  trigger      opens=#id  (a plain attribute, no @): the trigger gets data-opens and a wiring script opens the overlay
  fill         on a stack child: wraps it in <tct-stack-item size="fill">
  columns      c4 is columns=4; c{min:240,max:4,fit} becomes column-min-width, column-max, column-repeat

STRUCTURE
  overlays     compact: tree ;; Dlg#confirm[...]   outline: an "overlays:" section
               trigger: B"Delete"[opens=#confirm]
  pairings     tct-grid-span only directly under tct-grid; tct-stack-item only under a stack

ALIASES (tags and short names are always valid)
  ${aliasLines.join('  ')}
`;
    const data: LayoutGrammarData = {text, aliases: Object.fromEntries(registry.aliases)};
    return {type: 'layout.grammar', data, text};
  },
};

const checkSpec: CommandSpec = {
  name: 'check',
  summary: 'Validate a layout expression',
  description:
    'Parses and validates without expanding, and echoes both canonical surfaces (compact and outline). An ' +
    'invalid but parseable expression exits 1 in both --json and text mode, so check works as a CI gate. A ' +
    'syntax error is an ERR_LAYOUT_PARSE error with line and column.',
  args: [EXPRESSION_ARG],
  options: [FORM_OPTION, LOOSE_OPTION, FILE_OPTION],
  examples: [
    {label: 'Check', cli: 'tct layout check "V[gap=4] > (Tx\\"Hello\\" + B.primary\\"Save\\")"'},
    {label: 'From a file, as JSON', cli: 'tct layout check --file layout.txt --json'},
  ],
  exitCodes: [
    {code: 0, when: 'the expression is valid'},
    {
      code: 1,
      when: 'the expression is invalid, has a syntax error, is empty, or the file is missing',
    },
  ],
  responseTypes: ['layout.check'],
  json: true,
  related: ['layout grammar', 'layout expand'],
  run: async (context): Promise<Outcome> => {
    const source = await readExpression(context);
    const {doc, errors, warnings} = analyse(source, context);
    const data: LayoutCheckData = {
      valid: errors.length === 0,
      form: doc.form,
      errors: errors.map(toIssue),
      warnings: warnings.map(formatIssue),
      compact: toCompact(doc),
      outline: toOutline(doc),
    };
    let text: string;
    if (!data.valid) {
      text = blocks(
        `[fail] Invalid (${errors.length} error${errors.length === 1 ? '' : 's'}):`,
        list(
          data.errors.map((issue) =>
            issue.suggestions
              ? `${issue.formatted}\n  did you mean: ${issue.suggestions.join(', ')}?`
              : issue.formatted,
          ),
        ),
      );
    } else {
      text = blocks(
        `[ok] Valid (parsed as ${doc.form})`,
        data.warnings.length > 0 && data.warnings.map((warning) => `! ${warning}`).join('\n'),
        section('compact'),
        data.compact,
        section('outline'),
        data.outline,
      );
    }
    return {type: 'layout.check', data, text, exitCode: data.valid ? 0 : 1};
  },
};

const expandSpec: CommandSpec = {
  name: 'expand',
  summary: 'Expand a layout expression into tct-* markup',
  description:
    'Validates the expression and emits markup: attributes from the bindings, slot content with its slot ' +
    'attribute, fill children wrapped in a stack item, and a module script that imports the families used. With a ' +
    'path, writes there (a directory gets layout.html); the path must be inside the project and an existing file is ' +
    'not overwritten without --force.',
  args: [
    EXPRESSION_ARG,
    {
      name: 'path',
      required: false,
      description: 'Write the markup to this file or directory (relative, inside the project).',
    },
  ],
  options: [
    FORM_OPTION,
    LOOSE_OPTION,
    FILE_OPTION,
    {flag: '--force', type: 'boolean', description: 'Overwrite an existing target file.'},
  ],
  examples: [
    {
      label: 'Print the markup',
      cli: 'tct layout expand "V[gap=4] > (Tx\\"Hello\\" + B.primary\\"Save\\")"',
    },
    {label: 'Write a file', cli: 'tct layout expand --file layout.txt src/page.html'},
  ],
  exitCodes: [
    {code: 0, when: 'expanded'},
    {
      code: 1,
      when: 'the expression is invalid or empty, the path leaves the project, or the target exists',
    },
  ],
  responseTypes: ['layout.expand'],
  json: true,
  related: ['layout check', 'layout grammar'],
  run: async (context): Promise<Outcome> => {
    const source = await readExpression(context);
    const analysis = analyse(source, context);
    if (analysis.errors.length > 0) {
      throw new CliError(
        `Layout expression is invalid:\n${analysis.errors.map((issue) => `  - ${formatIssue(issue)}`).join('\n')}`,
        ERROR_CODES.ERR_LAYOUT_INVALID,
        analysis.errors.flatMap((issue) =>
          (issue.suggestions ?? []).map((name) => ({name, reason: 'did you mean this?'})),
        ),
      );
    }
    const result = expand(analysis.doc, analysis.registry);
    const targetPath = typeof context.options.file === 'string' ? context.args[0] : context.args[1];
    let written: string | null = null;
    if (targetPath !== undefined) {
      const target = assertWithin(
        extname(targetPath) ? targetPath : join(targetPath, 'layout.html'),
        context.cwd,
        'layout target path',
      );
      if (existsSync(target) && context.options.force !== true) {
        throw new CliError(
          `Refusing to overwrite existing file ${relative(context.cwd, target)} (use --force).`,
          ERROR_CODES.ERR_FILE_EXISTS,
        );
      }
      mkdirSync(dirname(target), {recursive: true});
      writeFileSync(target, result.html);
      written = relative(context.cwd, target);
    }
    const data: LayoutExpandData = {
      form:
        (context.options.form as string | undefined) && context.options.form !== 'auto'
          ? (context.options.form as 'compact' | 'outline')
          : detectForm(source),
      code: result.html,
      elementsUsed: result.elementsUsed,
      imports: result.imports,
      todos: result.todos,
      warnings: analysis.warnings.map(formatIssue),
      written,
    };
    const warnings =
      data.warnings.length > 0 ? data.warnings.map((warning) => `! ${warning}`).join('\n') : null;
    const text = written
      ? blocks(
          warnings,
          `[ok] Expanded to ${written}`,
          `elementsUsed: ${data.elementsUsed.join(', ')}\ntodos: ${data.todos.length} (search for "TODO(layout)")`,
        )
      : blocks(warnings, result.html);
    return {type: 'layout.expand', data, text};
  },
};

export const layoutSpec: CommandSpec = {
  name: 'layout',
  summary: 'Generate and check layouts from compressed expressions',
  description:
    'Compressed layout expressions expand to validated tct-* markup. `grammar` prints the cheatsheet, `check` ' +
    'validates an expression, `expand` produces the markup. Use the layout elements instead of hand-written CSS.',
  args: [],
  options: [],
  examples: [{label: 'Cheatsheet', cli: 'tct layout grammar'}],
  exitCodes: [{code: 0, when: 'help shown'}],
  responseTypes: [],
  json: true,
  related: ['component', 'docs'],
  subcommands: [grammarSpec, checkSpec, expandSpec],
};

/**
 * Response types of `tct --json`: the `data` payload of every response `type`, and typed envelopes for
 * them. Re-exported by `@tecton-wc/cli/json`, so out-of-process consumers narrow on `type` without guessing.
 */
import type {CLIResponse} from './json.ts';
import type {
  DenseDoc,
  RegistryController,
  RegistryElement,
  RegistryExample,
} from './registry/types.ts';

// ── component ────────────────────────────────────────────────────────────

export interface ComponentListEntry {
  /** The primary tag. */
  name: string;
  displayName: string;
  folder: string;
  package: string;
}

export interface ComponentBriefEntry extends ComponentListEntry {
  description: string;
  import: string;
}

export interface ComponentDenseEntry {
  name: string;
  tag: string;
  tags: string[];
  folder: string;
  category: string;
  import: {specifier: string; statement: string};
  summary: string;
  related: string[];
  dense: DenseDoc | null;
}

/** `component.list`: the payload depends on `detail` (names < compact < full). */
export type ComponentListData =
  | {detail: 'names'; components: Record<string, ComponentListEntry[]>}
  | {detail: 'compact'; components: Record<string, ComponentBriefEntry[]>}
  | {detail: 'full'; components: Record<string, ComponentDenseEntry[]>};

export interface ComponentDetail {
  name: string;
  tag: string;
  tags: string[];
  folder: string;
  category: string;
  url: string;
  summary: string;
  keywords: string[];
  related: string[];
  status: string;
  import: {specifier: string; statement: string};
  package: string;
  dense: DenseDoc | null;
  elements: RegistryElement[];
  examples: RegistryExample[];
  sections: Record<string, string>;
  /** Set when the query named a non-primary element of a compound family. */
  scopedTo?: string;
  parent?: string;
}

/** `component.detail`: full, or (`--dense`, `meta.dense`) the dense projection. */
export type ComponentDetailData = ComponentDetail | ComponentDenseEntry;

export type ComponentListResponse = CLIResponse<'component.list', ComponentListData>;
export type ComponentDetailResponse = CLIResponse<'component.detail', ComponentDetailData>;
export type ComponentPropsResponse = CLIResponse<
  'component.detail.props',
  {
    component: string;
    elements: Pick<
      RegistryElement,
      'tag' | 'attributes' | 'properties' | 'slots' | 'events' | 'methods'
    >[];
  }
>;
export type ComponentExamplesResponse = CLIResponse<
  'component.detail.examples',
  {component: string; examples: RegistryExample[]}
>;
export type ComponentStylingResponse = CLIResponse<
  'component.detail.styling',
  {
    component: string;
    elements: Pick<RegistryElement, 'tag' | 'cssParts' | 'cssStates' | 'cssProperties'>[];
  }
>;
export type ComponentSourceResponse = CLIResponse<
  'component.detail.source',
  {component: string; folder: string; file: string; files: string[]; source: string}
>;

// ── docs ─────────────────────────────────────────────────────────────────

export interface DocsListEntry {
  topic: string;
  title: string;
  description: string;
  url: string;
  sections: number;
}

export interface DocsIndexData {
  name: string;
  title: string;
  description: string;
  sections: {id: string; title: string; summary: string}[];
}

export interface DocsDetailData {
  topic: string;
  title: string;
  description: string;
  url: string;
  sections: {id: string; title: string; body: string}[];
}

export interface DocsSectionData {
  topic: string;
  id: string;
  title: string;
  body: string;
}

export type DocsListResponse = CLIResponse<'docs.list', DocsListEntry[]>;
export type DocsIndexResponse = CLIResponse<'docs.index', DocsIndexData>;
export type DocsDetailResponse = CLIResponse<'docs.detail', DocsDetailData>;
export type DocsSectionResponse = CLIResponse<'docs.detail.section', DocsSectionData>;

// ── search ───────────────────────────────────────────────────────────────

export type {SearchData, SearchDomain, SearchResultEntry} from './search.ts';
import type {SearchData} from './search.ts';
export type SearchResponse = CLIResponse<'search', SearchData>;

// ── controllers ──────────────────────────────────────────────────────────

export type ControllerListData =
  | {detail: 'names'; controllers: Record<string, {name: string; kind: string}[]>}
  | {
      detail: 'compact';
      controllers: Record<
        string,
        {name: string; kind: string; description: string; import: string}[]
      >;
    }
  | {detail: 'full'; controllers: Record<string, RegistryController[]>};

export type ControllerListResponse = CLIResponse<'controller.list', ControllerListData>;
export type ControllerDetailResponse = CLIResponse<'controller.detail', RegistryController>;
export type ControllerMembersResponse = CLIResponse<
  'controller.detail.members',
  {name: string; members: RegistryController['members']}
>;

// ── discover ─────────────────────────────────────────────────────────────

export interface DiscoverListEntry {
  name: string;
  version?: string;
  description?: string;
  /** Every element tag of the package. */
  components: string[];
}

export type DiscoverListResponse = CLIResponse<'discover.list', DiscoverListEntry[]>;
export type DiscoverDetailResponse = CLIResponse<'discover.detail', DiscoverListEntry>;
export type DiscoverSearchResponse = CLIResponse<
  'discover.search',
  {query: string; matches: {package: string; component: string}[]}
>;

// ── doctor ───────────────────────────────────────────────────────────────

export type DoctorStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface DoctorCheck {
  /** Stable machine-readable id, e.g. `node-version`. */
  id: string;
  label: string;
  status: DoctorStatus;
  message: string;
  /** Actionable remediation, present when the status is not `pass`. */
  fix?: string;
}

export interface DoctorData {
  checks: DoctorCheck[];
  summary: Record<DoctorStatus, number>;
}

export type DoctorResponse = CLIResponse<'doctor', DoctorData>;

// ── gap-report ───────────────────────────────────────────────────────────

export type GapReportCategory =
  | 'missing_component'
  | 'missing_variant'
  | 'layout_gap'
  | 'styling_gap'
  | 'a11y_gap'
  | 'api_friction'
  | 'docs_gap'
  | 'other';

export interface GapReportDelivery {
  handlerType: 'project' | 'fallback';
  handler: string;
  audience: 'internal' | 'public' | null;
  status: 'filed' | 'routed_only' | 'failed';
  url: string | null;
  message: string | null;
}

export interface GapReportReceipt {
  status: 'filed' | 'partial' | 'failed' | 'routed_only';
  package: string;
  issuesUrl: string | null;
  deliveries: GapReportDelivery[];
  filedCount: number;
  routedOnlyCount: number;
}

export type GapReportCategoriesResponse = CLIResponse<
  'gap-report.categories',
  {value: GapReportCategory; label: string}[]
>;
export type GapReportFileResponse = CLIResponse<'gap-report.file', GapReportReceipt>;

// ── layout ───────────────────────────────────────────────────────────────

export interface LayoutIssue {
  line?: number;
  col?: number;
  message: string;
  formatted: string;
  suggestions?: string[];
}

export interface LayoutCheckData {
  valid: boolean;
  form: 'compact' | 'outline';
  errors: LayoutIssue[];
  warnings: string[];
  compact: string;
  outline: string;
}

export interface LayoutExpandData {
  form: 'compact' | 'outline';
  /** The generated markup. */
  code: string;
  elementsUsed: string[];
  imports: string[];
  todos: string[];
  warnings: string[];
  written: string | null;
}

export interface LayoutGrammarData {
  text: string;
  /** Alias -> tag, generated from the installed registry. */
  aliases: Record<string, string>;
}

export type LayoutCheckResponse = CLIResponse<'layout.check', LayoutCheckData>;
export type LayoutExpandResponse = CLIResponse<'layout.expand', LayoutExpandData>;
export type LayoutGrammarResponse = CLIResponse<'layout.grammar', LayoutGrammarData>;

// ── init / upgrade ───────────────────────────────────────────────────────

export interface InitRunData {
  mode: 'default' | 'features';
  features: string[];
  docsWritten: string[];
  docsCreated: string[];
  /** Whether the "next steps" were part of the text output (default mode). */
  nextSteps: boolean;
  dryRun?: boolean;
  /** The block that would be written (`--dry-run` only). */
  block?: string;
}

export interface InitRemoveData {
  removed: string[];
  deleted: string[];
}

export type InitRunResponse = CLIResponse<'init.run', InitRunData>;
export type InitRemoveResponse = CLIResponse<'init.remove', InitRemoveData>;

export interface UpgradeRunData {
  status: 'missing' | 'current' | 'stale' | 'edited' | 'malformed';
  libraryVersion: string;
  apply: boolean;
  /** True when no block needs attention any more. */
  complete: boolean;
  files: {
    path: string;
    state: 'current' | 'stale' | 'edited' | 'malformed';
    blockVersion: string | null;
    detail?: string;
  }[];
  applied: string[];
  skipped: {path: string; reason: string}[];
}

export type UpgradeRunResponse = CLIResponse<'upgrade.run', UpgradeRunData>;

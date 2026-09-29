/**
 * The command table. Order is the order of `tct --help`.
 */
import type {CommandSpec} from '../command.ts';
import {componentSpec} from './component.ts';
import {controllersSpec} from './controllers.ts';
import {discoverSpec} from './discover.ts';
import {docsSpec} from './docs.ts';
import {doctorSpec} from './doctor.ts';
import {gapReportSpec} from './gap-report.ts';
import {initSpec} from './init.ts';
import {layoutSpec} from './layout.ts';
import {manifestSpec} from './manifest.ts';
import {mcpSpec} from './mcp.ts';
import {searchSpec} from './search.ts';
import {upgradeSpec} from './upgrade.ts';

export const COMMANDS: readonly CommandSpec[] = [
  componentSpec,
  docsSpec,
  searchSpec,
  discoverSpec,
  controllersSpec,
  doctorSpec,
  gapReportSpec,
  layoutSpec,
  initSpec,
  upgradeSpec,
  mcpSpec,
  manifestSpec,
];

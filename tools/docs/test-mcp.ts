/**
 * `pnpm docs:mcp` (D-016): runs the node test that starts the built standalone docs server and talks to
 * its live `/mcp` route over HTTP. `TCT_REQUIRE_DOCS_BUILD=1` makes the test fail, not skip, when
 * `pnpm docs:build` has not produced the server. Set here rather than in the package.json script so the
 * command works in every shell (cmd.exe and PowerShell have no `VAR=value command` syntax).
 */
import {runPackageBin} from '../lib/run.ts';

process.exit(
  runPackageBin('vitest', ['run', '--project', 'node', 'packages/cli/src/docs-endpoint.node.test.ts'], {
    env: {TCT_REQUIRE_DOCS_BUILD: '1'},
  }).status,
);

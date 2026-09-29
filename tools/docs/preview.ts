/**
 * `pnpm preview [--no-build] [--port <n>] [--host <address>]`: builds the docs site, then serves the build
 * the way it is deployed (D-016): the prerendered pages from `apps/docs/dist/client/` and the live `/mcp`
 * route, from the standalone Node server `apps/docs/dist/server/entry.mjs`. Runs in the foreground; Ctrl+C
 * stops it. `--no-build` serves the last build as it is. Needs no browser.
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {run} from '../lib/run.ts';
import {DOCS_DIST} from '../lib/site.ts';

const {values} = parseArgs({
  options: {
    'no-build': {type: 'boolean', default: false},
    port: {type: 'string', default: process.env.PORT ?? '4321'},
    host: {type: 'string', default: process.env.HOST ?? 'localhost'},
  },
});

const entry = join(DOCS_DIST, 'server', 'entry.mjs');

if (!values['no-build']) {
  const built = run('pnpm', ['docs:build']);
  if (built.status !== 0) process.exit(built.status);
} else if (!existsSync(entry)) {
  console.error('preview: there is no build yet (apps/docs/dist/server/entry.mjs); run `pnpm preview` without --no-build.');
  process.exit(1);
}

console.log(`\npreview: http://${values.host}:${values.port}/  (the /mcp endpoint included; Ctrl+C stops it)\n`);
process.exit(run(process.execPath, [entry], {env: {PORT: values.port, HOST: values.host}}).status);

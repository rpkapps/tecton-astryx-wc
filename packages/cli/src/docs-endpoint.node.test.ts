/**
 * The live MCP endpoint of the docs site (D-016), end to end: starts the BUILT standalone server
 * (`apps/docs/dist/server/entry.mjs`, from `pnpm docs:build`) on a free port and talks to `/mcp` over real HTTP
 * with the SDK's client (`initialize`, `tools/list`, `search`, `get`, an unknown name). It also checks that the
 * card still answers `GET /mcp`, that the prerendered pages are served by the same process and that the
 * registry the route answers from is the one the site publishes.
 *
 * The build takes minutes, so this test uses the existing one rather than building: it skips when there is no
 * build (a plain `pnpm test`), and fails when `TCT_REQUIRE_DOCS_BUILD=1` (the `docs:mcp` step of `pnpm check`,
 * which runs right after `docs:build`).
 */
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {AgentRegistry} from './registry/types.ts';

const DOCS_DIST = fileURLToPath(new URL('../../../apps/docs/dist/', import.meta.url));
const ENTRY = `${DOCS_DIST}server/entry.mjs`;
const STARTUP_TIMEOUT_MS = 60_000;
const STOP_TIMEOUT_MS = 10_000;

const required = process.env.TCT_REQUIRE_DOCS_BUILD === '1';
const built = existsSync(ENTRY);
if (required && !built) {
  throw new Error(
    'docs:mcp needs the built docs site (apps/docs/dist/server/entry.mjs); run `pnpm docs:build` first.',
  );
}

/** A free TCP port on the loopback interface. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** Polls `GET /mcp` until the server answers (its "listening" log line comes before the socket is bound). */
async function waitUntilServing(
  url: string,
  child: ChildProcess,
  output: () => string,
): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`the docs server exited before it was serving:\n${output()}`);
    }
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(2000)});
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(
        `the docs server did not serve ${url} within ${STARTUP_TIMEOUT_MS} ms:\n${output()}`,
      );
    }
    await pause(100);
  }
}

/** Stops the server this test started (never a broad kill): SIGTERM, then SIGKILL if it does not exit. */
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((done) => child.once('exit', () => done()));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
  await exited;
  clearTimeout(timer);
}

/** The text of a tool result's first content block (the client types `callTool`'s result as a union). */
const text = (result: unknown): string => (result as {content: {text: string}[]}).content[0]!.text;

describe.skipIf(!built)('the docs site MCP endpoint (built standalone server)', () => {
  let child: ChildProcess;
  let base = '';
  let log = '';

  beforeAll(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [ENTRY], {
      env: {...process.env, HOST: '127.0.0.1', PORT: String(port)},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk: Buffer) => (log += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (log += chunk.toString()));
    await waitUntilServing(`${base}/mcp`, child, () => log);
  }, STARTUP_TIMEOUT_MS + 5000);

  afterAll(async () => {
    if (child) await stop(child);
  }, STOP_TIMEOUT_MS + 5000);

  it('GET /mcp is still the server card', async () => {
    const response = await fetch(`${base}/mcp`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    const card = (await response.json()) as {
      name: string;
      transport: string;
      tools: {name: string}[];
    };
    expect(card.name).toBe('tecton-wc');
    expect(card.transport).toMatch(/streamable-http/);
    expect(card.tools.map((tool) => tool.name)).toEqual(['search', 'get']);
  });

  it('answers a full MCP round trip over HTTP with the SDK client', async () => {
    const client = new Client({name: 'docs-endpoint-test', version: '1.0.0'});
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
    await client.connect(transport);
    try {
      expect(client.getServerVersion()?.name).toBe('tecton-wc');

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(['search', 'get']);

      const searched = await client.callTool({
        name: 'search',
        arguments: {query: 'dropdown menu', limit: 3},
      });
      expect(searched.isError).toBeFalsy();
      const brief = JSON.parse(text(searched)) as {name: string; import: string}[];
      expect(brief[0]?.name).toBe('tct-dropdown-menu');
      expect(brief[0]?.import).toMatch(/^import '@tecton-wc\/components\//);

      const got = await client.callTool({name: 'get', arguments: {name: brief[0]!.name}});
      expect(got.isError).toBeFalsy();
      expect(JSON.parse(text(got))).toMatchObject({name: 'tct-dropdown-menu'});

      const unknown = await client.callTool({name: 'get', arguments: {name: 'qzxjkvw'}});
      expect(unknown.isError).toBe(true);
      expect(text(unknown)).toMatch(/Use search\(\)/);
    } finally {
      await client.close();
    }
  });

  it('answers from the registry the site publishes, and an unknown tool is an error', async () => {
    const registry = JSON.parse(
      readFileSync(`${DOCS_DIST}client/agent-registry.json`, 'utf8'),
    ) as AgentRegistry;
    const published = await fetch(`${base}/agent-registry.json`);
    expect(published.status).toBe(200);
    expect(((await published.json()) as AgentRegistry).components.length).toBe(
      registry.components.length,
    );

    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {'content-type': 'application/json', accept: 'application/json, text/event-stream'},
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {name: 'nope', arguments: {}},
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {result?: {isError?: boolean}; error?: unknown};
    expect(body.result?.isError === true || body.error !== undefined).toBe(true);
  });

  it('serves the prerendered pages from the same process', async () => {
    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toMatch(/text\/html/);
    expect(await home.text()).toContain('<html');
    const llms = await fetch(`${base}/llms.txt`);
    expect(llms.status).toBe(200);
    expect(await llms.text()).toMatch(/^# /);
    expect((await fetch(`${base}/no-such-page/`)).status).toBe(404);
  });
});

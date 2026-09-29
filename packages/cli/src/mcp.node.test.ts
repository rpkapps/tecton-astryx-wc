/**
 * The MCP server: the `search` and `get` tools as pure functions, through a real SDK client over an in-memory
 * transport, over the web-standard HTTP handler (the docs-site route) and over stdio against the real `tct mcp`
 * process. All four answer identically.
 */
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {handleMcpRequest, mcpServerCard} from './mcp/http.ts';
import {createMcpServer} from './mcp/server.ts';
import {
  MAX_BRIEF_RESULT_CHARS,
  MAX_TOPIC_BRIEF_CHARS,
  callTool,
  mcpGet,
  mcpSearch,
} from './mcp/tools.ts';
import type {AgentRegistry} from './registry/types.ts';
import {Sandbox, fixtureRegistry} from './testing/fixture.ts';

const registry = fixtureRegistry();
const parse = (result: {content: {text: string}[]}): unknown => JSON.parse(result.content[0]!.text);

describe('search tool', () => {
  it('returns brief results with name, description, import, key attributes and a hint', () => {
    const results = parse(mcpSearch(registry, {query: 'button'})) as Record<string, unknown>[];
    expect(results[0]).toMatchObject({
      type: 'component',
      name: 'tct-button',
      displayName: 'Button',
      category: 'Action',
      import: "import '@tecton-wc/components/button';",
    });
    expect(results[0]?.keyAttributes).toEqual(
      expect.arrayContaining(['variant: primary|secondary|ghost|destructive', 'label: string']),
    );
    expect(results[0]?.hint).toBe('Use get("tct-button") for the full API, usage and examples.');
  });

  it('is aware of compound and related elements', () => {
    const [menu] = parse(mcpSearch(registry, {query: 'dropdown menu'})) as {
      elements?: string[];
      name: string;
    }[];
    expect(menu?.name).toBe('tct-dropdown-menu');
    expect(menu?.elements).toEqual(['tct-dropdown-menu-item']);
    const [button] = parse(mcpSearch(registry, {query: 'tct-button'})) as {
      relatedComponents?: string[];
    }[];
    expect(button?.relatedComponents).toEqual(['tct-dialog']);
  });

  it('returns controllers and docs topics in their own brief shape', () => {
    const results = parse(mcpSearch(registry, {query: 'roving tabindex'})) as Record<
      string,
      unknown
    >[];
    expect(results[0]).toMatchObject({
      type: 'controller',
      name: 'RovingTabindexController',
      kind: 'controller',
      usedBy: ['tct-button'],
    });
    const styling = (
      parse(mcpSearch(registry, {query: 'styling'})) as Record<string, unknown>[]
    ).find((entry) => entry.type === 'doc');
    expect(styling).toMatchObject({
      topic: 'styling',
      title: 'Styling',
      sections: ['Introduction', 'Design tokens', 'Parts', 'Parts and states'],
    });
  });

  it('honours limit (default 8, at most 25) and reports no results with a hint', () => {
    expect((parse(mcpSearch(registry, {query: 'stack', limit: 1})) as unknown[]).length).toBe(1);
    expect((parse(mcpSearch(registry, {query: 'stack'})) as unknown[]).length).toBeLessThanOrEqual(
      8,
    );
    const none = parse(mcpSearch(registry, {query: 'qzxjkvw'})) as {
      results: unknown[];
      hint: string;
    };
    expect(none.results).toEqual([]);
    expect(none.hint).toMatch(/No results/);
  });

  it('a blank query is an error result, not an exception', () => {
    const result = mcpSearch(registry, {query: '  '});
    expect(result.isError).toBe(true);
  });

  it('keeps every brief result within the token budget, even for a huge element', () => {
    const big = structuredClone(registry);
    const first = big.components[0]!;
    first.elements[0]!.attributes = Array.from({length: 400}, (_, index) => ({
      name: `attribute-${index}`,
      property: `attribute${index}`,
      type: 'string',
      values: Array.from({length: 30}, (__, value) => `value-${index}-${value}`),
      reflects: false,
      description: 'x'.repeat(200),
    }));
    for (const entry of parse(mcpSearch(big, {query: 'button'})) as unknown[]) {
      expect(JSON.stringify(entry).length).toBeLessThanOrEqual(MAX_BRIEF_RESULT_CHARS);
    }
  });
});

describe('get tool', () => {
  it('returns the full component: API, usage, best practices, keyboard, examples, family and related', () => {
    const button = parse(mcpGet(registry, {name: 'tct-button'})) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(button).toMatchObject({
      name: 'tct-button',
      category: 'Action',
      package: '@tecton-wc/components',
      usage: 'Button usage sentence.',
    });
    expect(button.bestPractices).toHaveLength(2);
    expect(
      button.elements[0].attributes.map((attribute: {name: string}) => attribute.name),
    ).toContain('variant');
    expect(button.elements[0].keyboard).toEqual([{keys: 'Enter, Space', action: 'activate'}]);
    expect(button.example).toMatchObject({id: 'basic', source: '<tct-button></tct-button>'});
    expect(button.moreExamples).toHaveLength(1);
    expect(button.relatedComponents).toEqual([
      {name: 'tct-dialog', description: 'Dialog dense description'},
    ]);
  });

  it('resolves a family folder or display name, and scopes a compound element with its parent', () => {
    expect((parse(mcpGet(registry, {name: 'button'})) as {name: string}).name).toBe('tct-button');
    const family = parse(mcpGet(registry, {name: 'dropdown-menu'})) as {
      groupMembers: {tag: string}[];
    };
    expect(family.groupMembers.map((member) => member.tag)).toEqual(['tct-dropdown-menu-item']);
    const item = parse(mcpGet(registry, {name: 'tct-dropdown-menu-item'})) as {
      name: string;
      parent: string;
      elements: unknown[];
    };
    expect(item).toMatchObject({name: 'tct-dropdown-menu-item', parent: 'tct-dropdown-menu'});
    expect(item.elements).toHaveLength(1);
  });

  it('returns a controller with its usage example and members', () => {
    const controller = parse(mcpGet(registry, {name: 'RovingTabindexController'})) as Record<
      string,
      unknown
    >;
    expect(controller).toMatchObject({
      name: 'RovingTabindexController',
      import:
        "import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';",
      usedBy: ['tct-button'],
    });
    expect(controller.example).toMatch(/new RovingTabindexController/);
  });

  it('returns a small topic whole, a chosen section alone, and a large topic as overview plus section list', () => {
    const small = parse(mcpGet(registry, {name: 'forms'})) as {sections: unknown[]};
    expect(small.sections).toHaveLength(1);
    const section = parse(mcpGet(registry, {name: 'styling', section: 'tokens'})) as {
      id: string;
      body: string;
    };
    expect(section.id).toBe('design-tokens');
    expect(section.body).toMatch(/Use tokens/);

    const large = structuredClone(registry);
    large.topics[0]!.sections = Array.from({length: 12}, (_, index) => ({
      heading: `Part ${index}`,
      body: 'word '.repeat(200),
    }));
    const summary = parse(mcpGet(large, {name: 'styling'})) as {
      overview: unknown;
      sections: {id: string}[];
      hint: string;
    };
    expect(JSON.stringify(summary).length).toBeLessThan(MAX_TOPIC_BRIEF_CHARS);
    expect(summary.sections).toHaveLength(12);
    expect(summary.hint).toMatch(/use get\("styling", \{section: "..."\}\)/i);
  });

  it('a missing or ambiguous section is an error listing the choices', () => {
    const missing = mcpGet(registry, {name: 'styling', section: 'nope'});
    expect(missing.isError).toBe(true);
    expect((parse(missing) as {available: unknown[]}).available).toHaveLength(4);
    const ambiguous = mcpGet(registry, {name: 'styling', section: 'part'});
    expect(ambiguous.isError).toBe(true);
    expect((parse(ambiguous) as {error: string}).error).toMatch(/more than one section/);
  });

  it('suggests near names, and an unknown name is an error result with hints', () => {
    const near = parse(mcpGet(registry, {name: 'modal'})) as {
      note: string;
      suggestions: {name: string}[];
    };
    expect(near.suggestions[0]?.name).toBe('tct-dialog');
    const unknown = mcpGet(registry, {name: 'qzxjkvw'});
    expect(unknown.isError).toBe(true);
    expect((parse(unknown) as {hint: string}).hint).toMatch(/Use search\(\)/);
    expect(mcpGet(registry, {name: ''}).isError).toBe(true);
  });

  it('an unknown tool is an error result', () => {
    expect(callTool(registry, 'nope', {}).isError).toBe(true);
    expect(parse(callTool(registry, 'get', {name: 'tct-button'}))).toHaveProperty('usage');
  });
});

describe('through the SDK (in-memory transport)', () => {
  it('lists both tools with JSON-schema inputs and answers a search then a get', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer(registry);
    const client = new Client({name: 'test-client', version: '1.0.0'});
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(['search', 'get']);
    expect(tools.tools[0]?.inputSchema).toMatchObject({type: 'object', required: ['query']});

    const searched = await client.callTool({
      name: 'search',
      arguments: {query: 'dropdown menu', limit: 3},
    });
    const brief = JSON.parse((searched.content as {text: string}[])[0]!.text) as {name: string}[];
    expect(brief[0]?.name).toBe('tct-dropdown-menu');

    const got = await client.callTool({name: 'get', arguments: {name: brief[0]!.name}});
    expect(got.isError).toBeFalsy();
    expect(JSON.parse((got.content as {text: string}[])[0]!.text)).toMatchObject({
      name: 'tct-dropdown-menu',
    });

    const failed = await client.callTool({name: 'get', arguments: {name: 'qzxjkvw'}});
    expect(failed.isError).toBe(true);
    await client.close();
    await server.close();
  });
});

describe('over HTTP (the docs-site route)', () => {
  const post = (body: unknown, registryOverride: AgentRegistry = registry) =>
    handleMcpRequest(
      registryOverride,
      new Request('http://docs.local/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
      }),
    );

  it('answers initialize, tools/list and tools/call as JSON, statelessly', async () => {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {name: 'curl', version: '1'},
      },
    });
    expect(init.status).toBe(200);
    expect(init.headers.get('content-type')).toMatch(/application\/json/);
    const initBody = (await init.json()) as {
      result: {serverInfo: {name: string}; capabilities: {tools: unknown}};
    };
    expect(initBody.result.serverInfo.name).toBe('tecton-wc');
    expect(initBody.result.capabilities.tools).toBeDefined();

    const list = await post({jsonrpc: '2.0', id: 2, method: 'tools/list'});
    const listBody = (await list.json()) as {result: {tools: {name: string}[]}};
    expect(listBody.result.tools.map((tool) => tool.name)).toEqual(['search', 'get']);

    const call = await post({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {name: 'search', arguments: {query: 'button'}},
    });
    const callBody = (await call.json()) as {result: {content: {text: string}[]}};
    expect((JSON.parse(callBody.result.content[0]!.text) as {name: string}[])[0]?.name).toBe(
      'tct-button',
    );
  });

  it('serves the same answer as the in-process tool', async () => {
    const call = await post({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {name: 'get', arguments: {name: 'tct-button'}},
    });
    const body = (await call.json()) as {result: {content: {text: string}[]}};
    expect(body.result.content[0]!.text).toBe(
      mcpGet(registry, {name: 'tct-button'}).content[0]!.text,
    );
  });

  it('describes itself on GET and refuses other methods', async () => {
    const card = await handleMcpRequest(registry, new Request('http://docs.local/mcp'));
    expect(
      ((await card.json()) as {tools: {name: string}[]}).tools.map((tool) => tool.name),
    ).toEqual(['search', 'get']);
    expect(((await mcpServerCard().json()) as {name: string}).name).toBe('tecton-wc');
    // A static host cannot take a POST: its card points at the stdio server instead.
    const staticCard = (await mcpServerCard({remote: false}).json()) as {
      transport: string;
      usage: string;
    };
    expect(staticCard.transport).toBe('stdio');
    expect(staticCard.usage).toMatch(/npx --no-install tct mcp/);
    const deleted = await handleMcpRequest(
      registry,
      new Request('http://docs.local/mcp', {method: 'DELETE'}),
    );
    expect(deleted.status).toBe(405);
  });

  it('rejects a malformed body without throwing', async () => {
    const response = await handleMcpRequest(
      registry,
      new Request('http://docs.local/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: '{not json',
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe('over stdio (tct mcp)', () => {
  let sandbox: Sandbox;
  beforeAll(() => {
    sandbox = new Sandbox();
  });
  afterAll(() => {
    sandbox.dispose();
  });

  it('round-trips search and get against the real process', async () => {
    const bin = fileURLToPath(new URL('../bin/tct.js', import.meta.url));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin, 'mcp'],
      cwd: sandbox.cwd,
      env: {...(process.env as Record<string, string>), TCT_AGENT_REGISTRY: sandbox.registryPath},
    });
    const client = new Client({name: 'stdio-test', version: '1.0.0'});
    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(['search', 'get']);
      const searched = await client.callTool({name: 'search', arguments: {query: 'modal'}});
      const results = JSON.parse((searched.content as {text: string}[])[0]!.text) as {
        name: string;
      }[];
      expect(results.map((result) => result.name)).toContain('tct-dialog');
      const got = await client.callTool({name: 'get', arguments: {name: 'tct-dialog'}});
      expect((JSON.parse((got.content as {text: string}[])[0]!.text) as {name: string}).name).toBe(
        'tct-dialog',
      );
    } finally {
      await client.close();
    }
  }, 30_000);

  it('a missing registry is a normal error before the protocol takes over stdout', async () => {
    const {execute} = await import('./index.ts');
    const result = await execute(['mcp'], {
      cwd: sandbox.cwd,
      env: {TCT_AGENT_REGISTRY: '/nonexistent.json'},
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/Registry file not found/);
  });
});

/**
 * The MCP server as a web-standard request handler (`Request` in, `Response` out), for a route of the docs
 * site or any fetch-style host. Stateless: every POST gets a fresh server and transport, answers as JSON (no
 * SSE stream) and shares nothing, so it runs on any runtime and needs no session storage.
 *
 * ```ts
 * import {handleMcpRequest} from '@tecton-wc/cli/mcp/http.js';
 * export const POST = ({request}) => handleMcpRequest(registry, request);
 * ```
 */
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type {AgentRegistry} from '../registry/types.ts';
import {VERSION} from '../version.ts';
import {createMcpServer} from './server.ts';
import {GET_TOOL, MCP_SERVER_NAME, SEARCH_TOOL} from './tools.ts';

const JSON_HEADERS = {'content-type': 'application/json'} as const;

/** A JSON-RPC error body with an HTTP status (the transport builds its own for well-formed requests). */
function rpcError(
  status: number,
  code: number,
  message: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({jsonrpc: '2.0', error: {code, message}, id: null}), {
    status,
    headers: {...JSON_HEADERS, ...extra},
  });
}

/** What a browser or `curl` sees at the endpoint: which tools it serves and how to call them. */
export function mcpServerCard(): Response {
  return new Response(
    JSON.stringify(
      {
        name: MCP_SERVER_NAME,
        version: VERSION,
        transport: 'streamable-http (stateless, JSON responses)',
        usage: 'POST JSON-RPC 2.0 messages to this URL (initialize, tools/list, tools/call).',
        tools: [SEARCH_TOOL, GET_TOOL].map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      },
      null,
      2,
    ),
    {headers: JSON_HEADERS},
  );
}

export async function handleMcpRequest(
  registry: AgentRegistry,
  request: Request,
): Promise<Response> {
  if (request.method === 'GET') return mcpServerCard();
  if (request.method !== 'POST') {
    // Stateless server: no SSE stream to open (GET) and no session to close (DELETE).
    return rpcError(405, -32000, 'Method not allowed: this server accepts POST only.', {
      allow: 'GET, POST',
    });
  }
  const server = createMcpServer(registry);
  const transport = new WebStandardStreamableHTTPServerTransport({enableJsonResponse: true});
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // The response body is already materialised (JSON mode): safe to tear down.
    await server.close().catch(() => undefined);
  }
}

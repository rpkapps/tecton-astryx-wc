/**
 * The MCP server: `search(query)` and `get(name)` over the agent registry, using the official SDK
 * (`@modelcontextprotocol/sdk`, approved for this package only: D-013 Q-07). The low-level `Server` is used so
 * the tool schemas are plain JSON Schema and no schema library has to be a dependency of this package.
 *
 * `createMcpServer` is transport-agnostic; `serveStdio` backs `tct mcp` and `handleMcpRequest` (in
 * `./http.ts`) backs the docs-site route.
 */
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import type {AgentRegistry} from '../registry/types.ts';
import {VERSION} from '../version.ts';
import {GET_TOOL, MCP_SERVER_NAME, SEARCH_TOOL, callTool} from './tools.ts';

const INSTRUCTIONS =
  'Search and read the Tecton Web Components docs before writing UI: search(query) finds elements, controllers ' +
  'and guides; get(name) returns the full API, usage and examples. Never invent attributes, slots or events.';

export function createMcpServer(registry: AgentRegistry): Server {
  const server = new Server(
    {name: MCP_SERVER_NAME, version: VERSION},
    {capabilities: {tools: {}}, instructions: INSTRUCTIONS},
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({tools: [SEARCH_TOOL, GET_TOOL]}));
  server.setRequestHandler(CallToolRequestSchema, (request): CallToolResult =>
    callTool(registry, request.params.name, request.params.arguments),
  );
  return server;
}

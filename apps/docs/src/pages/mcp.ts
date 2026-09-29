/**
 * The MCP endpoint of the docs site (D-016), the only route rendered on demand: the rest of the site is
 * prerendered static files.
 *
 *  - `GET /mcp` is the server card: which tools it serves (`search(query)` and `get(name)`) and how to
 *    connect, over HTTP here or over stdio with `tct mcp`.
 *  - `POST /mcp` is MCP JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`), answered by the CLI's own
 *    stateless handler over the registry the site already publishes, so an agent gets the same answer as from
 *    `tct mcp`.
 *
 * Only a Node process (`node dist/server/entry.mjs`, the adapter's standalone server) can answer a POST; a
 * static host serves the pages and the card is not reachable there. See the "Working with AI" guide.
 *
 * The handler is imported from the CLI package source (the docs app does not depend on the CLI package).
 */
import type {APIRoute} from 'astro';
import registry from '../../public/agent-registry.json';
import {handleMcpRequest} from '../../../../packages/cli/src/mcp/http.ts';
import type {AgentRegistry} from '../../../../packages/cli/src/registry/types.ts';

export const prerender = false;

export const ALL: APIRoute = ({request}) => handleMcpRequest(registry as unknown as AgentRegistry, request);

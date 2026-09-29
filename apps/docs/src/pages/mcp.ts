/**
 * The MCP endpoint of the docs site: `GET /mcp` is a server card naming the two tools (`search(query)` and
 * `get(name)`) and how to run the same server locally (`tct mcp`, stdio, offline).
 *
 * The site is static (no server adapter, D-007), and a static host cannot answer the POST an HTTP MCP client
 * sends, so the card is prerendered. A deployment that renders on demand serves the same tools over HTTP
 * with the CLI's own handler, over the registry the site already publishes:
 *
 * ```ts
 * // src/pages/mcp.ts of a site with an adapter, `export const prerender = false`
 * import {handleMcpRequest} from '@tecton-wc/cli/mcp/http.js';
 * import registry from '../../public/agent-registry.json';
 * export const ALL = ({request}) => handleMcpRequest(registry, request);
 * ```
 *
 * The handler is imported lazily so the static build does not bundle the MCP SDK.
 */
import type {APIRoute} from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const {mcpServerCard} = await import('../../../../packages/cli/src/mcp/http.ts');
  return mcpServerCard({remote: false});
};

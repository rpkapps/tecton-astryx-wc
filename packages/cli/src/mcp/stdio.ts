/**
 * `tct mcp`: the MCP server over stdio. Resolves when the client closes the connection (stdin ends).
 * Nothing but protocol messages may reach stdout, so all diagnostics go to stderr.
 */
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import type {AgentRegistry} from '../registry/types.ts';
import {createMcpServer} from './server.ts';

export async function serveStdio(registry: AgentRegistry): Promise<void> {
  const server = createMcpServer(registry);
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    transport.onclose = resolve;
    process.stdin.once('end', resolve);
    process.stdin.once('close', resolve);
  });
  await server.connect(transport);
  await closed;
  await server.close().catch(() => undefined);
}

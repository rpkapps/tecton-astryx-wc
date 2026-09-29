/**
 * `tct mcp`: starts the MCP server over stdio.
 */
import type {CommandSpec, Outcome} from '../command.ts';
import {serveStdio} from '../mcp/stdio.ts';

export const mcpSpec: CommandSpec = {
  name: 'mcp',
  summary: 'Start the MCP server over stdio (search and get)',
  description:
    'Runs a Model Context Protocol server that any MCP-compatible AI tool can connect to. It exposes two tools: ' +
    'search(query) finds elements, controllers and guides with a ranked keyword index and returns brief results; ' +
    'get(name) returns the full API, usage and examples of one element, controller or topic. It answers from the ' +
    'same agent registry as the other commands. Configure your tool with {"command": "npx", "args": ["--no-install", ' +
    '"tct", "mcp"]}. --json is not supported: stdout carries only protocol messages.',
  args: [],
  options: [],
  examples: [{label: 'Start the server', cli: 'tct mcp'}],
  exitCodes: [
    {code: 0, when: 'the client closed the connection'},
    {code: 1, when: 'the registry cannot be found or the server cannot start'},
  ],
  responseTypes: [],
  json: false,
  related: ['search', 'component', 'docs'],
  run: async (context): Promise<Outcome> => {
    // Load first: a missing registry is a normal error before the protocol takes over stdout.
    const {registry} = context.registry();
    await serveStdio(registry);
    return {type: 'mcp', data: null, text: ''};
  },
};

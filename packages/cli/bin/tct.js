#!/usr/bin/env node
// Launcher: a Node version gate that uses only built-ins, then the built CLI (dist) or, inside the
// workspace before a build, the TypeScript source (Node runs it directly through type stripping).
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  const message = `tct needs Node.js >= 22.18.0; this is v${process.versions.node}.`;
  if (process.argv.slice(2).includes('--json')) {
    console.log(JSON.stringify({apiVersion: 1, error: message, code: 'ERR_NODE_VERSION'}, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
}

const built = new URL('../dist/bin.js', import.meta.url);
const entry = existsSync(fileURLToPath(built)) ? built : new URL('../src/bin.ts', import.meta.url);
await import(entry.href);

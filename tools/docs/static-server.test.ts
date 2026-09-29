import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {resolveFile, serve, type StaticServer} from './static-server.ts';

let root: string;
let server: StaticServer;
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'tct-static-'));
  mkdirSync(join(root, 'a'));
  writeFileSync(join(root, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(root, 'a', 'index.html'), '<h1>a</h1>');
  writeFileSync(join(root, '404.html'), '<h1>missing</h1>');
  writeFileSync(join(root, 'llms.txt'), 'text');
  writeFileSync(join(tmpdir(), 'tct-outside.txt'), 'secret');
  server = await serve(root);
});
afterAll(async () => {
  await server.close();
  rmSync(root, {recursive: true, force: true});
});

describe('static docs server', () => {
  it('resolves clean URLs and assets, and refuses paths outside the root', () => {
    expect(resolveFile(root, '/')).toBe(join(root, 'index.html'));
    expect(resolveFile(root, '/a/')).toBe(join(root, 'a', 'index.html'));
    expect(resolveFile(root, '/a')).toBe(join(root, 'a', 'index.html'));
    expect(resolveFile(root, '/llms.txt')).toBe(join(root, 'llms.txt'));
    expect(resolveFile(root, '/../tct-outside.txt')).toBeUndefined();
    expect(resolveFile(root, '/%2e%2e/tct-outside.txt')).toBeUndefined();
    expect(resolveFile(root, '/nope/')).toBeUndefined();
  });

  it('serves pages, and 404.html with a 404 status', async () => {
    const home = await fetch(`${server.url}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    const missing = await fetch(`${server.url}/nothing/`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('missing');
  });
});

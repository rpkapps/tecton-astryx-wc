/**
 * A tiny static file server for the built docs site (`apps/docs/dist`), used by the accessibility
 * crawl and the screenshot script. Serves clean URLs (`/a/b/` -> `a/b/index.html`), the right
 * content types (Pagefind needs `application/wasm`) and `404.html` with a 404 status. Only serves
 * files under the directory it was given.
 */
import {existsSync, readFileSync, statSync} from 'node:fs';
import {createServer, type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {extname, join, normalize, resolve, sep} from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml',
};

export interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

/** Resolves a request path to a file inside `root`, or undefined. */
export function resolveFile(root: string, urlPath: string): string | undefined {
  let path: string;
  try {
    path = decodeURIComponent(urlPath.split('?')[0]!.split('#')[0]!);
  } catch {
    return undefined;
  }
  const base = resolve(root);
  const candidate = resolve(base, `.${normalize(path)}`);
  if (candidate !== base && !candidate.startsWith(base + sep)) return undefined;
  for (const file of [candidate, join(candidate, 'index.html'), `${candidate}.html`]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

export function serve(root: string, port = 0): Promise<StaticServer> {
  const server: Server = createServer((request, response) => {
    const file = resolveFile(root, request.url ?? '/');
    const notFound = join(root, '404.html');
    const target = file ?? (existsSync(notFound) ? notFound : undefined);
    if (!target) {
      response.writeHead(404, {'content-type': 'text/plain'}).end('Not found');
      return;
    }
    response
      .writeHead(file ? 200 : 404, {'content-type': TYPES[extname(target)] ?? 'application/octet-stream'})
      .end(readFileSync(target));
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const {port: actual} = server.address() as AddressInfo;
      resolvePromise({
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

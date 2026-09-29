/**
 * Process entry of `tct`: wires the real stdio and working directory to `run` and sets the exit code
 * (`process.exitCode`, not `process.exit`, so pending output is flushed).
 */
import {run} from './cli.ts';
import type {Io} from './command.ts';

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

const io: Io = {
  cwd: process.cwd(),
  env: process.env,
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
  ...(process.stdin.isTTY ? {} : {readStdin: () => readAll(process.stdin)}),
};

// A throw that escapes `run` must still honour the --json contract: one envelope, exit 1.
const fatal = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.slice(2).includes('--json')) {
    console.log(JSON.stringify({apiVersion: 1, error: message, code: 'ERR_UNKNOWN'}, null, 2));
  } else {
    console.error(error instanceof Error ? (error.stack ?? message) : message);
  }
  process.exitCode = 1;
};
process.on('unhandledRejection', fatal);
process.on('uncaughtException', fatal);

process.exitCode = await run(process.argv.slice(2), io);

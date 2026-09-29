/** Smoke test proving the Vitest node project runs (A§15.1). */
import {describe, expect, it} from 'vitest';

describe('node project', () => {
  it('runs in Node without a DOM', () => {
    expect(typeof process.versions.node).toBe('string');
    expect(typeof (globalThis as {document?: unknown}).document).toBe('undefined');
  });

  it('runs Node 22 with type stripping (tools are executed as .ts)', () => {
    expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(22);
  });
});

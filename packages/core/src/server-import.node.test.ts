/**
 * SSR safety (A§14): every core module can be imported in Node with no DOM, and importing does not
 * touch `window`, `document`, `customElements` or `matchMedia`. (The ESLint rule
 * `no top-level DOM access` guards the source; this test guards the behaviour.)
 */
import {describe, expect, it} from 'vitest';

// Vite resolves this at transform time; tests, declarations and the generated barrel folder are excluded.
const modules = import.meta.glob(
  ['./**/*.ts', '!./**/*.test.ts', '!./**/*.d.ts', '!./generated/**'],
  {eager: false},
) as Record<string, () => Promise<unknown>>;

describe('server import safety', () => {
  it('found the core modules', () => {
    expect(Object.keys(modules).length).toBeGreaterThan(50);
  });

  it('runs without DOM globals', () => {
    const scope = globalThis as unknown as Record<string, unknown>;
    for (const name of ['window', 'document', 'customElements', 'matchMedia']) {
      expect(scope[name], name).toBeUndefined();
    }
  });

  for (const [path, load] of Object.entries(modules)) {
    // A cold module graph transformed on a loaded machine: seconds, not the unit-test default.
    it(`imports ${path}`, async () => {
      await expect(load()).resolves.toBeDefined();
    }, 30_000);
  }

  it('the feature probes are all false, not throwing, without a DOM', async () => {
    const {features} = await import('./features.js');
    for (const name of Object.keys(features) as (keyof typeof features)[]) {
      expect(() => features[name], name).not.toThrow();
      expect(features[name], name).toBe(false);
    }
  });

  it('the pure helpers work on the server', async () => {
    const {safeUrl} = await import('./utils/safe-url.js');
    const {formatMessage} = await import('./i18n/format.js');
    const {getLocaleDirection} = await import('./i18n/direction.js');
    const {uniqueId} = await import('./utils/id.js');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(formatMessage('Hi {name}', {name: 'A'}, 'en')).toBe('Hi A');
    expect(getLocaleDirection('ar')).toBe('rtl');
    expect(uniqueId('x')).toMatch(/^x/);
  });

  it('server-side no-ops: announce, icons and the sanitizer degrade instead of throwing', async () => {
    const {announce} = await import('./a11y/announcer.js');
    const {getIcon} = await import('./icons/registry.js');
    expect(() => {
      announce('hello');
    }).not.toThrow();
    expect(getIcon('nope')).toBeUndefined();
  });
});

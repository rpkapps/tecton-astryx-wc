/**
 * Test support: builds a throwaway repository-shaped tree from the sample component fixture
 * (`tools/fixtures/sample-components/`) plus the real core sources the analyzer needs
 * (`tct-element.ts`, `mixins/`, `events/`), so generators can be exercised without touching the real
 * component folders. Pipeline behaviour is tested against this tree; the real components light up the
 * same code paths with no edits.
 */
import {cpSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PATHS, ROOT} from '../lib/paths.ts';
import type {AnalyzeRoots} from './analyze.ts';

export const SAMPLE_FIXTURES = join(ROOT, 'tools/fixtures/sample-components');

export interface FixtureTree extends AnalyzeRoots {
  dispose: () => void;
}

/** `<tmp>/packages/components/src/<fixture folders>` and `<tmp>/packages/core/src/{tct-element,mixins,events}`. */
export function createFixtureTree(): FixtureTree {
  const root = mkdtempSync(join(tmpdir(), 'tct-fixture-'));
  const componentsSrc = join(root, 'packages/components/src');
  const coreSrc = join(root, 'packages/core/src');
  mkdirSync(componentsSrc, {recursive: true});
  mkdirSync(coreSrc, {recursive: true});
  cpSync(SAMPLE_FIXTURES, componentsSrc, {recursive: true});
  cpSync(join(PATHS.coreSrc, 'tct-element.ts'), join(coreSrc, 'tct-element.ts'));
  cpSync(join(PATHS.coreSrc, 'mixins'), join(coreSrc, 'mixins'), {recursive: true});
  cpSync(join(PATHS.coreSrc, 'events'), join(coreSrc, 'events'), {recursive: true});
  return {
    root,
    componentsSrc,
    coreSrc,
    dispose: () => rmSync(root, {recursive: true, force: true}),
  };
}

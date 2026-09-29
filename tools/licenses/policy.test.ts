import {describe, expect, it} from 'vitest';
import {evaluateLicenses, isExpressionAllowed} from './policy.ts';

describe('isExpressionAllowed', () => {
  it('accepts allowlisted ids', () => {
    for (const id of [
      'MIT',
      'BSD-2-Clause',
      'BSD-3-Clause',
      'Apache-2.0',
      'ISC',
      '0BSD',
      'OFL-1.1',
      'mit',
    ]) {
      expect(isExpressionAllowed(id)).toBe(true);
    }
  });
  it('rejects everything else, including copyleft, MIT-0 and unknown ids', () => {
    for (const id of [
      'GPL-3.0',
      'LGPL-3.0-or-later',
      'MPL-2.0',
      'MIT-0',
      'BlueOak-1.0.0',
      'Unknown',
      'UNLICENSED',
      '',
    ]) {
      expect(isExpressionAllowed(id)).toBe(false);
    }
  });
  it('evaluates OR / AND / parentheses / WITH', () => {
    expect(isExpressionAllowed('(MPL-2.0 OR Apache-2.0)')).toBe(true);
    expect(isExpressionAllowed('MIT AND ISC')).toBe(true);
    expect(isExpressionAllowed('MIT AND GPL-3.0')).toBe(false);
    expect(isExpressionAllowed('GPL-3.0 OR (MIT AND MPL-2.0)')).toBe(false);
    expect(isExpressionAllowed('GPL-3.0 OR (MIT AND ISC)')).toBe(true);
    expect(isExpressionAllowed('Apache-2.0 WITH LLVM-exception')).toBe(false);
    expect(isExpressionAllowed('MIT+')).toBe(false);
  });
});

describe('evaluateLicenses', () => {
  const pkg = (name: string, license: string) => ({name, versions: ['1.0.0'], license});
  const none = new Set<string>();

  it('passes allowed licences silently', () => {
    expect(evaluateLicenses({all: [pkg('a', 'MIT'), pkg('b', 'ISC')], shippedNames: none})).toEqual(
      [],
    );
  });

  it('fails licences outside the allowlist', () => {
    const findings = evaluateLicenses({
      all: [pkg('evil', 'GPL-3.0-only'), pkg('none', '')],
      shippedNames: none,
    });
    expect(findings.map((f) => f.level)).toEqual(['error', 'error']);
    expect(findings[0]!.message).toContain('GPL-3.0-only');
    expect(findings[1]!.message).toContain('declares no licence');
  });

  it('accepts the dompurify election, in the shipped tree too', () => {
    const dompurify = pkg('dompurify', '(MPL-2.0 OR Apache-2.0)');
    expect(evaluateLicenses({all: [dompurify], shippedNames: new Set(['dompurify'])})).toEqual([]);
  });

  it('tolerates axe-core only outside the shipped tree', () => {
    const axe = pkg('axe-core', 'MPL-2.0');
    expect(evaluateLicenses({all: [axe], shippedNames: none})).toEqual([]);
    const leaked = evaluateLicenses({all: [axe], shippedNames: new Set(['axe-core'])});
    expect(leaked).toHaveLength(1);
    expect(leaked[0]).toMatchObject({level: 'error'});
  });

  it('requires an exception to match the recorded licence exactly and warns for pending reviews', () => {
    expect(
      evaluateLicenses({all: [pkg('axe-core', 'GPL-3.0')], shippedNames: none})[0],
    ).toMatchObject({level: 'error'});
    const pending = evaluateLicenses({all: [pkg('sax', 'BlueOak-1.0.0')], shippedNames: none});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({level: 'warning'});
    expect(pending[0]!.message).toContain('PENDING OWNER REVIEW');
  });
});

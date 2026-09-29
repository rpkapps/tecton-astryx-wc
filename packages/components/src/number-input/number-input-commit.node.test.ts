// Adapted from the upstream design system (MIT); see THIRD-PARTY-NOTICES.md.

import {describe, expect, it} from 'vitest';
import {parseNumberInput, resolveNumberInputCommit} from './number-input-commit.js';

describe('parseNumberInput', () => {
  it('validates the complete localized draft', () => {
    expect(parseNumberInput('1.234.567', {locale: 'de-DE'})).toBe(1234567);
    expect(parseNumberInput('1·234·567', {locale: 'de-DE'})).toBeNull();
  });
});

describe('resolveNumberInputCommit', () => {
  it('commits one valid localized draft', () => {
    expect(
      resolveNumberInputCommit('1.234.567', {
        locale: 'de-DE',
        clearable: false,
      }),
    ).toEqual({
      type: 'commit',
      value: 1234567,
      didClamp: false,
    });
  });

  it('reverts the whole draft when parsing fails', () => {
    expect(
      resolveNumberInputCommit('1·234·567', {
        locale: 'en-US',
        clearable: false,
      }),
    ).toEqual({type: 'revert'});
  });

  it('clamps an out-of-range draft and requests normalization', () => {
    expect(
      resolveNumberInputCommit('100', {
        min: 1,
        max: 2,
        integerOnly: true,
        clearable: false,
      }),
    ).toEqual({type: 'commit', value: 2, didClamp: true});
  });

  it('distinguishes a clearable empty draft from a revert', () => {
    expect(resolveNumberInputCommit('', {clearable: true})).toEqual({
      type: 'clear',
    });
    expect(resolveNumberInputCommit('', {clearable: false})).toEqual({
      type: 'revert',
    });
  });

  it('reverts when no value can satisfy the bounds', () => {
    expect(
      resolveNumberInputCommit('10', {
        min: 5,
        max: 2,
        clearable: false,
      }),
    ).toEqual({type: 'revert'});
  });
});

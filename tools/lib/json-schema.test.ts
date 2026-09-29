import {describe, expect, it} from 'vitest';
import {validateJson, type Schema} from './json-schema.ts';

const schema: Schema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: {type: 'string', pattern: '^[a-z]+$', minLength: 2},
    n: {type: ['integer', 'null'], minimum: 0},
    kind: {enum: ['a', 'b']},
    list: {type: 'array', minItems: 1, items: {$ref: '#/$defs/row'}},
    map: {type: 'object', propertyNames: {pattern: '^k'}, additionalProperties: {type: 'boolean'}},
  },
  $defs: {
    row: {
      type: 'object',
      required: ['as'],
      properties: {
        as: {type: 'string'},
        target: {type: 'string'},
        reason: {type: 'string', minLength: 1},
      },
      allOf: [
        {
          if: {properties: {as: {const: 'waived'}}, required: ['as']},
          then: {required: ['reason']},
          else: {required: ['target']},
        },
      ],
    },
  },
};

const messages = (value: unknown) =>
  validateJson(value, schema).map((e) => `${e.path} ${e.message}`);

describe('validateJson', () => {
  it('accepts a valid document', () => {
    expect(
      messages({
        name: 'ab',
        n: null,
        kind: 'a',
        list: [
          {as: 'x', target: 't'},
          {as: 'waived', reason: 'r'},
        ],
        map: {k1: true},
      }),
    ).toEqual([]);
  });

  it('reports required, type, pattern, enum, minimum and unknown properties with paths', () => {
    expect(messages({})).toEqual(['/name is required']);
    expect(messages({name: 'A', n: -1, kind: 'z', extra: 1}).sort()).toEqual(
      [
        '/extra is not an allowed property',
        '/kind must be one of "a", "b"',
        '/n must be >= 0',
        '/name must be at least 2 characters',
        '/name must match /^[a-z]+$/',
      ].sort(),
    );
    expect(messages({name: 5})).toEqual(['/name must be string (got integer)']);
    expect(messages({name: 'ab', n: 1.5})).toEqual(['/n must be integer or null (got number)']);
  });

  it('resolves $ref, items, minItems and if/then/else', () => {
    expect(messages({name: 'ab', list: []})).toEqual(['/list must have at least 1 items']);
    expect(messages({name: 'ab', list: [{as: 'waived'}]})).toEqual(['/list/0/reason is required']);
    expect(messages({name: 'ab', list: [{as: 'attribute'}]})).toEqual([
      '/list/0/target is required',
    ]);
  });

  it('validates property names and additionalProperties schemas', () => {
    expect(messages({name: 'ab', map: {bad: true}})).toEqual([
      '/map/bad property name must match /^k/',
    ]);
    expect(messages({name: 'ab', map: {k1: 'x'}})).toEqual([
      '/map/k1 must be boolean (got string)',
    ]);
  });
});

/**
 * A deliberately small JSON Schema validator (draft 2020-12 subset) so `tools/schemas/*.schema.json`
 * stays the single source of truth without adding a dependency (D-007). Supported keywords:
 * `$ref` (local `#/$defs/...`), `type`, `enum`, `const`, `properties`, `required`,
 * `additionalProperties` (boolean | schema), `propertyNames.pattern`, `items`, `minItems`, `pattern`,
 * `minLength`, `minimum`, `allOf`, `anyOf`, `oneOf`, `if`/`then`/`else`, `not`.
 * Unknown keywords are ignored (annotations such as `description`, `$comment`, `title`, `$schema`).
 */
export type Schema = Record<string, unknown>;

export interface ValidationError {
  /** JSON pointer-like location, e.g. `/entries/core.button/api/3/as`. */
  path: string;
  message: string;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value);
  return actual === expected || (expected === 'number' && actual === 'integer');
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolveRef(ref: string, root: Schema): Schema {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref "${ref}" (only local refs)`);
  let node: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    node = (node as Record<string, unknown> | undefined)?.[
      part.replace(/~1/g, '/').replace(/~0/g, '~')
    ];
  }
  if (typeof node !== 'object' || node === null) throw new Error(`Unresolvable $ref "${ref}"`);
  return node as Schema;
}

function validateNode(
  value: unknown,
  schema: Schema | boolean,
  root: Schema,
  path: string,
  errors: ValidationError[],
): void {
  if (schema === true) return;
  if (schema === false) {
    errors.push({path, message: 'is not allowed'});
    return;
  }
  const fail = (message: string) => errors.push({path, message});

  if (typeof schema.$ref === 'string') {
    validateNode(value, resolveRef(schema.$ref, root), root, path, errors);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((type) => matchesType(value, type))) {
      fail(`must be ${types.join(' or ')} (got ${typeOf(value)})`);
      return; // further keyword checks would only produce noise
    }
  }
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    fail(`must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((option) => deepEqual(option, value))) {
    fail(`must be one of ${schema.enum.map((option) => JSON.stringify(option)).join(', ')}`);
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      fail(`must be at least ${schema.minLength} characters`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
      fail(`must match /${schema.pattern}/`);
    }
  }
  if (typeof value === 'number' && typeof schema.minimum === 'number' && value < schema.minimum) {
    fail(`must be >= ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      fail(`must have at least ${schema.minItems} items`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) =>
        validateNode(item, schema.items as Schema | boolean, root, `${path}/${index}`, errors),
      );
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in record)) errors.push({path: `${path}/${key}`, message: 'is required'});
    }
    const properties = (schema.properties as Record<string, Schema | boolean> | undefined) ?? {};
    const namePattern = (schema.propertyNames as {pattern?: string} | undefined)?.pattern;
    for (const [key, child] of Object.entries(record)) {
      if (namePattern && !new RegExp(namePattern, 'u').test(key)) {
        errors.push({path: `${path}/${key}`, message: `property name must match /${namePattern}/`});
      }
      if (key in properties) {
        validateNode(child, properties[key]!, root, `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({path: `${path}/${key}`, message: 'is not an allowed property'});
      } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties) {
        validateNode(child, schema.additionalProperties as Schema, root, `${path}/${key}`, errors);
      }
    }
  }

  for (const sub of (schema.allOf as Schema[] | undefined) ?? [])
    validateNode(value, sub, root, path, errors);
  if (
    Array.isArray(schema.anyOf) &&
    !schema.anyOf.some((sub) => isValid(value, sub as Schema, root))
  ) {
    fail('must match at least one of the allowed shapes');
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((sub) => isValid(value, sub as Schema, root)).length;
    if (matches !== 1) fail(`must match exactly one of the allowed shapes (matched ${matches})`);
  }
  if (schema.not !== undefined && isValid(value, schema.not as Schema, root))
    fail('must not match the excluded shape');
  if (schema.if !== undefined) {
    const branch = isValid(value, schema.if as Schema, root) ? schema.then : schema.else;
    if (branch !== undefined) validateNode(value, branch as Schema | boolean, root, path, errors);
  }
}

function isValid(value: unknown, schema: Schema, root: Schema): boolean {
  const errors: ValidationError[] = [];
  validateNode(value, schema, root, '', errors);
  return errors.length === 0;
}

export function validateJson(value: unknown, schema: Schema): ValidationError[] {
  const errors: ValidationError[] = [];
  validateNode(value, schema, schema, '', errors);
  return errors;
}

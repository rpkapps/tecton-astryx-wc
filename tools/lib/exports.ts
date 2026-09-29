/**
 * Minimal export scanner for the barrel generators. It reads TypeScript source as text (tools never
 * import package source) and understands the declaration forms our conventions allow. Anything it
 * cannot resolve statically (`export *`) is reported instead of guessed.
 */

export interface ScannedExports {
  /** Exported runtime names (classes, functions, consts, enums). */
  values: string[];
  /** Exported type-only names (interfaces, type aliases, `export type {…}`). */
  types: string[];
  /** True when the file contains `export * from` (cannot be re-exported by name). */
  hasExportStar: boolean;
  /** True when the file has a default export (ignored by barrels). */
  hasDefault: boolean;
}

/** Removes comments while keeping string and template literal contents intact. */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const start = i;
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      out += source.slice(start, i);
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const DECLARATION =
  /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(class|function\*?|const\s+enum|enum|const|let|var|interface|type)\s+([A-Za-z_$][\w$]*)/gm;
const NAMED_LIST = /^\s*export\s+(type\s+)?\{([^}]*)\}(\s*from\s*['"][^'"]+['"])?/gm;

export function scanExports(source: string): ScannedExports {
  const text = stripComments(source);
  const values = new Set<string>();
  const types = new Set<string>();

  for (const match of text.matchAll(DECLARATION)) {
    const kind = match[1]!;
    const name = match[2]!;
    (kind === 'interface' || kind === 'type' ? types : values).add(name);
  }

  for (const match of text.matchAll(NAMED_LIST)) {
    const allTypes = Boolean(match[1]);
    for (const raw of match[2]!.split(',')) {
      const item = raw.trim();
      if (!item) continue;
      const isType = allTypes || /^type\s+/.test(item);
      const cleaned = item.replace(/^type\s+/, '');
      const name = cleaned
        .split(/\s+as\s+/)
        .pop()!
        .trim();
      if (name === 'default') continue;
      (isType ? types : values).add(name);
    }
  }

  return {
    values: [...values].sort(),
    types: [...types].sort(),
    hasExportStar: /^\s*export\s*\*/m.test(text),
    hasDefault: /^\s*export\s+default\b/m.test(text),
  };
}

/** `static override readonly tagName = 'tct-button'` -> `tct-button` (undefined when absent). */
export function scanTagName(source: string): string | undefined {
  const text = stripComments(source);
  const match =
    /static\s+(?:override\s+)?(?:readonly\s+)?tagName\s*(?::\s*[^=]+)?=\s*['"]([a-z][a-z0-9-]*)['"]/.exec(
      text,
    );
  return match?.[1];
}

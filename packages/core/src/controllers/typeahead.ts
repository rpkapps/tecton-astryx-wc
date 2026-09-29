/**
 * Type-to-focus for collections (A§9.13, port of upstream `useTypeahead`): menus, listboxes, trees,
 * radio and toggle groups. Printable keys accumulate into a buffer that resets after a pause; the
 * first item whose label starts with the buffer matches, locale-aware and case/accent-insensitive
 * (`Intl.Collator` with `sensitivity: 'base'`). Typing the same letter repeatedly cycles through the
 * items starting with it (APG `getIndexByLetter`).
 *
 * Not a reactive controller: it holds a buffer, not host state, so it needs no lifecycle.
 *
 * ```ts
 * #typeahead = new TypeaheadController({locale: () => this.#locale.locale});
 * onKeydown(event) {
 *   if (!this.#typeahead.isTypeaheadKey(event)) return;
 *   event.preventDefault();
 *   const index = this.#typeahead.match(event, labels, currentIndex, (i) => disabled[i]);
 *   if (index >= 0) focusItem(index);
 * }
 * ```
 */

export interface TypeaheadOptions {
  /** Pause (ms) after which the buffer resets. Upstream default 750. */
  resetMs?: number;
  /** Locale for comparison; default the document language. */
  locale?: () => string | undefined;
}

/** Splits into code points so a prefix never cuts a surrogate pair. */
const codePoints = (text: string): string[] => Array.from(text);

export class TypeaheadController {
  readonly #resetMs: number;
  readonly #locale: (() => string | undefined) | undefined;
  #buffer = '';
  #timer: ReturnType<typeof setTimeout> | undefined;
  #collator: Intl.Collator | undefined;
  #collatorLocale: string | undefined;

  constructor(options: TypeaheadOptions = {}) {
    this.#resetMs = options.resetMs ?? 750;
    this.#locale = options.locale;
  }

  /** The characters typed so far. */
  get buffer(): string {
    return this.#buffer;
  }

  /**
   * Whether `event` is a typeahead candidate: a single printable character. Alt is allowed (Option+a
   * composes "å" on macOS), Ctrl/Meta are not (AltGr sets ctrlKey on Windows/Linux and is a chord
   * here too, matching upstream), and a lone Space is activation, not typing; Space extends a search
   * already in progress.
   */
  isTypeaheadKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (event.key === ' ') return this.#buffer.length > 0;
    return event.key.length >= 1 && codePoints(event.key).length === 1;
  }

  /**
   * Feeds the key into the buffer and returns the index of the matching label, or `-1` (not a
   * typeahead key, nothing matches). `currentIndex` is the focused/selected item (`-1` for none):
   * a single character starts after it so repeats walk forward; a longer buffer refines and may keep
   * the current item.
   */
  match(
    event: KeyboardEvent,
    labels: readonly (string | null | undefined)[],
    currentIndex: number,
    isDisabled?: (index: number) => boolean,
  ): number {
    if (!this.isTypeaheadKey(event) || labels.length === 0) return -1;

    const character = event.key;
    const previous = codePoints(this.#buffer);
    // Pressing the same character repeatedly cycles instead of filtering deeper.
    const repeated = previous.length > 0 && previous.every((c) => this.#same(c, character));
    this.#buffer = repeated ? character : this.#buffer + character;
    this.#schedule();

    const needle = codePoints(this.#buffer);
    const count = labels.length;
    const hasCurrent = currentIndex >= 0;
    const start = hasCurrent ? currentIndex : 0;
    const offset = hasCurrent && needle.length === 1 ? 1 : 0;
    const collator = this.#collatorFor();

    for (let i = 0; i < count; i++) {
      const index = (start + offset + i + count) % count;
      if (isDisabled?.(index)) continue;
      const label = labels[index];
      if (label === null || label === undefined) continue;
      const prefix = codePoints(label.trim()).slice(0, needle.length).join('');
      if (prefix && collator.compare(prefix, needle.join('')) === 0) return index;
    }
    return -1;
  }

  /** Clears the buffer (on close, blur). */
  reset(): void {
    this.#buffer = '';
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #same(a: string, b: string): boolean {
    return this.#collatorFor().compare(a, b) === 0;
  }

  #collatorFor(): Intl.Collator {
    const locale = this.#locale?.() || undefined;
    if (!this.#collator || locale !== this.#collatorLocale) {
      try {
        this.#collator = new Intl.Collator(locale, {sensitivity: 'base'});
      } catch {
        this.#collator = new Intl.Collator(undefined, {sensitivity: 'base'});
      }
      this.#collatorLocale = locale;
    }
    return this.#collator;
  }

  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#buffer = '';
      this.#timer = undefined;
    }, this.#resetMs);
  }
}

/**
 * Initials for an avatar (upstream `getInitials` and `firstCharacter`, `utils/characters.ts`): the first
 * letter, digit or emoji of the first and last words of a name, so "Northwind Workbench (automation)"
 * reads "NA". Characters are user-perceived (grapheme clusters), never half of an emoji.
 */

let segmenter: Intl.Segmenter | null | undefined;

/** The first user-perceived character of `text`, or `''`. */
export function firstCharacter(text: string): string {
  segmenter ??=
    typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, {granularity: 'grapheme'})
      : null;
  if (segmenter) {
    const first = segmenter.segment(text)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return [...text][0] ?? '';
}

/** A character that can stand for a word in initials: a letter, a digit or an emoji; not punctuation. */
const INITIAL_CHARACTER = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

/** The first character of a word that can stand for it, skipping leading punctuation, or `''`. */
function initialCharacter(word: string): string {
  const index = word.search(INITIAL_CHARACTER);
  return index === -1 ? '' : firstCharacter(word.slice(index));
}

/**
 * The initials of `name`: the first character of its first and last words (one letter for a single word),
 * upper-cased. Words with nothing that can stand for them are skipped; `''` when no word yields one.
 */
export function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map(initialCharacter)
    .filter((initial) => initial !== '');
  if (initials.length === 0) return '';
  if (initials.length === 1) return initials[0]!.toUpperCase();
  return (initials[0]! + initials[initials.length - 1]!).toUpperCase();
}

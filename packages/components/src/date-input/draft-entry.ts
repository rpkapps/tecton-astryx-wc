/**
 * The text a person is typing into a date or time field, until the entry ends. Every prefix of a date or a
 * time is itself a date or a time ("3/4" is this year's March 4, "2:3" is 2:03), so the text is a draft: it is
 * committed when the entry ends (Enter, leaving the field, a pick) and never per keystroke. While it stands
 * unreadable, or readable but not available, the field says so, once, after typing pauses: speaking at the
 * first keystroke of every date would be noise. Leaving the field or pressing Enter speaks at once, while the
 * reason is still known, because the draft is then dropped. [mwg:validate-input-after-interaction]
 * [mwg:accessible-error-announcement]
 */
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import type {TctElement} from '@tecton-wc/core/tct-element.js';

/** Why a draft cannot be committed: it is not a value, or it is one that the constraints rule out. */
export type DraftIssue = 'unreadable' | 'unavailable';

/** How long typing must pause before the field says its text is not an available value. */
export const ISSUE_PAUSE_MS = 700;

export interface DraftEntryOptions {
  /** The element the announcements come from. */
  host: TctElement;
  /** Why non-blank `text` cannot be committed, or `null` when it can. */
  issueOf: (text: string) => DraftIssue | null;
  /** The assertive announcement of an issue. */
  messageFor: (issue: DraftIssue) => string;
  /** Commits readable, available, trimmed text as the value. */
  apply: (text: string) => void;
  /** Commits a blank entry: the value is cleared. */
  clear: () => void;
  /** The displayed state changed (an issue surfaced or went away): render and re-validate. */
  changed: () => void;
}

export class DraftEntry {
  readonly #options: DraftEntryOptions;
  #draft: string | null = null;
  #surfaced: DraftIssue | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: DraftEntryOptions) {
    this.#options = options;
  }

  /** The text in progress, or `null` when the field shows its committed value. */
  get text(): string | null {
    return this.#draft;
  }

  /** Why the text in progress cannot be committed right now, or `null` (also for a blank draft). */
  get issue(): DraftIssue | null {
    const draft = this.#draft;
    if (draft === null || draft.trim() === '') return null;
    return this.#options.issueOf(draft);
  }

  /** The issue the field has surfaced (after a typing pause, or when the entry ended): what it displays as invalid. */
  get surfaced(): DraftIssue | null {
    return this.#surfaced;
  }

  /** The user typed: `text` is now the draft. */
  input(text: string): void {
    this.#draft = text;
    this.#schedule(this.issue);
    this.#options.changed();
  }

  /** Forgets the draft without committing it (a pick, a clear, a form reset, a programmatic write). */
  drop(): void {
    this.#draft = null;
    this.#schedule(null);
  }

  /**
   * The entry ends: blank clears, readable available text commits, the rest is dropped (its issue is spoken
   * first). Returns whether there was a draft.
   */
  commit(): boolean {
    const draft = this.#draft;
    if (draft === null) return false;
    this.#schedule(this.issue, true);
    const text = draft.trim();
    if (text === '') this.#options.clear();
    else if (this.#options.issueOf(text) === null) this.#options.apply(text);
    this.#draft = null;
    this.#schedule(null);
    return true;
  }

  /** Stops a pending announcement (the host left the document). */
  dispose(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #schedule(issue: DraftIssue | null, now = false): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (issue === null) {
      if (this.#surfaced !== null) {
        this.#surfaced = null;
        this.#options.changed();
      }
      return;
    }
    if (issue === this.#surfaced) return;
    const speak = (): void => {
      // The kind can have changed while waiting: say what is true now.
      const current = this.issue;
      this.#timer = undefined;
      if (current === null || current === this.#surfaced) return;
      this.#surfaced = current;
      // From now on the field shows it (aria-invalid, muted text); a prefix in progress never flickers.
      this.#options.changed();
      announce(this.#options.messageFor(current), {
        politeness: 'assertive',
        element: this.#options.host,
      });
    };
    if (now) speak();
    else this.#timer = setTimeout(speak, ISSUE_PAUSE_MS);
  }
}

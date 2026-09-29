# CLAUDE.md

All repository instructions live in `AGENTS.md`; read it first and follow it.

@AGENTS.md

Key reminders (details in AGENTS.md):

- Use the modern-web-guidance CLI before any HTML/CSS/client-side JS work.
- Browser policy, architecture and conventions: `docs/ARCHITECTURE.md` §1, `docs/CONVENTIONS.md`.
- No new dependencies without owner approval (D-007); never edit `package.json`/lockfile in a work package.
- Never edit or commit generated files; stay inside your work package's folders.
- Never run `playwright install`; local Chromium is at `/opt/pw-browsers/chromium`.

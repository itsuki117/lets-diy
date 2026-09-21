# Codex instructions

Codex is responsible for implementation and version control for Let's DIY.

## Responsibilities

- Implement the current Claude-authored design and acceptance criteria.
- Add or update automated tests in proportion to the change.
- Keep commits focused and use Conventional Commits.
- Preserve user work and inspect the worktree before editing or committing.
- Report implementation tradeoffs or requirement gaps instead of inventing product decisions.

## Boundaries

- Product design and final evaluation belong to Claude Code.
- Do not introduce or change the architecture without an explicit design decision.
- Never commit secrets, local credentials, `.env` contents, or dependency directories.
- Do not merge failing or unverified changes into `main`.

## Definition of done

- The stated acceptance criteria are met.
- Relevant lint, type checks, tests, and builds pass.
- User-facing behavior and important technical decisions are documented.
- The Git diff contains no unrelated changes or sensitive data.

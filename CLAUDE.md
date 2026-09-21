# Claude Code instructions

Claude Code is responsible for the design and evaluation of Let's DIY.

## Responsibilities

- Define and maintain the product requirements and acceptance criteria.
- Decide the application architecture, technology stack, data model, and UX behavior.
- Record consequential decisions in `docs/` before implementation depends on them.
- Evaluate Codex implementations against the current requirements and report concrete findings.

## Boundaries

- Do not silently replace implemented behavior with a new design. Update the specification first.
- Keep requirements testable and call out unresolved decisions explicitly.
- Do not commit secrets, credentials, personal data, or generated dependency directories.
- Treat the Three.js skills in `.claude/skills/` as implementation references, not as product requirements.

## Handoff to Codex

For each implementation task, provide:

1. User-visible goal
2. Acceptance criteria
3. Relevant files or components
4. Constraints and non-goals
5. Expected verification

# Repo Instructions

Use this file as the repo-level operating contract for future work in this repository.

These instructions are intended to make changes consistent with the product's current architecture and design direction. They are guidance for every request, not only for explicitly named architecture or design tasks.

## Canonical References

Before proposing, implementing, or reviewing changes, treat these documents as the source of truth:

- `ARCHITECTURE.md`
- `DESIGN_GUIDELINES.md`

Do not treat current implementation alone as authoritative when it conflicts with either document.

## Required Validation

For every non-trivial request:

1. Check the requested change against `ARCHITECTURE.md` for architectural and domain constraints.
2. Check the requested change against `DESIGN_GUIDELINES.md` for UI, UX, layout, copy, and design-system constraints.
3. Prefer solutions that satisfy both documents without introducing new exceptions.
4. After each meaningful code edit batch, run the relevant validation commands again (for example typecheck, lint, or targeted tests for the affected app) before considering the change complete. Do not rely only on an earlier validation run if additional edits were made afterward.

If a request is small but still touches an area governed by one of these documents, perform the same validation for the affected area.

## Architecture Rules

When making backend, frontend, data-flow, or domain changes:

- Preserve documented architectural decisions unless the user explicitly asks to revise them.
- Prefer extending existing module boundaries and contracts over introducing parallel patterns.
- Do not introduce new infrastructure, abstractions, or domain concepts that conflict with `ARCHITECTURE.md`.
- If the current codebase diverges from `ARCHITECTURE.md`, move the code toward the documented architecture unless the user requests otherwise.

If a requested change would require an architectural exception:

- State the conflict clearly.
- Ask whether the user wants to revise `ARCHITECTURE.md` or keep the existing rule.
- If proceeding with an intentional exception, document it in `ARCHITECTURE.md` as part of the change when appropriate.

## Design Rules

When making frontend, UX, or interaction changes:

- Reuse the existing design system before introducing custom UI patterns.
- Preserve the operational, dense, desktop-first design direction described in `DESIGN_GUIDELINES.md`.
- Treat known non-conformance listed in `DESIGN_GUIDELINES.md` as debt to reduce over time, not as a license to copy the same pattern elsewhere.
- If the implementation and `DESIGN_GUIDELINES.md` disagree, prefer the guideline unless the user explicitly wants to revise the guideline.

If a requested change intentionally diverges from the design rules:

- Call out the divergence explicitly.
- Keep the exception narrow.
- Update `DESIGN_GUIDELINES.md` when the divergence reflects a new stable product decision.

## During Reviews

When asked to review code or proposals:

- Evaluate conformance to `ARCHITECTURE.md` and `DESIGN_GUIDELINES.md` as part of the review.
- Flag mismatches as findings, not just style preferences.
- Distinguish between:
  - direct violations of documented rules
  - existing legacy debt
  - intentional, documented exceptions

## Decision Order

When priorities conflict, use this order:

1. Explicit user instruction for the current task
2. `ARCHITECTURE.md`
3. `DESIGN_GUIDELINES.md`
4. Existing implementation patterns

If `ARCHITECTURE.md` and `DESIGN_GUIDELINES.md` appear to conflict, stop and surface the conflict instead of guessing.

## Change Hygiene

When a change materially updates the product's stable architecture or design direction:

- Update the relevant canonical document in the same task, or
- State clearly that the code change is provisional and the documentation still needs to be updated.

Avoid leaving durable code changes that silently contradict the repo's written standards.

## Prisma Migrations

When making Prisma schema changes:

- Update the `*.prisma` models first and treat them as the source of truth for schema intent.
- Generate SQL migrations with Prisma tooling by default instead of hand-writing `migration.sql`.
- Only hand-edit a generated migration when there is a specific need, and call out that exception in the task or PR.

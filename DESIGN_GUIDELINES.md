# Design Guidelines

Use this document as the repo-level reference for UI and UX decisions.

When asking for design work, point to this file directly so changes can be evaluated against the same standards.

## Purpose

This document captures:

- Visual design principles
- Interaction rules
- Layout and responsiveness expectations
- Copy and messaging tone
- Reusable patterns to preserve across features

It should describe stable product decisions, not one-off implementation notes.

## Product Direction

The application should feel:

- Operational and trustworthy
- Fast to scan during daily business use
- Clear under repeated use, not optimized for novelty
- Consistent across catalog, stock, pricing, sales, and admin flows

Design should support long-term workflows in a small-business operations tool.

## Visual Principles

- Favor clear hierarchy over decorative density.
- Use strong contrast for primary actions and important state.
- Keep interactive surfaces visually distinct from passive content.
- Prefer calm, practical interfaces over overly playful patterns.
- Preserve the existing visual language unless the design system is being intentionally revised.
- Use tight spacing by default in operational screens.
- Prefer minimal padding and gaps (for example `p-1`, `p-2`, `gap-2`) unless a larger spacing choice has a specific usability reason.
- Avoid large whitespace areas that reduce usable information density.
- Prefer smaller typography scales for operational UI (for example `text-sm` and `text-xs`).
- Use tight line heights, but preserve clear readability and visual hierarchy.
- Separate panes and sections with subtle 1px borders rather than wide empty spacing.

## Layout Rules

- Prioritize desktop-first operational usability, while keeping mobile functional.
- In desktop mode, the application must behave like a native desktop app.
- In desktop mode, the main layout must be locked to the viewport height (`100vh`).
- In desktop mode, do not allow global window scrolling; the main shell should use `overflow: hidden`.
- In desktop mode, all primary information and panes must fit within the visible screen, with scrolling confined to internal regions when necessary.
- In desktop mode, divide the screen into independent panes using grid or flex layouts.
- If content in a specific desktop pane exceeds the available height, only that pane should scroll internally (for example with `overflow-y: auto`) while the rest of the shell remains fixed.
- In desktop mode, design for high data density.
- On desktop, prefer tables or grid-based layouts for operational entry and review screens.
- On desktop, prefer multi-line editing patterns inside dense layouts over long stacks of single-line field rows.
- In mobile mode, use a flowing layout that grows naturally with content.
- On mobile, use stacked layouts when space is constrained.
- Important actions should stay near the content they affect.
- Forms should be grouped into logical sections, not long undifferentiated stacks.
- Dense screens should still preserve enough spacing to remain scannable.
- Tables, lists, and management views should optimize for repeated use and fast comparison.

## Interaction Rules

- Primary actions should be obvious and singular.
- Secondary actions should remain available but visually quieter.
- Destructive actions should require deliberate intent.
- Loading, empty, and error states must always be explicit.
- User-facing status should be tied to real system state, not optimistic wording that may be wrong.

## Form Design

- Labels must be clear and domain-specific.
- Inputs should prefer sensible defaults when they reduce friction.
- Validation messages should explain what is wrong and what the user should do next.
- Related fields should appear together in the order users think about them.
- Avoid unnecessary required fields in first-pass business workflows.
- For desktop-heavy operational forms, prefer compact multi-column or grid editing over tall single-column forms.
- For mobile forms, collapse dense desktop layouts into clear stacked sections.

## Data Display

- Values important to decisions should be visually prominent.
- Metadata should support the primary value, not compete with it.
- Repeated records should use consistent structure and alignment.
- Derived system state should be readable without requiring users to infer logic.
- Lists should make it easy to spot outliers, pending states, and exceptions.

## Copy Guidelines

- Use direct, plain language.
- Prefer operational wording over marketing language.
- Error messages should be specific and actionable.
- Status text should describe the actual current state.
- Avoid vague success messages when a more concrete one is possible.

## Responsiveness

- Desktop is the primary operational surface.
- Mobile should preserve core workflows, even if density is reduced.
- Controls must remain usable on small screens without horizontal scrolling for standard forms.
- High-value data should reflow predictably when space is constrained.

## Accessibility

- Maintain clear text contrast.
- Ensure keyboard access for interactive controls.
- Use labels for all form inputs.
- Error and status states should be visible without relying on color alone.
- Motion should support clarity, not distract from tasks.

## Reuse And Consistency

- Reuse existing design-system atoms and patterns before introducing new ones.
- Use the atomic design system as the default UI implementation path.
- Prefer design-system primitives and composed design-system components over direct low-level UI imports or ad hoc markup.
- Remove unused design-system primitives and stale alternate patterns once they are no longer referenced.
- New screens should feel like they belong to the current product.
- If a flow intentionally diverges from an established pattern, document why in the change.

## Do Not

- Do not introduce arbitrary visual styles that conflict with the current app.
- Do not add interaction complexity without a workflow reason.
- Do not hide important operational state behind subtle styling.
- Do not prioritize novelty over clarity in business-critical screens.

## Known Non-Conformance

The current frontend does not fully conform to this document. Until those gaps are corrected, use the list below as explicit known debt rather than treating the current implementation as the source of truth.

Current known non-conformance, ordered by impact:

- Shared design-system primitives remain partially non-conformant. The repo still contains decorative treatments that exceed the intended dense operational baseline, especially in shared primitives beyond the core card/button/input set and in local screen-level wrappers.
  Affected frontend areas: the remaining shared design system and any local wrappers that still use large radii, translucent white panels, stronger shadows, or blur-heavy chrome. This still affects catalog, admin, auth, and shell surfaces outside the primitives already updated.
- Some user-facing status copy is still placeholder or dummy content. Screens must not present fake operational state as if it were real system state.
  Affected frontend areas: the app shell landing experience, especially `apps/frontend/src/pages/shell/AppHomePage.tsx`, including the Search + Sync placeholder block and any dashboard placeholder cards that imply live operational state.
- Some async screens still do not distinguish loading, empty, and error states clearly enough. Do not treat a pre-load empty array as a true empty state.
  Affected frontend areas: catalog and data-backed management screens, starting with `apps/frontend/src/pages/catalog/items/ItemsPage.tsx`. Similar review is required for list and management pages that fetch data after mount.
- Some screens bypass existing design-system primitives with ad hoc controls or markup. Reuse the existing atomic design system before introducing custom variants.
  Affected frontend areas: catalog, admin, and other session UI where raw buttons, inputs, switches, or selects are still used directly instead of shared atoms. Immediate remaining examples include `apps/frontend/src/pages/catalog/items/ItemsPage.tsx` and similar ad hoc controls in other feature screens.
- Some inputs still rely on placeholders without explicit labels. This remains non-conformant even when the screen is compact.
  Affected frontend areas: compact filters and dense forms, especially `apps/frontend/src/pages/catalog/items/ItemsPage.tsx`. Additional review is still required for catalog and admin forms that currently depend on placeholder-only input meaning.
- Desktop shell behavior is close to the intended fixed-pane model, but some routes still allow broader content-region scrolling than the ideal pane-confined desktop behavior.
  Affected frontend areas: the routed app shell and desktop container layout, especially `apps/frontend/src/routes/AppRoutes.tsx`, plus any top-level page container that depends on the outer routed region to scroll instead of confining overflow to its own pane.
- Some shared and non-operational screens still use roomier spacing and larger type than the default operational density described above. Treat those as exceptions to reduce over time unless intentionally documented.
  Affected frontend areas: auth and landing surfaces, especially `apps/frontend/src/design-system/organisms/LoginCard.tsx`, `apps/frontend/src/pages/auth/LoginPage.tsx`, the generic `.page` utility in `apps/frontend/src/styles.css`, and parts of the shell landing layout in `apps/frontend/src/pages/shell/AppHomePage.tsx`.
- Some mobile fixed action bars can separate actions from the content they affect. Keep using them only when they improve usability more than they reduce locality.
  Affected frontend areas: pages that use `apps/frontend/src/design-system/molecules/PageActionBar.tsx`, especially item creation/editing and admin detail screens where the mobile portal action bar may detach save/cancel actions from the active form section.

When fixing any item above:

- Prefer updating the shared design system or shell first if that removes the issue across multiple screens.
- Remove the item from this section once the non-conformance is no longer materially present.
- If a non-conformant pattern is intentionally kept, document the exception and why it exists.

## Feature-Level Additions

When a feature needs design-specific rules, add a subsection here under a dedicated heading, for example:

- `## Inventory`
- `## Sales`
- `## Catalog`
- `## Admin`

Keep those sections focused on stable rules that should apply to future work in that area.

## How To Use This

When requesting design changes, reference this file and specify:

- Which feature area is being changed
- Whether the work should preserve or intentionally revise current patterns
- Any feature-specific additions that should be recorded here after the change

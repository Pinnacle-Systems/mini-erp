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
- On desktop, treat batch entry as the default for operational create and edit flows. New screens should assume a dense multi-row or tabular entry surface unless this document explicitly defines a different pattern.
- On desktop, a split-pane master-detail layout is also valid when the left pane is a dense list or table for selection and the right pane is a selection-driven detail context for the active record. In that pattern, the right pane may use a single-record detail form because it is supporting record inspection or focused per-record editing, not acting as the primary batch-entry surface.
- On desktop, prefer multi-line editing patterns inside dense layouts over long stacks of single-line field rows.
- In mobile mode, use a flowing layout that grows naturally with content.
- On mobile, use stacked layouts when space is constrained.
- On mobile, treat single-entry stacked forms as the default create and edit pattern unless this document explicitly defines a different batch interaction.
- Important actions should stay near the content they affect.
- Forms should be grouped into logical sections, not long undifferentiated stacks.
- Dense screens should still preserve enough spacing to remain scannable.
- Tables, lists, and management views should optimize for repeated use and fast comparison.

## Interaction Rules

- Primary actions should be obvious and singular.
- On bulk entry and bulk edit screens, primary actions should include the current affected-record count when it is known and materially helps users confirm scope before committing (for example `Save All (3)` or `Add selected (12)`).
- Secondary actions should remain available but visually quieter.
- Destructive actions should require deliberate intent.
- In mobile card or list views, destructive actions must use an explicit action button. Do not trigger delete or remove actions from tapping the full card surface.
- Loading, empty, and error states must always be explicit.
- User-facing status should be tied to real system state, not optimistic wording that may be wrong.

## Form Design

- Labels must be clear and domain-specific.
- Inputs should prefer sensible defaults when they reduce friction.
- Validation messages should explain what is wrong and what the user should do next.
- Related fields should appear together in the order users think about them.
- Avoid unnecessary required fields in first-pass business workflows.
- For multi-entity create flows, default quick-entry forms to 1 entity on mobile and 5 entities on desktop.
- Unless a feature-specific rule says otherwise, desktop operational forms should default to batch entry with multiple editable rows, and mobile forms should default to a single active entry at a time.
- For desktop-heavy operational forms, prefer compact multi-column or grid editing over tall single-column forms.
- Use single-entry full-page forms when the record requires enough fields, sections, or explanatory context that a dense tabular row would be cramped, unclear, or unstable. Treat screens like business setup and similar large-record entry flows as the model for this exception.
- If a new screen intentionally uses a single-entry desktop form for a workflow that could fit a dense row layout, document that exception in this file instead of relying on the implementation alone.
- For mobile forms, collapse dense desktop layouts into clear stacked sections.
- For destructive mobile actions, prefer labeled buttons over icon-only buttons unless space is severely constrained and the action remains unmistakable.

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
- Shell headers, nav bars, and global action rows must not introduce horizontal page scrolling on mobile. For fixed headers, preserve a stable height; prefer compact icon treatments or an overflow menu for secondary actions instead of wrapping controls into a second row.
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
- Use labeled plain inputs for page-level search and filter fields. Reserve leading-icon search inputs for lookup dialogs or dedicated search widgets, and apply that pattern consistently when used.
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

- Some small-record operational screens still use single-entry desktop forms even though desktop batch entry is now the default. These flows should move toward dense multi-row editing unless they are explicitly documented as exceptions.
  Affected frontend areas: `apps/frontend/src/pages/stock/AdjustmentsPage.tsx`, which is still a single stock-adjustment form instead of a batch quick-entry grid. This item does not apply to intentionally large, high-field business setup and business detail flows such as `apps/frontend/src/pages/admin/businesses/AdminBusinessesPage.tsx`, `apps/frontend/src/pages/admin/businesses/AdminBusinessDetailsPage.tsx`, and related business management organisms, and it also does not apply to valid split-pane master-detail workflows such as `apps/frontend/src/pages/catalog/CategoriesPage.tsx` and `apps/frontend/src/pages/catalog/CollectionsPage.tsx`.
- `apps/frontend/src/pages/admin/users/AdminUserDetailsPage.tsx` currently remains a temporary single-entry desktop exception while the user-management workflow is still undefined. Do not treat its current layout as a reusable pattern for other small-record screens. Revisit this exception once the page requirements are stable.
- Shared design-system primitives are now much closer to the intended baseline, but a smaller set of legacy primitives, utility styles, and decorative secondary components still remain out of line.
  Affected frontend areas: remaining legacy utility styles and decorative secondary components, especially older local wrappers and secondary surfaces that still use translucent fills, heavy blur, oversized radii, or stronger shadows than the dense operational baseline. The core `Card`, `Button`, `Input`, and `Select` primitives are no longer the main source of this gap.
- Some shell-level sections still use placeholder content and reserved layout blocks. Placeholder structure is acceptable temporarily, but it must remain clearly non-authoritative and must not imply live system state.
  Affected frontend areas: the app shell landing experience, especially `apps/frontend/src/pages/shell/AppHomePage.tsx`, including the Search + Sync placeholder block and dashboard sections that are still scaffolds for future real data.
- Some async screens still do not distinguish loading, empty, and error states clearly enough. Do not treat a pre-load empty array as a true empty state.
  Affected frontend areas: data-backed list and management screens beyond `apps/frontend/src/pages/catalog/items/ItemsPage.tsx` and `apps/frontend/src/pages/catalog/CollectionsPage.tsx`, which now have explicit loading and error handling. Similar review is still required for other pages that fetch data after mount.
- Some screens bypass existing design-system primitives with ad hoc controls or markup. Reuse the existing atomic design system before introducing custom variants.
  Affected frontend areas: catalog, admin, and other session UI where raw buttons, inputs, switches, or selects are still used directly instead of shared atoms. The collections page has been normalized, but similar ad hoc controls still remain in other feature screens and supporting panes.
- Some inputs still rely on placeholders without explicit labels. This remains non-conformant even when the screen is compact.
  Affected frontend areas: dense forms and compact controls outside the main catalog list pages, especially catalog and admin forms that still depend on placeholder-only input meaning.
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

## Inventory

- Treat stock as business-level on-hand quantity for now. Do not introduce per-location workflows, internal transfer concepts, or location-specific UI.
- Stock adjustments should capture only product movement direction and quantity, using direct wording for stock coming in or going out.
- Stock review screens should summarize the business-wide quantity users are currently filtering, not split the same product into internal location rows.
- Keep inventory filters compact and labeled, with dense desktop tables as the primary review pattern.

## How To Use This

When requesting design changes, reference this file and specify:

- Which feature area is being changed
- Whether the work should preserve or intentionally revise current patterns
- Any feature-specific additions that should be recorded here after the change

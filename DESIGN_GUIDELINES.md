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
- On desktop, prefer tables or grid-based layouts for operational entry and review screens, with batch entry as the default for operational create and edit flows unless this document explicitly defines an exception.
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
- In mobile card or list views, non-destructive open or view actions should default to tapping the full card surface only when that is the sole action available for the card, unless a feature-specific rule defines a different pattern.
- In mobile card or list views, destructive actions must use an explicit action button. Do not trigger delete or remove actions from tapping the full card surface.
- On list-management screens that include a primary create action, prefer a compact inline header action on desktop and a fixed bottom action button on mobile.
- Loading, empty, and error states must always be explicit.
- User-facing status should be tied to real system state, not optimistic wording that may be wrong.
- In normal operational entity lists and detail screens, `Status` should map to business lifecycle state (`is_active` / `deleted_at` semantics exposed as `isActive` / `deletedAt`), not sync queue or transport state.
- Sync queue or connection state should appear only in admin, diagnostics, utility, or clearly offline-specific UI, not as the default entity status label.

## Spreadsheet-Like Tables

Use a "spreadsheet-like" UX as a cross-cutting desktop interaction pattern for repeated operational rows. Prefer spreadsheet-like layouts when the workflow is primarily repeated-row entry or comparison, not merely because the data can be tabular. This supports high-frequency data entry, side-by-side comparison, and workflows where users think in rows and columns rather than one record at a time.

- Read-only desktop tables should still reuse the same dense spreadsheet-like visual language where possible: tight headers, compact rows, strong column structure, and aligned numeric/data cells. Do not infer from that rule that read-only tables must also adopt spreadsheet keyboard navigation or edit-mode behavior.
- When desktop read-only and editable tabular surfaces are intended to feel like the same instrument, prefer one shared grid-based tabular primitive instead of mixing semantic table rendering for one surface and custom grid rendering for another. Keep interaction differences in cell behavior and focus state, not in the base desktop rendering engine.

- Best candidates: Item variants, sales line items, purchase line items, stock adjustments, bulk pricing review, and batch ledger-like review screens.
- Where to avoid it: Customer creation/editing, business setup, forms with lots of conditional fields/explanatory context, or workflows where each row needs many rich interactions or long text.
- Required traits for spreadsheet-like UX:
  Keyboard-first movement (fast tab and arrow key navigation).
  Inline editing directly within the layout.
  Clear row and column structure.
  Column density that preserves readable numeric alignment and adequately sized editable hit areas.
  Optimized for batch entry speed.
  Validation should stay inline and row-local where possible so users can correct errors without losing context.
- Anti-patterns (what it should NOT mean):
  Tiny, unreadable controls.
  Hidden or deferred validation.
  Imitating Excel purely for its own sake.
  Letting every cell become arbitrarily editable without workflow rules.

## Form Design

- Keep standard forms focused on flows where full-record contexts are justified (setup, detail workflows, explicit single-record exceptions) rather than forcing them into high-frequency operational batch views.
- Labels must be clear and domain-specific.
- Inputs should prefer sensible defaults when they reduce friction.
- Validation messages should explain what is wrong and what the user should do next.
- Related fields should appear together in the order users think about them.
- Avoid unnecessary required fields in first-pass business workflows.
- For multi-entity create flows, default quick-entry forms to 1 entity on mobile and 5 entities on desktop.
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
- If a screen shows an entity `Status` column or badge, use the same lifecycle meaning consistently across modules unless a feature-specific section documents a different business meaning.

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

- Use the atomic design system as the default UI implementation path. Reuse existing atoms, composed components, and established patterns before introducing new primitives or ad hoc markup.
- Reuse the shared filter-panel pattern (`app-filter-panel`, `app-filter-legend`, `app-filter-row`) for page-level search and filter controls on operational list screens instead of bespoke control stacks.
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

- `apps/frontend/src/pages/admin/users/AdminUserDetailsPage.tsx` currently remains a temporary single-entry desktop exception while the user-management workflow is still undefined. Do not treat its current layout as a reusable pattern for other small-record screens. Revisit this exception once the page requirements are stable.
- Shared design-system primitives are now much closer to the intended baseline, but a smaller set of legacy primitives, utility styles, and decorative secondary components still remain out of line.
  Affected frontend areas: remaining legacy utility styles and decorative secondary components, especially older local wrappers and secondary surfaces that still use translucent fills, heavy blur, oversized radii, or stronger shadows than the dense operational baseline. The core `Card`, `Button`, `Input`, and `Select` primitives are no longer the main source of this gap.
- Some shell-level sections still use placeholder content and reserved layout blocks. Placeholder structure is acceptable temporarily, but it must remain clearly non-authoritative and must not imply live system state.
  Affected frontend areas: the app shell landing experience, especially `apps/frontend/src/pages/shell/AppHomePage.tsx`, including the Search + Sync placeholder block and dashboard sections that are still scaffolds for future real data.
- Some async screens still do not distinguish loading, empty, and error states clearly enough. Do not treat a pre-load empty array as a true empty state.
  Affected frontend areas: data-backed list and management screens that fetch after mount beyond `apps/frontend/src/pages/catalog/items/ItemsPage.tsx` and `apps/frontend/src/pages/catalog/CollectionsPage.tsx`, which now have explicit loading and error handling.
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

## People

- The main customer management screen should use a dense desktop table as the default browse-and-select surface, with mobile allowed to fall back to compact stacked cards.
- Customer creation and customer editing are explicit exceptions to the default small-record desktop batch-entry rule: use dedicated single-record pages at `customers/new` and `customers/:customerId`, then return users to the main customer table for browsing and selection.

## Inventory

- Treat stock ownership as location-level while preserving a clear business-wide aggregate view where users need it.
- Stock adjustments should capture only product movement direction and quantity, using direct wording for stock coming in or going out.
- Stock review screens may show business-wide totals, location-filtered totals, or explicit location rows depending on the workflow, but the location context must be obvious.
- Keep inventory filters compact and labeled, with dense desktop tables as the primary review pattern.
- If location-aware inventory is surfaced, make location selection explicit near the stock content it affects rather than hiding it in unrelated shell controls.

## Financials

- Keep primary financial screens business-oriented by default even when underlying transactions can carry location attribution.
- Use location as a filter, column, or reporting dimension in financial review flows when it materially improves analysis.
- Do not imply that each location is a separate accounting entity unless the product explicitly introduces branch-level books as a separate feature.

## Business Setup

- When business locations are license-enabled, surface them as a compact management pane inside the business details workflow rather than a disconnected settings screen.
- Keep location management dense and operational: use compact card or row groups with labeled inputs, one explicit default-location action, and local add/remove controls.
- When location capability is not enabled, do not show secondary location controls in normal user workflows; the system should continue using the default location silently.
- If an owner can switch active location, keep the control near the existing business switcher in the session header and label the current location clearly.

## Sales

- Sales quotations/estimates, sales orders, delivery challans, sales invoices, and sales returns should reuse one dense document workspace pattern instead of diverging into unrelated screen families.
- POS may use a streamlined sales-invoice variant for faster checkout, but it must still produce the same sales invoice document type and reuse the shared customer, line-entry, totals, and posting rules.
- For the POS variant specifically, use a hybrid entry pattern: a scanner-first quick-add input at the top, with a spreadsheet-like editable cart below. The POS interface must maintain a single dominant item-entry surface and a single dominant checkout action to prevent cashier confusion. A pure spreadsheet is not sufficient because it scatters the entry focus.
- On the active POS screen, keep the primary checkout action near the payable total and avoid duplicating that final checkout trigger in multiple competing locations.
- Keep recent sales available to POS as a secondary utility without displacing the active checkout flow.
- The primary browse surface for these sales documents should be a dense combined table on desktop, with status distinguishing draft and posted records.
- Draft and posted records for the same sales document type may appear together in one list when that improves review continuity, but actions must still reflect the real document state.
- When online, `Save Draft` should persist a backend draft for the active sales document type. Offline draft save may remain device-local as a fallback, but the UI should treat backend drafts as first-class editable records once available.
- Draft-only actions such as open/edit or delete must remain unavailable for posted records.
- When a posted sales document supports a post-state workflow such as cancel, void, or reopen, expose that as an explicit labeled action in the list instead of overloading draft actions or hiding the transition behind status text.
- Shared customer, item lookup, line-entry, totals, and posting patterns should stay aligned across sales document types unless a feature-specific rule documents a justified exception.
- The POS invoice variant should default to cash and keep item search and cart editing visible at the same time.
- Type-specific metadata required for downstream sales conversions should live inside the shared sales workspace instead of being deferred to hidden follow-up steps. At minimum, estimates should surface validity and delivery challans should surface dispatch details in the main form.

## Catalog

- Catalog authoring should treat pricing as part of the main item workflow for the current product baseline. Item create and item edit screens may include sales and purchase pricing fields alongside item and variant details.
- If a separate pricing screen exists, treat it as a secondary maintenance surface for bulk review or correction, not the only place users can set prices.
- When a catalog screen supports both archive and purge, those actions must be surfaced as separate intents. Use `Delete`/inactive state for reversible lifecycle changes and `Purge` for permanent corrective removal.
- Desktop variant authoring should use a dense, spreadsheet-like table as the primary editing surface once variants are generated.
- Variant generation should support key-value option entry that can expand to cartesian combinations before save.
- When option-based variants are shown in a table, option keys should be rendered as explicit columns for readability, with a default cap of 3 option columns before fallback behavior is applied.
- For single-item variant authoring, do not support row-level option editing. Define options once in the top option builder, generate combinations, and treat per-row option values as labels. If a generated combination is not needed, remove the entire row.
- Variant workflows should support two editing depths:
  dense inline fields for common attributes (name, SKU, barcode, active state, base price where applicable) and a secondary side-surface for advanced attributes.
- Bulk operations should be scoped and explicit:
  use selection plus apply actions (for example, apply a price to selected variants) rather than hidden mass edits.
- Stock initialization can be offered during initial variant setup, but ongoing stock changes must remain in dedicated inventory adjustment flows.

## How To Use This

When requesting design changes, reference this file and specify:

- Which feature area is being changed
- Whether the work should preserve or intentionally revise current patterns
- Any stable feature-specific additions that should be recorded here after the change

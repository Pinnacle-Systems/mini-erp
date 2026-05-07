# Features And Gaps

Last reviewed: 2026-05-07

This document is a product-level snapshot of what is currently implemented in this repository, what is partially implemented, and what is still placeholder or deferred. It is based on the wired frontend routes, backend route registration, and the canonical rules in [ARCHITECTURE.md](../ARCHITECTURE.md) and [DESIGN_GUIDELINES.md](../DESIGN_GUIDELINES.md).

## Status Legend

- Implemented: routed and backed by working frontend and backend flows in the current app.
- Partial: available for real use, but the surrounding workflow, reporting, polish, or coverage is still incomplete.
- Placeholder: route or shell entry exists, but the app content is not implemented yet.

## 1. Implemented Product Areas

### 1.1 Access, Session, And App Shell

Implemented:

- Login flow with authenticated app routing
- Role-based entry between user app and platform-admin app
- Business selection and location-aware session context
- Capability and module gating at route level
- Offline fallback page for unauthenticated and platform-admin cases
- Desktop-first fixed-shell layout with mobile fallback behavior

Notes:

- The user shell and capability model are active product infrastructure, not mock-only scaffolding.
- Some home/dashboard sections are still shell scaffolds rather than authoritative operational data.

### 1.2 Platform Admin

Implemented:

- Business list, create, detail, update, and delete flows
- User list, user detail, and user update flows
- Owner lookup for business setup
- Business logo upload and removal

Backend surface:

- `/api/admin/businesses`
- `/api/admin/users`
- `/api/admin/owners/lookup`

### 1.3 Catalog

Implemented:

- Product management
- Service management
- Category management
- Collection management
- Variant-aware item setup
- Item pricing support through sync-owned catalog data and pricing endpoints
- Catalog overview route

Current shape:

- Catalog is one of the strongest sync-backed modules in the app.
- Product and service maintenance are available as dedicated operational screens, not just seed-data helpers.

### 1.4 Parties

Implemented:

- Customers list, create, and detail flows
- Suppliers list, create, and detail flows
- Customer group management
- Parties overview route
- Party finance summaries surfaced into billing-related screens

Notes:

- Party lifecycle is shared at the underlying party row level, consistent with the current architecture note.
- Customer and supplier records are reused across sales, purchases, and finance workflows.

### 1.5 Sales

Implemented:

- Sales overview
- Estimates
- Sales orders
- Delivery challans
- Sales invoices / bills
- POS billing
- Sales returns
- Shared sales workspace with draft, post, conversion, and history behavior

Coverage details:

- Backend sales APIs are wired under `/api/sales`
- Conversion-balance and document-lifecycle workflows are server-authoritative
- Sales drafts can be worked on locally, but posting remains online-only

### 1.6 Purchases

Implemented:

- Purchases overview
- Purchase orders
- Goods receipt notes
- Purchase invoices
- Purchase returns
- Shared purchase workspace mirroring the dense sales workflow pattern

Coverage details:

- Backend purchase APIs are wired under `/api/purchases`
- Purchase stock, conversion, history, and settlement behaviors are implemented as authoritative backend workflows

### 1.7 Finance

Implemented:

- Finance overview
- Financial accounts
- Payments received
- Payments made
- Expenses
- Open-document lookup and document-balance support
- Payment allocation and allocation reversal flows
- Void flows for money movements

Backend surface:

- `/api/accounts/overview`
- `/api/accounts/financial-accounts`
- `/api/accounts/payments/received`
- `/api/accounts/payments/made`
- `/api/accounts/payments/:movementId/allocate`
- `/api/accounts/expenses`
- `/api/accounts/open-documents`
- `/api/accounts/document-balance`
- `/api/accounts/party-summary`

Current shape:

- Finance is operationally tied into sales and purchases rather than being a separate bookkeeping shell.
- Receivable and payable workflows are live and connected to settlement state.

### 1.8 Inventory

Implemented:

- Stock overview
- Stock levels
- Stock adjustments
- Stock history
- Location-aware stock behavior in billing and purchase flows

Current shape:

- Inventory mutations follow the architecture rule: authoritative stock-affecting operations stay backend-owned or sync-validated.
- Browse and review data are available through synced read models and inventory-specific APIs.

Backend surface:

- `/api/inventory/stock-activity`

### 1.9 Sync, Offline Review, And Diagnostics

Implemented:

- Sync push and pull flows
- Sync results / diagnostics view
- Local outbox and resync/reset flow
- Local synced review data for supported entities
- Local billing draft persistence
- Item sync/admin sync utility pages

Backend surface:

- `/api/sync/push`
- `/api/sync/pull`
- `/api/sync/results`
- `/api/sync/option-keys`
- `/api/sync/item-categories`
- `/api/sync/item-prices`

Architecture-aligned limit:

- Offline review is supported for synced entities and local drafts.
- Offline posting of authoritative business documents is not supported.

### 1.10 Android / Mobile Delivery

Implemented:

- Capacitor-based Android app wrapper in `apps/frontend/android`
- Android sync/build scripts
- Mobile-aware layout fallbacks across the app shell
- Platform bridge and connectivity helpers in the frontend app

Current shape:

- The repo is prepared for Android packaging and local build workflows.
- Mobile support preserves core workflows, but desktop remains the primary operational surface.

## 2. Partial Areas

These areas are real product surfaces, but they still have meaningful limits or unfinished surrounding workflows.

### 2.1 Home And Dashboard Data

Partial:

- The app landing shell exists and includes quick navigation and some module-level summaries.
- Parts of the landing experience still include scaffolded or placeholder sections rather than full live operational dashboards.

### 2.2 Reporting

Partial:

- Sales, purchase, inventory, and finance workflows produce operational data needed for reporting.
- The app does not yet expose a broad in-product reporting suite beyond overview summaries, recent activity, balances, and module-level metrics.

### 2.3 Finance Depth

Partial:

- Core money movement, allocation, expense, and settlement flows are implemented.
- Richer aging reports, deeper analytics, exports, and attachment-heavy finance workflows are still deferred.

### 2.4 Offline Support

Partial:

- Local review and draft capture are implemented where the architecture allows them.
- Full offline transactional completion is intentionally not implemented for stock-affecting and settlement-affecting workflows.

### 2.5 Design-System Conformance

Partial:

- The app has a real shared design system and many operational screens already use it.
- `DESIGN_GUIDELINES.md` still calls out remaining legacy spacing, placeholder-only inputs, shell scaffolds, and ad hoc controls that should be reduced over time.

## 3. Placeholder Or Not Yet Implemented Areas

These routes exist in the user app, but the route content is still a placeholder card that says the app content will be added later.

Placeholder routes:

- Promotions: rules, bundles, codes
- Reports: sales report, top items report, stock value report
- Business settings app under the user shell

Current implementation source:

- `apps/frontend/src/pages/shell/UserAppPages.tsx`

## 4. Known Gaps And Deferred Work

The most visible current product gaps are:

- Placeholder app sections for promotions, reports, and business settings
- Broader reporting and export workflows across sales, purchases, inventory, and finance
- Offline posting for authoritative document workflows
- Attachments in payment and expense flows
- Richer finance analytics such as aging and deeper settlement reporting
- Expense recreate workflow after void
- Direct in-place editing of allocation rows; the current correction path is reverse then reallocate
- Remaining UI conformance debt already documented in [DESIGN_GUIDELINES.md](../DESIGN_GUIDELINES.md)
- Some remaining manual acceptance coverage around edge-heavy billing and purchase cases

## 5. Recommended Reading Order

For someone trying to understand the current product state quickly:

1. [ARCHITECTURE.md](../ARCHITECTURE.md)
2. [DESIGN_GUIDELINES.md](../DESIGN_GUIDELINES.md)
3. [docs/features-and-gaps.md](./features-and-gaps.md)

## 6. Detailed Billing Coverage

This section consolidates the previous billing-specific inventory into the same document so there is one current source of truth for implemented billing behavior and its gaps.

### 6.1 Billing Scope

The current billing workflow covers:

- sales quotations / estimates
- sales orders
- delivery challans
- sales invoices / bills
- sales returns / credit notes
- POS sales
- purchase orders
- goods receipt notes
- purchase invoices
- purchase returns / supplier debit notes
- invoice receipts and settlement tracking
- supplier payments and payable settlement tracking
- customer-facing billing document lifecycle and history
- supplier-facing purchase document lifecycle and history
- business money-account setup needed for receipts and payments
- expense capture and finance overview adjacent to billing

### 6.2 Sales Documents

Implemented:

- Estimates with validity date, history, duplication, and conversion to orders or invoices
- Sales orders with remaining-quantity tracking and conversion to challans or invoices
- Delivery challans with dispatch metadata, history, duplication, invoice conversion, and return conversion
- Sales invoices with `CASH` and `CREDIT` modes, settlement context, history, duplication, and direct receipt launch
- Sales returns created from posted invoices or challans with backend-controlled return ceilings

Current rules:

- Sales invoices are server-authoritative real-time documents
- Posted sales documents are ordinarily immutable
- Standalone sales returns are blocked
- Invoice settlement is derived from linked finance and return activity rather than stored as invoice truth

### 6.3 Purchase Documents

Implemented:

- Purchase orders
- Goods receipt notes
- Purchase invoices
- Purchase returns
- Shared purchase workspace with history, duplication, and conversion support
- `CASH` and `CREDIT` settlement modes on purchase invoices
- Atomic linked payment creation for cash purchase invoices

Current rules:

- Purchase documents are server-authoritative real-time documents
- Purchase returns must reference a posted purchase invoice or goods receipt note
- Posted purchase documents are ordinarily immutable
- Purchase invoice settlement is derived from finance records and linked purchase returns

### 6.4 Shared Document Workspace

Implemented:

- Dense browse-and-edit workspaces for sales and purchases
- Shared customer and supplier lookup flows
- Shared item and variant selection
- Draft save, post, duplicate, delete-local-draft, and history actions
- Shared totals, tax, notes, and document metadata handling
- Local draft persistence with backend persistence when online
- Duplicate-number conflict handling with backend suggestions

### 6.5 Line Items, Pricing, And Conversions

Implemented:

- Product and service lines
- Inline quantity, price, tax rate, and tax mode editing
- `EXCLUSIVE` and `INCLUSIVE` tax modes
- Immutable posted price snapshots
- Mixed linked and ad-hoc line support in converted drafts
- Backend-authored conversion balances and quantity ceilings
- Pricing warnings when duplicated drafts no longer match current availability or price context

Supported conversions:

- Estimate -> Sales Order
- Estimate -> Sales Invoice
- Sales Order -> Delivery Challan
- Sales Order -> Sales Invoice
- Delivery Challan -> Sales Invoice
- Delivery Challan -> Sales Return
- Sales Invoice -> Sales Return
- Purchase Order -> Goods Receipt Note
- Purchase Order -> Purchase Invoice
- Goods Receipt Note -> Purchase Invoice
- Goods Receipt Note -> Purchase Return
- Purchase Invoice -> Purchase Return

### 6.6 POS

Implemented:

- Dedicated POS workflow built on the sales invoice engine
- Default cash-mode checkout
- Quick-add item flow
- POS hotkeys
- Cash tendered and change-due handling
- Quick-cash shortcuts
- Auto-print toggle persisted on device/register
- Printable receipt after posting
- Recent POS sales list

### 6.7 Party, Settlement, And Finance Behavior In Billing

Implemented:

- Walk-in customer support
- Quick customer creation from sales context
- Customer snapshot capture on documents
- Party-level outstanding, credit, and recent finance context
- Settlement states including `UNPAID`, `PARTIAL`, `PAID`, `OVERPAID`, and `N_A`
- Payments received and payments made with manual, auto, and unapplied-credit flows
- Allocation append, reversal, and later reapplication workflows
- Financial account setup and archive support
- Expense recording and voiding

### 6.8 Inventory-Linked Billing Rules

Implemented:

- Delivery challans deduct stock on post
- Standalone and eligible linked invoices deduct stock on post
- Challan-linked invoice lines do not double-deduct stock
- Sales returns add stock back
- Goods receipt notes and eligible purchase invoices add stock
- Purchase returns deduct stock
- Stock-affecting cancellations and reopen flows create reversal or reapplication stock rows
- Service items do not create stock movement
- Negative-stock prevention can block posting when configured

### 6.9 Billing Offline Boundaries

Implemented:

- Local draft save while offline
- Offline review of recent synced browse/read models where available

Not implemented by design:

- Offline posting of sales documents
- Offline posting of purchase documents
- Offline authoritative history, conversion-balance, and settlement mutation workflows

### 6.10 Billing-Specific Gaps

Known billing gaps or deferred areas:

- attachment support for payments and expenses
- expense recreate workflow after void
- direct in-place editing of payment allocation rows; correction is currently reverse then reallocate
- deeper aging, settlement analytics, and richer finance reporting
- broader export workflows
- remaining manual acceptance coverage around mixed-origin, challan-return, purchase stock, return, and cash-post edge cases

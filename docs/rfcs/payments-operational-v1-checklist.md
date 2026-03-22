# Payments and Operational Financial Tracking V1 Checklist

This checklist tracks implementation status for [RFC: Payments and Operational Financial Tracking V1](/home/ajay/workspace/mini-erp/docs/rfcs/payments-operational-v1.md). It is execution-focused and should be updated as work progresses without changing the RFC itself.

Status review note: updated against tracked repository state on 2026-03-22. The operational finance foundation is implemented and usable. The repo now includes `accounts.*` operational tables, backend APIs, finance frontend pages, invoice settlement summaries, purchase-return-aware purchase invoice settlement, and overview cards for customer receivables, supplier payables, and vendor credit. The phase is still incomplete for sales-return-aware settlement, unapplied credit handling, movement reversal flows, and deeper reporting.

## Phase 1: Operational Finance Foundation

Goal: create the business-owned operational finance records without exposing full accounting complexity.

- [x] Add `FinancialAccount` model
- [x] Add `MoneyMovement` model
- [x] Add `MoneyMovementAllocation` model
- [x] Add `ExpenseCategory` model
- [x] Add `Expense` model
- [x] Keep legacy accounting tables (`Account`, `JournalEntry`, `LedgerEntry`) separate from the operational V1 workflow
- [x] Seed default financial accounts
- [x] Seed default expense categories
- [x] Keep finance ownership business-level
- [x] Keep `location_id` as attribution only
- [x] Keep currency restricted to `INR` in this phase
- [ ] Generate and apply Prisma migration locally

## Phase 2: Backend Accounts API

Goal: expose authoritative finance operations through a dedicated backend module.

- [x] Create `apps/backend/src/modules/accounts`
- [x] Add `accounts.routes.ts`
- [x] Add `accounts.controller.ts`
- [x] Add `accounts.schema.ts`
- [x] Add `accounts.service.ts`
- [x] Register `/api/accounts` routes
- [x] Protect routes with auth middleware
- [x] Validate tenant membership before finance reads and writes
- [x] Add overview endpoint
- [x] Add financial accounts list/create/archive endpoints
- [x] Add money movements list endpoint
- [x] Add payment received endpoint
- [x] Add payment made endpoint
- [x] Add expense create/list endpoints
- [x] Add expense category list endpoint
- [x] Add open-documents endpoint
- [x] Add document-balance endpoint

## Phase 3: Money Movement and Expense Behavior

Goal: make operational finance writes durable and accounting-ready.

- [x] Treat money movement as the atomic financial event
- [x] Record payment receipts as `INFLOW`
- [x] Record supplier payments as `OUTFLOW`
- [x] Record expenses as `OUTFLOW`
- [x] Create money movement allocations transactionally with payment writes
- [x] Create expense and linked money movement transactionally
- [x] Restrict payment and expense writes to system currency
- [x] Track money movement source metadata
- [x] Track account attribution on every movement
- [x] Track party context when available
- [ ] Add explicit reverse / void endpoint for money movements
- [ ] Add enforced void-and-recreate workflow in UI

## Phase 4: Derived Settlement Layer

Goal: surface settlement without storing invoice payment truth on documents.

- [x] Add shared settlement helper in `accounts.service.ts`
- [x] Derive settlement from money movement allocations rather than invoice columns
- [x] Keep workflow status and settlement status separate
- [x] Return settlement summary fields:
  - `grossDocumentAmount`
  - `paidAmount`
  - `appliedReturnAmount`
  - `netOutstandingAmount`
  - `outstandingAmount`
  - `settlementStatus`
  - `lastPaymentAt`
  - `fullySettledAt`
- [x] Keep `paymentStatus` as compatibility alias in the current contract
- [x] Treat `CANCELLED` and `VOID` as `N_A`
- [x] Use decimal-safe settlement comparison
- [x] Recompute `fullySettledAt` from current settlement state
- [x] Keep settlement logic in TypeScript service layer instead of SQL views for V1
- [ ] Add stronger automated tests for settlement transitions and edge cases

## Phase 5: Purchase Invoice Settlement

Goal: make purchase invoice settlement net-exposure-aware.

- [x] Include payment allocations in purchase invoice settlement
- [x] Include linked purchase returns in purchase invoice settlement
- [x] Use `parent_id` implicit application for purchase returns
- [x] Only count purchase returns with `posted_at != null` and status not in `CANCELLED | VOID`
- [x] Use tax-inclusive return `grand_total`
- [x] Derive purchase invoice settlement from `paidAmount + appliedReturnAmount`
- [x] Surface purchase invoice vendor credit when net outstanding is negative
- [x] Remove standalone purchase returns from receivable overview rollups

## Phase 6: Sales Invoice Settlement

Goal: keep sales invoice settlement visible while deferring full return-aware behavior.

- [x] Include received-payment allocations in sales invoice settlement
- [x] Surface settlement summary on sales invoices
- [x] Include linked sales returns in sales invoice settlement
- [x] Add sales-return-aware status wording where needed

## Phase 7: Frontend Finance Surfaces

Goal: expose operational finance workflows in a compact business-oriented module.

- [x] Add finance module entry in shell navigation
- [x] Add finance routes and guards
- [x] Add Financial Overview page
- [x] Add Payments Received page
- [x] Add Payments Made page
- [x] Add Expenses page
- [x] Add Accounts page
- [x] Add overview cards for customer receivable, supplier payable, vendor credit, inflow, outflow, and expense total
- [x] Add recent activity table
- [x] Add account balances view
- [x] Add expense-by-category view
- [x] Add single-document payment entry UI
- [x] Add expense quick-entry UI
- [x] Add financial account maintenance UI
- [ ] Add multi-document allocation UI in a single payment entry
- [ ] Add unapplied credit / advance payment UI
- [ ] Add richer filtering and export workflows

## Phase 8: Document Context Integration

Goal: make settlement visible where users manage invoices.

- [x] Add settlement summary to purchase invoice API responses
- [x] Add settlement summary to sales invoice API responses
- [x] Surface purchase invoice settlement in list and detail views
- [x] Surface sales invoice settlement in list and detail views
- [x] Add `Record Payment` action from purchase invoices
- [x] Add `Record Receipt` action from sales invoices
- [x] Guard payment actions to posted live invoices
- [x] Improve purchase settlement wording:
  - `Paid`
  - `Settled`
  - `Settled by Return`
  - `Vendor Credit`
- [ ] Add similarly refined wording once sales returns join sales settlement math

## Phase 9: Overview and Rollup Accuracy

Goal: keep overview cards aligned with business meaning.

- [x] Stop counting purchase returns as standalone receivables in overview rollups
- [x] Stop counting sales returns as standalone payables in overview rollups
- [x] Rename overview cards to `Customer Receivable` and `Supplier Payable`
- [x] Add separate `Vendor Credit` overview metric
- [ ] Add customer-credit equivalent when sales-return-aware settlement and unapplied credit are implemented

## Phase 10: Still Pending for Later Phase

These are agreed pending items rather than regressions:

- [ ] Sales-return-aware sales invoice settlement
- [ ] Money movement reversal / void workflow
- [ ] Party-level outstanding summary
- [ ] Party-level unapplied credit summary
- [ ] Advance receipt / advance payment handling UX
- [ ] Multi-document payment allocation UI
- [ ] Attachment support for expense/payment records
- [ ] Accounting journal bridge
- [ ] Aging views and deeper finance reporting
- [ ] Settlement analytics such as days-to-pay

## Notes

- [x] Settlement remains derived rather than stored on invoices
- [x] Finance remains single-currency in this phase
- [x] Business ownership remains in `accounts.*`
- [x] Current implementation is operational V1, not a full accounting product

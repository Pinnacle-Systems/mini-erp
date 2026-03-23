# RFC: Payments and Operational Financial Tracking V1

This RFC is a standalone design document for iterative refinement. It records the current agreed direction for payments, expenses, and operational settlement tracking and does not replace [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md) or [DESIGN_GUIDELINES.md](/home/ajay/workspace/mini-erp/DESIGN_GUIDELINES.md).

**Status:** Active / Implemented in Phases
**Area:** Accounts, Sales, Purchases, Financials
**Core Logic:** Immutable money movements, document allocations, derived settlement, business-level financial accounts, and simple paid expenses.

## 1. Problem Statement

The product needed a lightweight financial operations layer without jumping straight into a full accounting UI. The required workflows were:

- payments received against sales invoices
- payments made against purchase invoices
- simple paid expense entry
- invoice-level settlement visibility without storing financial truth on document headers

The main design constraint was to avoid creating a second source of truth for whether an invoice is paid. The system should derive settlement from finance records rather than mutating invoice rows with authoritative payment totals.

## 2. Goals and Non-Goals

### 2.1 Goals

- Add a business-owned operational finance module under `accounts.*`
- Treat money movement as the atomic financial event
- Support reusable business money accounts such as cash, bank, UPI, and credit card
- Support allocations from money movements to financial documents
- Surface invoice settlement in purchase and sales document UIs
- Keep settlement derived from finance records, not stored as document truth
- Preserve a future upgrade path to accounting journals and reporting

### 2.2 Non-Goals

- No full chart-of-accounts management UI
- No debit/credit journal workflow UI
- No bank reconciliation flow
- No receipt or attachment uploads in V1
- No full party-level credit management in this phase
- No multi-currency support in this phase

## 3. Architectural Position

The payments module follows these rules:

1. `accounts.*` owns operational financial records such as money movements, allocations, expense categories, and expense rows.
2. Sales and purchases remain the source of truth for document lifecycle and totals.
3. Settlement is derived from `accounts.money_movements` and `accounts.money_movement_allocations`, plus approved document adjustments where explicitly included.
4. Do not add cross-module foreign keys between `accounts.*` and `documents.*`; continue using scalar IDs and backend-authored validation.
5. Keep finance ownership business-level, with optional `location_id` used as attribution rather than as a separate ownership root.

## 4. Data Model Direction

Operational finance V1 uses these business-level records in `accounts.*`:

- `FinancialAccount`
  - reusable money buckets like cash, bank, UPI, and credit card
- `MoneyMovement`
  - immutable inflow or outflow event
- `MoneyMovementAllocation`
  - allocation of a movement amount to one or more documents
- `ExpenseCategory`
  - business-owned category list
- `Expense`
  - user-facing paid expense record linked to a money movement

Important rule:

- money movement is the atomic financial event
- document payment or settlement state is derived from allocations and approved adjustment logic, not stored as authoritative invoice state

## 5. Settlement Model

### 5.1 Workflow and Settlement Separation

Workflow status and settlement status are separate concepts.

- document `status` remains owned by the document engine
- settlement is derived and surfaced separately on invoice-like documents

This avoids status drift such as an invoice being marked paid while the finance records disagree.

### 5.2 Derived Settlement Fields

The settlement helper currently returns:

- `grossDocumentAmount`
- `paidAmount`
- `appliedReturnAmount`
- `netOutstandingAmount`
- `outstandingAmount`
- `settlementStatus`
- `lastPaymentAt`
- `fullySettledAt`

Compatibility note:

- `paymentStatus` still exists in the API contract as a compatibility alias in the current implementation, but `settlementStatus` is the more accurate concept.

### 5.3 Settlement Rules

For invoice-like documents, settlement is derived from:

- money movement allocations with the expected direction
- approved linked document adjustments included in the current phase

Current behavior:

- `SALES_INVOICE`
  - settlement is net-exposure-aware from received-payment allocations plus linked sales returns
- `PURCHASE_INVOICE`
  - settlement is net-exposure-aware from made-payment allocations plus linked purchase returns

Current status values:

- `N_A`
- `UNPAID`
- `PARTIAL`
- `PAID`
- `OVERPAID`

### 5.4 Purchase Return Handling

Purchase-return-aware settlement uses implicit application:

- purchase returns linked by `parent_id` to a purchase invoice reduce the invoice’s net exposure
- only returns with `posted_at != null` and status not in `CANCELLED` or `VOID` count
- the return `grand_total` is used so settlement math stays tax-inclusive

Result:

- a purchase invoice may be settled by cash, by return, or by a combination of both
- negative net outstanding on a purchase invoice represents supplier credit / refund due

### 5.5 Sales Return Handling

Sales-invoice-aware settlement now uses implicit application:

- sales returns linked by `parent_id` to a sales invoice reduce the invoice's net exposure
- only returns with `posted_at != null` and status not in `CANCELLED` or `VOID` count
- the return `grand_total` is used so settlement math stays tax-inclusive

Result:

- a sales invoice may be settled by receipt, by return, or by a combination of both
- negative net outstanding on a sales invoice represents customer credit / refund due

### 5.6 Cash Purchase Invoice Post-and-Pay

`settlement_mode = CASH` on a purchase invoice is not only descriptive metadata. It now drives a posting-time financial workflow:

- `PURCHASE_INVOICE + CREDIT`
  - posting remains document-only and leaves settlement derived from later payments and returns
- `PURCHASE_INVOICE + CASH`
  - posting requires a selected financial account
  - posting creates the purchase invoice and the linked made-payment allocation in one backend transaction
  - the created money movement carries:
    - `financial_account_id`
    - `location_id`
    - `source_document_id`
    - `source_document_type = PURCHASE_INVOICE`
  - the invoice lands immediately in `PAID` settlement state when fully covered by the auto-created payment

Guard rules:

- the cash-post flow is backend-owned; it does not require separate Accounts-screen navigation
- if payment creation fails, invoice posting rolls back
- a purchase invoice with linked posted payment movements cannot reopen to draft until those linked payments are voided
- cancelling a cash-posted purchase invoice automatically voids the linked auto-created payment movement

### 5.7 Voided Movement Visibility

Voided money movements remain part of audit history but are no longer treated as live financial activity.

Rules:

- voided movements do not affect account balances
- voided movements do not count toward `This Month In` or `This Month Out`
- voided movements do not appear in active `Recent Activity` overview surfaces
- void events should still be visible in document history and finance-ledger contexts using descriptive business language rather than internal identifiers

## 6. API Surface

Operational finance V1 currently exposes:

- `GET /api/accounts/overview`
- `GET /api/accounts/financial-accounts`
- `POST /api/accounts/financial-accounts`
- `POST /api/accounts/financial-accounts/:accountId/archive`
- `GET /api/accounts/expense-categories`
- `GET /api/accounts/money-movements`
- `POST /api/accounts/payments/received`
- `POST /api/accounts/payments/made`
- `POST /api/accounts/expenses`
- `GET /api/accounts/expenses`
- `GET /api/accounts/open-documents`
- `GET /api/accounts/document-balance`

Open-document and balance endpoints are now invoice-focused:

- receivable flow uses `SALES_INVOICE`
- payable flow uses `PURCHASE_INVOICE`

Return documents are not treated as standalone receivable/payable rows in overview rollups.

## 7. Frontend Surface

The finance module currently ships these screens:

- Financial Overview
- Payments Received
- Payments Made
- Expenses
- Accounts

Invoice surfaces now show settlement context:

- purchase invoices show settlement badge, cash paid, returns applied, outstanding or supplier credit, and settlement timing
- sales invoices show settlement summary from received payments and linked sales returns

Purchase wording is more settlement-aware:

- `Paid`
- `Settled`
- `Settled by Return`
- `Supplier Credit`

Sales wording is now similarly settlement-aware:

- `Paid`
- `Settled`
- `Settled by Return`
- `Customer Credit`

## 8. Current Phase Boundaries

This RFC records the current phased agreement:

### Implemented

- operational finance tables and APIs
- payment creation against invoices
- auto-paid posting flow for cash purchase invoices
- expense entry
- business money accounts
- invoice detail settlement summary
- purchase-return-aware purchase invoice settlement
- sales-return-aware sales invoice settlement
- payment void endpoint for posted payment movements
- overview cards for customer receivable, customer credit, supplier payable, and supplier credit

### Deferred

- expense or generic non-payment void / recreate flow
- party-level outstanding and unapplied credit views
- unapplied customer/supplier credit UX
- multi-document allocation UI in one payment entry
- attachment support
- accounting-journal bridge
- aging reports and deeper settlement analytics

## 9. Policy Decisions for V1

1. Single currency only. `INR` is the only supported finance currency in this phase.
2. Posted money movements are operationally immutable. Corrections should follow a void-and-recreate direction, not in-place amount editing.
3. Settlement uses tax-inclusive document totals via `grand_total`.
4. Purchase returns may reduce purchase invoice exposure without a cash payment.
5. Purchase returns do not create standalone customer receivables or supplier payables in finance overview rollups.
6. Sales returns may reduce sales invoice exposure without a receipt entry.
7. Overview terminology should stay symmetric:
   - `Customer Receivable`
   - `Customer Credit`
   - `Supplier Payable`
   - `Supplier Credit`

## 10. Recommended Next Phase

The next finance phase should focus on:

1. sales-return-aware settlement for `SALES_INVOICE`
2. reversal / void flow for money movements
3. party-level financial summaries
4. unapplied credit handling
5. multi-document allocation UX
6. stronger finance-specific automated tests

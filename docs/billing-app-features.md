# Billing App Feature Inventory

Last reviewed: 2026-04-20

This document summarizes the current billing-app feature set implemented in this repository. It is based on the current codebase and the canonical product rules in [ARCHITECTURE.md](../ARCHITECTURE.md), [DESIGN_GUIDELINES.md](../DESIGN_GUIDELINES.md), [docs/rfcs/sales-engine-v2.md](./rfcs/sales-engine-v2.md), [docs/rfcs/sales-engine-v2-checklist.md](./rfcs/sales-engine-v2-checklist.md), [docs/rfcs/payments-operational-v1.md](./rfcs/payments-operational-v1.md), [docs/rfcs/payments-operational-v1-checklist.md](./rfcs/payments-operational-v1-checklist.md), and [docs/sync-pattern-and-sales-state.md](./sync-pattern-and-sales-state.md).

The scope here is the user-facing billing workflow around sales documents, POS, receipts, returns, and invoice settlement, plus the finance features directly tied to billing operations.

## 1. Billing App Scope

The billing app currently covers:

- sales quotations / estimates
- sales orders
- delivery challans
- sales invoices / bills
- sales returns / credit notes
- POS sales
- invoice receipts and settlement tracking
- customer-facing billing document lifecycle and history
- business money-account setup needed for receipts and payments
- expense capture and finance overview adjacent to billing

## 2. Core Billing Documents

### 2.1 Sales Quotations / Estimates

Supported features:

- Create, edit, save, and post sales estimates
- Maintain estimate numbering with `EST-` prefix
- Capture customer, line items, notes, taxes, and validity date
- Convert estimates to sales orders
- Convert estimates to sales invoices
- Track lifecycle history and status changes
- Duplicate an existing estimate into a new draft

Business rules:

- Estimates participate in the shared sales workspace
- Estimate expiry is backend-owned, not client-derived
- Expired estimates remain part of document history

### 2.2 Sales Orders

Supported features:

- Create, edit, save, and post sales orders
- Maintain numbering with `SO-` prefix
- Capture customer, item lines, taxes, notes, and totals
- Convert orders to delivery challans
- Convert orders directly to sales invoices
- Show backend-authoritative remaining conversion quantities
- Track completion using line-level fulfillment balance
- Duplicate orders into new drafts
- View document history

Business rules:

- Order completion is based on remaining quantity to ship
- Conversion ceilings are backend-authored

### 2.3 Delivery Challans

Supported features:

- Create, edit, save, and post delivery challans
- Maintain numbering with `DC-` prefix
- Capture dispatch date, carrier, and dispatch reference
- Convert challans to invoices
- Convert challans to sales returns
- Show challan return progress in billing lists
- Duplicate challans into new drafts
- View document history

Business rules:

- Challans are stock-affecting documents for product items
- Challan-linked returns restore shipped quantity
- Challan-backed invoices do not deduct stock again for linked lines

### 2.4 Sales Invoices / Bills

Supported features:

- Create, edit, save, and post sales invoices
- Maintain numbering with `INV-` prefix
- Support both `CASH` and `CREDIT` transaction types
- Capture customer, line items, taxes, notes, totals, and settlement context
- Create standalone direct invoices
- Create invoices from estimates, orders, and challans
- Record receipts directly from invoice context
- Show settlement status in list and detail views
- Show paid amount, return-applied amount, outstanding amount, and overpaid/customer-credit state
- Duplicate invoices into new drafts
- View lifecycle and conversion history

Business rules:

- Sales invoices are server-authoritative real-time documents
- Credit invoices require an existing customer
- Posted invoices are immutable for ordinary editing
- Posted invoice settlement is derived from finance records and linked sales returns, not stored as invoice truth

### 2.5 Sales Returns / Credit Notes

Supported features:

- Create, edit, save, and post sales returns
- Maintain numbering with `SRN-` prefix
- Create returns from posted sales invoices
- Create returns from posted delivery challans
- Default return location from the source document
- Override return location before posting when needed
- Show return quantities based on backend return ceilings
- View return history
- Duplicate returns into new drafts

Business rules:

- Standalone sales returns are blocked
- Sales returns must point to a sales invoice or delivery challan
- Invoice-linked returns reduce invoice settlement exposure
- Challan-linked returns refill shipment balance for the source flow
- Sales returns add stock back for product items

## 3. Shared Document Workspace Features

All core sales documents use one shared dense billing workspace.

Supported shared features:

- Combined browse-and-edit document workspace
- Dense tabular line-entry experience
- Shared customer lookup and selection
- Shared item lookup and variant selection
- Shared tax and totals calculation
- Shared notes field
- Shared list of recent drafts and posted documents
- Shared row-menu actions for open, duplicate, history, convert, and server actions
- Local draft persistence
- Backend draft persistence when online
- Draft deletion for local drafts
- Conflict handling for duplicate document numbers with backend suggestions

Document metadata supported inside the workspace:

- validity date for estimates
- dispatch date for challans
- dispatch carrier for challans
- dispatch reference for challans
- transaction type for invoices
- location selection where the workflow requires it

## 4. Line Item and Pricing Features

Supported line-entry features:

- Add product and service items to billing documents
- Use shared item option lookup for variant selection
- Inline quantity, unit price, tax rate, and tax mode editing
- Support `EXCLUSIVE` and `INCLUSIVE` tax modes
- Automatic subtotal, tax-total, and grand-total calculation
- Preserve immutable price snapshots on posted documents
- Normalize GST/tax slab usage in the document workflow

Mixed-origin and conversion-aware line features:

- Converted lines can carry explicit `sourceLineId`
- Linked lines are capped by backend remaining quantity
- Ad-hoc lines can be added alongside linked lines
- Linked and ad-hoc lines remain distinct
- Item identity stays locked for linked rows
- Users can reduce linked quantities below the source cap
- Extra quantity beyond source balance must be added as a separate ad-hoc row
- Same-item mixed-origin helper hints are shown when relevant
- Removing linked rows restores source availability without clearing parent provenance

Duplicate-document pricing safeguards:

- Duplicated drafts preserve original prices
- Warnings surface if duplicated items are no longer available
- Warnings surface when current catalog pricing differs from duplicated price context
- Users can refresh duplicated prices to current pricing

## 5. Conversion Flows

Supported billing conversions:

- Estimate -> Sales Order
- Estimate -> Sales Invoice
- Sales Order -> Delivery Challan
- Sales Order -> Sales Invoice
- Delivery Challan -> Sales Invoice
- Delivery Challan -> Sales Return
- Sales Invoice -> Sales Return

Conversion behavior:

- Conversion balance is loaded from a backend endpoint, not computed locally
- Child drafts prefill from backend remaining quantities
- Conversion quantity is blocked if it exceeds backend-calculated balance
- Parent-child quantity flow is tracked at line level
- Converted drafts can mix linked and ad-hoc lines
- Parent document provenance remains attached even if linked rows are removed later

## 6. POS Billing Features

The billing app includes a POS variant built on the sales invoice document type.

Supported POS features:

- Dedicated POS screen using the shared invoice engine
- Default `CASH` transaction mode
- Quick-add item flow for fast cashier entry
- POS hotkeys for faster operation
- Cart-style editable sales line list
- Cash tendered entry at checkout
- Automatic change-due calculation
- Quick-cash buttons for exact amount, rounded amount, and common denominations
- Auto-print receipt toggle saved on the device/register
- Printable cash receipt after posting
- Recent POS sales list

POS receipt includes:

- business name
- bill number
- posted date/time
- location name when available
- customer name when available
- line items
- subtotal
- tax
- grand total
- cash tendered
- change due

## 7. Customer and Party Features Relevant to Billing

Supported customer-facing billing helpers:

- Customer selection inside billing documents
- Walk-in customer handling
- Quick-create customer from phone number in the sales workspace
- Customer snapshot capture on the document
- Customer name, phone, address, and GST/tax ID snapshot support

Finance context on party detail:

- Party-level total outstanding summary
- Open invoice count
- Unapplied payment / advance summary
- Document credit summary
- Recent party finance activity on customer detail

## 8. Settlement, Receipts, and Finance Features

### 8.1 Invoice Settlement

Supported settlement features for sales invoices:

- Derived settlement summary on invoice APIs
- Settlement badge in invoice list
- Settlement summary in invoice detail/workspace
- Support for `UNPAID`, `PARTIAL`, `PAID`, `OVERPAID`, and `N_A`
- Sales-return-aware settlement math
- Customer-credit state when receipts and returns exceed invoice exposure
- Settlement timing fields such as `lastPaymentAt` and `fullySettledAt`

Settlement inputs currently considered:

- received-payment allocations
- linked posted sales returns

### 8.2 Payments Received

Supported billing-adjacent finance features:

- Payments Received page
- Record receipt against a posted open sales invoice
- Select receiving account such as cash, bank, or UPI
- Default amount from outstanding invoice amount
- Reference and notes capture
- Recent receipt entries table
- Void action for posted payment entries
- Record Receipt action launched from invoice context

Current payment-entry shape:

- single-document allocation per payment entry
- backend transaction creates money movement and allocation together

### 8.3 Financial Accounts

Supported features:

- Create financial accounts
- Supported types: cash, bank, UPI, credit card, other
- Opening balance capture
- Current balance display
- Archive unused accounts

### 8.4 Financial Overview

Supported overview metrics:

- Customer Receivable
- Customer Credit
- Supplier Payable
- Supplier Credit
- This Month In
- This Month Out
- Expense Total

Supported overview panels:

- recent activity
- account balances
- expense by category

### 8.5 Expenses

Supported features:

- Record paid expense entries
- Select expense category
- Select paid-via financial account
- Capture payee, date, amount, reference, and notes
- Attribute expense to the active location
- Review recent expenses list

## 9. Inventory-Linked Billing Behavior

The billing app is integrated with stock movement rules for product items.

Implemented inventory behavior:

- Delivery challans deduct stock on post
- Standalone invoices deduct stock on post
- Order-linked or estimate-linked invoices deduct stock on post
- Challan-linked invoice lines do not deduct stock again
- Sales returns add stock back on post
- Service items do not create stock ledger movement
- Posting can block on insufficient stock when negative stock is disabled
- Cancelling posted stock-affecting sales documents writes reversal stock ledger rows
- Cancelled documents stop contributing to active conversion balance

Location-aware behavior:

- sales flows can carry location context
- returns use their own stored location for stock movement
- stock movement is location-aware even though finance ownership stays business-level

## 10. Lifecycle, Audit, and Control Features

Supported lifecycle controls:

- Save draft
- Post draft
- Cancel posted document
- Reopen supported documents where policy allows
- Block void on posted sales documents

Supported audit/history features:

- Document history endpoint and UI
- History entries for creation, update, status changes, and conversion links
- Actor attribution in history
- Status edge tracking in history
- Posted and cancelled documents remain visible in history

## 11. Offline and Sync Behavior

Current offline support is intentionally limited.

Implemented offline-related behavior:

- Local billing drafts can be saved while offline
- Recent synced browse/read models can still be reviewed locally when available
- Sales document posting is blocked while offline
- The UI clearly prompts the user to reconnect before posting
- Billing documents are not generic sync entities
- Sales document writes, posting, history, and conversion balance use dedicated `/api/sales` endpoints

## 12. Access, Capability, and Module Gating

Billing access is capability-driven.

Current route and capability expectations include:

- sales module enabled
- customer capability for customer-facing sales workflows
- `TXN_SALE_CREATE` for estimates, POS, invoices, orders, and challans
- `TXN_SALE_RETURN` for sales returns
- finance module enabled for receipts and financial overview
- `FINANCE_RECEIVABLES` for payments received
- `FINANCE_PAYABLES` for payments made and expenses

## 13. Current Boundaries and Deferred Features

The billing app is operationally strong, but some finance and advanced billing workflows are still deferred.

Known deferred or incomplete areas:

- multi-document allocation in a single payment entry
- dedicated unapplied credit / advance allocation workflow
- advance receipt / advance payment UX
- attachment support for payments and expenses
- expense void / recreate workflow
- deeper aging, settlement analytics, and richer finance reporting
- broader export workflows
- offline posting of sales documents
- some remaining manual acceptance coverage around mixed-origin and challan-return edge cases

## 14. Summary

In its current repository state, the billing app already supports a full operational sales-document chain from quotation through invoice and return, plus a POS path, receipt entry, settlement visibility, stock-linked posting behavior, and finance overviews. The main missing pieces are advanced allocation workflows, richer finance reporting, attachments, and offline posting.

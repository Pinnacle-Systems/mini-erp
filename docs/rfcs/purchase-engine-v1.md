# RFC: Purchase Engine V1 (Inbound Inventory, Line-Level Integrity, and Shared Document Workspace)

This RFC is a standalone design document for iterative refinement. It records the current proposed direction for purchase workflows and does not replace [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md) or [DESIGN_GUIDELINES.md](/home/ajay/workspace/mini-erp/DESIGN_GUIDELINES.md).

**Status:** Draft / Proposed for Implementation
**Area:** Purchases, Inventory, Documents, Parties, Financials
**Core Logic:** Line-level allocation ledger, backend-authored balances, inbound inventory responsibility hierarchy, and shared dense document workspace for purchase documents.

## 1. Problem Statement

The current product already reserves purchase document types in `documents.DocumentType` and purchase capabilities in licensing, but it does not yet implement a purchase workflow. That leaves three gaps:

- no authoritative purchase document lifecycle for supplier-side transactions
- no receipt-versus-invoice stock responsibility model for inbound inventory
- no purchase-side line-link and quantity-balance engine comparable to sales

The purchase engine must support the standard inventory procurement flow without creating a second document architecture:

- `PURCHASE_ORDER`
- `GOODS_RECEIPT_NOTE`
- `PURCHASE_INVOICE`
- `PURCHASE_RETURN`

The engine should preserve the product's current architectural split:

- synced master data and inventory review remain in the sync system
- purchase document create, update, posting, and transitions are dedicated backend-authoritative real-time workflows

The engine must also preserve the product's current UI direction:

- purchase documents should reuse the same dense desktop document workspace family as sales
- purchase screens should not introduce a separate, form-heavy or low-density screen family unless a future feature-specific exception is documented

## 2. Goals and Non-Goals

### 2.1 Goals

- Implement a server-authoritative purchase document lifecycle with drafts, posting, and post-state transitions.
- Track line-level quantity flow between purchase documents through `documents.DocumentLineLink`.
- Ensure inbound inventory is moved by the correct purchase document to avoid missed stock-in or double stock-in.
- Preserve immutable posted snapshots on purchase documents instead of reconstructing them from live supplier, catalog, or pricing rows.
- Reuse the existing `documents.*` and `inventory.*` ownership model instead of creating a separate purchase-specific persistence root.
- Reuse one dense purchase document workspace pattern across purchase orders, GRNs, invoices, and returns.

### 2.2 Non-Goals

- No generic sync-mutation support for purchase posting workflows in this phase.
- No full payables ledger or supplier payment settlement engine in this phase.
- No landed-cost allocation, batch/lot tracking, serial tracking, or warehouse putaway logic in this phase.
- No vendor quotation, RFQ, or approval workflow in this phase.
- No branch-level accounting ownership exception; financial authority remains business-level with optional `location_id` attribution.

## 3. Architectural Position

The purchase engine follows the same architectural boundary that currently applies to sales:

1. Purchase drafts, posting, cancel, and reopen flows must use dedicated `/api/purchases/...` endpoints, not `/api/sync/push`.
2. The backend remains the authority for:
   - document numbering
   - line-link validation
   - remaining quantity calculations
   - inventory side effects
   - immutable posted snapshots
   - policy decisions for cancel, void, and reopen
3. The frontend may keep local draft assistance, but posting and authoritative document transitions remain online real-time operations.
4. Cross-module references must continue to use scalar IDs plus snapshots, not new cross-schema foreign keys between `documents`, `parties`, `catalog`, `inventory`, and `accounts`.

## 4. Data Model Direction

### 4.1 Reuse Existing Document Types

The purchase engine should use the existing `documents.DocumentType` values:

- `PURCHASE_ORDER`
- `GOODS_RECEIPT_NOTE`
- `PURCHASE_INVOICE`
- `PURCHASE_RETURN`

`documents.DocumentLineLink` and `documents.DocumentStatus` should remain the shared quantity-flow and lifecycle primitives for both sales and purchases.

### 4.2 Document Snapshot Generalization

The current `documents.Document` shape is biased toward sales naming, especially supplier/customer snapshots and `transaction_type`.

The implementation phase should generalize this document header model so purchase documents can persist supplier-authored business snapshots without overloading customer-specific fields by name.

The shared header direction for V1 is:

- keep `party_id` as the shared scalar counterparty reference
- replace customer-biased snapshot fields with one shared `party_snapshot` shape in `documents.Document`
- include a `role` field inside `party_snapshot`, with values such as `"customer"` or `"supplier"`
- use one shared `settlement_mode` concept on `documents.Document` with `CASH | CREDIT` for invoice-like documents where commercial settlement semantics matter
- no split into separate sales-document and purchase-document tables

This means the document header should move toward shared counterparty vocabulary rather than parallel customer-only and supplier-only columns.

### 4.3 Module Ownership

Ownership remains:

- document headers, lines, and links in `documents.*`
- stock movement in `inventory.stock_ledger`
- supplier master data in `parties.Party`
- payables and downstream accounting references in `accounts.*` when that module is implemented further

Purchase documents may store:

- `party_id`
- `location_id`
- item and variant scalar IDs
- supplier and location snapshots

They must not add cross-module foreign keys as a shortcut.

## 5. Business Logic and Workflow

### 5.1 Parent Document Resolution

The engine should continue using `parent_id` without adding `parent_type`.

When processing a child purchase document, the backend must resolve the parent row to determine:

- whether the conversion path is valid
- whether the child line should consume receipt balance or invoice balance
- whether the child line is stock-affecting

### 5.2 Supported Conversion Paths

The initial purchase conversion matrix is:

- `PURCHASE_ORDER -> GOODS_RECEIPT_NOTE`
- `PURCHASE_ORDER -> PURCHASE_INVOICE`
- `GOODS_RECEIPT_NOTE -> PURCHASE_INVOICE`
- `GOODS_RECEIPT_NOTE -> PURCHASE_RETURN`
- `PURCHASE_INVOICE -> PURCHASE_RETURN`

This keeps V1 aligned with the shared line-link model:

- fulfillment links move ordered quantity into receipt or invoice fulfillment
- return links reverse previously received or invoiced quantity

### 5.2.1 Commercial Settlement on Purchase Invoices

`settlement_mode` only has operational meaning for purchase invoices in this phase.

Rules:

- `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, and `PURCHASE_RETURN` do not use `settlement_mode` to drive payment behavior
- `PURCHASE_INVOICE + CREDIT`
  - posting creates only the document and any stock side effects
  - settlement remains derived from later payments and linked returns
- `PURCHASE_INVOICE + CASH`
  - posting requires a selected financial account
  - posting creates the invoice and the linked made-payment allocation inside the same transaction
  - the created payment movement uses the invoice `location_id` as attribution

Lifecycle implications:

- cancelling a cash-posted purchase invoice must also void the linked auto-created payment movement
- reopening to draft is blocked while linked posted payment movements still exist

### 5.3 Mixed-Origin Document Policy

Purchase child documents may contain both linked and ad-hoc rows.

Rules:

1. `parent_id` remains document-level provenance even if all linked rows are later removed.
2. Only lines with a valid `source_line_id` that belongs to the selected `parent_id` may create `DocumentLineLink` rows.
3. Linked lines may be reduced below the available backend-authored cap, but may not exceed it.
4. If the user needs quantity above the linked cap, the excess quantity must be entered as a separate ad-hoc row.
5. Ad-hoc rows do not consume parent balance and do not create `DocumentLineLink` rows.
6. Ad-hoc rows still follow the child document's own inventory and validation rules.

### 5.4 Purchase Summary Surface Scope

Purchase document summaries should stay type-aware and math-first.

Rules:

- purchase invoice summaries may show settlement math because invoices are the payable-side financial documents in this phase
- purchase return summaries should focus on return math; they should not duplicate source-document metadata or reuse the same settlement block as invoices
- explanatory settlement copy should prefer compact hover affordances over large inline paragraphs when the explanation is supporting rather than primary

## 6. Inventory Responsibility (The "Stock-In" Rule)

To ensure inbound stock movement is neither missed nor double-counted, inventory responsibility is evaluated at the line level during posting.

| Line Context | Document Type | Inventory Effect |
| :--- | :--- | :--- |
| All product lines | `GOODS_RECEIPT_NOTE` | Add Stock |
| Linked line sourced from `GOODS_RECEIPT_NOTE` | `PURCHASE_INVOICE` | No Effect |
| Linked line sourced from `PURCHASE_ORDER` | `PURCHASE_INVOICE` | Add Stock |
| Ad-hoc line with no `source_line_id` | `PURCHASE_INVOICE` | Add Stock |
| All product lines | `PURCHASE_RETURN` | Deduct Stock |

Implications:

- a GRN is the stock-in owner when an invoice is created from that GRN later
- a direct or order-linked purchase invoice is the stock-in owner when no GRN has already received the goods
- purchase returns are stock-out documents and therefore must validate available stock when negative stock is not allowed

## 7. Catalog Integration

Inventory effects only apply to lines where the referenced item is a `PRODUCT`.

- `SERVICE` lines do not write `inventory.stock_ledger` rows
- `SERVICE` lines still participate in document totals, supplier billing, and line-link integrity where applicable

This remains aligned with the existing product/service distinction already used by sales and catalog flows.

## 8. Backend-Authoritative Conversion Balance

The purchase engine should expose a dedicated balance endpoint:

`GET /api/purchases/conversion-balance/:documentId`

The engine must distinguish receipt balance from invoice balance.

### 8.1 Receipt Balance for Purchase Orders

Receipt balance applies to `PURCHASE_ORDER` lines and is used for "available to receive" decisions.

For an order line:

`RemainingToReceive = OrderQty - SUM(Active receipt-consuming fulfillment links) + SUM(Active receipt-linked return links)`

Receipt-consuming fulfillment links include:

- `PURCHASE_ORDER -> GOODS_RECEIPT_NOTE`
- `PURCHASE_ORDER -> PURCHASE_INVOICE` for direct or order-linked purchase invoices

Receipt-linked return links include:

- `GOODS_RECEIPT_NOTE -> PURCHASE_RETURN`
- `PURCHASE_INVOICE -> PURCHASE_RETURN` where the purchase invoice itself was the stock-responsible receipt document

### 8.2 Invoice Balance for Receipt or Invoice Lines

Invoice balance applies to source lines that are being invoiced or returned.

For a generic source line:

`RemainingQty = OriginalQty - SUM(Active fulfillment links) + SUM(Active return links)`

For a GRN line being converted to an invoice:

`NetInvoiceableQty = ReceivedQty - SUM(Active GRN-linked return links)`

### 8.3 Active Link Definition

Only links whose target documents have:

- `posted_at != null`
- `status NOT IN (CANCELLED, VOID)`

count toward active quantity consumption.

Drafts do not consume balance.

## 9. Cancellation, Void, and Reopen Policy

The repository follows an immutable-history direction. Purchase reversal should therefore use new reversing rows rather than destructive mutation of prior stock effects.

Rules:

1. Once a document has `posted_at != null`, `VOID` is blocked by policy.
2. To reverse a posted stock-affecting purchase document, the user must use `CANCEL`.
3. On `CANCEL`, the system writes new reversal rows in `inventory.stock_ledger`.
4. On `REOPEN`, the system reapplies the stock effect using new rows rather than editing previous rows in place.
5. Cancelled and voided documents no longer count toward active quantity balance.

Inventory reversal behavior:

- cancelling a `GOODS_RECEIPT_NOTE` writes negative stock rows
- cancelling a stock-responsible `PURCHASE_INVOICE` writes negative stock rows
- cancelling a `PURCHASE_RETURN` writes positive stock rows

## 10. Location Policy

Purchase stock effects remain location-aware.

Rules:

1. Stock-affecting purchase documents must resolve a `location_id`.
2. The stock ledger must use the purchase document's own `location_id`.
3. `PURCHASE_RETURN` should default its `location_id` from the parent receipt or invoice during conversion, but persist it independently on the return document.
4. If the business does not have the `BUSINESS_LOCATIONS` capability, purchase workflows still resolve to the default location silently.

This stays aligned with the location and inventory rules in the architecture notes.

## 11. Document-Specific Rules

### 11.1 Purchase Order

- A purchase order is a planning and commitment document.
- Posting a purchase order does not move stock.
- A purchase order is marked `COMPLETED` when all lines have zero `RemainingToReceive`.

### 11.2 Goods Receipt Note

- A posted GRN adds stock for product lines.
- Standalone GRNs are supported in V1.
- A GRN may also be created from a posted purchase order when the user is working through the fuller procurement flow.
- A standalone GRN acts as the stock-in source of truth for the received lines it posts.
- A GRN-backed purchase invoice must not add stock again for linked GRN lines.

### 11.3 Purchase Invoice

- Standalone purchase invoices are supported in V1 and act as the primary stock-in trigger when no GRN exists.
- A purchase invoice converted directly from a purchase order adds stock for linked product lines.
- A purchase invoice converted from a GRN does not add stock for those linked GRN lines.
- Mixed-origin invoices are valid: GRN-linked rows may coexist with ad-hoc or order-linked rows, and only the stock-responsible rows add stock.

### 11.4 Purchase Return

- Returns may link to either a posted `PURCHASE_INVOICE` or a posted `GOODS_RECEIPT_NOTE`.
- Standalone purchase returns are blocked.
- The maximum returnable quantity per line is:
  `ReceivedOrInvoicedQty - SUM(Active Return Links)`
- Posting a purchase return deducts stock for product lines from the return document's own `location_id`.

## 12. Negative Stock Policy

Purchase returns are outbound stock movements. When the product is configured to block negative stock, purchase returns must also respect that rule.

Policy:

- if `ALLOW_NEGATIVE_STOCK=false`, posting a purchase return is rejected when `CurrentStock - ReturnQty < 0`
- if `ALLOW_NEGATIVE_STOCK=true`, posting may proceed

This keeps one consistent stock policy across sales, stock adjustments, and purchase returns.

## 13. Frontend Workspace Direction

Purchase documents should not introduce a separate interaction family. The frontend should:

- place purchase pages under `apps/frontend/src/pages/purchases/...`
- reuse one dense combined list + workspace pattern across purchase orders, GRNs, invoices, and returns
- keep the desktop experience spreadsheet-like for line entry and review
- keep supplier lookup, line entry, totals, posting, and history aligned with the existing sales workspace where possible

The purchase workspace should remain a sibling of the sales workspace, not a bespoke exception. Shared document-workspace primitives should be extracted where reuse reduces duplication without weakening feature clarity.

## 14. Capability Gating

The initial capability rules are:

- `PARTIES_SUPPLIERS` required for purchase counterparty workflows
- `TXN_PURCHASE_CREATE` required for purchase orders, GRNs, and purchase invoices
- `TXN_PURCHASE_RETURN` required for purchase returns
- `ITEM_PRODUCTS` required for product purchase flows
- `ITEM_SERVICES` remains valid for service-only supplier billing rows where no stock effect is needed

Frontend module gating direction for V1:

- add a new first-class frontend module key: `purchases`
- do not piggyback purchase routes on the existing `sales` module gate
- keep purchase module visibility and route access independently controllable from sales so operational roles can be scoped more narrowly

This supports cases such as warehouse or inward-stock users who should access inventory and purchasing workflows without gaining access to sales workflows.

## 15. API Surface Direction

The expected V1 backend shape is:

- `GET /api/purchases/documents`
- `GET /api/purchases/documents/:documentId/history`
- `GET /api/purchases/conversion-balance/:documentId`
- `POST /api/purchases/documents`
- `PATCH /api/purchases/documents/:documentId`
- `POST /api/purchases/documents/:documentId/post`
- `POST /api/purchases/documents/:documentId/action`
- `DELETE /api/purchases/documents/:documentId`

This mirrors the current sales API family intentionally so the purchase engine can reuse the same operational model without coupling purchase logic into the sales module.

## 16. Acceptance Criteria

- [ ] Purchase documents are created, updated, posted, and transitioned through dedicated `/api/purchases` endpoints.
- [ ] `DocumentLineLink` rows are created whenever converted purchase lines establish quantity flow.
- [ ] `GET /api/purchases/conversion-balance/:documentId` returns backend-authored per-line remaining quantities.
- [ ] A posted GRN writes positive `inventory.stock_ledger` rows for product lines.
- [ ] A standalone purchase invoice writes positive `inventory.stock_ledger` rows for product lines.
- [ ] An order-linked purchase invoice writes positive `inventory.stock_ledger` rows for linked product lines.
- [ ] A GRN-linked purchase invoice does not write duplicate stock-in rows for the linked GRN lines.
- [ ] An ad-hoc product line added to a GRN-backed purchase invoice writes positive stock-in rows on invoice post.
- [ ] A purchase return linked to a GRN writes negative stock rows and restores order receipt balance where applicable.
- [ ] A purchase return linked to a stock-responsible purchase invoice writes negative stock rows and restores return ceiling appropriately.
- [ ] Cancelling a posted GRN or stock-responsible purchase invoice writes negative reversal ledger rows.
- [ ] Cancelling a posted purchase return writes positive reversal ledger rows.
- [ ] `VOID` is blocked for any purchase document with `posted_at != null`.
- [ ] Service lines are excluded from inventory validation and stock movement but remain part of document totals and line-link integrity.
- [ ] Converted drafts may contain linked and ad-hoc lines without clearing `parent_id`.
- [ ] Purchase screens reuse one dense workspace pattern consistent with the current design guidelines.

## 17. Open Questions

No open questions remain in this RFC at the current V1 scope.

## 18. Notes

- Keep controllers thin and place business rules in services and policies.
- Keep all posting side effects inside one Prisma transaction.
- Validate first and mark the document posted last within that transaction.
- Do not move conversion math into the frontend.
- Do not add `parent_type`.
- Do not model posted purchase documents as generic sync entities in this phase.

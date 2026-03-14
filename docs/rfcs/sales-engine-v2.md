# RFC: Sales Engine V2 (Line-Level Integrity & Inventory Integration)

This RFC is a standalone design document for iterative refinement. It records the current agreed direction for the sales engine and does not replace [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md).

**Status:** Final / For Implementation
**Area:** Sales, Inventory, Documents
**Core Logic:** Line-level allocation ledger, Backend-authored balances, Inventory Responsibility Hierarchy, and fulfillment-aware return handling.

## 1. Problem Statement

The current sales implementation lacks granular fulfillment tracking. We must move from header-level "amount-based" progress to line-level "quantity-based" progress. This requires:

- **Direct vs. Linked Invoices:** Distinguishing when an invoice moves stock (Direct) vs. when a delivery document already moved it.
- **Line-Level Links:** A ledger to track which specific lines were fulfilled or returned.
- **Inventory Accuracy:** Ensuring the `StockLedger` is updated by the correct document in the chain.

## 2. Data Model Changes

### 2.1 DocumentLineLink (New Model)

This model tracks quantity flow between documents. It lives in the `documents` module.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `source_line_id` | UUID | FK to `documents.LineItem` |
| `target_line_id` | UUID | FK to `documents.LineItem` |
| `quantity` | Decimal | The amount allocated/converted |
| `type` | Enum | `FULFILLMENT`, `RETURN` |

### 2.2 StockLedger (Inventory Module)

Consistent with `inventory.prisma`:

- **Location:** Uses the `location_id` of the business location associated with the document.
- **References:** `reference_id` (UUID) points to the `documents.Document` ID.
- **Type Derivation:** The source of truth for the document type is the `type` field in the `documents.Document` table.

## 3. Business Logic & Workflow

### 3.1 Parent Document Resolution

Because `documents.Document` stores `parent_id` but not `parent_type`, the Sales Engine must resolve the parent record to determine conversion rules.

- **Rule:** When processing an Invoice, fetch the parent row via `parent_id`.
- This check determines if the Invoice is "Direct" (no parent, or parent is an Order/Estimate) or "Linked" (parent is a Delivery Challan).

### 3.2 Inventory Responsibility (The "Stock-Out" Rule)

To ensure stock movement is neither missed nor double-counted, inventory responsibility is evaluated at the line level during posting:

| Line Context | Document Type | Inventory Effect |
| :--- | :--- | :--- |
| **All product lines** | `DELIVERY_CHALLAN` | **Deduct Stock** |
| **Linked line sourced from `DELIVERY_CHALLAN`** | `SALES_INVOICE` | **No Effect** (Already handled by Challan) |
| **Linked line sourced from `SALES_ORDER` or `SALES_ESTIMATE`** | `SALES_INVOICE` | **Deduct Stock** |
| **Ad-hoc line with no `source_line_id`** | `SALES_INVOICE` | **Deduct Stock** |
| **All product lines** | `SALES_RETURN` | **Add Stock** |

### 3.3 Catalog Integration (Stock vs. Service)

Inventory effects only apply to items where `item.type == 'PRODUCT'`.

- Items categorized as `SERVICE` will skip `StockLedger` entries but will still generate `DocumentLineLink` records for line-link and conversion tracking.

### 3.4 Mixed-Origin Document Policy

Documents created via conversion support mixed-origin line items.

- **Linked lines:** contain a non-null `source_line_id`, consume parent balance, and are capped by the parent line's backend-authored remaining quantity.
- **Ad-hoc lines:** contain no `source_line_id`, do not consume parent balance, and do not create `DocumentLineLink` rows.

Rules:

1. `parent_id` remains as document-level provenance even if all linked rows are removed from the child draft.
2. Only lines with a valid `source_line_id` that belongs to the selected `parent_id` may create `DocumentLineLink` rows.
3. Linked lines may be reduced below the parent cap, but may not exceed it.
4. If the user needs quantity above the linked cap, the extra quantity must be entered as a separate ad-hoc line.
5. Ad-hoc lines follow the child document's own stock and return rules, but never affect upstream parent completion or refill logic unless they have linked ancestry.

## 4. Calculations & Reversals

### 4.1 Backend-Authoritative Conversion Balance

**Endpoint:** `GET /sales/conversion-balance/{document_id}`

The sales engine must distinguish shipment balance from invoice balance when fulfillment returns are allowed.

**Shipment balance** applies to `SALES_ORDER` lines and is used for "available to ship" decisions.

For an order line:
`RemainingToShip = OrderQty - SUM(Active shipment-consuming fulfillment links) + SUM(Active challan-linked return links)`

Shipment-consuming fulfillment links include:
- `Order -> Delivery Challan`
- `Order -> Sales Invoice` for direct/order-linked invoices

Challan-linked return links include:
- `Delivery Challan -> Sales Return`

**Invoice balance** applies to source lines that are being invoiced or returned.

For a generic source line:
`RemainingQty = OriginalQty - SUM(Active FULFILLMENT links) + SUM(Active RETURN links)`

For a challan line being converted to invoice:
`NetInvoiceableQty = ChallanQty - SUM(Active challan-linked return links)`

- **Active Link Definition:** Only links whose target documents have `posted_at != null` AND a status NOT IN (`CANCELLED`, `VOID`) are included.
- **Drafts:** `DRAFT` documents do not consume balance.
- **Explicit linkage:** When `source_line_id` is present on a child line, the backend validates that it belongs to the selected parent document and uses that line as the authoritative consumption source. Lines with `source_line_id = null` are treated as ad-hoc and ignored by parent balance calculations.

### 4.2 Cancellation & Void Policy

The repository follows an immutable history pattern. Reversal of operational effects is handled as follows:

1. **Block Void on Posted Docs:** Once a document has `posted_at != null`, the `VOID` action is **blocked** by the policy layer.
2. **Mandatory Cancellation:** To reverse a posted stock-affecting document, the user must use the `CANCEL` action.
3. **Inventory Reversal:** Upon `CANCEL`, the system writes **new reversal rows** in the `StockLedger` to offset the previous stock movement.
   - Cancelling a **Challan/Direct Invoice** writes a positive (stock-in) entry.
   - Cancelling a **Sales Return** writes a negative (stock-out) entry.
4. **Balance Reversal:** Once `CANCELLED`, a document is automatically excluded from the "Active Balance" query described in Section 4.1, effectively restoring "available to convert" or "available to return" quantity.

## 5. Document Specific Rules

### Sales Invoice

- **Return Ceiling:** A `Sales Return` can only be created against an invoice where `posted_at != null`. The maximum returnable quantity per line is: `InvoicedQty - SUM(Active Return Links)`.
- **Direct Entry:** Standalone Invoices are supported and act as the primary fulfillment trigger for inventory.

### Delivery Challan

- **Fulfillment Rejection:** A `Sales Return` may be created against a posted delivery challan to reverse shipped quantity before invoicing.
- **Net Invoicing:** When converting a challan to an invoice, invoiceable quantity per line is capped to: `ChallanQty - SUM(Active challan-linked return links)`.

### Sales Order

- **Completion:** A Sales Order is marked `COMPLETED` when all lines have zero `RemainingToShip` after applying active fulfillment links and challan-linked returns.
- **Reservation:** Explicitly **DEFERRED**. Quantity reservation logic is out of scope for this phase.

## 6. Policy Decisions for V1

1. **Two-Way Return Source of Truth:** Returns may link to either an **Invoice** or a **Delivery Challan**.
   - Invoice-linked return: financial return / credit-note flow
   - Challan-linked return: fulfillment rejection / un-shipping flow
2. **Standalone Returns:** Blocked. All `SALES_RETURN` documents must have a `parent_id` pointing to either a `SALES_INVOICE` or a `DELIVERY_CHALLAN`.
3. **Return Location:** The `Sales Return` uses the `location_id` specified on its own document header. During conversion from an Invoice or Challan, this defaults to the parent document's `location_id` but is stored independently to allow override. The `StockLedger` must always use the Return's specific `location_id`.
4. **Negative Stock Switch:** Controlled by a backend environment variable. If `false`, the `POST` service for Challans and Direct Invoices will throw a `400 Bad Request` if `CurrentStock - RequestQty < 0`.

## 7. Acceptance Criteria

- [ ] `DocumentLineLink` records are created whenever converted sales lines or return lines establish quantity flow.
- [ ] `GET /sales/conversion-balance` correctly returns `RemainingQty` using the type-aware formula.
- [ ] A standalone Invoice generates `StockLedger` entries on post.
- [ ] An Invoice converted from a Delivery Challan does **not** generate additional `StockLedger` entries.
- [ ] An ad-hoc product line added to a challan-backed Invoice generates `StockLedger` deduction on post.
- [ ] A Sales Return converted from a Delivery Challan restores stock and refills the source order's shipment balance.
- [ ] The `CANCEL` action on a stock-deducting document creates positive reversal ledger rows.
- [ ] The `CANCEL` action on a `Sales Return` creates negative reversal ledger rows and restores the return ceiling on the source Invoice.
- [ ] The `VOID` action is blocked for any document with a non-null `posted_at` value.
- [ ] Sales Returns are blocked if the requested quantity exceeds the available return ceiling on the specific source Invoice or Delivery Challan line.
- [ ] Service items are excluded from inventory validation but included in line-link tracking.
- [ ] Converted drafts may contain both linked and ad-hoc lines without detaching `parent_id`.

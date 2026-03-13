# Sales Engine V2 Implementation Checklist

This checklist tracks implementation order and task status for [RFC: Sales Engine V2](/home/ajay/workspace/mini-erp/docs/rfcs/sales-engine-v2.md). It is execution-focused and should be updated as work progresses without changing the RFC itself.

## Phase 1: Data Foundation

Goal: prepare persistence for line-level allocations and location-aware stock movement.

- [ ] Add `DocumentLineLink` to `documents.prisma`
- [ ] Add `DocumentLineLink.type` enum with `FULFILLMENT` and `RETURN`
- [ ] Add relations from `DocumentLineLink` to `documents.LineItem`
- [ ] Add indexes for `source_line_id`
- [ ] Add indexes for `target_line_id`
- [ ] Add a composite/indexed path for efficient balance lookups by `source_line_id` and `type`
- [ ] Add `location_id` to `inventory.StockLedger`
- [ ] Preserve `reference_id` as the document reference in `StockLedger`
- [ ] Generate Prisma client
- [ ] Create and apply migration locally
- [ ] Verify generated client includes `DocumentLineLink` and `StockLedger.location_id`

## Phase 2: Allocation Engine

Goal: make line-level quantity flow the source of truth.

- [ ] Create `DocumentLinkService`
- [ ] Support link creation for `Estimate -> Order`
- [ ] Support link creation for `Estimate -> Invoice`
- [ ] Support link creation for `Order -> Challan`
- [ ] Support link creation for `Order -> Invoice`
- [ ] Support link creation for `Invoice -> Sales Return`
- [ ] Ensure link writes happen transactionally with document save/post behavior
- [ ] Create `SalesBalanceService`
- [ ] Implement remaining quantity formula:
      `OriginalQty - SUM(active fulfillment links) + SUM(active return links)`
- [ ] Treat only target documents with `posted_at != null` and status not in `CANCELLED | VOID` as active
- [ ] Return per-line balance data with source metadata needed by conversion UI

## Phase 3: Conversion API and Sales Flow Wiring

Goal: connect conversion behavior to the allocation engine.

- [ ] Add `GET /api/sales/conversion-balance/:documentId`
- [ ] Validate tenant ownership and sales access on the balance endpoint
- [ ] Return backend-authored line balances only
- [ ] Extend converted child payloads to declare source line linkage
- [ ] Persist `DocumentLineLink` rows during conversion-based save/post flows
- [ ] Reject conversion quantities that exceed backend-calculated remaining quantity
- [ ] Keep direct standalone documents valid without requiring parent links

## Phase 4: Inventory Responsibility and Stock Posting

Goal: make the correct document perform stock movement.

- [ ] Create inventory responsibility resolver
- [ ] Treat `DELIVERY_CHALLAN` as stock-affecting
- [ ] Treat standalone `SALES_INVOICE` as stock-affecting
- [ ] Treat order-linked or estimate-linked `SALES_INVOICE` as stock-affecting
- [ ] Treat challan-linked `SALES_INVOICE` as non-stock-affecting
- [ ] Treat `SALES_RETURN` as stock-affecting
- [ ] Create `StockPostingService`
- [ ] On challan post, validate location and write negative `StockLedger` rows
- [ ] On direct/order-linked invoice post, validate location and write negative `StockLedger` rows
- [ ] On sales return post, validate location and write positive `StockLedger` rows
- [ ] Apply stock effects only for `PRODUCT` lines
- [ ] Skip stock validation and stock ledger writes for `SERVICE` lines
- [ ] Add `ALLOW_NEGATIVE_STOCK` backend config
- [ ] Block posting on insufficient stock when `ALLOW_NEGATIVE_STOCK=false`
- [ ] Allow posting to proceed when `ALLOW_NEGATIVE_STOCK=true`

## Phase 5: Policy Layer and Reversal Logic

Goal: enforce RFC rules for posted docs, returns, and cancellation.

- [ ] Add policy guard layer for document actions
- [ ] Block `VOID` when `posted_at != null`
- [ ] Keep draft-only edit/delete behavior unchanged
- [ ] Enforce return ceiling:
      `InvoicedQty - SUM(active return links)`
- [ ] Require all `SALES_RETURN` documents to point to a `SALES_INVOICE`
- [ ] Default return `location_id` from parent invoice during conversion
- [ ] Store return `location_id` independently on the return document
- [ ] Always use the return document’s own `location_id` for stock movement
- [ ] On cancelling posted challan/direct invoice/order-linked invoice, write positive reversal stock rows
- [ ] On cancelling posted sales return, write negative reversal stock rows
- [ ] Ensure cancelled documents no longer contribute to active balance

## Phase 6: Frontend Integration

Goal: make the shared sales workspace consume backend authority.

- [ ] Replace local conversion math with `GET /api/sales/conversion-balance/:documentId`
- [ ] Pre-fill conversion quantities from backend `remainingQuantity`
- [ ] Limit child quantities to backend-provided remaining balance
- [ ] Update sales return creation to use invoice-linked source lines
- [ ] Cap return quantities to backend return ceiling
- [ ] Default return location from invoice location
- [ ] Surface or preserve return location override according to the RFC
- [ ] Hide or disable `VOID` for posted docs in the sales workspace
- [ ] Surface stock and return validation errors from backend responses
- [ ] Make location visible and required on challans and returns

## Phase 7: Testing and Acceptance

Goal: verify the RFC end to end.

- [ ] Test `DocumentLineLink` relations and indexes
- [ ] Test balance service for partial fulfillment
- [ ] Test balance service for multiple child documents
- [ ] Test balance service for returns
- [ ] Test balance service exclusion of `CANCELLED` targets
- [ ] Test balance service exclusion of `VOID` targets
- [ ] Test standalone invoice stock deduction
- [ ] Test order-linked invoice stock deduction
- [ ] Test challan-backed invoice does not deduct stock again
- [ ] Test sales return adds stock
- [ ] Test service lines skip stock movement
- [ ] Test posted docs cannot be voided
- [ ] Test cancelling challan/direct invoice creates positive reversal rows
- [ ] Test cancelling sales return creates negative reversal rows
- [ ] Test cancelled docs no longer count as active links
- [ ] Test `ALLOW_NEGATIVE_STOCK=false` blocks insufficient-stock posting
- [ ] Test `ALLOW_NEGATIVE_STOCK=true` allows insufficient-stock posting
- [ ] Manual run: Direct Invoice -> post -> stock reduced
- [ ] Manual run: Order -> Challan -> Invoice -> stock reduced only at challan stage
- [ ] Manual run: Order -> Invoice -> stock reduced at invoice stage
- [ ] Manual run: Return over ceiling -> blocked
- [ ] Manual run: Cancel posted return -> stock reduced again and return ceiling restored
- [ ] Manual run: Posted invoice/challan void attempt -> blocked

## Notes

- [ ] Keep controllers thin; place business rules in services and policies
- [ ] Keep all posting side effects inside a single Prisma transaction
- [ ] Validate first, mark document posted last within the transaction
- [ ] Do not implement order reservation in this phase
- [ ] Do not add `parent_type`
- [ ] Do not move conversion math into the frontend

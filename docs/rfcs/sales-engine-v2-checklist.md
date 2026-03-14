# Sales Engine V2 Implementation Checklist

This checklist tracks implementation order and task status for [RFC: Sales Engine V2](/home/ajay/workspace/mini-erp/docs/rfcs/sales-engine-v2.md). It is execution-focused and should be updated as work progresses without changing the RFC itself.

Status review note: updated against tracked repository state on 2026-03-14. The Phase 1 schema is present in the current `init` migration, local migration application was user-confirmed via DB reset, and the generated Prisma client in `apps/backend/generated/prisma` includes the new Phase 1 model and fields.

## Phase 1: Data Foundation

Goal: prepare persistence for line-level allocations and location-aware stock movement.

- [x] Add `DocumentLineLink` to `documents.prisma`
- [x] Add `DocumentLineLink.type` enum with `FULFILLMENT` and `RETURN`
- [x] Add relations from `DocumentLineLink` to `documents.LineItem`
- [x] Add indexes for `source_line_id`
- [x] Add indexes for `target_line_id`
- [x] Add a composite/indexed path for efficient balance lookups by `source_line_id` and `type`
- [x] Add `location_id` to `inventory.StockLedger`
- [x] Preserve `reference_id` as the document reference in `StockLedger`
- [x] Generate Prisma client
- [x] Create and apply migration locally
- [x] Verify generated client includes `DocumentLineLink` and `StockLedger.location_id`

## Phase 2: Allocation Engine

Goal: make line-level quantity flow the source of truth.

- [x] Create `DocumentLinkService`
- [x] Support link creation for `Estimate -> Order`
- [x] Support link creation for `Estimate -> Invoice`
- [x] Support link creation for `Order -> Challan`
- [x] Support link creation for `Order -> Invoice`
- [x] Support link creation for `Invoice -> Sales Return`
- [x] Support link creation for `Challan -> Sales Return`
- [x] Ensure link writes happen transactionally with document save/post behavior
- [x] Create `SalesBalanceService`
- [x] Implement remaining quantity formula:
      `OriginalQty - SUM(active fulfillment links) + SUM(active return links)`
- [x] Distinguish shipment balance from invoice balance where challan-linked returns are allowed
- [x] Treat only target documents with `posted_at != null` and status not in `CANCELLED | VOID` as active
- [x] Return per-line balance data with source metadata needed by conversion UI

## Phase 3: Conversion API and Sales Flow Wiring

Goal: connect conversion behavior to the allocation engine.

- [ ] Add `GET /api/sales/conversion-balance/:documentId`
- [ ] Validate tenant ownership and sales access on the balance endpoint
- [ ] Return backend-authored line balances only
- [ ] Extend converted child payloads to declare source line linkage
- [ ] Persist `DocumentLineLink` rows during conversion-based save/post flows
- [ ] Reject conversion quantities that exceed backend-calculated remaining quantity
- [ ] Default challan-to-invoice quantities from net delivered quantity after challan-linked returns
- [x] Keep direct standalone documents valid without requiring parent links

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
- [ ] On challan-linked sales return post, validate location and write positive `StockLedger` rows using the challan fulfillment context
- [ ] Apply stock effects only for `PRODUCT` lines
- [ ] Skip stock validation and stock ledger writes for `SERVICE` lines
- [ ] Add `ALLOW_NEGATIVE_STOCK` backend config
- [ ] Block posting on insufficient stock when `ALLOW_NEGATIVE_STOCK=false`
- [ ] Allow posting to proceed when `ALLOW_NEGATIVE_STOCK=true`

## Phase 5: Policy Layer and Reversal Logic

Goal: enforce RFC rules for posted docs, returns, and cancellation.

- [ ] Add policy guard layer for document actions
- [ ] Block `VOID` when `posted_at != null`
- [x] Keep draft-only edit/delete behavior unchanged
- [ ] Enforce parent-specific return ceiling for invoice-linked and challan-linked returns
- [ ] Require all `SALES_RETURN` documents to point to a `SALES_INVOICE` or `DELIVERY_CHALLAN`
- [ ] Default return `location_id` from parent invoice or challan during conversion
- [x] Store return `location_id` independently on the return document
- [ ] Always use the return document’s own `location_id` for stock movement
- [ ] On cancelling posted challan/direct invoice/order-linked invoice, write positive reversal stock rows
- [ ] On cancelling posted sales return, write negative reversal stock rows
- [ ] Ensure cancelled documents no longer contribute to active balance

## Phase 6: Frontend Integration

Goal: make the shared sales workspace consume backend authority.

- [ ] Replace local conversion math with `GET /api/sales/conversion-balance/:documentId`
- [ ] Pre-fill conversion quantities from backend `remainingQuantity`
- [ ] Limit child quantities to backend-provided remaining balance
- [ ] Update sales return creation to support invoice-linked and challan-linked source lines
- [ ] Cap return quantities to backend parent-specific return ceiling
- [ ] Default return location from invoice or challan location
- [ ] Surface or preserve return location override according to the RFC
- [ ] Add challan-origin return flow in the shared sales workspace
- [ ] Hide or disable `VOID` for posted docs in the sales workspace
- [ ] Surface stock and return validation errors from backend responses
- [ ] Make location visible and required on challans and returns

## Phase 7: Testing and Acceptance

Goal: verify the RFC end to end.

- [ ] Test `DocumentLineLink` relations and indexes
- [ ] Test balance service for partial fulfillment
- [ ] Test balance service for multiple child documents
- [ ] Test balance service for returns
- [ ] Test balance service for challan-linked returns refilling order shipment balance
- [ ] Test balance service exclusion of `CANCELLED` targets
- [ ] Test balance service exclusion of `VOID` targets
- [ ] Test standalone invoice stock deduction
- [ ] Test order-linked invoice stock deduction
- [ ] Test challan-backed invoice does not deduct stock again
- [ ] Test sales return adds stock
- [ ] Test challan-linked return reduces net invoiceable quantity on the challan
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
- [ ] Manual run: Order -> Challan -> Challan-linked Return -> order shipment balance restored
- [ ] Manual run: Challan -> partial return -> Invoice defaults to net delivered quantity
- [ ] Manual run: Cancel posted return -> stock reduced again and return ceiling restored
- [ ] Manual run: Posted invoice/challan void attempt -> blocked

## Notes

- [ ] Keep controllers thin; place business rules in services and policies
- [x] Keep all posting side effects inside a single Prisma transaction
- [x] Validate first, mark document posted last within the transaction
- [ ] Do not implement order reservation in this phase
- [ ] Do not add `parent_type`
- [ ] Do not move conversion math into the frontend

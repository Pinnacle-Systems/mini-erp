# Sales Engine V2 Implementation Checklist

This checklist tracks implementation order and task status for [RFC: Sales Engine V2](/home/ajay/workspace/mini-erp/docs/rfcs/sales-engine-v2.md). It is execution-focused and should be updated as work progresses without changing the RFC itself.

Status review note: updated against tracked repository state on 2026-03-17. The Phase 1 schema remains present in the current `init` migration, including `documents.DocumentLineLink`, the supporting indexes, and `inventory.StockLedger.location_id`. The backend sales services and policy wiring are present in `apps/backend/src/modules/sales`, and the shared sales workspace consumes the backend conversion-balance endpoint with explicit `sourceLineId` handling for linked versus ad-hoc rows. Focused backend Vitest coverage exists for document linking, balance calculations, inventory responsibility, stock posting, and posted-document policy guards. Manual acceptance runs are still not represented in the repository and remain open.

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

- [x] Add `GET /api/sales/conversion-balance/:documentId`
- [x] Validate tenant ownership and sales access on the balance endpoint
- [x] Return backend-authored line balances only
- [x] Extend converted child payloads to declare source line linkage
- [x] Persist `DocumentLineLink` rows during conversion-based save/post flows
- [x] Reject conversion quantities that exceed backend-calculated remaining quantity
- [x] Default challan-to-invoice quantities from net delivered quantity after challan-linked returns
- [x] Keep direct standalone documents valid without requiring parent links
- [x] Treat `sourceLineId = null` as ad-hoc during converted draft save/post flows
- [x] Reject `sourceLineId` values that do not belong to the selected `parentId`
- [x] Keep `parent_id` as document provenance even when linked rows are removed from the child draft

## Phase 4: Inventory Responsibility and Stock Posting

Goal: make the correct document perform stock movement.

- [x] Create inventory responsibility resolver
- [x] Treat `DELIVERY_CHALLAN` as stock-affecting
- [x] Treat standalone `SALES_INVOICE` as stock-affecting
- [x] Treat order-linked or estimate-linked `SALES_INVOICE` as stock-affecting
- [x] Treat challan-linked `SALES_INVOICE` as non-stock-affecting
- [x] Treat `SALES_RETURN` as stock-affecting
- [x] Create `StockPostingService`
- [x] On challan post, validate location and write negative `StockLedger` rows
- [x] On direct/order-linked invoice post, validate location and write negative `StockLedger` rows
- [x] On sales return post, validate location and write positive `StockLedger` rows
- [x] On challan-linked sales return post, validate location and write positive `StockLedger` rows using the challan fulfillment context
- [x] Apply stock effects only for `PRODUCT` lines
- [x] Skip stock validation and stock ledger writes for `SERVICE` lines
- [x] Make invoice stock responsibility line-aware for mixed-origin challan-backed invoices
- [x] Skip stock deduction for challan-linked invoice lines while deducting ad-hoc invoice lines
- [x] Add `ALLOW_NEGATIVE_STOCK` backend config
- [x] Block posting on insufficient stock when `ALLOW_NEGATIVE_STOCK=false`
- [x] Allow posting to proceed when `ALLOW_NEGATIVE_STOCK=true`

## Phase 5: Policy Layer and Reversal Logic

Goal: enforce RFC rules for posted docs, returns, and cancellation.

- [x] Add policy guard layer for document actions
- [x] Block `VOID` when `posted_at != null`
- [x] Keep draft-only edit/delete behavior unchanged
- [x] Enforce parent-specific return ceiling for invoice-linked and challan-linked returns
- [x] Require all `SALES_RETURN` documents to point to a `SALES_INVOICE` or `DELIVERY_CHALLAN`
- [x] Default return `location_id` from parent invoice or challan during conversion
- [x] Store return `location_id` independently on the return document
- [x] Always use the return document’s own `location_id` for stock movement
- [x] On cancelling posted challan/direct invoice/order-linked invoice, write positive reversal stock rows
- [x] On cancelling posted sales return, write negative reversal stock rows
- [x] Ensure cancelled documents no longer contribute to active balance

## Phase 6: Frontend Integration

Goal: make the shared sales workspace consume backend authority.

- [x] Replace local conversion math with `GET /api/sales/conversion-balance/:documentId`
- [x] Pre-fill conversion quantities from backend `remainingQuantity`
- [x] Limit child quantities to backend-provided remaining balance
- [x] Update sales return creation to support invoice-linked and challan-linked source lines
- [x] Cap return quantities to backend parent-specific return ceiling
- [x] Default return location from invoice or challan location
- [x] Surface or preserve return location override according to the RFC
- [x] Add challan-origin return flow in the shared sales workspace
- [x] Hide or disable `VOID` for posted docs in the sales workspace
- [x] Surface stock and return validation errors from backend responses
- [x] Make location visible and required on challans and returns
- [x] Distinguish linked vs ad-hoc rows in the shared sales workspace
- [x] Lock item identity for linked rows while keeping quantity editable
- [x] Warn before removing linked rows from converted drafts
- [x] Show a same-item mixed-origin helper hint when an ad-hoc row coexists with unused linked parent balance

## Phase 7: Testing and Acceptance

Goal: verify the RFC end to end.

- [ ] Test `DocumentLineLink` relations and indexes
- [x] Test balance service for partial fulfillment
- [x] Test balance service for multiple child documents
- [x] Test balance service for returns
- [x] Test balance service for challan-linked returns refilling order shipment balance
- [x] Test balance service exclusion of `CANCELLED` targets
- [x] Test balance service exclusion of `VOID` targets
- [x] Test standalone invoice stock deduction
- [x] Test order-linked invoice stock deduction
- [x] Test challan-backed invoice does not deduct stock again
- [x] Test sales return adds stock
- [x] Test challan-linked return reduces net invoiceable quantity on the challan
- [x] Test service lines skip stock movement
- [x] Test posted docs cannot be voided
- [x] Test cancelling challan/direct invoice creates positive reversal rows
- [x] Test cancelling sales return creates negative reversal rows
- [x] Test cancelled docs no longer count as active links
- [x] Test `ALLOW_NEGATIVE_STOCK=false` blocks insufficient-stock posting
- [x] Test `ALLOW_NEGATIVE_STOCK=true` allows insufficient-stock posting
- [x] Test ad-hoc converted lines do not create `DocumentLineLink`
- [x] Test invalid explicit `sourceLineId` values are rejected
- [x] Test challan-backed mixed-origin invoice deducts stock only for ad-hoc product lines
- [ ] Manual run: Direct Invoice -> post -> stock reduced
- [ ] Manual run: Order -> Challan -> Invoice -> stock reduced only at challan stage
- [ ] Manual run: Order -> Invoice -> stock reduced at invoice stage
- [ ] Manual run: Return over ceiling -> blocked
- [ ] Manual run: Order -> Challan -> Challan-linked Return -> order shipment balance restored
- [ ] Manual run: Challan -> partial return -> Invoice defaults to net delivered quantity
- [ ] Manual run: Challan -> Invoice with linked lines plus ad-hoc item -> only ad-hoc item deducts stock at invoice stage
- [ ] Manual run: Converted draft with linked and ad-hoc lines -> removing linked row restores parent availability without clearing `parent_id`
- [ ] Manual run: Linked row reduced below cap + same item added as ad-hoc -> helper hint appears and rows remain separate
- [ ] Manual run: Cancel posted return -> stock reduced again and return ceiling restored
- [ ] Manual run: Posted invoice/challan void attempt -> blocked

## Notes

- [x] Keep controllers thin; place business rules in services and policies
- [x] Keep all posting side effects inside a single Prisma transaction
- [x] Validate first, mark document posted last within the transaction
- [x] Do not implement order reservation in this phase
- [x] Do not add `parent_type`
- [x] Do not move conversion math into the frontend
- [x] Keep parent consumption line-driven via `sourceLineId` / `DocumentLineLink`, not document totals

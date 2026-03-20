# Purchase Engine V1 Implementation Checklist

This checklist tracks implementation order and task status for [RFC: Purchase Engine V1](/home/ajay/workspace/mini-erp/docs/rfcs/purchase-engine-v1.md). It is execution-focused and should be updated as work progresses without changing the RFC itself.

Status review note: initialized against repository state on 2026-03-20. The shared `documents.DocumentType` enum already includes `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, and `PURCHASE_RETURN`, and licensing already includes `TXN_PURCHASE_CREATE` and `TXN_PURCHASE_RETURN`. No dedicated purchase backend module, purchase frontend pages, purchase route gating, or purchase workflow tests are present yet in tracked repository state.

## Phase 1: Shared Document Foundation

Goal: prepare the shared document model for both sales and purchases without creating parallel document tables.

- [x] Generalize `documents.Document` counterparty fields from customer-biased naming to shared `party_id` + `party_snapshot`
- [x] Add `party_snapshot.role` support with values such as `customer` and `supplier`
- [x] Replace or generalize `transaction_type` into shared `settlement_mode`
- [x] Support `settlement_mode` values `CASH | CREDIT` on invoice-like documents
- [x] Preserve current sales behavior while migrating document-header vocabulary
- [x] Generate Prisma client
- [ ] Create and apply migration locally
- [x] Verify sales flows still map document responses correctly after schema generalization

## Phase 2: Backend Purchase Module

Goal: add a dedicated server-authoritative purchase API family parallel to sales.

- [x] Create `apps/backend/src/modules/purchases`
- [x] Add `purchases.routes.ts`
- [x] Add `purchases.controller.ts`
- [x] Add `purchases.schema.ts`
- [x] Add `purchases.types.ts`
- [x] Register purchase routes in the backend app router
- [x] Add explicit response mappers for purchase document payloads
- [x] Enforce `PARTIES_SUPPLIERS` capability checks
- [x] Enforce `TXN_PURCHASE_CREATE` for purchase orders, GRNs, and purchase invoices
- [x] Enforce `TXN_PURCHASE_RETURN` for purchase returns

## Phase 3: Purchase Numbering and Draft Lifecycle

Goal: make draft create, update, delete, and post flows work for purchase documents.

- [x] Define purchase document metadata for `PURCHASE_ORDER`
- [x] Define purchase document metadata for `GOODS_RECEIPT_NOTE`
- [x] Define purchase document metadata for `PURCHASE_INVOICE`
- [x] Define purchase document metadata for `PURCHASE_RETURN`
- [x] Implement backend-generated suggested document numbers
- [x] Validate per-type number uniqueness within a business
- [x] Implement create draft flow
- [x] Implement update draft flow
- [x] Implement delete draft flow
- [x] Implement list documents flow
- [x] Implement document history read flow
- [x] Implement post draft flow
- [x] Implement action transition flow for `CANCEL`, `VOID`, and `REOPEN`

## Phase 4: Purchase Line-Link and Balance Engine

Goal: reuse the shared quantity-flow model for purchase conversions.

- [x] Extend shared or purchase-specific document-link rules for `PURCHASE_ORDER -> GOODS_RECEIPT_NOTE`
- [x] Extend shared or purchase-specific document-link rules for `PURCHASE_ORDER -> PURCHASE_INVOICE`
- [x] Extend shared or purchase-specific document-link rules for `GOODS_RECEIPT_NOTE -> PURCHASE_INVOICE`
- [x] Extend shared or purchase-specific document-link rules for `GOODS_RECEIPT_NOTE -> PURCHASE_RETURN`
- [x] Extend shared or purchase-specific document-link rules for `PURCHASE_INVOICE -> PURCHASE_RETURN`
- [x] Support explicit `sourceLineId` handling for purchase conversions
- [x] Reject invalid `sourceLineId` values that do not belong to the selected `parentId`
- [x] Keep `parent_id` as document provenance even when all linked rows are removed
- [x] Implement `GET /api/purchases/conversion-balance/:documentId`
- [x] Return backend-authored per-line receipt and invoice balance data
- [x] Support standalone GRN without a `parent_id`
- [x] Support standalone purchase invoice without a `parent_id`
- [x] Keep ad-hoc converted lines outside parent balance consumption

## Phase 5: Inbound Inventory Responsibility and Stock Posting

Goal: make the correct purchase document own each stock movement.

- [ ] Create purchase inventory responsibility resolver
- [ ] Treat `GOODS_RECEIPT_NOTE` as stock-affecting
- [ ] Treat standalone `PURCHASE_INVOICE` as stock-affecting
- [ ] Treat order-linked `PURCHASE_INVOICE` as stock-affecting
- [ ] Treat GRN-linked `PURCHASE_INVOICE` as non-stock-affecting for linked GRN rows
- [ ] Treat `PURCHASE_RETURN` as stock-affecting
- [ ] Create purchase stock posting service
- [ ] On GRN post, validate location and write positive `inventory.stock_ledger` rows
- [ ] On standalone purchase invoice post, validate location and write positive `inventory.stock_ledger` rows
- [ ] On order-linked purchase invoice post, validate location and write positive `inventory.stock_ledger` rows
- [ ] On GRN-backed purchase invoice post, skip duplicate stock-in for linked GRN rows
- [ ] On GRN-backed mixed-origin purchase invoice post, add stock only for stock-responsible linked or ad-hoc rows
- [ ] On purchase return post, validate location and write negative `inventory.stock_ledger` rows
- [ ] Apply stock effects only for `PRODUCT` lines
- [ ] Skip stock ledger writes for `SERVICE` lines
- [ ] Reuse `ALLOW_NEGATIVE_STOCK` policy for purchase returns

## Phase 6: Policy Layer and Reversal Logic

Goal: enforce posted-document rules and reversible stock effects.

- [ ] Block `VOID` when `posted_at != null`
- [ ] Keep draft-only edit/delete behavior unchanged
- [ ] Require `PURCHASE_RETURN` to point to a posted `PURCHASE_INVOICE` or posted `GOODS_RECEIPT_NOTE`
- [ ] Cap purchase return quantity to backend-authored return ceiling
- [ ] Default purchase return `location_id` from parent GRN or purchase invoice
- [ ] Store purchase return `location_id` independently on the return document
- [ ] On cancelling posted GRN, write negative reversal stock rows
- [ ] On cancelling stock-responsible purchase invoice, write negative reversal stock rows
- [ ] On cancelling posted purchase return, write positive reversal stock rows
- [ ] On reopening posted GRN, reapply positive stock rows
- [ ] On reopening stock-responsible purchase invoice, reapply positive stock rows
- [ ] On reopening posted purchase return, reapply negative stock rows
- [ ] Ensure cancelled and voided purchase docs no longer contribute to active balance

## Phase 7: Frontend Module and Route Gating

Goal: expose purchases as an independently permissioned module.

- [ ] Add a first-class frontend module key `purchases`
- [ ] Extend route guards to support `RequireModule moduleKey="purchases"`
- [ ] Ensure purchase shell visibility is independent from `sales`
- [ ] Keep purchase route access independently controllable for roles such as warehouse or inward-stock staff
- [ ] Add purchase navigation entry points in the app shell

## Phase 8: Frontend Purchase Workspace

Goal: add purchase pages that reuse the dense shared document workspace pattern.

- [ ] Create `apps/frontend/src/pages/purchases/...`
- [ ] Extract shared document-workspace primitives from current sales pages where reuse reduces duplication
- [ ] Add purchase orders page
- [ ] Add goods receipt notes page
- [ ] Add purchase invoices page
- [ ] Add purchase returns page
- [ ] Reuse dense combined list + workspace layout on desktop
- [ ] Keep mobile purchase flows functional with stacked sections
- [ ] Add supplier lookup using synced supplier data
- [ ] Add spreadsheet-like line editor for purchase rows
- [ ] Add location handling for stock-affecting purchase documents
- [ ] Support standalone GRN creation from the purchase workspace
- [ ] Support PO-linked GRN conversion from the purchase workspace
- [ ] Support standalone purchase invoice creation
- [ ] Support PO-linked purchase invoice conversion
- [ ] Support GRN-linked purchase invoice conversion
- [ ] Support purchase return creation from posted GRN
- [ ] Support purchase return creation from posted purchase invoice
- [ ] Surface backend validation and stock errors inline
- [ ] Hide or disable `VOID` for posted purchase docs

## Phase 9: Reporting and Downstream Effects

Goal: keep cross-module projections and downstream consumers coherent.

- [ ] Emit purchase item-activity projection rows for posted GRNs
- [ ] Emit purchase item-activity projection rows for posted purchase invoices
- [ ] Emit purchase item-activity projection rows for posted purchase returns
- [ ] Update projection behavior for cancel and reopen transitions
- [ ] Ensure reporting source types align with existing purchase source enums

## Phase 10: Testing and Acceptance

Goal: verify the purchase engine end to end.

- [ ] Test shared document-header migration for sales compatibility
- [ ] Test purchase document number uniqueness and suggestion behavior
- [ ] Test standalone GRN stock-in
- [ ] Test PO-linked GRN stock-in
- [ ] Test standalone purchase invoice stock-in
- [ ] Test order-linked purchase invoice stock-in
- [ ] Test GRN-linked purchase invoice does not stock-in again
- [ ] Test GRN-backed mixed-origin purchase invoice adds stock only for stock-responsible rows
- [ ] Test purchase return from GRN deducts stock
- [ ] Test purchase return from purchase invoice deducts stock
- [ ] Test purchase return respects return ceiling
- [ ] Test purchase return is blocked when it would make stock negative and `ALLOW_NEGATIVE_STOCK=false`
- [ ] Test purchase return is allowed when `ALLOW_NEGATIVE_STOCK=true`
- [ ] Test service lines skip stock movement
- [ ] Test invalid explicit `sourceLineId` values are rejected
- [ ] Test cancelled purchase docs no longer count as active links
- [ ] Test posted purchase docs cannot be voided
- [ ] Test cancelling posted GRN creates negative reversal rows
- [ ] Test cancelling stock-responsible purchase invoice creates negative reversal rows
- [ ] Test cancelling posted purchase return creates positive reversal rows
- [ ] Test reopening GRN reapplies stock-in rows
- [ ] Test reopening stock-responsible purchase invoice reapplies stock-in rows
- [ ] Test reopening purchase return reapplies stock-out rows
- [ ] Manual run: Standalone GRN -> post -> stock increased
- [ ] Manual run: PO -> GRN -> post -> stock increased at GRN stage
- [ ] Manual run: PO -> purchase invoice -> post -> stock increased at invoice stage
- [ ] Manual run: GRN -> purchase invoice -> post -> stock not increased again for linked rows
- [ ] Manual run: GRN-backed purchase invoice with linked lines plus ad-hoc item -> only stock-responsible rows add stock on invoice post
- [ ] Manual run: Purchase return over ceiling -> blocked
- [ ] Manual run: Cancel posted GRN -> stock reduced by reversal
- [ ] Manual run: Cancel posted purchase return -> stock restored

## Notes

- [ ] Keep controllers thin; place business rules in services and policies
- [ ] Keep all posting side effects inside a single Prisma transaction
- [ ] Validate first, mark document posted last within the transaction
- [ ] Do not add `parent_type`
- [ ] Do not move conversion math into the frontend
- [ ] Do not model posted purchase documents as generic sync entities

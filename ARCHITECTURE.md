# Architecture Notes

## Sync Direction

Current decision: build business modules first, and defer the full server-driven notification/event system until the domain model is broader.

This keeps the current sync model moving while preserving a clean upgrade path later.

## Current Status

- [x] Keep all sync conflict detection on the backend.
- [x] Replace string-matched sync failures with structured rejection codes.
- [x] Make `/api/sync/push` return machine-readable rejection metadata for every rejected mutation.
- [x] Keep the frontend responsible for local queueing, sync attempts, and rendering current sync status only.
- [ ] Avoid adding Web Push, SSE, WebSockets, or a broad event bus until inventory, sales, and similar flows are implemented.

## API Contract Rule

Rejected mutations must return structured data, not only a human-readable message string.

Current `acknowledgements` shape:

```ts
type MutationAcknowledgement =
  | {
      mutationId: string;
      status: "applied";
    }
  | SyncRejection;
```

Current `SyncRejection` shape:

```ts
type SyncRejection = {
  mutationId: string;
  status: "rejected";
  reasonCode:
    | "VERSION_CONFLICT"
    | "VALIDATION_FAILED"
    | "PERMISSION_DENIED"
    | "DEPENDENCY_MISSING";
  message: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
};
```

For version conflicts, `details` should include:

```ts
{
  currentVersion: number;
  baseVersion: number;
}
```

Example rejected acknowledgement:

```json
{
  "mutationId": "m1",
  "status": "rejected",
  "reasonCode": "VERSION_CONFLICT",
  "message": "Version conflict for item_price:abc. Current version is 4, but mutation was based on 3.",
  "entity": "item_price",
  "entityId": "abc",
  "details": {
    "currentVersion": 4,
    "baseVersion": 3
  }
}
```

Implemented in:

- `apps/backend/src/modules/sync/sync.service.ts`
- `apps/frontend/src/features/sync/engine.ts`
- `apps/frontend/src/features/sync/SyncProvider.tsx`
- `apps/frontend/src/pages/catalog/PricingPage.tsx`

## Synced Entity Lifecycle

Synced entities should expose normalized lifecycle semantics in the sync contract.

Rules:

1. Sync payloads should expose lifecycle state in camelCase as `isActive` and `deletedAt`.
2. `isActive` and `deletedAt` are the canonical entity-level lifecycle fields for synced records, even when the underlying database tables differ in how lifecycle is stored.
3. Soft-deleted synced records should be represented by `isActive: false` and a non-null `deletedAt` value.
4. Normal operational screens should derive entity status from these lifecycle fields, not from sync queue transport state.
5. Sync transport state such as queued, pending, or offline remains a separate concern and should stay out of the entity lifecycle contract.

Current `Party` rule:

1. Customer and supplier lifecycle state is currently shared at the whole `Party` row level.
2. A `Party` with `type = BOTH` does not have role-specific lifecycle fields yet, so deactivation or deletion applies to the shared row, not only one role projection.

## Frontend Page Organization

Frontend pages should follow module ownership in the filesystem.

Rules:

1. Business feature pages must live under `apps/frontend/src/pages/<module>/...`.
2. Extend the existing module folder for new screens instead of adding new root-level files under `apps/frontend/src/pages`.
3. Name page files for the local screen, not by repeating the parent module name. For example, prefer `catalog/PricingPage.tsx` over `catalog/CatalogPricingPage.tsx`.
4. Reserve non-module page folders for cross-cutting surfaces only, such as `auth`, `shell`, `system`, and platform-admin areas under `admin`.

## Backend Rule

The backend remains the authority for sync outcomes.

In `apps/backend/src/modules/sync/sync.service.ts`:

1. Continue performing version checks and conflict detection on the server.
2. Return structured rejection data at the exact point where the mutation is rejected.
3. Do not require the frontend to infer business meaning from freeform text.

## Backend Response Mapping

Public backend JSON responses should be shaped at the controller or service boundary through explicit response mappers.

Rules:

1. Keep database and Prisma field access in snake_case where that matches the persisted model.
2. Expose API and sync contracts in camelCase only.
3. Do not pass raw Prisma records directly to `res.json(...)` for stable product responses.
4. Use shared response helpers for common wrappers such as success envelopes, and keep feature-specific payload mappers close to the module that owns the contract.
5. When a response contains nested business, user, or session data, map those nested objects explicitly instead of relying on selected database field names remaining safe by convention.

Current shared helper:

- `apps/backend/src/shared/http/response-mappers.ts`

Current module-level mapper usage includes:

- `apps/backend/src/modules/admin/admin.controller.ts`
- `apps/backend/src/modules/auth/auth.controller.ts`
- `apps/backend/src/modules/sync/sync.controller.ts`
- `apps/backend/src/modules/tenant/tenant.service.ts`

## Frontend Rule

In `apps/frontend/src/features/sync/engine.ts` and `apps/frontend/src/features/sync/SyncProvider.tsx`:

1. Consume `reasonCode`, not `message.includes(...)`.
2. Treat sync failures as display concerns, not business logic.
3. Keep UI wording separate from server error semantics.

## What To Avoid For Now

Do not build these yet:

1. A full `sync_event` schema.
2. Web Push infrastructure.
3. SSE or WebSocket notification delivery.
4. Unread/read notification state.
5. A broad cross-domain event taxonomy before core modules exist.

## When To Revisit

Revisit the server-driven async event model after:

1. Inventory flows are implemented.
2. Sales flows are implemented.
3. At least two or three conflict types are real and recurring.

At that point, define:

1. Durable `sync_event` records.
2. SSE or WebSocket delivery for live sessions.
3. Web Push for background alerts.

## Decision Principle

Design for a future event system now only by making sync outcomes structured and server-authored.

Do not build the event system itself yet.

## Inventory

Current inventory rule:

1. Treat stock as business-level quantity from the frontend point of view.
2. Treat `stock_level` as a derived, backend-authored snapshot for display, not a client-authored record.
3. Do not add a separate inventory CRUD API path or client-side stock math for these screens while the sync domain is still expanding.

Implication for current screens:

1. Stock Levels should aggregate synced `stock_level` entities into business-wide totals before rendering them.
2. Stock Adjustments should remain the only place that creates inventory quantity changes from the frontend.
3. Internal transfers and location management are intentionally out of scope for the current product flow, and the inventory persistence model is now business-scoped as well.
4. Stock adjustment history should remain bounded in the default sync dataset. For now, sync only the most recent 10 `stock_adjustment` records per variant to devices, while the full audit ledger remains on the server.

## Catalog And Billing Checklist

Status legend:

- `[x]` implemented
- `[~]` partial
- `[ ]` not implemented

Sequence rule: complete each phase in order unless an explicit exception is agreed.

### Phase 1: Data Contract And Integrity

1. `[x]` Keep catalog definition and billing operations decoupled:
   - item/variant identity in `catalog.*`
   - regulatory item classification (`hsn_sac`) on `catalog.items` with type-aware validation (HSN for products, SAC for services)
   - price state and history in `pricing.*`
2. `[x]` Keep inventory as append-oriented ledger events in `inventory.stock_ledger`, with `stock_level` treated as a derived snapshot.
3. `[x]` Enforce at least one variant per item and exactly one default variant for active items.
4. `[x]` Add extensible `metadata` JSON fields to `catalog.items` and `catalog.item_variants` with ownership and validation rules:
   - metadata writes are accepted only through backend item and item-variant mutation handlers
   - `sys.*` and `billing.*` namespaces are reserved and rejected for client-authored writes
   - client-authored metadata keys must live under `custom.*`
   - metadata values must be JSON objects (or `null` to clear), with bounded depth, key count, string length, and payload size
5. `[~]` Preserve immutable sales snapshots:
   - `documents.line_items` already stores `description` and `unit_price`
   - sales/invoice generation must explicitly guarantee item/variant display data is copied at posting time

### Phase 2: Variant Authoring Model

1. `[ ]` Add key-value variant generator input that produces cartesian combinations in-memory.
2. `[ ]` Add dynamic option columns in the variant editor table (desktop), with a documented cap of 3 option dimensions for default rendering.
3. `[~]` Keep manual row support for asymmetric variants:
   - manual add/remove rows exists
   - generated combinations flow is not yet present
4. `[ ]` Add SKU assist tools:
   - deterministic SKU batch generator
   - duplicate prevention feedback before save
5. `[ ]` Add default variant display-name generation from options with manual override support.

### Phase 3: Pricing Operations

1. `[x]` Keep price write-path versioned through `item_price_events` (`SET`/`CLEARED`) when base price changes, including base dimensions:
   - `priceType` (`SALES`/`PURCHASE`)
   - `taxMode` (`EXCLUSIVE`/`INCLUSIVE`)
   - `gstSlab` (optional)
2. `[~]` Maintain dense bulk price editing as primary:
   - inline editing and `Save All (n)` exist
   - select-and-apply scoped bulk action is not yet present
3. `[ ]` Add advanced pricing editor surface (drawer or side sheet) for recurring rules, multi-currency policy, tax attributes, and advanced metadata.
4. `[ ]` Define and implement invoice description composition rules from item + option values for posted documents.

### Phase 4: Inventory UX Boundaries

1. `[x]` Keep ongoing stock changes in dedicated stock adjustment flow; do not couple them to pricing pages.
2. `[~]` Keep stock adjustments as dense desktop-first batch entry:
   - current flow supports multiple rows
   - continue reducing remaining non-conformance noted in `DESIGN_GUIDELINES.md`
3. `[ ]` Add explicit reason-code policy documentation for all stock movement entry points and reporting joins.

### Validation And Rollout Gates

1. `[ ]` Add migration and backfill plan for metadata fields and any new pricing attributes.
2. `[ ]` Add tests for:
   - default-variant invariants
   - variant immutability after usage
   - price event history continuity
   - stock negative-prevention and ledger pruning behavior
3. `[ ]` Add end-to-end flow checks for:
   - variant generation + manual overrides
   - bulk price operations
   - invoice snapshot correctness

# Architecture Notes

## Sync Direction

Current decision: build business modules first, and defer the full server-driven notification/event system until the domain model is broader.

This keeps the current sync model moving while preserving a clean upgrade path later.

## API Contract Rule

Rejected mutations must return structured data, not only a human-readable message string.

Current `acknowledgements` shape:

```ts
type AppliedOutcome = {
  category: "mutation" | "hybrid_delete";
  summary: string;
  archived: Array<{ entity: string; entityId: string }>;
  purged: Array<{ entity: string; entityId: string }>;
  updated: Array<{ entity: string; entityId: string }>;
};

type MutationAcknowledgement =
  | {
      mutationId: string;
      status: "applied";
      outcome?: AppliedOutcome;
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
    | "DEPENDENCY_MISSING"
    | "ENTITY_IN_USE";
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

Durable sync outcome rule:

1. Applied and rejected mutation results may be persisted in `sync.mutation_log` as a narrow extension of sync logging.
2. This is allowed for durable sync diagnostics and authoritative post-sync messaging only.
3. Do not generalize this into a broad cross-domain event system, notification bus, or subscription model.

## Synced Entity Lifecycle

Synced entities should expose normalized lifecycle semantics in the sync contract.

Rules:

1. Sync payloads should expose lifecycle state in camelCase as `isActive` and `deletedAt`.
2. `isActive` and `deletedAt` are the canonical entity-level lifecycle fields for synced records, even when the underlying database tables differ in how lifecycle is stored.
3. Soft-deleted synced records should be represented by `isActive: false` and a non-null `deletedAt` value.
4. Normal operational screens should derive entity status from these lifecycle fields, not from sync queue transport state.
5. Sync transport state such as queued, pending, or offline remains a separate concern and should stay out of the entity lifecycle contract.
6. `delete` remains the sync operation for soft delete/archive semantics.
7. `purge` is a separate corrective sync operation for eligible catalog-definition entities and represents physical removal, not lifecycle state.

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

## Sync Ownership

1. The backend remains the authority for sync outcomes.
2. Continue performing version checks and conflict detection on the server.
3. Return structured rejection data at the exact point where a mutation is rejected.
4. The frontend must consume `reasonCode`, not infer business meaning from freeform text.
5. Treat sync failures as display concerns in the UI, not as client-authored business logic.
6. Keep UI wording separate from server error semantics.

## Deferred Event System

Design for a future event system only by making sync outcomes structured and server-authored.

Do not build the event system itself yet. Avoid:

1. A full `sync_event` schema.
2. Web Push infrastructure.
3. SSE or WebSocket notification delivery.
4. Unread/read notification state.
5. A broad cross-domain event taxonomy before core modules exist.

Revisit this after:

1. Inventory flows are implemented.
2. Sales flows are implemented.
3. At least two or three conflict types are real and recurring.

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

## Stable Catalog And Billing Rules

1. Keep catalog definition and billing operations decoupled:
   - item/variant identity in `catalog.*`
   - regulatory item classification (`hsn_sac`) on `catalog.items` with type-aware validation
   - price state and history in `pricing.*`
2. Keep inventory as append-oriented ledger events in `inventory.stock_ledger`, with `stock_level` treated as a derived snapshot.
3. Enforce at least one variant per item and exactly one default variant for active items.
4. Metadata writes for catalog entities are accepted only through backend mutation handlers.
5. Reserve `sys.*` and `billing.*` metadata namespaces and reject them for client-authored writes.
6. Client-authored metadata keys must live under `custom.*`.
7. Metadata values must be JSON objects (or `null` to clear), with bounded depth, key count, string length, and payload size.
8. Keep the price write-path versioned through `item_price_events`, including `priceType`, `taxMode`, and applicable tax attributes.
9. Keep pricing UI in dedicated pricing flows rather than folding it into general catalog list editing.
10. Do not support asymmetric row-level option editing for a single item; define options once, generate combinations, and remove unwanted rows as whole combinations.
11. Keep ongoing stock changes in dedicated stock adjustment flows; do not couple them to pricing pages.
12. Keep destructive lifecycle actions (`archive`) distinct from corrective permanent removal (`purge`) in both API and UI.
13. Preserve immutable sales snapshots when sales posting is implemented; do not reconstruct posted documents from live catalog or price records.

# Sync Pattern and Sales Engine State

This note explains the sync pattern currently implemented in the product and describes how that pattern relates to the present sales engine. It is a current-state engineering reference, not a replacement for [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md).

The architecture rules remain authoritative, especially:

- backend authority over sync outcomes
- structured sync rejections and acknowledgements
- normalized synced lifecycle fields as `isActive` and `deletedAt`
- sales invoice create, update, and posting paths as server-authoritative real-time operations
- offline sales support limited to local draft capture until a dedicated offline posting design exists

## Overview

The product currently uses a hybrid sync model:

- the frontend keeps a per-business local cache in IndexedDB
- local changes for supported synced entities are written into an outbox
- the frontend pushes pending mutations to the backend through `/api/sync/push`
- the backend applies or rejects each mutation authoritatively and records durable results
- the frontend then pulls server-authored deltas from `/api/sync/pull`
- durable sync results can also be queried from the backend and merged with local results for UI review

This pattern is implemented today for selected master-data and inventory-oriented entities. It is not the write path for the sales engine.

## Current Sync Pattern

### Frontend local persistence

The frontend sync engine uses IndexedDB through Dexie in [db.ts](/home/ajay/workspace/mini-erp/apps/frontend/src/features/sync/db.ts).

The current local tables are:

- `outbox`: pending and processed mutations for a business
- `syncMeta`: sync metadata such as the pull cursor
- `entities`: local cache of synced entity state
- `syncResults`: recent applied and rejected sync outcomes for display

Outbox items move through a simple lifecycle:

- `pending`: queued locally and not yet acknowledged by the backend
- `applied`: accepted by the backend
- `rejected`: rejected by the backend with structured error details

The local entity cache is updated only from pull deltas, not from optimistic client-side business logic. Delete deltas are normalized into entity lifecycle fields so the cached record carries `isActive: false` and a `deletedAt` timestamp.

### Push flow

The frontend sync engine in [engine.ts](/home/ajay/workspace/mini-erp/apps/frontend/src/features/sync/engine.ts) collects pending outbox entries, normalizes them into sync mutations, and sends them to `/api/sync/push`.

Each pushed mutation carries:

- `mutationId`
- `deviceId`
- `userId`
- `entity`
- `entityId`
- `op`
- `payload`
- optional `baseVersion`
- `clientTimestamp`

On the backend, [sync.service.ts](/home/ajay/workspace/mini-erp/apps/backend/src/modules/sync/sync.service.ts) is the authority for processing these mutations. It validates:

- whether the entity type is supported for sync
- capability and license access
- mutation payload shape and business rules
- version conflicts where versioned writes apply
- dependency and usage constraints

The backend then returns one acknowledgement per mutation. The acknowledgement contract follows the architecture rules:

- applied mutations return `status: "applied"` and may include an `outcome`
- rejected mutations return `status: "rejected"` with a structured `reasonCode`, message, entity, entityId, and optional details

Current rejection codes in the sync service are:

- `VERSION_CONFLICT`
- `VALIDATION_FAILED`
- `PERMISSION_DENIED`
- `DEPENDENCY_MISSING`
- `ENTITY_IN_USE`

Applied acknowledgements may also include a backend-authored `outcome` that summarizes the effect of the mutation, including archived, purged, or updated entities.

### Durable sync results

The backend persists processed mutation results in `sync.mutation_log`, defined in [sync.prisma](/home/ajay/workspace/mini-erp/apps/backend/prisma/models/sync.prisma). This gives the system durable diagnostics and a server-authored result history without turning sync into a general event bus.

The frontend stores recent local and remote results in `syncResults` and can merge local results with `/api/sync/results` for the active business.

### Pull flow

After push, the frontend runs a cursor-based pull against `/api/sync/pull`.

The backend returns deltas with:

- the next cursor
- entity identity
- operation type
- payload data
- `serverVersion`
- `serverTimestamp`

The frontend applies these deltas into the local entity cache and advances the stored cursor. This makes the backend the source of truth for the synchronized dataset while still allowing the app to browse and stage work locally.

### Lifecycle semantics

Synced entity lifecycle is normalized to the architecture contract:

- entity lifecycle is represented as `isActive` and `deletedAt`
- sync transport state like pending or rejected belongs to the outbox and sync results, not to the business entity status itself

That separation is important in the UI: sync state is a transport concern, while entity status is a business-state concern.

## What Is Currently In Sync

The backend sync service currently supports these mutation-driven synced entities:

- customers
- suppliers
- items
- item variants
- item categories
- item collections
- item collection memberships
- item prices
- stock adjustments

Those supported entity types are defined in the backend sync service and are the entities accepted by `/api/sync/push`.

In addition to those mutation-driven entities, the frontend sync dataset also consumes pulled read models used for local browsing and review, including:

- stock levels
- recent stock adjustment history

Some of those read models can be refreshed by backend workflows that are not themselves generic sync mutations. In particular, sales-origin stock movements now append updated `stock_level` sync changes after stock-affecting sales transitions so client stock screens can reflect challan, invoice, return, cancel, and reopen effects through the normal pull path.

Per the architecture rules, stock adjustment history in the default sync dataset is intentionally bounded. The current direction is to sync only the most recent adjustment records needed for normal operational review, while the full audit ledger remains on the server.

Operationally, this means the current sync system is strongest for:

- master data
- selected pricing state
- stock adjustment workflows
- local review of synced entities while offline or between sync cycles

## Sales Engine Relationship to Sync

The sales engine does not use the generic sync mutation path for its main document lifecycle.

Sales documents are not ordinary synced entities in the current product shape. Instead, the frontend sales workspace uses dedicated sales APIs under `/api/sales/...`, including draft create/update, posting, action transitions, history, and conversion balance reads. The main backend entrypoint for this is [sales.controller.ts](/home/ajay/workspace/mini-erp/apps/backend/src/modules/sales/sales.controller.ts).

Today, the sales path works like this:

- draft create and update go through dedicated sales endpoints
- posting goes through a dedicated backend transaction, not `/api/sync/push`
- cancel and reopen go through dedicated sales actions, not sync mutations
- conversion balance is read from a dedicated sales endpoint, not computed from local sync state

Offline support for sales is intentionally limited:

- local device drafts can still be saved in the sales workspace
- the UI explicitly blocks posting while offline
- reconnecting is required before posting a sales document

This matches the architecture rule that offline sales support should remain limited to local draft capture unless a dedicated server-coordinated posting workflow is designed later.

### Why this split exists

Sales remains server-authoritative because its write path has immediate side effects and integrity requirements that are broader than ordinary synced entity mutation handling.

The current implementation depends on the backend for:

- version-aware and rule-aware validation at the point of mutation
- document numbering and uniqueness checks
- immutable posted document snapshots
- line-level parent and child conversion integrity through document links
- backend-authored conversion balances
- stock posting side effects on post, cancel, and reopen
- document history recording
- location-aware inventory effects and reversal rows

These rules are implemented across dedicated sales services, especially:

- document link handling
- balance calculation
- stock posting

Those services make posting a sales document more than a simple cached entity mutation. A posted document can deduct or restore stock, affect parent conversion state, and create immutable downstream history in one backend transaction. That is why the current sales engine is deliberately outside the generic sync entity model.

## Present State and Known Boundaries

The current state of the product can be summarized as follows:

- sync has a real outbox, cursor-based pull, durable mutation results, and a bounded local cache for supported entities
- the backend is the authority for all sync apply/reject decisions and all delta emission
- sync result history is durable enough for diagnostics and post-sync messaging, but it is not a broad event platform
- no websocket, push-notification, or general event-bus layer exists today
- sync queue state is kept separate from business lifecycle state

With respect to sales specifically:

- sales drafts, posting, transitions, and balance reads use dedicated `/api/sales` endpoints
- sales documents are not processed by the generic `/api/sync` mutation engine
- stock effects for sales happen inside sales posting and transition flows, not through generic sync mutations
- when those sales flows change on-hand stock, the backend now appends corresponding `stock_level` sync changes so synced stock-level views stay current on the client
- dedicated backend services currently own line-link integrity, balance calculations, and stock effects
- offline posting does not exist today

The practical boundary is:

- sync is the transport and cache model for selected master-data and inventory-style entities
- sales is a real-time transactional subsystem with local draft assistance, but with backend authority for operational commits

That split is intentional in the current architecture. If the product later adds offline-capable sales posting, it will need a dedicated design that preserves:

- backend authority
- numbering guarantees
- immutable posted snapshots
- inventory correctness
- location-aware side effects
- transactional consistency across document links, balances, and history

Until then, the present model should be treated as:

- generic sync for selected synchronized entities
- dedicated real-time backend workflows for sales operations that carry inventory and document side effects

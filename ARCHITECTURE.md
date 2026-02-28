# Architecture Notes

## Sync Direction

Current decision: build business modules first, and defer the full server-driven notification/event system until the domain model is broader.

This keeps the current sync model moving while preserving a clean upgrade path later.

## What To Do Now

1. Keep all sync conflict detection on the backend.
2. Replace string-matched sync failures with structured rejection codes.
3. Make `/api/sync/push` return machine-readable rejection metadata for every rejected mutation.
4. Keep the frontend responsible for local queueing, sync attempts, and rendering current sync status only.
5. Avoid adding Web Push, SSE, WebSockets, or a broad event bus until inventory, sales, and similar flows are implemented.

## API Contract Rule

Rejected mutations must return structured data, not only a human-readable message string.

Recommended shape:

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

## Backend Rule

The backend remains the authority for sync outcomes.

In `apps/backend/src/modules/sync/sync.service.ts`:

1. Continue performing version checks and conflict detection on the server.
2. Return structured rejection data at the exact point where the mutation is rejected.
3. Do not require the frontend to infer business meaning from freeform text.

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

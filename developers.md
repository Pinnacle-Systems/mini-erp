# Developer Notes

This file is a contributor-oriented companion to [README.md](/home/ajay/workspace/mini-erp/README.md).

## Canonical references

Read these before changing architecture, domain behavior, or UI patterns:

- [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md)
- [DESIGN_GUIDELINES.md](/home/ajay/workspace/mini-erp/DESIGN_GUIDELINES.md)

Decision order in this repo:

1. Explicit task instructions
2. `ARCHITECTURE.md`
3. `DESIGN_GUIDELINES.md`
4. Existing implementation

## Development workflow

Install and bootstrap:

```bash
pnpm install
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

Run the apps:

```bash
pnpm dev
```

Useful targeted commands:

```bash
pnpm backend:dev
pnpm frontend:dev
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
pnpm --filter backend lint
pnpm --filter frontend lint
pnpm lint
```

## Environment files

- [apps/backend/.env.example](/home/ajay/workspace/mini-erp/apps/backend/.env.example)
- [apps/frontend/.env.example](/home/ajay/workspace/mini-erp/apps/frontend/.env.example)

Keep backend and frontend local URLs aligned:

- Backend `PORT` defaults to `3000`
- Frontend `VITE_DEV_PROXY_TARGET` should point to that backend URL
- Frontend `VITE_API_BASE_URL` should stay blank for local proxy-based development

## Architecture constraints

- Business modules stay isolated at the persistence boundary; avoid new cross-module foreign keys unless the architecture doc is updated intentionally.
- Public backend responses should be mapped to stable camelCase contracts instead of returning raw Prisma rows.
- New frontend pages should live under module ownership paths such as `apps/frontend/src/pages/<module>/...`.
- Sync outcomes and entity lifecycle semantics should follow the documented structured contracts and `isActive` / `deletedAt` rules.

## Design constraints

- Reuse the existing design system before introducing custom primitives.
- Preserve the dense, desktop-first operational layout direction.
- Prefer explicit loading, empty, and error states.
- Keep search and filter controls aligned with the shared filter-panel pattern where applicable.

## App notes

### Backend

- Entry point: [apps/backend/server.ts](/home/ajay/workspace/mini-erp/apps/backend/server.ts)
- Prisma config: [apps/backend/prisma.config.ts](/home/ajay/workspace/mini-erp/apps/backend/prisma.config.ts)
- Prisma models are split by module under [apps/backend/prisma/models](/home/ajay/workspace/mini-erp/apps/backend/prisma/models)

### Frontend

- App README: [apps/frontend/README.md](/home/ajay/workspace/mini-erp/apps/frontend/README.md)
- Vite config: [apps/frontend/vite.config.ts](/home/ajay/workspace/mini-erp/apps/frontend/vite.config.ts)
- The frontend runs on port `5173` and proxies `/api` and `/uploads` in local development

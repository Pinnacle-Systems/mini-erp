# Mini ERP

Mini ERP is a pnpm workspace with a React frontend and an Express + Prisma backend for dense, operational business workflows.

## Tech choices

- Monorepo: `pnpm` workspaces with `turbo` for cross-app tasks
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Dexie, Workbox PWA support
- Backend: Express 5, TypeScript, Prisma, PostgreSQL, Zod
- Database shape: module-owned Prisma models under `apps/backend/prisma/models/*`

The canonical product rules live in [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md) and [DESIGN_GUIDELINES.md](/home/ajay/workspace/mini-erp/DESIGN_GUIDELINES.md).

## Repo setup

### Prerequisites

- Node.js 20+ recommended
- `pnpm` 10.x
- PostgreSQL running locally

### Install

```bash
pnpm install
```

### Environment files

1. Copy [apps/backend/.env.example](/home/ajay/workspace/mini-erp/apps/backend/.env.example) to `apps/backend/.env`
2. Copy [apps/frontend/.env.example](/home/ajay/workspace/mini-erp/apps/frontend/.env.example) to `apps/frontend/.env`
3. Update `DATABASE_URL`, `JWT_SECRET`, and any local host or port overrides

Default local ports:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`

### Database

Generate the Prisma client and apply local migrations:

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

If you want seed data, run:

```bash
pnpm --filter backend db:seed
```

## Development

Run both apps:

```bash
pnpm dev
```

Run one app at a time:

```bash
pnpm backend:dev
pnpm frontend:dev
```

The frontend dev server proxies `/api` and `/uploads` to the backend using `VITE_DEV_PROXY_TARGET`.

## Common commands

```bash
pnpm build
pnpm lint
pnpm pwa:preview
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
pnpm --filter backend lint
pnpm --filter frontend lint
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
pnpm --filter backend db:seed
```

## Workspace layout

```text
apps/
  backend/   Express API, Prisma schema, migrations, seed
  frontend/  React + Vite app
```

For contributor-specific notes, see [developers.md](/home/ajay/workspace/mini-erp/developers.md).

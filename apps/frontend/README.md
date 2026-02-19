# Frontend (React + Vite + PWA)

## Run

1. Start backend on `http://localhost:3000`.
2. Install workspace deps: `pnpm install`
3. Start frontend:

```bash
pnpm --filter frontend dev
```

The app proxies `/api/*` to backend in dev by default.

## Env

Use `apps/frontend/.env.example`:

- `VITE_API_BASE_URL`: optional absolute API base for non-proxy deployments.
- `VITE_DEV_PROXY_TARGET`: dev proxy target (default `http://localhost:3000`).

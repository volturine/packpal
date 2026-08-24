# PackPal — agent guide

Smart packing helper for trips.

Tech stack: SvelteKit (Svelte 5), SQLite (node:sqlite + drizzle-orm), local auth
(scrypt), TailwindCSS v4, adapter-node.

## Prerequisites

- Node.js **24** (`.nvmrc`, `package.json` `engines`)
- npm
- Optional: Docker for Compose workflows

## Project guidelines

- use npm as the package manager (Node 24, see `.nvmrc`)
- when installing new packages, use `npm install <pkg>` instead of manually
  editing the `package.json` file
- use modern Svelte 5 patterns and primitives (runes: `$state`, `$effect`,
  `$props`, `$derived`)
- avoid `as any` at all costs; infer types from functions where possible
- use TailwindCSS for styling; only resort to custom CSS if needed
- every Svelte component should have `lang="ts"`
- the `/app` route tree is client-rendered only (`ssr = false` in `+layout.ts`)
- match existing TypeScript / Svelte style in nearby files; no drive-by
  refactors unrelated to the change
- do not commit `.env`, `.env.dev`, credentials, or real user data

## Scripts

| Script                 | Description                                   |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Vite dev server (SvelteKit)                   |
| `npm run build`        | Production build (`adapter-node` → `build/`)  |
| `npm run preview`      | Preview the production build                  |
| `npm run lint`         | Prettier check + ESLint                       |
| `npm run format`       | Write Prettier formatting                     |
| `npm run check`        | `svelte-check` with native TypeScript         |
| `npm run test:unit`    | Vitest unit tests                             |
| `npm run test`         | Playwright e2e (isolated test DB, port 5199)  |
| `npm run test:ui`      | Playwright with UI                            |

Validate before you push: `npm run lint && npm run check && npm run test:unit`
plus `npm run build` for non-trivial changes.

## Project map

| Path                                | Role                                        |
| ----------------------------------- | ------------------------------------------- |
| `src/lib/components/`               | UI components                               |
| `src/lib/types.ts`                  | Shared TypeScript interfaces                |
| `src/lib/data/packing-templates.ts` | Packing template data                       |
| `src/lib/server/`                   | Auth (scrypt), db, schema, rate limiting,   |
|                                     | trip access, trip enrichment                |
| `src/routes/api/`                   | auth, trips, packing-items,                 |
|                                     | packing-presets, chat-messages, chat (AI)   |
| `src/lib/server/db.ts`              | node:sqlite connection (WAL mode, inline    |
|                                     | migrations)                                 |
| `src/lib/server/schema.ts`          | drizzle-orm schema                          |
| `docker/`                           | Compose templates and image                 |
| `.github/`                          | CI/CD workflow, Dependabot                  |

SQLite database file is stored in `data/packpal.db` (gitignored, auto-created
on first run). Override with `DATABASE_PATH`.

## Testing layout

- Co-located unit tests next to the code they cover (`*.test.ts`)
- Route tests mock `$lib/server/db` with an in-memory `node:sqlite` database
  (`src/lib/server/test-db-helpers.ts` has shared DDL and seed helpers)
- Prefer tests for: auth/session edge cases, trip access control (owner vs
  collaborator), rate limiting, and request validation

## Docker deployment

Compose files live in `docker/`:

- `compose.yaml` — dev/local build from source
- `compose.production.yaml` — pinned image from `PACKPAL_IMAGE`
- `compose.dev.yaml` — preview stack for CI-published `dev-*` PR images
- `compose.tailscale.yaml` — Tailscale Serve overlay (tailnet-only, no Funnel)

```sh
# dev build
docker compose --project-directory . -f docker/compose.yaml up -d --build

# production
docker compose --project-directory . \
  -f docker/compose.production.yaml --env-file .env up -d

# dev preview with Tailscale (uses .env.dev)
docker compose --project-directory . -p packpal-dev \
  -f docker/compose.dev.yaml -f docker/compose.tailscale.yaml \
  --env-file .env.dev up -d
```

SQLite lives in the `packpal-data` volume at `/data`; Tailscale state in
`tailscale-state`. Behind Tailscale Serve, set `ORIGIN`/`PACKPAL_ORIGIN` to the
`https://<host>.<tailnet>.ts.net` URL (required for CSRF).

## CI

GitHub Actions workflow: `.github/workflows/ci-cd.yaml`.

- **validate** job: lint + typecheck + unit tests + production build (required
  PR check)
- **image** job: Docker build; PRs publish `dev-*` tags only, `master`
  publishes `latest` / `master` / `sha-*`, `v*` tags add semver tags for use as
  `PACKPAL_IMAGE`

Dependabot (`.github/dependabot.yml`) updates npm, Docker, and GitHub Actions
weekly.

## Debugging tips

- AI chat needs `OPENROUTER_API_KEY`; the endpoint returns 500 with a clear
  message when unset — everything else works without it
- CSRF failures usually mean `ORIGIN` does not match the address the browser
  uses; check it first when deployments 403 on POST
- Rate limits are in-memory per process (`src/lib/server/rate-limit.ts`);
  restarting the server clears them

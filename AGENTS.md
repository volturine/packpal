PackPal — Smart packing helper for trips.

Tech stack: SvelteKit (Svelte 5), SQLite (node:sqlite + drizzle-orm), local auth (scrypt), TailwindCSS v4, adapter-node.

Project guidelines:

- use npm as the package manager (Node 24, see .nvmrc)
- when installing new packages, use `npm install <pkg>` instead of manually editing the package.json file
- use modern svelte 5 patterns and primitives (runes: $state, $effect, $props, $derived)
- avoid `as any` at all costs, try to infer types from functions as much as possible
- use tailwindcss for styling whenever possible, only resort to custom css if needed
- every svelte component should have `lang="ts"`
- run `npm run lint` to check for linting errors, `npm run format`, and `npm run check` to check for errors after making changes
- the `/app` route tree is client-rendered only (ssr = false in `+layout.ts`)
- database schema lives in `src/lib/server/schema.ts` (drizzle-orm)
- database connection in `src/lib/server/db.ts` (node:sqlite with WAL mode, inline migrations)
- auth module in `src/lib/server/auth.ts` (scrypt password hashing, session cookies)
- shared TypeScript interfaces in `src/lib/types.ts`
- API routes under `src/routes/api/` — auth, trips, packing-items, chat-messages, chat (AI)
- packing template data in `src/lib/data/packing-templates.ts`
- SQLite database file stored in `data/packpal.db` (auto-created on first run)
- Docker deployment: compose files in `docker/` (`compose.yaml` dev build, `compose.production.yaml` pinned image, `compose.tailscale.yaml` Tailscale Serve overlay); run with `docker compose --project-directory . -f docker/compose.yaml up -d`; SQLite volume `packpal-data` at `/data`
- AI chat uses OpenRouter API (OPENROUTER_API_KEY env var, optional)

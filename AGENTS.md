PackPal — Smart packing helper for trips.

Tech stack: SvelteKit (Svelte 5), SQLite (bun:sqlite + drizzle-orm), local auth (scrypt), TailwindCSS v4, adapter-node.

Project guidelines:

- use bun for the package manager
- when installing new packages, use `bun add` instead of manually editing the package.json file
- use modern svelte 5 patterns and primitives (runes: $state, $effect, $props, $derived)
- avoid `as any` at all costs, try to infer types from functions as much as possible
- use tailwindcss for styling whenever possible, only resort to custom css if needed
- every svelte component should have `lang="ts"`
- run `bun run lint` to check for linting errors, `bun run format`, and `bun run check` to check for errors after making changes
- the `/app` route tree is client-rendered only (ssr = false in `+layout.ts`)
- database schema lives in `src/lib/server/schema.ts` (drizzle-orm)
- database connection in `src/lib/server/db.ts` (bun:sqlite with WAL mode, inline migrations)
- auth module in `src/lib/server/auth.ts` (scrypt password hashing, session cookies)
- shared TypeScript interfaces in `src/lib/types.ts`
- API routes under `src/routes/api/` — auth, trips, packing-items, chat-messages, chat (AI)
- packing template data in `src/lib/data/packing-templates.ts`
- SQLite database file stored in `data/packpal.db` (auto-created on first run)
- Docker deployment: `docker compose up` with SQLite volume at `/app/data`
- AI chat uses OpenRouter API (OPENROUTER_API_KEY env var, optional)

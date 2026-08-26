# PackPal

Smart packing helper for trips: packing lists with templates, collaborators, and AI-assisted suggestions, backed by SQLite.

**Stack:** Node.js 24 + SvelteKit 5 + TypeScript · Tailwind CSS 4 · better-sqlite3 · drizzle-orm · npm

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # start the Vite/SvelteKit development server
npm run check               # Svelte and TypeScript diagnostics
npm run lint                # Prettier check + ESLint
npm run format              # Prettier write
npm run test:unit           # Vitest unit tests
npm run test                # Playwright e2e (isolated test DB, port 5199)
npm run build               # production build
npm run validate            # lint + check + unit tests + production build
```

- Use npm commands for dependency changes; do not hand-edit `package.json` or the lockfile.
- Prefer the existing npm scripts over ad-hoc scripts.
- Use Svelte 5 runes (`$state`, `$effect`, `$props`, `$derived`); every component has `lang="ts"`.
- Avoid `as any`; infer types from functions where possible. Use TailwindCSS; custom CSS only when needed.

## Definition of done

Code/config: `npm run validate` && `npm run test` before done or review. Markdown-only: skip unless asked.

- Fix failures and warnings immediately (pre-existing ones when you touch the area). Unfixable third-party stub warnings: inline comment why.
- Add backend tests for new/changed backend behavior. Route tests mock `$lib/server/db` with an in-memory `better-sqlite3` database (`src/lib/server/test-db-helpers.ts` has shared DDL and seed helpers).

## PackPal security

- Never log passwords, password hashes, session tokens, `OPENROUTER_API_KEY`, or other secrets.
- Treat changes to auth/session handling (scrypt, cookies), trip access control (owner vs collaborator), rate limiting, the AI chat proxy, and CSRF/`ORIGIN` handling as security-sensitive.
- Add focused tests and perform an extra review for changes in those areas.
- Do not commit `.env`, `.env.dev`, credentials, or real user data.

## Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

## Problem solving

- Start from the intended outcome, then trace the behavior across every relevant layer before changing code.
- Form a causal explanation and actively look for evidence that disproves it.
- Fix the cause where the responsibility belongs. Prefer clear ownership and isolation boundaries over patches at the point where symptoms appear.
- When one fix reveals another failure, investigate it independently instead of forcing it into the previous explanation.
- Before finishing, be able to explain the root cause, why the symptoms were misleading, what now prevents recurrence, and what evidence proves the fix.

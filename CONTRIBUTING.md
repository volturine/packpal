# Contributing to PackPal

Thanks for your interest in improving PackPal. This guide covers how to develop
locally, what we expect in pull requests, and where to find project docs.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- Fix bugs and improve reliability
- Improve documentation and self-hosting guides
- Add tests around auth, trip access control, and storage edge cases
- Polish accessibility and mobile UX
- Report security issues privately (see [SECURITY.md](SECURITY.md))

Please open an issue before large architectural changes so we can align on
scope.

## Development setup

### Requirements

- **Node.js 24** (see [`.nvmrc`](.nvmrc) and `engines` in `package.json`)
- npm (comes with Node)

### Install and run

```sh
git clone https://github.com/volturine/packpal.git
cd packpal
npm install
npm run dev
```

Open `http://localhost:5173/`.

### Validate before you push

```sh
npm run validate
```

This runs:

1. Prettier check + ESLint
2. `svelte-check` (TypeScript / Svelte diagnostics)
3. Vitest unit tests
4. Production build

Useful partial commands:

| Command             | Purpose                               |
| ------------------- | ------------------------------------- |
| `npm run check`     | Type / Svelte diagnostics             |
| `npm run lint`      | Prettier check + ESLint               |
| `npm run format`    | Write Prettier formatting             |
| `npm run test:unit` | Vitest suite                          |
| `npm run test`      | Playwright e2e (isolated DB, :5199)   |
| `npm run build`     | Production build                      |
| `npm run preview`   | Preview the production build via Vite |

### Docker (optional)

Build and run the development Compose template:

```sh
cp .env.example .env
docker compose --project-directory . -f docker/compose.yaml up -d --build
```

Deployment (including Tailscale) is documented in the root
[README.md](README.md).

## Project map

| Path                                | Role                                      |
| ----------------------------------- | ----------------------------------------- |
| `src/lib/components/`               | UI components                             |
| `src/lib/types.ts`                  | Shared TypeScript interfaces              |
| `src/lib/data/packing-templates.ts` | Packing template data                     |
| `src/lib/server/`                   | Auth (scrypt), db, schema, rate limiting, |
|                                     | trip access, trip enrichment              |
| `src/routes/api/`                   | auth, trips, packing-items,               |
|                                     | packing-presets, chat-messages, chat (AI) |
| `docker/`                           | Docker Compose templates and image        |

## Coding guidelines

- Prefer small, focused changes with tests for non-trivial logic.
- Use Svelte 5 runes; every component has `lang="ts"`. Avoid `as any`.
- Use TailwindCSS; custom CSS only when needed.
- Do not log secrets, passwords, session tokens, or API keys.
- Match existing TypeScript / Svelte 5 style in nearby files.
- Format with Prettier (`npm run format`). Avoid drive-by refactors unrelated
  to the change.
- Do not commit `.env`, credentials, or real user data.

## Pull requests

1. Fork and branch from `master` (or open a PR from a branch in this repo if
   you have write access).
2. Keep the PR focused; split unrelated work.
3. Ensure `npm run validate` passes locally.
4. Fill out the pull request template: what changed, why, and how you tested
   it.
5. Link related issues when applicable.

CI (`.github/workflows/ci-cd.yaml`) runs the full validation suite and an
`amd64` image build on every pull request (published as `dev-*` / `dev-sha-*`,
never `latest`).

### Commit messages

Prefer concise, imperative messages, optionally with a conventional prefix:

- `fix: ...`
- `feat: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

## Security reviews

Changes that touch any of the following need extra care and tests:

- `src/lib/server/auth.ts` (scrypt hashing, session cookies)
- Trip access control (`src/lib/server/trip-access.ts`) — owner vs collaborator
- Rate limiting (`src/lib/server/rate-limit.ts`)
- The AI chat proxy (`src/routes/api/chat/`) and `OPENROUTER_API_KEY` handling
- CSRF / `ORIGIN` handling

Report vulnerabilities privately per [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).

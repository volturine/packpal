# PackPal

Smart packing helper for trips. SvelteKit (Svelte 5) + SQLite (bun:sqlite + drizzle-orm), local auth, TailwindCSS v4.

## Development

```sh
bun install
bun run dev
```

Copy `.env.example` to `.env` and fill in what you need (`OPENROUTER_API_KEY` is optional).

Useful commands:

```sh
bun run lint        # prettier + eslint
bun run format
bun run check       # svelte-check
bun run test:unit   # vitest
bun run test        # playwright e2e
```

## Docker deployment

Dev/local stack (builds from source):

```sh
docker compose --project-directory . -f docker/compose.yaml up -d --build
```

Production stack (pinned image from `PACKPAL_IMAGE`):

```sh
docker compose --project-directory . \
  -f docker/compose.production.yaml --env-file .env up -d
```

## Tailscale

Both stacks can join your tailnet via the `docker/compose.tailscale.yaml` overlay.
Prerequisites in the Tailscale admin console: MagicDNS + HTTPS Certificates enabled.
Do not enable Funnel — Serve is tailnet-only.

1. Create a `.env` (see `.env.example`) with `TS_AUTHKEY`, `TS_HOSTNAME`, and set
   `PACKPAL_ORIGIN`/`ORIGIN` to `https://<TS_HOSTNAME>.<tailnet>.ts.net`
   (required for CSRF protection).
2. Start the stack:

```sh
docker compose --project-directory . \
  -f docker/compose.yaml -f docker/compose.tailscale.yaml \
  --env-file .env up -d
```

The app is served over HTTPS at `https://<TS_HOSTNAME>.<tailnet>.ts.net`.

SQLite data lives in the `packpal-data` volume; Tailscale state in `tailscale-state`.

## CI/CD

`.github/workflows/ci-cd.yaml` runs on every PR and push to `master`:

- **validate** — lint, typecheck, unit tests, production build
- **image** — builds `docker/Dockerfile` and pushes to GHCR (`ghcr.io/<owner>/packpal`):
  - PRs from the same repo push immutable `dev-pr-<n>` / `dev-sha-*` tags (forks build only)
  - pushes to `master` publish `latest`, `master`, and `sha-*` tags (amd64 + arm64)
  - `v*` tags additionally get semver tags (`1.2.3`, `1.2`) for use as `PACKPAL_IMAGE`

Dependabot keeps GitHub Actions, the Docker base image, and bun dependencies up to date weekly.

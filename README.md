# PackPal

Smart packing helper for trips.

> **Work in progress.** This project is under heavy construction — everything
> (features, APIs, data model) is subject to change without notice.

SvelteKit (Svelte 5) · SQLite (better-sqlite3 on Node, D1 on Cloudflare Workers; drizzle-orm) · TailwindCSS v4

## Development

Requires Node.js 24.

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in what you need (`OPENROUTER_API_KEY` is optional).

Before pushing:

```sh
npm run validate   # lint + typecheck + unit tests + build
```

See [AGENTS.md](AGENTS.md) for conventions.

## Docker

```sh
docker compose --project-directory . -f docker/compose.yaml up -d --build
```

Production image and Tailscale setups live in `docker/`.

## Cloudflare Workers

The hosted deployment runs on Cloudflare Workers with a D1 database. `wrangler.jsonc`
holds both environments: production (`packpal.kripso-world.com`, database `packpal`)
and development (`dev.packpal.kripso-world.com`, database `packpal-dev`). The schema
lives in `cf/migrations/`; Node applies the same files on startup.

```sh
npm run build:cloudflare   # Workers bundle in .svelte-kit/cloudflare/
npm run cf:dev             # wrangler dev against a local D1 (secrets from .dev.vars)
npm run cf:deploy          # production: migrate D1, deploy Worker
npm run cf:deploy:dev      # development: wipe D1, migrate, deploy Worker
```

Copy `.dev.vars.example` to `.dev.vars` for local Worker secrets. On Cloudflare the
only secret is `OPENROUTER_API_KEY`; CI puts it on the Worker after every deploy.

### Deployments

- Pushes to `master` deploy production after the validate job passes and check
  `https://packpal.kripso-world.com/health/ready`.
- The sole open pull request labeled `deploy-dev` deploys the development Worker.
  Move the label to switch the shared development environment to another pull
  request; the deploy fails if more than one open PR carries it. Every development
  deploy empties the dev D1 database first, so migrations from another PR cannot
  block it.
- Repository secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Workers
  Scripts, D1, and Workers Routes edit on the account/zone). Environment secrets
  (`development`, `production`): `OPENROUTER_API_KEY`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

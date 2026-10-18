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
secrets are `OPENROUTER_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`;
CI puts configured secrets on the Worker after every deploy. Both Stripe secrets
must be supplied together. Until then, purchases and AI inference are disabled.

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
  (`development`, `production`): `OPENROUTER_API_KEY`, `STRIPE_SECRET_KEY`,
  and `STRIPE_WEBHOOK_SECRET`. Use Stripe test keys in development and live keys in
  production. The Worker and CI reject a Stripe key from the wrong mode.

## Prepaid AI credits

AI requests use PackPal's OpenRouter account and are paid from the requesting user's
credit balance, including when the trip is shared. Packing lists remain available
without buying credits. Users add USD credit through Stripe Checkout at **AI credits**
in the app header. The minimum top-up is $5, the maximum is $100, and there is no
subscription or automatic recharge.

Each request costs **2× OpenRouter's reported cost** (50% gross margin before
payment fees), rounded up to integer microdollars before applying the multiplier.
The app reserves up to $0.30 before contacting OpenRouter, then releases the unused
portion after confirming usage. Pricing and limits live in `src/lib/billing.ts`.
Only text chat on the server-selected model is allowed, with a 16 KiB prompt budget,
1024 output tokens, provider price ceilings, and a persistent 20 requests/minute
limit per user. Atomic SQLite/D1 reservations prevent concurrent overspending.

### Stripe setup

Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the matching GitHub
environment or local secret file. Use a Stripe sandbox/test account for development;
wallet purchases and usage are isolated by test/live mode even if a Node database
is reused across modes. The development database is erased on each deployment and must never hold paid
customer credit. Test-mode chat returns explicitly simulated responses and settles
a simulated cost, so Stripe test money can never fund real inference. The app labels
this mode visibly. Production uses live credentials and preserves its D1 database.
Register these snapshot webhook endpoints in the corresponding Stripe modes:

- Test: `https://dev.packpal.kripso-world.com/api/billing/webhook`
- Live: `https://packpal.kripso-world.com/api/billing/webhook`

Subscribe to `checkout.session.completed`, `charge.refunded`,
`charge.dispute.created`, and `charge.dispute.closed`. The endpoint verifies the raw
body signature with the official Stripe SDK and retrieves the current payment
state. Credit is granted only for captured payments matching a server-created
purchase's user, amount, currency, and payment intent. Checkout redirects never
create credit. Duplicate events are idempotent; refunds and disputes reduce
available credit and can leave a negative balance if credit was already spent.
Stale events cannot restore refunded funds or undo a completed dispute outcome.

Before enabling live payments, complete a sandbox Checkout payment and confirm the
webhook increases only that user's balance, chat deducts its actual charge, and a
refund removes the corresponding unused credit. Unit tests mock Stripe and the
model provider; they do not establish that a merchant account or endpoint is live.

### Interrupted requests

The server keeps reading model usage after a browser disconnects and records the
provider generation ID. Visiting the wallet or sending another request reconciles
pending generations older than 30 seconds. Unknown spend is never refunded merely
because time elapsed. If a request failed before its generation ID was recorded,
its hold needs operator review against OpenRouter activity; do not delete pending
usage rows to recover credit, because that would discard its spending record.
Store neither prompt text nor API keys in the billing ledger. To immediately stop
AI requests, remove a required Worker secret; deleting a GitHub secret alone does
not revoke a previously installed Worker secret.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

# PackPal

Smart packing helper for trips.

> **Work in progress.** This project is under heavy construction — everything
> (features, APIs, data model) is subject to change without notice.

SvelteKit (Svelte 5) · SQLite (better-sqlite3 + drizzle-orm) · TailwindCSS v4

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

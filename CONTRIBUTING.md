# Contributing to PackPal

> **Work in progress.** The project is under heavy construction; docs and
> architecture may be outdated. When in doubt, ask in an issue.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

Requires Node.js 24.

```sh
npm install
npm run dev
```

## Before you push

```sh
npm run validate   # lint + typecheck + unit tests + build
```

For backend changes, also run e2e tests: `npm run test`.

## Guidelines

- Small, focused PRs with tests for non-trivial logic.
- Svelte 5 runes, TypeScript everywhere, TailwindCSS.
- Never log or commit secrets (`.env`, API keys, session tokens).
- Security-sensitive areas (auth/session, trip access control, rate limiting,
  AI chat proxy, CSRF) need extra care and tests — see [AGENTS.md](AGENTS.md).
- Security vulnerabilities: report privately per [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).

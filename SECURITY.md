# Security policy

PackPal is a self-hostable packing list app: users register with a password,
own trips, and share individual trips with collaborators. Trip data (items,
notes, chat messages) is stored in server-side SQLite.

## Supported versions

Security fixes are applied to the latest release on `master` and to the most
recent tagged semantic version when practical. Older tags may not receive
backports.

| Version               | Supported        |
| --------------------- | ---------------- |
| Latest `master`       | Yes              |
| Latest tagged release | Yes              |
| Older tags            | Best effort only |

## What PackPal protects

- **Passwords** are hashed with scrypt (per-user salt) and never stored or
  logged in plaintext.
- **Sessions** are opaque random tokens in `HttpOnly` cookies with server-side
  expiry; logout deletes the server-side record.
- **Trip isolation** is enforced server-side: owners and invited collaborators
  can access a trip; no one else — every API request re-checks access.
- **Secrets** (`OPENROUTER_API_KEY`, session tokens) are never returned to
  clients or written to logs.
- **CSRF** is enforced via SvelteKit's `ORIGIN`-based origin checks on
  mutations.

## What PackPal does not claim

- Trip content is **not end-to-end encrypted**. The server (and anyone who
  controls the host or its backups) can read trip data. Do not store secrets
  in trip notes you would not store in a plain server database.
- A compromised server, host, or database backup exposes all trip content and
  password hashes.
- Rate limits are in-memory per process and reset on restart; they mitigate
  abuse but are not a hard security boundary.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Prefer one of:

1. **GitHub Security Advisories** — open a private report on
   [volturine/packpal](https://github.com/volturine/packpal/security/advisories/new)
2. **Email** — if advisories are unavailable, contact the maintainer through
   the GitHub profile listed on the repository

Include as much of the following as you can:

- Description of the issue and impact
- Steps to reproduce or a minimal proof of concept
- Affected version / commit SHA
- Whether the issue is already public

We aim to acknowledge reports within **7 days** and to provide a status update
within **14 days**. Coordinated disclosure is preferred; please give us a
reasonable window before public discussion when the issue is not already known.

## Scope highlights

In scope examples:

- Authentication bypass or session fixation
- Cross-user or cross-trip data access (broken access control)
- Injection or XSS that exposes user content or secrets
- Path traversal or remote code execution in the Node/Docker deployment
- Secrets or user content leaking into logs, errors, or API responses
- AI chat proxy abuse (key extraction, request forgery)

Out of scope examples (unless they lead to a practical exploit):

- Denial of service without a realistic amplification path
- Issues that require a fully compromised client device or physical access
- Misconfiguration of a third-party reverse proxy outside our documented
  guidance (e.g. Tailscale Serve)
- Dependency vulnerabilities already fixed on `master` or with no reachable
  path

## Safe harbor

We will not pursue legal action against good-faith security research conducted
within this policy, that does not violate privacy of others, destroy data, or
disrupt production services without prior coordination.

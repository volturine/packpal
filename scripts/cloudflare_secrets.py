"""Emit Worker secrets to wrangler secret bulk; stdout must never be logged."""

import json
import os
from collections.abc import Mapping


def deployment_secrets(environ: Mapping[str, str]) -> dict[str, str]:
    key = environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENROUTER_API_KEY must be configured")
    secrets = {"OPENROUTER_API_KEY": key}
    stripe_key = environ.get("STRIPE_SECRET_KEY", "").strip()
    webhook = environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
    if bool(stripe_key) != bool(webhook):
        raise ValueError("Configure both Stripe secrets or neither")
    if stripe_key:
        mode = environ.get("STRIPE_MODE", "test")
        if mode not in ("test", "live") or not stripe_key.startswith((f"sk_{mode}_", f"rk_{mode}_")):
            raise ValueError("Stripe key does not match this deployment's payment mode")
        secrets.update(STRIPE_SECRET_KEY=stripe_key, STRIPE_WEBHOOK_SECRET=webhook)
    return secrets


if __name__ == "__main__":
    print(json.dumps(deployment_secrets(os.environ)))

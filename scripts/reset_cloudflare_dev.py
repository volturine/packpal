#!/usr/bin/env python3
"""Empty the shared Cloudflare development D1 database.

D1 migrations are append-only. Each development deploy starts from an empty
schema so the migrations of one pull request cannot block the next.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from collections.abc import Mapping, Sequence


DATABASE = "PACKPAL_DB"
DEV_ENV = "dev"
LIST_OBJECTS = (
    "SELECT type, name FROM sqlite_master WHERE type IN ('table', 'view') "
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
)


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def parse_d1_rows(payload: object) -> list[dict[str, object]]:
    blocks = payload if isinstance(payload, list) else [payload]
    rows: list[dict[str, object]] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        result_block = block.get("results") or block.get("result") or []
        if isinstance(result_block, list):
            rows.extend(item for item in result_block if isinstance(item, dict))
    return rows


def drop_sql(objects: Sequence[Mapping[str, object]]) -> str | None:
    views: list[str] = []
    tables: list[str] = []
    for obj in objects:
        name = obj.get("name")
        kind = obj.get("type")
        if not isinstance(name, str) or not name:
            raise ValueError("D1 sqlite_master row is missing a name")
        ident = quote_ident(name)
        if kind == "view":
            views.append(f"DROP VIEW IF EXISTS {ident}")
        elif kind == "table":
            tables.append(f"DROP TABLE IF EXISTS {ident}")
    statements = views + tables
    if not statements:
        return None
    return "; ".join(["PRAGMA defer_foreign_keys = ON", *statements])


def wrangler(args: Sequence[str], env: Mapping[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["npx", "wrangler", *args],
        capture_output=True,
        text=True,
        env={**os.environ, **(env or {}), "CI": "true"},
    )


def echo(result: subprocess.CompletedProcess[str]) -> None:
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)


def d1_execute(command: str, *extra: str, env: Mapping[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    result = wrangler(
        ["d1", "execute", DATABASE, "--remote", "--env", DEV_ENV, "--yes", *extra, "--command", command],
        env,
    )
    echo(result)
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    return result


def wipe_d1(env: Mapping[str, str] | None = None) -> None:
    listed = d1_execute(LIST_OBJECTS, "--json", env=env)
    try:
        payload = json.loads(listed.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit("Cloudflare D1 returned invalid JSON") from error
    sql = drop_sql(parse_d1_rows(payload))
    if sql is None:
        return
    d1_execute(sql, env=env)


def main() -> int:
    wipe_d1()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

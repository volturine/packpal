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
from graphlib import CycleError, TopologicalSorter


DATABASE = "PACKPAL_DB"
DEV_ENV = "dev"
LIST_OBJECTS = (
    'SELECT m.type, m.name, fk."table" AS parent FROM sqlite_master AS m '
    "LEFT JOIN pragma_foreign_key_list(m.name) AS fk "
    "WHERE m.type IN ('table', 'view') "
    "AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'"
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
    view_names: set[str] = set()
    table_names: list[str] = []
    parents_by_child: dict[str, set[str]] = {}
    for obj in objects:
        name = obj.get("name")
        kind = obj.get("type")
        if not isinstance(name, str) or not name:
            raise ValueError("D1 sqlite_master row is missing a name")
        if kind == "view":
            if name not in view_names:
                views.append(name)
                view_names.add(name)
        elif kind == "table":
            if name not in parents_by_child:
                table_names.append(name)
                parents_by_child[name] = set()
            parent = obj.get("parent")
            if isinstance(parent, str) and parent != name:
                parents_by_child[name].add(parent)

    table_names_set = set(table_names)
    # TopologicalSorter maps each table to its predecessors, so parents are
    # emitted before children. Only include parent tables that this reset will
    # drop; protected/internal tables are left untouched.
    graph = {
        table: parents & table_names_set
        for table, parents in parents_by_child.items()
    }
    try:
        parents_first = tuple(TopologicalSorter(graph).static_order())
    except CycleError as error:
        cycle = error.args[1] if len(error.args) > 1 else ()
        cycle_names = ", ".join(str(name) for name in cycle)
        suffix = f": {cycle_names}" if cycle_names else ""
        raise ValueError(f"D1 tables have cyclic foreign-key dependencies{suffix}") from error

    # Drop children before parents. Views are dropped first because they can
    # depend on any of the tables being removed.
    statements = [f"DROP VIEW IF EXISTS {quote_ident(name)}" for name in views]
    statements.extend(f"DROP TABLE IF EXISTS {quote_ident(name)}" for name in reversed(parents_first))
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

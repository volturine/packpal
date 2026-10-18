import json
from pathlib import Path
import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from scripts.reset_cloudflare_dev import LIST_OBJECTS, drop_sql, parse_d1_rows, quote_ident, wipe_d1


class DropSqlTests(unittest.TestCase):
    def test_empty(self):
        self.assertIsNone(drop_sql([]))

    def test_quotes_names_and_drops_views_first(self):
        sql = drop_sql(
            [
                {"type": "table", "name": 'trips"v1', "parent": "users"},
                {"type": "view", "name": "active_trips"},
                {"type": "table", "name": "d1_migrations"},
                {"type": "table", "name": "users"},
            ]
        )
        statements = sql.split("; ")
        self.assertEqual(statements[1], 'DROP VIEW IF EXISTS "active_trips"')
        self.assertEqual(statements.count('DROP TABLE IF EXISTS "trips""v1"'), 1)
        self.assertEqual(statements.count('DROP TABLE IF EXISTS "users"'), 1)
        self.assertEqual(statements.count('DROP TABLE IF EXISTS "d1_migrations"'), 1)
        self.assertLess(
            statements.index('DROP TABLE IF EXISTS "trips""v1"'),
            statements.index('DROP TABLE IF EXISTS "users"'),
        )

    def test_orders_arbitrarily_listed_tables_and_deduplicates_fk_rows(self):
        sql = drop_sql(
            [
                {"type": "table", "name": "leaf", "parent": "branch"},
                {"type": "table", "name": "branch", "parent": "root"},
                {"type": "table", "name": "leaf", "parent": "root"},
                {"type": "table", "name": "leaf", "parent": "branch"},
                {"type": "table", "name": "root", "parent": None},
            ]
        )
        self.assertIsNotNone(sql)
        drops = [statement for statement in sql.split("; ") if statement.startswith("DROP TABLE")]
        self.assertEqual(len(drops), 3)
        self.assertLess(drops.index('DROP TABLE IF EXISTS "leaf"'), drops.index('DROP TABLE IF EXISTS "branch"'))
        self.assertLess(drops.index('DROP TABLE IF EXISTS "branch"'), drops.index('DROP TABLE IF EXISTS "root"'))

    def test_ignores_self_references(self):
        sql = drop_sql([{"type": "table", "name": "tree", "parent": "tree"}])
        self.assertEqual(sql, 'PRAGMA defer_foreign_keys = ON; DROP TABLE IF EXISTS "tree"')

    def test_rejects_cycles_between_tables(self):
        with self.assertRaisesRegex(ValueError, "cyclic foreign-key dependencies"):
            drop_sql(
                [
                    {"type": "table", "name": "alpha", "parent": "beta"},
                    {"type": "table", "name": "beta", "parent": "alpha"},
                ]
            )

    def test_ignores_unknown_object_types(self):
        self.assertIsNone(drop_sql([{"type": "index", "name": "idx_trips_user"}]))

    def test_rejects_missing_names(self):
        with self.assertRaises(ValueError):
            drop_sql([{"type": "table"}])


class ParseTests(unittest.TestCase):
    def test_quote_ident(self):
        self.assertEqual(quote_ident("trips"), '"trips"')
        self.assertEqual(quote_ident('a"b'), '"a""b"')

    def test_parse_d1_rows_flattens_result_blocks(self):
        payload = json.loads(
            '[{"results": [{"type": "table", "name": "trips"}]}, '
            '{"result": [{"type": "view", "name": "active_trips"}]}]'
        )
        self.assertEqual(
            parse_d1_rows(payload),
            [
                {"type": "table", "name": "trips"},
                {"type": "view", "name": "active_trips"},
            ],
        )


class WipeTests(unittest.TestCase):
    def test_actual_listing_query_wipes_populated_migration_schema(self):
        connection = sqlite3.connect(":memory:")
        try:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            migration = Path(__file__).parents[1] / "cf" / "migrations" / "0001_initial.sql"
            migration_sql = migration.read_text(encoding="utf-8")
            connection.executescript(migration_sql)
            connection.executescript(
                """
                INSERT INTO users (id, username, password_hash, display_name, created_at)
                VALUES ('user-1', 'packpal', 'hash', 'PackPal User', 1);
                INSERT INTO sessions (id, user_id, expires_at)
                VALUES ('session-1', 'user-1', 999);
                INSERT INTO trips (id, user_id, name, destination, start_date, end_date, climate, travelers, created_at)
                VALUES ('trip-1', 'user-1', 'Trip', 'Destination', 1, 2, 'mild', 1, 1);
                INSERT INTO packing_items (id, trip_id, user_id, name, category)
                VALUES ('item-1', 'trip-1', 'user-1', 'Item', 'gear');
                INSERT INTO trip_collaborators (id, trip_id, user_id, invited_by_user_id, created_at)
                VALUES ('collaborator-1', 'trip-1', 'user-1', 'user-1', 1);
                INSERT INTO packing_presets (id, user_id, name, items, created_at)
                VALUES ('preset-1', 'user-1', 'Preset', '[]', 1);
                INSERT INTO chat_messages (id, trip_id, user_id, role, content, created_at)
                VALUES ('chat-1', 'trip-1', 'user-1', 'user', 'Hello', 1);
                CREATE TABLE _cf_internal (id TEXT PRIMARY KEY);
                """
            )

            # This uses the production listing query so the pragma join and its
            # repeated rows are covered along with the generated drop script.
            rows = [dict(row) for row in connection.execute(LIST_OBJECTS)]
            self.assertGreater(len(rows), len({row["name"] for row in rows}))
            sql = drop_sql(rows)
            self.assertIsNotNone(sql)
            connection.executescript(sql)

            app_tables = connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' "
                "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
            ).fetchall()
            self.assertEqual(app_tables, [])
            self.assertEqual(
                tuple(connection.execute("SELECT name FROM sqlite_master WHERE name = '_cf_internal'").fetchone()),
                ("_cf_internal",),
            )

            connection.executescript(migration_sql)
            reapplied_tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' "
                    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
                )
            }
            self.assertEqual(
                reapplied_tables,
                {
                    "users",
                    "sessions",
                    "trips",
                    "packing_items",
                    "trip_collaborators",
                    "packing_presets",
                    "chat_messages",
                },
            )
        finally:
            connection.close()

    @patch("scripts.reset_cloudflare_dev.echo")
    @patch("scripts.reset_cloudflare_dev.wrangler")
    def test_drops_listed_objects(self, wrangler, _echo):
        listing = json.dumps([{"results": [{"type": "table", "name": "users"}]}])
        wrangler.side_effect = [
            SimpleNamespace(returncode=0, stdout=listing, stderr=""),
            SimpleNamespace(returncode=0, stdout="", stderr=""),
        ]
        wipe_d1()
        drop_args = wrangler.call_args_list[1].args[0]
        self.assertEqual(drop_args[-1], 'PRAGMA defer_foreign_keys = ON; DROP TABLE IF EXISTS "users"')
        self.assertIn("--env", drop_args)
        self.assertEqual(drop_args[drop_args.index("--env") + 1], "dev")

    @patch("scripts.reset_cloudflare_dev.echo")
    @patch("scripts.reset_cloudflare_dev.wrangler")
    def test_skips_drop_on_empty_database(self, wrangler, _echo):
        wrangler.return_value = SimpleNamespace(returncode=0, stdout="[]", stderr="")
        wipe_d1()
        self.assertEqual(wrangler.call_count, 1)

    @patch("scripts.reset_cloudflare_dev.echo")
    @patch("scripts.reset_cloudflare_dev.wrangler")
    def test_propagates_failures(self, wrangler, _echo):
        wrangler.return_value = SimpleNamespace(returncode=1, stdout="", stderr="Unauthorized\n")
        with self.assertRaises(SystemExit) as raised:
            wipe_d1()
        self.assertEqual(raised.exception.code, 1)


if __name__ == "__main__":
    unittest.main()

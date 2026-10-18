import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from scripts.reset_cloudflare_dev import drop_sql, parse_d1_rows, quote_ident, wipe_d1


class DropSqlTests(unittest.TestCase):
    def test_empty(self):
        self.assertIsNone(drop_sql([]))

    def test_quotes_names_and_drops_views_first(self):
        sql = drop_sql(
            [
                {"type": "table", "name": 'trips"v1'},
                {"type": "view", "name": "active_trips"},
                {"type": "table", "name": "d1_migrations"},
            ]
        )
        self.assertEqual(
            sql,
            'PRAGMA defer_foreign_keys = ON; DROP VIEW IF EXISTS "active_trips"; '
            'DROP TABLE IF EXISTS "trips""v1"; DROP TABLE IF EXISTS "d1_migrations"',
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

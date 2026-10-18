import unittest

from scripts.cloudflare_secrets import deployment_secrets


class DeploymentSecretsTests(unittest.TestCase):
    def test_billing_can_be_disabled_until_stripe_is_configured(self):
        self.assertEqual(deployment_secrets({"OPENROUTER_API_KEY": "fixture"}), {"OPENROUTER_API_KEY": "fixture"})

    def test_requires_openrouter_key(self):
        with self.assertRaisesRegex(ValueError, "OPENROUTER_API_KEY"):
            deployment_secrets({})

    def test_rejects_partial_stripe_configuration(self):
        for name in ("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "both Stripe"):
                deployment_secrets({"OPENROUTER_API_KEY": "fixture", name: "fixture"})

    def test_test_and_live_keys_cannot_cross_environments(self):
        for mode in ("test", "live"):
            opposite = "live" if mode == "test" else "test"
            configured = {"OPENROUTER_API_KEY": "fixture", "STRIPE_MODE": mode, "STRIPE_SECRET_KEY": f"sk_{mode}_fixture", "STRIPE_WEBHOOK_SECRET": "whsec_fixture"}
            self.assertEqual(deployment_secrets(configured)["STRIPE_SECRET_KEY"], f"sk_{mode}_fixture")
            configured["STRIPE_SECRET_KEY"] = f"sk_{opposite}_fixture"
            with self.assertRaisesRegex(ValueError, "payment mode"):
                deployment_secrets(configured)


if __name__ == "__main__":
    unittest.main()

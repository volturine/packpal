CREATE TABLE IF NOT EXISTS billing_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  checkout_session_id TEXT UNIQUE,
  payment_intent_id TEXT UNIQUE,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  dispute_status TEXT NOT NULL DEFAULT 'none',
  credited_micro_usd INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  reserved_micro_usd INTEGER NOT NULL,
  charged_micro_usd INTEGER,
  provider_cost_micro_usd INTEGER,
  generation_id TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_purchases_user_created
  ON billing_purchases(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created
  ON ai_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_pending_generation
  ON ai_usage(user_id, charged_micro_usd, created_at);

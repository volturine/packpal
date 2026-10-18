ALTER TABLE billing_purchases
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live'));

ALTER TABLE ai_usage
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live'));

DROP INDEX IF EXISTS idx_billing_purchases_user_created;
DROP INDEX IF EXISTS idx_ai_usage_user_created;
DROP INDEX IF EXISTS idx_ai_usage_pending_generation;

CREATE INDEX idx_billing_purchases_user_mode_created
  ON billing_purchases(user_id, mode, created_at);
CREATE INDEX idx_ai_usage_user_mode_created
  ON ai_usage(user_id, mode, created_at);
CREATE INDEX idx_ai_usage_pending_user_mode_created
  ON ai_usage(user_id, mode, charged_micro_usd, generation_id, created_at);

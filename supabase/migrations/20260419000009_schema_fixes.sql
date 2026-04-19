-- Migration 9: Schema fixes + Phase 5/6 additions

-- ── clients: add stripe_customer_id ──────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- ── weather_cache: add columns expected by fetch-weather edge function ────────
ALTER TABLE weather_cache ADD COLUMN IF NOT EXISTS cache_key text;
ALTER TABLE weather_cache ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE weather_cache ADD COLUMN IF NOT EXISTS forecast_json jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS weather_cache_key_idx ON weather_cache(cache_key)
  WHERE cache_key IS NOT NULL;

-- ── push_notification_logs: add columns expected by send-push-notification ────
ALTER TABLE push_notification_logs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);
ALTER TABLE push_notification_logs ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE push_notification_logs ADD COLUMN IF NOT EXISTS target text;
ALTER TABLE push_notification_logs ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0;

-- ── push_subscriptions: explicit key columns for push crypto ──────────────────
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth_key text;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions(endpoint)
  WHERE endpoint IS NOT NULL;

-- ── contractor_type_config: add RLS (was missing) ─────────────────────────────
ALTER TABLE contractor_type_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_ctc ON contractor_type_config FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_ctc ON contractor_type_config FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_ctc ON contractor_type_config FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));

-- Migration 7: Push Notifications, Weather Cache & Onboarding (§22.5.3, §9.5.7, §18)

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE, -- NULL for customer subscriptions
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,      -- for customer subscriptions
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,     -- for agent subscriptions
  subscription_json jsonb NOT NULL,
  device_type text CHECK (device_type IN ('ios_pwa','android_pwa','android_browser','desktop')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  title text,
  body text,
  status text CHECK (status IN ('sent','failed')),
  error text,
  sent_at timestamptz DEFAULT now()
);

-- 1-hour TTL cache — no client_id (shared across tenants for same location)
CREATE TABLE weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  response_json jsonb NOT NULL,
  fetched_at timestamptz DEFAULT now()
);
CREATE INDEX weather_cache_location_idx ON weather_cache(lat, lng, fetched_at DESC);

-- Onboarding checklist progress per tenant (§18)
CREATE TABLE onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  step_key text NOT NULL CHECK (step_key IN ('add_logo','set_fee','preview_booking','create_first_lead','send_test_estimate')),
  completed_at timestamptz DEFAULT now(),
  UNIQUE(client_id, step_key)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Agents/admins see subscriptions for their client; users see their own; public insert (booking page)
CREATE POLICY select_ps ON push_subscriptions FOR SELECT
  USING (
    (client_id IS NOT NULL AND can_access_client(client_id))
    OR user_id = auth.uid()
  );
CREATE POLICY insert_ps ON push_subscriptions FOR INSERT WITH CHECK (true); -- booking page = unauthenticated
CREATE POLICY update_ps ON push_subscriptions FOR UPDATE
  USING (
    (client_id IS NOT NULL AND can_access_client(client_id))
    OR user_id = auth.uid()
  );
CREATE POLICY delete_ps ON push_subscriptions FOR DELETE
  USING (
    (client_id IS NOT NULL AND can_access_client(client_id))
    OR user_id = auth.uid()
  );

ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_pnl ON push_notification_logs FOR SELECT USING (has_platform_role('platform_admin'));
CREATE POLICY insert_pnl ON push_notification_logs FOR INSERT WITH CHECK (true); -- edge functions insert

-- weather_cache: no client_id — all authenticated users read/write
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_wc ON weather_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_wc ON weather_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY update_wc ON weather_cache FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_op ON onboarding_progress FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_op ON onboarding_progress FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_op ON onboarding_progress FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));
CREATE POLICY delete_op ON onboarding_progress FOR DELETE USING (can_access_client(client_id));

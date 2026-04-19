-- Migration 6: Communication & Form Config (§7.6)

CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  variables text[] DEFAULT '{}'
);

CREATE TABLE client_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  template_key text NOT NULL,
  subject text,
  body_html text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, template_key)
);

-- IMMUTABLE — SELECT + INSERT only
CREATE TABLE email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  template_key text,
  to_address text,
  status text CHECK (status IN ('sent','failed','skipped')),
  error text,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE intake_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE, -- NULL = platform default
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','select','multiselect','boolean','date','textarea','file','tel','email')),
  options_json jsonb,
  section text CHECK (section IN ('who_where','what_when','trade_details','notes')),
  display_order integer NOT NULL DEFAULT 0,
  required boolean DEFAULT false,
  visible_for_types text[] DEFAULT '{}', -- empty = all types
  maps_to_leads_column text,
  placeholder text
);

CREATE TABLE booking_page_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  field_key text NOT NULL,
  field_label text,
  field_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  required boolean DEFAULT false,
  options_json jsonb,
  placeholder text
);

CREATE TABLE assessment_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  field_key text NOT NULL,
  field_label text,
  field_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  required boolean DEFAULT false,
  options_json jsonb,
  placeholder text
);

CREATE TABLE deposit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  consultation_fee numeric DEFAULT 0,
  assessment_fee numeric DEFAULT 0,
  deposit_pct numeric DEFAULT 0,
  show_consultation_banner boolean DEFAULT false
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

-- email_templates: SELECT for all authenticated; writes for platform_admin only
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_et ON email_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_et ON email_templates FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY update_et ON email_templates FOR UPDATE USING (has_platform_role('platform_admin'));

ALTER TABLE client_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_cet ON client_email_templates FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_cet ON client_email_templates FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_cet ON client_email_templates FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));
CREATE POLICY delete_cet ON client_email_templates FOR DELETE USING (can_access_client(client_id));

-- email_events: SELECT + INSERT only (immutable)
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_ee ON email_events FOR SELECT
  USING (client_id IS NULL OR can_access_client(client_id));
CREATE POLICY insert_ee ON email_events FOR INSERT WITH CHECK (true); -- service role inserts from edge functions

-- intake_fields: NULL client_id = platform default (visible to all authenticated)
ALTER TABLE intake_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_if ON intake_fields FOR SELECT
  USING (client_id IS NULL OR can_access_client(client_id));
CREATE POLICY insert_if ON intake_fields FOR INSERT
  WITH CHECK (
    (client_id IS NULL AND has_platform_role('platform_admin'))
    OR (client_id IS NOT NULL AND can_access_client(client_id))
  );
CREATE POLICY update_if ON intake_fields FOR UPDATE
  USING (
    (client_id IS NULL AND has_platform_role('platform_admin'))
    OR (client_id IS NOT NULL AND can_access_client(client_id))
  );

-- Standard RLS for remaining tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['booking_page_fields','assessment_fields','deposit_rules'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY select_%s ON %I FOR SELECT USING (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY insert_%s ON %I FOR INSERT WITH CHECK (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY update_%s ON %I FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY delete_%s ON %I FOR DELETE USING (can_access_client(client_id))', tbl, tbl);
  END LOOP;
END $$;

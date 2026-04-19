-- Migration 4: Trade-Specific Tables (§7.4)

CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  contact text,
  specialty text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES vendors(id),
  amount numeric DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  items_json jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Wire deferred vendor FK on job_costs
ALTER TABLE job_costs ADD CONSTRAINT fk_job_costs_vendor
  FOREIGN KEY (vendor_id) REFERENCES vendors(id);

CREATE TABLE permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  permit_type text NOT NULL,
  permit_number text,
  status text DEFAULT 'not_applied' CHECK (status IN ('not_applied','applied','approved','failed','expired')),
  authority text,
  applied_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  inspection_type text NOT NULL,
  scheduled_at timestamptz,
  inspector_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','scheduled','passed','failed','re_inspection_required')),
  result_notes text,
  passed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE draw_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name text,
  total_contract_value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE draw_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES draw_schedules(id) ON DELETE CASCADE NOT NULL,
  draw_number integer NOT NULL,
  milestone_label text,
  trigger_stage text,
  percentage numeric DEFAULT 0,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','requested','approved','paid')),
  released_at timestamptz
);

CREATE TABLE maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES leads(id),
  service_type text,
  frequency text CHECK (frequency IN ('monthly','quarterly','bi_annual','annual')),
  next_service_date date,
  auto_schedule boolean DEFAULT false,
  rate numeric DEFAULT 0,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX maintenance_contracts_next_service_idx ON maintenance_contracts(next_service_date)
  WHERE auto_schedule = true;

-- ── RLS — standard pattern ────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'vendors','purchase_orders','permits','inspections',
    'draw_schedules','maintenance_contracts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY select_%s ON %I FOR SELECT USING (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY insert_%s ON %I FOR INSERT WITH CHECK (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY update_%s ON %I FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY delete_%s ON %I FOR DELETE USING (can_access_client(client_id))', tbl, tbl);
  END LOOP;
END $$;

-- draw_schedule_items — scoped via draw_schedules.client_id
ALTER TABLE draw_schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_dsi ON draw_schedule_items FOR SELECT
  USING (EXISTS(SELECT 1 FROM draw_schedules ds WHERE ds.id = schedule_id AND can_access_client(ds.client_id)));
CREATE POLICY insert_dsi ON draw_schedule_items FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM draw_schedules ds WHERE ds.id = schedule_id AND can_access_client(ds.client_id)));
CREATE POLICY update_dsi ON draw_schedule_items FOR UPDATE
  USING (EXISTS(SELECT 1 FROM draw_schedules ds WHERE ds.id = schedule_id AND can_access_client(ds.client_id)));
CREATE POLICY delete_dsi ON draw_schedule_items FOR DELETE
  USING (EXISTS(SELECT 1 FROM draw_schedules ds WHERE ds.id = schedule_id AND can_access_client(ds.client_id)));

-- Migration 3: Lead & Job Data (§7.3)

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  pipeline_stage text NOT NULL DEFAULT 'new_lead',
  workflow_template text,
  contractor_type text,
  full_name text,
  phone text,
  email text,
  property_address text,
  property_lat numeric,
  property_lng numeric,
  project_type text,
  budget_range text,
  preferred_date date,
  preferred_time text CHECK (preferred_time IN ('Morning','Afternoon','Evening','Flexible')),
  lead_source text,
  taken_by text,
  site_assessment_id uuid, -- FK added below after site_assessments
  fee_acknowledged boolean DEFAULT false,
  urgency text CHECK (urgency IN ('High','Medium','Low')),
  urgency_level text CHECK (urgency_level IN ('critical','serious','standard')),
  portal_token uuid DEFAULT gen_random_uuid() UNIQUE,
  lost_at_stage text,
  dispatch_started_at timestamptz,
  dispatched_at timestamptz,
  arrived_at timestamptz,
  estimate_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX leads_client_id_idx ON leads(client_id);
CREATE INDEX leads_pipeline_stage_idx ON leads(pipeline_stage);
CREATE INDEX leads_portal_token_idx ON leads(portal_token);
CREATE INDEX leads_fts ON leads USING gin(
  to_tsvector('english',
    coalesce(full_name,'') || ' ' ||
    coalesce(phone,'') || ' ' ||
    coalesce(email,'') || ' ' ||
    coalesce(property_address,'')
  )
);

-- Wire deferred FKs from migrations 2 that needed leads
ALTER TABLE automation_scheduled_jobs
  ADD CONSTRAINT fk_asj_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE automation_runs
  ADD CONSTRAINT fk_ar_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE TABLE lead_intake_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  field_key text NOT NULL,
  field_value text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE site_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  property_address text,
  scheduled_at timestamptz,
  assigned_specialist text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','complete','cancelled')),
  notes text,
  completed_at timestamptz,
  confirmation_number text UNIQUE,
  weather_forecast_json jsonb
);

-- Wire site_assessment_id FK on leads
ALTER TABLE leads ADD CONSTRAINT fk_lead_site_assessment
  FOREIGN KEY (site_assessment_id) REFERENCES site_assessments(id);

CREATE TABLE estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  mode text DEFAULT 'itemized' CHECK (mode IN ('itemized','flat','sqft')),
  markup_pct numeric DEFAULT 0,
  tax_pct numeric DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected')),
  total_contractor_amount numeric DEFAULT 0,
  total_customer_materials numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  description text,
  quantity numeric DEFAULT 1,
  unit text,
  unit_cost numeric DEFAULT 0,
  type text,
  supplied_by text DEFAULT 'contractor' CHECK (supplied_by IN ('contractor','customer')),
  catalog_product_id uuid, -- FK added in migration 5 after materials_catalog
  customer_unit_cost numeric
);

CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  terms_text text,
  signature_data text,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text CHECK (type IN ('deposit','consultation','milestone','final','service')),
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_payment_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  assignee_role text,
  due_at timestamptz,
  status text DEFAULT 'open' CHECK (status IN ('open','complete')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE job_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  cost_type text,
  amount numeric DEFAULT 0,
  vendor_id uuid, -- FK added in migration 4 after vendors
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  file_name text,
  file_path text NOT NULL,
  file_type text CHECK (file_type IN ('image','video','document','invoice')),
  file_size bigint,
  phase text,
  caption text,
  uploaded_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  work_summary text,
  hours_worked numeric,
  weather text,
  weather_auto_filled boolean DEFAULT false,
  materials_used text,
  issues_noted text,
  crew_member text,
  logged_by uuid REFERENCES auth.users,
  logged_at timestamptz DEFAULT now()
);

CREATE TABLE change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  amount numeric DEFAULT 0,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── RLS — standard pattern for all lead/job tables ────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leads','lead_intake_data','site_assessments','estimates','estimate_line_items',
    'contracts','invoices','tasks','job_costs','job_files','daily_logs','change_orders'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY select_%s ON %I FOR SELECT USING (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY insert_%s ON %I FOR INSERT WITH CHECK (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY update_%s ON %I FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id))', tbl, tbl);
    EXECUTE format('CREATE POLICY delete_%s ON %I FOR DELETE USING (can_access_client(client_id))', tbl, tbl);
  END LOOP;
END $$;

-- Portal token access: unauthenticated customers read their own lead via portal_token header
CREATE POLICY portal_select_leads ON leads FOR SELECT
  USING (portal_token::text = current_setting('request.headers', true)::json->>'x-portal-token');

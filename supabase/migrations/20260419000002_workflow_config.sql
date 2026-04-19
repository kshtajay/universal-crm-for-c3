-- Migration 2: Workflow Config (§7.2)

CREATE TABLE contractor_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  default_workflow_template_id uuid, -- FK added below after workflow_templates
  permits_required boolean DEFAULT false,
  inspections_required boolean DEFAULT false,
  draw_schedules_enabled boolean DEFAULT false,
  emergency_dispatch_enabled boolean DEFAULT false,
  maintenance_contracts_enabled boolean DEFAULT false,
  site_assessment_required boolean DEFAULT false
);

-- Per-tenant feature flag overrides (weather alerts, etc.) — §9.5.4
CREATE TABLE contractor_type_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  weather_alerts_enabled boolean DEFAULT false,
  weather_email_customer boolean DEFAULT false,
  UNIQUE(client_id)
);

-- Now that contractor_types exists, add FK on clients
ALTER TABLE clients ADD CONSTRAINT fk_contractor_type
  FOREIGN KEY (contractor_type_id) REFERENCES contractor_types(id);

CREATE TABLE workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  max_stage_count integer
);

ALTER TABLE contractor_types ADD CONSTRAINT fk_default_template
  FOREIGN KEY (default_workflow_template_id) REFERENCES workflow_templates(id);

CREATE TABLE workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES workflow_templates(id) ON DELETE CASCADE NOT NULL,
  stage_key text NOT NULL,
  stage_label text NOT NULL,
  display_order integer NOT NULL,
  allowed_next text[] DEFAULT '{}',
  allowed_actions text[] DEFAULT '{}',
  is_terminal boolean DEFAULT false,
  color_code text DEFAULT '#888888',
  UNIQUE(template_id, stage_key)
);

CREATE TABLE client_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  template_id uuid REFERENCES workflow_templates(id) NOT NULL,
  assigned_at timestamptz DEFAULT now()
);

CREATE TABLE workspace_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_key text UNIQUE NOT NULL,
  label text NOT NULL,
  icon_name text,
  visible_for_types text[] DEFAULT '{}', -- empty = visible for all types
  display_order integer NOT NULL
);

CREATE TABLE workflow_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  trigger_event text NOT NULL CHECK (trigger_event IN (
    'stage_change','lead_created','site_assessment_complete','estimate_approved',
    'contract_signed','payment_received','inspection_passed','permit_approved',
    'dispatch_assigned','maintenance_due'
  )),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE automation_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES workflow_automations(id) ON DELETE CASCADE NOT NULL,
  field text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('equals','not_equals','contains','gt','lt','in','is_null','is_not_null')),
  value text
);

CREATE TABLE automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES workflow_automations(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'send_email','update_field','create_task','delay','webhook',
    'create_invoice','advance_stage','push_notification'
  )),
  action_config jsonb DEFAULT '{}',
  execution_order integer NOT NULL DEFAULT 1
);

CREATE TABLE automation_scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES workflow_automations(id) ON DELETE CASCADE NOT NULL,
  chained_action_id uuid REFERENCES automation_actions(id),
  lead_id uuid, -- FK added in migration 3 after leads table exists
  run_at timestamptz NOT NULL,
  status text DEFAULT 'queued' CHECK (status IN ('queued','processing','complete','failed')),
  payload jsonb DEFAULT '{}',
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX automation_scheduled_jobs_run_at_idx ON automation_scheduled_jobs(run_at) WHERE status = 'queued';

-- IMMUTABLE — SELECT + INSERT only, no UPDATE or DELETE
CREATE TABLE automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES workflow_automations(id),
  lead_id uuid, -- FK added in migration 3
  trigger_event text,
  status text NOT NULL CHECK (status IN ('success','skipped','failed')),
  actions_fired text[] DEFAULT '{}',
  payload jsonb DEFAULT '{}',
  error text,
  ran_at timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

-- contractor_types, workflow_templates, workflow_stages, workspace_tabs:
-- SELECT for all authenticated; writes reserved for platform_admin
ALTER TABLE contractor_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_ct ON contractor_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_ct ON contractor_types FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY update_ct ON contractor_types FOR UPDATE USING (has_platform_role('platform_admin'));

ALTER TABLE contractor_type_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_ctc ON contractor_type_config FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_ctc ON contractor_type_config FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_ctc ON contractor_type_config FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_wt ON workflow_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_wt ON workflow_templates FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY update_wt ON workflow_templates FOR UPDATE USING (has_platform_role('platform_admin'));

ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_ws ON workflow_stages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_ws ON workflow_stages FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY update_ws ON workflow_stages FOR UPDATE USING (has_platform_role('platform_admin'));

ALTER TABLE workspace_tabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_wstabs ON workspace_tabs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_wstabs ON workspace_tabs FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY update_wstabs ON workspace_tabs FOR UPDATE USING (has_platform_role('platform_admin'));

ALTER TABLE client_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_cw ON client_workflows FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_cw ON client_workflows FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_cw ON client_workflows FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));

ALTER TABLE workflow_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_wa ON workflow_automations FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_wa ON workflow_automations FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_wa ON workflow_automations FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));
CREATE POLICY delete_wa ON workflow_automations FOR DELETE USING (can_access_client(client_id));

ALTER TABLE automation_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_ac ON automation_conditions FOR SELECT
  USING (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));
CREATE POLICY insert_ac ON automation_conditions FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));
CREATE POLICY delete_ac ON automation_conditions FOR DELETE
  USING (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));

ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_aa ON automation_actions FOR SELECT
  USING (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));
CREATE POLICY insert_aa ON automation_actions FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));
CREATE POLICY update_aa ON automation_actions FOR UPDATE
  USING (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));
CREATE POLICY delete_aa ON automation_actions FOR DELETE
  USING (EXISTS(SELECT 1 FROM workflow_automations wa WHERE wa.id = automation_id AND can_access_client(wa.client_id)));

-- automation_runs: SELECT + INSERT only (immutable audit log)
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY insert_ar ON automation_runs FOR INSERT WITH CHECK (true);
CREATE POLICY select_ar ON automation_runs FOR SELECT USING (
  automation_id IN (SELECT id FROM workflow_automations WHERE can_access_client(client_id))
  OR has_platform_role('platform_admin')
);

-- Migration 1: Tenant & Auth (§7.1)
-- Order: tables first → helper functions → policies (SQL functions validate table refs at creation)

-- ── packages ──────────────────────────────────────────────────────────────────
CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  max_leads integer,
  features_json jsonb,
  created_at timestamptz DEFAULT now()
);

-- ── user_roles ────────────────────────────────────────────────────────────────
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('platform_admin','client_manager','tenant_admin','tenant_agent','viewer')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX user_roles_user_id_idx ON user_roles(user_id);

-- ── Core tenant tables (must exist before helper functions reference them) ────
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  company_name text NOT NULL,
  package_id uuid REFERENCES packages(id),
  contractor_type_id uuid, -- FK added in migration 2 after contractor_types exists
  is_active boolean DEFAULT true,
  managed_by_ka boolean DEFAULT false,
  ka_project_manager_id uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  brand_name text,
  logo_url text,
  primary_color text DEFAULT '#F5C542',
  secondary_color text DEFAULT '#0A1628',
  tagline text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE client_user_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('tenant_admin','tenant_agent','viewer')),
  is_ka_agent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- ── RLS helper functions (tables above must exist first for SQL-language validation) ──
CREATE OR REPLACE FUNCTION get_my_client_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT client_id FROM client_user_assignments WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION has_platform_role(r text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = r)
$$;

CREATE OR REPLACE FUNCTION can_access_client(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT has_platform_role('platform_admin')
      OR has_platform_role('client_manager')
      OR get_my_client_id() = cid
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_clients ON clients FOR SELECT USING (can_access_client(id));
CREATE POLICY insert_clients ON clients FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY update_clients ON clients FOR UPDATE USING (can_access_client(id)) WITH CHECK (can_access_client(id));
CREATE POLICY delete_clients ON clients FOR DELETE USING (has_platform_role('platform_admin'));

ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_brand_settings ON brand_settings FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_brand_settings ON brand_settings FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_brand_settings ON brand_settings FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));
CREATE POLICY delete_brand_settings ON brand_settings FOR DELETE USING (can_access_client(client_id));

ALTER TABLE client_user_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_cua ON client_user_assignments FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_cua ON client_user_assignments FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_cua ON client_user_assignments FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));
CREATE POLICY delete_cua ON client_user_assignments FOR DELETE USING (can_access_client(client_id));

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_user_roles ON user_roles FOR SELECT USING (user_id = auth.uid() OR has_platform_role('platform_admin'));
CREATE POLICY insert_user_roles ON user_roles FOR INSERT WITH CHECK (has_platform_role('platform_admin'));
CREATE POLICY delete_user_roles ON user_roles FOR DELETE USING (has_platform_role('platform_admin'));

-- Migration 11: lead_notes table + pdf_url columns + misc gaps

-- ── lead_notes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content     text NOT NULL,
  note_type   text NOT NULL DEFAULT 'call',  -- call | email | sms | internal
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_notes_lead_id_idx ON lead_notes(lead_id);
CREATE INDEX lead_notes_client_id_idx ON lead_notes(client_id);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_notes_client_access" ON lead_notes
  FOR ALL USING (can_access_client(client_id));

-- ── pdf_url columns ────────────────────────────────────────────────────────────
ALTER TABLE estimates  ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE contracts  ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE invoices   ADD COLUMN IF NOT EXISTS pdf_url text;

-- ── contracts missing columns ──────────────────────────────────────────────────
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pdf_url text;

-- ── automation_runs: add lead_id + notes columns if missing ───────────────────
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS lead_id  uuid REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS notes    text;

CREATE INDEX IF NOT EXISTS automation_runs_lead_id_idx ON automation_runs(lead_id);

-- ── clients: add email column if missing ──────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email text;

-- ── deposit_rules: add is_active if missing ───────────────────────────────────
ALTER TABLE deposit_rules ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Migration 10: Seed packages + misc missing seeds

-- ── packages (3 rows) ────────────────────────────────────────────────────────
INSERT INTO packages (name, max_leads, features_json) VALUES
  ('Basic',        50,   '{"price_monthly": 97,  "features": ["leads","estimates","contracts","invoices","email_templates"]}'),
  ('Professional', 200,  '{"price_monthly": 197, "features": ["all_basic","materials","portal","draw_schedules","pdf_generation"]}'),
  ('Enterprise',   null, '{"price_monthly": 397, "features": ["all_professional","unlimited_leads","all_contractor_types","permits","inspections","push_notifications","priority_support","managed_service"]}')
ON CONFLICT DO NOTHING;

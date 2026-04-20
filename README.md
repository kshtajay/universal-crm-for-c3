# Contractors Command Center (CCC)

Universal CRM for contractors — multi-tenant SaaS built on React + Supabase.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Payments | Stripe (invoices + hosted checkout) |
| Email | Google Apps Script webhook via `apps-script-proxy` |
| Push | Web Push / VAPID via `send-push-notification` |
| PDF | PDFShift API via `generate-*-pdf` functions |
| Weather | Open-Meteo (free, no key) via `fetch-weather` |
| Geocoding | Radar.io via `geocode-address` |
| AI | Claude claude-sonnet-4-6 via `parse-lead-text` + `parse-voice-memo` |

## Local Dev

```bash
npm install
cp .env.example .env          # fill in Supabase keys
npm run dev                   # http://localhost:5173
```

## Environment Variables

```
# Required
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_RADAR_PUBLISHABLE_KEY=

# Edge function secrets (set in Supabase dashboard → Edge Functions → Secrets)
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RADAR_SECRET_KEY=
GAS_WEBHOOK_URL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
ANTHROPIC_API_KEY=
PDFSHIFT_API_KEY=          # optional — PDF functions return HTML without it
LOWES_API_KEY=             # optional — retailer pricing
```

## Database

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push          # applies all 11 migrations in order
```

Migrations run in timestamp order from `supabase/migrations/`:

| # | File | What it creates |
|---|------|----------------|
| 01 | `tenant_auth` | clients, brand_settings, client_user_assignments, RLS helpers |
| 02 | `workflow_config` | workflow_templates, stages, automations, scheduled_jobs, runs |
| 03 | `lead_job_data` | leads, estimates, contracts, invoices, tasks, files, daily_logs |
| 04 | `trade_specific` | permits, inspections, draw_schedules, change_orders, vendors |
| 05 | `materials` | materials_catalog, retailer_price_cache |
| 06 | `communication_forms` | email_templates, intake_fields, deposit_rules, booking_fields |
| 07 | `push_weather` | push_subscriptions, push_notification_logs, weather_cache |
| 08 | `seed_data` | workspace_tabs, email_templates (28), intake_fields, contractor_types |
| 09 | `schema_fixes` | patch columns added during iterative build |
| 10 | `packages_seed` | Basic $97 / Professional $197 / Enterprise $397 |
| 11 | `missing_columns` | lead_notes, pdf_url cols, automation_runs.lead_id |

## Routes

```
/                          → LandingPage
/pricing                   → PricingPage
/demo                      → DemoPage (K&A demo, no auth)
/login                     → LoginPage (smart redirect after login)

/:slug/dashboard           → TenantDashboard       [protected]
/:slug/hub                 → HubPage (lead pipeline) [protected]
/:slug/settings            → SettingsPage           [protected]

/book/:slug                → BookingPage (public lead intake)
/assessment/:slug          → AssessmentBookingPage (public)
/consultation/:slug        → ConsultationPaymentPage (Stripe fee)
/portal/:token             → CustomerPortal (token-based, no auth)

/admin                     → AdminDashboard         [platform_admin]
/admin/clients             → AdminClientList        [platform_admin]
/admin/client/:slug/dashboard → AdminClientView     [platform_admin]
```

## Edge Functions

Deploy all at once:

```bash
npx supabase functions deploy --no-verify-jwt
```

| Function | Purpose |
|----------|---------|
| `run-automation` | Evaluates and fires workflow automations |
| `process-scheduled-jobs` | Cron — processes `automation_scheduled_jobs` |
| `apps-script-proxy` | Forwards email requests to Google Apps Script |
| `send-client-email` | Template render + send + log to email_events |
| `send-push-notification` | VAPID Web Push to agent or customer |
| `fetch-weather` | Open-Meteo with 6h cache |
| `create-stripe-invoice` | Creates + finalizes Stripe invoice |
| `stripe-webhook` | Handles invoice.paid, payment_failed, checkout.session.completed |
| `provision-tenant` | Full client setup (brand + workflow + deposit rule) |
| `geocode-address` | Radar.io → lat/lng, persists to leads table |
| `get-booking-config` | Public config for /book and /assessment pages |
| `submit-booking` | Creates lead from public booking form |
| `get-portal-data` | Token-based portal data (no auth) |
| `fetch-retailer-pricing` | Lowe's product pricing with 24h cache |
| `search-retailer-products` | Catalog search + Lowe's fallback |
| `parse-lead-text` | Claude AI — extract lead fields from phone notes |
| `parse-voice-memo` | Claude AI — transcribe + extract from audio URL |
| `generate-estimate-pdf` | HTML estimate → PDFShift → Storage |
| `generate-contract-pdf` | HTML contract + signature → PDFShift → Storage |
| `generate-invoice-pdf` | HTML invoice with Pay Now link → PDFShift → Storage |

## Auth Flow

- `platform_admin` / `client_manager` → redirected to `/admin`
- Tenant agents (in `client_user_assignments`) → redirected to `/:slug/dashboard`
- Roles in `user_roles` table, checked via `has_platform_role()` DB function

## Workspace Tabs

All tabs live in `src/components/workspace/tabs/`. Each accepts `{ leadId, clientId }`.
Visibility is controlled by `workspace_tabs.visible_for_types[]` in the DB — no code changes needed to show/hide tabs per contractor type.

| tab_key | Component | Notes |
|---------|-----------|-------|
| overview | OverviewTab | Lead summary, stage, address |
| intake | IntakeTab | Dynamic intake fields |
| estimate | EstimateTab | Section A/B, markup/tax, send → automation |
| contract | ContractTab | Terms, canvas signature pad, send/sign |
| invoice | InvoiceTab | Stripe invoices, pay link, totals |
| tasks | TasksTab | Task checklist |
| files | FilesTab | Storage upload grouped by phase |
| notes | NotesTab | Call notes + automation activity log |
| daily_logs | DailyLogsTab | Crew/hours + auto-weather from job address |
| permits | PermitTab | Permit status progression |
| draw_schedule | DrawScheduleTab | AIA milestones + release tracking |
| change_orders | ChangeOrderTab | CO approve/reject with running total |
| weather | WeatherTab | Forecast from job address lat/lng |
| materials | MaterialsTab | Retailer product search + add to job costs |
| portal | PortalPreviewTab | Generate token, copy link, send invite email |

## Key Design Decisions

- **Table-driven tabs**: Which tabs appear for which contractor type is a DB row — no redeploy needed to configure
- **Split estimate**: Section A = contractor charges (markup applied, hidden from customer); Section B = customer shopping list (they buy it themselves)
- **PDF fallback**: All `generate-*-pdf` functions return raw HTML if `PDFSHIFT_API_KEY` is unset — useful for local preview
- **Portal tokens**: `leads.portal_token` is auto-generated on lead creation. CustomerPortal uses it directly with no auth required
- **RLS standard pattern**: Every table uses `can_access_client(client_id)` — one function governs all access
- **Automation engine**: `run-automation` evaluates conditions from `automation_conditions` rows and executes `automation_actions` — all configurable from DB without code changes

## Stripe Webhook Setup

In the Stripe dashboard, set the webhook endpoint to:
```
https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
```

Events to subscribe:
- `invoice.paid`
- `invoice.payment_failed`
- `checkout.session.completed`

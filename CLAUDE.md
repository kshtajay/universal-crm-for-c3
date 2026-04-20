# CLAUDE.md — Contractors Command Center

## What This Is

Multi-tenant contractor CRM SaaS. K&A (Kennedy & Associates) is the platform owner who sells it to contractor clients. Each contractor client gets a `/:slug/dashboard` workspace.

**Branch**: `claude/new-build-setup-s7osU`  
**Repo**: `kshtajay/universal-crm-for-c3`

## Three User Roles

1. **K&A admin** (`platform_admin` in `user_roles`) → `/admin/*` routes, AdminShell sidebar
2. **Tenant agent** (row in `client_user_assignments`) → `/:slug/*` routes
3. **Customer** (no auth) → `/portal/:token` and `/book/:slug`

## Critical RLS Pattern

Every table uses `can_access_client(client_id)`. Defined in migration 01. Never bypass it.

```sql
-- The three DB helpers everything depends on:
get_my_client_id()         -- returns client_id for the logged-in user
has_platform_role(role)    -- checks user_roles table
can_access_client(client_id) -- used in every RLS policy
```

## File Structure

```
src/
  pages/              # One file per route
  components/
    workspace/
      JobWorkspaceModal.tsx   # The main slide-over — renderTab() switch
      tabs/                   # 15 tab components, all accept { leadId, clientId }
    admin/
      AdminShell.tsx          # Shared sidebar for /admin/* pages
      CreateClientModal.tsx
    booking/
      DynamicField.tsx
  hooks/
    useClientContext.ts       # slug → { clientId, companyName }
    usePushNotifications.ts
  integrations/supabase/client.ts

supabase/
  functions/          # 20 edge functions, all Deno.serve handlers
  migrations/         # 11 migrations, run in timestamp order
```

## Adding a New Workspace Tab

1. Create `src/components/workspace/tabs/YourTab.tsx` — props: `{ leadId: string, clientId: string }`
2. Add `case 'your_key': return <YourTab leadId={leadId} clientId={clientId} />` in `JobWorkspaceModal.tsx` renderTab()
3. Insert a row into `workspace_tabs` table: `(tab_key, label, display_order, visible_for_types[])`

## Key Tables

| Table | Purpose |
|-------|---------|
| `clients` | One row per contractor business |
| `leads` | The central entity — one per job/inquiry |
| `estimates` | One per lead, has line_items |
| `estimate_line_items` | `supplied_by: 'contractor' | 'customer'` |
| `contracts` | One per lead, terms + signature_image_url |
| `invoices` | Stripe invoices, `stripe_payment_url` for hosted checkout |
| `lead_notes` | Call notes from NotesTab |
| `automation_runs` | Immutable audit log of all automation triggers |
| `workspace_tabs` | Controls which tabs show in JobWorkspaceModal |
| `email_templates` | 28 platform defaults, client can override in `client_email_templates` |
| `push_subscriptions` | Web Push endpoints, deleted on 410 Gone |
| `weather_cache` | Open-Meteo results cached 6h by `lat:lng:date` |

## Edge Function Pattern

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  // ... handler
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
})
```

Internal calls use `supabase.functions.invoke('function-name', { body: {...} })`.

## Estimate Logic

- `supplied_by = 'contractor'` → Section A (contractor charges, markup + tax applied)
- `supplied_by = 'customer'` → Section B (customer shopping list, no markup)
- `total_contractor_amount` = sum(qty × unit_cost) × (1 + markup_pct/100) × (1 + tax_pct/100)
- `total_customer_materials` = sum(qty × customer_unit_cost)
- Portal shows contractor total only — never exposes unit costs or markup

## Color System

```
Navy background:  #0A1628  (--background)
Card background:  ~#111E30  (--card)
Gold accent:      #F5C542  (--primary)
Muted text:       ~#8A9BB0  (--muted-foreground)
```

Tailwind uses CSS variables. Never hardcode colors in components — use `bg-primary`, `text-muted-foreground`, etc.

## PDF Generation

`generate-estimate-pdf`, `generate-contract-pdf`, `generate-invoice-pdf` all:
1. Fetch data from Supabase
2. Build an HTML string
3. POST to PDFShift (`PDFSHIFT_API_KEY`) → get PDF bytes
4. Upload to `job-files` Storage bucket
5. Return `{ pdf_url }`

If `PDFSHIFT_API_KEY` is not set, they return the raw HTML — good for local preview.

## Automation Engine

`run-automation` receives `{ event_type, lead_id, client_id, payload }`.
It queries `workflow_automations` + `automation_conditions` + `automation_actions` for matching rules,
then executes actions (send_email, send_push, update_stage, create_task, schedule_job).
All executions are logged to `automation_runs`.

## Known Environment Variables Needed

| Var | Where |
|-----|-------|
| `VITE_SUPABASE_URL` | `.env` |
| `VITE_SUPABASE_ANON_KEY` | `.env` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `.env` |
| `VITE_VAPID_PUBLIC_KEY` | `.env` |
| `VITE_RADAR_PUBLISHABLE_KEY` | `.env` |
| `STRIPE_SECRET_KEY` | Supabase secrets |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets |
| `RADAR_SECRET_KEY` | Supabase secrets |
| `GAS_WEBHOOK_URL` | Supabase secrets |
| `VAPID_PRIVATE_KEY` | Supabase secrets |
| `ANTHROPIC_API_KEY` | Supabase secrets |
| `PDFSHIFT_API_KEY` | Supabase secrets (optional) |
| `LOWES_API_KEY` | Supabase secrets (optional) |

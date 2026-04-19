-- Migration 5: Materials Integration (§7.5)

CREATE TABLE materials_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  product_sku text,
  retailer text CHECK (retailer IN ('lowes','homedepot','local_supplier','online','other')),
  product_url text,
  image_url text,
  unit text,
  unit_cost numeric DEFAULT 0,
  last_price_refresh timestamptz,
  price_is_manual boolean DEFAULT true,
  category text,
  contractor_type_tags text[] DEFAULT '{}',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE retailer_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer text NOT NULL,
  product_sku text NOT NULL,
  price numeric,
  availability text,
  store_id text,
  fetched_at timestamptz DEFAULT now(),
  raw_response jsonb,
  UNIQUE(retailer, product_sku)
);
CREATE INDEX retailer_price_cache_fetched_at_idx ON retailer_price_cache(fetched_at);

-- Wire deferred catalog FK on estimate_line_items
ALTER TABLE estimate_line_items ADD CONSTRAINT fk_eli_catalog
  FOREIGN KEY (catalog_product_id) REFERENCES materials_catalog(id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE materials_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_mc ON materials_catalog FOR SELECT USING (can_access_client(client_id));
CREATE POLICY insert_mc ON materials_catalog FOR INSERT WITH CHECK (can_access_client(client_id));
CREATE POLICY update_mc ON materials_catalog FOR UPDATE USING (can_access_client(client_id)) WITH CHECK (can_access_client(client_id));
CREATE POLICY delete_mc ON materials_catalog FOR DELETE USING (can_access_client(client_id));

-- retailer_price_cache has no client_id — readable by all authenticated users; writes from edge functions
ALTER TABLE retailer_price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_rpc ON retailer_price_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY insert_rpc ON retailer_price_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY update_rpc ON retailer_price_cache FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

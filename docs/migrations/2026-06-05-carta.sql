-- ============================================================
-- Migration: 2026-06-05 — Carta module
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add unit column to products (NOT NULL with safe default)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'unit';

-- 2. Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create menu_item_ingredients table
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  quantity       NUMERIC(10,4) NOT NULL,
  unit           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS menu_items_restaurant_idx       ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS menu_items_deleted_idx          ON menu_items(deleted_at);
CREATE INDEX IF NOT EXISTS mii_menu_item_idx               ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS mii_product_idx                 ON menu_item_ingredients(product_id);

-- 5. Row Level Security
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_items_restaurant" ON menu_items;
CREATE POLICY "menu_items_restaurant" ON menu_items
  FOR ALL USING (restaurant_id = get_current_restaurant_id());

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mii_restaurant" ON menu_item_ingredients;
CREATE POLICY "mii_restaurant" ON menu_item_ingredients
  FOR ALL USING (restaurant_id = get_current_restaurant_id());

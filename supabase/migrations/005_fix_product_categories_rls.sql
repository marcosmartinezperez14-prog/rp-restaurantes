-- Fix RLS policy for product_categories
-- Run in: Supabase Dashboard → SQL Editor

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_restaurant" ON product_categories;

CREATE POLICY "product_categories_restaurant" ON product_categories
  FOR ALL
  USING (restaurant_id = get_current_restaurant_id())
  WITH CHECK (restaurant_id = get_current_restaurant_id());

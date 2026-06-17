-- Migración 013: roles personalizados por restaurante
-- restaurant_id NULL = rol global de sistema (admin, gerente, camarero, etc.)
-- restaurant_id UUID  = rol personalizado de ese restaurante

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_roles_restaurant_id ON roles(restaurant_id);

ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_name_key;

ALTER TABLE roles
  ADD CONSTRAINT roles_name_restaurant_unique
  UNIQUE NULLS NOT DISTINCT (name, restaurant_id);

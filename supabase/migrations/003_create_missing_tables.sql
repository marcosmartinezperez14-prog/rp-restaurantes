-- Crea las mesas faltantes para las zonas existentes
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- Salón (4 mesas)
INSERT INTO tables (zone_id, restaurant_id, number, name, capacity, status, is_active, position)
VALUES
  ('773a1b04-f959-41d0-9a31-09192b3fd7b6', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 1, 'Mesa 1', 4, 'free', true, 0),
  ('773a1b04-f959-41d0-9a31-09192b3fd7b6', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 2, 'Mesa 2', 4, 'free', true, 1),
  ('773a1b04-f959-41d0-9a31-09192b3fd7b6', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 3, 'Mesa 3', 4, 'free', true, 2),
  ('773a1b04-f959-41d0-9a31-09192b3fd7b6', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 4, 'Mesa 4', 4, 'free', true, 3);

-- Nueva zona 1 (4 mesas)
INSERT INTO tables (zone_id, restaurant_id, number, name, capacity, status, is_active, position)
VALUES
  ('aab10c02-e370-4871-a17f-738293be84c2', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 1, 'Mesa 1', 4, 'free', true, 0),
  ('aab10c02-e370-4871-a17f-738293be84c2', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 2, 'Mesa 2', 4, 'free', true, 1),
  ('aab10c02-e370-4871-a17f-738293be84c2', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 3, 'Mesa 3', 4, 'free', true, 2),
  ('aab10c02-e370-4871-a17f-738293be84c2', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 4, 'Mesa 4', 4, 'free', true, 3);

-- Nueva zona 2 (4 mesas)
INSERT INTO tables (zone_id, restaurant_id, number, name, capacity, status, is_active, position)
VALUES
  ('24ec0a00-8be4-49d8-bb37-bdd6dba4e472', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 1, 'Mesa 1', 4, 'free', true, 0),
  ('24ec0a00-8be4-49d8-bb37-bdd6dba4e472', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 2, 'Mesa 2', 4, 'free', true, 1),
  ('24ec0a00-8be4-49d8-bb37-bdd6dba4e472', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 3, 'Mesa 3', 4, 'free', true, 2),
  ('24ec0a00-8be4-49d8-bb37-bdd6dba4e472', 'c9b65f2d-30d7-4edb-a98e-2cf1059aa075', 4, 'Mesa 4', 4, 'free', true, 3);

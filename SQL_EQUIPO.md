# SQL Módulo Equipo

Ejecuta este SQL en el editor de Supabase (SQL Editor).

```sql
-- Insertar los 5 roles base (solo si no existen)
INSERT INTO roles (id, name, description) VALUES
  (gen_random_uuid(), 'admin', 'Acceso total al sistema'),
  (gen_random_uuid(), 'gerente', 'Acceso a todo menos configuración crítica'),
  (gen_random_uuid(), 'camarero', 'Acceso solo a TPV y pedidos'),
  (gen_random_uuid(), 'cocinero', 'Solo puede ver pedidos y cocina'),
  (gen_random_uuid(), 'contable', 'Solo acceso a finanzas y facturas')
ON CONFLICT (name) DO NOTHING;

-- Tabla de invitaciones/usuarios pendientes
CREATE TABLE IF NOT EXISTS invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  role_name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'expirada')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_invitaciones_restaurant_id ON invitaciones(restaurant_id);
CREATE INDEX idx_invitaciones_email ON invitaciones(email);

ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitaciones_select" ON invitaciones
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "invitaciones_insert" ON invitaciones
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "invitaciones_update" ON invitaciones
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "invitaciones_delete" ON invitaciones
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());
```
